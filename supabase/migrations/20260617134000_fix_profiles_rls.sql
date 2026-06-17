-- Migration: 20260617000000_fix_profiles_rls.sql
-- Descrição: Ajusta as políticas de RLS das tabelas de profiles e empresa_usuario
-- para permitir acesso (SELECT) a qualquer usuário autenticado que pertença à empresa correspondente (fu_user_in_empresa),
-- alinhando com a regra definida na migration 20260604131500_fix_perfil_rls.sql.

-- ==========================================
-- 1. Tabela: profiles
-- ==========================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view profiles same empresa" ON public.profiles;

CREATE POLICY "Empresa members can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 
      FROM public.empresa_usuario eu
      WHERE eu.user_id = profiles.id 
        AND eu.fl_excluido = false 
        AND public.fu_user_in_empresa(auth.uid(), eu.empresa_id)
    )
  );

-- ==========================================
-- 2. Tabela: empresa_usuario (apenas em caso de UPDATE/INSERT precisar, embora SELECT já tenha "EU read same empresa")
-- ==========================================
ALTER TABLE public.empresa_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update EMPRESA_USUARIO" ON public.empresa_usuario;
DROP POLICY IF EXISTS "Admins or bootstrap can insert EMPRESA_USUARIO" ON public.empresa_usuario;

CREATE POLICY "Empresa members can update EMPRESA_USUARIO" ON public.empresa_usuario
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert EMPRESA_USUARIO" ON public.empresa_usuario
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id) OR (user_id = auth.uid()));

