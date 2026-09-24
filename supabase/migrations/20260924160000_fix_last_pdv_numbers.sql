-- Migration: Fix nr_movimento for last PDV orders (movimento 306 and 307) for empresa 5
UPDATE movimento 
SET nr_movimento = 203, tp_operacao_id = 3, tp_movimento = 'SV' 
WHERE movimento_id = 306;

UPDATE movimento 
SET nr_movimento = 204, tp_operacao_id = 3, tp_movimento = 'SV' 
WHERE movimento_id = 307;

UPDATE caixa_movimento 
SET documento = '203', historico = 'Recebimento Pedido 203' 
WHERE movimento_id = 306;

UPDATE caixa_movimento 
SET documento = '204', historico = 'Recebimento Pedido 204' 
WHERE movimento_id = 307;

UPDATE sys_sequencial 
SET ult_seq = 204 
WHERE tabela = 'movimento' AND nm_campo1 = 'nr_movimento' AND nm_campo2 = '3' AND empresa_id = 5;
