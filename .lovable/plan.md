## Reformular o dialog "Pesquisar Produto" do PDV

Arquivo único alterado: `src/components/forms/pedido/ProdutoSearchDialog.tsx`
(reusado pelo PDV via `PdvTela.tsx` — sem mudanças no PDV).

### 1. Novo layout: lista de coluna única com quebra de linha

Substituir a grade `grid-cols-12` por linhas `flex flex-wrap` onde os campos
escolhidos aparecem concatenados, separados por um divisor sutil (`·`),
com `break-words` permitindo quebra para a linha de baixo quando não couber.

Exemplo visual de uma linha:

```text
#1234 · CAMISETA POLO MANGA CURTA AZUL MARINHO TAM G ·
UN · R$ 89,90 · Estq: 12,000 · Reserv: 1,000
```

A 2ª grade (estoque por depósito) é mantida como está (já é informativa
e cabe num único formato tabular pequeno).

### 2. Cores por campo (via tokens semânticos do design system)

Cada "chip" da linha recebe uma cor própria:

- **Código** (`produto_id`) → azul (`text-blue-600 dark:text-blue-400`), fonte mono
- **Nome** → azul mais escuro / primary (`text-primary font-medium`)
- **Unidade** → muted (`text-muted-foreground`)
- **Preço normal** → preto/foreground (`text-foreground`)
- **Preço em promoção** (quando `st_promo`) → verde (`text-green-600 dark:text-green-400 font-semibold`), com o preço normal riscado ao lado
- **Estoque disponível**:
  - `> 0` → azul (`text-blue-600 dark:text-blue-400`)
  - `= 0` → cinza (`text-muted-foreground`)
  - `< 0` → vermelho (`text-red-600 dark:text-red-400 font-semibold`)
- **Reservado** → laranja suave (`text-amber-600 dark:text-amber-400`)
- **Referência / GTIN** → muted/mono

Linha selecionada continua com `bg-primary/15`; zebra preservada.

### 3. Seleção de campos visíveis (persistida em `empresa`)

Adicionar no header do dialog um botão "Campos" (ícone engrenagem) que
abre um popover com checkboxes para cada campo disponível:

- Código
- Nome (sempre obrigatório, desabilitado)
- Referência
- GTIN
- Unidade
- Preço de venda
- Preço promocional
- Estoque disponível
- Estoque reservado
- Estoque na empresa atual

A seleção é salva na tabela `empresa`, em uma nova coluna
`pdv_pesquisa_campos` (`text`, JSON com array de chaves), default
`'["codigo","nome","unidade","preco","estoque_disp","reservado"]'`.
Carregada via `useEmpresaParam('pdv_pesquisa_campos', defaults)` e
gravada via `update` em `empresa` ao confirmar o popover.

> Para incluir referência/GTIN no SELECT, basta adicioná-los já no
> `select(...)` atual (referência e gtin já são buscados, só não exibidos).

### 4. Migração necessária

```sql
ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS pdv_pesquisa_campos text
  DEFAULT '["codigo","nome","unidade","preco","estoque_disp","reservado"]';
```

### Pontos de confirmação

1. Confirma persistir a configuração **por empresa** (todos os usuários da
   empresa veem os mesmos campos)? Alternativa seria por funcionário
   (`funcionario.pdv_pesquisa_campos`) — mais granular.
2. Mantém a 2ª grade (estoque por depósito) inalterada?
3. As cores propostas estão de acordo, ou prefere ajuste (ex: nome em
   preto e código em azul)?

### Resumo
Lista vira "card-linha" único com chips coloridos que quebram linha
naturalmente, e um popover de configuração permite ao usuário escolher
quais campos aparecem — preferência persistida em `empresa.pdv_pesquisa_campos`.
