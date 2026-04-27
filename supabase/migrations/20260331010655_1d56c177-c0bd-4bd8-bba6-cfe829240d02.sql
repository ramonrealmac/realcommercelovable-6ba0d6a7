
-- Fix empresa_usuario INSERT policy: allow bootstrap (first user can self-register)
DROP POLICY IF EXISTS "Admins can insert EMPRESA_USUARIO" ON public.empresa_usuario;
CREATE POLICY "Admins or bootstrap can insert EMPRESA_USUARIO"
ON public.empresa_usuario
FOR INSERT TO authenticated
WITH CHECK (
  fu_is_admin(auth.uid(), empresa_id)
  OR (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.empresa_usuario eu
      WHERE eu.empresa_id = empresa_usuario.empresa_id AND eu.fl_excluido = false
    )
  )
);

-- Fix perfil_usuario INSERT policy: allow bootstrap (first user assigns themselves admin)
DROP POLICY IF EXISTS "Admins can insert PERFIL_USUARIO" ON public.perfil_usuario;
CREATE POLICY "Admins or bootstrap can insert PERFIL_USUARIO"
ON public.perfil_usuario
FOR INSERT TO authenticated
WITH CHECK (
  fu_is_admin(auth.uid(), empresa_id)
  OR (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.perfil_usuario pu
      WHERE pu.empresa_id = perfil_usuario.empresa_id AND pu.fl_excluido = false
    )
  )
);
