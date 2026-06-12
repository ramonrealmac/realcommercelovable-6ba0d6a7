-- Migration: 20260611115000_fix_unidade_rls.sql
-- Drop existing policies on public.unidade
DROP POLICY IF EXISTS unidade_delete_authenticated ON public.unidade;
DROP POLICY IF EXISTS unidade_insert_authenticated ON public.unidade;
DROP POLICY IF EXISTS unidade_select_authenticated ON public.unidade;
DROP POLICY IF EXISTS unidade_update_authenticated ON public.unidade;

-- Create a single open policy for authenticated users on public.unidade
CREATE POLICY unidade_all_authenticated ON public.unidade
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
