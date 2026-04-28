CREATE POLICY "Authenticated can select estado" ON public.estado FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert estado" ON public.estado FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update estado" ON public.estado FOR UPDATE TO authenticated USING (true) WITH CHECK (true);