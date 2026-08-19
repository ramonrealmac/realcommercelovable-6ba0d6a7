-- Migration: 20260819130000_create_promocao.sql

-- Create promocao table
CREATE TABLE IF NOT EXISTS public.promocao (
    promocao_id SERIAL PRIMARY KEY,
    cd_promocao INTEGER NOT NULL,
    empresa_id INTEGER NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    dt_inicial VARCHAR(30),
    dt_final VARCHAR(30),
    excluido BOOLEAN DEFAULT false,
    dt_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    dt_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on promocao
ALTER TABLE public.promocao ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS promocao_all_authenticated ON public.promocao;

-- Create policy for promocao
CREATE POLICY promocao_all_authenticated ON public.promocao
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create promocao_item table
CREATE TABLE IF NOT EXISTS public.promocao_item (
    promocao_item_id SERIAL PRIMARY KEY,
    promocao_id INTEGER NOT NULL REFERENCES public.promocao(promocao_id) ON DELETE CASCADE,
    produto_id INTEGER NOT NULL,
    cd_produto VARCHAR(50),
    nm_produto VARCHAR(255) NOT NULL,
    preco_base NUMERIC(15, 4) NOT NULL DEFAULT 0.00,
    percentual_desconto NUMERIC(15, 4) NOT NULL DEFAULT 0.00,
    valor_desconto NUMERIC(15, 4) NOT NULL DEFAULT 0.00,
    valor_promocional NUMERIC(15, 4) NOT NULL DEFAULT 0.00,
    excluido BOOLEAN DEFAULT false,
    dt_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    dt_alteracao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on promocao_item
ALTER TABLE public.promocao_item ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS promocao_item_all_authenticated ON public.promocao_item;

-- Create policy for promocao_item
CREATE POLICY promocao_item_all_authenticated ON public.promocao_item
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
