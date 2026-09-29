-- Migration: 20260929151500_skip_caixa_consolidation_when_financeiro_baixado.sql
-- Description: Desativa a geração de consolidação no caixa (origem 'V' e 'E') quando a condição de pagamento possui o flag tp_financeiro = 'B' (FINANCEIRO BAIXADO). A consolidação será gerada exclusivamente pelo Financeiro via financeiro_baixa (origem 'R').

CREATE OR REPLACE FUNCTION public.fu_caixa_movimento_consolidacao()
RETURNS TRIGGER AS $$
DECLARE
    v_portador_id integer;
    v_plano_vendas_id integer;
    v_nr_movimento bigint;
    v_historico text;
    v_rec RECORD;
    v_tem_baixado boolean := false;
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

    -- Se o movimento foi marcado como excluído/cancelado
    IF v_rec.excluido IS TRUE THEN
        DELETE FROM public.financeiro_consolidado 
        WHERE id_da_origem = v_rec.caixa_movimento_id AND origem IN ('V', 'E');
        RETURN NEW;
    END IF;

    -- REGRA: Verificar se o pagamento deste caixa_movimento possui flag tp_financeiro = 'B' (FINANCEIRO BAIXADO)
    -- Quando tp_financeiro = 'B', NÃO gera consolidado pelo Caixa (origem 'V'/'E').
    -- O consolidado será gerado exclusivamente pelo Financeiro (origem 'R') através da baixa em financeiro_baixa após o lançamento.
    SELECT EXISTS (
      SELECT 1 
      FROM public.caixa_movimento_item cmi
      JOIN public.condicao_pagamento cp ON cp.condicao_id = cmi.condicao_id
      WHERE cmi.caixa_movimento_id = v_rec.caixa_movimento_id
        AND (cmi.excluido IS FALSE OR cmi.excluido IS NULL)
        AND UPPER(COALESCE(cp.tp_financeiro, '')) = 'B'
      
      UNION ALL
      
      SELECT 1 
      FROM public.movimento_pagamento mp
      JOIN public.condicao_pagamento cp ON cp.condicao_id = mp.condicao_id
      WHERE v_rec.movimento_id IS NOT NULL 
        AND mp.movimento_id = v_rec.movimento_id
        AND (mp.excluido IS FALSE OR mp.excluido IS NULL)
        AND UPPER(COALESCE(cp.tp_financeiro, '')) = 'B'
        
      UNION ALL
      
      SELECT 1 
      FROM public.movimento m
      JOIN public.condicao_pagamento cp ON cp.condicao_id = m.condicao_id
      WHERE v_rec.movimento_id IS NOT NULL 
        AND m.movimento_id = v_rec.movimento_id
        AND UPPER(COALESCE(cp.tp_financeiro, '')) = 'B'
    ) INTO v_tem_baixado;

    IF v_tem_baixado IS TRUE THEN
        -- Remove qualquer registro de consolidado originado deste caixa_movimento (origem V/E) para não duplicar
        DELETE FROM public.financeiro_consolidado 
        WHERE id_da_origem = v_rec.caixa_movimento_id AND origem IN ('V', 'E');
        RETURN NEW;
    END IF;

    -- Busca o número do movimento/pedido se houver vínculo
    IF v_rec.movimento_id IS NOT NULL THEN
        SELECT nr_movimento INTO v_nr_movimento 
        FROM public.movimento 
        WHERE movimento_id = v_rec.movimento_id;
    END IF;

    -- Resolve portador da empresa (carteira / caixa)
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

    -- Resolve plano de contas de vendas da empresa
    SELECT plano_conta_id INTO v_plano_vendas_id
    FROM public.plano_conta
    WHERE empresa_id = v_rec.empresa_id
      AND (excluido IS FALSE OR excluido IS NULL)
      AND (conta LIKE '1.01.001%' OR UPPER(nome) = 'VENDA DE PRODUTOS' OR UPPER(nome) = 'VENDA DE MERCADORIAS' OR UPPER(nome) = 'VENDAS')
    ORDER BY conta
    LIMIT 1;

    -- 6.1. Movimento de Recebimento de Venda no Caixa (Venda / Entrada)
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
        ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'V', 'E') DO UPDATE SET
            empresa_id = EXCLUDED.empresa_id,
            portador_id = EXCLUDED.portador_id,
            plano_conta_id = COALESCE(EXCLUDED.plano_conta_id, financeiro_consolidado.plano_conta_id),
            valor = EXCLUDED.valor,
            data_ocorrencia = EXCLUDED.data_ocorrencia,
            data_competencia = EXCLUDED.data_competencia,
            historico = EXCLUDED.historico,
            updated_at = now();

    -- 6.2. Movimento de Estorno de Venda no Caixa (Estorno / Reversão)
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
        ON CONFLICT (origem, id_da_origem) WHERE origem IN ('P', 'R', 'V', 'E') DO UPDATE SET
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
$$ LANGUAGE plpgsql;

-- Limpa consolidados legados de origem 'V' e 'E' cujas condições de pagamento tenham tp_financeiro = 'B'
DO $$
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);
    
    DELETE FROM public.financeiro_consolidado fc
    WHERE fc.origem IN ('V', 'E')
      AND EXISTS (
        SELECT 1
        FROM public.caixa_movimento cm
        LEFT JOIN public.caixa_movimento_item cmi ON cmi.caixa_movimento_id = cm.caixa_movimento_id
        LEFT JOIN public.condicao_pagamento cp ON cp.condicao_id = cmi.condicao_id
        WHERE cm.caixa_movimento_id = fc.id_da_origem
          AND UPPER(COALESCE(cp.tp_financeiro, '')) = 'B'
      );
END $$;
