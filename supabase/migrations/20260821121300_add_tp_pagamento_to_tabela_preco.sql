-- Migration: Add tp_pagamento to tabela_preco
ALTER TABLE public.tabela_preco ADD COLUMN IF NOT EXISTS tp_pagamento VARCHAR(1) DEFAULT 'V';
