@echo off
echo Adicionando modificacoes do fluxo de pedidos...
git add src/components/forms/pedido/PedidoForm.tsx
git add src/components/forms/pedido/PedidoItensTab.tsx
git add src/components/forms/pedido/PedidoPagamentoDialog.tsx
git add src/components/forms/pedido/types.ts
git add src/hooks/useCrudController.ts
git add src/components/shared/CurrencyInput.tsx
git add docs/proposta_concorrencia_pedidos.md

echo Criando commit para as alteracoes do Pedido...
git commit -m "feat(pedido): refatora fluxo de cadastros, descontos, pagamentos e formatacao monetaria"

echo Concluido!
pause
