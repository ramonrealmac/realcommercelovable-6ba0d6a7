## PDV - Refinamentos visuais e novas funções

### 1. Migração de schema

Adicionar à tabela `funcionario`:
- `caixa_edit_venda` (char, default 'N') — permite editar venda

(`caixa_inf_vend` e `caixa_cnc_venda` já existem.)

Adicionar à tabela `movimento`:
- `dt_cancelamento` (timestamptz, null)
- `mot_cancelamento` (text, default '')

### 2. Fluxo de finalização (corrigido)

Ordem atualizada:

```text
[Finalizar Venda] → PagamentoDialog (Meios de Pagamento e Prazo)
                       ↓ (botão "Finalizar Recebimento")
                    Salva venda (status R, baixa estoque, caixa_movimento)
                       ↓
                    Fecha PagamentoDialog
                       ↓
                    Abre OpcoesPagamentoDialog (Bobina / A4 / NFe / NFCe)
                       ↓
                    [Concluir] → limpa carrinho/pedido selecionado
```

`OpcoesPagamentoDialog`: remove o botão "Continuar para Pagamento" e troca por "Concluir".

### 3. Lista de Pedidos a Receber — formato 2 linhas

Cada item em 2 linhas (compacto, zebra alternada):

```text
┌──────────────────────────────────────────┐
│ #1234   João da Silva                    │  ← linha 1: nº (negrito) + cliente (azul)
│ Vend. Maria Souza            R$ 250,00   │  ← linha 2: vendedor (verde itálico) + total
└──────────────────────────────────────────┘
```

- Cliente: cor `text-blue-600`, semibold.
- Vendedor: cor `text-emerald-600`, itálico, prefixo "Vend.".
- Zebra: `odd:bg-muted/30`.
- Hover: `hover:bg-accent`.

### 4. Cores de fundo dos painéis

- Painéis "Venda Direta" e "Pedidos a Receber": fundo na cor do tema do menu principal (usar `bg-sidebar` / `bg-primary/5` conforme variável CSS atual da TopBar/SidebarMenu).
- Listas de produtos (carrinho) e pedidos: linhas zebradas (`odd:bg-muted/40`).
- Acentos coloridos em botões/textos (verde para confirmar, azul para info, âmbar para desconto).

### 5. Vendedor na Venda Direta

Abaixo do campo "Cliente":
- Novo campo "Vendedor" com botão de busca (reusa `ClienteSearchDialog` filtrando `st_vendedor='S'` ou cria pequeno `VendedorSearchDialog`).
- Habilitado apenas se `funcionario.caixa_inf_vend === 'S'` do caixa logado; caso contrário fica oculto/desabilitado.
- Vendedor selecionado é gravado em `movimento.funcionario_id` ao finalizar.

### 6. Permissões caixa_inf_vend / caixa_cnc_venda / caixa_edit_venda

Carregar do `funcionario` do caixa logado e expor como flags:
- `XPodeInfVend` → mostra/oculta campo Vendedor.
- `XPodeCancVenda` → habilita opção "Cancelamento" no menu Funções.
- `XPodeEditVenda` → habilita edição de pedidos a receber (carregar para venda direta para alterar).

### 7. Botão Desconto + Totais em Badges

Rodapé da Venda Direta:

```text
[Subtotal R$ 100,00] [Desc. 5% R$ 5,00] [Total R$ 95,00]   [%/$ Desconto]  [Finalizar Venda]
   azul                  âmbar              verde            outline           primary (menor)
```

- 3 badges lado a lado com título acima e valor em destaque.
- Label desconto: `Desc.` + `XPercDesc + '%'` quando houver percentual; vazio quando 0.
- Botão **Finalizar Venda** menor (size sm).
- Botão **Desconto** abre `DescontoDialog`:
  - Tabs/radio: `%` ou `R$`
  - Input numérico
  - Aplica em `XDesconto` (valor) e `XPercDesc`.
  - Total = Subtotal − Desconto.

### 8. Botão Funções (antes de Configurar)

Ordem header: `[Funções] [Configurar] [Sair]`

`FuncoesDialog` com 6 cards (grid 3x2):

| Função | Implementar agora | Comportamento |
|---|---|---|
| Suprimento | Não | toast "Em desenvolvimento" |
| Sangria | Não | toast "Em desenvolvimento" |
| Última Venda | Não | toast "Em desenvolvimento" |
| Reimpressão | Não | toast "Em desenvolvimento" |
| **Cancelamento** | **Sim** | Abre `CancelamentoDialog` |
| Fechamento | Não | toast "Em desenvolvimento" |

### 9. Cancelamento de Venda

`CancelamentoDialog`:
- Campo: número do pedido (ou seleciona da lista).
- Campo: motivo (textarea obrigatória).
- Valida `caixa_cnc_venda='S'`.
- Ao confirmar:
  - `UPDATE movimento SET st_movimento='C', dt_cancelamento=now(), mot_cancelamento=:motivo WHERE movimento_id=:id`
  - Imprime comprovante (template HTML simples via `window.print()`):
    - Cabeçalho "COMPROVANTE DE CANCELAMENTO"
    - Operador (nome do caixa), data/hora, nº pedido, motivo.
- Recarrega lista de pedidos.

### 10. Arquivos

**Criados:**
- `src/components/forms/pdv/DescontoDialog.tsx`
- `src/components/forms/pdv/FuncoesDialog.tsx`
- `src/components/forms/pdv/CancelamentoDialog.tsx`
- `src/components/forms/pdv/VendedorSearchDialog.tsx`
- Migration: colunas em `funcionario` e `movimento`.

**Editados:**
- `src/components/forms/pdv/PdvTela.tsx` — header com Funções, lista 2 linhas zebrada, vendedor, desconto, totais em badges, cores de fundo.
- `src/components/forms/pdv/PagamentoDialog.tsx` — ao Finalizar Recebimento: salva, fecha, dispara `onAbrirDocumento()`.
- `src/components/forms/pdv/OpcoesPagamentoDialog.tsx` — botão "Concluir" no lugar de "Continuar para Pagamento".
- `src/components/forms/pdv/types.ts` — `caixa_edit_venda`, `vendedor_id`, campos de cancelamento.
- `src/integrations/supabase/types.ts` — refletir colunas novas.
