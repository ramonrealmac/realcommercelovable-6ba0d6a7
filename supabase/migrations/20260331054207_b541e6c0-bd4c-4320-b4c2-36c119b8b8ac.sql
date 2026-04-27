
-- Allow authenticated users to update parametro
CREATE POLICY "Auth can update parametro" ON public.parametro
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can select parametro" ON public.parametro
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to update parametro_horario
CREATE POLICY "Auth can update parametro_horario" ON public.parametro_horario
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can insert parametro_horario" ON public.parametro_horario
  FOR INSERT TO authenticated WITH CHECK (true);

-- Enable RLS on parametro if not already
ALTER TABLE public.parametro ENABLE ROW LEVEL SECURITY;
