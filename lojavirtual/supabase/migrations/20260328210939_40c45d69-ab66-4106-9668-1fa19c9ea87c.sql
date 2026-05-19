
-- Fix: Restrict parametro SELECT to ADM only (protects API keys and webhook secrets)
DROP POLICY "Auth can view parametro" ON public.parametro;

CREATE POLICY "Admins can view parametro" ON public.parametro
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'ADM'::app_role));
