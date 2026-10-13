-- Migration: 20261008190000_fix_clas_trib_rls_and_data.sql
-- Description: Libera permissões de RLS (SELECT/ALL) na tabela public.clas_trib, expande tamanho da descrição e atualiza grupo_ibscbs_id em todos os registros

-- 1. Expande o limite de caracteres da descrição
ALTER TABLE public.clas_trib ALTER COLUMN descricao TYPE varchar(255);

-- 2. Habilita RLS e cria permissão de leitura/escrita pública (necessário para a aplicação carregar os dados)
ALTER TABLE public.clas_trib ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clas_trib_all_policy ON public.clas_trib;
DROP POLICY IF EXISTS clas_trib_select_public ON public.clas_trib;

CREATE POLICY clas_trib_all_policy ON public.clas_trib
FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. Atualiza grupo_ibscbs_id (CST IBS/CBS) em TODOS os registros baseado no código cClassTrib
UPDATE public.clas_trib
SET grupo_ibscbs_id = CASE
  WHEN clas_trib_id LIKE '000%' THEN 1  -- CST 000
  WHEN clas_trib_id LIKE '010%' THEN 2  -- CST 010
  WHEN clas_trib_id LIKE '011%' THEN 3  -- CST 011
  WHEN clas_trib_id LIKE '200%' THEN 4  -- CST 200
  WHEN clas_trib_id LIKE '220%' THEN 5  -- CST 220
  WHEN clas_trib_id LIKE '221%' THEN 6  -- CST 221
  WHEN clas_trib_id LIKE '222%' THEN 7  -- CST 222
  WHEN clas_trib_id LIKE '300%' THEN 13 -- CST 620
  WHEN clas_trib_id LIKE '400%' THEN 8  -- CST 400
  WHEN clas_trib_id LIKE '500%' THEN 9  -- CST 410
  WHEN clas_trib_id LIKE '600%' THEN 12 -- CST 550
  WHEN clas_trib_id LIKE '700%' THEN 10 -- CST 510
  WHEN clas_trib_id LIKE '800%' THEN 9  -- CST 410
  WHEN clas_trib_id LIKE '900%' THEN 16 -- CST 811
  ELSE grupo_ibscbs_id
END;
