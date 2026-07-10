-- Migration: 20260707152000_add_version_financeiro_baixa_formatting.sql
-- Description: Registers version 1.18.23 for financeiro baixa formatting, dynamic values recalculation, and recipes-only account plan.

-- 1. Registro da Versão 1.18.23 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.23';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.23',
  'Consulta de Títulos - Melhorias na Baixa de Títulos',
  'Melhorias de usabilidade e consistência financeira no modal de Baixar Título:' || chr(10) || chr(10) ||
  '• Formatadores e Alinhamento: Campos de valor formatados no padrão de centavos progressivos (0,01 -> 0,10 -> 1,00) e alinhados à direita.' || chr(10) ||
  '• Regras de Cálculos Dinâmicos: O valor pago maior gera acréscimos/juros automaticamente; menor gera descontos. A digitação direta de desconto ou juros recalcula o valor pago.' || chr(10) ||
  '• Data de Pagamento: Ajuste do ano da data de pagamento para no máximo 4 dígitos.' || chr(10) ||
  '• Plano de Contas Filtrado: Combo de contas restrito apenas a contas de receita analíticas (tp_natureza = ''R'' e tp_conta = ''A'') que aceitam lançamentos.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
