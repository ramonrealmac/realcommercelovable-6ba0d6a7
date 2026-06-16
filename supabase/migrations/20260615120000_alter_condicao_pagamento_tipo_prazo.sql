-- Altera a coluna tipo_prazo de VARCHAR(1) para VARCHAR(2)
-- para suportar os códigos de meio de pagamento NF-e (01, 02, ..., 99)
ALTER TABLE condicao_pagamento
  ALTER COLUMN tipo_prazo TYPE character varying(2);
