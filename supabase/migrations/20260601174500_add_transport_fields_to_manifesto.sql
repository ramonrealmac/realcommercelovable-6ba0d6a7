ALTER TABLE fiscal_mdf_manifesto
  ADD COLUMN IF NOT EXISTS ciot VARCHAR(12) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ciot_cnpj_cpf VARCHAR(14) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contratante_cnpj_cpf VARCHAR(14) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS contratante_nome VARCHAR(60) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transp_cnpj_cpf VARCHAR(14) DEFAULT NULL;

-- Atualizar versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES ('1.16.13', 'Adicionados campos de transporte e ANTT no MDF-e', 'Novas colunas e validacoes de tpTransp no MDF-e', 'Antigravity', 'Desenvolvimento', ARRAY['React', 'Supabase']);
