## Diagnóstico

Existem **2 NF-e** na tabela `nfe_recebida` para `empresa_id=1` (notas 1020 e 1021, emitidas em 04/01/2026 e 14/01/2026), mas nenhuma aparece no formulário.

### Causa raiz

No arquivo `src/components/forms/NfeRecebidasForm.tsx`, a busca no banco está **correta** (filtra apenas por `empresa_id` e ordena por `dt_emissao`). O problema está no **filtro client-side de datas** (linhas 74–81):

```ts
XDtIni = "2026-01-27" - 90 dias = "2025-10-29"  // OK
XDtFim = "2026-01-27" (hoje)
```

A comparação `row.dt_emissao < XDtIni` falha porque:

1. `row.dt_emissao` vem do Postgres como `"2026-01-04"` (campo `date`), mas dependendo do driver pode chegar como string ISO completa `"2026-01-04T00:00:00..."` ou objeto Date — a comparação de string com `"2026-01-27"` produz resultados imprevisíveis.
2. Mais crítico: o cálculo do `XDtIni` inicial usa `toISOString()` que pode aplicar timezone UTC, e a comparação direta de strings só funciona se ambos estiverem no formato `YYYY-MM-DD` exato.
3. As datas no banco (04/01 e 14/01) **estão dentro** do intervalo dos últimos 90 dias, então deveriam aparecer — confirmando que o bug é de formato/comparação.

Além disso, o filtro `XStatusFilter` inicia vazio (TODAS), então não é o problema.

## Correção

Editar `src/components/forms/NfeRecebidasForm.tsx`:

1. **Normalizar `row.dt_emissao` para `YYYY-MM-DD`** antes de comparar com `XDtIni`/`XDtFim`:
   ```ts
   const rowDt = String(row.dt_emissao || "").substring(0, 10);
   if (XDtIni && rowDt && rowDt < XDtIni) return false;
   if (XDtFim && rowDt && rowDt > XDtFim) return false;
   ```
2. Não filtrar por data quando `row.dt_emissao` for vazio/nulo (hoje uma nota sem data é eliminada).
3. Remover os `console.log` de debug do filtro após validar.
4. **Mover o filtro de data para o servidor (loadData)**: incluir `.gte("dt_emissao", XDtIni).lte("dt_emissao", XDtFim)` no select, e disparar `loadData()` ao clicar em FILTRAR (já está conectado). Isso evita trazer dados desnecessários e elimina ambiguidade de comparação.
5. Manter filtro de Status (`XStatusFilter`) e filtros de coluna (`XSearchFilters`) no client.

## Resultado esperado

Após a correção, ao abrir o formulário (ou clicar em FILTRAR) as 2 NF-e existentes (1020 e 1021) serão exibidas na grade.