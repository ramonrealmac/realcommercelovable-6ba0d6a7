-- Migration: 20260922173000_atomic_caixa_movimento_consolidation.sql
-- Description: Desativa totalmente a consolidação por fechamento de caixa (origem 'C') e introduz a consolidação 100% atômica por movimento/pedido no caixa (origens 'V' Venda e 'E' Estorno).

-- 1. Desativar e remover trigger/função de consolidação por fechamento de caixa
DROP TRIGGER IF EXISTS tg_caixa_abertura_consolidacao ON public.caixa_abertura;
DROP FUNCTION IF EXISTS public.fu_caixa_abertura_consolidacao();

-- 2. Limpar lançamentos consolidados legados de origem 'C'
DO $$
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);
    DELETE FROM public.financeiro_consolidado WHERE origem = 'C';
END $$;

-- 3. Atualizar a CHECK constraint de origem para permitir 'V' e 'E'
ALTER TABLE public.financeiro_consolidado
    DROP CONSTRAINT IF EXISTS financeiro_consolidado_origem_check;

ALTER TABLE public.financeiro_consolidado
    ADD CONSTRAINT financeiro_consolidado_origem_check 
    CHECK (origem IN ('P', 'R', 'M', 'V', 'E'));

-- 4. Atualizar o índice de unicidade para (origem, id_da_origem)
DROP INDEX IF EXISTS idx_financeiro_consolidado_unicidade;

CREATE UNIQUE INDEX idx_financeiro_consolidado_unicidade 
ON public.financeiro_consolidado (origem, id_da_origem) 
WHERE origem IN ('P', 'R', 'V', 'E');

-- 5. Atualizar a trigger function de proteção contra edição manual
CREATE OR REPLACE FUNCTION public.fu_check_financeiro_consolidado_origem()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.bypass_consolidado_check', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    IF OLD.origem IN ('P', 'R', 'V', 'E') THEN
        RAISE EXCEPTION 'Não é permitido alterar ou excluir manualmente lançamentos consolidados originados de baixas (P/R) ou movimentos de caixa (V/E). Para modificar este registro, faça o ajuste diretamente no documento/origem correspondente.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger Function para consolidação atômica por caixa_movimento
CREATE OR REPLACE FUNCTION public.fu_caixa_movimento_consolidacao()
RETURNS TRIGGER AS $$
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

    -- Se o movimento foi marcado como excluído/cancelado
    IF v_rec.excluido IS TRUE THEN
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

-- 7. Vincular a Trigger na tabela public.caixa_movimento
DROP TRIGGER IF EXISTS tg_caixa_movimento_consolidacao ON public.caixa_movimento;
CREATE TRIGGER tg_caixa_movimento_consolidacao
AFTER INSERT OR UPDATE OR DELETE ON public.caixa_movimento
FOR EACH ROW EXECUTE FUNCTION public.fu_caixa_movimento_consolidacao();

-- 8. Backfill Histórico: Gerar consolidação para os caixa_movimento existentes no banco
DO $$
DECLARE
    cm_rec RECORD;
BEGIN
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    FOR cm_rec IN 
        SELECT cm.* 
        FROM public.caixa_movimento cm
        WHERE (cm.excluido IS FALSE OR cm.excluido IS NULL)
        ORDER BY cm.caixa_movimento_id
    LOOP
        -- Re-dispara lógica simulada para popular o histórico
        PERFORM public.fu_caixa_movimento_consolidacao_backfill(cm_rec.caixa_movimento_id);
    END LOOP;
END $$;
