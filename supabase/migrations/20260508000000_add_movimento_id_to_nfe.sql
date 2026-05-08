-- Adicionar movimento_id à tabela fiscal_nfe_cabecalho
ALTER TABLE public.fiscal_nfe_cabecalho 
ADD COLUMN IF NOT EXISTS movimento_id int8 REFERENCES public.movimento(movimento_id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS ix_fiscal_nfe_cabecalho_movimento ON public.fiscal_nfe_cabecalho(movimento_id);
