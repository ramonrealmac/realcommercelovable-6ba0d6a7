-- Migration: 20261009182000_add_ibscbs_clas_trib_to_fiscal_nfe_item.sql
-- Description: Adiciona colunas clas_trib_id, pc_red_bc_ibs e pc_red_bc_cbs a fiscal_nfe_item

ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS clas_trib_id character(6),
  ADD COLUMN IF NOT EXISTS pc_red_bc_ibs numeric(8,4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS pc_red_bc_cbs numeric(8,4) DEFAULT 0 NOT NULL;
