-- Migration: 20260915103000_add_condicao_utilizar_credito.sql
-- Description: Garante a existência da condição de pagamento 'Utilizar Crédito' para todas as empresas ativas.

INSERT INTO public.condicao_pagamento (empresa_id, descricao, tipo_prazo, qtd_parcelas, meio_pagamento_id, st_avista, excluido)
SELECT e.empresa_id, 'Utilizar Crédito', 'U', 1, 21, 'S', false
FROM public.empresa e
WHERE NOT EXISTS (
  SELECT 1 FROM public.condicao_pagamento cp 
  WHERE cp.empresa_id = e.empresa_id 
    AND UPPER(TRIM(cp.descricao)) IN ('UTILIZAR CRÉDITO', 'UTILIZAR CREDITO', 'CRÉDITO DE CLIENTE', 'CREDITO DE CLIENTE')
    AND cp.excluido = false
);
