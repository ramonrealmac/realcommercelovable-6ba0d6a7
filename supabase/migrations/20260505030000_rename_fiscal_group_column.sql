-- ============================================================
-- RENOMEIA GRUPO_ICMS_ID PARA FISCAL_GRUPO_PRODUTO_ID
-- ============================================================

-- 1. Tabela fiscal_regra_item
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fiscal_regra_item' AND column_name = 'grupo_icms_id'
    ) THEN
        ALTER TABLE public.fiscal_regra_item RENAME COLUMN grupo_icms_id TO fiscal_grupo_produto_id;
    END IF;
END $$;

-- 2. Tabela fiscal_regra_cfop
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fiscal_regra_cfop' AND column_name = 'grupo_icms_id'
    ) THEN
        ALTER TABLE public.fiscal_regra_cfop RENAME COLUMN grupo_icms_id TO fiscal_grupo_produto_id;
    END IF;
END $$;
