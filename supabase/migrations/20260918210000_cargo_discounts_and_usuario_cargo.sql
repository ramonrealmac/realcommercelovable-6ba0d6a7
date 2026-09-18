-- Migration: Add discount columns to cargo and cargo_id to profiles & funcionario

ALTER TABLE public.cargo ADD COLUMN IF NOT EXISTS pc_desc_maximo_av numeric(15,2) DEFAULT 0;
ALTER TABLE public.cargo ADD COLUMN IF NOT EXISTS pc_desc_maximo_prz numeric(15,2) DEFAULT 0;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo_id integer REFERENCES public.cargo(cargo_id);
ALTER TABLE public.funcionario ADD COLUMN IF NOT EXISTS cargo_id integer REFERENCES public.cargo(cargo_id);
