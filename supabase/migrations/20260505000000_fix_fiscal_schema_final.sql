-- =============================================
-- AJUSTE FINAL DE SCHEMA - MOTOR FISCAL
-- =============================================

DO $$ 
BEGIN
    -- 1. Renomear tabela tipo_operacao para tp_operacao
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tipo_operacao') THEN
        ALTER TABLE public.tipo_operacao RENAME TO tp_operacao;
    END IF;

    -- 2. Renomear colunas tipo_operacao_id para tp_operacao_id
    -- Na tabela tp_operacao
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'tp_operacao' AND column_name = 'tipo_operacao_id') THEN
        ALTER TABLE public.tp_operacao RENAME COLUMN tipo_operacao_id TO tp_operacao_id;
    END IF;

    -- Na tabela fiscal_regra
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'fiscal_regra' AND column_name = 'tipo_operacao_id') THEN
        ALTER TABLE public.fiscal_regra RENAME COLUMN tipo_operacao_id TO tp_operacao_id;
    END IF;

    -- 3. Renomear cfop.codigo para cfop.cd_cfop
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'cfop' AND column_name = 'codigo') THEN
        ALTER TABLE public.cfop RENAME COLUMN codigo TO cd_cfop;
    END IF;
END $$;

-- 4. Garantir RLS e Permissões
-- tp_operacao
ALTER TABLE public.tp_operacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tp_operacao_all" ON public.tp_operacao;
CREATE POLICY "tp_operacao_all" ON public.tp_operacao FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.tp_operacao TO authenticated, anon, service_role;

-- cfop
ALTER TABLE public.cfop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cfop_all" ON public.cfop;
CREATE POLICY "cfop_all" ON public.cfop FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.cfop TO authenticated, anon, service_role;

-- fiscal_regra
ALTER TABLE public.fiscal_regra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_regra_all" ON public.fiscal_regra;
CREATE POLICY "fiscal_regra_all" ON public.fiscal_regra FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.fiscal_regra TO authenticated, anon, service_role;

-- fiscal_regra_cfop
ALTER TABLE public.fiscal_regra_cfop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_regra_cfop_all" ON public.fiscal_regra_cfop;
CREATE POLICY "fiscal_regra_cfop_all" ON public.fiscal_regra_cfop FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.fiscal_regra_cfop TO authenticated, anon, service_role;

-- fiscal_regra_item
ALTER TABLE public.fiscal_regra_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_regra_item_all" ON public.fiscal_regra_item;
CREATE POLICY "fiscal_regra_item_all" ON public.fiscal_regra_item FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON public.fiscal_regra_item TO authenticated, anon, service_role;
