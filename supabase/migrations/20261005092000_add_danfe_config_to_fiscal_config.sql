-- Migration: Adicionar campos de configuração do DANFE (NFe e NFCe) na tabela fiscal_config
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS danfe_tipo character varying(10) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS danfe_pos_canhoto character varying(10) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS danfe_exibe_resumo_canhoto boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS danfe_path_logo text DEFAULT '',
  ADD COLUMN IF NOT EXISTS danfe_logo_em_cima boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS danfe_expande_logo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS danfe_fonte_nome character varying(50) DEFAULT 'Arial',
  ADD COLUMN IF NOT EXISTS danfe_fonte_tamanho integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS danfe_casas_qcom integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS danfe_casas_vuncom integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS danfe_exibe_info_adic boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS nfce_modo_impressao character varying(20) DEFAULT 'FORTES_BOBINA',
  ADD COLUMN IF NOT EXISTS nfce_largura_bobina integer DEFAULT 302,
  ADD COLUMN IF NOT EXISTS nfce_imprime_duas_linhas boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfce_qr_lateral boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfce_via_consumidor boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nfce_imprime_itens boolean DEFAULT true;

COMMENT ON COLUMN public.fiscal_config.danfe_tipo IS '0=Retrato, 1=Paisagem, 2=Simplificado';
COMMENT ON COLUMN public.fiscal_config.danfe_pos_canhoto IS '0=Topo, 1=Rodapé, 2=Sem Canhoto';
COMMENT ON COLUMN public.fiscal_config.nfce_modo_impressao IS 'FORTES_BOBINA, ESCPOS, FORTES_A4, RESUMIDO';
