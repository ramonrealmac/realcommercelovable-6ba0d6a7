-- Migration: 20260707155500_add_version_financeiro_confirm_buttons_swap.sql
-- Description: Registers version 1.18.26 for financeiro double confirmation modal buttons swap (Sim first, Não second).

-- 1. Registro da Versão 1.18.26 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.26';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.26',
  'Consulta de Títulos - Botões de Confirmação Ordenados',
  'Ajustes de interface e harmonia visual no modal de confirmação de ações de títulos:' || chr(10) || chr(10) ||
  '• Ordem de Confirmação: Reordenação dos botões no modal de aviso de segurança para exibir primeiro a opção de confirmação positiva ("Sim") e depois a opção de recuo ("Não").',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
