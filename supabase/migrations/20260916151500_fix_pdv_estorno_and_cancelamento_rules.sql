-- Migration: 20260916151500_fix_pdv_estorno_and_cancelamento_rules.sql
-- Description: Atualiza as RPCs fu_pdv_estornar_venda e fu_mudar_status_pedido_pdv para apagar os títulos do financeiro (hard delete), restaurar o estoque dos produtos e:
-- 1. No Estorno: Retornar o pedido para em aberto (st_pedido = 'O') permitindo alterações.
-- 2. No Cancelamento: Alterar o status do pedido para cancelado (st_pedido = 'C').

-- 1. Atualiza a RPC fu_pdv_estornar_venda
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
  SELECT * INTO v_mov FROM public.movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  -- Bloqueio estrito: Se o pedido já possui status EP (Estornado Parcial), E (Estornado Total) ou C (Cancelado)
  -- ou se qualquer item já possui qt_devolvido > 0
  IF v_mov.st_pedido IN ('EP', 'E', 'C') OR EXISTS (
    SELECT 1 FROM public.movimento_item 
    WHERE movimento_id = _movimento_id AND COALESCE(qt_devolvido, 0) > 0 AND excluido = false
  ) THEN
    RETURN jsonb_build_object('error', 'Este pedido possui estorno parcial ou total de produtos realizado e não pode ser estornado no caixa.');
  END IF;

  IF v_mov.st_pedido <> 'R' THEN
    RETURN jsonb_build_object('error', 'Apenas vendas finalizadas (status R) podem ser estornadas no caixa.');
  END IF;

  -- 2. Restaura estoque (físico e reservado)
  FOR v_item IN SELECT * FROM public.movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
    v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

    IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
    END IF;

    IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
      NULL;
    ELSE
      -- Repõe a reserva de estoque para quando o pedido voltar ao estado de pré-venda/orçamento se necessário
      UPDATE public.estoque 
      SET estoque_reservado = estoque_reservado + v_item.qt_movimento
      WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;

      -- Lança o estorno físico no estoque_log (+qt_movimento)
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
    FROM public.caixa_movimento_item cmi
    JOIN public.caixa_movimento cm ON cm.caixa_movimento_id = cmi.caixa_movimento_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false
  LOOP
    IF v_item.meio_pagamento_id IS NOT NULL THEN
      SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM public.meio_pagamento WHERE meio_pagamento_id = v_item.meio_pagamento_id;
      IF v_soma_caixa THEN
        v_valor_deduzir_caixa := v_valor_deduzir_caixa + v_item.vl_recebido;
      END IF;
    END IF;
  END LOOP;

  IF v_valor_deduzir_caixa > 0 THEN
    SELECT DISTINCT caixa_abertura_id INTO v_caixa_abertura_id
    FROM public.caixa_movimento
    WHERE movimento_id = _movimento_id AND excluido = false;
    
    IF v_caixa_abertura_id IS NOT NULL THEN
      UPDATE public.caixa_abertura
      SET vl_fechamento = GREATEST(0, COALESCE(vl_fechamento, 0) - v_valor_deduzir_caixa)
      WHERE caixa_abertura_id = v_caixa_abertura_id;
    END IF;
  END IF;

  -- 4. Exclui lançamentos de caixa (caixa_movimento_item e caixa_movimento)
  DELETE FROM public.caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM public.caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM public.caixa_movimento WHERE movimento_id = _movimento_id;

  -- 5. Exclui as baixas de financeiro_baixa vinculadas aos títulos do movimento
  DELETE FROM public.financeiro_baixa 
  WHERE financeiro_id IN (
    SELECT financeiro_id FROM public.financeiro WHERE movimento_id = _movimento_id
  );

  -- 6. APAGA OS TÍTULOS DO FINANCEIRO VINCULADOS AO PEDIDO
  DELETE FROM public.financeiro 
  WHERE movimento_id = _movimento_id;

  -- 7. Atualiza o status do pedido de volta para 'O' (EM ABERTO / ORÇAMENTO) para permitir alterações
  UPDATE public.movimento 
  SET st_pedido = 'O',
      st_bloqueado = 'N',
      dt_alteracao = now()
  WHERE movimento_id = _movimento_id;

  -- 8. Registra auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_ESTORNO_PDV', jsonb_build_object('status', 'R'), jsonb_build_object('status', 'O'), _usuario_id);

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


-- 2. Atualiza a RPC fu_mudar_status_pedido_pdv para apagar financeiro e caixas ao cancelar (Regra 6)
CREATE OR REPLACE FUNCTION public.fu_mudar_status_pedido_pdv(
  _movimento_id bigint, 
  _novo_status text, 
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
    v_bloquear_pedido character varying(1);
    v_bloqueia_cliente integer;
    v_vl_lim_credito numeric(16,2);
    v_qt_tit_aberto integer;
    v_qt_tit_vencido integer;
    v_saldo_devedor numeric(16,2);
    v_tit_aberto_count integer;
    v_tit_vencido_count integer;
    v_st_bloqueado character varying(1) := 'N';
    v_deposito_id bigint;
BEGIN
    SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
    IF NOT FOUND THEN 
        RETURN jsonb_build_object('error', 'Movimento não encontrado'); 
    END IF;

    -- REGRA 1: Enviar para o Caixa / Finalizar (O, R -> F)
    IF v_mov.st_pedido IN ('O', 'R') AND _novo_status = 'F' THEN
        SELECT COALESCE(bloquear_pedido, 'N') INTO v_bloquear_pedido 
        FROM public.empresa 
        WHERE empresa_id = v_mov.empresa_id;
        
        IF v_bloquear_pedido = 'S' AND v_mov.cadastro_id IS NOT NULL THEN
            SELECT 
                COALESCE(bloqueia_cliente, 3), 
                COALESCE(vl_lim_credito, 0.00), 
                COALESCE(qt_tit_aberto, 0), 
                COALESCE(qt_tit_vencido, 0)
            INTO v_bloqueia_cliente, v_vl_lim_credito, v_qt_tit_aberto, v_qt_tit_vencido
            FROM public.cadastro 
            WHERE cadastro_id = v_mov.cadastro_id;
            
            IF v_bloqueia_cliente = 1 THEN
                v_st_bloqueado := 'S';
            ELSIF v_bloqueia_cliente = 2 THEN
                SELECT COALESCE(SUM(vl_titulo - vl_pago), 0.00) INTO v_saldo_devedor
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND excluido = false;
                
                SELECT COUNT(*) INTO v_tit_aberto_count
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND excluido = false;
                
                SELECT COUNT(*) INTO v_tit_vencido_count
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND dt_vencto < CURRENT_DATE 
                  AND excluido = false;
                
                IF v_saldo_devedor > v_vl_lim_credito OR 
                   v_tit_aberto_count > v_qt_tit_aberto OR 
                   v_tit_vencido_count > v_qt_tit_vencido THEN
                    v_st_bloqueado := 'S';
                END IF;
            END IF;
        END IF;

        IF v_mov.st_pedido = 'O' THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);
                
                IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                    INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                    VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
                END IF;

                UPDATE public.estoque 
                SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
            END LOOP;
        END IF;
        
        UPDATE movimento 
        SET st_pedido = 'F', 
            st_bloqueado = v_st_bloqueado, 
            dt_alteracao = now() 
        WHERE movimento_id = _movimento_id;

    -- REGRA 2: Retirar do Caixa (F -> O)
    ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento) 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        
        UPDATE movimento 
        SET st_pedido = 'O', 
            st_bloqueado = 'N', 
            dt_alteracao = now(), 
            vl_desconto = 0, 
            pc_desconto = 0, 
            tp_desconto = 'N', 
            vl_movimento = vl_produto 
        WHERE movimento_id = _movimento_id;

    -- REGRA 3: Reservar (O -> V)
    ELSIF v_mov.st_pedido = 'O' AND _novo_status = 'V' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            UPDATE public.estoque 
            SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END LOOP;
        UPDATE movimento SET st_pedido = 'V', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 4: Tirar da Reserva (V -> O)
    ELSIF v_mov.st_pedido = 'V' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento) 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', st_bloqueado = 'N', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 5: FINALIZAR VENDA / RECEBER (F, O, V -> R)
    ELSIF _novo_status = 'R' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
                IF v_mov.st_pedido = 'O' THEN
                    UPDATE public.estoque 
                    SET estoque_reservado = estoque_reservado + v_item.qt_movimento
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                END IF;
            ELSE
                IF v_mov.st_pedido IN ('F', 'V') THEN
                    UPDATE public.estoque 
                    SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                END IF;

                INSERT INTO public.estoque_log (
                    empresa_id, produto_id, deposito_id,
                    qt_movimento, operacao, origem,
                    nr_doc, usuario, dt_hs_log
                ) VALUES (
                    v_mov.empresa_id, v_item.produto_id, v_deposito_id,
                    -v_item.qt_movimento,
                    'VENDA', 'CAIXA',
                    _movimento_id::varchar, COALESCE(_usuario_id::varchar, 'SISTEMA'), now()
                );
            END IF;
        END LOOP;
        
        UPDATE movimento 
        SET st_pedido = 'R', 
            dt_finalizacao = now(),
            dt_pagamento = now(),
            dt_alteracao = now() 
        WHERE movimento_id = _movimento_id;

    -- REGRA 6: Cancelar (O, R, V, F -> C)
    ELSIF v_mov.st_pedido IN ('O', 'R', 'V', 'F') AND _novo_status = 'C' THEN
        -- 6a. Restaura o estoque (libera reserva ou insere devolução no estoque_log)
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            IF v_mov.st_pedido IN ('F', 'V') THEN
                UPDATE public.estoque 
                SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
            
            ELSIF v_mov.st_pedido = 'R' THEN
                IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
                    UPDATE public.estoque 
                    SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                ELSE
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
            END IF;
        END LOOP;

        -- 6b. Exclui movimentações de caixa se houver
        DELETE FROM public.caixa_movimento_item WHERE caixa_movimento_id IN (
            SELECT caixa_movimento_id FROM public.caixa_movimento WHERE movimento_id = _movimento_id
        );
        DELETE FROM public.caixa_movimento WHERE movimento_id = _movimento_id;

        -- 6c. Exclui as baixas e os títulos do financeiro vinculados ao pedido
        DELETE FROM public.financeiro_baixa WHERE financeiro_id IN (
            SELECT financeiro_id FROM public.financeiro WHERE movimento_id = _movimento_id
        );
        DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;
        
        -- 6d. Atualiza o pedido para 'C' (CANCELADO)
        UPDATE movimento 
        SET st_pedido = 'C', 
            dt_cancelamento = now(), 
            dt_alteracao = now() 
        WHERE movimento_id = _movimento_id;

    ELSE
        RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
    END IF;

    -- Auditoria
    INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE_PDV', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);

    RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$$;

-- Recarrega o esquema do PostgREST
NOTIFY pgrst, 'reload schema';
