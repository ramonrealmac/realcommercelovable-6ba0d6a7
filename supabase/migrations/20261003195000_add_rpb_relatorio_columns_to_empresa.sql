-- ============================================================
-- Migration: Add rpb_relatorio reference columns to empresa table
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'empresa' AND column_name = 'rpb_relatorio_pedido_id'
  ) THEN
    ALTER TABLE public.empresa ADD COLUMN rpb_relatorio_pedido_id BIGINT REFERENCES public.rpb_relatorio(rpb_relatorio_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'empresa' AND column_name = 'rpb_relatorio_bobina_id'
  ) THEN
    ALTER TABLE public.empresa ADD COLUMN rpb_relatorio_bobina_id BIGINT REFERENCES public.rpb_relatorio(rpb_relatorio_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'empresa' AND column_name = 'rpb_relatorio_a4_id'
  ) THEN
    ALTER TABLE public.empresa ADD COLUMN rpb_relatorio_a4_id BIGINT REFERENCES public.rpb_relatorio(rpb_relatorio_id);
  END IF;
END$$;
