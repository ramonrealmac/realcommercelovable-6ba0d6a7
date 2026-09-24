-- Migration: 20260924133000_fix_caixa_fechamento_on_conflict_constraint.sql
-- Descrição: Ajusta a restrição de unicidade e ON CONFLICT do financeiro_consolidado para suportar fechamento de caixa ('C') e vendas/estornos ('V', 'E', 'P', 'R').

-- 1. Recria o índice único para englobar todas as origens consolidadas ('P', 'R', 'V', 'E', 'C')
DROP INDEX IF EXISTS public.idx_financeiro_consolidado_unicidade;

CREATE UNIQUE INDEX idx_financeiro_consolidado_unicidade 
ON public.financeiro_consolidado (origem, id_da_origem) 
WHERE (origem IN ('P', 'R', 'V', 'E', 'C'));

-- 2. Atualiza a função fu_caixa_abertura_consolidacao
CREATE OR REPLACE FUNCTION public.fu_caixa_abertura_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_historico text;
    v_portador_id integer;
    v_plano_vendas_id integer;
    v_valor_dinheiro numeric(12,2);
    v_count_itens integer;
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'F' THEN
            DELETE FROM public.financeiro_consolidado 
            WHERE id_da_origem = OLD.caixa_abertura_id AND origem = 'C';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF NEW.status = 'F' THEN
            v_historico := 'Fechamento do Caixa #' || NEW.caixa_abertura_id || ' (Func. #' || NEW.funcionario_id || ')';

            SELECT portador_id INTO v_portador_id
            FROM public.portador
            WHERE empresa_id = NEW.empresa_id
              AND (excluido IS FALSE OR excluido IS NULL)
              AND (banco_id IS NULL OR banco_id = 0)
            ORDER BY 
              CASE WHEN UPPER(nome) LIKE '%CARTEIRA%' OR UPPER(nome) LIKE '%CAIXA%' THEN 0 ELSE 1 END,
              portador_id
            LIMIT 1;

            IF v_portador_id IS NULL THEN
              SELECT portador_id INTO v_portador_id
              FROM public.portador
              WHERE empresa_id = NEW.empresa_id
                AND (excluido IS FALSE OR excluido IS NULL)
              ORDER BY portador_id
              LIMIT 1;
            END IF;

            SELECT plano_conta_id INTO v_plano_vendas_id
            FROM public.plano_conta
            WHERE empresa_id = NEW.empresa_id
              AND (excluido IS FALSE OR excluido IS NULL)
              AND (conta LIKE '1.01.001%' OR UPPER(nome) = 'VENDA DE PRODUTOS' OR UPPER(nome) = 'VENDA DE MERCADORIAS')
            ORDER BY conta
            LIMIT 1;

            SELECT 
                COALESCE(SUM(cmi.vl_recebido), 0),
                COUNT(cmi.caixa_movimento_item_id)
            INTO v_valor_dinheiro, v_count_itens
            FROM public.caixa_movimento cm
            JOIN public.caixa_movimento_item cmi ON cmi.caixa_movimento_id = cm.caixa_movimento_id
            LEFT JOIN public.meio_pagamento mp ON mp.meio_pagamento_id = cmi.meio_pagamento_id
            WHERE cm.caixa_abertura_id = NEW.caixa_abertura_id
              AND (cm.excluido IS FALSE OR cm.excluido IS NULL)
              AND (cmi.excluido IS FALSE OR cmi.excluido IS NULL)
              AND (cmi.meio_pagamento_id = 1 OR UPPER(COALESCE(mp.soma_vl_caixa, '')) = 'S' OR cmi.meio_pagamento_id IS NULL);

            IF v_count_itens = 0 THEN
                v_valor_dinheiro := GREATEST(0, COALESCE(NEW.vl_fechamento, 0) - COALESCE(NEW.vl_abertura, 0));
            END IF;

            INSERT INTO public.financeiro_consolidado (
                empresa_id,
                portador_id,
                plano_conta_id,
                data_ocorrencia,
                data_competencia,
                valor,
                historico,
                origem,
                id_da_origem
            ) VALUES (
                NEW.empresa_id,
                v_portador_id,
                v_plano_vendas_id,
                NEW.dt_abertura,
                to_char(NEW.dt_abertura, 'MM/YYYY'),
                v_valor_dinheiro,
                v_historico,
                'C',
                NEW.caixa_abertura_id
            )
            ON CONFLICT (origem, id_da_origem) WHERE (origem IN ('P', 'R', 'V', 'E', 'C')) DO UPDATE SET
                empresa_id = EXCLUDED.empresa_id,
                portador_id = EXCLUDED.portador_id,
                plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
                data_ocorrencia = EXCLUDED.data_ocorrencia,
                data_competencia = EXCLUDED.data_competencia,
                valor = EXCLUDED.valor,
                historico = EXCLUDED.historico,
                updated_at = now();
        ELSE
            DELETE FROM public.financeiro_consolidado 
            WHERE id_da_origem = NEW.caixa_abertura_id AND origem = 'C';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Atualiza a função fu_caixa_movimento_consolidacao
CREATE OR REPLACE FUNCTION public.fu_caixa_movimento_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_portador_id integer;
    v_plano_vendas_id integer;
    v_nr_movimento bigint;
    v_historico text;
    v_rec RECORD;
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    IF TG_OP = 'DELETE' THEN
        v_rec := OLD;
        DELETE FROM public.financeiro_consolidado 
        WHERE id_da_origem = v_rec.caixa_movimento_id AND origem IN ('V', 'E');
        RETURN OLD;
    ELSE
        v_rec := NEW;
    END IF;

    IF v_rec.excluido IS TRUE THEN
        DELETE FROM public.financeiro_consolidado 
        WHERE id_da_origem = v_rec.caixa_movimento_id AND origem IN ('V', 'E');
        RETURN NEW;
    END IF;

    IF v_rec.movimento_id IS NOT NULL THEN
        SELECT nr_movimento INTO v_nr_movimento 
        FROM public.movimento 
        WHERE movimento_id = v_rec.movimento_id;
    END IF;

    SELECT portador_id INTO v_portador_id
    FROM public.portador
    WHERE empresa_id = v_rec.empresa_id
      AND (excluido IS FALSE OR excluido IS NULL)
      AND (banco_id IS NULL OR banco_id = 0)
    ORDER BY 
      CASE WHEN UPPER(nome) LIKE '%CARTEIRA%' OR UPPER(nome) LIKE '%CAIXA%' THEN 0 ELSE 1 END,
      portador_id
    LIMIT 1;

    IF v_portador_id IS NULL THEN
      SELECT portador_id INTO v_portador_id
      FROM public.portador
      WHERE empresa_id = v_rec.empresa_id
        AND (excluido IS FALSE OR excluido IS NULL)
      ORDER BY portador_id
      LIMIT 1;
    END IF;

    SELECT plano_conta_id INTO v_plano_vendas_id
    FROM public.plano_conta
    WHERE empresa_id = v_rec.empresa_id
      AND (excluido IS FALSE OR excluido IS NULL)
      AND (conta LIKE '1.01.001%' OR UPPER(nome) = 'VENDA DE PRODUTOS' OR UPPER(nome) = 'VENDA DE MERCADORIAS' OR UPPER(nome) = 'VENDAS')
    ORDER BY conta
    LIMIT 1;

    IF v_rec.tp_operacao = 'V' OR (v_rec.tp_movimento = 'E' AND (v_rec.tp_operacao IS NULL OR v_rec.tp_operacao = '')) THEN
        v_historico := 'Recebimento do Pedido #' || COALESCE(v_nr_movimento::text, v_rec.documento, v_rec.movimento_id::text, v_rec.caixa_movimento_id::text);

        INSERT INTO public.financeiro_consolidado (
            empresa_id,
            portador_id,
            plano_conta_id,
            data_ocorrencia,
            data_competencia,
            valor,
            historico,
            origem,
            id_da_origem
        ) VALUES (
            v_rec.empresa_id,
            v_portador_id,
            v_plano_vendas_id,
            v_rec.dt_movimento::date,
            to_char(v_rec.dt_movimento, 'MM/YYYY'),
            v_rec.vl_movimento,
            v_historico,
            'V',
            v_rec.caixa_movimento_id
        )
        ON CONFLICT (origem, id_da_origem) WHERE (origem IN ('P', 'R', 'V', 'E', 'C')) DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            portador_id = EXCLUDED.portador_id,
            plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
            valor = EXCLUDED.valor,
            data_ocorrencia = EXCLUDED.data_ocorrencia,
            data_competencia = EXCLUDED.data_competencia,
            historico = EXCLUDED.historico,
            updated_at = now();

    ELSIF v_rec.tp_operacao = 'ESTORNO' OR v_rec.tp_operacao = 'E' OR v_rec.tp_movimento = 'S' THEN
        v_historico := 'Estorno de Recebimento Pedido #' || COALESCE(v_nr_movimento::text, v_rec.documento, v_rec.movimento_id::text, v_rec.caixa_movimento_id::text);

        INSERT INTO public.financeiro_consolidado (
            empresa_id,
            portador_id,
            plano_conta_id,
            data_ocorrencia,
            data_competencia,
            valor,
            historico,
            origem,
            id_da_origem
        ) VALUES (
            v_rec.empresa_id,
            v_portador_id,
            v_plano_vendas_id,
            v_rec.dt_movimento::date,
            to_char(v_rec.dt_movimento, 'MM/YYYY'),
            v_rec.vl_movimento,
            v_historico,
            'E',
            v_rec.caixa_movimento_id
        )
        ON CONFLICT (origem, id_da_origem) WHERE (origem IN ('P', 'R', 'V', 'E', 'C')) DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            portador_id = EXCLUDED.portador_id,
            plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
            valor = EXCLUDED.valor,
            data_ocorrencia = EXCLUDED.data_ocorrencia,
            data_competencia = EXCLUDED.data_competencia,
            historico = EXCLUDED.historico,
            updated_at = now();
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Atualiza a função fu_financeiro_baixa_consolidacao
CREATE OR REPLACE FUNCTION public.fu_financeiro_baixa_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_fin_id bigint;
    v_emp_id integer;
    v_total_pago numeric(12,2);
    v_total_desc numeric(12,2);
    v_total_juros numeric(12,2);
    v_total_despesa numeric(12,2);
    v_vl_titulo numeric(12,2);
    v_status varchar(1);
    v_tp_conta varchar(1);
    v_portador_id integer;
    v_documento varchar(20);
    v_emp RECORD;
    v_plano_despesa_id integer;
    v_hist text;
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    IF TG_OP = 'DELETE' THEN
        v_fin_id := OLD.financeiro_id;
        v_emp_id := OLD.empresa_id;
    ELSE
        v_fin_id := NEW.financeiro_id;
        v_emp_id := NEW.empresa_id;
    END IF;

    SELECT vl_titulo, tp_conta, NULLIF(portador_id, 0), documento 
    INTO v_vl_titulo, v_tp_conta, v_portador_id, v_documento
    FROM public.financeiro
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    SELECT COALESCE(SUM(vl_pago), 0), COALESCE(SUM(vl_desconto), 0), COALESCE(SUM(vl_juros), 0), COALESCE(SUM(vl_despesa), 0)
    INTO v_total_pago, v_total_desc, v_total_juros, v_total_despesa
    FROM public.financeiro_baixa
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    IF (v_total_pago + v_total_desc + v_total_despesa) >= (v_vl_titulo - 0.009) THEN
        v_status := 'B';
    ELSE
        v_status := 'A';
    END IF;

    UPDATE public.financeiro
    SET vl_pago = (v_total_pago + v_total_despesa),
        vl_despesa = v_total_despesa,
        vl_desconto = v_total_desc,
        vl_adicional = v_total_juros,
        status = v_status
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF TRIM(COALESCE(NEW.observacao, '')) <> '' THEN
            v_hist := NEW.observacao;
        ELSIF v_tp_conta = 'R' THEN
            v_hist := 'RECEBIMENTO DO TÍTULO DOC: ' || COALESCE(v_documento, NEW.financeiro_id::text);
        ELSE
            v_hist := 'PAGAMENTO DO TÍTULO DOC: ' || COALESCE(v_documento, NEW.financeiro_id::text);
        END IF;

        INSERT INTO public.financeiro_consolidado (
            empresa_id,
            centro_custo_id,
            portador_id,
            plano_conta_id,
            data_ocorrencia,
            data_competencia,
            valor,
            historico,
            usuario_id,
            origem,
            id_da_origem
        ) VALUES (
            NEW.empresa_id,
            NULL,
            v_portador_id,
            NULLIF(NEW.planoconta_id, 0),
            NEW.dt_pagamento::date,
            to_char(NEW.dt_pagamento, 'MM/YYYY'),
            (NEW.vl_pago + COALESCE(NEW.vl_despesa, 0)),
            v_hist,
            COALESCE(auth.uid(), NULL::uuid), 
            v_tp_conta,
            NEW.financeiro_baixa_id
        )
        ON CONFLICT (origem, id_da_origem) WHERE (origem IN ('P', 'R', 'V', 'E', 'C')) DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            portador_id = EXCLUDED.portador_id,
            plano_conta_id = EXCLUDED.plano_conta_id,
            data_ocorrencia = EXCLUDED.data_ocorrencia,
            data_competencia = EXCLUDED.data_competencia,
            valor = EXCLUDED.valor,
            historico = EXCLUDED.historico,
            updated_at = now();

        IF COALESCE(NEW.vl_despesa, 0) > 0 THEN
            SELECT conta_taxa_operadora_id, conta_antecipa_id INTO v_emp FROM public.empresa WHERE empresa_id = NEW.empresa_id;
            
            IF NEW.observacao LIKE '%Antecipação%' OR NEW.observacao LIKE '%antecipação%' THEN
                v_plano_despesa_id := COALESCE(v_emp.conta_antecipa_id, v_emp.conta_taxa_operadora_id);
            ELSE
                v_plano_despesa_id := COALESCE(v_emp.conta_taxa_operadora_id, v_emp.conta_antecipa_id);
            END IF;

            IF v_plano_despesa_id IS NOT NULL THEN
                INSERT INTO public.financeiro_consolidado (
                    empresa_id,
                    centro_custo_id,
                    portador_id,
                    plano_conta_id,
                    data_ocorrencia,
                    data_competencia,
                    valor,
                    historico,
                    usuario_id,
                    origem,
                    id_da_origem
                ) VALUES (
                    NEW.empresa_id,
                    NULL,
                    v_portador_id,
                    v_plano_despesa_id,
                    NEW.dt_pagamento::date,
                    to_char(NEW.dt_pagamento, 'MM/YYYY'),
                    NEW.vl_despesa,
                    'TAXA/DESPESA ' || COALESCE(NULLIF(TRIM(NEW.observacao), ''), 'BAIXA DOC: ' || COALESCE(v_documento, '')),
                    COALESCE(auth.uid(), NULL::uuid),
                    'P',
                    NEW.financeiro_baixa_id
                )
                ON CONFLICT (origem, id_da_origem) WHERE (origem IN ('P', 'R', 'V', 'E', 'C')) DO UPDATE SET
                    empresa_id = EXCLUDED.empresa_id,
                    portador_id = EXCLUDED.portador_id,
                    plano_conta_id = EXCLUDED.plano_conta_id,
                    data_ocorrencia = EXCLUDED.data_ocorrencia,
                    data_competencia = EXCLUDED.data_competencia,
                    valor = EXCLUDED.valor,
                    historico = EXCLUDED.historico,
                    updated_at = now();
            END IF;
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.financeiro_consolidado
        WHERE id_da_origem = OLD.financeiro_baixa_id AND origem = v_tp_conta;
    END IF;

    RETURN NEW;
END;
$$;
