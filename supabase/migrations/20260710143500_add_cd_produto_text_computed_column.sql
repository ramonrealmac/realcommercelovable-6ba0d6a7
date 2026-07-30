-- Migration: 20260710143500_add_cd_produto_text_computed_column.sql
-- Description: Creates computed column function cd_produto_text on public.produto to enable prefix searches.

CREATE OR REPLACE FUNCTION public.cd_produto_text(p public.produto)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT p.cd_produto::text;
$$;
