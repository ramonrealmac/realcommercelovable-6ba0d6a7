-- Migration: Add pc_desc_maximo_av and pc_desc_maximo_prz to produto, produto_grupo, produto_subgrupo, linha_produto

ALTER TABLE public.linha_produto ADD COLUMN IF NOT EXISTS pc_desc_maximo_av numeric(15,2) DEFAULT 0;
ALTER TABLE public.linha_produto ADD COLUMN IF NOT EXISTS pc_desc_maximo_prz numeric(15,2) DEFAULT 0;

ALTER TABLE public.produto_grupo ADD COLUMN IF NOT EXISTS pc_desc_maximo_av numeric(15,2) DEFAULT 0;
ALTER TABLE public.produto_grupo ADD COLUMN IF NOT EXISTS pc_desc_maximo_prz numeric(15,2) DEFAULT 0;

ALTER TABLE public.produto_subgrupo ADD COLUMN IF NOT EXISTS pc_desc_maximo_av numeric(15,2) DEFAULT 0;
ALTER TABLE public.produto_subgrupo ADD COLUMN IF NOT EXISTS pc_desc_maximo_prz numeric(15,2) DEFAULT 0;

ALTER TABLE public.produto ADD COLUMN IF NOT EXISTS pc_desc_maximo_av numeric(15,2) DEFAULT 0;
ALTER TABLE public.produto ADD COLUMN IF NOT EXISTS pc_desc_maximo_prz numeric(15,2) DEFAULT 0;
