-- Migration: 20260918182500_add_pc_desc_maximo_to_products_groups_subgroups_lines.sql
-- Descrição: Adiciona o campo pc_desc_maximo em produto, produto_grupo, produto_subgrupo e linha_produto

ALTER TABLE public.produto 
  ADD COLUMN IF NOT EXISTS pc_desc_maximo numeric(15,2) DEFAULT 0 NOT NULL;

UPDATE public.produto 
SET pc_desc_maximo = 0 
WHERE pc_desc_maximo IS NULL;

ALTER TABLE public.produto_grupo 
  ADD COLUMN IF NOT EXISTS pc_desc_maximo numeric(15,2) DEFAULT 0 NOT NULL;

UPDATE public.produto_grupo 
SET pc_desc_maximo = 0 
WHERE pc_desc_maximo IS NULL;

ALTER TABLE public.produto_subgrupo 
  ADD COLUMN IF NOT EXISTS pc_desc_maximo numeric(15,2) DEFAULT 0 NOT NULL;

UPDATE public.produto_subgrupo 
SET pc_desc_maximo = 0 
WHERE pc_desc_maximo IS NULL;

ALTER TABLE public.linha_produto 
  ADD COLUMN IF NOT EXISTS pc_desc_maximo numeric(15,2) DEFAULT 0 NOT NULL;

UPDATE public.linha_produto 
SET pc_desc_maximo = 0 
WHERE pc_desc_maximo IS NULL;
