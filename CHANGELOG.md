# CHANGELOG — RealCommerce

---

## [6a196e5] — 2026-07-10
### fix: ajustes pedido, estoque e crud

| # | Módulo | Arquivo | Descrição |
|---|--------|---------|-----------|
| 1 | **Pedido > Itens** | `PedidoItensTab.tsx` | Campo de quantidade nos itens usa casas decimais do cadastro da empresa (`qt_venda_qt_decimais`). Input e grid exibem formato correto (ex: `1,000` para 3 decimais) |
| 2 | **Pedido > Itens** | `PedidoItensTab.tsx` | Grid de itens exibe decimais formatadas conforme empresa |
| 3 | **Pedido > Cadastro** | `PedidoForm.tsx` | Enter no campo "Tipo de Desconto" em novo pedido: salva, muda para aba Itens e **atualiza aba Cadastro com número e dados do novo pedido** |
| 4 | **Estoque** | `EstoqueForm.tsx` | Inputs Mínimo, Padrão, Inventário substituídos por `CurrencyInput` com formatação brasileira e casas decimais dinâmicas da empresa |
| 5 | **Estoque** | `EstoqueForm.tsx` | Depósitos privados incluídos no filtro — registro salvo aparece na grid |
| 6 | **CRUD Base** | `useCrudController.ts` | **Bug exclusão:** Registro removido imediatamente do estado local após delete — grid atualiza na hora |
| 7 | **CRUD Base** | `useCrudController.ts` | **Bug seleção pós-insert:** `XCurrentRecord` aponta para o novo pedido imediatamente após salvar, sem race condition |
| 8 | **CRUD Base** | `useCrudController.ts` | `removeQueries()` garante limpeza total de cache antes do refetch |
| 9 | **PDV** | `SuprimentoSangriaForm.tsx` | Ajustes campos valor/quantidade |
| 10 | **PDV** | `FechamentoCaixaForm.tsx` | Ajustes campos valor/quantidade |
| 11 | **Financeiro** | `ConsultaTitulosReceberForm.tsx` | Ajustes campos |
| 12 | **Financeiro** | `GerarContasReceberForm.tsx` | Ajustes campos |
| 13 | **Migrations** | `20260710090000_fix_plano_conta.sql` | Correção plano de contas |
| 14 | **Migrations** | `20260710113000_add_nfe_stock_movement_trigger.sql` | Trigger movimentação estoque via NF-e |
| 15 | **Migrations** | `20260710143500_add_cd_produto_text_computed_column.sql` | Coluna computada `cd_produto` (texto) |

---

## [3ff54e4] — 2026-07-10
### jaime202607110
- Ajustes Jaime (sync)

---

## [7f62171] — anterior
### sync financeiro
- Sincronização módulo financeiro

---

## [457e892] — anterior
### ajustes fat jaime
- Ajustes faturamento Jaime

---

## [4664989] — anterior
### ajustes fiscais
- Correções módulo fiscal / NF-e

---

## [ea8caeb] — anterior
### ajustes no caixa
- Ajustes módulo caixa / PDV
