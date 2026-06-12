-- Migration: 20260611143400_insert_all_missing_units_empresa_5.sql
-- Insert missing units of measure for empresa_id = 5

INSERT INTO public.unidade (unidade_id, descricao, empresa_id, excluido) VALUES
('FL', 'Folha', 5, false),
('PA', 'Par', 5, false),
('CH', 'Chapa', 5, false),
('MDZ', 'Metro Dúzia', 5, false),
('MD', 'Metro Dúzia', 5, false)
ON CONFLICT (unidade_id, empresa_id) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  excluido = false;
