-- Migration: 20261008183000_update_ibscbs_rls_all.sql
-- Description: Adiciona política de escrita/ALL para a tabela public.ibscbs

DROP POLICY IF EXISTS ibscbs_all_policy ON public.ibscbs;

CREATE POLICY ibscbs_all_policy ON public.ibscbs
FOR ALL TO public USING (true) WITH CHECK (true);
