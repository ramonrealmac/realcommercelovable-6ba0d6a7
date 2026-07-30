-- Migration: 20260724133000_add_cfop_correspondente_to_cfop.sql
-- Description: Adds cfop_correspondente and descricao_correspondente columns to cfop table.

ALTER TABLE public.cfop ADD COLUMN cfop_correspondente varchar(10);
ALTER TABLE public.cfop ADD COLUMN descricao_correspondente varchar(255);
