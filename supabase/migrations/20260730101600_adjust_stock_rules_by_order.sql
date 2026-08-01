-- Migration: 20260730101600_adjust_stock_rules_by_order.sql
-- Description: Corrects stock reservation rules based on the delivery flag (entrega = 'S') and ensures physical stock debits are performed via the estoque_log trigger.

-- 1. Redefine a RPC fu_mudar_status_pedido_pdv com a lógica de reservas correta
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
        -- Verificar parâmetro de bloqueio da empresa
        SELECT COALESCE(bloquear_pedido, 'N') INTO v_bloquear_pedido 
        FROM public.empresa 
        WHERE empresa_id = v_mov.empresa_id;
        
        -- Executa validações se bloqueio estiver ativo na empresa e houver cliente
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
                -- Soma do saldo devedor de títulos a receber abertos
                SELECT COALESCE(SUM(vl_titulo - vl_pago), 0.00) INTO v_saldo_devedor
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND excluido = false;
                
                -- Quantidade de títulos em aberto
                SELECT COUNT(*) INTO v_tit_aberto_count
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND excluido = false;
                
                -- Quantidade de títulos vencidos
                SELECT COUNT(*) INTO v_tit_vencido_count
                FROM public.financeiro 
                WHERE cadastro_id = v_mov.cadastro_id 
                  AND status = 'A' 
                  AND tp_conta = 'R' 
                  AND dt_vencto < CURRENT_DATE 
                  AND excluido = false;
                
                -- Se estourou qualquer regra, marca como bloqueado
                IF v_saldo_devedor > v_vl_lim_credito OR 
                   v_tit_aberto_count > v_qt_tit_aberto OR 
                   v_tit_vencido_count > v_qt_tit_vencido THEN
                    v_st_bloqueado := 'S';
                END IF;
            END IF;
        END IF;

        -- Se estava em orçamento (O), agora reserva todos os itens
        IF v_mov.st_pedido = 'O' THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);
                
                -- Garante que o registro de estoque exista
                IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                    INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                    VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
                END IF;

                UPDATE public.estoque 
                SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
            END LOOP;
        END IF;
        
        -- Salva status F e marca st_bloqueado calculado
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
        
        -- Retorna para O e limpa o bloqueio
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

            -- Se for item para entrega ('S'), nada muda (continua reservado e físico não altera)
            IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
                -- Se estava em orçamento (O), agora reserva
                IF v_mov.st_pedido = 'O' THEN
                    UPDATE public.estoque 
                    SET estoque_reservado = estoque_reservado + v_item.qt_movimento
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                END IF;
            ELSE
                -- Se for item de retirada cliente ('N')
                -- Se estava em status de reserva (F, V), remove da reserva
                IF v_mov.st_pedido IN ('F', 'V') THEN
                    UPDATE public.estoque 
                    SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                END IF;

                -- Registra a baixa física na trigger de baixa inserindo no estoque_log
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
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

            IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
                INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
                VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
            END IF;

            -- Se estava no caixa ou reservado (F, V), abate da reserva
            IF v_mov.st_pedido IN ('F', 'V') THEN
                UPDATE public.estoque 
                SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
            
            -- Se estava recebido (R)
            ELSIF v_mov.st_pedido = 'R' THEN
                IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
                    -- Se era entrega, ainda estava reservado. Libera a reserva.
                    UPDATE public.estoque 
                    SET estoque_reservado = GREATEST(0, estoque_reservado - v_item.qt_movimento)
                    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
                ELSE
                    -- Se era retirada cliente, devolve ao físico inserindo positivo no estoque_log
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


-- 2. Redefine a RPC fu_pdv_estornar_venda com a mesma lógica de reserva/físico
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

  -- Só permite estornar movimentos recebidos (status 'R')
  IF v_mov.st_pedido <> 'R' THEN
    RETURN jsonb_build_object('error', 'Apenas vendas finalizadas (status R) podem ser estornadas.');
  END IF;

  -- 2. Restaura o estoque físico e reservado dos itens do movimento
  FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
    v_deposito_id := COALESCE(v_item.deposito_id, v_mov.deposito_id, 1);

    IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (v_item.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
    END IF;

    -- Se era item de entrega ('S'), já estava reservado e físico não tinha sido deduzido. Nada muda.
    IF UPPER(COALESCE(v_item.entrega, 'N')) = 'S' THEN
      NULL;
    ELSE
      -- Se era retirada cliente ('N'), devolvemos ao físico (via trigger) e voltamos a reservar
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

  -- 3. Calcula o valor a deduzir do caixa_abertura
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

  -- 4. Deduz do caixa_abertura
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

  -- 5. Exclui os lançamentos de caixa_movimento e caixa_movimento_item
  DELETE FROM caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM caixa_movimento WHERE movimento_id = _movimento_id;

  -- 6. Exclui parcelas do financeiro associadas a este movimento_id
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 7. Atualiza o status do pedido de volta para 'F' (No Caixa)
  UPDATE movimento 
  SET st_pedido = 'F', 
      dt_alteracao = now() 
  WHERE movimento_id = _movimento_id;

  -- 8. Registra auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_ESTORNO_PDV', jsonb_build_object('status', 'R'), jsonb_build_object('status', 'F'), _usuario_id);

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


-- 3. Cria a função trigger para movimento_item para atualizar reserva em tempo real
CREATE OR REPLACE FUNCTION public.fn_tr_movimento_item_estoque_adjust()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_deposito_id bigint;
BEGIN
  -- Identifica os detalhes do movimento pai
  IF TG_OP = 'DELETE' THEN
    SELECT st_pedido, empresa_id, deposito_id, excluido INTO v_mov FROM public.movimento WHERE movimento_id = OLD.movimento_id;
  ELSE
    SELECT st_pedido, empresa_id, deposito_id, excluido INTO v_mov FROM public.movimento WHERE movimento_id = NEW.movimento_id;
  END IF;

  -- Se movimento não existe ou está excluído, não faz nada
  IF v_mov IS NULL OR COALESCE(v_mov.excluido, false) = true THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 1. Inserção de Novo Item
  IF TG_OP = 'INSERT' THEN
    IF NOT COALESCE(NEW.excluido, false) THEN
      v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
      
      -- Garante registro de estoque
      IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
      END IF;

      -- Adiciona à reserva se o status for F, V ou se for R e marcado para entrega ('S')
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = estoque_reservado + NEW.qt_movimento
        WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
    END IF;

  -- 2. Remoção de Item (Física)
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT COALESCE(OLD.excluido, false) THEN
      v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);

      -- Remove da reserva se o status exigia reserva
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
        WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
    END IF;

  -- 3. Atualização de Item (inclui soft-delete excluido=true)
  ELSIF TG_OP = 'UPDATE' THEN
    -- Caso 3.1: Soft-delete (excluido mudou de false para true)
    IF COALESCE(OLD.excluido, false) = false AND COALESCE(NEW.excluido, false) = true THEN
      v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);
      
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
        WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
      
    -- Caso 3.2: Restauração de soft-delete (excluido mudou de true para false)
    ELSIF COALESCE(OLD.excluido, false) = true AND COALESCE(NEW.excluido, false) = false THEN
      v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);

      IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
      END IF;

      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = estoque_reservado + NEW.qt_movimento
        WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
      
    -- Caso 3.3: Atualização padrão de campos de um item ativo
    ELSIF COALESCE(NEW.excluido, false) = false THEN
      -- Se houve alteração de produto ou depósito
      IF OLD.produto_id <> NEW.produto_id OR COALESCE(OLD.deposito_id, 0) <> COALESCE(NEW.deposito_id, 0) THEN
        -- Remove reserva do produto/depósito antigo
        v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);
        IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
          UPDATE public.estoque 
          SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
          WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END IF;

        -- Adiciona reserva ao produto/depósito novo
        v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
        IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
          INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
        END IF;

        IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
          UPDATE public.estoque 
          SET estoque_reservado = estoque_reservado + NEW.qt_movimento
          WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END IF;

      -- Se alterou apenas a quantidade ou o flag de entrega do mesmo produto
      ELSE
        v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
        IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
          INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
        END IF;

        -- Determina se o estado antigo e novo exigiam reserva
        DECLARE
          v_old_reserved boolean := v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S');
          v_new_reserved boolean := v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S');
        BEGIN
          IF v_old_reserved AND v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado + (NEW.qt_movimento - OLD.qt_movimento))
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          ELSIF v_old_reserved AND NOT v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          ELSIF NOT v_old_reserved AND v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = estoque_reservado + NEW.qt_movimento
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          END IF;
        END;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Associa o trigger à tabela movimento_item
DROP TRIGGER IF EXISTS tr_movimento_item_estoque_adjust ON public.movimento_item;
CREATE TRIGGER tr_movimento_item_estoque_adjust
AFTER INSERT OR UPDATE OR DELETE ON public.movimento_item
FOR EACH ROW
EXECUTE FUNCTION public.fn_tr_movimento_item_estoque_adjust();


-- 4. Registro da versão 1.18.30 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.30';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.30',
  'Correção das Regras de Reserva e Baixa de Estoque por Tipo de Entrega',
  'Ajustes nos fluxos de controle de estoque do PDV/Caixa. Distinção clara no faturamento, cancelamento e estorno de itens para entrega (flag entrega=S) e retirada cliente. Integração com a trigger de baixa oficial de estoque via estoque_log.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers', 'POS']
);
