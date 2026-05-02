-- ============================================================
-- Report Builder Pro — Adiciona suporte a Lista Dinâmica
-- ============================================================

-- 1. Atualiza a restrição de tipo na tabela rpb_filtro
ALTER TABLE public.rpb_filtro DROP CONSTRAINT IF EXISTS rpb_filtro_tipo_check;

ALTER TABLE public.rpb_filtro ADD CONSTRAINT rpb_filtro_tipo_check 
  CHECK (tipo IN ('text','date','date_range','number','select','boolean','query_select','lista_dinamica'));

-- Nota: Reutilizaremos query_opcoes para o SQL de pesquisa
-- e opcoes_fixas para configurações extras se necessário (ex: campo_valor;campo_label;multi)
