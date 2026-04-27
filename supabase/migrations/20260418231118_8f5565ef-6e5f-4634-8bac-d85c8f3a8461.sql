ALTER TABLE public.grupo_ibscbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grupo_ibscbs_auth" ON public.grupo_ibscbs FOR ALL TO authenticated USING (true) WITH CHECK (true);