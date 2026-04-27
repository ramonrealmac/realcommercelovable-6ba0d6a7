
-- Drop existing INSERT policy on perfil
DROP POLICY IF EXISTS "Admins can insert PERFIL" ON public.perfil;

-- Allow insert if user is admin OR if no perfis exist for that empresa (bootstrap)
CREATE POLICY "Admins or bootstrap can insert PERFIL"
ON public.perfil
FOR INSERT TO authenticated
WITH CHECK (
  fu_is_admin(auth.uid(), empresa_id)
  OR NOT EXISTS (
    SELECT 1 FROM public.perfil p WHERE p.empresa_id = perfil.empresa_id AND p.fl_excluido = false
  )
);
