-- Migration to set correct tp_operacao_caixa for empresa_id = 5 and fix existing movimento records
UPDATE empresa 
SET tp_operacao_caixa = 3 
WHERE empresa_id = 5 AND (tp_operacao_caixa IS NULL OR tp_operacao_caixa = 1);

UPDATE movimento 
SET tp_operacao_id = 3 
WHERE empresa_id = 5 AND (tp_operacao_id = 1 OR tp_operacao_id IS NULL);
