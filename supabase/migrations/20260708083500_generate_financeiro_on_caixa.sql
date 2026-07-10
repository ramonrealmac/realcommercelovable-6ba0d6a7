-- Migration: 20260708083500_generate_financeiro_on_caixa.sql
-- Description: Overwrites fu_pdv_registrar_recebimento_venda to auto-generate installments (financeiro) on POS checkout completion and registers version 1.18.28.

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
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END if;

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
      -- Consome o troco para nao deduzir de multiplos dinheiros se houver erro no front
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
        v_pag_dinheiro_ajustado / GREATEST(1, (v_pag_row->>'qt_parcela')::integer), -- Recalcula parcela
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

  -- 8b. Gerar parcelas no financeiro para pagamentos a prazo específicos
  -- 1. Limpa parcelas anteriores do financeiro para este movimento_id
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 2. Prepara e insere as parcelas no financeiro
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := NULLIF(v_pag_row->>'meio_pagamento_id', '')::integer;
    v_condicao_id := (v_pag_row->>'condicao_id')::bigint;

    -- Se meio_pagamento_id não vier no JSON, busca da tabela condicao_pagamento
    IF v_meio_pagamento_id IS NULL AND v_condicao_id IS NOT NULL THEN
      SELECT meio_pagamento_id INTO v_meio_pagamento_id FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;
    END IF;

    -- Gera parcelas apenas para meios de pagamento a prazo específicos:
    -- 03 (Cartão de Crédito), 05 (Cartão da Loja/Crediário), 14 (Duplicata), 15 (Boleto), 91 (Posterior)
    IF v_meio_pagamento_id IN (3, 5, 14, 15, 91) THEN
      -- Busca o código do meio de pagamento
      SELECT COALESCE(codigo, '99') INTO v_mp_code FROM public.meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
      IF NOT FOUND THEN
        v_mp_code := '99';
      END IF;

      -- Busca a condicao_pagamento completa
      SELECT * INTO v_cond FROM public.condicao_pagamento WHERE condicao_id = v_condicao_id;

      v_n_parcelas := COALESCE((v_pag_row->>'qt_parcela')::integer, 1);
      IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;

      v_vl_parcela_base := ROUND(((v_pag_row->>'vl_recebido')::numeric / v_n_parcelas), 2);

      FOR v_i IN 1..v_n_parcelas LOOP
        -- Ajusta a última parcela para evitar dízimas periódicas/erros de arredondamento
        IF v_i = v_n_parcelas THEN
          v_vl_parcela := (v_pag_row->>'vl_recebido')::numeric - (v_vl_parcela_base * (v_n_parcelas - 1));
        ELSE
          v_vl_parcela := v_vl_parcela_base;
        END IF;

        -- Calcula o vencimento baseado no tipo de prazo
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
          0,
          COALESCE(v_mov.cadastro_id, 0),
          'TITULO GERADO REF. PEDIDO N. ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
          v_vl_parcela,
          0, 0, 0, 0,
          COALESCE(v_cond.plano_conta_id, 0),
          COALESCE(v_cond.plano_conta_id, 0),
          'S',
          'A',
          _funcionario_caixa_id
        );
      END LOOP;
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

-- 10. Registro da Versão 1.18.28 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.28';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.28',
  'Geração do Financeiro no Caixa',
  'Transferência da rotina de geração de parcelas financeiras (contas a receber) do lançamento do pedido no frontend para a finalização da venda no caixa no backend (através da RPC fu_pdv_registrar_recebimento_venda). Isso assegura atomicidade e consistência no processamento de vendas a prazo.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
