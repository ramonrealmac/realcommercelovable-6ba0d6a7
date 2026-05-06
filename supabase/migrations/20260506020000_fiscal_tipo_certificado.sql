-- Adiciona o tipo de certificado (ARQUIVO ou REPOSITORIO)
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS tipo_certificado varchar(20) DEFAULT 'ARQUIVO';
