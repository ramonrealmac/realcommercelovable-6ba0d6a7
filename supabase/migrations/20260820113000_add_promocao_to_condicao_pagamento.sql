-- Migration: 20260820113000_add_promocao_to_condicao_pagamento.sql
-- Descrição: Adiciona o campo promocao na tabela condicao_pagamento com os valores N (NÃO), V (A VISTA) e P (A PRAZO). Todas as condições existentes recebem N.

ALTER TABLE public.condicao_pagamento 
  ADD COLUMN IF NOT EXISTS promocao character varying(1) DEFAULT 'N' NOT NULL;

-- Atualiza todas as condições existentes na tabela com o valor 'N'
UPDATE public.condicao_pagamento 
SET promocao = 'N' 
WHERE promocao IS NULL OR promocao = '';
