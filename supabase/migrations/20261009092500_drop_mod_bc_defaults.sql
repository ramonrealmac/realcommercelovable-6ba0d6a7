-- Migration: 20261009092500_drop_mod_bc_defaults.sql
-- Description: Remove os valores default 3 e 4 das colunas mod_bc e mod_bc_st da tabela public.fiscal_regra_item

ALTER TABLE public.fiscal_regra_item ALTER COLUMN mod_bc DROP DEFAULT;
ALTER TABLE public.fiscal_regra_item ALTER COLUMN mod_bc_st DROP DEFAULT;

ALTER TABLE public.fiscal_regra_item ALTER COLUMN mod_bc SET DEFAULT NULL;
ALTER TABLE public.fiscal_regra_item ALTER COLUMN mod_bc_st SET DEFAULT NULL;
