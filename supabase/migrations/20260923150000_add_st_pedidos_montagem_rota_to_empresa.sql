-- Migration to add st_pedidos_montagem_rota column to empresa table
ALTER TABLE empresa 
ADD COLUMN IF NOT EXISTS st_pedidos_montagem_rota VARCHAR(1) DEFAULT 'R';

COMMENT ON COLUMN empresa.st_pedidos_montagem_rota IS 'Define o filtro de pedidos para montagem de rota: R = RECEBIDOS NO CAIXA, N = NÃO RECEBIDOS NO CAIXA';
