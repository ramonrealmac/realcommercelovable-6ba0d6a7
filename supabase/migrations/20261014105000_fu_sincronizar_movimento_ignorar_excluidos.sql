-- Migration: Garantir que apenas itens ativos (excluido = false) sejam sincronizados no pedido
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

    -- Se a operação estiver configurada para NÃO gerar pedido (gera_pedido = 'N'), encerra sem criar movimento
    IF UPPER(COALESCE(v_op.gera_pedido, 'S')) = 'N' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Operação com gera_pedido = N. Pedido não gerado.');
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
        -- Recupera nr_movimento existente
        SELECT nr_movimento INTO v_nr_movimento
        FROM public.movimento
        WHERE movimento_id = v_movimento_id;

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

        -- Garante que pedido_id na nota aponte para o número do pedido (nr_movimento)
        IF v_nr_movimento IS NOT NULL THEN
            UPDATE public.fiscal_nfe_cabecalho
            SET pedido_id = v_nr_movimento
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
        END IF;
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

        -- Vincula de volta na nota: movimento_id com o ID e pedido_id com o número do pedido
        UPDATE public.fiscal_nfe_cabecalho
        SET movimento_id = v_movimento_id,
            pedido_id = v_nr_movimento
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;
    END IF;

    -- Sincroniza itens: Apenas itens ativos (excluido = false) entram no pedido
    DELETE FROM public.movimento_item WHERE movimento_id = v_movimento_id;

    FOR v_item IN 
        SELECT * FROM public.fiscal_nfe_item 
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
          AND (excluido = false OR excluido IS NULL)
        ORDER BY nr_item
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
        'nr_movimento', v_nr_movimento,
        'message', 'Movimento sincronizado com sucesso.'
    );
END;
$$;
