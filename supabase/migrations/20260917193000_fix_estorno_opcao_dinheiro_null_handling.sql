-- Migration: 20260917193000_fix_estorno_opcao_dinheiro_null_handling.sql
-- Description: Garante que fu_estornar_pedido_sem_nfe não falhe quando _opcao_dinheiro for nulo (definindo 'ESPECIE' como fallback) e assegura a atualização de st_pedido para 'E' ou 'EP'.

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
  v_vl_outros_estorno numeric := 0;
  v_rec_row RECORD;
  v_new_cm_id bigint;
  v_pendente_qtd numeric := 0;
  v_novo_st_pedido text;
  v_funcionario_id integer := 0;
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

  -- 3. Identifica se o recebimento original envolveu DINHEIRO
  FOR v_rec_row IN
    SELECT 
      cmi.meio_pagamento_id, 
      COALESCE(cmi.vl_recebido, cmi.vl_parcela, 0) as valor, 
      mp.soma_vl_caixa,
      cp.descricao as cond_desc
    FROM public.caixa_movimento cm
    JOIN public.caixa_movimento_item cmi ON cmi.caixa_movimento_id = cm.caixa_movimento_id
    LEFT JOIN public.meio_pagamento mp ON mp.meio_pagamento_id = cmi.meio_pagamento_id
    LEFT JOIN public.condicao_pagamento cp ON cp.condicao_id = cmi.condicao_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false AND cmi.excluido = false
  LOOP
    IF v_rec_row.meio_pagamento_id = 1 
       OR UPPER(COALESCE(v_rec_row.soma_vl_caixa, 'N')) = 'S' THEN
      v_meio_dinheiro := true;
      v_vl_dinheiro_original := v_vl_dinheiro_original + GREATEST(0, v_rec_row.valor);
    END IF;
  END LOOP;

  -- Se não achou em caixa_movimento, verifica em movimento_pagamento
  IF v_vl_dinheiro_original = 0 THEN
    FOR v_rec_row IN
      SELECT 
        cp.meio_pagamento_id, 
        COALESCE(mp.vl_parcelas, mp.vl_pagamento, 0) as valor
      FROM public.movimento_pagamento mp
      LEFT JOIN public.condicao_pagamento cp ON cp.condicao_id = mp.condicao_id
      WHERE mp.movimento_id = _movimento_id 
        AND mp.excluido = false
    LOOP
      IF v_rec_row.meio_pagamento_id = 1 THEN
        v_meio_dinheiro := true;
        v_vl_dinheiro_original := v_vl_dinheiro_original + GREATEST(0, v_rec_row.valor);
      END IF;
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

  -- 5. Calcula as parcelas exatas em Dinheiro/Crédito e Outros Meios
  v_vl_dinheiro_estorno := LEAST(v_total_devolucao, v_vl_dinheiro_original);
  v_vl_outros_estorno   := GREATEST(0, v_total_devolucao - v_vl_dinheiro_estorno);

  -- 5a. Tratamento do valor em Dinheiro / Crédito do Cliente
  IF v_meio_dinheiro AND v_vl_dinheiro_estorno > 0 THEN
    IF _opcao_dinheiro IS NULL OR _opcao_dinheiro NOT IN ('ESPECIE', 'CREDITO') THEN
      _opcao_dinheiro := 'ESPECIE';
    END IF;

    IF _opcao_dinheiro = 'ESPECIE' THEN
      IF _caixa_abertura_id IS NULL THEN
        SELECT caixa_abertura_id INTO _caixa_abertura_id
        FROM public.caixa_abertura
        WHERE empresa_id = _empresa_id
          AND status = 'A'
          AND dt_abertura = CURRENT_DATE
        ORDER BY caixa_abertura_id DESC
        LIMIT 1;

        IF _caixa_abertura_id IS NULL THEN
          SELECT caixa_abertura_id INTO _caixa_abertura_id
          FROM public.caixa_abertura
          WHERE empresa_id = _empresa_id
            AND status = 'A'
          ORDER BY caixa_abertura_id DESC
          LIMIT 1;
        END IF;

        IF _caixa_abertura_id IS NULL THEN
          RETURN jsonb_build_object('error', 'Não há caixa aberto disponível para registrar a saída em espécie.');
        END IF;
      END IF;

      SELECT funcionario_id INTO v_funcionario_id
      FROM public.caixa_abertura
      WHERE caixa_abertura_id = _caixa_abertura_id;

      v_funcionario_id := COALESCE(v_funcionario_id, v_mov.funcionario_id, 0);

      INSERT INTO public.caixa_movimento (
        empresa_id, funcionario_id, colaborador_id,
        dt_movimento, tp_movimento, tp_operacao,
        historico, vl_movimento,
        movimento_id, caixa_abertura_id,
        excluido, dt_cadastro, dt_alteracao
      ) VALUES (
        _empresa_id, v_funcionario_id, v_funcionario_id,
        CURRENT_DATE, 'S', 'S',
        'DEVOLUÇÃO EM ESPÉCIE - PEDIDO ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
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
      IF v_cadastro_id IS NOT NULL THEN
        PERFORM public.fu_registrar_movimento_credito(
          _empresa_id            := _empresa_id,
          _cadastro_id           := v_cadastro_id,
          _tp_parceiro           := 'CLIENTE',
          _tp_movimento          := 'C',
          _vl_movimento          := v_vl_dinheiro_estorno,
          _origem_movimento      := 'ESTORNO_PEDIDO_SEM_NFE',
          _historico             := 'CRÉDITO DO CLIENTE GERADO POR ESTORNO SEM NF-E (R$ ' || to_char(v_vl_dinheiro_estorno, 'FM999G999G990D00') || ') DO PEDIDO ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
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
      'vl_outros_estorno', v_vl_outros_estorno,
      'meio_dinheiro', v_meio_dinheiro,
      'estorno_total', (v_pendente_qtd <= 0)
    ), 
    _usuario_id
  );

  RETURN jsonb_build_object(
    'success', true, 
    'vl_devolucao', v_total_devolucao,
    'vl_dinheiro_estorno', v_vl_dinheiro_estorno,
    'vl_outros_estorno', v_vl_outros_estorno,
    'opcao_dinheiro', _opcao_dinheiro,
    'st_pedido', v_novo_st_pedido
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

NOTIFY pgrst, 'reload schema';
