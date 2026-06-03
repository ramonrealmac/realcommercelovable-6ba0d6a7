ALTER TABLE public.cadastro
  ADD COLUMN IF NOT EXISTS tp_proprietario VARCHAR(1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rntrc VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS uf_proprietario VARCHAR(2) DEFAULT NULL;

-- Atualizar versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES ('1.16.14', 'Adicionados campos de proprietario e RNTRC no Cadastro', 'Novas colunas tp_proprietario, rntrc e uf_proprietario na tabela cadastro', 'Antigravity', 'Desenvolvimento', ARRAY['React', 'Supabase']);
