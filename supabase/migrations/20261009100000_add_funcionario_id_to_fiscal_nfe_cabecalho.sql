-- Migration: 20261009100000_add_funcionario_id_to_fiscal_nfe_cabecalho.sql
-- Description: Adiciona a coluna funcionario_id (Vendedor) na tabela public.fiscal_nfe_cabecalho

ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN IF NOT EXISTS funcionario_id bigint;
