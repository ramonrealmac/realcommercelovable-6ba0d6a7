-- Migration: 20260916161000_add_tp_financeiro_to_condicao_pagamento.sql
-- Description: Adiciona o campo tp_financeiro na tabela condicao_pagamento e atualiza fu_gerar_financeiro_movimento para respeitar a configuração (N = Não gera, B = Baixado, V = A Vencer).

-- 1. Adiciona a coluna tp_financeiro em condicao_pagamento
ALTER TABLE public.condicao_pagamento 
ADD COLUMN IF NOT EXISTS tp_financeiro varchar(1) DEFAULT 'V';

-- 2. Atualiza registros legados com base nos meios de pagamento atuais
UPDATE public.condicao_pagamento 
SET tp_financeiro = 'N' 
WHERE meio_pagamento_id IN (1, 21) 
   OR LOWER(COALESCE(descricao, '')) LIKE '%utilizar crédito%' 
   OR LOWER(COALESCE(descricao, '')) LIKE '%utilizar credito%' 
   OR LOWER(COALESCE(descricao, '')) LIKE '%crédito de cliente%' 
   OR LOWER(COALESCE(descricao, '')) LIKE '%credito de cliente%';

UPDATE public.condicao_pagamento 
SET tp_financeiro = 'V' 
WHERE tp_financeiro IS NULL OR tp_financeiro NOT IN ('N', 'B', 'V');

-- 3. Redefine a RPC fu_gerar_financeiro_movimento
CREATE OR REPLACE FUNCTION public.fu_gerar_financeiro_movimento(_movimento_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_pag RECORD;
  v_meio_pagamento_id integer;
  v_condicao_id bigint;
  v_mp_code character varying(2);
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela_base numeric;
  v_vl_parcela numeric;
  v_prazo integer;
  v_dt_vencimento date;
  v_i integer;
  v_dt_emissao date;

  v_operadora_id integer;
  v_tipo_antecipacao varchar(50);
  v_taxa_row RECORD;
  v_taxa_op_pct numeric := 0;
  v_taxa_ant_pct numeric := 0;
  v_vl_bruto numeric := 0;
  v_vl_despesa_op numeric := 0;
  v_vl_despesa_ant numeric := 0;
  v_vl_despesa_total numeric := 0;
  v_vl_liquido numeric := 0;
  v_base_parc numeric := 0;
  v_parc_cur numeric := 0;
  v_new_fin_id bigint;
  v_portador_id integer := 0;
  v_funcionario_id bigint;
  v_target_tp_fin varchar(1);
BEGIN
  -- 1. Obter dados do movimento
  SELECT * INTO v_mov FROM public.movimento WHERE movimento_id = _movimento_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dt_emissao := COALESCE(v_mov.dt_emissao::date, CURRENT_DATE);
  v_funcionario_id := COALESCE(v_mov.funcionario_id, 0);

  -- 2. Limpa títulos anteriores vinculados a este movimento
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 3. Para cada pagamento gravado em movimento_pagamento
  FOR v_pag IN 
    SELECT * FROM public.movimento_pagamento 
    WHERE movimento_id = _movimento_id AND COALESCE(vl_pagamento, 0) > 0
    ORDER BY movimento_pagamento_id
  LOOP
    v_condicao_id := v_pag.condicao_id;
    SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    
    v_meio_pagamento_id := v_cond.meio_pagamento_id;
    IF v_meio_pagamento_id IS NULL THEN
      IF v_cond.tipo_prazo IN ('01', 'U') AND COALESCE(v_cond.st_avista, 'S') = 'S' THEN
        v_meio_pagamento_id := 1;
      ELSE
        v_meio_pagamento_id := 15;
      END IF;
    END IF;

    -- Determina a regra do financeiro (N = Não Gera, B = Baixado, V = A Vencer)
    v_target_tp_fin := UPPER(COALESCE(v_cond.tp_financeiro, ''));

    -- Fallback se tp_financeiro não estiver definido
    IF v_target_tp_fin = '' THEN
      IF (v_meio_pagamento_id = 1 AND COALESCE(v_cond.st_avista, 'S') = 'S')
         OR v_meio_pagamento_id = 21 
         OR LOWER(COALESCE(v_cond.descricao, '')) LIKE '%utilizar crédito%' 
         OR LOWER(COALESCE(v_cond.descricao, '')) LIKE '%utilizar credito%'
         OR LOWER(COALESCE(v_cond.descricao, '')) LIKE '%crédito de cliente%'
         OR LOWER(COALESCE(v_cond.descricao, '')) LIKE '%credito de cliente%' THEN
        v_target_tp_fin := 'N';
      ELSE
        v_target_tp_fin := 'V';
      END IF;
    END IF;

    -- REGRA 'N': NÃO GERA FINANCEIRO
    IF v_target_tp_fin = 'N' THEN
      CONTINUE;
    END IF;

    -- Meio de pagamento código para tp_documento_id
    SELECT COALESCE(codigo, '99') INTO v_mp_code 
    FROM public.meio_pagamento 
    WHERE meio_pagamento_id = v_meio_pagamento_id;

    IF NOT FOUND OR v_mp_code IS NULL THEN
      v_mp_code := '99';
    END IF;

    -- Determina número de parcelas
    v_n_parcelas := COALESCE(v_pag.n_parcelas, NULLIF(v_cond.qtd_parcelas, 0), 1);
    IF v_n_parcelas = 1 AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
      v_n_parcelas := (
        (CASE WHEN COALESCE(v_cond.prazo_1, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_2, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_3, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_4, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_5, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_6, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_7, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_8, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_9, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_10, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_11, 0) > 0 THEN 1 ELSE 0 END) +
        (CASE WHEN COALESCE(v_cond.prazo_12, 0) > 0 THEN 1 ELSE 0 END)
      );
      IF v_n_parcelas = 0 THEN v_n_parcelas := 1; END IF;
    END IF;
    IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

    v_operadora_id := v_pag.operadora_id;
    v_portador_id := COALESCE(v_pag.portador_id, 0);

    -- REGRA 'B': FINANCEIRO BAIXADO (Com baixa automática no financeiro)
    IF v_target_tp_fin = 'B' THEN
      v_vl_bruto := v_pag.vl_pagamento;
      v_vl_despesa_total := 0;

      -- Se for cartão com operadora, calcula a taxa de operadora se houver
      IF v_meio_pagamento_id = 3 AND v_operadora_id IS NOT NULL THEN
        SELECT taxa_cartao, taxa_antecipacao INTO v_taxa_row
        FROM public.operadora_taxa
        WHERE operadora_id = v_operadora_id
          AND empresa_id = v_mov.empresa_id
          AND (parcela = v_n_parcelas::text OR parcela = (v_n_parcelas::text || 'X'))
          AND excluido = false
        LIMIT 1;

        v_taxa_op_pct := COALESCE(v_taxa_row.taxa_cartao, 0);
        v_taxa_ant_pct := COALESCE(v_taxa_row.taxa_antecipacao, 0);

        v_vl_despesa_op := ROUND((v_vl_bruto * (v_taxa_op_pct / 100)), 2);
        v_base_parc := ROUND((v_vl_bruto / v_n_parcelas), 2);
        v_vl_despesa_ant := 0;

        FOR v_i IN 1..v_n_parcelas LOOP
          IF v_i = v_n_parcelas THEN
            v_parc_cur := v_vl_bruto - (v_base_parc * (v_n_parcelas - 1));
          ELSE
            v_parc_cur := v_base_parc;
          END IF;
          v_vl_despesa_ant := v_vl_despesa_ant + ROUND((v_parc_cur * ((v_taxa_ant_pct * v_i) / 100)), 2);
        END LOOP;

        v_vl_despesa_total := v_vl_despesa_op + v_vl_despesa_ant;
      END IF;

      v_vl_liquido := GREATEST(0, v_vl_bruto - v_vl_despesa_total);

      INSERT INTO public.financeiro (
        empresa_id, movimento_id, documento, parcela, tp_documento_id,
        tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
        observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
        vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
      ) VALUES (
        v_mov.empresa_id,
        _movimento_id,
        (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
        1,
        v_mp_code,
        'R',
        v_dt_emissao,
        v_dt_emissao,
        v_portador_id,
        COALESCE(v_mov.cadastro_id, 0),
        'TITULO GERADO E BAIXADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
        v_vl_bruto,
        0,
        v_vl_liquido,
        0,
        v_vl_despesa_total,
        COALESCE(v_cond.plano_conta_id, 0),
        COALESCE(v_cond.plano_conta_id, 0),
        'S',
        'B',
        v_funcionario_id
      ) RETURNING financeiro_id INTO v_new_fin_id;

      INSERT INTO public.financeiro_baixa (
        empresa_id, financeiro_id, documento, dt_pagamento, vl_pago,
        vl_despesa, vl_desconto, vl_juros, recibo, tipo_pag_rec_id,
        observacao, plano_id, planoconta_id, tp_conta, cadastro_id
      ) VALUES (
        v_mov.empresa_id,
        v_new_fin_id,
        (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
        v_dt_emissao,
        v_vl_liquido,
        v_vl_despesa_total,
        0, 0,
        'RECIBO',
        3,
        'Baixa Automática conforme condição de pagamento (' || COALESCE(v_cond.descricao, '') || ')',
        COALESCE(v_cond.plano_conta_id, 0),
        COALESCE(v_cond.plano_conta_id, 0),
        'R',
        COALESCE(v_mov.cadastro_id, 0)
      );

    -- REGRA 'V': FINANCEIRO A VENCER (Gera parcelas normais a vencer)
    ELSE
      v_vl_parcela_base := ROUND((v_pag.vl_pagamento / v_n_parcelas), 2);

      FOR v_i IN 1..v_n_parcelas LOOP
        IF v_i = v_n_parcelas THEN
          v_vl_parcela := v_pag.vl_pagamento - (v_vl_parcela_base * (v_n_parcelas - 1));
        ELSE
          v_vl_parcela := v_vl_parcela_base;
        END IF;

        IF v_cond IS NOT NULL AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'V' THEN
          v_prazo := CASE v_i
            WHEN 1 THEN COALESCE(v_cond.prazo_1, 0)
            WHEN 2 THEN COALESCE(v_cond.prazo_2, 0)
            WHEN 3 THEN COALESCE(v_cond.prazo_3, 0)
            WHEN 4 THEN COALESCE(v_cond.prazo_4, 0)
            WHEN 5 THEN COALESCE(v_cond.prazo_5, 0)
            WHEN 6 THEN COALESCE(v_cond.prazo_6, 0)
            WHEN 7 THEN COALESCE(v_cond.prazo_7, 0)
            WHEN 8 THEN COALESCE(v_cond.prazo_8, 0)
            WHEN 9 THEN COALESCE(v_cond.prazo_9, 0)
            WHEN 10 THEN COALESCE(v_cond.prazo_10, 0)
            WHEN 11 THEN COALESCE(v_cond.prazo_11, 0)
            WHEN 12 THEN COALESCE(v_cond.prazo_12, 0)
            ELSE 30 * v_i
          END;
        ELSIF v_cond IS NOT NULL AND UPPER(TRIM(COALESCE(v_cond.tipo_prazo, ''))) = 'F' THEN
          v_prazo := COALESCE(NULLIF(v_cond.intervalo, 0), 30) * v_i;
        ELSE
          v_prazo := COALESCE(NULLIF(v_cond.prazo_1, 0), COALESCE(NULLIF(v_cond.intervalo, 0), 30) * v_i);
        END IF;

        v_dt_vencimento := v_dt_emissao + v_prazo;

        INSERT INTO public.financeiro (
          empresa_id, movimento_id, documento, parcela, tp_documento_id,
          tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
          observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
          vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
        ) VALUES (
          v_mov.empresa_id,
          _movimento_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-' || v_i),
          v_i,
          v_mp_code,
          'R',
          v_dt_emissao,
          v_dt_vencimento,
          v_portador_id,
          COALESCE(v_mov.cadastro_id, 0),
          'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || ' (' || v_i || '/' || v_n_parcelas || ')',
          v_vl_parcela,
          0, 0, 0, 0,
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'S',
          'A',
          v_funcionario_id
        );
      END LOOP;
    END IF;

  END LOOP;
END;
$$;

-- Recarrega esquema no PostgREST
NOTIFY pgrst, 'reload schema';
