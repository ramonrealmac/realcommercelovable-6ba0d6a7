-- Migration: 20261009093000_add_fiscal_regra_public_rls.sql
-- Description: Adiciona políticas de RLS públicas para fiscal_regra, fiscal_regra_item e fiscal_regra_cfop

ALTER TABLE public.fiscal_regra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_regra_all_public ON public.fiscal_regra;
CREATE POLICY fiscal_regra_all_public ON public.fiscal_regra FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.fiscal_regra_item ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_regra_item_all_public ON public.fiscal_regra_item;
CREATE POLICY fiscal_regra_item_all_public ON public.fiscal_regra_item FOR ALL TO public USING (true) WITH CHECK (true);

ALTER TABLE public.fiscal_regra_cfop ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fiscal_regra_cfop_all_public ON public.fiscal_regra_cfop;
CREATE POLICY fiscal_regra_cfop_all_public ON public.fiscal_regra_cfop FOR ALL TO public USING (true) WITH CHECK (true);
