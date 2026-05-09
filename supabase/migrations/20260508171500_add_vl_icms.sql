

-- Adicionar campos de valor de ICMS (Normal) que estavam faltando
-- Esses campos são fundamentais para a emissão de documentos fiscais

DO $$ 
BEGIN
    -- 1. Itens (fiscal_nfe_item)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'vl_icms') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN vl_icms numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'vl_bc') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN vl_bc numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    -- 2. Cabeçalho (fiscal_nfe_cabecalho)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_icms') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_icms numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_bc') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_bc numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

END $$;
