-- Migration: Adiciona campo obs_entrega (texto multilinha) na tabela movimento
-- Posicionado na aba "Dados de Entrega" do formulário de pedidos, após o campo email_entrega

ALTER TABLE movimento
  ADD COLUMN IF NOT EXISTS obs_entrega TEXT DEFAULT NULL;

COMMENT ON COLUMN movimento.obs_entrega IS 'Observações sobre a entrega (texto livre, multilinha)';
