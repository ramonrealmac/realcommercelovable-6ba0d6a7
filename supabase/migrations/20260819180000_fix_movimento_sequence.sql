-- ============================================================
-- Migration: Fix movimento_id sequence desync (duplicate key error)
-- Problema: a sequence movimento_movimento_id_seq está atrás do
--           maior movimento_id existente na tabela, causando
--           "duplicate key value violates unique constraint movimento_pkey"
--           quando o Postgres tenta usar o próximo valor da sequence.
-- Solução: ressincronizar a sequence para MAX(movimento_id) + 1.
-- ============================================================

-- Ressincroniza a sequence de movimento_id
SELECT setval(
  pg_get_serial_sequence('public.movimento', 'movimento_id'),
  COALESCE((SELECT MAX(movimento_id) FROM public.movimento), 0) + 1,
  false
);

-- Verifica também tabelas relacionadas que podem ter o mesmo problema
SELECT setval(
  pg_get_serial_sequence('public.movimento_item', 'movimento_item_id'),
  COALESCE((SELECT MAX(movimento_item_id) FROM public.movimento_item), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('public.movimento_pagamento', 'movimento_pagamento_id'),
  COALESCE((SELECT MAX(movimento_pagamento_id) FROM public.movimento_pagamento), 0) + 1,
  false
);
