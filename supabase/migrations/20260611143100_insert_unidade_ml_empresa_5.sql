-- Migration: 20260611143100_insert_unidade_ml_empresa_5.sql
-- Insert unit 'ML' for empresa_id = 5

INSERT INTO public.unidade (unidade_id, descricao, empresa_id, excluido) VALUES
('ML', 'Metro Linear', 5, false)
ON CONFLICT (unidade_id, empresa_id) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  excluido = false;
