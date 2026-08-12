-- Migration: 20260810170000_add_dt_alteracao_to_operadora.sql
-- Description: Adds dt_alteracao column to public.operadora and reloads schema cache. Registers version 1.18.46.

ALTER TABLE public.operadora ADD COLUMN IF NOT EXISTS dt_alteracao timestamp with time zone DEFAULT now();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Register version 1.18.46
DELETE FROM public.sistema_versoes WHERE versao = '1.18.46';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.46',
  'Adição de dt_alteracao na tabela operadora',
  'Adição da coluna dt_alteracao na tabela public.operadora para suportar controle de auditoria e salvar alterações do cadastro e grid de taxas.',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'Supabase'],
  now()
);
