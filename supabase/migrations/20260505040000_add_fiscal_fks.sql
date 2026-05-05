-- ============================================================
-- ADICIONA FOREIGN KEYS PARA OS GRUPOS FISCAIS
-- ============================================================

-- 1. Tabela fiscal_regra_item
DO $$ 
BEGIN
    -- Remove FK antiga se existir (caso ainda aponte para grupo_icms)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_fiscal_regra_item_grupo' AND table_name = 'fiscal_regra_item'
    ) THEN
        ALTER TABLE public.fiscal_regra_item DROP CONSTRAINT fk_fiscal_regra_item_grupo;
    END IF;

    -- Adiciona a nova FK
    ALTER TABLE public.fiscal_regra_item 
    ADD CONSTRAINT fk_fiscal_regra_item_grupo 
    FOREIGN KEY (fiscal_grupo_produto_id) 
    REFERENCES public.fiscal_grupo_produto(fiscal_grupo_produto_id);
END $$;

-- 2. Tabela fiscal_regra_cfop
DO $$ 
BEGIN
    -- Remove FK antiga se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_fiscal_regra_cfop_grupo' AND table_name = 'fiscal_regra_cfop'
    ) THEN
        ALTER TABLE public.fiscal_regra_cfop DROP CONSTRAINT fk_fiscal_regra_cfop_grupo;
    END IF;

    -- Adiciona a nova FK
    ALTER TABLE public.fiscal_regra_cfop 
    ADD CONSTRAINT fk_fiscal_regra_cfop_grupo 
    FOREIGN KEY (fiscal_grupo_produto_id) 
    REFERENCES public.fiscal_grupo_produto(fiscal_grupo_produto_id);
END $$;
