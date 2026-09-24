-- Migration: 20260924120000_fn_get_proximo_nr_movimento_by_operacao.sql
-- Descrição: Função atômica e trigger para autogeração de nr_movimento por empresa_id e tp_operacao_id via sys_sequencial.

-- 1. Atualiza a função atômica get_proximo_nr_movimento
CREATE OR REPLACE FUNCTION public.get_proximo_nr_movimento(
  p_empresa_id integer,
  p_tp_operacao_id integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_chave_seq text;
  v_next bigint;
  v_max_atual bigint;
BEGIN
  IF p_empresa_id IS NULL OR p_empresa_id <= 0 THEN
    p_empresa_id := 1;
  END IF;

  v_chave_seq := COALESCE(p_tp_operacao_id::text, '0');

  -- Se não existir entrada no sys_sequencial para este (empresa_id, 'movimento', 'nr_movimento', v_chave_seq),
  -- inicializa com o MAX(nr_movimento) existente na tabela movimento para esta empresa e operação.
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_sequencial
    WHERE empresa_id = p_empresa_id
      AND tabela = 'movimento'
      AND nm_campo1 = 'nr_movimento'
      AND nm_campo2 = v_chave_seq
  ) THEN
    IF v_chave_seq <> '0' THEN
      SELECT COALESCE(MAX(nr_movimento), 0) INTO v_max_atual
      FROM public.movimento
      WHERE empresa_id = p_empresa_id
        AND tp_operacao_id = p_tp_operacao_id;
    ELSE
      SELECT COALESCE(MAX(nr_movimento), 0) INTO v_max_atual
      FROM public.movimento
      WHERE empresa_id = p_empresa_id
        AND (tp_operacao_id IS NULL OR tp_operacao_id = 0);
    END IF;

    INSERT INTO public.sys_sequencial (empresa_id, tabela, nm_campo1, nm_campo2, ult_seq)
    VALUES (p_empresa_id, 'movimento', 'nr_movimento', v_chave_seq, v_max_atual)
    ON CONFLICT (empresa_id, tabela, nm_campo1, nm_campo2) DO NOTHING;
  END IF;

  -- Incrementa e retorna atômico
  UPDATE public.sys_sequencial
  SET ult_seq = COALESCE(ult_seq, 0) + 1
  WHERE empresa_id = p_empresa_id
    AND tabela = 'movimento'
    AND nm_campo1 = 'nr_movimento'
    AND nm_campo2 = v_chave_seq
  RETURNING ult_seq INTO v_next;

  -- Fallback de segurança se v_next ainda for nulo
  IF v_next IS NULL THEN
    IF v_chave_seq <> '0' THEN
      SELECT COALESCE(MAX(nr_movimento), 0) + 1 INTO v_next
      FROM public.movimento
      WHERE empresa_id = p_empresa_id
        AND tp_operacao_id = p_tp_operacao_id;
    ELSE
      SELECT COALESCE(MAX(nr_movimento), 0) + 1 INTO v_next
      FROM public.movimento
      WHERE empresa_id = p_empresa_id
        AND (tp_operacao_id IS NULL OR tp_operacao_id = 0);
    END IF;
  END IF;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_proximo_nr_movimento(integer, integer) TO service_role;

-- 2. Trigger BEFORE INSERT na tabela movimento para autogeração caso nr_movimento seja nulo ou <= 0
CREATE OR REPLACE FUNCTION public.trg_fn_autonumber_movimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.nr_movimento IS NULL OR NEW.nr_movimento <= 0 THEN
    NEW.nr_movimento := public.get_proximo_nr_movimento(
      NEW.empresa_id,
      NEW.tp_operacao_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimento_autonumber ON public.movimento;
CREATE TRIGGER trg_movimento_autonumber
  BEFORE INSERT ON public.movimento
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_autonumber_movimento();
