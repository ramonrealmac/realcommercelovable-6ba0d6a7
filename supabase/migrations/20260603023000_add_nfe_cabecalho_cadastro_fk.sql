-- Migration: 20260603023000_add_nfe_cabecalho_cadastro_fk.sql
-- Adiciona a restrição de chave estrangeira entre fiscal_nfe_cabecalho(cadastro_id) e cadastro(cadastro_id)

ALTER TABLE public.fiscal_nfe_cabecalho 
ADD CONSTRAINT fiscal_nfe_cabecalho_cadastro_id_fkey 
FOREIGN KEY (cadastro_id) 
REFERENCES public.cadastro(cadastro_id);
