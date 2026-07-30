-- Migration: 20260706165200_fix_consulta_titulos_matriz.sql
-- Description: Registers version 1.18.17 for matrix and branch filtering on title query.

-- 1. Registro da Versão 1.18.17 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.17';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.17',
  'Filtro de Matriz e Filiais na Consulta de Títulos',
  'Ajuste na tela de consulta de títulos a receber para exibir registros pertencentes estritamente ao grupo da matriz logada (empresa logada e suas filiais associadas) quando logado na matriz, e somente da própria filial quando logado em filial, impedindo a exibição de títulos de matrizes de terceiros.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
