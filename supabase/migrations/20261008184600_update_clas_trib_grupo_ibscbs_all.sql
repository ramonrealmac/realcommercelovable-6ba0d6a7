-- Migration: 20261008184600_update_clas_trib_grupo_ibscbs_all.sql
-- Description: Atualiza grupo_ibscbs_id em TODOS os registros da tabela clas_trib com base nos prefixos dos códigos cClassTrib

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
