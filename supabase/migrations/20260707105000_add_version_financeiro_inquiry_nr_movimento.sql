-- Migration: 20260707105000_add_version_financeiro_inquiry_nr_movimento.sql
-- Description: Registers version 1.18.20 for matrix titles inquiry search by order number.

-- 1. Registro da Versão 1.18.20 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.20';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.20',
  'Consulta de Títulos - Filtro por Número de Pedido',
  'Implementação de filtro adicional por número do pedido na tela de Consulta de Títulos a Receber:' || chr(10) || chr(10) ||
  '• Campo Nº Pedido: Inclusão do campo de busca no painel de filtros, realizando a pesquisa indexada e cruzando as tabelas movimento e financeiro_view por movimento_id.' || chr(10) ||
  '• Ajuste de Layout: Redimensionamento e realinhamento em CSS Grid para acomodar o campo Nº Pedido de forma responsiva ao lado do campo de Cliente.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
