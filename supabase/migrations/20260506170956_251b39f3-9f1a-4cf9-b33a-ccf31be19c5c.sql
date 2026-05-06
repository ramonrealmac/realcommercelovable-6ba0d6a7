CREATE OR REPLACE PROCEDURE public.pcdr_baixar_titulos(
    p_cadastro_id INT,
    p_vl_recebido VARCHAR,
    p_recibo VARCHAR,
    p_conta_id VARCHAR,
    p_tipo_pag_rec_id INT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_valor_recebido NUMERIC(12,2);
    v_saldo NUMERIC(12,2);
    v_rec RECORD;
    v_vl_a_aplicar NUMERIC(12,2);
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
        SELECT empresa_id, financeiro_id, vl_a_pagar
        FROM public.financeiro_view
        WHERE cadastro_id = p_cadastro_id
          AND tp_conta = 'R'
          AND status = 'A'
          AND vl_a_pagar > 0
        ORDER BY dt_vencto ASC
    LOOP
        EXIT WHEN v_saldo <= 0;
        v_vl_a_aplicar := LEAST(v_saldo, v_rec.vl_a_pagar);

        INSERT INTO public.financeiro_baixa (
            empresa_id, financeiro_id, vl_pago, recibo, dt_pagamento,
            cadastro_id, conta_id, tp_conta, tipo_pag_rec_id
        ) VALUES (
            v_rec.empresa_id, v_rec.financeiro_id, v_vl_a_aplicar, p_recibo,
            CURRENT_DATE, p_cadastro_id, p_conta_id, 'R', p_tipo_pag_rec_id
        );

        UPDATE public.financeiro
        SET vl_pago = COALESCE(vl_pago,0) + v_vl_a_aplicar,
            status = CASE WHEN COALESCE(vl_pago,0) + v_vl_a_aplicar >= vl_titulo THEN 'B' ELSE status END
        WHERE empresa_id = v_rec.empresa_id
          AND financeiro_id = v_rec.financeiro_id;

        v_saldo := v_saldo - v_vl_a_aplicar;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.fu_baixar_titulos_cliente(
    p_cadastro_id INT,
    p_vl_recebido VARCHAR,
    p_recibo VARCHAR,
    p_conta_id VARCHAR,
    p_tipo_pag_rec_id INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    CALL public.pcdr_baixar_titulos(p_cadastro_id, p_vl_recebido, p_recibo, p_conta_id, p_tipo_pag_rec_id);
END;
$$;