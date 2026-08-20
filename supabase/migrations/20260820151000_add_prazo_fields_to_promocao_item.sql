-- Adicionar campos de desconto/preço a prazo na tabela promocao_item
ALTER TABLE public.promocao_item
  ADD COLUMN IF NOT EXISTS percentual_desconto_prazo numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto_prazo numeric(15,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_promocional_prazo numeric(15,4) DEFAULT 0;
