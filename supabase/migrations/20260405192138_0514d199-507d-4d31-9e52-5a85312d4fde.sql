
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nm_usuario TEXT DEFAULT '',
  ds_login TEXT DEFAULT '',
  ds_foto TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.perfil_usuario pu
      JOIN public.perfil p ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
      WHERE pu.user_id = auth.uid()
        AND p.fl_administrador = TRUE
        AND p.fl_excluido = FALSE
        AND pu.fl_excluido = FALSE
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fu_update_updated_at();

-- Insert profile for existing user ramon.realmac@gmail.com
INSERT INTO public.profiles (id, email, nm_usuario, ds_login)
VALUES (
  'bc04c871-7f34-41b2-952d-c547bd039c9f',
  'ramon.realmac@gmail.com',
  'Ramon',
  'ramon.realmac'
);
