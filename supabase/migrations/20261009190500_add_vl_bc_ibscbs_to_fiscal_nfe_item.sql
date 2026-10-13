-- Migration: 20261009190500_add_vl_bc_ibscbs_to_fiscal_nfe_item.sql
-- Description: Adiciona a coluna vl_bc_ibscbs em fiscal_nfe_item para a Base de Cálculo unificada de IBS/CBS/IS

ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS vl_bc_ibscbs numeric(15,2) DEFAULT 0 NOT NULL;
