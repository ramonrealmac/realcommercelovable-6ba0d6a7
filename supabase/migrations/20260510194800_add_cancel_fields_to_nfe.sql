-- Adiciona campos de cancelamento à tabela fiscal_nfe_cabecalho
ALTER TABLE fiscal_nfe_cabecalho ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;
ALTER TABLE fiscal_nfe_cabecalho ADD COLUMN IF NOT EXISTS protocolo_cancelamento TEXT;
ALTER TABLE fiscal_nfe_cabecalho ADD COLUMN IF NOT EXISTS dt_cancelamento TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN fiscal_nfe_cabecalho.motivo_cancelamento IS 'Justificativa para o cancelamento da nota (mínimo 15 caracteres)';
COMMENT ON COLUMN fiscal_nfe_cabecalho.protocolo_cancelamento IS 'Número do protocolo de homologação do cancelamento pela SEFAZ';
COMMENT ON COLUMN fiscal_nfe_cabecalho.dt_cancelamento IS 'Data e hora em que o cancelamento foi processado';
