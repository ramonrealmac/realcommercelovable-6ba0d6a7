-- Migration: Adicionar campos da impressora ESC/POS (PosPrinter) na tabela fiscal_config
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS posprinter_porta text DEFAULT '',
  ADD COLUMN IF NOT EXISTS posprinter_modelo integer DEFAULT 0;

COMMENT ON COLUMN public.fiscal_config.posprinter_porta IS 'Porta da impressora térmica ESC/POS (ex: COM1, RAW:NomeImpressora, LPT1, 192.168.1.200:9100)';
COMMENT ON COLUMN public.fiscal_config.posprinter_modelo IS '0=Texto, 1=Epson, 2=Bematech, 3=Daruma, 4=Elgin, 5=Diebold';
