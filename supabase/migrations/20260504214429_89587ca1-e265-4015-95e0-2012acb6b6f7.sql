ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select financeiro"
ON public.financeiro FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert financeiro"
ON public.financeiro FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update financeiro"
ON public.financeiro FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);