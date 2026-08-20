-- Migration: 20260820110000_fn_get_proximo_nr_movimento.sql
-- Descrição: Função atômica para geração de nr_movimento via sys_sequencial e ressincronia de sequences de chaves primárias.

-- 1. Ressincronização de sequences das PKs
SELECT setval(
  'movimento_movimento_id_seq',
  COALESCE((SELECT MAX(movimento_id) FROM public.movimento), 1)
);

SELECT setval(
  'movimento_item_movimento_item_id_seq',
  COALESCE((SELECT MAX(movimento_item_id) FROM public.movimento_item), 1)
);

SELECT setval(
  'movimento_pagamento_movimento_pagamento_id_seq',
  COALESCE((SELECT MAX(movimento_pagamento_id) FROM public.movimento_pagamento), 1)
);

-- 2. Função atômica get_proximo_nr_movimento
CREATE OR REPLACE FUNCTION public.get_proximo_nr_movimento(p_empresa_id integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_next bigint;
  v_max_atual bigint;
BEGIN
  IF p_empresa_id IS NULL OR p_empresa_id <= 0 THEN
    p_empresa_id := 1;
  END IF;

  -- Se a empresa ainda não tem registro no sys_sequencial para o nr_movimento, inicializa com o maior valor existente no banco
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_sequencial
    WHERE empresa_id = p_empresa_id
      AND tabela = 'movimento'
      AND nm_campo1 = 'nr_movimento'
      AND nm_campo2 = ''
  ) THEN
    SELECT COALESCE(MAX(nr_movimento), 0) INTO v_max_atual
    FROM public.movimento
    WHERE empresa_id = p_empresa_id;

    INSERT INTO public.sys_sequencial (empresa_id, tabela, nm_campo1, nm_campo2, ult_seq)
    VALUES (p_empresa_id, 'movimento', 'nr_movimento', '', v_max_atual)
    ON CONFLICT (empresa_id, tabela, nm_campo1, nm_campo2) DO NOTHING;
  END IF;

  -- Incrementa e retorna de forma atômica
  UPDATE public.sys_sequencial
  SET ult_seq = COALESCE(ult_seq, 0) + 1
  WHERE empresa_id = p_empresa_id
    AND tabela = 'movimento'
    AND nm_campo1 = 'nr_movimento'
    AND nm_campo2 = ''
  RETURNING ult_seq INTO v_next;

  -- Fallback de segurança se v_next for nulo
  IF v_next IS NULL THEN
    SELECT COALESCE(MAX(nr_movimento), 0) + 1 INTO v_next
    FROM public.movimento
    WHERE empresa_id = p_empresa_id;
  END IF;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer) TO service_role;
