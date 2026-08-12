-- Migration: 20260811152000_preserve_movimento_pagamento_on_estorno.sql
-- Description: Updates fu_pdv_estornar_venda so that estorno removes payments from cash register and financeiro_consolidado, reverts financeiro titles to status A (ABERTO), BUT preserves movimento_pagamento intact.

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

  -- 4. Exclui lançamentos de caixa
  DELETE FROM caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM caixa_movimento WHERE movimento_id = _movimento_id;

  -- 5. Exclui as baixas de financeiro_baixa vinculadas aos títulos do movimento
  -- Isso aciona o trigger fu_financeiro_baixa_consolidacao(), que remove os registros de financeiro_consolidado
  DELETE FROM public.financeiro_baixa 
  WHERE financeiro_id IN (
    SELECT financeiro_id FROM public.financeiro WHERE movimento_id = _movimento_id
  );

  -- Retorna os títulos do financeiro para o status 'A' (ABERTO) com valor pago 0 e despesa 0
  UPDATE public.financeiro
  SET status = 'A',
      vl_pago = 0,
      vl_despesa = 0
  WHERE movimento_id = _movimento_id;

  -- OBSERVAÇÃO CRÍTICA: NÃO EXCLUI movimento_pagamento!
  -- As formas de pagamento gravadas no pedido/movimento são mantidas intactas.

  -- 6. Atualiza o status do pedido de volta para 'F' (No Caixa / Aberto)
  UPDATE movimento 
  SET st_pedido = 'F', 
      dt_alteracao = now() 
  WHERE movimento_id = _movimento_id;

  -- 7. Auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_ESTORNO_PDV', jsonb_build_object('status', 'R'), jsonb_build_object('status', 'F'), _usuario_id);

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
