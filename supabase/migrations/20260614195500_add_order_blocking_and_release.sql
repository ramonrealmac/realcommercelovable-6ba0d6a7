-- Migration: Add Order Blocking and Release Routine
-- Target Path: supabase/migrations/20260614195500_add_order_blocking_and_release.sql

-- 1) Adicionar os novos campos nas tabelas correspondentes (se não existirem)
ALTER TABLE public.empresa 
  ADD COLUMN IF NOT EXISTS bloquear_pedido character varying(1) NOT NULL DEFAULT 'N';

ALTER TABLE public.movimento 
  ADD COLUMN IF NOT EXISTS st_bloqueado character varying(1) NOT NULL DEFAULT 'N';

ALTER TABLE public.cadastro 
  ADD COLUMN IF NOT EXISTS bloqueia_cliente integer NOT NULL DEFAULT 3;

ALTER TABLE public.cadastro 
  ADD COLUMN IF NOT EXISTS vl_lim_credito numeric(16,2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.cadastro 
  ADD COLUMN IF NOT EXISTS qt_tit_aberto integer NOT NULL DEFAULT 0;

ALTER TABLE public.cadastro 
  ADD COLUMN IF NOT EXISTS qt_tit_vencido integer NOT NULL DEFAULT 0;


-- 2) Recriar a View vw_pedidos_caixa_union filtrando os pedidos que estiverem bloqueados
CREATE OR REPLACE VIEW public.vw_pedidos_caixa_union AS
SELECT 
  m.movimento_id,
  m.nr_movimento,
  m.cadastro_id,
  COALESCE(c.nome_fantasia, c.razao_social, '(Consumidor)')::text AS cliente_nome,
  m.funcionario_id AS vendedor_id,
  (SELECT f.nome FROM public.funcionario f WHERE f.funcionario_id = m.funcionario_id)::text AS vendedor_nome,
  m.vl_movimento,
  m.dt_emissao,
  false AS is_external,
  'LOCAL'::text AS origem
FROM public.movimento m
LEFT JOIN public.cadastro c ON c.cadastro_id = m.cadastro_id
LEFT JOIN public.empresa e ON e.empresa_id = m.empresa_id
WHERE m.st_pedido = 'F' 
  AND m.excluido = false
  -- Se a empresa bloqueia pedido e o pedido está bloqueado por crédito, não exibe no PDV/Caixa
  AND NOT (COALESCE(e.bloquear_pedido, 'N') = 'S' AND COALESCE(m.st_bloqueado, 'N') = 'S')

UNION ALL

SELECT 
  em.emovimento_id AS movimento_id,
  em.nr_movimento,
  em.cadastro_id,
  COALESCE(cl.razao_social, '(Consumidor Virtual)')::text AS cliente_nome,
  NULL::bigint AS vendedor_id,
  'Loja Virtual'::text AS vendedor_nome,
  em.vl_movimento,
  em.dt_emissao,
  true AS is_external,
  'VIRTUAL'::text AS origem
FROM public.emovimento em
LEFT JOIN public.cliente cl ON cl.id = em.cliente_id
WHERE em.st_pedido = 'R' 
  AND em.excluido = false;


-- 3) Sobrescrever a RPC fu_mudar_status_pedido_pdv para conter a lógica de análise de crédito ao faturar (status 'F')
CREATE OR REPLACE FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid DEFAULT NULL::uuid) 
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
                -- 1 = Sempre
                v_st_bloqueado := 'S';
            ELSIF v_bloqueia_cliente = 2 THEN
                -- 2 = Regra
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

        IF v_mov.st_pedido = 'O' THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
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
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
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
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento SET st_pedido = 'V', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 4: Tirar da Reserva (V -> O)
    ELSIF v_mov.st_pedido = 'V' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', st_bloqueado = 'N', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 5: FINALIZAR VENDA / RECEBER (F, O, V -> R)
    ELSIF _novo_status = 'R' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            -- Se estava no caixa (F) ou reservado (V), remove da reserva E do estoque físico
            IF v_mov.st_pedido IN ('F', 'V') THEN
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento,
                    estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            ELSE
                -- Se era venda direta (O), remove apenas do estoque físico
                UPDATE estoque 
                SET estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END IF;
        END LOOP;
        UPDATE movimento SET st_pedido = 'R', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 6: Cancelar (O, R, V, F -> C)
    ELSIF v_mov.st_pedido IN ('O', 'R', 'V', 'F') AND _novo_status = 'C' THEN
        IF v_mov.st_pedido IN ('R', 'V', 'F') THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END LOOP;
        END IF;
        UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now(), dt_alteracao = now() WHERE movimento_id = _movimento_id;

    ELSE
        RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
    END IF;

    -- Auditoria
    INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE_PDV', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);

    RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$$;


-- 4) Sobrescrever a RPC fu_pdv_registrar_recebimento_venda para bloquear recebimento de pedidos com st_bloqueado = 'S'
CREATE OR REPLACE FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid DEFAULT NULL::uuid) 
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
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END if;

  IF v_mov.st_pedido IN ('R', 'C') THEN
    RETURN jsonb_build_object('error', 'Pedido já recebido ou cancelado.');
  END IF;

  -- Validação de segurança dupla de crédito
  SELECT COALESCE(bloquear_pedido, 'N') INTO v_bloquear_pedido FROM public.empresa WHERE empresa_id = _empresa_id;
  IF v_bloquear_pedido = 'S' AND COALESCE(v_mov.st_bloqueado, 'N') = 'S' THEN
    RETURN jsonb_build_object('error', 'Este pedido está BLOQUEADO por análise de crédito e não pode ser recebido.');
  END IF;

  v_total_venda := v_mov.vl_movimento;

  -- 2. Limpa pagamentos anteriores do movimento (caso de pedido previamente no caixa)
  DELETE FROM movimento_pagamento WHERE movimento_id = _movimento_id;

  -- 3. Calcula total recebido e troco
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_total_recebido := v_total_recebido + (v_pag_row->>'vl_recebido')::numeric;
  END LOOP;

  v_troco := GREATEST(0, v_total_recebido - v_total_venda);

  -- 4. Grava movimento_pagamento
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    INSERT INTO movimento_pagamento (
      empresa_id, movimento_id, condicao_id, tp_pagamento, vl_pagamento, 
      nr_autorizacao, bandeira_id, operadora_id, n_parcelas, dt_pagamento
    ) VALUES (
      _empresa_id, _movimento_id, (v_pag_row->>'condicao_id')::bigint, v_pag_row->>'condicao_descricao', 
      (v_pag_row->>'vl_recebido')::numeric, COALESCE(v_pag_row->>'numero_autoriza', ''), 
      NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
      (v_pag_row->>'qt_parcela')::integer, now()
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

    -- Se tem troco e é dinheiro (meio_pagamento_id = 1), deduz do valor que entra no caixa
    IF v_troco > 0 AND v_meio_pagamento_id = 1 THEN
      v_pag_dinheiro_ajustado := GREATEST(0, v_pag_dinheiro_ajustado - v_troco);
      -- Consome o troco para nao deduzir de multiplos dinheiros se houver erro no front
      v_troco := 0; 
    END IF;

    -- Só insere no caixa se sobrou valor
    IF v_pag_dinheiro_ajustado > 0 THEN
      INSERT INTO caixa_movimento_item (
        caixa_movimento_id, empresa_id, condicao_id, prazo_pagamento_id,
        bandeira_id, operadora_id, numero_autoriza, qt_parcela, vl_parcela,
        vl_recebido, plano_conta_id, meio_pagamento_id, excluido
      ) VALUES (
        v_caixa_mov_id, _empresa_id, (v_pag_row->>'condicao_id')::bigint, 0,
        NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
        COALESCE(v_pag_row->>'numero_autoriza', ''), (v_pag_row->>'qt_parcela')::integer, 
        v_pag_dinheiro_ajustado / GREATEST(1, (v_pag_row->>'qt_parcela')::integer), -- Recalcula parcela
        v_pag_dinheiro_ajustado, NULLIF((v_pag_row->>'plano_conta_id')::text, '')::integer, v_meio_pagamento_id, false
      );

      -- 7. Soma ao caixa abertura se meio_pagamento.soma_vl_caixa = 'S'
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

  -- 9. Transição de status do PDV ('R' e baixa de estoque)
  PERFORM public.fu_mudar_status_pedido_pdv(_movimento_id, 'R', _usuario_id);

  -- Retorna sucesso
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
