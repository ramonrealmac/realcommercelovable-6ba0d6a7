Plano para parar o ciclo de erros no emissor fiscal multithread:

1. Padronizar o status fiscal autorizado
- Ajustar o worker para gravar `fiscal_evento.status = 'EMITIDO'` quando a SEFAZ retornar autorização (`cStat=100`), mantendo `ERRO` para rejeições/falhas.
- Manter compatibilidade no frontend/polling aceitando `EMITIDO` e `CONCLUIDO` como finalizados positivos, para não quebrar eventos antigos.

2. Corrigir a gravação do cabeçalho da NFC-e
- No worker, atualizar `fiscal_nfe_cabecalho` logo após o retorno da DLL com:
  - `chave_nfe`
  - `nr_protocolo`
  - `recibo_sefaz`
  - `c_stat`
  - `x_motivo`
  - `xml_nf`
  - `st_nf = 'E'` quando autorizado e `st_nf = 'R'` quando rejeitado
- Usar `.select()` após o `.update()` para capturar erro real de RLS/schema e logar quando nenhuma linha for atualizada.
- Tratar `recibo_sefaz` como string vazia quando a SEFAZ retornar `NRec=''`, pois em NFC-e síncrona autorizada o recibo pode vir vazio.

3. Preservar corretamente a versão MultiThread da ACBrLib
- Manter o modelo atual com um `handle` isolado por chamada (`NFE_Inicializar(handle, threadIni, ...)`) e INI temporário por thread.
- Não voltar para chamadas globais/single-thread.
- Revisar a ordem de pós-processamento para que a impressão/PDF aconteça somente depois do retorno autorizado e sem impedir a gravação dos dados fiscais caso a impressão falhe.

4. Corrigir o fluxo PDV sem abrir gerenciador fiscal
- Garantir que o PDV apenas crie o documento, enfileire o evento e aguarde o worker.
- Se autorizado, mostrar sucesso com a chave e concluir a venda.
- Se rejeitado/erro, mostrar a mensagem real da SEFAZ.
- A impressão automática seguirá `tp_imp_nfce/tp_imp_nfe` e `nm_impressora_nfce/nm_impressora_nfe` no worker.

5. Corrigir a grade/gerenciador para refletir o status real
- Atualizar o mapa de status da grade para exibir `E` como Emitida/Autorizada, `R` como Rejeitada, `A` como Pendente/Aberta e `C` como Cancelada.
- Ajustar o refresh em tempo real para reagir ao status `EMITIDO` também.

6. Recuperar eventos já autorizados que não atualizaram cabeçalho
- Criar uma migração segura de correção pontual para preencher `fiscal_nfe_cabecalho` a partir de `fiscal_evento.resposta` nos eventos já autorizados, incluindo os IDs 25 e 27.
- Isso corrige os registros históricos onde o evento mostra `cStat=100`, mas o cabeçalho ficou sem chave/protocolo/cStat.

Arquivos previstos:
- `fiscal-worker/src/index.js`
- `src/services/fiscalEmissaoService.ts`
- `src/components/forms/pdv/OpcoesPagamentoDialog.tsx` se necessário
- `src/components/forms/LiestaNfeEmitidaForm.tsx`
- Nova migration Supabase para backfill dos documentos já autorizados

Observação técnica dos logs da nota 27:
- O evento `#137` está autorizado (`cStat=100`, chave `21260536809394000170650010000000161557786686`, protocolo `321260000045319`).
- O cabeçalho `fiscal_nfe_cabecalho_id=27` continua sem chave/protocolo/cStat.
- O problema atual não é a autorização na DLL; é a persistência pós-retorno e a inconsistência de status (`CONCLUIDO` no evento vs campos fiscais não gravados no cabeçalho).