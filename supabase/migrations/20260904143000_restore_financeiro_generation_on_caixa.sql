-- Migration: 20260904143000_restore_financeiro_generation_on_caixa.sql
-- Description: Restores auto-generation of financeiro installments on POS checkout and fixes 'F' vs 'V' payment condition due date calculations.

-- 1. Create dedicated modular function to generate financeiro titles from an order's payments
CREATE OR REPLACE FUNCTION public.fu_gerar_financeiro_movimento(_movimento_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_pag RECORD;
  v_meio_pagamento_id integer;
  v_condicao_id bigint;
  v_mp_code character varying(2);
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela_base numeric;
  v_vl_parcela numeric;
  v_prazo integer;
  v_dt_vencimento date;
  v_i integer;
  v_dt_emissao date;

  v_operadora_id integer;
  v_tipo_antecipacao varchar(50);
  v_taxa_row RECORD;
  v_taxa_op_pct numeric := 0;
  v_taxa_ant_pct numeric := 0;
  v_vl_bruto numeric := 0;
  v_vl_despesa_op numeric := 0;
  v_vl_despesa_ant numeric := 0;
  v_vl_despesa_total numeric := 0;
  v_vl_liquido numeric := 0;
  v_base_parc numeric := 0;
  v_parc_cur numeric := 0;
  v_new_fin_id bigint;
  v_portador_id integer := 0;
  v_funcionario_id bigint;
BEGIN
  -- 1. Obter dados do movimento
  SELECT * INTO v_mov FROM public.movimento WHERE movimento_id = _movimento_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dt_emissao := COALESCE(v_mov.dt_emissao::date, CURRENT_DATE);
  v_funcionario_id := COALESCE(v_mov.funcionario_id, 0);

  -- 2. Limpa títulos anteriores vinculados a este movimento
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 3. Para cada pagamento gravado em movimento_pagamento
  FOR v_pag IN 
    SELECT * FROM public.movimento_pagamento 
    WHERE movimento_id = _movimento_id AND COALESCE(vl_pagamento, 0) > 0
    ORDER BY movimento_pagamento_id
  LOOP
    v_condicao_id := v_pag.condicao_id;
    SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    
    v_meio_pagamento_id := v_cond.meio_pagamento_id;
    IF v_meio_pagamento_id IS NULL THEN
      IF v_cond.tipo_prazo IN ('01', 'U') AND COALESCE(v_cond.st_avista, 'S') = 'S' THEN
        v_meio_pagamento_id := 1;
      ELSE
        v_meio_pagamento_id := 15;
      END IF;
    END IF;

    -- Se for Dinheiro à vista (meio 1 e st_avista = 'S'), não gera título a receber (já somado no caixa físico)
    IF v_meio_pagamento_id = 1 AND COALESCE(v_cond.st_avista, 'S') = 'S' THEN
      CONTINUE;
    END IF;

    -- Meio de pagamento código para tp_documento_id
    SELECT COALESCE(codigo, '99') INTO v_mp_code 
    FROM public.meio_pagamento 
    WHERE meio_pagamento_id = v_meio_pagamento_id;

    IF NOT FOUND OR v_mp_code IS NULL THEN
      v_mp_code := '99';
    END IF;

    -- Determina número de parcelas
    v_n_parcelas := COALESCE(v_pag.n_parcelas, NULLIF(v_cond.qtd_parcelas, 0), 1);
    IF v_n_parcelas = 1 AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
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
    IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

    v_operadora_id := v_pag.operadora_id;
    v_portador_id := COALESCE(v_pag.portador_id, 0);
    v_tipo_antecipacao := 'SEM ANTECIPAÇÃO';

    IF v_meio_pagamento_id = 3 AND v_operadora_id IS NOT NULL THEN
      SELECT COALESCE(tipo_antecipacao, 'SEM ANTECIPAÇÃO') INTO v_tipo_antecipacao 
      FROM public.operadora 
      WHERE operadora_id = v_operadora_id;
    END IF;

    -- =========================================================================
    -- CASO A: CARTÃO DE CRÉDITO COM ANTECIPAÇÃO AUTOMÁTICA
    -- =========================================================================
    IF v_meio_pagamento_id = 3 AND UPPER(v_tipo_antecipacao) = 'AUTOMÁTICA' THEN
      v_vl_bruto := v_pag.vl_pagamento;

      SELECT taxa_cartao, taxa_antecipacao INTO v_taxa_row
      FROM public.operadora_taxa
      WHERE operadora_id = v_operadora_id
        AND empresa_id = v_mov.empresa_id
        AND (parcela = v_n_parcelas::text OR parcela = (v_n_parcelas::text || 'X'))
        AND excluido = false
      LIMIT 1;

      v_taxa_op_pct := COALESCE(v_taxa_row.taxa_cartao, 0);
      v_taxa_ant_pct := COALESCE(v_taxa_row.taxa_antecipacao, 0);

      v_vl_despesa_op := ROUND((v_vl_bruto * (v_taxa_op_pct / 100)), 2);
      v_base_parc := ROUND((v_vl_bruto / v_n_parcelas), 2);
      v_vl_despesa_ant := 0;

      FOR v_i IN 1..v_n_parcelas LOOP
        IF v_i = v_n_parcelas THEN
          v_parc_cur := v_vl_bruto - (v_base_parc * (v_n_parcelas - 1));
        ELSE
          v_parc_cur := v_base_parc;
        END IF;

        v_vl_despesa_ant := v_vl_despesa_ant + ROUND((v_parc_cur * ((v_taxa_ant_pct * v_i) / 100)), 2);
      END LOOP;

      v_vl_despesa_total := v_vl_despesa_op + v_vl_despesa_ant;
      v_vl_liquido := GREATEST(0, v_vl_bruto - v_vl_despesa_total);

      INSERT INTO public.financeiro (
        empresa_id, movimento_id, documento, parcela, tp_documento_id,
        tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
        observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
        vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
      ) VALUES (
        v_mov.empresa_id,
        _movimento_id,
        (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
        1,
        v_mp_code,
        'R',
        v_dt_emissao,
        v_dt_emissao,
        v_portador_id,
        COALESCE(v_mov.cadastro_id, 0),
        'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || ' (ANTECIPAÇÃO AUTOMÁTICA)',
        v_vl_bruto,
        0,
        v_vl_liquido,
        0,
        v_vl_despesa_total,
        COALESCE(v_cond.plano_conta_id, 0),
        COALESCE(v_cond.plano_conta_id, 0),
        'S',
        'B',
        v_funcionario_id
      ) RETURNING financeiro_id INTO v_new_fin_id;

      INSERT INTO public.financeiro_baixa (
        empresa_id, financeiro_id, documento, dt_pagamento, vl_pago,
        vl_despesa, vl_desconto, vl_juros, recibo, tipo_pag_rec_id,
        observacao, plano_id, planoconta_id, tp_conta, cadastro_id
      ) VALUES (
        v_mov.empresa_id,
        v_new_fin_id,
        (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
        v_dt_emissao,
        v_vl_liquido,
        v_vl_despesa_total,
        0, 0,
        'CARTAO',
        3,
        'Baixa Automática no Caixa (Cartão ' || v_n_parcelas || 'x - Antecipação Automática)',
        COALESCE(v_cond.plano_conta_id, 0),
        COALESCE(v_cond.plano_conta_id, 0),
        'R',
        COALESCE(v_mov.cadastro_id, 0)
      );

    -- =========================================================================
    -- CASO B: A PRAZO / BOLETO / DUPLICATA / CARTÃO SEM ANTECIPAÇÃO
    -- =========================================================================
    ELSE
      v_vl_parcela_base := ROUND((v_pag.vl_pagamento / v_n_parcelas), 2);

      FOR v_i IN 1..v_n_parcelas LOOP
        IF v_i = v_n_parcelas THEN
          v_vl_parcela := v_pag.vl_pagamento - (v_vl_parcela_base * (v_n_parcelas - 1));
        ELSE
          v_vl_parcela := v_vl_parcela_base;
        END IF;

        IF v_cond IS NOT NULL AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
          v_prazo := CASE v_i
            WHEN 1 THEN COALESCE(v_cond.prazo_1, 0)
            WHEN 2 THEN COALESCE(v_cond.prazo_2, 0)
            WHEN 3 THEN COALESCE(v_cond.prazo_3, 0)
            WHEN 4 THEN COALESCE(v_cond.prazo_4, 0)
            WHEN 5 THEN COALESCE(v_cond.prazo_5, 0)
            WHEN 6 THEN COALESCE(v_cond.prazo_6, 0)
            WHEN 7 THEN COALESCE(v_cond.prazo_7, 0)
            WHEN 8 THEN COALESCE(v_cond.prazo_8, 0)
            WHEN 9 THEN COALESCE(v_cond.prazo_9, 0)
            WHEN 10 THEN COALESCE(v_cond.prazo_10, 0)
            WHEN 11 THEN COALESCE(v_cond.prazo_11, 0)
            WHEN 12 THEN COALESCE(v_cond.prazo_12, 0)
            ELSE 30 * v_i
          END;
        ELSIF v_cond IS NOT NULL AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'F' THEN
          v_prazo := COALESCE(NULLIF(v_cond.intervalo, 0), 30) * v_i;
        ELSE
          v_prazo := COALESCE(NULLIF(v_cond.prazo_1, 0), COALESCE(NULLIF(v_cond.intervalo, 0), 30) * v_i);
        END IF;

        v_dt_vencimento := v_dt_emissao + v_prazo;

        INSERT INTO public.financeiro (
          empresa_id, movimento_id, documento, parcela, tp_documento_id,
          tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
          observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
          vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
        ) VALUES (
          v_mov.empresa_id,
          _movimento_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-' || v_i),
          v_i,
          v_mp_code,
          'R',
          v_dt_emissao,
          v_dt_vencimento,
          v_portador_id,
          COALESCE(v_mov.cadastro_id, 0),
          'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
          v_vl_parcela,
          0, 0, 0, 0,
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'S',
          'A',
          v_funcionario_id
        );
      END LOOP;
    END IF;

  END LOOP;
END;
$$;


-- 2. Update fu_pdv_registrar_recebimento_venda to invoke fu_gerar_financeiro_movimento and keep inventory sync
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
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela numeric;
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

  -- 4. Grava movimento_pagamento (com vl_parcelas e portador_id)
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;
    SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    
    v_n_parcelas := COALESCE(NULLIF(v_cond.qtd_parcelas, 0), COALESCE(NULLIF((v_pag_row->>'qt_parcela')::integer, 0), 1));
    IF v_n_parcelas = 1 AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
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
    IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

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
    IF v_n_parcelas = 1 AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
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
    IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

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

  -- 8. Gerar parcelas no financeiro
  PERFORM public.fu_gerar_financeiro_movimento(_movimento_id);

  -- 9. Atualiza status do pedido e estoque
  PERFORM public.fu_mudar_status_pedido_pdv(_movimento_id, 'R', _usuario_id);
  UPDATE movimento 
  SET dt_pagamento = now()
  WHERE movimento_id = _movimento_id;

  RETURN jsonb_build_object(
    'success', true, 
    'movimento_id', _movimento_id, 
    'caixa_movimento_id', v_caixa_mov_id,
    'vl_somado_caixa', v_valor_somar_caixa
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


-- 3. Retroactively generate missing financeiro titles for received orders since 2026-08-18
DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN 
    SELECT m.movimento_id
    FROM public.movimento m
    JOIN public.movimento_pagamento mp ON mp.movimento_id = m.movimento_id
    LEFT JOIN public.condicao_pagamento cp ON cp.condicao_id = mp.condicao_id
    WHERE m.st_pedido = 'R' AND m.dt_pagamento >= '2026-08-18'
      AND (cp.st_avista = 'N' OR cp.meio_pagamento_id IN (3, 5, 14, 15, 91))
    GROUP BY m.movimento_id
    ORDER BY m.movimento_id
  LOOP
    PERFORM public.fu_gerar_financeiro_movimento(v_rec.movimento_id);
  END LOOP;
END;
$$;
