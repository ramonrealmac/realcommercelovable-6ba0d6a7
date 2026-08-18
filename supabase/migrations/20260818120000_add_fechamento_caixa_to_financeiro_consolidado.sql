-- Migration: 20260818120000_add_fechamento_caixa_to_financeiro_consolidado.sql
-- Description: Adiciona suporte à origem 'C' (Fechamento de Caixa) no financeiro_consolidado, otimiza descrições/históricos de baixas e vincula portadores/planos de conta.

-- 1. Atualizar CHECK constraint na tabela public.financeiro_consolidado
ALTER TABLE public.financeiro_consolidado
    DROP CONSTRAINT IF EXISTS financeiro_consolidado_origem_check;

ALTER TABLE public.financeiro_consolidado
    ADD CONSTRAINT financeiro_consolidado_origem_check 
    CHECK (origem IN ('P', 'R', 'M', 'C'));

-- 2. Atualizar índice de unicidade
DROP INDEX IF EXISTS idx_financeiro_consolidado_unicidade;

CREATE UNIQUE INDEX idx_financeiro_consolidado_unicidade 
ON public.financeiro_consolidado (origem, id_da_origem) 
WHERE origem IN ('P', 'R', 'C');

-- 3. Atualizar a trigger function de proteção manual
CREATE OR REPLACE FUNCTION public.fu_check_financeiro_consolidado_origem()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a transação for do trigger do sistema, ignora a proteção
    IF current_setting('app.bypass_consolidado_check', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    -- Bloqueia exclusão/alteração manual de registros automatizados
    IF OLD.origem IN ('P', 'R', 'C') THEN
        RAISE EXCEPTION 'Não é permitido alterar ou excluir manualmente lançamentos consolidados originados de baixas de títulos (P/R) ou fechamentos de caixa (C). Para modificar este registro, faça o ajuste diretamente na origem correspondente.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Função da Trigger para caixa_abertura
CREATE OR REPLACE FUNCTION public.fu_caixa_abertura_consolidacao()
RETURNS TRIGGER AS $$
DECLARE
    v_historico text;
    v_portador_id integer;
    v_plano_vendas_id integer;
    v_valor_dinheiro numeric(12,2);
    v_count_itens integer;
BEGIN
    -- Configura bypass para permitir que o trigger do sistema escreva/modifique no financeiro_consolidado
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'F' THEN
            DELETE FROM public.financeiro_consolidado 
            WHERE id_da_origem = OLD.caixa_abertura_id AND origem = 'C';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Se o caixa está fechado (status = 'F') e possui valor de fechamento
        IF NEW.status = 'F' THEN
            v_historico := 'Fechamento do Caixa #' || NEW.caixa_abertura_id || ' (Func. #' || NEW.funcionario_id || ')';

            -- 4.1. Resolve o portador da empresa (carteira / caixa sem banco)
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

            -- 4.2. Resolve plano de contas de vendas da empresa
            SELECT plano_conta_id INTO v_plano_vendas_id
            FROM public.plano_conta
            WHERE empresa_id = NEW.empresa_id
              AND (excluido IS FALSE OR excluido IS NULL)
              AND (conta LIKE '1.01.001%' OR UPPER(nome) = 'VENDA DE PRODUTOS' OR UPPER(nome) = 'VENDA DE MERCADORIAS')
            ORDER BY conta
            LIMIT 1;

            -- 4.3. Calcula a movimentação líquida em dinheiro ocorrida na sessão do caixa (sem saldo inicial)
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

            -- Se não houver itens detalhados gravados, calcula pelo valor de fechamento sem o valor de abertura
            IF v_count_itens = 0 THEN
                v_valor_dinheiro := GREATEST(0, COALESCE(NEW.vl_fechamento, 0) - COALESCE(NEW.vl_abertura, 0));
            END IF;

            -- Realiza UPSERT atômico no financeiro_consolidado
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
            ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
                empresa_id = EXCLUDED.empresa_id,
                portador_id = EXCLUDED.portador_id,
                plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
                data_ocorrencia = EXCLUDED.data_ocorrencia,
                data_competencia = EXCLUDED.data_competencia,
                valor = EXCLUDED.valor,
                historico = EXCLUDED.historico,
                updated_at = now();
        ELSE
            -- Se o caixa foi reaberto ou não está no status 'F', remove o registro consolidado se existir
            DELETE FROM public.financeiro_consolidado 
            WHERE id_da_origem = NEW.caixa_abertura_id AND origem = 'C';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vincular Trigger na tabela caixa_abertura
DROP TRIGGER IF EXISTS tg_caixa_abertura_consolidacao ON public.caixa_abertura;
CREATE TRIGGER tg_caixa_abertura_consolidacao
AFTER INSERT OR UPDATE OR DELETE ON public.caixa_abertura
FOR EACH ROW EXECUTE FUNCTION public.fu_caixa_abertura_consolidacao();

-- 5. Atualização da Trigger em financeiro_baixa para garantir histórico descritivo sem strings vazias
CREATE OR REPLACE FUNCTION public.fu_financeiro_baixa_consolidacao()
RETURNS TRIGGER AS $$
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
        ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
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
                ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
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
$$ LANGUAGE plpgsql;

-- 6. Execução do Backfill Completo (Caixas e Baixas de Títulos)
DO $$
DECLARE
    ca_rec RECORD;
    fb_rec RECORD;
    v_portador_id integer;
    v_plano_vendas_id integer;
    v_valor_dinheiro numeric(12,2);
    v_count_itens integer;
    v_fin_id bigint;
    v_emp_id integer;
    v_vl_titulo numeric(12,2);
    v_tp_conta varchar(1);
    v_documento varchar(20);
    v_emp RECORD;
    v_plano_despesa_id integer;
    v_hist text;
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    -- 6.1. Backfill de Caixas Fechados (origem 'C')
    FOR ca_rec IN 
        SELECT ca.caixa_abertura_id, ca.empresa_id, ca.funcionario_id, ca.dt_abertura, ca.vl_abertura, ca.vl_fechamento 
        FROM public.caixa_abertura ca
        WHERE ca.status = 'F'
    LOOP
        SELECT portador_id INTO v_portador_id
        FROM public.portador
        WHERE empresa_id = ca_rec.empresa_id
          AND (excluido IS FALSE OR excluido IS NULL)
          AND (banco_id IS NULL OR banco_id = 0)
        ORDER BY 
          CASE WHEN UPPER(nome) LIKE '%CARTEIRA%' OR UPPER(nome) LIKE '%CAIXA%' THEN 0 ELSE 1 END,
          portador_id
        LIMIT 1;

        IF v_portador_id IS NULL THEN
          SELECT portador_id INTO v_portador_id
          FROM public.portador
          WHERE empresa_id = ca_rec.empresa_id
            AND (excluido IS FALSE OR excluido IS NULL)
          ORDER BY portador_id
          LIMIT 1;
        END IF;

        SELECT plano_conta_id INTO v_plano_vendas_id
        FROM public.plano_conta
        WHERE empresa_id = ca_rec.empresa_id
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
        WHERE cm.caixa_abertura_id = ca_rec.caixa_abertura_id
          AND (cm.excluido IS FALSE OR cm.excluido IS NULL)
          AND (cmi.excluido IS FALSE OR cmi.excluido IS NULL)
          AND (cmi.meio_pagamento_id = 1 OR UPPER(COALESCE(mp.soma_vl_caixa, '')) = 'S' OR cmi.meio_pagamento_id IS NULL);

        IF v_count_itens = 0 THEN
            v_valor_dinheiro := GREATEST(0, COALESCE(ca_rec.vl_fechamento, 0) - COALESCE(ca_rec.vl_abertura, 0));
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
            ca_rec.empresa_id,
            v_portador_id,
            v_plano_vendas_id,
            ca_rec.dt_abertura,
            to_char(ca_rec.dt_abertura, 'MM/YYYY'),
            v_valor_dinheiro,
            'Fechamento do Caixa #' || ca_rec.caixa_abertura_id || ' (Func. #' || ca_rec.funcionario_id || ')',
            'C',
            ca_rec.caixa_abertura_id
        )
        ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            portador_id = EXCLUDED.portador_id,
            plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
            valor = EXCLUDED.valor,
            data_ocorrencia = EXCLUDED.data_ocorrencia,
            data_competencia = EXCLUDED.data_competencia,
            historico = EXCLUDED.historico,
            updated_at = now();
    END LOOP;

    -- 6.2. Backfill de Baixas de Títulos (origem 'R' e 'P')
    FOR fb_rec IN 
        SELECT fb.* 
        FROM public.financeiro_baixa fb
        ORDER BY fb.financeiro_baixa_id
    LOOP
        SELECT vl_titulo, tp_conta, NULLIF(portador_id, 0), documento 
        INTO v_vl_titulo, v_tp_conta, v_portador_id, v_documento
        FROM public.financeiro
        WHERE financeiro_id = fb_rec.financeiro_id AND empresa_id = fb_rec.empresa_id;

        IF v_tp_conta IS NOT NULL THEN
            IF TRIM(COALESCE(fb_rec.observacao, '')) <> '' THEN
                v_hist := fb_rec.observacao;
            ELSIF v_tp_conta = 'R' THEN
                v_hist := 'RECEBIMENTO DO TÍTULO DOC: ' || COALESCE(v_documento, fb_rec.financeiro_id::text);
            ELSE
                v_hist := 'PAGAMENTO DO TÍTULO DOC: ' || COALESCE(v_documento, fb_rec.financeiro_id::text);
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
                fb_rec.empresa_id,
                NULL,
                v_portador_id,
                NULLIF(fb_rec.planoconta_id, 0),
                fb_rec.dt_pagamento::date,
                to_char(fb_rec.dt_pagamento, 'MM/YYYY'),
                (fb_rec.vl_pago + COALESCE(fb_rec.vl_despesa, 0)),
                v_hist,
                NULL, 
                v_tp_conta,
                fb_rec.financeiro_baixa_id
            )
            ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
                empresa_id = EXCLUDED.empresa_id,
                portador_id = EXCLUDED.portador_id,
                plano_conta_id = EXCLUDED.plano_conta_id,
                data_ocorrencia = EXCLUDED.data_ocorrencia,
                data_competencia = EXCLUDED.data_competencia,
                valor = EXCLUDED.valor,
                historico = EXCLUDED.historico,
                updated_at = now();

            IF COALESCE(fb_rec.vl_despesa, 0) > 0 THEN
                SELECT conta_taxa_operadora_id, conta_antecipa_id INTO v_emp FROM public.empresa WHERE empresa_id = fb_rec.empresa_id;
                
                IF fb_rec.observacao LIKE '%Antecipação%' OR fb_rec.observacao LIKE '%antecipação%' THEN
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
                        fb_rec.empresa_id,
                        NULL,
                        v_portador_id,
                        v_plano_despesa_id,
                        fb_rec.dt_pagamento::date,
                        to_char(fb_rec.dt_pagamento, 'MM/YYYY'),
                        fb_rec.vl_despesa,
                        'TAXA/DESPESA ' || COALESCE(NULLIF(TRIM(fb_rec.observacao), ''), 'BAIXA DOC: ' || COALESCE(v_documento, '')),
                        NULL,
                        'P',
                        fb_rec.financeiro_baixa_id
                    )
                    ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'C') DO UPDATE SET
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

        END IF;
    END LOOP;
END;
$$;
