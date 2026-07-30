-- Migration: 20260715160000_add_obs_fisco_to_cabecalho.sql
-- Description: Adiciona coluna obs_fisco na tabela fiscal_nfe_cabecalho

ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN IF NOT EXISTS obs_fisco text DEFAULT ''::text NOT NULL;
COMMENT ON COLUMN public.fiscal_nfe_cabecalho.obs_fisco IS 'Observações de Interesse do Fisco (infAdFisco)';
