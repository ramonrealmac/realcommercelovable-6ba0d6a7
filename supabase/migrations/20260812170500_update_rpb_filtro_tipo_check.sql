-- ============================================================
-- Report Builder Pro — Atualiza a constraint rpb_filtro_tipo_check
-- ============================================================

ALTER TABLE public.rpb_filtro DROP CONSTRAINT IF EXISTS rpb_filtro_tipo_check;

ALTER TABLE public.rpb_filtro ADD CONSTRAINT rpb_filtro_tipo_check 
  CHECK (tipo IN ('text','date','date_range','number','select','boolean','query_select','lista_dinamica'));
