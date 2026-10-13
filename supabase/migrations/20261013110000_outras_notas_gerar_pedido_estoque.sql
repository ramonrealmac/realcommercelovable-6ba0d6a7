-- Migration: Add tp_operacao_id to fiscal_nfe_cabecalho, create sync routine and unify stock trigger

-- 1. Coluna tp_operacao_id em fiscal_nfe_cabecalho
ALTER TABLE public.fiscal_nfe_cabecalho 
ADD COLUMN IF NOT EXISTS tp_operacao_id bigint;

CREATE INDEX IF NOT EXISTS ix_nfe_cabecalho_tp_operacao 
ON public.fiscal_nfe_cabecalho (tp_operacao_id);

-- 2. Função para sincronizar Pedido / Movimento a partir de Outras Notas
CREATE OR REPLACE FUNCTION public.fu_sincronizar_movimento_outras_notas(p_nfe_cabecalho_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cab record;
    v_op record;
    v_movimento_id bigint;
    v_nr_movimento bigint;
    v_item record;
    v_cd_produto text;
    v_deposito_id bigint;
BEGIN
    -- Busca a nota fiscal
    SELECT * INTO v_cab 
    FROM public.fiscal_nfe_cabecalho 
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nota fiscal não encontrada.');
    END IF;

    -- Se não tiver tp_operacao_id definido, não gera pedido
    IF v_cab.tp_operacao_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Sem tp_operacao_id configurado, pedido não gerado.');
    END IF;

    -- Busca o tipo de operação
    SELECT * INTO v_op 
    FROM public.tp_operacao 
    WHERE tp_operacao_id = v_cab.tp_operacao_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de operação não encontrado.');
    END IF;

    -- Busca depósito válido para a empresa
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

    -- Verifica se já existe movimento vinculado
    v_movimento_id := v_cab.movimento_id;

    IF v_movimento_id IS NOT NULL THEN
        -- Atualiza movimento existente
        UPDATE public.movimento
        SET cadastro_id = v_cab.cadastro_id,
            deposito_id = v_deposito_id,
            tp_operacao_id = v_cab.tp_operacao_id,
            tp_movimento = COALESCE(v_op.tp_movimento, 'PD'),
            dt_emissao = COALESCE(v_cab.dt_emissao, CURRENT_DATE),
            vl_produto = COALESCE(v_cab.vl_produto, 0),
            vl_desconto = COALESCE(v_cab.vl_desconto, 0),
            vl_movimento = COALESCE(v_cab.vl_total_nf, 0),
            numero_nfe = COALESCE(v_cab.nr_nota, ''),
            serie = COALESCE(NULLIF(regexp_replace(v_cab.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            st_pedido = CASE WHEN v_cab.st_nf = 'A' THEN 'F' ELSE 'A' END,
            faturado = CASE WHEN v_cab.st_nf = 'A' THEN 'S' ELSE 'N' END,
            dt_alteracao = now()
        WHERE movimento_id = v_movimento_id;
    ELSE
        -- Gera próximo número de movimento
        BEGIN
            v_nr_movimento := public.get_proximo_nr_movimento(v_cab.empresa_id::integer, v_cab.tp_operacao_id::integer);
        EXCEPTION WHEN OTHERS THEN
            SELECT COALESCE(MAX(nr_movimento), 0) + 1 INTO v_nr_movimento
            FROM public.movimento
            WHERE empresa_id = v_cab.empresa_id AND tp_operacao_id = v_cab.tp_operacao_id;
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
            nota_fiscal_id,
            numero_nfe,
            serie,
            modelo_nf,
            observacao
        ) VALUES (
            v_cab.empresa_id,
            v_cab.cadastro_id,
            v_deposito_id,
            v_cab.tp_operacao_id,
            COALESCE(v_op.tp_movimento, 'PD'),
            v_nr_movimento,
            COALESCE(v_cab.dt_emissao, CURRENT_DATE),
            COALESCE(v_cab.vl_produto, 0),
            COALESCE(v_cab.vl_desconto, 0),
            COALESCE(v_cab.vl_total_nf, 0),
            CASE WHEN v_cab.st_nf = 'A' THEN 'F' ELSE 'A' END,
            CASE WHEN v_cab.st_nf = 'A' THEN 'S' ELSE 'N' END,
            'N', -- Não gera financeiro conforme regra definida
            v_cab.nfe_cabecalho_id,
            COALESCE(v_cab.nr_nota, ''),
            COALESCE(NULLIF(regexp_replace(v_cab.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            55,
            'Gerado a partir de Outras Notas - ' || COALESCE(v_op.descricao, '')
        ) RETURNING movimento_id INTO v_movimento_id;

        -- Vincula de volta na nota
        UPDATE public.fiscal_nfe_cabecalho
        SET movimento_id = v_movimento_id,
            pedido_id = v_movimento_id
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
    END IF;

    -- Sincroniza itens
    DELETE FROM public.movimento_item WHERE movimento_id = v_movimento_id;

    FOR v_item IN 
        SELECT * FROM public.fiscal_nfe_item 
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
    LOOP
        -- Busca cd_produto se existir na tabela produto
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
            cfop_id
        ) VALUES (
            v_cab.empresa_id,
            v_movimento_id,
            v_item.produto_id,
            COALESCE(v_cd_produto, v_item.cd_prod_fornec, ''),
            COALESCE(v_item.nm_produto, ''),
            COALESCE(v_item.unidade, 'UN'),
            COALESCE(v_op.tp_movimento, 'PD'),
            COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 1),
            COALESCE(v_item.vl_unit, 0),
            COALESCE(v_item.vl_total, 0),
            COALESCE(v_item.vl_desconto, 0),
            COALESCE(v_item.vl_total, 0),
            v_deposito_id,
            v_item.cfop
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'movimento_id', v_movimento_id, 
        'nr_movimento', v_nr_movimento
    );
END;
$$;

-- 3. Remove trigger secundária para evitar qualquer duplicação
DROP TRIGGER IF EXISTS tr_nfe_cabecalho_autorizacao_estoque ON public.fiscal_nfe_cabecalho;
DROP FUNCTION IF EXISTS public.fu_nfe_cabecalho_autorizacao_estoque();

-- 4. Função unificada de processamento de estoque para fiscal_nfe_cabecalho
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
  v_tp_op RECORD;
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

      SELECT * INTO v_tp_op 
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      -- Se a operação estiver configurada para NÃO alterar estoque, encerra aqui
      IF FOUND AND v_tp_op.altera_estoque = 'N' THEN
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
        IF NEW.tp_operacao_id IS NOT NULL AND v_tp_op.descricao IS NOT NULL THEN
          v_op := v_tp_op.descricao;
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

      SELECT * INTO v_tp_op 
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      IF FOUND AND v_tp_op.altera_estoque = 'N' THEN
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
        IF NEW.tp_operacao_id IS NOT NULL AND v_tp_op.descricao IS NOT NULL THEN
          v_op_estorno := 'ESTORNO ' || v_tp_op.descricao;
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
