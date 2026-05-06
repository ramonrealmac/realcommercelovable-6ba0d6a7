-- Habilitar RLS na tabela fiscal_config e criar politicas de acesso
ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can read fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Auth can insert fiscal_config" ON public.fiscal_config;
DROP POLICY IF EXISTS "Auth can update fiscal_config" ON public.fiscal_config;

CREATE POLICY "Auth can read fiscal_config" ON public.fiscal_config 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert fiscal_config" ON public.fiscal_config 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth can update fiscal_config" ON public.fiscal_config 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
