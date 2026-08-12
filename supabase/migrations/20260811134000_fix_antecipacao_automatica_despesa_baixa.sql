-- Migration: 20260811134000_fix_antecipacao_automatica_despesa_baixa.sql
-- Description: Fixes automatic card antecipação clearance balance and status. Updates fu_financeiro_baixa_consolidacao trigger to sum vl_despesa towards title settlement (status B, zero remaining balance) and updates fu_pdv_registrar_recebimento_venda.

-- 1. Update trigger function fu_financeiro_baixa_consolidacao
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
        vl_despesas = v_total_despesa,
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


-- 2. Update fu_pdv_registrar_recebimento_venda PL/pgSQL function
CREATE OR REPLACE FUNCTION public.fu_pdv_registrar_recebimento_venda(
  _empresa_id bigint, 
  _movimento_id bigint, 
  _caixa_abertura_id bigint, 
  _funcionario_caixa_id bigint, 
  _dt_movimento date, 
  _tp_operacao_caixa text, 
  _centro_custo_caixa bigint, 
  _pagamentos jsonb, 
  _usuario_id uuid DEFAULT NULL::uuid
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_bloquear_pedido character varying(1);
  v_total_venda numeric;
  v_total_recebido numeric := 0;
  v_troco numeric := 0;
  v_pag_row jsonb;
  v_caixa_mov_id bigint;
  v_meio_pagamento_id integer;
  v_soma_caixa boolean;
  v_valor_somar_caixa numeric := 0;
  v_pag_dinheiro_ajustado numeric;
  v_idx_dinheiro integer := -1;
  v_idx integer := 0;

  -- Variáveis adicionais para geração do financeiro
  v_condicao_id bigint;
  v_mp_code character varying(2);
  v_cond RECORD;
  v_n_parcelas integer;
  v_vl_parcela_base numeric;
  v_vl_parcela numeric;
  v_prazo integer;
  v_dt_vencimento date;
  v_i integer;

  -- Variáveis para tratamento de Operadora e Tipo de Antecipação
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
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  IF v_mov.st_pedido IN ('R', 'C') THEN
    RETURN jsonb_build_object('error', 'Pedido já recebido ou cancelado.');
  END IF;

  -- Validação de segurança dupla de crédito
  SELECT COALESCE(bloquear_pedido, 'N') INTO v_bloquear_pedido FROM public.empresa WHERE empresa_id = _empresa_id;
  IF v_bloquear_pedido = 'S' AND COALESCE(v_mov.st_bloqueado, 'N') = 'S' THEN
    RETURN jsonb_build_object('error', 'Este pedido está BLOQUEADO por análise de crédito e não pode ser recebido.');
  END IF;

  v_total_venda := v_mov.vl_movimento;

  -- 2. Limpa pagamentos anteriores do movimento (caso de pedido previamente no caixa)
  DELETE FROM movimento_pagamento WHERE movimento_id = _movimento_id;

  -- 3. Calcula total recebido e troco
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_total_recebido := v_total_recebido + (v_pag_row->>'vl_recebido')::numeric;
  END LOOP;

  v_troco := GREATEST(0, v_total_recebido - v_total_venda);

  -- 4. Grava movimento_pagamento
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    INSERT INTO movimento_pagamento (
      empresa_id, movimento_id, condicao_id, tp_pagamento, vl_pagamento, 
      nr_autorizacao, bandeira_id, operadora_id, n_parcelas, dt_pagamento
    ) VALUES (
      _empresa_id, _movimento_id, (v_pag_row->>'condicao_id')::bigint, v_pag_row->>'condicao_descricao', 
      (v_pag_row->>'vl_recebido')::numeric, COALESCE(v_pag_row->>'numero_autoriza', ''), 
      NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
      (v_pag_row->>'qt_parcela')::integer, now()
    );
  END LOOP;

  -- 5. Grava caixa_movimento
  INSERT INTO caixa_movimento (
    empresa_id, caixa_abertura_id, funcionario_id, colaborador_id, dt_movimento,
    tp_movimento, tp_operacao, centro_custo_id, historico, documento,
    vl_movimento, vl_troco, movimento_id, excluido
  ) VALUES (
    _empresa_id, _caixa_abertura_id, _funcionario_caixa_id, _funcionario_caixa_id, _dt_movimento,
    'E', _tp_operacao_caixa, _centro_custo_caixa, 'Recebimento Pedido ' || v_mov.nr_movimento, v_mov.nr_movimento::text,
    v_total_venda, v_troco, _movimento_id, false
  ) RETURNING caixa_movimento_id INTO v_caixa_mov_id;

  -- 6. Prepara itens do caixa (com ajuste de troco no dinheiro)
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := (v_pag_row->>'meio_pagamento_id')::integer;
    v_pag_dinheiro_ajustado := (v_pag_row->>'vl_recebido')::numeric;

    -- Se tem troco e é dinheiro (meio_pagamento_id = 1), deduz do valor que entra no caixa
    IF v_troco > 0 AND v_meio_pagamento_id = 1 THEN
      v_pag_dinheiro_ajustado := GREATEST(0, v_pag_dinheiro_ajustado - v_troco);
      v_troco := 0; 
    END IF;

    -- Só insere no caixa se sobrou valor
    IF v_pag_dinheiro_ajustado > 0 THEN
      INSERT INTO caixa_movimento_item (
        caixa_movimento_id, empresa_id, condicao_id, prazo_pagamento_id,
        bandeira_id, operadora_id, numero_autoriza, qt_parcela, vl_parcela,
        vl_recebido, plano_conta_id, meio_pagamento_id, excluido
      ) VALUES (
        v_caixa_mov_id, _empresa_id, (v_pag_row->>'condicao_id')::bigint, 0,
        NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
        COALESCE(v_pag_row->>'numero_autoriza', ''), (v_pag_row->>'qt_parcela')::integer, 
        v_pag_dinheiro_ajustado / GREATEST(1, (v_pag_row->>'qt_parcela')::integer),
        v_pag_dinheiro_ajustado, NULLIF((v_pag_row->>'plano_conta_id')::text, '')::integer, v_meio_pagamento_id, false
      );

      -- 7. Soma ao caixa abertura se meio_pagamento.soma_vl_caixa = 'S'
      IF v_meio_pagamento_id IS NOT NULL THEN
        SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
        IF v_soma_caixa THEN
          v_valor_somar_caixa := v_valor_somar_caixa + v_pag_dinheiro_ajustado;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 8. Atualiza caixa_abertura
  IF v_valor_somar_caixa > 0 THEN
    UPDATE caixa_abertura 
    SET vl_fechamento = COALESCE(vl_fechamento, 0) + v_valor_somar_caixa
    WHERE caixa_abertura_id = _caixa_abertura_id;
  END IF;

  -- 8b. Gerar parcelas/títulos no financeiro para pagamentos a prazo específicos
  -- 1. Limpa parcelas anteriores do financeiro para este movimento_id
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 2. Prepara e insere os lançamentos no financeiro
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := NULLIF(v_pag_row->>'meio_pagamento_id', '')::integer;
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;

    IF v_meio_pagamento_id IS NULL AND v_condicao_id IS NOT NULL THEN
      SELECT meio_pagamento_id INTO v_meio_pagamento_id FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    END IF;

    -- Gera parcelas para meios de pagamento a prazo específicos:
    -- 03 (Cartão de Crédito), 05 (Cartão da Loja/Crediário), 14 (Duplicata), 15 (Boleto), 91 (Posterior)
    IF v_meio_pagamento_id IN (3, 5, 14, 15, 91) THEN
      SELECT COALESCE(codigo, '99') INTO v_mp_code FROM public.meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
      IF NOT FOUND THEN
        v_mp_code := '99';
      END IF;

      SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;

      v_n_parcelas := COALESCE((v_pag_row->>'qt_parcela')::integer, 1);
      IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

      v_operadora_id := NULLIF((v_pag_row->>'operadora_id')::text, '')::integer;
      v_portador_id := COALESCE(NULLIF((v_pag_row->>'portador_id')::text, '')::integer, 0);
      v_tipo_antecipacao := 'SEM ANTECIPAÇÃO';

      IF v_meio_pagamento_id = 3 AND v_operadora_id IS NOT NULL THEN
        SELECT COALESCE(tipo_antecipacao, 'SEM ANTECIPAÇÃO') INTO v_tipo_antecipacao 
        FROM public.operadora 
        WHERE operadora_id = v_operadora_id;
      END IF;

      -- =========================================================================
      -- CASO A: CARTÃO DE CRÉDITO COM ANTECIPAÇÃO AUTOMÁTICA
      -- =========================================================================
      IF v_meio_pagamento_id = 3 AND UPPER(v_tipo_antecipacao) = 'AUTOMÁTICA' THEN
        v_vl_bruto := (v_pag_row->>'vl_recebido')::numeric;

        -- Busca taxas registradas para a operadora e o número de parcelas
        SELECT taxa_cartao, taxa_antecipacao INTO v_taxa_row
        FROM public.operadora_taxa
        WHERE operadora_id = v_operadora_id
          AND empresa_id = _empresa_id
          AND (parcela = v_n_parcelas::text OR parcela = (v_n_parcelas::text || 'X'))
          AND excluido = false
        LIMIT 1;

        v_taxa_op_pct := COALESCE(v_taxa_row.taxa_cartao, 0);
        v_taxa_ant_pct := COALESCE(v_taxa_row.taxa_antecipacao, 0);

        -- Valor da Taxa Operadora
        v_vl_despesa_op := ROUND((v_vl_bruto * (v_taxa_op_pct / 100)), 2);

        -- Valor da Taxa de Antecipação por Prazo das Parcelas
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

        -- Total Despesa (Operadora + Antecipação) e Valor Líquido Recebido no Caixa
        v_vl_despesa_total := v_vl_despesa_op + v_vl_despesa_ant;
        v_vl_liquido := GREATEST(0, v_vl_bruto - v_vl_despesa_total);

        -- Insere 1 parcela única na tabela financeiro
        INSERT INTO public.financeiro (
          empresa_id, movimento_id, documento, parcela, tp_documento_id,
          tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
          observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
          vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
        ) VALUES (
          _empresa_id,
          _movimento_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
          1,
          v_mp_code,
          'R',
          _dt_movimento,
          _dt_movimento,
          v_portador_id,
          COALESCE(v_mov.cadastro_id, 0),
          'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || ' (ANTECIPAÇÃO AUTOMÁTICA)',
          v_vl_bruto,
          0,
          v_vl_bruto, -- Valor Bruto Quitado para zerar o título
          0,
          v_vl_despesa_total,
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'S',
          'B', -- STATUS B (BAIXADO)
          _funcionario_caixa_id
        ) RETURNING financeiro_id INTO v_new_fin_id;

        -- Insere registro automático de baixa na tabela financeiro_baixa
        INSERT INTO public.financeiro_baixa (
          empresa_id, financeiro_id, documento, dt_pagamento, vl_pago,
          vl_despesa, vl_desconto, vl_juros, recibo, tipo_pag_rec_id,
          observacao, plano_id, planoconta_id, tp_conta, cadastro_id
        ) VALUES (
          _empresa_id,
          v_new_fin_id,
          (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-1'),
          _dt_movimento,
          v_vl_liquido,
          v_vl_despesa_total,
          0, 0,
          'CARTAO',
          3,
          'Baixa Automática no Caixa (Cartão ' || v_n_parcelas || 'x - Antecipação Automática)',
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'R',
          COALESCE(v_mov.cadastro_id, 0)
        );

      -- =========================================================================
      -- CASO B: SEM ANTECIPAÇÃO OU AVULSA (GERA PARCELAS EM ABERTO STATUS 'A')
      -- =========================================================================
      ELSE
        v_vl_parcela_base := ROUND(((v_pag_row->>'vl_recebido')::numeric / v_n_parcelas), 2);

        FOR v_i IN 1..v_n_parcelas LOOP
          IF v_i = v_n_parcelas THEN
            v_vl_parcela := (v_pag_row->>'vl_recebido')::numeric - (v_vl_parcela_base * (v_n_parcelas - 1));
          ELSE
            v_vl_parcela := v_vl_parcela_base;
          END IF;

          IF v_cond IS NOT NULL AND v_cond.tipo_prazo = 'F' THEN
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
          ELSE
            v_prazo := COALESCE(v_cond.intervalo, 30) * v_i;
          END IF;

          v_dt_vencimento := _dt_movimento + v_prazo;

          INSERT INTO public.financeiro (
            empresa_id, movimento_id, documento, parcela, tp_documento_id,
            tp_conta, dt_emissao, dt_vencto, portador_id, cadastro_id,
            observacao1, vl_titulo, vl_desconto, vl_pago, vl_adicional,
            vl_despesa, planoconta_id, plano_id, ativo, status, funcionario_id
          ) VALUES (
            _empresa_id,
            _movimento_id,
            (COALESCE(v_mov.nr_movimento::text, _movimento_id::text) || '-' || v_i),
            v_i,
            v_mp_code,
            'R',
            _dt_movimento,
            v_dt_vencimento,
            v_portador_id,
            COALESCE(v_mov.cadastro_id, 0),
            'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
            v_vl_parcela,
            0, 0, 0, 0,
            COALESCE(v_cond.plano_conta_id, 0),
            COALESCE(v_cond.plano_conta_id, 0),
            'S',
            'A', -- STATUS A (ABERTO)
            _funcionario_caixa_id
          );
        END LOOP;
      END IF;

    END IF;
  END LOOP;

  -- 9. Transição de status do PDV ('R' e baixa de estoque)
  PERFORM public.fu_mudar_status_pedido_pdv(_movimento_id, 'R', _usuario_id);

  -- Retorna sucesso
  RETURN jsonb_build_object(
    'success', true, 
    'movimento_id', _movimento_id, 
    'caixa_movimento_id', v_caixa_mov_id,
    'vl_somado_caixa', v_valor_somar_caixa
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
