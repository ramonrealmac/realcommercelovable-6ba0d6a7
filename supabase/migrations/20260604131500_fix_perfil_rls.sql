-- Migration: 20260604131500_fix_perfil_rls.sql
-- Descrição: Ajusta as políticas de RLS das tabelas de perfil (perfil, perfil_horario, perfil_usuario, perfil_acesso_*) 
-- para permitir acesso completo (CRUD) a qualquer usuário autenticado que pertença à empresa correspondente (fu_user_in_empresa).
-- Remove a dependência restritiva da função fu_is_admin para criação/edição.

-- ==========================================
-- 1. Tabela: perfil
-- ==========================================
ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can update PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Admins or bootstrap can insert PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Empresa members can select PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Empresa members can update PERFIL" ON public.perfil;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL" ON public.perfil;

CREATE POLICY "Empresa members can select PERFIL" ON public.perfil
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL" ON public.perfil
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL" ON public.perfil
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL" ON public.perfil
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 2. Tabela: perfil_horario
-- ==========================================
ALTER TABLE public.perfil_horario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Admins can update PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_HORARIO" ON public.perfil_horario;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_HORARIO" ON public.perfil_horario;

CREATE POLICY "Empresa members can select PERFIL_HORARIO" ON public.perfil_horario
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_HORARIO" ON public.perfil_horario
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_HORARIO" ON public.perfil_horario
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_HORARIO" ON public.perfil_horario
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 3. Tabela: perfil_usuario
-- ==========================================
ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_USUARIO" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Admins can update PERFIL_USUARIO" ON public.perfil_usuario;
DROP POLICY IF EXISTS "PU read same empresa" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_USUARIO" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_USUARIO" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_USUARIO" ON public.perfil_usuario;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_USUARIO" ON public.perfil_usuario;

CREATE POLICY "Empresa members can select PERFIL_USUARIO" ON public.perfil_usuario
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_USUARIO" ON public.perfil_usuario
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_USUARIO" ON public.perfil_usuario
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_USUARIO" ON public.perfil_usuario
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 4. Tabela: perfil_acesso_botao
-- ==========================================
ALTER TABLE public.perfil_acesso_botao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Admins can update PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao;

CREATE POLICY "Empresa members can select PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 5. Tabela: perfil_acesso_campo
-- ==========================================
ALTER TABLE public.perfil_acesso_campo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Admins can update PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo;

CREATE POLICY "Empresa members can select PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 6. Tabela: perfil_acesso_formulario
-- ==========================================
ALTER TABLE public.perfil_acesso_formulario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Admins can update PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario;

CREATE POLICY "Empresa members can select PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


-- ==========================================
-- 7. Tabela: perfil_acesso_menu
-- ==========================================
ALTER TABLE public.perfil_acesso_menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Admins can update PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Authenticated users can read PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Empresa members can select PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Empresa members can insert PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Empresa members can update PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;
DROP POLICY IF EXISTS "Empresa members can delete PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu;

CREATE POLICY "Empresa members can select PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can insert PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can update PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

CREATE POLICY "Empresa members can delete PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
