-- Migration: 20260914190000_update_estorno_status_and_pdv_lock.sql
-- Description: Atualiza fu_estornar_pedido_sem_nfe para definir status 'EP' (ESTORNADO PARCIAL) ou 'E' (ESTORNADO TOTAL) e bloqueia o estorno no caixa via fu_pdv_estornar_venda se houver devolução prévia de itens.

-- 1. Atualização da RPC fu_estornar_pedido_sem_nfe
CREATE OR REPLACE FUNCTION public.fu_estornar_pedido_sem_nfe(
  _movimento_id bigint,
  _empresa_id bigint,
  _usuario_id uuid DEFAULT NULL::uuid,
  _opcao_dinheiro text DEFAULT NULL, -- 'ESPECIE' ou 'CREDITO'
  _itens jsonb DEFAULT '[]'::jsonb,   -- array of { movimento_item_id, produto_id, qt_devolver, deposito_id, vl_devolucao }
  _caixa_abertura_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_nfe RECORD;
  v_item jsonb;
  v_mov_item_id bigint;
  v_produto_id bigint;
  v_qt_devolver numeric;
  v_deposito_id bigint;
  v_vl_item_devolucao numeric;
  v_total_devolucao numeric := 0;
  v_cadastro_id bigint;
  v_meio_dinheiro boolean := false;
  v_vl_dinheiro_original numeric := 0;
  v_vl_dinheiro_estorno numeric := 0;
  v_rec_row RECORD;
  v_new_cm_id bigint;
  v_pendente_qtd numeric := 0;
  v_novo_st_pedido text;
BEGIN
  -- 1. Verifica existência do movimento
  SELECT * INTO v_mov 
  FROM public.movimento 
  WHERE movimento_id = _movimento_id 
    AND empresa_id = _empresa_id 
    AND excluido = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.');
  END IF;

  IF v_mov.st_pedido IN ('E', 'C') THEN
    RETURN jsonb_build_object('error', 'Este pedido já foi totalmente estornado ou cancelado.');
  END IF;

  v_cadastro_id := v_mov.cadastro_id;

  -- 2. Validação FISCAL: Impedir se houver NF-e vinculada emitida/autorizada
  SELECT * INTO v_nfe
  FROM public.fiscal_nfe_cabecalho
  WHERE movimento_id = _movimento_id
    AND empresa_id = _empresa_id
    AND st_nf IN ('E', '1') -- Emitida / Autorizada
    AND excluido = false
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'error', 
      'Este pedido possui a NF-e n° ' || COALESCE(v_nfe.nr_nota::text, '') || ' autorizada. Este fluxo é exclusivo para pedidos SEM NF-e. Utilize a Devolução de NF-e de Saída.'
    );
  END IF;

  -- 3. Identifica se o recebimento original envolveu DINHEIRO e soma o valor em dinheiro
  FOR v_rec_row IN
    SELECT cmi.meio_pagamento_id, COALESCE(cmi.vl_recebido, cmi.vl_parcela, 0) as valor, mp.soma_vl_caixa
    FROM public.caixa_movimento cm
    JOIN public.caixa_movimento_item cmi ON cmi.caixa_movimento_id = cm.caixa_movimento_id
    LEFT JOIN public.meio_pagamento mp ON mp.meio_pagamento_id = cmi.meio_pagamento_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false AND cmi.excluido = false
  LOOP
    IF v_rec_row.meio_pagamento_id = 1 OR UPPER(COALESCE(v_rec_row.soma_vl_caixa, 'N')) = 'S' THEN
      v_meio_dinheiro := true;
      v_vl_dinheiro_original := v_vl_dinheiro_original + GREATEST(0, v_rec_row.valor);
    END IF;
  END LOOP;

  -- Se não achou em caixa_movimento, verifica em movimento_pagamento
  IF NOT v_meio_dinheiro THEN
    FOR v_rec_row IN
      SELECT meio_pagamento_id, COALESCE(vl_parcelas, vl_pagamento, 0) as valor
      FROM public.movimento_pagamento 
      WHERE movimento_id = _movimento_id 
        AND meio_pagamento_id = 1 
        AND excluido = false
    LOOP
      v_meio_dinheiro := true;
      v_vl_dinheiro_original := v_vl_dinheiro_original + GREATEST(0, v_rec_row.valor);
    END LOOP;
  END IF;

  -- 4. Processa os itens e atualiza o estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_mov_item_id        := (v_item->>'movimento_item_id')::bigint;
    v_produto_id         := (v_item->>'produto_id')::bigint;
    v_qt_devolver        := (v_item->>'qt_devolver')::numeric;
    v_deposito_id        := COALESCE((v_item->>'deposito_id')::bigint, v_mov.deposito_id, 1);
    v_vl_item_devolucao  := (v_item->>'vl_devolucao')::numeric;

    IF v_qt_devolver > 0 THEN
      v_total_devolucao := v_total_devolucao + v_vl_item_devolucao;

      -- 4a. Atualiza qt_devolvido no movimento_item
      UPDATE public.movimento_item
      SET qt_devolvido = COALESCE(qt_devolvido, 0) + v_qt_devolver
      WHERE movimento_item_id = v_mov_item_id;

      -- 4b. Restaura o estoque
      IF NOT EXISTS (
        SELECT 1 FROM public.estoque 
        WHERE produto_id = v_produto_id 
          AND empresa_id = _empresa_id 
          AND deposito_id = v_deposito_id
      ) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (v_produto_id, _empresa_id, v_deposito_id, 0, 0);
      END IF;

      UPDATE public.estoque
      SET estoque_reservado = estoque_reservado + v_qt_devolver
      WHERE produto_id = v_produto_id 
        AND empresa_id = _empresa_id 
        AND deposito_id = v_deposito_id;

      -- 4c. Log de estoque
      INSERT INTO public.estoque_log (
        empresa_id, produto_id, deposito_id,
        qt_movimento, operacao, origem,
        nr_doc, usuario, dt_hs_log
      ) VALUES (
        _empresa_id, v_produto_id, v_deposito_id,
        v_qt_devolver,
        'DEVOLUCAO_PEDIDO_SEM_NFE', 'ESTORNO_SEM_NFE',
        _movimento_id::varchar, COALESCE(_usuario_id::varchar, 'SISTEMA'), now()
      );
    END IF;
  END LOOP;

  IF v_total_devolucao <= 0 THEN
    RETURN jsonb_build_object('error', 'Nenhum item com quantidade a devolver válida foi informado.');
  END IF;

  -- 5. Calcula a parcela exata em dinheiro a ser estornada
  v_vl_dinheiro_estorno := LEAST(v_total_devolucao, v_vl_dinheiro_original);

  -- Tratamento do valor em dinheiro (Espécie ou Crédito)
  IF v_meio_dinheiro AND v_vl_dinheiro_estorno > 0 THEN
    IF _opcao_dinheiro IS NULL OR _opcao_dinheiro NOT IN ('ESPECIE', 'CREDITO') THEN
      RETURN jsonb_build_object('error', 'Para recebimentos em dinheiro, é obrigatório selecionar entre DEVOLVER EM ESPÉCIE ou GERAR CRÉDITO PARA O CLIENTE.');
    END IF;

    IF _opcao_dinheiro = 'ESPECIE' THEN
      IF _caixa_abertura_id IS NULL THEN
        SELECT caixa_abertura_id INTO _caixa_abertura_id
        FROM public.caixa_abertura
        WHERE empresa_id = _empresa_id
          AND st_caixa = 'A'
          AND excluido = false
        ORDER BY caixa_abertura_id DESC
        LIMIT 1;

        IF _caixa_abertura_id IS NULL THEN
          RETURN jsonb_build_object('error', 'Não há caixa aberto disponível para registrar a saída em espécie.');
        END IF;
      END IF;

      -- Gera DÉBITO/SAÍDA no caixa SOMENTE para v_vl_dinheiro_estorno
      INSERT INTO public.caixa_movimento (
        empresa_id, funcionario_id, colaborador_id,
        dt_movimento, tp_movimento, tp_operacao,
        historico, vl_movimento,
        movimento_id, caixa_abertura_id,
        excluido, dt_cadastro, dt_alteracao
      ) VALUES (
        _empresa_id, NULL, NULL,
        CURRENT_DATE, 'S', 'S',
        'DEVOLUÇÃO EM ESPÉCIE - PEDIDO N° ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
        -v_vl_dinheiro_estorno,
        _movimento_id::integer, _caixa_abertura_id,
        false, now(), now()
      )
      RETURNING caixa_movimento_id INTO v_new_cm_id;

      INSERT INTO public.caixa_movimento_item (
        empresa_id, caixa_movimento_id,
        qt_parcela, vl_parcela, vl_recebido,
        meio_pagamento_id, excluido, dt_cadastro, dt_alteracao
      ) VALUES (
        _empresa_id, v_new_cm_id,
        1, -v_vl_dinheiro_estorno, -v_vl_dinheiro_estorno,
        1, false, now(), now()
      );

      UPDATE public.caixa_abertura
      SET vl_fechamento = GREATEST(0, COALESCE(vl_fechamento, 0) - v_vl_dinheiro_estorno)
      WHERE caixa_abertura_id = _caixa_abertura_id;

    ELSIF _opcao_dinheiro = 'CREDITO' THEN
      -- Gera CRÉDITO PARA O CLIENTE no extrato de créditos SOMENTE para v_vl_dinheiro_estorno
      IF v_cadastro_id IS NOT NULL THEN
        PERFORM public.fu_registrar_movimento_credito(
          _empresa_id            := _empresa_id,
          _cadastro_id           := v_cadastro_id,
          _tp_parceiro           := 'CLIENTE',
          _tp_movimento          := 'C',
          _vl_movimento          := v_vl_dinheiro_estorno,
          _origem_movimento      := 'ESTORNO_PEDIDO_SEM_NFE',
          _historico             := 'CRÉDITO DO CLIENTE GERADO POR ESTORNO SEM NF-E (PARCELA DINHEIRO R$ ' || to_char(v_vl_dinheiro_estorno, 'FM999G999G990D00') || ') DO PEDIDO N° ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
          _usuario_id            := _usuario_id,
          _movimento_id          := _movimento_id
        );
      END IF;
    END IF;
  END IF;

  -- 6. Atualiza st_pedido para 'E' (ESTORNADO TOTAL) ou 'EP' (ESTORNADO PARCIAL)
  SELECT COALESCE(SUM(GREATEST(0, COALESCE(qt_movimento, 0) - COALESCE(qt_devolvido, 0))), 0)
  INTO v_pendente_qtd
  FROM public.movimento_item
  WHERE movimento_id = _movimento_id AND excluido = false;

  IF v_pendente_qtd <= 0 THEN
    v_novo_st_pedido := 'E'; -- ESTORNADO TOTAL
  ELSE
    v_novo_st_pedido := 'EP'; -- ESTORNADO PARCIAL
  END IF;

  UPDATE public.movimento
  SET st_pedido = v_novo_st_pedido,
      dt_alteracao = now()
  WHERE movimento_id = _movimento_id;

  -- 7. Registro de Auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES (
    'movimento', 
    _movimento_id::text, 
    'ESTORNO_PEDIDO_SEM_NFE', 
    jsonb_build_object('st_pedido', v_mov.st_pedido), 
    jsonb_build_object(
      'opcao_dinheiro', _opcao_dinheiro, 
      'vl_total_devolucao', v_total_devolucao,
      'vl_dinheiro_estorno', v_vl_dinheiro_estorno,
      'meio_dinheiro', v_meio_dinheiro,
      'novo_st_pedido', v_novo_st_pedido
    ), 
    _usuario_id
  );

  RETURN jsonb_build_object(
    'success', true, 
    'vl_devolucao', v_total_devolucao,
    'vl_dinheiro_estorno', v_vl_dinheiro_estorno,
    'opcao_dinheiro', _opcao_dinheiro,
    'st_pedido', v_novo_st_pedido
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


-- 2. Atualização da RPC fu_pdv_estornar_venda (Bloqueia estorno de recebimento no caixa se já houver devolução de itens parcial/total)
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

  -- 2. Restaura estoque
  FOR v_item IN SELECT * FROM public.movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
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

  -- 4. Exclui lançamentos de caixa
  DELETE FROM public.caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM public.caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM public.caixa_movimento WHERE movimento_id = _movimento_id;

  -- 5. Exclui as baixas de financeiro_baixa vinculadas aos títulos do movimento
  DELETE FROM public.financeiro_baixa 
  WHERE financeiro_id IN (
    SELECT financeiro_id FROM public.financeiro WHERE movimento_id = _movimento_id
  );

  -- Retorna os títulos do financeiro para o status 'A' (ABERTO) com valor pago 0 e despesa 0
  UPDATE public.financeiro 
  SET status = 'A',
      vl_pago = 0,
      vl_despesa = 0,
      dt_alteracao = now()
  WHERE movimento_id = _movimento_id;

  -- 6. Atualiza o status do movimento para 'C' (CANCELADO NO CAIXA)
  UPDATE public.movimento 
  SET st_pedido = 'C',
      dt_cancelamento = now(),
      dt_alteracao = now()
  WHERE movimento_id = _movimento_id;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Recarrega esquema no PostgREST
NOTIFY pgrst, 'reload schema';
