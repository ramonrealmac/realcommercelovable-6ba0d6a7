ALTER TABLE public.fiscal_mdf_manifesto
  ADD COLUMN IF NOT EXISTS transportador_id INTEGER REFERENCES public.cadastro(cadastro_id) DEFAULT NULL;

-- Atualizar versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES ('1.16.21', 'Associação de Transportador ao MDF-e', 'Adicionada coluna transportador_id na tabela fiscal_mdf_manifesto', 'Antigravity', 'Desenvolvimento', ARRAY['React', 'Supabase', 'PostgreSQL']);
