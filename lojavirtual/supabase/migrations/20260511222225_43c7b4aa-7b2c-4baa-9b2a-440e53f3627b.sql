-- 1. Adiciona coluna de aprovação
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xlg_aprovado boolean NOT NULL DEFAULT false;

-- 2. Aprova usuários existentes (já estavam usando o sistema)
UPDATE public.profiles SET xlg_aprovado = true WHERE xlg_aprovado = false;

-- 3. Atualiza bootstrap: primeiro ADM já entra aprovado, demais ficam pendentes
CREATE OR REPLACE FUNCTION public.fu_bootstrap_role(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADM') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'ADM') ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET xlg_aprovado = true WHERE id = _user_id;
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'CAIXA') ON CONFLICT DO NOTHING;
  END IF;
END;
$function$;

-- 4. Função para o próprio usuário consultar se está aprovado
CREATE OR REPLACE FUNCTION public.fu_is_aprovado(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT xlg_aprovado FROM public.profiles WHERE id = _user_id), false);
$function$;

-- 5. Listar todos os usuários (apenas ADM)
CREATE OR REPLACE FUNCTION public.fu_list_users_admin()
RETURNS TABLE(id uuid, xnm_usuario text, xemail text, xlg_aprovado boolean, role app_role, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADM') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT p.id, p.xnm_usuario, p.xemail, p.xlg_aprovado,
      (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = p.id ORDER BY (ur.role = 'ADM') DESC LIMIT 1) AS role,
      p.created_at
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$function$;

-- 6. Aprovar / bloquear usuário (apenas ADM)
CREATE OR REPLACE FUNCTION public.fu_set_user_approval(_user_id uuid, _aprovado boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADM') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _user_id = auth.uid() AND _aprovado = false THEN
    RAISE EXCEPTION 'Você não pode bloquear seu próprio acesso';
  END IF;
  UPDATE public.profiles SET xlg_aprovado = _aprovado, updated_at = now() WHERE id = _user_id;
END;
$function$;

-- 7. Alterar papel do usuário (apenas ADM)
CREATE OR REPLACE FUNCTION public.fu_set_user_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADM') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _user_id = auth.uid() AND _role <> 'ADM' THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio papel de administrador';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);
END;
$function$;