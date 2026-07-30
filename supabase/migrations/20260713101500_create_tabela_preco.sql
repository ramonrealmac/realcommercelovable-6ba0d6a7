-- Migration: 20260713101500_create_tabela_preco.sql

-- Create tabela_preco table
CREATE TABLE IF NOT EXISTS public.tabela_preco (
    tabela_id SERIAL PRIMARY KEY,
    cd_tabela INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    dt_inicial VARCHAR(30),
    dt_final VARCHAR(30),
    excluido BOOLEAN DEFAULT false,
    dt_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    dt_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on tabela_preco
ALTER TABLE public.tabela_preco ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS tabela_preco_all_authenticated ON public.tabela_preco;

-- Create policy for tabela_preco
CREATE POLICY tabela_preco_all_authenticated ON public.tabela_preco
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create tabela_preco_item table
CREATE TABLE IF NOT EXISTS public.tabela_preco_item (
    tabela_item_id SERIAL PRIMARY KEY,
    tabela_id INTEGER NOT NULL REFERENCES public.tabela_preco(tabela_id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL,
    cd_produto VARCHAR(50),
    nm_produto VARCHAR(255) NOT NULL,
    preco NUMERIC(15, 4) NOT NULL DEFAULT 0.00,
    excluido BOOLEAN DEFAULT false,
    dt_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    dt_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on tabela_preco_item
ALTER TABLE public.tabela_preco_item ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS tabela_preco_item_all_authenticated ON public.tabela_preco_item;

-- Create policy for tabela_preco_item
CREATE POLICY tabela_preco_item_all_authenticated ON public.tabela_preco_item
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
