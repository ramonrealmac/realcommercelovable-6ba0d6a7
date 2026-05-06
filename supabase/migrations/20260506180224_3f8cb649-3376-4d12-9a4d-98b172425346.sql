CREATE OR REPLACE PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $procedure$
DECLARE
    v_valor_recebido NUMERIC(12,2);
    v_saldo NUMERIC(12,2);
    v_rec RECORD;
    v_vl_a_aplicar NUMERIC(12,2);
    v_doc varchar;
    v_next_id integer;
BEGIN
    v_valor_recebido := REPLACE(REPLACE(TRIM(p_vl_recebido), '.', ''), ',', '.')::NUMERIC(12,2);
    IF v_valor_recebido IS NULL OR v_valor_recebido <= 0 THEN
        RAISE EXCEPTION 'Valor incompatível para pagamento (0,00)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.financeiro_view
        WHERE cadastro_id = p_cadastro_id
          AND tp_conta = 'R'
          AND status = 'A'
          AND vl_a_pagar > 0
    ) THEN
        RAISE EXCEPTION 'Cliente sem títulos em aberto!';
    END IF;

    v_saldo := v_valor_recebido;

    FOR v_rec IN
        SELECT empresa_id, financeiro_id, vl_a_pagar, documento
        FROM public.financeiro_view
        WHERE cadastro_id = p_cadastro_id
          AND tp_conta = 'R'
          AND status = 'A'
          AND vl_a_pagar > 0
        ORDER BY dt_vencto ASC
    LOOP
        EXIT WHEN v_saldo <= 0;
        v_vl_a_aplicar := LEAST(v_saldo, v_rec.vl_a_pagar);

        SELECT COALESCE(MAX(financeiro_baixa_id),0) + 1 INTO v_next_id FROM public.financeiro_baixa;

        INSERT INTO public.financeiro_baixa (
            financeiro_baixa_id, empresa_id, financeiro_id, vl_pago, recibo, dt_pagamento,
            cadastro_id, conta_id, tp_conta, tipo_pag_rec_id, documento
        ) VALUES (
            v_next_id, v_rec.empresa_id, v_rec.financeiro_id, v_vl_a_aplicar, p_recibo,
            CURRENT_DATE, p_cadastro_id, p_conta_id, 'R', p_tipo_pag_rec_id,
            COALESCE(v_rec.documento, '')
        );

        UPDATE public.financeiro
        SET vl_pago = COALESCE(vl_pago,0) + v_vl_a_aplicar,
            status = CASE WHEN COALESCE(vl_pago,0) + v_vl_a_aplicar >= vl_titulo THEN 'B' ELSE status END
        WHERE empresa_id = v_rec.empresa_id
          AND financeiro_id = v_rec.financeiro_id;

        v_saldo := v_saldo - v_vl_a_aplicar;
    END LOOP;
END;
$procedure$;