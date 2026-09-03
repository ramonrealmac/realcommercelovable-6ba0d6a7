-- Migration: Add tp_preco_padrao to movimento table for default pricing (V = À Vista, P = A Prazo)
ALTER TABLE public.movimento 
ADD COLUMN IF NOT EXISTS tp_preco_padrao VARCHAR(1) DEFAULT 'V';
