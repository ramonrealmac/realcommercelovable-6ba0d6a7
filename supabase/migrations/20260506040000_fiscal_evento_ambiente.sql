-- Adiciona coluna ambiente na tabela fiscal_evento
ALTER TABLE public.fiscal_evento ADD COLUMN IF NOT EXISTS ambiente int2;
COMMENT ON COLUMN public.fiscal_evento.ambiente IS '1-Producao, 2-Homologacao';
