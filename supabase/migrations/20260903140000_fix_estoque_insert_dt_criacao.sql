-- Migration: 20260903140000_fix_estoque_insert_dt_criacao.sql
-- Descrição: Remove coluna dt_criacao inexistente das inserções na tabela public.estoque nas RPCs

CREATE OR REPLACE FUNCTION public.fu_finalizar_transferencia_estoque(
    _transferencia_id bigint,
    _usuario_email text DEFAULT NULL::text
) RETURNS jsonb AS $$
DECLARE
    v_trans RECORD;
    v_item RECORD;
    v_estoque_fisico numeric;
    v_estoque_reservado numeric;
    v_estoque_disponivel numeric;
    v_user_email text;
    v_item_count int := 0;
BEGIN
    -- 1. Obter e bloquear a transferência (FOR UPDATE)
    SELECT * INTO v_trans
    FROM public.transferencia
    WHERE transferencia_id = _transferencia_id
      AND excluido = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Transferência de estoque não encontrada.');
    END IF;

    -- Verificar status
    IF v_trans.st_transferencia = 'FINALIZADA' THEN
        RETURN jsonb_build_object('error', 'A transferência já foi finalizada.');
    END IF;

    IF v_trans.st_transferencia != 'ABERTA' THEN
        RETURN jsonb_build_object('error', 'A transferência não está com status ABERTA.');
    END IF;

    -- Validar filiais
    IF v_trans.empresa_origem_id = v_trans.empresa_destino_id THEN
        RETURN jsonb_build_object('error', 'A filial de origem deve ser diferente da filial de destino.');
    END IF;

    -- Definir usuário
    v_user_email := COALESCE(_usuario_email, v_trans.usuario_cadastro, 'SISTEMA');

    -- 2. Validar que existe ao menos um item
    SELECT COUNT(*) INTO v_item_count
    FROM public.transferencia_item
    WHERE transferencia_id = _transferencia_id
      AND excluido = false;

    IF v_item_count = 0 THEN
        RETURN jsonb_build_object('error', 'Informe pelo menos um produto.');
    END IF;

    -- 3. Revalidar estoque disponível de todos os produtos na origem
    FOR v_item IN
        SELECT ti.*, p.nome as nm_produto
        FROM public.transferencia_item ti
        JOIN public.produto p ON p.produto_id = ti.produto_id
        WHERE ti.transferencia_id = _transferencia_id
          AND ti.excluido = false
    LOOP
        IF v_item.qt_transferir <= 0 THEN
            RETURN jsonb_build_object('error', 'A quantidade deve ser maior que zero.');
        END IF;

        -- Buscar estoque na origem
        SELECT COALESCE(estoque_fisico, 0), COALESCE(estoque_reservado, 0)
        INTO v_estoque_fisico, v_estoque_reservado
        FROM public.estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_trans.deposito_origem_id
          AND empresa_id = v_trans.empresa_origem_id;

        IF v_estoque_fisico IS NULL THEN
            v_estoque_fisico := 0;
            v_estoque_reservado := 0;
        END IF;

        v_estoque_disponivel := v_estoque_fisico - v_estoque_reservado;

        IF v_estoque_disponivel < v_item.qt_transferir THEN
            RETURN jsonb_build_object(
                'error', 'Estoque disponível insuficiente para o produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || '.'
            );
        END IF;
    END LOOP;

    -- 4. Processar a movimentação no estoque_log
    FOR v_item IN
        SELECT ti.*
        FROM public.transferencia_item ti
        WHERE ti.transferencia_id = _transferencia_id
          AND ti.excluido = false
    LOOP
        -- Garantir que existe o registro de estoque na filial/depósito de destino
        IF NOT EXISTS (
            SELECT 1 FROM public.estoque
            WHERE produto_id = v_item.produto_id
              AND deposito_id = v_trans.deposito_destino_id
              AND empresa_id = v_trans.empresa_destino_id
        ) THEN
            INSERT INTO public.estoque (
                empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado, dt_alteracao
            ) VALUES (
                v_trans.empresa_destino_id, v_item.produto_id, v_trans.deposito_destino_id, 0, 0, now()
            );
        END IF;

        -- 4.1 Inserir Saída na Filial/Depósito de Origem
        INSERT INTO public.estoque_log (
            empresa_id,
            produto_id,
            deposito_id,
            qt_movimento,
            usuario,
            dt_hs_log,
            operacao,
            origem,
            nr_doc
        ) VALUES (
            v_trans.empresa_origem_id,
            v_item.produto_id,
            v_trans.deposito_origem_id,
            -v_item.qt_transferir,
            v_user_email,
            now(),
            'SAIDA',
            'TRANSFERENCIA_ESTOQUE',
            COALESCE(v_trans.nr_transferencia::text, _transferencia_id::text)
        );

        -- 4.2 Inserir Entrada na Filial/Depósito de Destino
        INSERT INTO public.estoque_log (
            empresa_id,
            produto_id,
            deposito_id,
            qt_movimento,
            usuario,
            dt_hs_log,
            operacao,
            origem,
            nr_doc
        ) VALUES (
            v_trans.empresa_destino_id,
            v_item.produto_id,
            v_trans.deposito_destino_id,
            +v_item.qt_transferir,
            v_user_email,
            now(),
            'ENTRADA',
            'TRANSFERENCIA_ESTOQUE',
            COALESCE(v_trans.nr_transferencia::text, _transferencia_id::text)
        );
    END LOOP;

    -- 5. Atualizar o status do cabeçalho da transferência
    UPDATE public.transferencia
    SET st_transferencia = 'FINALIZADA',
        dt_finalizacao = now(),
        usuario_finalizacao = v_user_email
    WHERE transferencia_id = _transferencia_id;

    RETURN jsonb_build_object('success', true, 'message', 'Transferência finalizada com sucesso.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'Não foi possível finalizar a transferência. Nenhuma movimentação foi realizada: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Corrigir também fu_finalizar_ajuste_estoque
CREATE OR REPLACE FUNCTION public.fu_finalizar_ajuste_estoque(
    _movimento_id bigint,
    _usuario_id uuid DEFAULT NULL::uuid
) RETURNS jsonb AS $$
DECLARE
    v_mov RECORD;
    v_item RECORD;
    v_estoque_atual numeric;
    v_qt_fisica numeric;
    v_usuario_email text;
BEGIN
    SELECT * INTO v_mov
    FROM movimento
    WHERE movimento_id = _movimento_id
      AND excluido = false
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Movimento de ajuste não encontrado.');
    END IF;

    IF v_mov.st_pedido = 'F' THEN
        RETURN jsonb_build_object('error', 'O ajuste de estoque já foi finalizado.');
    END IF;

    SELECT email INTO v_usuario_email
    FROM auth.users
    WHERE id = _usuario_id;
    
    IF v_usuario_email IS NULL THEN
        v_usuario_email := 'SISTEMA';
    END IF;

    FOR v_item IN 
        SELECT * 
        FROM movimento_item 
        WHERE movimento_id = _movimento_id 
          AND excluido = false
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM estoque
            WHERE produto_id = v_item.produto_id
              AND deposito_id = v_item.deposito_id
              AND empresa_id = v_mov.empresa_id
        ) THEN
            INSERT INTO estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado, dt_alteracao)
            VALUES (v_mov.empresa_id, v_item.produto_id, v_item.deposito_id, 0, 0, now());
        END IF;

        SELECT COALESCE(estoque_fisico, 0) INTO v_estoque_atual
        FROM estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_item.deposito_id
          AND empresa_id = v_mov.empresa_id;

        IF v_item.tp_ajs_estoque = 'A' THEN
            v_qt_fisica := v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'R' THEN
            v_qt_fisica := -v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'M' THEN
            v_qt_fisica := v_item.qt_movimento - v_estoque_atual;
        END IF;

        INSERT INTO estoque_log (
            empresa_id,
            produto_id,
            deposito_id,
            qt_movimento,
            usuario,
            operacao,
            origem,
            nr_doc,
            dt_hs_log
        ) VALUES (
            v_mov.empresa_id,
            v_item.produto_id,
            v_item.deposito_id,
            v_qt_fisica,
            v_usuario_email,
            'AJUSTE',
            'AJUSTE_ESTOQUE',
            COALESCE(v_mov.nr_movimento::text, v_mov.movimento_id::text),
            now()
        );
    END LOOP;

    UPDATE movimento 
    SET st_pedido = 'F',
        dt_finalizacao = now(),
        dt_alteracao = now()
    WHERE movimento_id = _movimento_id;

    INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES (
        'movimento', 
        _movimento_id::text, 
        'FINALIZAR_AJUSTE_ESTOQUE', 
        jsonb_build_object('st_pedido', v_mov.st_pedido), 
        jsonb_build_object('st_pedido', 'F'), 
        _usuario_id
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ajuste de estoque finalizado com sucesso!');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', 'Não foi possível finalizar o ajuste. Nenhuma movimentação foi realizada: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
