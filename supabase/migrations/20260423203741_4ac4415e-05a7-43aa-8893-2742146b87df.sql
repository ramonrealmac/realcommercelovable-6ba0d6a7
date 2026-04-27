GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionario TO authenticated;
GRANT SELECT ON public.funcionario TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;