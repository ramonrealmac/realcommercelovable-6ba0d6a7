-- =============================================
-- COMPLEMENTO DA TABELA CFOP
-- =============================================

ALTER TABLE public.cfop 
ADD COLUMN IF NOT EXISTS aplicacao TEXT;

COMMENT ON COLUMN public.cfop.aplicacao IS 'Descrição detalhada da aplicação do CFOP conforme guia prático.';
