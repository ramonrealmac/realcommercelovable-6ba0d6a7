-- ============================================================
-- Add visibilidade column to rpb_relatorio ('G' = Global, 'P' = Privado)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'rpb_relatorio' AND column_name = 'visibilidade'
  ) THEN
    ALTER TABLE public.rpb_relatorio 
    ADD COLUMN visibilidade TEXT NOT NULL DEFAULT 'G' 
    CHECK (visibilidade IN ('G', 'P'));
  END IF;
END$$;

-- Atualizar registros existentes ativos para 'G'
UPDATE public.rpb_relatorio
SET visibilidade = 'G'
WHERE excluido = false AND (visibilidade IS NULL OR visibilidade = '');
