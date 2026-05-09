
-- Helper: is the user an admin in any empresa?
CREATE OR REPLACE FUNCTION public.fu_is_admin_any(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfil_usuario pu
    JOIN public.perfil p
      ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
    WHERE pu.user_id = _user_id
      AND pu.fl_excluido = FALSE
      AND p.fl_administrador = TRUE
      AND p.fl_excluido = FALSE
  )
$$;

-- empresa: scope SELECT to members of the empresa
DROP POLICY IF EXISTS "Auth can view empresa" ON public.empresa;
CREATE POLICY "Empresa members can view empresa"
ON public.empresa FOR SELECT TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- fiscal_config: scope to empresa members
DROP POLICY IF EXISTS "Auth can read fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Auth can insert fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Auth can update fiscal_config" ON public.fiscal_config;
CREATE POLICY "Empresa members can read fiscal_config"
ON public.fiscal_config FOR SELECT TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Empresa members can insert fiscal_config"
ON public.fiscal_config FOR INSERT TO authenticated
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Empresa members can update fiscal_config"
ON public.fiscal_config FOR UPDATE TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- parametro (single-row global table with payment secrets): admin-only
DROP POLICY IF EXISTS "Auth can select parametro" ON public.parametro;
DROP POLICY IF EXISTS "Auth can update parametro" ON public.parametro;
CREATE POLICY "Admins can select parametro"
ON public.parametro FOR SELECT TO authenticated
USING (public.fu_is_admin_any(auth.uid()));
CREATE POLICY "Admins can update parametro"
ON public.parametro FOR UPDATE TO authenticated
USING (public.fu_is_admin_any(auth.uid()))
WITH CHECK (public.fu_is_admin_any(auth.uid()));

-- rb_relatorio
DROP POLICY IF EXISTS "rb_relatorio_auth" ON public.rb_relatorio;
CREATE POLICY "rb_relatorio_empresa_members"
ON public.rb_relatorio FOR ALL TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- rb_templatepesquisa
DROP POLICY IF EXISTS "rb_templatepesquisa_auth" ON public.rb_templatepesquisa;
CREATE POLICY "rb_templatepesquisa_empresa_members"
ON public.rb_templatepesquisa FOR ALL TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- rpb_relatorio
DROP POLICY IF EXISTS "rpb_relatorio_all" ON public.rpb_relatorio;
CREATE POLICY "rpb_relatorio_empresa_members"
ON public.rpb_relatorio FOR ALL TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- rpb_filtro
DROP POLICY IF EXISTS "rpb_filtro_all" ON public.rpb_filtro;
CREATE POLICY "rpb_filtro_empresa_members"
ON public.rpb_filtro FOR ALL TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- fiscal_evento: SELECT scoped to empresa members (also gates Realtime subscriptions)
CREATE POLICY "Empresa members can view fiscal_evento"
ON public.fiscal_evento FOR SELECT TO authenticated
USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Empresa members can insert fiscal_evento"
ON public.fiscal_evento FOR INSERT TO authenticated
WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- Storage 'logos' bucket: restrict UPDATE/DELETE to admins of any empresa
DROP POLICY IF EXISTS "Auth can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Auth can update logos" ON storage.objects;
CREATE POLICY "Admins can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logos' AND public.fu_is_admin_any(auth.uid()));
CREATE POLICY "Admins can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logos' AND public.fu_is_admin_any(auth.uid()))
WITH CHECK (bucket_id = 'logos' AND public.fu_is_admin_any(auth.uid()));
