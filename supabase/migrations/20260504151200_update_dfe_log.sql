-- ========================================================
-- ADICIONA VÍNCULO COM NFE_RECEBIDA NA TABELA DFE_NSU_LOG
-- ========================================================

ALTER TABLE public.dfe_nsu_log 
ADD COLUMN IF NOT EXISTS nfe_recebida_id BIGINT REFERENCES public.nfe_recebida(nfe_recebida_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dfe_nsu_log.nfe_recebida_id IS 'ID da nota recebida vinculada a este log de comando (para manifestos/downloads)';
