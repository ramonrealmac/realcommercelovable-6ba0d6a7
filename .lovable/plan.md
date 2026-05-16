## Causa raiz

Confirmado no schema:

- `movimento.movimento_id` → **IDENTITY** (autonumeração)
- `movimento.nr_movimento` → `DEFAULT nextval('movimento_nr_seq')`
- `movimento_item.movimento_item_id` → **IDENTITY**

Hoje a edge function `supabase/functions/chat-realsys/index.ts` calcula manualmente esses três valores com `SELECT max(...) + 1` e os passa nos `INSERT`. Isso causa:

1. Conflito de PK (duplicate key) quando a sequência IDENTITY já avançou além do `max()` — o insert falha silenciosamente para a IA, que mesmo assim devolve "pedido criado".
2. `nr_movimento` calculado por empresa briga com a sequência global do banco.

Resultado: pedido nunca é gravado, mas a IA confirma sucesso ao usuário.

## Mudanças (apenas em `supabase/functions/chat-realsys/index.ts`)

Aplicar em **dois blocos**: `processar_devolucao_xml` (linhas ~418–488) e `criar_pedido_completo` (linhas ~581–607).

Em cada bloco:

1. **Remover** as quatro consultas `select(...).order(... desc).limit(1)` que calculam `maxMov`/`maxNr`/`maxIt` e as variáveis `movId`, `nr`, `nextItId` derivadas delas.

2. **Inserir movimento sem IDs manuais** e capturar o retorno:
   ```ts
   const { data: movRow, error: eMov } = await supabase
     .from("movimento")
     .insert({ empresa_id, cadastro_id, condicao_id, tp_movimento: "PD", ... /* sem movimento_id, sem nr_movimento */ })
     .select("movimento_id, nr_movimento")
     .single();
   if (eMov) throw eMov;
   const movId = movRow.movimento_id;
   const nr = movRow.nr_movimento;
   ```

3. **Itens sem `movimento_item_id`**: remover o campo do objeto, manter `movimento_id: movId` (vindo do retorno acima).

4. **Demais chamadas** (`fu_recalcular_pedido`, `fu_mudar_status_pedido_pdv`, `fu_calcular_impostos_movimento`, `fiscal_evento`, retorno final) continuam usando `movId`/`nr` capturados do insert — sem mudança de assinatura.

Nenhuma mudança de schema, de UI, ou em `realcommerce-mcp/`.

## Verificação pós-deploy

- No chat: "criar pedido para <cliente> com 2 unidades de <produto> à vista, finalizar e emitir NFe".
- Conferir em `tool_results` que vem `ok: true` com `movimento_id` e `nr_movimento` reais.
- `SELECT movimento_id, nr_movimento, tp_origem FROM movimento ORDER BY movimento_id DESC LIMIT 3;` deve mostrar o novo pedido com `tp_origem = 'ASSISTENTE'`.
- `fiscal_evento` deve ter linha `PENDENTE` com `comando = 'NFE.CriarEnviarNFe'`.
