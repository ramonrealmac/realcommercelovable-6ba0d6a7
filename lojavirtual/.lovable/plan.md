
## Diagnóstico

A compra finalizou sem QR Code e exibiu "Pedido Confirmado!" indevidamente. Investiguei a causa raiz:

1. **Edge function `create-billing-public` está falhando** com erro do AbacatePay:
   ```
   { success: false, error: "Invalid or inactive API key" }
   ```
   Logs confirmam o erro nos pedidos #20 e #21 (ambos ficaram em status `A`, sem `xid_transacao_abacatepay` e sem `xurl_pagamento`).

2. **Fallback do front-end engana o cliente**. Em `src/pages/loja/LojaIndex.tsx` (linha 291), quando a cobrança falha o código faz:
   ```ts
   setStep('done'); toast({ title: 'Pedido criado! Pagamento será informado.' });
   ```
   A tela `done` (linha 665) renderiza o texto "Pedido Confirmado! / Seu lanche estará disponível para retirada", o que dá a falsa impressão de que o pagamento foi efetuado.

3. A chave `xabacatepay_api_key` cadastrada na tabela `parametro` está **inválida ou expirada** no AbacatePay (provavelmente foi revogada, expirou, ou há mistura entre chave de Dev e Prod).

## Plano de correção

### 1. Tratar corretamente a falha de geração do PIX (front-end)
Em `src/pages/loja/LojaIndex.tsx`, ajustar o `catch` da cobrança:
- **Não** ir para `step='done'` quando a cobrança falha.
- Voltar para `step='cart'` (mantendo carrinho e dados).
- Marcar o pedido recém-criado como cancelado (`xst_pedido='C'` via `fu_transition_pedido_status`) para não deixar pedido órfão.
- Exibir toast de erro destacado: "Não foi possível gerar o PIX. Verifique a configuração de pagamento e tente novamente."
- Logar `billingData.error` no console para diagnóstico.

### 2. Validar a chave AbacatePay antes de processar
Na edge function `create-billing-public`, ao receber resposta com `error: "Invalid or inactive API key"`, retornar mensagem clara ao front:
- HTTP 502 com `{ error: "Configuração de pagamento inválida. Contate o administrador." }`.

### 3. Atualizar a chave da AbacatePay
Pedir ao administrador (você) acesso ao painel AbacatePay para:
- Gerar nova API key válida (Produção).
- Atualizar em **Parâmetros → Pagamentos** no admin (campo `xabacatepay_api_key`).

Após o plano aprovado, vou perguntar se você prefere:
(a) já colar a nova chave para eu salvar via SQL, ou
(b) apenas corrigir o código e você atualiza a chave manualmente na tela de Parâmetros.

### 4. Teste end-to-end
- Criar pedido de teste pelo link de vendas.
- Verificar geração do QR/URL e atualização de `xid_transacao_abacatepay` no banco.
- Validar polling de status até o webhook marcar como pago.

## Arquivos afetados

- `src/pages/loja/LojaIndex.tsx` — ajustar tratamento de erro no `handleSubmit`.
- `supabase/functions/create-billing-public/index.ts` — melhorar resposta de erro quando API key é inválida.
- (Opcional) `parametro.xabacatepay_api_key` — atualizar valor com nova chave válida.

## Resultado esperado

- Quando o PIX não puder ser gerado, o cliente vê uma mensagem clara de erro e permanece no carrinho — nunca a tela falsa de "Pagamento Confirmado".
- Com a chave válida, o fluxo gera o QR Code/URL normalmente e o polling confirma o pagamento via webhook.
