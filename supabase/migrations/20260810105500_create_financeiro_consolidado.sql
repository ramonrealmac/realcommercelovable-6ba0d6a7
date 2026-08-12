-- Migration: 20260810105500_create_financeiro_consolidado.sql
-- Description: Creates the public.financeiro_consolidado table, RLS policies, unique constraints, and automated triggers on public.financeiro_baixa.

-- 1. Create the public.financeiro_consolidado table if not exists
CREATE TABLE IF NOT EXISTS public.financeiro_consolidado (
    financeiro_consolidado_id UUID NOT NULL DEFAULT gen_random_uuid(),
    empresa_id INTEGER NOT NULL REFERENCES public.empresa (empresa_id),
    centro_custo_id INTEGER REFERENCES public.centro_custo (centro_custo_id) ON DELETE SET NULL,
    portador_id INTEGER REFERENCES public.portador (portador_id) ON DELETE SET NULL,
    plano_conta_id INTEGER REFERENCES public.plano_conta (plano_conta_id) ON DELETE SET NULL,
    data_ocorrencia DATE NOT NULL,
    data_competencia VARCHAR(7) NOT NULL, -- Formato: 'MM/YYYY'
    data_baixa TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Log não editável
    valor NUMERIC(12,2) NOT NULL,
    historico TEXT,
    usuario_id UUID, -- Referência ao usuário logado (auth.users)
    origem VARCHAR(1) NOT NULL CHECK (origem IN ('P', 'R', 'M')), -- P = Pagar, R = Receber, M = Manual
    id_da_origem BIGINT, -- ID do registro de origem (ex: financeiro_baixa_id)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT financeiro_consolidado_pkey PRIMARY KEY (financeiro_consolidado_id)
);

-- 2. Create partial unique index to prevent duplicate consolidations for the same title payment
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_consolidado_unicidade 
ON public.financeiro_consolidado (origem, id_da_origem) 
WHERE origem IN ('P', 'R');

-- 3. Create foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_financeiro_consolidado_empresa ON public.financeiro_consolidado (empresa_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_consolidado_origem ON public.financeiro_consolidado (origem, id_da_origem);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.financeiro_consolidado ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies
DROP POLICY IF EXISTS fc_select_own_empresa ON public.financeiro_consolidado;
CREATE POLICY fc_select_own_empresa ON public.financeiro_consolidado
    FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id::bigint));

DROP POLICY IF EXISTS fc_insert_own_empresa ON public.financeiro_consolidado;
CREATE POLICY fc_insert_own_empresa ON public.financeiro_consolidado
    FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id::bigint));

DROP POLICY IF EXISTS fc_update_own_empresa ON public.financeiro_consolidado;
CREATE POLICY fc_update_own_empresa ON public.financeiro_consolidado
    FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id::bigint));

DROP POLICY IF EXISTS fc_delete_own_empresa ON public.financeiro_consolidado;
CREATE POLICY fc_delete_own_empresa ON public.financeiro_consolidado
    FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id::bigint));

-- 6. Create trigger function to protect consolidations from manual updates/deletes
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
    IF OLD.origem IN ('P', 'R') THEN
        RAISE EXCEPTION 'Não é permitido alterar ou excluir manualmente lançamentos consolidados originados de baixas de títulos (P/R). Para modificar este registro, faça o ajuste ou estorno diretamente na baixa do título correspondente.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger of manual lock
DROP TRIGGER IF EXISTS tg_check_financeiro_consolidado_origem ON public.financeiro_consolidado;
CREATE TRIGGER tg_check_financeiro_consolidado_origem
BEFORE UPDATE OR DELETE ON public.financeiro_consolidado
FOR EACH ROW EXECUTE FUNCTION public.fu_check_financeiro_consolidado_origem();

-- 7. Create trigger function on financeiro_baixa for automation
CREATE OR REPLACE FUNCTION public.fu_financeiro_baixa_consolidacao()
RETURNS TRIGGER AS $$
DECLARE
    v_fin_id bigint;
    v_emp_id integer;
    v_total_pago numeric(12,2);
    v_total_desc numeric(12,2);
    v_total_juros numeric(12,2);
    v_vl_titulo numeric(12,2);
    v_status varchar(1);
    v_tp_conta varchar(1);
    v_portador_id integer;
    v_portador_id_clean integer;
    v_planoconta_id_clean integer;
    v_documento varchar(20);
BEGIN
    -- Configura bypass para permitir que este trigger atualize/delete na tabela consolidada
    PERFORM set_config('app.bypass_consolidado_check', 'true', true);

    -- Determina o financeiro_id e empresa_id a ser recalculado
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

    -- Limpa portador_id de 0 para NULL
    v_portador_id_clean := v_portador_id;
    IF v_portador_id_clean = 0 THEN
        v_portador_id_clean := NULL;
    END IF;

    -- Limpa planoconta_id de 0 para NULL
    IF TG_OP != 'DELETE' THEN
        v_planoconta_id_clean := NEW.planoconta_id;
        IF v_planoconta_id_clean = 0 THEN
            v_planoconta_id_clean := NULL;
        END IF;
    END IF;

    -- 2. Calcular totais das baixas ativas para este título
    SELECT COALESCE(SUM(vl_pago), 0), COALESCE(SUM(vl_desconto), 0), COALESCE(SUM(vl_juros), 0)
    INTO v_total_pago, v_total_desc, v_total_juros
    FROM public.financeiro_baixa
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    -- Define o novo status do título (B = Baixado, A = Aberto) com tolerância a arredondamentos
    IF (v_total_pago + v_total_desc) >= (v_vl_titulo - 0.009) THEN
        v_status := 'B';
    ELSE
        v_status := 'A';
    END IF;

    -- 3. Atualizar o Título Financeiro
    UPDATE public.financeiro
    SET vl_pago = v_total_pago,
        vl_desconto = v_total_desc,
        vl_adicional = v_total_juros,
        status = v_status
    WHERE financeiro_id = v_fin_id AND empresa_id = v_emp_id;

    -- 4. Sincronizar na Tabela Financeiro Consolidado
    IF TG_OP = 'INSERT' THEN
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
            NULL, -- Não disponível na baixa, preenchido manualmente se necessário
            v_portador_id_clean,
            v_planoconta_id_clean,
            NEW.dt_pagamento::date,
            to_char(NEW.dt_pagamento, 'MM/YYYY'),
            NEW.vl_pago,
            COALESCE(NEW.observacao, 'BAIXA DO TÍTULO DOC: ' || COALESCE(v_documento, '')),
            auth.uid(), 
            v_tp_conta, -- P (Pagar) ou R (Receber)
            NEW.financeiro_baixa_id
        );

    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.financeiro_consolidado
        SET plano_conta_id = v_planoconta_id_clean,
            data_ocorrencia = NEW.dt_pagamento::date,
            data_competencia = to_char(NEW.dt_pagamento, 'MM/YYYY'),
            valor = NEW.vl_pago,
            historico = COALESCE(NEW.observacao, 'BAIXA DO TÍTULO DOC: ' || COALESCE(v_documento, '')),
            portador_id = v_portador_id_clean,
            updated_at = now()
        WHERE id_da_origem = NEW.financeiro_baixa_id AND origem = v_tp_conta;

    ELSIF TG_OP = 'DELETE' THEN
        DELETE FROM public.financeiro_consolidado
        WHERE id_da_origem = OLD.financeiro_baixa_id AND origem = v_tp_conta;
    END IF;

    -- Restaura bypass para segurança
    PERFORM set_config('app.bypass_consolidado_check', 'false', true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind trigger to financeiro_baixa
DROP TRIGGER IF EXISTS tg_financeiro_baixa_consolidacao ON public.financeiro_baixa;
CREATE TRIGGER tg_financeiro_baixa_consolidacao
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_baixa
FOR EACH ROW EXECUTE FUNCTION public.fu_financeiro_baixa_consolidacao();

-- 8. Register version 1.18.40
DELETE FROM public.sistema_versoes WHERE versao = '1.18.40';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.40',
  'Consolidação Financeira Atômica',
  'FINANCEIRO: Criação da tabela financeiro_consolidado e automação atômica integrada com baixa de títulos.' || chr(10) ||
  '• Banco de dados: Criada a tabela financeiro_consolidado com chaves estrangeiras, índices e RLS.' || chr(10) ||
  '• Automação: Triggers para recálculo do título financeiro e sincronização do consolidado de forma atômica e protegida contra manipulação manual.',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'Supabase']
);
