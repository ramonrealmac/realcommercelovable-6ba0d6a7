ALTER TABLE public.fiscal_config_item
  ADD COLUMN IF NOT EXISTS tp_imp_nfce VARCHAR(20) DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS tp_imp_nfe  VARCHAR(20) DEFAULT 'PDF',
  ADD COLUMN IF NOT EXISTS nm_impressora_nfce VARCHAR(120),
  ADD COLUMN IF NOT EXISTS nm_impressora_nfe  VARCHAR(120);

COMMENT ON COLUMN public.fiscal_config_item.tp_imp_nfce IS 'PDF | IMPRESSORA | NAO_IMPRIME';
COMMENT ON COLUMN public.fiscal_config_item.tp_imp_nfe  IS 'PDF | IMPRESSORA | NAO_IMPRIME';