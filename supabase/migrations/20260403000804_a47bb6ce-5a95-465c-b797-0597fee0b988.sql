
-- Drop the FK to empresa
ALTER TABLE public.cidade DROP CONSTRAINT IF EXISTS cidade_empresa_id_fkey;

-- Drop RLS policies that reference empresa_id
DROP POLICY IF EXISTS "cidade_auth" ON public.cidade;

-- Rename cidade_id to cd_cidade
ALTER TABLE public.cidade RENAME COLUMN cidade_id TO cd_cidade;

-- Remove empresa_id column
ALTER TABLE public.cidade DROP COLUMN empresa_id;

-- Add unique index on cd_ibge
CREATE UNIQUE INDEX iu_cidade_cd_ibge ON public.cidade (cd_ibge) WHERE cd_ibge IS NOT NULL;

-- Recreate RLS policy without empresa_id
CREATE POLICY "cidade_auth" ON public.cidade FOR ALL TO authenticated USING (true) WITH CHECK (true);
