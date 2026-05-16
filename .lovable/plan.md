## Objetivo

Corrigir os nomes de coluna errados em `supabase/functions/chat-realsys/index.ts` para que as ferramentas do RealSys Chat (buscar cliente/produto, criar pedido, lançar no caixa, emitir NFe/NFCe e processar devolução por XML) voltem a funcionar.

## Causa raiz

A edge function referencia colunas/condições que não existem no schema atual, então a IA recebe `{error: "column ... does not exist"}` e responde "não consegui". O fluxo de emissão fiscal em si está correto — nunca é alcançado porque o pedido não chega a ser criado.

### Schema real (verificado)

- `cadastro`: usa `excluido` (não `excluido_visivel`).
- `produto`: colunas reais são `nome`, `preco_venda`, `excluido` (não `nm_produto`, `vl_venda`, `excluido_visivel`).
- `condicao_pagamento`: `excluido`.
- `movimento_item`: `nm_produto` existe aqui (essa parte está OK no insert).

## Mudanças (apenas em `supabase/functions/chat-realsys/index.ts`)

1. **`buscar_cliente`** — trocar `.eq("excluido_visivel", false)` por `.eq("excluido", false)` e adicionar `.eq("empresa_id", empresaId)` quando `empresaId` existir.

2. **`buscar_produto`** — reescrever:
   ```ts
   supabase.from("produto")
     .select("produto_id, nome, preco_venda")
     .ilike("nome", `%${termo}%`)
     .eq("excluido", false)
     .limit(10)
   ```
   Retornar `{ resultados }` mapeando `nome`/`preco_venda` (a IA já entende pelo schema do tool).

3. **`processar_devolucao_xml`**:
   - Busca de fornecedor por CNPJ: adicionar `.eq("empresa_id", empresaId)`.
   - Insert em `cadastro`: remover o campo `excluido_visivel: false` (coluna inexistente).
   - Busca de produto por nome no mapeamento de itens: trocar `nm_produto`/`excluido_visivel` por `nome`/`excluido`. Continuar mapeando o resultado para `nm_produto` no insert de `movimento_item` (lá a coluna existe).

4. **`criar_pedido_completo`** — na busca de cliente: trocar `.eq("excluido_visivel", false)` por `.eq("excluido", false)`.

Nenhuma mudança de schema, nenhuma mudança de UI, nenhuma mudança no `realcommerce-mcp/` (esse fica como utilitário externo opcional, como combinado).

## Verificação após o deploy automático

- Pedir no chat: "criar pedido para <cliente> com 2 unidades de <produto> à vista, finalizar e emitir NFe".
- Conferir que `tool_results` traz `ok: true` com `movimento_id`, `nr_movimento` e `evento_id`.
- Conferir em `fiscal_evento` que entrou um registro `PENDENTE` com `comando: NFE.CriarEnviarNFe`.
