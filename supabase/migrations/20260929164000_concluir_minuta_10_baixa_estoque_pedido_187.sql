-- Migration: 20260929164000_concluir_minuta_10_baixa_estoque_pedido_187.sql
-- Description: Conclui a Minuta de Cargas Montadas Nº 10 (entrega_id = 14), atualiza o status dos pedidos sem nota e efetua a baixa física e de reserva do estoque para o Pedido 187.

DO $$
DECLARE
    v_entrega_id bigint := 14;
    v_movimento_id bigint := 330; -- Pedido 187
    v_empresa_id bigint := 5;
    v_deposito_id bigint := 5;
    v_produto_id bigint := 81376;
    v_qtd numeric := 2;
    v_est_id bigint;
BEGIN
    -- 1. Atualizar a Minuta 10 para status = 'Concluida'
    UPDATE public.entrega
    SET status = 'Concluida',
        dt_fim = COALESCE(dt_fim, now()),
        dt_alteracao = now()
    WHERE entrega_id = v_entrega_id OR cd_entrega = 10;

    -- 2. Atualizar o movimento do Pedido 187 para faturado = 'S' (concluído sem nota)
    UPDATE public.movimento
    SET faturado = 'S',
        dt_alteracao = now()
    WHERE movimento_id = v_movimento_id;

    -- 3. Atualizar estoque reservado e físico do Produto 81376 no depósito 5
    SELECT estoque_id
    INTO v_est_id
    FROM public.estoque
    WHERE produto_id = v_produto_id 
      AND empresa_id = v_empresa_id 
      AND deposito_id = v_deposito_id
    LIMIT 1;

    IF v_est_id IS NOT NULL THEN
        UPDATE public.estoque
        SET estoque_reservado = GREATEST(0, estoque_reservado - v_qtd),
            estoque_fisico = GREATEST(0, estoque_fisico - v_qtd),
            dt_ult_saida = now(),
            dt_alteracao = now()
        WHERE estoque_id = v_est_id;
    END IF;

    -- 4. Registrar o log de movimentação de saída de estoque
    INSERT INTO public.estoque_log (
        empresa_id,
        produto_id,
        deposito_id,
        qt_movimento,
        operacao,
        origem,
        nr_doc,
        usuario,
        dt_hs_log,
        qt_estoque_geral,
        qt_estoque_deposito
    ) VALUES (
        v_empresa_id,
        v_produto_id,
        v_deposito_id,
        -v_qtd,
        'VENDA',
        'MINUTA_CONCLUIDA',
        '187',
        'SISTEMA',
        now(),
        (SELECT COALESCE(SUM(estoque_fisico), 0) FROM public.estoque WHERE produto_id = v_produto_id),
        (SELECT COALESCE(estoque_fisico, 0) FROM public.estoque WHERE estoque_id = v_est_id)
    );

END $$;
