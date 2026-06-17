-- Migration: 20260616162100_add_version_estoque_adjustments.sql
-- Registra a nova versão do sistema com as melhorias da tela de Estoques

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.15.0',
  'Ajuste na Tela de Estoques e Ordenação no Grid',
  'Ajustada a tela de estoques para separar a coluna única de produto em duas colunas distintas: Código (exibindo cd_produto) e Descrição (exibindo a descrição correspondente). Corrigido bug de carregamento limitante onde itens de estoque apareciam com nome/código vazios devido à paginação de 1.000 registros do Supabase. Implementado o suporte a ordenação de coluna única ativa e ícones de ordenação em branco permanente no componente DataGrid.',
  'Antigravity',
  'Fase 15',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'SQL/Migrations'],
  now()
);
