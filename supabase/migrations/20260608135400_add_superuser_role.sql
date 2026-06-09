-- Migration: Add superuser role and bypass checks
-- Description: Adds fl_superuser to profiles, updates functions to bypass RLS, and sets ramon.realmac@gmail.com as superuser.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fl_superuser boolean DEFAULT false NOT NULL;

-- Mark ramon.realmac@gmail.com as superuser
UPDATE public.profiles SET fl_superuser = true WHERE email = 'ramon.realmac@gmail.com';

-- Helper function to check if user is superuser (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.fu_is_superuser(_user_id uuid)
RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(fl_superuser, false) FROM public.profiles WHERE id = _user_id;
$$;

-- Add policies to allow superuser full access to profiles
DROP POLICY IF EXISTS "Superusers can view all profiles" ON public.profiles;
CREATE POLICY "Superusers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.fu_is_superuser(auth.uid()));

DROP POLICY IF EXISTS "Superusers can update all profiles" ON public.profiles;
CREATE POLICY "Superusers can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.fu_is_superuser(auth.uid())) WITH CHECK (public.fu_is_superuser(auth.uid()));

-- Update fu_user_in_empresa to bypass for superuser
CREATE OR REPLACE FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint)
RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.fu_is_superuser(_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.empresa_usuario
    WHERE user_id = _user_id AND empresa_id = _empresa_id AND fl_excluido = FALSE
  );
END;
$$;

-- Update fu_is_admin to bypass for superuser
CREATE OR REPLACE FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint)
RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.fu_is_superuser(_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.perfil_usuario pu
    JOIN public.perfil p ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
    WHERE pu.user_id = _user_id
      AND pu.empresa_id = _empresa_id
      AND pu.fl_excluido = FALSE
      AND p.fl_administrador = TRUE
      AND p.fl_excluido = FALSE
  );
END;
$$;

-- Update fu_is_admin_any to bypass for superuser
CREATE OR REPLACE FUNCTION public.fu_is_admin_any(_user_id uuid)
RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF public.fu_is_superuser(_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.perfil_usuario pu
    JOIN public.perfil p ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
    WHERE pu.user_id = _user_id
      AND pu.fl_excluido = FALSE
      AND p.fl_administrador = TRUE
      AND p.fl_excluido = FALSE
  );
END;
$$;
