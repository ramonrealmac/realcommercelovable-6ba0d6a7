-- Migration: 20261009090000_add_icms_rls_all_policy.sql
-- Description: Adiciona política RLS de leitura/escrita (ALL) na tabela public.icms

ALTER TABLE public.icms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS icms_all_policy ON public.icms;
DROP POLICY IF EXISTS icms_select_public ON public.icms;

CREATE POLICY icms_all_policy ON public.icms
FOR ALL TO public USING (true) WITH CHECK (true);
