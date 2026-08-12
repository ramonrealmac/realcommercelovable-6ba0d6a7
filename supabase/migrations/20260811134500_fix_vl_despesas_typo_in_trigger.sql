-- Migration: 20260811134500_fix_vl_despesas_typo_in_trigger.sql
-- Description: Fixes typo column 'vl_despesas' to 'vl_despesa' in fu_financeiro_baixa_consolidacao trigger function.

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
BEGIN
    -- Configura bypass para permitir que este trigger atualize/delete na tabela consolidada
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    -- Determina o financeiro_id a ser recalculado
    IF TG_OP = 'DELETE' THEN
        v_fin_id := OLD.financeiro_id;
        v_emp_id := OLD.empresa_id;
    ELSE
        v_fin_id := NEW.financeiro_id;
        v_emp_id := NEW.empresa_id;
    END IF;

    -- 1. Obter informações atuais do título financeiro pai
    SELECT vl_titulo, tp_conta, portador_id, documento 
    INTO v_vl_titulo, v_tp_conta, v_portador_id, v_documento
    FROM public.financeiro
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    -- 2. Calcular totais das baixas ativas para este título (incluindo vl_despesa)
    SELECT COALESCE(SUM(vl_pago), 0), COALESCE(SUM(vl_desconto), 0), COALESCE(SUM(vl_juros), 0), COALESCE(SUM(vl_despesa), 0)
    INTO v_total_pago, v_total_desc, v_total_juros, v_total_despesa
    FROM public.financeiro_baixa
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    -- Define o novo status do título (B = Baixado, A = Aberto) considerando vl_pago + vl_desconto + vl_despesa
    IF (v_total_pago + v_total_desc + v_total_despesa) >= (v_vl_titulo - 0.009) THEN
        v_status := 'B';
    ELSE
        v_status := 'A';
    END IF;

    -- 3. Atualizar o Título Financeiro
    UPDATE public.financeiro
    SET vl_pago = (v_total_pago + v_total_despesa),
        vl_despesa = v_total_despesa,
        vl_desconto = v_total_desc,
        vl_adicional = v_total_juros,
        status = v_status
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    -- 4. Sincronizar na Tabela Financeiro Consolidado
    IF TG_OP = 'INSERT' THEN
        -- Lançamento do Recebimento/Pagamento Principal (Bruto se houver despesa)
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
            COALESCE(NEW.observacao, 'BAIXA DO TÍTULO DOC: ' || COALESCE(v_documento, '')),
            COALESCE(auth.uid(), NULL::uuid), 
            v_tp_conta,
            NEW.financeiro_baixa_id
        );

        -- Lançamento da Despesa de Taxa (se houver despesa registrada)
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
                    'TAXA/DESPESA ' || COALESCE(NEW.observacao, 'BAIXA DOC: ' || COALESCE(v_documento, '')),
                    COALESCE(auth.uid(), NULL::uuid),
                    'P',
                    NEW.financeiro_baixa_id
                );
            END IF;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.financeiro_consolidado
        SET valor = (NEW.vl_pago + COALESCE(NEW.vl_despesa, 0)),
            data_ocorrencia = NEW.dt_pagamento::date,
            data_competencia = to_char(NEW.dt_pagamento, 'MM/YYYY'),
            plano_conta_id = NULLIF(NEW.planoconta_id, 0),
            updated_at = now()
        WHERE id_da_origem = NEW.financeiro_baixa_id AND origem = v_tp_conta;

        IF COALESCE(NEW.vl_despesa, 0) > 0 THEN
            SELECT conta_taxa_operadora_id, conta_antecipa_id INTO v_emp FROM public.empresa WHERE empresa_id = NEW.empresa_id;
            IF NEW.observacao LIKE '%Antecipação%' OR NEW.observacao LIKE '%antecipação%' THEN
                v_plano_despesa_id := COALESCE(v_emp.conta_antecipa_id, v_emp.conta_taxa_operadora_id);
            ELSE
                v_plano_despesa_id := COALESCE(v_emp.conta_taxa_operadora_id, v_emp.conta_antecipa_id);
            END IF;

            IF v_plano_despesa_id IS NOT NULL THEN
                UPDATE public.financeiro_consolidado
                SET valor = NEW.vl_despesa,
                    data_ocorrencia = NEW.dt_pagamento::date,
                    data_competencia = to_char(NEW.dt_pagamento, 'MM/YYYY'),
                    plano_conta_id = v_plano_despesa_id,
                    updated_at = now()
                WHERE id_da_origem = NEW.financeiro_baixa_id AND origem = 'P';
            END IF;
        ELSE
            DELETE FROM public.financeiro_consolidado WHERE id_da_origem = NEW.financeiro_baixa_id AND origem = 'P';
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.financeiro_consolidado WHERE id_da_origem = OLD.financeiro_baixa_id AND origem = v_tp_conta;
        DELETE FROM public.financeiro_consolidado WHERE id_da_origem = OLD.financeiro_baixa_id AND origem = 'P';
    END IF;

    PERFORM set_config('app.bypass_consolidado_check', 'false', true);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
