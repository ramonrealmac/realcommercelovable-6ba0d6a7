-- Migration: 20261009141500_add_pc_desconto_to_fiscal_nfe_item.sql
-- Description: Adiciona coluna pc_desconto na tabela fiscal_nfe_item

ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS pc_desconto numeric(8,4) DEFAULT 0 NOT NULL;
