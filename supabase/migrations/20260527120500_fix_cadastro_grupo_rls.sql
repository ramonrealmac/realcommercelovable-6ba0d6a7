-- Migration: 20260527120500_fix_cadastro_grupo_rls.sql
-- Garante Row Level Security (RLS) habilitado e permissões completas de CRUD para usuários autenticados na tabela cadastro_grupo

-- 1. Garante que o RLS está habilitado
ALTER TABLE public.cadastro_grupo ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas ou conflitantes se existirem
DROP POLICY IF EXISTS "Auth can manage grupo_cadastro" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can view grupo_cadastro" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can manage cadastro_grupo" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can view cadastro_grupo" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "global_auth_access" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can select cadastro_grupo" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can insert cadastro_grupo" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can update cadastro_grupo" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can delete cadastro_grupo" ON public.cadastro_grupo;

-- 3. Cria políticas de acesso explícitas e completas para CRUD
CREATE POLICY "Auth can select cadastro_grupo" ON public.cadastro_grupo 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert cadastro_grupo" ON public.cadastro_grupo 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth can update cadastro_grupo" ON public.cadastro_grupo 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can delete cadastro_grupo" ON public.cadastro_grupo 
  FOR DELETE TO authenticated USING (true);
