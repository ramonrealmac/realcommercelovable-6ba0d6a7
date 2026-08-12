-- Migration: 20260810110500_add_dt_alteracao_to_financeiro.sql
-- Description: Adds the dt_alteracao column to public.financeiro table and registers system version 1.18.41.

ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS dt_alteracao TIMESTAMP WITH TIME ZONE;

-- Register version 1.18.41
DELETE FROM public.sistema_versoes WHERE versao = '1.18.41';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.41',
  'Ajuste dt_alteracao na tabela Financeiro',
  'FINANCEIRO: Adicionada a coluna dt_alteracao à tabela public.financeiro para suportar atualizações genéricas da baseService.',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'TypeScript', 'Supabase']
);
