-- Migration: 20260818133000_fn_get_saldo_anterior_consolidado.sql
-- Description: Cria a função RPC fn_get_saldo_anterior_consolidado para calcular o saldo acumulado anterior a qualquer data.

CREATE OR REPLACE FUNCTION public.fn_get_saldo_anterior_consolidado(
    p_empresa_id integer,
    p_dt_inicio date,
    p_portador_id integer DEFAULT NULL,
    p_plano_conta_id integer DEFAULT NULL
) RETURNS numeric(12,2) AS $$
DECLARE
    v_saldo numeric(12,2) := 0;
BEGIN
    SELECT COALESCE(SUM(
        CASE 
            WHEN origem = 'R' THEN valor
            WHEN origem = 'P' THEN -valor
            WHEN origem = 'C' THEN valor
            ELSE valor
        END
    ), 0)
    INTO v_saldo
    FROM public.financeiro_consolidado
    WHERE empresa_id = p_empresa_id
      AND data_ocorrencia < p_dt_inicio
      AND (p_portador_id IS NULL OR portador_id = p_portador_id)
      AND (p_plano_conta_id IS NULL OR plano_conta_id = p_plano_conta_id);

    RETURN v_saldo;
END;
$$ LANGUAGE plpgsql STABLE;

-- Notifica recarga do schema PostgREST
NOTIFY pgrst, 'reload schema';
