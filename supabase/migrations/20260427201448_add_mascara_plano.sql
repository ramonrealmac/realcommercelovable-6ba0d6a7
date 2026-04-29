-- Adicionando mascara_plano à tabela empresa
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS mascara_plano character varying(50) DEFAULT '9.99.999.999';
