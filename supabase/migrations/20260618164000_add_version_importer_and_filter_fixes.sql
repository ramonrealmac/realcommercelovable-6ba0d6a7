-- Migration: 20260618164000_add_version_importer_and_filter_fixes.sql
-- Registra a nova versão do sistema com as correções do importador, filtros e inicialização de depósito

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.16.0',
  'Correção no Importador, Filtros Exatos e Paginação de Depósito',
  'Corrigida a importação de produtos para substituir nulos por strings vazias em campos com restrição NOT NULL no banco. Implementado suporte a fórmulas de tradução compostas baseadas em Grupo+Subgrupo no importador. Ajustada a filtragem dos grids para usar busca exata (=) em colunas de códigos (cd_*) e IDs (*_id), exceto unidade_id. Corrigida a inicialização de depósito para paginar consultas de produtos e estoques e carregar além do limite de 1.000 registros.',
  'Antigravity',
  'Fase 16',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'SQL/Migrations'],
  now()
);
