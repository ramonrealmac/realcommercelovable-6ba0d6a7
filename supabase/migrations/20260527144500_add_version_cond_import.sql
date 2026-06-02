-- Migration: 20260527144500_add_version_cond_import.sql
-- Insere registro da nova versão contendo a melhoria das fórmulas de tradução na importação

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.0',
  'Fórmulas de Tradução na Importação de CSV',
  'Adicionado suporte a fórmulas condicionais de tradução diretamente na configuração de valor complementar de cada coluna (ex: cond:MASCULINO=M,FEMININO=F).' || chr(10) || chr(10) || 'Renomeado o módulo de importação de "Clientes" para "Cadastro" para englobar todas as entidades de parceiros (Clientes, Fornecedores e Transportadoras) de forma integrada, mantendo a compatibilidade de perfis salvos.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'TailwindCSS', 'Supabase']
);
