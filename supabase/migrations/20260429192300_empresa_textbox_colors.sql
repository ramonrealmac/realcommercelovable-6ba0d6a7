-- ============================================================
-- Migration: Adiciona colunas de cores de textbox à tabela empresa
-- Data: 2026-04-29
-- Descrição: Permite customizar fundo do campo editável,
--            fundo do campo somente leitura, moldura/borda
--            e cor do label dos formulários por empresa.
-- ============================================================

ALTER TABLE empresa
  ADD COLUMN IF NOT EXISTS cor_input_fundo      TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS cor_input_readonly   TEXT DEFAULT '#F1F5F9',
  ADD COLUMN IF NOT EXISTS cor_input_borda      TEXT DEFAULT '#CBD5E1',
  ADD COLUMN IF NOT EXISTS cor_input_label      TEXT DEFAULT '#64748B';

COMMENT ON COLUMN empresa.cor_input_fundo    IS 'Cor de fundo dos campos editáveis (hex)';
COMMENT ON COLUMN empresa.cor_input_readonly IS 'Cor de fundo dos campos somente leitura (hex)';
COMMENT ON COLUMN empresa.cor_input_borda    IS 'Cor da moldura/borda dos campos (hex)';
COMMENT ON COLUMN empresa.cor_input_label    IS 'Cor dos labels/rótulos dos campos (hex)';
