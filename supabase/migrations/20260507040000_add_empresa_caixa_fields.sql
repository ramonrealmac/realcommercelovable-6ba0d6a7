-- Campos de Integração AbacatePay
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS abacatepay_api_key character varying(255) DEFAULT '';
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS abacatepay_webhook_secret character varying(255) DEFAULT '';
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS abacatepay_webhook_url character varying(255) DEFAULT '';

-- Campos de Configuração do Caixa / PDV / Estoque
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS centro_custo_caixa integer DEFAULT 0;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS conta_gerencial_caixa integer;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS deposito_estoque_caixa integer DEFAULT 0;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS empresa_deposito_caixa integer;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS tp_operacao_caixa integer DEFAULT 0;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS imagem_caixa text DEFAULT '';
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS valida_estoque character varying(50) DEFAULT '';

-- Novos campos visuais inseridos no default mas possivelmente ausentes
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS cor_input_label character varying(50) DEFAULT '#64748B';
