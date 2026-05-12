## Objetivo

Adicionar timeout configurável e visível (com contagem regressiva) para todas as operações que aguardam resposta do `fiscal-worker` — emissão NFe/NFCe, cancelamento, inutilização e envio de e-mail — tanto no PDV quanto no Gerenciador Fiscal.

## 1. Banco de dados

Adicionar coluna em `fiscal_config`:

- `nr_timeout_nfe` (int, default 60) — tempo limite em segundos, único para todas as operações fiscais.

## 2. Tela de Configuração Fiscal

Em `src/components/forms/FiscalConfigForm.tsx`, na aba geral, adicionar:

- Campo numérico "Tempo limite de espera (segundos)" — default 60, mínimo 10, máximo 300.

## 3. Camada de serviço

`src/services/fiscalEmissaoService.ts`:

- Helper `obterTimeoutFiscal(empresaId): Promise<number>` — lê `nr_timeout_nfe` da `fiscal_config` (cache curto por empresa, fallback 60s) e devolve em ms.
- Refatorar `aguardarEvento(eventoId, timeoutMs?, onTick?)`:
  - se `timeoutMs` ausente → usa `obterTimeoutFiscal(empresaId)`;
  - **dispara `onTick(segundosRestantes)` a cada 2 segundos** (regressivo);
  - ao expirar: marca o `fiscal_evento` com `status='TIMEOUT'` e `mensagem_erro='Tempo limite excedido (Xs) aguardando o Fiscal Worker'`, e resolve `{ success:false, status:'TIMEOUT', mensagem }` (não rejeita).
- Substituir os timeouts hardcoded (`15000`, `20000`, `25000`, `90000`) pelo helper em:
  - `emitirNfce` / `emitirNfe`
  - `enviarEmail`
  - `cancelarDocumento`
  - `inutilizar` (se houver chamada equivalente)

`src/services/provedorService.ts`:

- Substituir o `timeoutMs = 25000` fixo do `enviarComando` pelo mesmo helper, com fallback de 60s.
- Aceitar `onTick` opcional para reuso pelo Gerenciador Fiscal.

## 4. UI — dialog reutilizável com contagem regressiva

Criar `src/components/fiscal/FiscalProgressDialog.tsx`:

- Modal **não-fechável** (sem botão "Cancelar espera") enquanto a operação está em andamento — só fecha quando o serviço retorna ou quando o timeout zera.
- Conteúdo:
  - Título dinâmico ("Emitindo NFC-e…", "Cancelando NF-e…", "Enviando e-mail…", etc.).
  - Barra de progresso com `value = (restante / total) * 100`.
  - Texto grande "Liberando em **Xs**" atualizado pelo `onTick` a cada 2s.
- Ao atingir 0: fecha automaticamente, exibe `toast.error("Tempo limite excedido")`. O serviço já marcou o evento como `TIMEOUT`; quando/se o worker concluir depois, o realtime existente atualiza o registro normalmente.

## 5. Integrações de UI

Envolver toda chamada que dispara operação fiscal pelo dialog acima:

- `src/components/forms/pdv/OpcoesPagamentoDialog.tsx` (NFC-e do caixa) — substitui o `nEvento(..., 90000)` por chamada com `onTick`.
- `src/components/forms/pdv/FiscalEmailDialog.tsx` — envio de e-mail.
- `src/components/forms/ListaNfeEmitidaForm.tsx` (Gerenciador Fiscal) — `nEmail` e `nDocumento` (cancelamento).
- Qualquer outro ponto de emissão/cancelamento NFe/NFCe acionado pelo Gerenciador Fiscal.

## 6. Detalhes técnicos

```text
fiscal_config
  + nr_timeout_nfe int default 60        -- segundos (único parâmetro)

fiscalEmissaoService
  obterTimeoutFiscal(empresaId): ms      -- cache por empresa
  aguardarEvento(id, timeoutMs?, onTick?)
    - sem timeoutMs -> obterTimeoutFiscal
    - poll do evento em loop curto (300ms)
    - setInterval(2000) -> onTick(segundosRestantes)
    - ao expirar: UPDATE fiscal_evento SET status='TIMEOUT'
                  resolve { success:false, status:'TIMEOUT', mensagem }

<FiscalProgressDialog
  open
  titulo="Emitindo NFC-e..."
  segundosTotais={timeoutSegundos}
  segundosRestantes={tickValue}
/>
```

Padrão de uso:

```ts
const total = await fiscalEmissaoService.obterTimeoutFiscalSeg(empresaId);
setProg({ open:true, total, restante: total, titulo:"Emitindo NFC-e..." });
const r = await fiscalEmissaoService.aguardarEvento(
  eventoId, total*1000,
  (s) => setProg(p => ({ ...p, restante: s }))
);
setProg(p => ({ ...p, open:false }));
```
