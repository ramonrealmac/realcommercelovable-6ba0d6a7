-- Migration: 20260611142900_insert_unidade_pc_empresa_5.sql
-- Insert unit 'PÇ' for empresa_id = 5

INSERT INTO public.unidade (unidade_id, descricao, empresa_id, excluido) VALUES
('PÇ', 'Peça', 5, false)
ON CONFLICT (unidade_id, empresa_id) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  excluido = false;
