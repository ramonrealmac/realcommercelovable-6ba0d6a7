-- Migration: 20261008182000_update_ipi_rls_all.sql
-- Description: Adiciona política de permissão de escrita/ALL para a tabela public.ipi

DROP POLICY IF EXISTS ipi_all_policy ON public.ipi;

CREATE POLICY ipi_all_policy ON public.ipi
FOR ALL TO public USING (true) WITH CHECK (true);
