-- Migration: 20260528170600_add_version_subgrupos_produtos.sql
-- Insere registro da nova versão contendo a tela de cadastro e menu de subgrupos de produtos

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.2',
  'Cadastro de Subgrupos de Produtos e Integração de Menu',
  'Implementada a tela de Cadastro de Subgrupos de Produtos em conformidade com o padrão geral do sistema (StandardCrudForm).' || chr(10) || chr(10) || 'Adicionado o novo atalho "Subgrupos de Produtos" sob a categoria de Produtos na barra lateral de cadastros. A tela inclui o carregamento dinâmico dos grupos pais no select dropdown e mapeamento local dos nomes para possibilitar filtros e ordenações em tempo real na grid de pesquisa.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
