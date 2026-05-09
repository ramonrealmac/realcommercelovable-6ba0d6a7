
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'movimento' AND column_name = 'vl_bc_desconto') THEN
        ALTER TABLE public.movimento ADD COLUMN vl_bc_desconto numeric(12,2) DEFAULT 0;
        COMMENT ON COLUMN public.movimento.vl_bc_desconto IS 'Valor da Base de Cálculo do Desconto';
    END IF;
END $$;
