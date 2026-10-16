-- Fix fn_processa_nfe_estoque to prevent error: record "v_tp_op" is not assigned yet
CREATE OR REPLACE FUNCTION public.fn_processa_nfe_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_item RECORD;
  v_ja_debited BOOLEAN := false;
  v_deposito_id bigint;
  v_qt_mov numeric;
  v_op varchar;
  v_op_estorno varchar;
  v_tp_op_desc varchar := NULL;
  v_tp_op_altera varchar := NULL;
  v_origem varchar := 'NF-E';
BEGIN
  -- 1. NOTA FISCAL AUTORIZADA ('A')
  IF (
    (TG_OP = 'INSERT' AND NEW.st_nf = 'A') OR
    (TG_OP = 'UPDATE' AND NEW.st_nf = 'A' AND COALESCE(OLD.st_nf, '') <> 'A')
  ) THEN

    -- TRATAMENTO ESPECIAL SE TIVER tp_operacao_id (ex: Outras Notas)
    IF NEW.tp_operacao_id IS NOT NULL THEN
      -- Sincroniza o movimento
      PERFORM public.fu_sincronizar_movimento_outras_notas(NEW.nfe_cabecalho_id);

      IF NEW.movimento_id IS NOT NULL THEN
        UPDATE public.movimento
        SET faturado = 'S',
            st_pedido = 'F',
            numero_nfe = COALESCE(NEW.nr_nota, ''),
            serie = COALESCE(NULLIF(regexp_replace(NEW.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            dt_faturamento = now(),
            dt_alteracao = now()
        WHERE movimento_id = NEW.movimento_id;
      END IF;

      SELECT descricao, altera_estoque 
      INTO v_tp_op_desc, v_tp_op_altera
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      -- Se a operação estiver configurada para NÃO alterar estoque, encerra aqui
      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := 'OUTRAS_NOTAS';
    ELSE
      -- Regra padrão para notas de compra
      IF (COALESCE(NEW.tp_nf, 1) = 0 AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
        RETURN NEW;
      END IF;

      -- Verifica se já foi baixado pelo caixa/PDV em caso de venda normal
      IF (NEW.movimento_id IS NOT NULL AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.caixa_movimento 
          WHERE movimento_id = NEW.movimento_id 
            AND excluido = false
        ) INTO v_ja_debited;
      END IF;

      IF v_ja_debited THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Movimenta itens no estoque
    FOR v_item IN 
      SELECT * FROM public.fiscal_nfe_item 
      WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
        AND excluido = false
    LOOP
      v_deposito_id := COALESCE(v_item.deposito_id, NEW.deposito_id);
      IF (v_deposito_id IS NULL) THEN
        SELECT deposito_id INTO v_deposito_id FROM public.deposito 
        WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
      END IF;

      IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.estoque 
          WHERE empresa_id = NEW.empresa_id AND produto_id = v_item.produto_id AND deposito_id = v_deposito_id
        ) THEN
          INSERT INTO public.estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.empresa_id, v_item.produto_id, v_deposito_id, 0, 0);
        END IF;

        -- Determina a operação e a direção do saldo (+ ou -)
        IF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
          v_op := v_tp_op_desc;
          IF (NEW.tp_nf = 1) THEN
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          ELSE
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          END IF;
        ELSIF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
          IF (NEW.tp_nf = 0) THEN
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'DEVOLUCAO_VENDA';
          ELSE
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'DEVOLUCAO_COMPRA';
          END IF;
        ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
          v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
          v_op := 'VENDA';
        ELSE
          CONTINUE;
        END IF;

        INSERT INTO public.estoque_log (
          empresa_id, produto_id, deposito_id,
          qt_movimento, operacao, origem,
          nr_doc, usuario, dt_hs_log
        ) VALUES (
          NEW.empresa_id, v_item.produto_id, v_deposito_id,
          v_qt_mov,
          v_op, v_origem,
          COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
          'SISTEMA', now()
        );
      END IF;
    END LOOP;

  -- 2. NOTA FISCAL CANCELADA ('C')
  ELSIF (TG_OP = 'UPDATE' AND NEW.st_nf = 'C' AND COALESCE(OLD.st_nf, '') = 'A') THEN
    IF NEW.tp_operacao_id IS NOT NULL THEN
      IF NEW.movimento_id IS NOT NULL THEN
        UPDATE public.movimento
        SET faturado = 'N',
            st_pedido = 'C',
            dt_cancelamento = now(),
            motivo_cancelamento = COALESCE(NEW.motivo_cancelamento, 'Cancelamento da NF-e'),
            dt_alteracao = now()
        WHERE movimento_id = NEW.movimento_id;
      END IF;

      SELECT descricao, altera_estoque 
      INTO v_tp_op_desc, v_tp_op_altera
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := 'OUTRAS_NOTAS';
    ELSE
      IF (COALESCE(NEW.tp_nf, 1) = 0 AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
        RETURN NEW;
      END IF;

      IF (NEW.movimento_id IS NOT NULL AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.caixa_movimento 
          WHERE movimento_id = NEW.movimento_id 
            AND excluido = false
        ) INTO v_ja_debited;
      END IF;

      IF v_ja_debited THEN
        RETURN NEW;
      END IF;
    END IF;

    FOR v_item IN 
      SELECT * FROM public.fiscal_nfe_item 
      WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
        AND excluido = false
    LOOP
      v_deposito_id := COALESCE(v_item.deposito_id, NEW.deposito_id);
      IF (v_deposito_id IS NULL) THEN
        SELECT deposito_id INTO v_deposito_id FROM public.deposito 
        WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
      END IF;

      IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
        IF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
          v_op_estorno := 'ESTORNO ' || v_tp_op_desc;
          IF (NEW.tp_nf = 1) THEN
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          ELSE
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          END IF;
        ELSIF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
          IF (NEW.tp_nf = 0) THEN
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_DEVOLUCAO_VENDA';
          ELSE
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_DEVOLUCAO_COMPRA';
          END IF;
        ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
          v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
          v_op_estorno := 'ESTORNO_VENDA';
        ELSE
          CONTINUE;
        END IF;

        INSERT INTO public.estoque_log (
          empresa_id, produto_id, deposito_id,
          qt_movimento, operacao, origem,
          nr_doc, usuario, dt_hs_log
        ) VALUES (
          NEW.empresa_id, v_item.produto_id, v_deposito_id,
          v_qt_mov,
          v_op_estorno, v_origem,
          COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
          'SISTEMA', now()
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
