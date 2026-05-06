-- Adiciona campo de senha do certificado na tabela de configuracao fiscal
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS senha_certificado varchar(100) NULL;
