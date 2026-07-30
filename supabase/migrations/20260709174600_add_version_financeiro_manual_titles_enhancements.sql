-- Migration: 20260709174600_add_version_financeiro_manual_titles_enhancements.sql
-- Description: Registers version 1.18.31 for the visual, structural, and behavioral improvements in manual title registration and filter queries.

-- 1. Registro da Versão 1.18.31 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.31';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.31',
  'Contas a Receber - Melhorias nos Títulos Manuais e Filtros',
  'Implementada a reestruturação da tela de Títulos Emitidos em 4 linhas com campos de valores agrupados em tamanho igual e alinhados à direita. Adicionada a navegação por tecla Enter pelos campos ativos. Configurado o filtro do Plano de Contas para listar apenas receitas analíticas e o tipo de natureza para R (Receita) e D (Despesa). Integrada a busca de clientes via diálogo de pesquisa (com atalhos Enter para pesquisar, limpador de seleção e foco automático no meio de pagamento). Bloqueada a edição de títulos com status PAGTO PARCIAL. Adicionada máscara monetária (0,01, 0,10, 1,00) de digitação no campo Valor Título. Incluído o filtro por Nº Título (documento) na tela de consulta de títulos.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
