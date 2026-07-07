-- Migration: 20260706090500_remove_cd_condicao.sql
-- Description: Remove a coluna cd_condicao da tabela condicao_pagamento e registra a versão 1.18.12 com os ajustes de condições de pagamento

-- 1. Alteração de Schema (DDL)
ALTER TABLE public.condicao_pagamento DROP COLUMN IF EXISTS cd_condicao;

-- 2. Registro da Versão 1.18.12 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.12';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.12',
  'Ajustes em Condições de Pagamento, Meios de Pagamento e Tecla Enter',
  'Remoção da coluna legada cd_condicao da tabela condicao_pagamento. Atualização da exibição de código para cd_condicao_pagamento (com auto-incremento de código ao salvar no cadastro). Adição do combo de Meios de Pagamento e do campo Empresa na mesma linha de cadastro. Conversão de dropdowns para select nativo do HTML para atalhos de teclado (Alt+Seta Baixo para abrir e Seta Cima/Baixo para navegar fechado) e navegação com foco automático utilizando a tecla Enter.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
