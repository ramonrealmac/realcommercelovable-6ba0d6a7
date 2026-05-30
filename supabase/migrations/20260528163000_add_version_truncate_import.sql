-- Migration: 20260528163000_add_version_truncate_import.sql
-- Insere registro da nova versão contendo a melhoria de truncamento de caracteres na importação

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.1',
  'Truncamento Automático de Campos na Importação de CSV',
  'Adicionado suporte ao truncamento automático de dados de origem (CSV) que excedem o tamanho máximo dos campos de destino do banco de dados (colunas varchar/character varying).' || chr(10) || chr(10) || 'Esta melhoria previne erros de gravação e inconsistências, aplicando a regra de truncamento tanto no processo de importação quanto na pré-visualização das tabelas de Cadastro, Produtos, Veículos, Financeiro, Movimentos e demais entidades de forma integrada.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
