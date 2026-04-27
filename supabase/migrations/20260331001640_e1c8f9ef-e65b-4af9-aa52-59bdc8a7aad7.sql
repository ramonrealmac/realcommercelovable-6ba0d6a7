
-- Fix RLS policies: restrict INSERT/UPDATE to admin users or users associated with the company

-- Drop existing permissive INSERT/UPDATE policies
DROP POLICY "Authenticated users can insert PERFIL" ON public.PERFIL;
DROP POLICY "Authenticated users can update PERFIL" ON public.PERFIL;
DROP POLICY "Authenticated users can insert PERFIL_USUARIO" ON public.PERFIL_USUARIO;
DROP POLICY "Authenticated users can update PERFIL_USUARIO" ON public.PERFIL_USUARIO;
DROP POLICY "Authenticated users can insert EMPRESA_USUARIO" ON public.EMPRESA_USUARIO;
DROP POLICY "Authenticated users can update EMPRESA_USUARIO" ON public.EMPRESA_USUARIO;
DROP POLICY "Authenticated users can insert PERFIL_ACESSO_MENU" ON public.PERFIL_ACESSO_MENU;
DROP POLICY "Authenticated users can update PERFIL_ACESSO_MENU" ON public.PERFIL_ACESSO_MENU;
DROP POLICY "Authenticated users can insert PERFIL_ACESSO_FORMULARIO" ON public.PERFIL_ACESSO_FORMULARIO;
DROP POLICY "Authenticated users can update PERFIL_ACESSO_FORMULARIO" ON public.PERFIL_ACESSO_FORMULARIO;
DROP POLICY "Authenticated users can insert PERFIL_ACESSO_BOTAO" ON public.PERFIL_ACESSO_BOTAO;
DROP POLICY "Authenticated users can update PERFIL_ACESSO_BOTAO" ON public.PERFIL_ACESSO_BOTAO;
DROP POLICY "Authenticated users can insert PERFIL_ACESSO_CAMPO" ON public.PERFIL_ACESSO_CAMPO;
DROP POLICY "Authenticated users can update PERFIL_ACESSO_CAMPO" ON public.PERFIL_ACESSO_CAMPO;

-- Helper function: check if user belongs to empresa
CREATE OR REPLACE FUNCTION public.FU_USER_IN_EMPRESA(_user_id UUID, _empresa_id BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.EMPRESA_USUARIO
    WHERE user_id = _user_id AND EMPRESA_ID = _empresa_id AND FL_EXCLUIDO = FALSE
  )
$$;

-- PERFIL: only admins can insert/update
CREATE POLICY "Admins can insert PERFIL" ON public.PERFIL FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL" ON public.PERFIL FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- PERFIL_USUARIO: only admins
CREATE POLICY "Admins can insert PERFIL_USUARIO" ON public.PERFIL_USUARIO FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL_USUARIO" ON public.PERFIL_USUARIO FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- EMPRESA_USUARIO: only admins (or first user bootstrap)
CREATE POLICY "Admins can insert EMPRESA_USUARIO" ON public.EMPRESA_USUARIO FOR INSERT TO authenticated
  WITH CHECK (
    public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID) 
    OR NOT EXISTS (SELECT 1 FROM public.EMPRESA_USUARIO WHERE EMPRESA_ID = EMPRESA_USUARIO.EMPRESA_ID AND FL_EXCLUIDO = FALSE)
  );

CREATE POLICY "Admins can update EMPRESA_USUARIO" ON public.EMPRESA_USUARIO FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- PERFIL_ACESSO_MENU: only admins
CREATE POLICY "Admins can insert PERFIL_ACESSO_MENU" ON public.PERFIL_ACESSO_MENU FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL_ACESSO_MENU" ON public.PERFIL_ACESSO_MENU FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- PERFIL_ACESSO_FORMULARIO: only admins
CREATE POLICY "Admins can insert PERFIL_ACESSO_FORMULARIO" ON public.PERFIL_ACESSO_FORMULARIO FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL_ACESSO_FORMULARIO" ON public.PERFIL_ACESSO_FORMULARIO FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- PERFIL_ACESSO_BOTAO: only admins
CREATE POLICY "Admins can insert PERFIL_ACESSO_BOTAO" ON public.PERFIL_ACESSO_BOTAO FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL_ACESSO_BOTAO" ON public.PERFIL_ACESSO_BOTAO FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

-- PERFIL_ACESSO_CAMPO: only admins
CREATE POLICY "Admins can insert PERFIL_ACESSO_CAMPO" ON public.PERFIL_ACESSO_CAMPO FOR INSERT TO authenticated
  WITH CHECK (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));

CREATE POLICY "Admins can update PERFIL_ACESSO_CAMPO" ON public.PERFIL_ACESSO_CAMPO FOR UPDATE TO authenticated
  USING (public.FU_IS_ADMIN(auth.uid(), EMPRESA_ID));
