-- Migration: 20261009185000_add_ibs_est_mun_to_fiscal_nfe_item.sql
-- Description: Adiciona colunas pc_ibs_est, vl_ibs_est, pc_ibs_mun, vl_ibs_mun em fiscal_nfe_item para desmembramento do IBS Estadual e Municipal

ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS pc_ibs_est numeric(8,4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vl_ibs_est numeric(15,2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS pc_ibs_mun numeric(8,4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS vl_ibs_mun numeric(15,2) DEFAULT 0 NOT NULL;
