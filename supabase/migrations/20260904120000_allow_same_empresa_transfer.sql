-- Migration: Permite transferência de estoque entre depósitos da mesma filial
-- Descrição: Remove constraint chk_transferencia_empresa_diff e atualiza a validação de fu_finalizar_transferencia_estoque para permitir a mesma empresa_origem_id e empresa_destino_id desde que deposito_origem_id != deposito_destino_id

ALTER TABLE public.transferencia DROP CONSTRAINT IF EXISTS chk_transferencia_empresa_diff;
ALTER TABLE public.transferencia DROP CONSTRAINT IF EXISTS chk_transferencia_deposito_diff;
ALTER TABLE public.transferencia ADD CONSTRAINT chk_transferencia_deposito_diff CHECK (deposito_origem_id <> deposito_destino_id);

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

    -- Validar depósitos
    IF COALESCE(v_trans.deposito_origem_id, 0) = 0 OR COALESCE(v_trans.deposito_destino_id, 0) = 0 THEN
        RETURN jsonb_build_object('error', 'Selecione os depósitos de origem e destino.');
    END IF;

    IF v_trans.deposito_origem_id = v_trans.deposito_destino_id THEN
        RETURN jsonb_build_object('error', 'O depósito de origem deve ser diferente do depósito de destino.');
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

    -- 3. Revalidar estoque disponível de todos os produtos na origem (estoque_fisico - estoque_reservado)
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
                'error', 'Estoque disponível insuficiente para o produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || '. (Disponível: ' || v_estoque_disponivel || ', Solicitado: ' || v_item.qt_transferir || ')'
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
