ALTER TABLE public.funcionario
  ADD COLUMN IF NOT EXISTS caixa_edit_venda character varying(1) NOT NULL DEFAULT 'N';

ALTER TABLE public.movimento
  ADD COLUMN IF NOT EXISTS dt_cancelamento timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS mot_cancelamento text NOT NULL DEFAULT '';