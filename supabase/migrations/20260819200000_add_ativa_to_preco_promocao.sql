-- Migration: Adiciona coluna 'ativa' nas tabelas cadastro_preco e promocao
-- Flag booleana para indicar se o registro está ativo (true) ou inativo (false)

ALTER TABLE public.cadastro_preco
    ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.tabela_preco
    ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.promocao
    ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true;

