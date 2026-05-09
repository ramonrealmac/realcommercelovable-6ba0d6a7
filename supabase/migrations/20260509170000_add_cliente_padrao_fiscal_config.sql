-- Migration to add cliente_padrao_id to fiscal_config
ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS cliente_padrao_id integer REFERENCES public.cadastro(cadastro_id);

COMMENT ON COLUMN public.fiscal_config.cliente_padrao_id IS 'Cliente padrão utilizado para vendas no PDV quando não identificado.';
