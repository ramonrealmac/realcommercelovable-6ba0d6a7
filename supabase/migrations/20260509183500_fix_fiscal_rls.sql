-- Migration: 20260509183500_fix_fiscal_rls.sql
-- Garante que todas as tabelas fiscais possuem políticas de acesso completas para usuários autenticados

-- 1. fiscal_nfe_cabecalho
ALTER TABLE public.fiscal_nfe_cabecalho ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_cab" ON public.fiscal_nfe_cabecalho;
CREATE POLICY "auth_all_fiscal_nfe_cab" ON public.fiscal_nfe_cabecalho FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. fiscal_nfe_item
ALTER TABLE public.fiscal_nfe_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_item" ON public.fiscal_nfe_item;
CREATE POLICY "auth_all_fiscal_nfe_item" ON public.fiscal_nfe_item FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. fiscal_nfe_pagamento
ALTER TABLE public.fiscal_nfe_pagamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_pag" ON public.fiscal_nfe_pagamento;
CREATE POLICY "auth_all_fiscal_nfe_pag" ON public.fiscal_nfe_pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. fiscal_evento
ALTER TABLE public.fiscal_evento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_evento" ON public.fiscal_evento;
CREATE POLICY "auth_all_fiscal_evento" ON public.fiscal_evento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. fiscal_nfe_referenciada
ALTER TABLE public.fiscal_nfe_referenciada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_ref" ON public.fiscal_nfe_referenciada;
CREATE POLICY "auth_all_fiscal_nfe_ref" ON public.fiscal_nfe_referenciada FOR ALL TO authenticated USING (true) WITH CHECK (true);
