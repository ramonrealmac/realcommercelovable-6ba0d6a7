-- Migration: 20260706162500_add_portador_to_movimento_pagamento.sql
-- Description: Adds portador_id column to movimento_pagamento and registers version 1.18.16.

-- 1. Alter Schema (DDL)
ALTER TABLE public.movimento_pagamento ADD COLUMN IF NOT EXISTS portador_id bigint;

-- 2. Registro da Versão 1.18.16 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.16';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.16',
  'Geração de Parcelas no Financeiro e Seleção de Portadores',
  'Adição do campo portador_id na tabela movimento_pagamento. Inclusão da combo de seleção do Portador na tela de Pagamento do Pedido (com filtro inteligente pelo meio de pagamento selecionado e pré-carregamento do portador padrão do cliente). Automação da geração de parcelas a receber na tabela financeiro no momento da finalização do pagamento, calculando as datas de vencimento com base no tipo de prazo (Fixo ou Variável) e com compensação de arredondamentos decimais.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
