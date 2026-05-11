# PDV Mobile — Layout 2× rolável + Atalhos clicáveis

## Objetivo
No mobile (`< 768px`), a tela do PDV/Caixa deve ter **largura igual a 2× a viewport** com **rolagem horizontal**, de modo que:
- O **primeiro "painel" (100vw)** mostre a Venda Direta (busca de produto + carrinho), ocupando a tela inteira.
- O **segundo "painel" (100vw)** mostre Pedidos a Receber + Resumo + Finalizar Venda.
- O usuário arrasta lateralmente para alternar entre as duas áreas.

No desktop (`≥ 768px`), o layout atual de 12 colunas (8/4) é mantido sem alterações.

Adicionalmente, a barra inferior de atalhos (F1, F2, F3, F4, F5, F6, F9, Esc) — hoje renderizada apenas como `<kbd>` informativos — passa a ser **botões clicáveis** que executam a mesma ação do teclado, tornando o PDV utilizável sem teclado físico (ideal para celular/tablet).

## Mudanças (arquivo único: `src/components/forms/pdv/PdvTela.tsx`)

### 1. Grid principal responsivo (linha 678)
Substituir o container do grid por uma estrutura híbrida:

- **Desktop (`md:`)**: mantém `grid grid-cols-12 gap-3 p-3` (8/4) como hoje.
- **Mobile**: usa `flex` com `overflow-x-auto snap-x snap-mandatory`, e cada coluna recebe `w-screen snap-start shrink-0` (em vez de `col-span-*`). Largura total natural = 2× viewport.

Forma proposta (Tailwind):

```text
container:  flex overflow-x-auto snap-x snap-mandatory
            md:grid md:grid-cols-12 md:gap-3 md:overflow-hidden
            p-3 flex-1

coluna 1:   w-screen shrink-0 snap-start
            md:w-auto md:shrink md:col-span-8
            (resto das classes atuais preservadas)

coluna 2:   w-screen shrink-0 snap-start
            md:w-auto md:shrink md:col-span-4
            (resto preservado)
```

Observação técnica: como `w-screen` em mobile inclui o `p-3` do container, ajustar para `w-[calc(100vw-1.5rem)]` ou remover padding lateral em mobile (`px-0 md:p-3`) para que cada painel encaixe perfeitamente na tela. Adicionar `scroll-smooth` para experiência melhor.

### 2. Atalhos como botões clicáveis (linhas 888–905)
Refatorar a barra de atalhos para que cada item seja um `<button>` em vez de `<span>`. Cada botão dispara a mesma ação que o `useEffect` de `keydown` já executa:

- **F1** → `setXShowAtalhos(p => !p)`
- **F2** → focar `searchRef`
- **F3** → `setXOpenCliente(true)` (se `!XPedidoSel`)
- **F4** → `setXOpenVend(true)` (se `!XPedidoSel && XPodeInfVend`)
- **F5** → `carregarPedidos()`
- **F6** → `setXOpenDesc(true)` (se `!XPedidoSel && XCart.length > 0`)
- **F9** → `finalizarVenda()`
- **Esc** → `setXPedidoSel(null)`

O badge (`<kbd>`) continua aparecendo dentro do botão à esquerda do label, preservando o visual atual. Em mobile, a barra ganha `overflow-x-auto` para acomodar todos os botões.

Para evitar duplicação entre teclado e clique, extrair as ações em um pequeno objeto/handler reutilizado por ambos os caminhos (opcional; pode-se manter inline se preferir mudança mínima).

### 3. Sem mudanças em
- Lógica de negócio (criação de movimento, pagamento, fiscal, impressão)
- Outros formulários do PDV (FuncoesDialog, PagamentoDialog, etc.)
- Layout desktop (mantido idêntico via breakpoint `md:`)

## Resultado esperado

- **Desktop**: nenhum impacto visual.
- **Mobile**: ao abrir o PDV, vê-se a Venda Direta ocupando 100% da tela. Deslizando para a direita (ou clicando o atalho), aparece Pedidos a Receber + Resumo + botão Finalizar. Os botões F1…F9 ficam tocáveis para uso sem teclado.
