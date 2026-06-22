-- Migration: 20260618114500_insert_csv_unidades_empresa_5.sql
-- Insert missing units of measure from products.csv for empresa_id = 5

INSERT INTO public.unidade (unidade_id, descricao, empresa_id, excluido) VALUES
('PT', 'Pote', 5, false),
('CT', 'Cento', 5, false),
('CA', 'Cartucho', 5, false),
('BR', 'Barra', 5, false),
('L', 'Litro', 5, false),
('ND', 'Não Definido', 5, false),
('BA', 'Barra', 5, false),
('LA', 'Lata', 5, false),
('UM', 'Unidade', 5, false),
('PCA', 'Peça', 5, false),
('UN.', 'Unidade', 5, false)
ON CONFLICT (unidade_id, empresa_id) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  excluido = false;
