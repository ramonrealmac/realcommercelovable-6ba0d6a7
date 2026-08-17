-- Migration: 20260813153000_resync_caixa_movimento_item_sequence.sql
-- Description: Sincroniza a sequence caixa_movimento_item_caixa_movimento_item_id_seq e demais sequences de movimento/caixa com o maior ID existente na tabela, evitando erro de duplicate key no recebimento de pedidos no PDV.

SELECT setval('caixa_movimento_item_caixa_movimento_item_id_seq', (SELECT COALESCE(MAX(caixa_movimento_item_id), 1) FROM public.caixa_movimento_item));
SELECT setval('caixa_movimento_caixa_movimento_id_seq', (SELECT COALESCE(MAX(caixa_movimento_id), 1) FROM public.caixa_movimento));
SELECT setval('caixa_abertura_caixa_abertura_id_seq', (SELECT COALESCE(MAX(caixa_abertura_id), 1) FROM public.caixa_abertura));
SELECT setval('movimento_pagamento_movimento_pagamento_id_seq', (SELECT COALESCE(MAX(movimento_pagamento_id), 1) FROM public.movimento_pagamento));
SELECT setval('financeiro_financeiro_id_seq', (SELECT COALESCE(MAX(financeiro_id), 1) FROM public.financeiro));
SELECT setval('financeiro_baixa_financeiro_baixa_id_seq', (SELECT COALESCE(MAX(financeiro_baixa_id), 1) FROM public.financeiro_baixa));
SELECT setval('movimento_movimento_id_seq', (SELECT COALESCE(MAX(movimento_id), 1) FROM public.movimento));
SELECT setval('movimento_item_movimento_item_id_seq', (SELECT COALESCE(MAX(movimento_item_id), 1) FROM public.movimento_item));
