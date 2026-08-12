-- Migration: Adiciona campos endereco_compl_entrega e pto_ref_entrega na tabela movimento
-- Posicionados na aba "Dados de Entrega" do formulário de pedidos, antes do campo email_entrega

ALTER TABLE movimento
  ADD COLUMN IF NOT EXISTS endereco_compl_entrega VARCHAR(60) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pto_ref_entrega VARCHAR(80) DEFAULT NULL;

COMMENT ON COLUMN movimento.endereco_compl_entrega IS 'Complemento do endereço de entrega';
COMMENT ON COLUMN movimento.pto_ref_entrega IS 'Ponto de referência do endereço de entrega';
