-- Migration: 20260707154500_add_version_financeiro_pago_autoselect.sql
-- Description: Registers version 1.18.25 for financeiro baixa valor pago input autofocus and autoselect behavior.

-- 1. Registro da Versão 1.18.25 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.25';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.25',
  'Consulta de Títulos - Autofoco e Seleção do Valor Pago',
  'Aprimoramentos de usabilidade e digitação ágil ao abrir o diálogo de Baixa de Títulos:' || chr(10) || chr(10) ||
  '• Autofoco Automático: Foco direcionado programaticamente para o campo de entrada do Valor Pago no instante em que o modal de baixa é montado.' || chr(10) ||
  '• Seleção Completa (Autoselect): Seleção imediata de todo o texto pré-preenchido do input de Valor Pago, permitindo a substituição instantânea do valor sem necessidade de apagar manualmente caractere por caractere.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
