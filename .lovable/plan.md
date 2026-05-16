## Objetivo
Tornar a **Devolução de NF-e de Saída** acessível a partir de:
1. **Menu de comandos (dropdown "Ações")** do Gerenciador Fiscal (`ListaNfeEmitidaForm`) — somente quando a nota for de **Saída** (`tp_nf = 1`) e estiver autorizada (`st_nf` em `E`/`1`).
2. **Menu lateral → 2. Movimentações → Saídas**, ao lado de "Meus Pedidos".

Mantém também o item já existente em **5. Fiscal → NFe/NFCe** (não duplicar comportamento, apenas garantir presença nos novos pontos).

## Alterações

### 1. `src/config/menuConfig.ts`
Adicionar dentro de `mov-saidas.children` (após "Meus Pedidos"):
```ts
{ id: "devolucao-nfe-saida", title: "Devolução de NF-e de Saída", icon: ArrowUpFromLine },
```
(O item permanece também em "5. Fiscal → NFe/NFCe", como já está hoje.)

### 2. `src/components/forms/ListaNfeEmitidaForm.tsx`
No `DropdownMenuContent` de cada linha (após "Carta de Correção" e antes de "Inutilizar Numeração"), adicionar:
```tsx
<DropdownMenuItem
  onClick={() => openTab({
    title: `Devolução NF-e ${r.nr_nota || r.nfe_cabecalho_id}`,
    component: "devolucao-nfe-saida",
    params: { nfe_cabecalho_id: r.nfe_cabecalho_id },
  })}
  disabled={String(r.tp_nf) !== "1" || !["E", "1"].includes(String(r.st_nf))}
>
  <ArrowUpFromLine className="w-4 h-4 mr-2 text-orange-500" /> Devolver Nota
</DropdownMenuItem>
```
Importar o ícone `ArrowUpFromLine` de `lucide-react`.

### 3. `src/components/forms/DevolucaoNfeSaidaForm.tsx`
Aceitar prop opcional `initialNfeId?: number`. Quando informada:
- Pular a Etapa 1 (busca).
- Carregar diretamente a nota (`fiscal_nfe_cabecalho` + `fiscal_nfe_item`) pelo `nfe_cabecalho_id` e ir para Etapa 2 com os itens já preenchidos (qt = qt original, CFOP invertido, depósito padrão).

### 4. `src/pages/Index.tsx`
Atualizar o case existente para repassar o parâmetro:
```ts
case "devolucao-nfe-saida":
  return <DevolucaoNfeSaidaForm initialNfeId={params?.nfe_cabecalho_id} />;
```

## Resultado
- Operador clica nos 3 pontinhos de uma nota de saída autorizada → **Devolver Nota** → abre o expert já na Etapa 2 com itens carregados.
- Operador também pode entrar pelo menu **Saídas → Devolução de NF-e de Saída** (busca padrão da Etapa 1).
- Permanece o acesso por **Fiscal → NFe/NFCe**.
