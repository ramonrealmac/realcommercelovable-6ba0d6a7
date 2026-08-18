-- Migration: 20260818140000_add_vl_saldo_acumulado_to_financeiro_consolidado.sql
-- Description: Adiciona a coluna vl_saldo_acumulado na tabela financeiro_consolidado, cria índices otimizados e atualiza a função RPC e triggers para gravar o saldo persistido.

-- 1. Adicionar coluna vl_saldo_acumulado
ALTER TABLE public.financeiro_consolidado 
ADD COLUMN IF NOT EXISTS vl_saldo_acumulado numeric(12,2) DEFAULT 0;

-- 2. Criar índice de busca de alta performance para Saldo Anterior (O(1))
CREATE INDEX IF NOT EXISTS idx_financeiro_consolidado_saldo_lookup 
ON public.financeiro_consolidado (empresa_id, data_ocorrencia DESC, created_at DESC);

-- 3. Atualizar a função RPC fn_get_saldo_anterior_consolidado para leitura instantânea por índice
CREATE OR REPLACE FUNCTION public.fn_get_saldo_anterior_consolidado(
    p_empresa_id integer,
    p_dt_inicio date,
    p_portador_id integer DEFAULT NULL,
    p_plano_conta_id integer DEFAULT NULL
) RETURNS numeric(12,2) AS $$
DECLARE
    v_saldo numeric(12,2) := 0;
BEGIN
    SELECT COALESCE(vl_saldo_acumulado, 0)
    INTO v_saldo
    FROM public.financeiro_consolidado
    WHERE empresa_id = p_empresa_id
      AND data_ocorrencia < p_dt_inicio
      AND (p_portador_id IS NULL OR portador_id = p_portador_id)
      AND (p_plano_conta_id IS NULL OR plano_conta_id = p_plano_conta_id)
    ORDER BY data_ocorrencia DESC, created_at DESC
    LIMIT 1;

    RETURN COALESCE(v_saldo, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Função auxiliar para calcular o saldo acumulado de uma nova linha consolidada
CREATE OR REPLACE FUNCTION public.fu_calc_saldo_acumulado(
    p_empresa_id integer,
    p_data_ocorrencia date,
    p_created_at timestamp with time zone,
    p_origem varchar,
    p_valor numeric
) RETURNS numeric(12,2) AS $$
DECLARE
    v_saldo_ant numeric(12,2) := 0;
    v_delta numeric(12,2) := 0;
BEGIN
    -- Busca o saldo do último registro anterior
    SELECT COALESCE(vl_saldo_acumulado, 0)
    INTO v_saldo_ant
    FROM public.financeiro_consolidado
    WHERE empresa_id = p_empresa_id
      AND (
        data_ocorrencia < p_data_ocorrencia 
        OR (data_ocorrencia = p_data_ocorrencia AND (p_created_at IS NULL OR created_at < p_created_at))
      )
    ORDER BY data_ocorrencia DESC, created_at DESC
    LIMIT 1;

    -- Calcula o delta do movimento
    IF p_origem = 'R' THEN
        v_delta := COALESCE(p_valor, 0);
    ELSIF p_origem = 'P' THEN
        v_delta := -COALESCE(p_valor, 0);
    ELSIF p_origem = 'C' THEN
        v_delta := COALESCE(p_valor, 0);
    ELSE
        v_delta := COALESCE(p_valor, 0);
    END IF;

    RETURN COALESCE(v_saldo_ant, 0) + v_delta;
END;
$$ LANGUAGE plpgsql STABLE;

-- 5. Executar Backfill Sequencial Cronológico do Saldo Acumulado para todas as empresas
DO $$
DECLARE
    v_emp RECORD;
    r RECORD;
    v_acumulado numeric(12,2);
    v_delta numeric(12,2);
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    -- Para cada empresa cadastrada
    FOR v_emp IN SELECT DISTINCT empresa_id FROM public.financeiro_consolidado LOOP
        v_acumulado := 0;

        -- Percorre todos os lançamentos em ordem cronológica de ocorrência e criação
        FOR r IN 
            SELECT financeiro_consolidado_id, origem, valor
            FROM public.financeiro_consolidado
            WHERE empresa_id = v_emp.empresa_id
            ORDER BY data_ocorrencia ASC, created_at ASC
        LOOP
            IF r.origem = 'R' THEN
                v_delta := COALESCE(r.valor, 0);
            ELSIF r.origem = 'P' THEN
                v_delta := -COALESCE(r.valor, 0);
            ELSIF r.origem = 'C' THEN
                v_delta := COALESCE(r.valor, 0);
            ELSE
                v_delta := COALESCE(r.valor, 0);
            END IF;

            v_acumulado := v_acumulado + v_delta;

            UPDATE public.financeiro_consolidado
            SET vl_saldo_acumulado = v_acumulado
            WHERE financeiro_consolidado_id = r.financeiro_consolidado_id;
        END LOOP;
    END LOOP;
END;
$$;

-- Notifica recarga do schema no PostgREST
NOTIFY pgrst, 'reload schema';
