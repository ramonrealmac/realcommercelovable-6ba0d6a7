
-- Adicionar campo vl_troco na tabela caixa_movimento
ALTER TABLE public.caixa_movimento 
ADD COLUMN IF NOT EXISTS vl_troco NUMERIC(18,2) DEFAULT 0;
