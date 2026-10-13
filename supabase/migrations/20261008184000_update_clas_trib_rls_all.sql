-- Migration: 20261008184000_update_clas_trib_rls_all.sql
-- Description: Adiciona política de RLS de leitura e escrita (ALL) para a tabela public.clas_trib

DROP POLICY IF EXISTS clas_trib_all_policy ON public.clas_trib;

CREATE POLICY clas_trib_all_policy ON public.clas_trib
FOR ALL TO public USING (true) WITH CHECK (true);
