-- Migration: 20260810111000_add_fk_financeiro_baixa_to_financeiro.sql
-- Description: Adds foreign key constraint between public.financeiro_baixa and public.financeiro, and registers version 1.18.42.

ALTER TABLE public.financeiro_baixa
ADD CONSTRAINT fk_financeiro_baixa_financeiro
FOREIGN KEY (empresa_id, financeiro_id)
REFERENCES public.financeiro (empresa_id, financeiro_id)
ON DELETE CASCADE;

-- Register version 1.18.42
DELETE FROM public.sistema_versoes WHERE versao = '1.18.42';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.42',
  'Adiciona chave estrangeira de Baixa para Financeiro',
  'FINANCEIRO: Adicionada a restrição FOREIGN KEY entre public.financeiro_baixa e public.financeiro para viabilizar consultas com relacionamento no PostgREST.',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'TypeScript', 'Supabase']
);
