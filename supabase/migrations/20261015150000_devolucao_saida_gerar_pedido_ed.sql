-- Migration: Gerar Pedido / Movimento tipo ED na Devolução de NF-e de Saída
-- File: supabase/migrations/20261015150000_devolucao_saida_gerar_pedido_ed.sql

-- 1. Cria a função fu_gerar_movimento_devolucao_nfe
CREATE OR REPLACE FUNCTION public.fu_gerar_movimento_devolucao_nfe(
    p_nfe_cabecalho_id bigint,
    p_movimento_origem_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cab record;
    v_op public.tp_operacao%ROWTYPE;
    v_movimento_id bigint;
    v_nr_movimento bigint;
    v_item record;
    v_cd_produto text;
    v_deposito_id bigint;
    v_origem_id bigint;
    v_obs text;
BEGIN
    -- Busca a nota fiscal de devolução
    SELECT * INTO v_cab 
    FROM public.fiscal_nfe_cabecalho 
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nota fiscal não encontrada.');
    END IF;

    -- Localiza a operação ED (Entrada Devolução)
    IF v_cab.tp_operacao_id IS NOT NULL THEN
        SELECT * INTO v_op 
        FROM public.tp_operacao 
        WHERE tp_operacao_id = v_cab.tp_operacao_id;
    END IF;

    IF v_op.tp_operacao_id IS NULL THEN
        SELECT * INTO v_op 
        FROM public.tp_operacao 
        WHERE empresa_id = v_cab.empresa_id 
          AND tp_movimento = 'ED' 
          AND (excluido = false OR excluido IS NULL)
        ORDER BY tp_operacao_id ASC LIMIT 1;
    END IF;

    IF v_op.tp_operacao_id IS NULL THEN
        SELECT * INTO v_op 
        FROM public.tp_operacao 
        WHERE tp_movimento = 'ED' 
          AND (excluido = false OR excluido IS NULL)
        ORDER BY tp_operacao_id ASC LIMIT 1;
    END IF;

    IF v_op.tp_operacao_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de operação ED (Entrada Devolução) não encontrado.');
    END IF;

    -- Atualiza tp_operacao_id no cabeçalho se ainda não estava preenchido
    IF v_cab.tp_operacao_id IS NULL OR v_cab.tp_operacao_id <> v_op.tp_operacao_id THEN
        UPDATE public.fiscal_nfe_cabecalho 
        SET tp_operacao_id = v_op.tp_operacao_id 
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
    END IF;

    -- Busca depósito válido
    v_deposito_id := v_cab.deposito_id;
    IF v_deposito_id IS NULL THEN
        SELECT deposito_id INTO v_deposito_id 
        FROM public.deposito 
        WHERE empresa_id = v_cab.empresa_id AND (excluido = false OR excluido IS NULL)
        ORDER BY deposito_id LIMIT 1;
    END IF;
    IF v_deposito_id IS NULL THEN
        SELECT deposito_id INTO v_deposito_id 
        FROM public.deposito 
        WHERE (excluido = false OR excluido IS NULL)
        ORDER BY deposito_id LIMIT 1;
    END IF;

    IF v_cab.deposito_id IS NULL AND v_deposito_id IS NOT NULL THEN
        UPDATE public.fiscal_nfe_cabecalho 
        SET deposito_id = v_deposito_id 
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
    END IF;

    -- Define pedido_origem_id
    v_origem_id := COALESCE(p_movimento_origem_id, 0);
    IF v_origem_id = 0 AND v_cab.pedido_id IS NOT NULL AND v_cab.pedido_id <> COALESCE(v_cab.movimento_id, 0) THEN
        v_origem_id := v_cab.pedido_id;
    END IF;

    -- Observação do pedido
    v_obs := COALESCE(NULLIF(TRIM(v_cab.obs_nf), ''), 'Devolução referente à NF-e de Saída');

    -- Verifica se já existe movimento vinculado
    v_movimento_id := v_cab.movimento_id;

    IF v_movimento_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.movimento WHERE movimento_id = v_movimento_id) THEN
        -- Atualiza movimento existente
        UPDATE public.movimento
        SET cadastro_id = v_cab.cadastro_id,
            deposito_id = v_deposito_id,
            tp_operacao_id = v_op.tp_operacao_id,
            tp_movimento = 'ED',
            dt_emissao = COALESCE(v_cab.dt_emissao, CURRENT_DATE),
            vl_produto = COALESCE(v_cab.vl_produto, 0),
            vl_desconto = COALESCE(v_cab.vl_desconto, 0),
            vl_movimento = COALESCE(v_cab.vl_total_nf, 0),
            numero_nfe = COALESCE(v_cab.nr_nota, ''),
            serie = COALESCE(NULLIF(regexp_replace(v_cab.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            st_pedido = CASE WHEN v_cab.st_nf = 'A' THEN 'F' ELSE 'A' END,
            faturado = CASE WHEN v_cab.st_nf = 'A' THEN 'S' ELSE 'N' END,
            pedido_origem_id = CASE WHEN v_origem_id > 0 THEN v_origem_id ELSE pedido_origem_id END,
            nota_fiscal_id = v_cab.nfe_cabecalho_id,
            dt_alteracao = now()
        WHERE movimento_id = v_movimento_id;
    ELSE
        -- Gera próximo número de movimento para a operação ED
        BEGIN
            v_nr_movimento := public.get_proximo_nr_movimento(v_cab.empresa_id::integer, v_op.tp_operacao_id::integer);
        EXCEPTION WHEN OTHERS THEN
            SELECT COALESCE(MAX(nr_movimento), 0) + 1 INTO v_nr_movimento
            FROM public.movimento
            WHERE empresa_id = v_cab.empresa_id AND tp_operacao_id = v_op.tp_operacao_id;
        END;

        IF v_nr_movimento IS NULL OR v_nr_movimento <= 0 THEN
            v_nr_movimento := 1;
        END IF;

        -- Insere novo movimento
        INSERT INTO public.movimento (
            empresa_id,
            cadastro_id,
            deposito_id,
            tp_operacao_id,
            tp_movimento,
            nr_movimento,
            dt_emissao,
            vl_produto,
            vl_desconto,
            vl_movimento,
            st_pedido,
            faturado,
            gerou_financeiro,
            pedido_origem_id,
            nota_fiscal_id,
            numero_nfe,
            serie,
            modelo_nf,
            observacao
        ) VALUES (
            v_cab.empresa_id,
            v_cab.cadastro_id,
            v_deposito_id,
            v_op.tp_operacao_id,
            'ED',
            v_nr_movimento,
            COALESCE(v_cab.dt_emissao, CURRENT_DATE),
            COALESCE(v_cab.vl_produto, 0),
            COALESCE(v_cab.vl_desconto, 0),
            COALESCE(v_cab.vl_total_nf, 0),
            CASE WHEN v_cab.st_nf = 'A' THEN 'F' ELSE 'A' END,
            CASE WHEN v_cab.st_nf = 'A' THEN 'S' ELSE 'N' END,
            'N',
            v_origem_id,
            v_cab.nfe_cabecalho_id,
            COALESCE(v_cab.nr_nota, ''),
            COALESCE(NULLIF(regexp_replace(v_cab.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            55,
            v_obs
        ) RETURNING movimento_id INTO v_movimento_id;

        -- Vincula de volta na nota fiscal
        UPDATE public.fiscal_nfe_cabecalho
        SET movimento_id = v_movimento_id,
            pedido_id = v_movimento_id,
            tp_operacao_id = v_op.tp_operacao_id
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
    END IF;

    -- Sincroniza itens
    DELETE FROM public.movimento_item WHERE movimento_id = v_movimento_id;

    FOR v_item IN 
        SELECT * FROM public.fiscal_nfe_item 
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
          AND (excluido = false OR excluido IS NULL)
        ORDER BY nr_item ASC
    LOOP
        SELECT cd_produto INTO v_cd_produto 
        FROM public.produto 
        WHERE produto_id = v_item.produto_id;

        INSERT INTO public.movimento_item (
            empresa_id,
            movimento_id,
            produto_id,
            cd_produto,
            nm_produto,
            unidade_id,
            tp_movimento,
            qt_movimento,
            vl_und_produto,
            vl_produto,
            vl_desconto,
            vl_movimento,
            deposito_id,
            cfop_id,
            entrega
        ) VALUES (
            v_cab.empresa_id,
            v_movimento_id,
            v_item.produto_id,
            COALESCE(v_cd_produto, v_item.cd_prod_fornec, ''),
            COALESCE(v_item.nm_produto, ''),
            COALESCE(v_item.unidade, 'UN'),
            'ED',
            COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 1),
            COALESCE(v_item.vl_unit, 0),
            COALESCE(v_item.vl_total, 0),
            COALESCE(v_item.vl_desconto, 0),
            COALESCE(v_item.vl_total, 0),
            COALESCE(v_item.deposito_id, v_deposito_id),
            v_item.cfop,
            'N'
        );
    END LOOP;

    -- Obtém o nr_movimento atual do movimento
    SELECT nr_movimento INTO v_nr_movimento FROM public.movimento WHERE movimento_id = v_movimento_id;

    RETURN jsonb_build_object(
        'success', true, 
        'movimento_id', v_movimento_id, 
        'nr_movimento', v_nr_movimento,
        'tp_operacao_id', v_op.tp_operacao_id
    );
END;
$$;

-- 2. Atualiza a trigger function fn_processa_nfe_estoque para integrar devoluções com fu_gerar_movimento_devolucao_nfe
CREATE OR REPLACE FUNCTION public.fn_processa_nfe_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

    -- TRATAMENTO ESPECIAL PARA DEVOLUÇÃO (fin_nfe = 4 E tp_nf = 0)
    IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
      PERFORM public.fu_gerar_movimento_devolucao_nfe(NEW.nfe_cabecalho_id);

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

      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := 'DEVOLUCAO_NFE';

    -- TRATAMENTO ESPECIAL SE TIVER tp_operacao_id (ex: Outras Notas)
    ELSIF NEW.tp_operacao_id IS NOT NULL THEN
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
        IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
          v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          v_op := COALESCE(v_tp_op_desc, 'DEVOLUÇÃO DE VENDAS');
        ELSIF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
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
    IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) OR NEW.tp_operacao_id IS NOT NULL THEN
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

      v_origem := CASE WHEN COALESCE(NEW.fin_nfe, 1) = 4 THEN 'DEVOLUCAO_NFE' ELSE 'OUTRAS_NOTAS' END;
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
        IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
          v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          v_op_estorno := 'ESTORNO ' || COALESCE(v_tp_op_desc, 'DEVOLUÇÃO DE VENDAS');
        ELSIF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
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
