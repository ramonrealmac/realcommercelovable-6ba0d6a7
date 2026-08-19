-- Migration: 20260819173500_fix_caixa_movimento_tp_operacao.sql
-- Description: Standardizes tp_movimento ('E' for Entrada/Recebimento/Suprimento, 'S' for Saída/Sangria) and tp_operacao ('V' for Venda, 'E' for Suprimento, 'S' for Sangria) in caixa_movimento.

-- 1. Standardize existing records in caixa_movimento
UPDATE public.caixa_movimento 
SET tp_operacao = 'V' 
WHERE tp_operacao = '1' OR (tp_movimento = 'V' AND tp_operacao = 'E');

UPDATE public.caixa_movimento 
SET tp_movimento = 'E' 
WHERE tp_movimento = 'V';

-- 2. Update fu_pdv_registrar_recebimento_venda function
CREATE OR REPLACE FUNCTION public.fu_pdv_registrar_recebimento_venda(
  _empresa_id bigint, 
  _movimento_id bigint, 
  _caixa_abertura_id bigint, 
  _funcionario_caixa_id bigint, 
  _dt_movimento date, 
  _tp_operacao_caixa text, 
  _centro_custo_caixa bigint, 
  _pagamentos jsonb, 
  _usuario_id uuid DEFAULT NULL::uuid
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_bloquear_pedido character varying(1);
  v_total_venda numeric;
  v_total_recebido numeric := 0;
  v_troco numeric := 0;
  v_pag_row jsonb;
  v_caixa_mov_id bigint;
  v_meio_pagamento_id integer;
  v_soma_caixa boolean;
  v_valor_somar_caixa numeric := 0;
  v_pag_dinheiro_ajustado numeric;

  v_condicao_id bigint;
  v_mp_code character varying(2);
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela numeric;
  v_vl_parcela_base numeric;
  v_prazo integer;
  v_dt_vencimento date;
  v_i integer;
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  IF v_mov.st_pedido IN ('R', 'C') THEN
    RETURN jsonb_build_object('error', 'Pedido já recebido ou cancelado.');
  END IF;

  -- Validação de segurança dupla de crédito
  SELECT COALESCE(bloquear_pedido, 'N') INTO v_bloquear_pedido FROM public.empresa WHERE empresa_id = _empresa_id;
  IF v_bloquear_pedido = 'S' AND COALESCE(v_mov.st_bloqueado, 'N') = 'S' THEN
    RETURN jsonb_build_object('error', 'Este pedido está BLOQUEADO por análise de crédito e não pode ser recebido.');
  END IF;

  v_total_venda := v_mov.vl_movimento;

  -- 2. Limpa pagamentos anteriores do movimento
  DELETE FROM movimento_pagamento WHERE movimento_id = _movimento_id;

  -- 3. Calcula total recebido e troco
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_total_recebido := v_total_recebido + (v_pag_row->>'vl_recebido')::numeric;
  END LOOP;

  v_troco := GREATEST(0, v_total_recebido - v_total_venda);

  -- 4. Grava movimento_pagamento
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;
    SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    
    v_n_parcelas := COALESCE(NULLIF(v_cond.qtd_parcelas, 0), COALESCE(NULLIF((v_pag_row->>'qt_parcela')::integer, 0), 1));
    IF v_n_parcelas = 1 AND v_cond.tipo_prazo = 'V' THEN
      v_n_parcelas := (
        (CASE WHEN COALESCE(v_cond.prazo_1, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_2, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_3, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_4, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_5, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_6, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_7, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_8, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_9, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_10, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_11, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_12, 0) > 0 THEN 1 ELSE 0 END)
      );
      IF v_n_parcelas = 0 THEN v_n_parcelas := 1; END IF;
    END IF;

    v_vl_parcela := ROUND((v_pag_row->>'vl_recebido')::numeric / v_n_parcelas, 2);

    INSERT INTO movimento_pagamento (
      empresa_id, movimento_id, condicao_id, tp_pagamento, vl_pagamento, 
      nr_autorizacao, bandeira_id, operadora_id, n_parcelas, vl_parcelas, dt_pagamento, portador_id
    ) VALUES (
      _empresa_id, _movimento_id, v_condicao_id, v_pag_row->>'condicao_descricao', 
      (v_pag_row->>'vl_recebido')::numeric, COALESCE(v_pag_row->>'numero_autoriza', ''), 
      NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
      v_n_parcelas, v_vl_parcela, now(), NULLIF((v_pag_row->>'portador_id')::text, '')::integer
    );
  END LOOP;

  -- 5. Grava caixa_movimento (tp_movimento = 'E', tp_operacao = 'V')
  INSERT INTO caixa_movimento (
    empresa_id, caixa_abertura_id, funcionario_id, colaborador_id, dt_movimento,
    tp_movimento, tp_operacao, centro_custo_id, historico, documento,
    vl_movimento, vl_troco, movimento_id, excluido
  ) VALUES (
    _empresa_id, _caixa_abertura_id, _funcionario_caixa_id, _funcionario_caixa_id, _dt_movimento,
    'E', 'V', _centro_custo_caixa, 'Recebimento Pedido ' || v_mov.nr_movimento, v_mov.nr_movimento::text,
    v_total_venda, v_troco, _movimento_id, false
  ) RETURNING caixa_movimento_id INTO v_caixa_mov_id;

  -- 6. Prepara itens do caixa
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := (v_pag_row->>'meio_pagamento_id')::integer;
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;
    SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    v_n_parcelas := COALESCE(NULLIF(v_cond.qtd_parcelas, 0), COALESCE(NULLIF((v_pag_row->>'qt_parcela')::integer, 0), 1));
    IF v_n_parcelas = 1 AND v_cond.tipo_prazo = 'V' THEN
      v_n_parcelas := (
        (CASE WHEN COALESCE(v_cond.prazo_1, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_2, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_3, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_4, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_5, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_6, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_7, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_8, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_9, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_10, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_11, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_12, 0) > 0 THEN 1 ELSE 0 END)
      );
      IF v_n_parcelas = 0 THEN v_n_parcelas := 1; END IF;
    END IF;

    v_pag_dinheiro_ajustado := (v_pag_row->>'vl_recebido')::numeric;

    IF v_troco > 0 AND v_meio_pagamento_id = 1 THEN
      v_pag_dinheiro_ajustado := GREATEST(0, v_pag_dinheiro_ajustado - v_troco);
      v_troco := 0; 
    END IF;

    IF v_pag_dinheiro_ajustado > 0 THEN
      INSERT INTO caixa_movimento_item (
        caixa_movimento_id, empresa_id, condicao_id, prazo_pagamento_id,
        bandeira_id, operadora_id, numero_autoriza, qt_parcela, vl_parcela,
        vl_recebido, plano_conta_id, meio_pagamento_id, excluido
      ) VALUES (
        v_caixa_mov_id, _empresa_id, v_condicao_id, 0,
        NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
        COALESCE(v_pag_row->>'numero_autoriza', ''), v_n_parcelas, 
        ROUND(v_pag_dinheiro_ajustado / v_n_parcelas, 2),
        v_pag_dinheiro_ajustado, NULLIF((v_pag_row->>'plano_conta_id')::text, '')::integer, v_meio_pagamento_id, false
      );

      IF v_meio_pagamento_id IS NOT NULL THEN
        SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
        IF v_soma_caixa THEN
          v_valor_somar_caixa := v_valor_somar_caixa + v_pag_dinheiro_ajustado;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 7. Atualiza caixa_abertura
  IF v_valor_somar_caixa > 0 THEN
    UPDATE caixa_abertura 
    SET vl_fechamento = COALESCE(vl_fechamento, 0) + v_valor_somar_caixa
    WHERE caixa_abertura_id = _caixa_abertura_id;
  END IF;

  -- 8. Atualiza o status do movimento para 'R' (Recebido)
  UPDATE movimento 
  SET st_pedido = 'R', dt_pagamento = now()
  WHERE movimento_id = _movimento_id;

  RETURN jsonb_build_object('success', true, 'caixa_movimento_id', v_caixa_mov_id);
END;
$$;
