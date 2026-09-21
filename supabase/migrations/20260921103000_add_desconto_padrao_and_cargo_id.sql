-- Migration: 20260921103000_add_desconto_padrao_and_cargo_id.sql
-- Description: Adds desconto_padrao column to empresa and cargo_id column to funcionario table.

ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS desconto_padrao varchar(1) DEFAULT NULL;

ALTER TABLE public.funcionario ADD COLUMN IF NOT EXISTS cargo_id integer REFERENCES public.cargo(cargo_id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
