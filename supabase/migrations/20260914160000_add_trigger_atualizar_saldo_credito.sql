-- Migration: 20260914160000_add_trigger_atualizar_saldo_credito.sql
-- Description: Cria Trigger automática no banco para atualizar a tabela cadastro_credito_saldo sempre que houver INSERT, UPDATE ou DELETE em cadastro_credito_movimento.

-- 1. Função da Trigger
CREATE OR REPLACE FUNCTION public.fu_tg_atualizar_saldo_credito()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id bigint;
  v_cadastro_id bigint;
  v_tp_parceiro text;
  v_saldo_calculado numeric(15,2) := 0.00;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_empresa_id  := OLD.empresa_id;
    v_cadastro_id := OLD.cadastro_id;
    v_tp_parceiro := OLD.tp_parceiro;
  ELSE
    v_empresa_id  := NEW.empresa_id;
    v_cadastro_id := NEW.cadastro_id;
    v_tp_parceiro := NEW.tp_parceiro;
  END IF;

  -- Recalcula o saldo total de forma consistente a partir das movimentações ativas
  SELECT COALESCE(SUM(CASE WHEN tp_movimento = 'C' THEN vl_movimento ELSE -vl_movimento END), 0.00)
  INTO v_saldo_calculado
  FROM public.cadastro_credito_movimento
  WHERE empresa_id = v_empresa_id
    AND cadastro_id = v_cadastro_id
    AND tp_parceiro = v_tp_parceiro
    AND excluido = false;

  -- Atualiza ou insere o saldo consolidado do parceiro
  INSERT INTO public.cadastro_credito_saldo (
    empresa_id, cadastro_id, tp_parceiro, vl_saldo_atual, dt_ultima_movimentacao, dt_cadastro, dt_alteracao
  ) VALUES (
    v_empresa_id, v_cadastro_id, v_tp_parceiro, v_saldo_calculado, now(), now(), now()
  )
  ON CONFLICT (empresa_id, cadastro_id, tp_parceiro)
  DO UPDATE SET
    vl_saldo_atual = EXCLUDED.vl_saldo_atual,
    dt_ultima_movimentacao = now(),
    dt_alteracao = now();

  RETURN NULL;
END;
$$;

-- 2. Criação da Trigger na tabela cadastro_credito_movimento
DROP TRIGGER IF EXISTS trg_atualizar_saldo_credito ON public.cadastro_credito_movimento;

CREATE TRIGGER trg_atualizar_saldo_credito
AFTER INSERT OR UPDATE OR DELETE ON public.cadastro_credito_movimento
FOR EACH ROW
EXECUTE FUNCTION public.fu_tg_atualizar_saldo_credito();

-- Recarrega esquema no PostgREST
NOTIFY pgrst, 'reload schema';
