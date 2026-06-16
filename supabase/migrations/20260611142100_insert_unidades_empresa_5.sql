-- Migration: 20260611142100_insert_unidades_empresa_5.sql
-- Insert units of measure for empresa_id = 5

INSERT INTO public.unidade (unidade_id, descricao, empresa_id, excluido) VALUES
('PAR', 'Par', 5, false),
('MT', 'Metro', 5, false),
('PCT', 'Pacote', 5, false),
('M3', 'Metro Cúbico', 5, false),
('LT', 'Lata', 5, false),
('SC', 'Saco', 5, false),
('JG', 'Jogo', 5, false),
('M2', 'Metro Quadrado', 5, false),
('UN', 'Unidade', 5, false)
ON CONFLICT (unidade_id, empresa_id) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  excluido = false;
