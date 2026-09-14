-- Migration: 20260914153000_fix_creditos_rls_permissions.sql
-- Description: Desabilita RLS e concede permissões completas de SELECT, INSERT, UPDATE para as tabelas de conta corrente de créditos.

ALTER TABLE public.cadastro_credito_saldo DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro_credito_movimento DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.cadastro_credito_saldo TO anon, authenticated, postgres, service_role;
GRANT ALL ON public.cadastro_credito_movimento TO anon, authenticated, postgres, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, postgres, service_role;

NOTIFY pgrst, 'reload schema';
