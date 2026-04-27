ALTER TABLE public.funcionario
  ADD COLUMN IF NOT EXISTS tamanho_fonte_pedidos smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS tamanho_fonte_produtos smallint NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS tempo_refresh_pdv integer NOT NULL DEFAULT 30;

ALTER TABLE public.empresa
  ADD COLUMN IF NOT EXISTS imagem_caixa text NOT NULL DEFAULT '';