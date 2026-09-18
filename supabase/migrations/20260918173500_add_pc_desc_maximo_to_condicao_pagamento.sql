-- Migration: 20260918173500_add_pc_desc_maximo_to_condicao_pagamento.sql
-- Descrição: Adiciona o campo pc_desc_maximo na tabela condicao_pagamento com valor padrão 0.

ALTER TABLE public.condicao_pagamento 
  ADD COLUMN IF NOT EXISTS pc_desc_maximo numeric(15,2) DEFAULT 0 NOT NULL;

-- Atualiza todas as condições existentes na tabela com o valor 0 caso estejam nulas
UPDATE public.condicao_pagamento 
SET pc_desc_maximo = 0 
WHERE pc_desc_maximo IS NULL;
