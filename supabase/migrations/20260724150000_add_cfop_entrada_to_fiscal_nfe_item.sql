ALTER TABLE public.fiscal_nfe_item ADD COLUMN cfop_entrada VARCHAR(4) NULL;
-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
