-- Migration: Create public function to retrieve company list
-- Description: Allows unauthenticated users to view basic company name and ID for self-registration dropdown.

CREATE OR REPLACE FUNCTION public.get_public_empresas()
RETURNS TABLE(empresa_id bigint, razao_social text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT empresa_id, razao_social
  FROM public.empresa
  WHERE excluido = false
  ORDER BY razao_social;
$$;

-- Grant execution to anon/authenticated
GRANT EXECUTE ON FUNCTION public.get_public_empresas() TO anon, authenticated;
