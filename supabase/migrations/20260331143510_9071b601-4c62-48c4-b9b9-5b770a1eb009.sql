
-- Rename table grupo_cadastro to cadastro_grupo
ALTER TABLE public.grupo_cadastro RENAME TO cadastro_grupo;

-- Rename PK column
ALTER TABLE public.cadastro_grupo RENAME COLUMN grupo_cadastro_id TO cadastro_grupo_id;

-- Rename FK constraint
ALTER TABLE public.cadastro_grupo RENAME CONSTRAINT grupo_cadastro_empresa_id_fkey TO cadastro_grupo_empresa_id_fkey;

-- Drop old RLS policies and recreate with new table name
DROP POLICY IF EXISTS "Auth can manage grupo_cadastro" ON public.cadastro_grupo;
DROP POLICY IF EXISTS "Auth can view grupo_cadastro" ON public.cadastro_grupo;

CREATE POLICY "Auth can manage cadastro_grupo" ON public.cadastro_grupo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth can view cadastro_grupo" ON public.cadastro_grupo FOR SELECT TO authenticated USING (true);
