-- Adiciona o campo nfe_cabecalho_id à tabela fiscal_evento para facilitar o vínculo direto com a NF-e
ALTER TABLE public.fiscal_evento 
  ADD COLUMN IF NOT EXISTS nfe_cabecalho_id BIGINT;

-- Adiciona index para performance
CREATE INDEX IF NOT EXISTS ix_fiscal_evento_nfe_cabecalho_id ON public.fiscal_evento(nfe_cabecalho_id);

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.fiscal_evento.nfe_cabecalho_id IS 'Vínculo direto com o cabeçalho da NF-e para facilitar rastreabilidade de logs.';
