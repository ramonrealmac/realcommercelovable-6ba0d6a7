-- Migration: 20260820100000_resync_movimento_sequences.sql
-- Problema: duplicate key value violates unique constraint "movimento_pkey"
-- Causa: a sequence movimento_movimento_id_seq está atrás do maior ID existente
--        (ocorre quando há importações manuais ou inserts diretos no banco).
-- Solução: ressincronizar todas as sequences de movimento para MAX(id) atual.
-- Observação: setval é idempotente; pode ser executado múltiplas vezes sem efeito colateral.

-- Ressincronia do movimento_id
SELECT setval(
  'movimento_movimento_id_seq',
  COALESCE((SELECT MAX(movimento_id) FROM public.movimento), 1)
);

-- Ressincronia do movimento_item_id
SELECT setval(
  'movimento_item_movimento_item_id_seq',
  COALESCE((SELECT MAX(movimento_item_id) FROM public.movimento_item), 1)
);

-- Ressincronia do movimento_pagamento_id
SELECT setval(
  'movimento_pagamento_movimento_pagamento_id_seq',
  COALESCE((SELECT MAX(movimento_pagamento_id) FROM public.movimento_pagamento), 1)
);
