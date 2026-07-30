-- Migration: 20260706154700_alter_portador_caminho_ativo.sql
-- Description: Alter portador table to drop caminho_remessa and add ativo column. Registers version 1.18.15.

-- 1. Alter Schema (DDL)
ALTER TABLE public.portador DROP COLUMN IF EXISTS caminho_remessa;
ALTER TABLE public.portador ADD COLUMN IF NOT EXISTS ativo character varying(1) DEFAULT 'S';

-- 2. Registro da Versão 1.18.15 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.15';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.15',
  'Ajustes no Cadastro de Portadores (Ativo e Remoção do Caminho de Remessa)',
  'Remoção da coluna caminho_remessa da tabela portador e da tela de cadastro. Inclusão da coluna ativo (character varying(1) com padrão S) a nível de banco e no formulário de cadastro, estilizado como checkbox padrão do sistema (accent-primary).',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
