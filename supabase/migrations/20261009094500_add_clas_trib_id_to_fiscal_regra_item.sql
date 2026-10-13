-- Migration: 20261009094500_add_clas_trib_id_to_fiscal_regra_item.sql
-- Description: Adiciona as colunas clas_trib_id, ibs_base_reducao e cbs_base_reducao na tabela public.fiscal_regra_item

ALTER TABLE public.fiscal_regra_item ADD COLUMN IF NOT EXISTS clas_trib_id character varying(20);
ALTER TABLE public.fiscal_regra_item ADD COLUMN IF NOT EXISTS ibs_base_reducao numeric DEFAULT 0;
ALTER TABLE public.fiscal_regra_item ADD COLUMN IF NOT EXISTS cbs_base_reducao numeric DEFAULT 0;
