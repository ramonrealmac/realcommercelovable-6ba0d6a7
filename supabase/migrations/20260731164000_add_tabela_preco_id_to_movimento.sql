-- Migration: Add tabela_preco_id to movimento table
ALTER TABLE public.movimento 
ADD COLUMN IF NOT EXISTS tabela_preco_id INTEGER REFERENCES public.tabela_preco(tabela_id) ON DELETE SET NULL;
