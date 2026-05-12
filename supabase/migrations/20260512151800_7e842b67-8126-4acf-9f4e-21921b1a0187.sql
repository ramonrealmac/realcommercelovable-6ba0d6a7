-- 1) Fix mutable search_path on functions
ALTER FUNCTION public.fn_duplicar_ambiencia() SET search_path = public;
ALTER FUNCTION public.fn_movimento_item_calc_before() SET search_path = public;
ALTER FUNCTION public.fn_movimento_totalize() SET search_path = public;
ALTER FUNCTION public.get_or_create_nsu_seq(integer, character varying) SET search_path = public;

-- 2) Public bucket "logos" allowed listing all files via SELECT policy.
-- Files are still publicly accessible via direct URL (bucket is public);
-- removing the SELECT policy only blocks the LIST API, preventing enumeration.
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;