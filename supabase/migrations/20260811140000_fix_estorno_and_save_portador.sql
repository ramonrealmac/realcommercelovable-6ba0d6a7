-- Migration: 20260811140000_fix_estorno_and_save_portador.sql
-- Description: Updates fu_pdv_registrar_recebimento_venda to save portador_id into movimento_pagamento, and updates fu_pdv_estornar_venda to clean movimento_pagamento on estorno.

-- 1. Update fu_pdv_registrar_recebimento_venda
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
  v_idx_dinheiro integer := -1;
  v_idx integer := 0;

  -- Variáveis adicionais para geração do financeiro
  v_condicao_id bigint;
  v_mp_code character varying(2);
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela_base numeric;
  v_vl_parcela numeric;
  v_prazo integer;
  v_dt_vencimento date;
  v_i integer;

  -- Variáveis para tratamento de Operadora e Tipo de Antecipação
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

  -- 4. Grava movimento_pagamento (COM PORTADOR_ID)
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    INSERT INTO movimento_pagamento (
      empresa_id, movimento_id, condicao_id, tp_pagamento, vl_pagamento, 
      nr_autorizacao, bandeira_id, operadora_id, n_parcelas, dt_pagamento, portador_id
    ) VALUES (
      _empresa_id, _movimento_id, (v_pag_row->>'condicao_id')::bigint, v_pag_row->>'condicao_descricao', 
      (v_pag_row->>'vl_recebido')::numeric, COALESCE(v_pag_row->>'numero_autoriza', ''), 
      NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
      (v_pag_row->>'qt_parcela')::integer, now(), NULLIF((v_pag_row->>'portador_id')::text, '')::integer
    );
  END LOOP;

  -- 5. Grava caixa_movimento
  INSERT INTO caixa_movimento (
    empresa_id, caixa_abertura_id, funcionario_id, colaborador_id, dt_movimento,
    tp_movimento, tp_operacao, centro_custo_id, historico, documento,
    vl_movimento, vl_troco, movimento_id, excluido
  ) VALUES (
    _empresa_id, _caixa_abertura_id, _funcionario_caixa_id, _funcionario_caixa_id, _dt_movimento,
    'E', _tp_operacao_caixa, _centro_custo_caixa, 'Recebimento Pedido ' || v_mov.nr_movimento, v_mov.nr_movimento::text,
    v_total_venda, v_troco, _movimento_id, false
  ) RETURNING caixa_movimento_id INTO v_caixa_mov_id;

  -- 6. Prepara itens do caixa (com ajuste de troco no dinheiro)
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := (v_pag_row->>'meio_pagamento_id')::integer;
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
        v_caixa_mov_id, _empresa_id, (v_pag_row->>'condicao_id')::bigint, 0,
        NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
        COALESCE(v_pag_row->>'numero_autoriza', ''), (v_pag_row->>'qt_parcela')::integer, 
        v_pag_dinheiro_ajustado / GREATEST(1, (v_pag_row->>'qt_parcela')::integer),
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

  -- 8. Atualiza caixa_abertura
  IF v_valor_somar_caixa > 0 THEN
    UPDATE caixa_abertura 
    SET vl_fechamento = COALESCE(vl_fechamento, 0) + v_valor_somar_caixa
    WHERE caixa_abertura_id = _caixa_abertura_id;
  END IF;

  -- 8b. Gerar parcelas/títulos no financeiro para pagamentos a prazo específicos
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := NULLIF(v_pag_row->>'meio_pagamento_id', '')::integer;
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;

    IF v_meio_pagamento_id IS NULL AND v_condicao_id IS NOT NULL THEN
      SELECT meio_pagamento_id INTO v_meio_pagamento_id FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    END IF;

    IF v_meio_pagamento_id IN (3, 5, 14, 15, 91) THEN
      SELECT COALESCE(codigo, '99') INTO v_mp_code FROM public.meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
      IF NOT FOUND THEN
        v_mp_code := '99';
      END IF;

      SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;

      v_n_parcelas := COALESCE((v_pag_row->>'qt_parcela')::integer, 1);
      IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

      v_operadora_id := NULLIF((v_pag_row->>'operadora_id')::text, '')::integer;
      v_portador_id := COALESCE(NULLIF((v_pag_row->>'portador_id')::text, '')::integer, 0);
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
        v_vl_bruto := (v_pag_row->>'vl_recebido')::numeric;

        SELECT taxa_cartao, taxa_antecipacao INTO v_taxa_row
        FROM public.operadora_taxa
        WHERE operadora_id = v_operadora_id
          AND empresa_id = _empresa_id
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
          _empresa_id,
          _movimento_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
          1,
          v_mp_code,
          'R',
          _dt_movimento,
          _dt_movimento,
          v_portador_id,
          COALESCE(v_mov.cadastro_id, 0),
          'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || ' (ANTECIPAÇÃO AUTOMÁTICA)',
          v_vl_bruto,
          0,
          v_vl_bruto,
          0,
          v_vl_despesa_total,
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'S',
          'B',
          _funcionario_caixa_id
        ) RETURNING financeiro_id INTO v_new_fin_id;

        INSERT INTO public.financeiro_baixa (
          empresa_id, financeiro_id, documento, dt_pagamento, vl_pago,
          vl_despesa, vl_desconto, vl_juros, recibo, tipo_pag_rec_id,
          observacao, plano_id, planoconta_id, tp_conta, cadastro_id
        ) VALUES (
          _empresa_id,
          v_new_fin_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
          _dt_movimento,
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
      -- CASO B: SEM ANTECIPAÇÃO OU AVULSA
      -- =========================================================================
      ELSE
        v_vl_parcela_base := ROUND(((v_pag_row->>'vl_recebido')::numeric / v_n_parcelas), 2);

        FOR v_i IN 1..v_n_parcelas LOOP
          IF v_i = v_n_parcelas THEN
            v_vl_parcela := (v_pag_row->>'vl_recebido')::numeric - (v_vl_parcela_base * (v_n_parcelas - 1));
          ELSE
            v_vl_parcela := v_vl_parcela_base;
          END IF;

          IF v_cond IS NOT NULL AND v_cond.tipo_prazo = 'F' THEN
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
          ELSE
            v_prazo := COALESCE(v_cond.intervalo, 30) * v_i;
          END IF;

          v_dt_vencimento := _dt_movimento + v_prazo;

          INSERT INTO public.financeiro (
            empresa_id, movimento_id, documento, parcela, tp_documento_id,
            tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
            observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
            vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
          ) VALUES (
            _empresa_id,
            _movimento_id,
            (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-' || v_i),
            v_i,
            v_mp_code,
            'R',
            _dt_movimento,
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
            _funcionario_caixa_id
          );
        END LOOP;
      END IF;

    END IF;
  END LOOP;

  -- 9. Transição de status do PDV ('R' e baixa de estoque)
  PERFORM public.fu_mudar_status_pedido_pdv(_movimento_id, 'R', _usuario_id);

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


-- 2. Update fu_pdv_estornar_venda to also clean movimento_pagamento
CREATE OR REPLACE FUNCTION public.fu_pdv_estornar_venda(
  _movimento_id bigint, 
  _usuario_id uuid DEFAULT NULL::uuid
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_item RECORD;
  v_valor_deduzir_caixa numeric := 0;
  v_caixa_abertura_id bigint;
  v_soma_caixa boolean;
  v_deposito_id bigint;
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  IF v_mov.st_pedido <> 'R' THEN
    RETURN jsonb_build_object('error', 'Apenas vendas finalizadas (status R) podem ser estornadas.');
  END IF;

  -- 2. Restaura estoque
  FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
    v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

    IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
    END IF;

    IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
      NULL;
    ELSE
      UPDATE public.estoque 
      SET estoque_reservado = estoque_reservado + v_item.qt_movimento
      WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;

      INSERT INTO public.estoque_log (
          empresa_id, produto_id, deposito_id,
          qt_movimento, operacao, origem,
          nr_doc, usuario, dt_hs_log
      ) VALUES (
          v_mov.empresa_id, v_item.produto_id, v_deposito_id,
          v_item.qt_movimento,
          'ESTORNO_VENDA', 'CAIXA',
          _movimento_id::varchar, COALESCE(_usuario_id::varchar, 'SISTEMA'), now()
      );
    END IF;
  END LOOP;

  -- 3. Dedução de caixa
  FOR v_item IN 
    SELECT cmi.vl_recebido, cmi.meio_pagamento_id 
    FROM caixa_movimento_item cmi
    JOIN caixa_movimento cm ON cm.caixa_movimento_id = cmi.caixa_movimento_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false
  LOOP
    IF v_item.meio_pagamento_id IS NOT NULL THEN
      SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM meio_pagamento WHERE meio_pagamento_id = v_item.meio_pagamento_id;
      IF v_soma_caixa THEN
        v_valor_deduzir_caixa := v_valor_deduzir_caixa + v_item.vl_recebido;
      END IF;
    END IF;
  END LOOP;

  IF v_valor_deduzir_caixa > 0 THEN
    SELECT DISTINCT caixa_abertura_id INTO v_caixa_abertura_id
    FROM caixa_movimento
    WHERE movimento_id = _movimento_id AND excluido = false;
    
    IF v_caixa_abertura_id IS NOT NULL THEN
      UPDATE caixa_abertura
      SET vl_fechamento = GREATEST(0, COALESCE(vl_fechamento, 0) - v_valor_deduzir_caixa)
      WHERE caixa_abertura_id = v_caixa_abertura_id;
    END IF;
  END IF;

  -- 5. Exclui caixa_movimento e caixa_movimento_item
  DELETE FROM caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM caixa_movimento WHERE movimento_id = _movimento_id;

  -- 6. Exclui parcelas do financeiro E movimento_pagamento
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;
  DELETE FROM public.movimento_pagamento WHERE movimento_id = _movimento_id;

  -- 7. Atualiza status do pedido para 'F'
  UPDATE movimento 
  SET st_pedido = 'F', 
      dt_alteracao = now() 
  WHERE movimento_id = _movimento_id;

  -- 8. Auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_ESTORNO_PDV', jsonb_build_object('status', 'R'), jsonb_build_object('status', 'F'), _usuario_id);

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
