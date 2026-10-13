-- Migration: 20261009093500_clear_existing_mod_bc_defaults.sql
-- Description: Limpa os valores legados 3 e 4 das colunas mod_bc e mod_bc_st na tabela public.fiscal_regra_item deixando-os nulos (em branco) por padrão

UPDATE public.fiscal_regra_item
SET mod_bc = NULL, mod_bc_st = NULL
WHERE mod_bc = 3 OR mod_bc_st = 4;
