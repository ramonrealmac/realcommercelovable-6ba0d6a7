-- Migration: 20260914150000_create_tabela_creditos_e_conta_corrente.sql
-- Description: Cria a estrutura de Gestão de Créditos de Clientes e Fornecedores com livro razão / conta corrente e função RPC de movimentação atômica.

-- 1. Tabela de Saldos de Crédito por Parceiro
CREATE TABLE IF NOT EXISTS public.cadastro_credito_saldo (
  credito_saldo_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  cadastro_id bigint NOT NULL,
  tp_parceiro text NOT NULL CHECK (tp_parceiro IN ('CLIENTE', 'FORNECEDOR')),
  vl_saldo_atual numeric(15,2) NOT NULL DEFAULT 0.00,
  dt_ultima_movimentacao timestamp with time zone DEFAULT now(),
  excluido boolean DEFAULT false,
  dt_cadastro timestamp with time zone DEFAULT now(),
  dt_alteracao timestamp with time zone DEFAULT now(),
  CONSTRAINT uq_credito_saldo UNIQUE (empresa_id, cadastro_id, tp_parceiro)
);

-- Index para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_credito_saldo_lookup 
  ON public.cadastro_credito_saldo(empresa_id, cadastro_id, tp_parceiro) 
  WHERE excluido = false;

-- 2. Tabela de Extrato / Movimentação de Crédito (Conta Corrente)
CREATE TABLE IF NOT EXISTS public.cadastro_credito_movimento (
  credito_movimento_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  cadastro_id bigint NOT NULL,
  tp_parceiro text NOT NULL CHECK (tp_parceiro IN ('CLIENTE', 'FORNECEDOR')),
  tp_movimento text NOT NULL CHECK (tp_movimento IN ('C', 'D')), -- 'C' = Crédito (+), 'D' = Débito (-)
  vl_movimento numeric(15,2) NOT NULL CHECK (vl_movimento > 0),
  vl_saldo_anterior numeric(15,2) NOT NULL DEFAULT 0.00,
  vl_saldo_posterior numeric(15,2) NOT NULL DEFAULT 0.00,
  origem_movimento text NOT NULL, -- Ex: 'ESTORNO_PEDIDO', 'DEVOLUCAO_COMPRA', 'ABATE_PEDIDO', 'ABATE_FINANCEIRO', 'LANCAMENTO_MANUAL', 'REEMBOLSO'
  movimento_id bigint,
  financeiro_id bigint,
  caixa_movimento_id bigint,
  historico text NOT NULL,
  usuario_id uuid,
  dt_movimento timestamp with time zone DEFAULT now(),
  excluido boolean DEFAULT false
);

-- Index para histórico e relatórios
CREATE INDEX IF NOT EXISTS idx_credito_mov_cadastro 
  ON public.cadastro_credito_movimento(empresa_id, cadastro_id, dt_movimento DESC) 
  WHERE excluido = false;

-- 3. Função RPC Atômica para Registrar Movimentação de Crédito
CREATE OR REPLACE FUNCTION public.fu_registrar_movimento_credito(
  _empresa_id bigint,
  _cadastro_id bigint,
  _tp_parceiro text, -- 'CLIENTE' ou 'FORNECEDOR'
  _tp_movimento text, -- 'C' ou 'D'
  _vl_movimento numeric,
  _origem_movimento text,
  _historico text,
  _usuario_id uuid DEFAULT NULL::uuid,
  _movimento_id bigint DEFAULT NULL::bigint,
  _financeiro_id bigint DEFAULT NULL::bigint,
  _caixa_movimento_id bigint DEFAULT NULL::bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_saldo_id bigint;
  v_saldo_ant numeric(15,2) := 0.00;
  v_saldo_post numeric(15,2) := 0.00;
  v_mov_id bigint;
BEGIN
  -- Validações básicas
  IF _vl_movimento IS NULL OR _vl_movimento <= 0 THEN
    RETURN jsonb_build_object('error', 'O valor da movimentação de crédito deve ser maior que zero.');
  END IF;

  IF _tp_parceiro NOT IN ('CLIENTE', 'FORNECEDOR') THEN
    RETURN jsonb_build_object('error', 'Tipo de parceiro inválido. Deve ser CLIENTE ou FORNECEDOR.');
  END IF;

  IF _tp_movimento NOT IN ('C', 'D') THEN
    RETURN jsonb_build_object('error', 'Tipo de movimentação inválido. Deve ser C (Crédito) ou D (Débito).');
  END IF;

  -- 1. Garante ou obtém o registro de saldo com lock FOR UPDATE
  SELECT credito_saldo_id, vl_saldo_atual
  INTO v_saldo_id, v_saldo_ant
  FROM public.cadastro_credito_saldo
  WHERE empresa_id = _empresa_id
    AND cadastro_id = _cadastro_id
    AND tp_parceiro = _tp_parceiro
    AND excluido = false
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.cadastro_credito_saldo (
      empresa_id, cadastro_id, tp_parceiro, vl_saldo_atual, dt_ultima_movimentacao
    ) VALUES (
      _empresa_id, _cadastro_id, _tp_parceiro, 0.00, now()
    )
    RETURNING credito_saldo_id, vl_saldo_atual INTO v_saldo_id, v_saldo_ant;
  END IF;

  -- 2. Se for débito, verifica se há saldo suficiente
  IF _tp_movimento = 'D' THEN
    IF v_saldo_ant < _vl_movimento THEN
      RETURN jsonb_build_object(
        'error', 
        'Saldo de crédito insuficiente para esta operação. Saldo atual: R$ ' || to_char(v_saldo_ant, 'FM999G999G990D00') || ', Valor desejado: R$ ' || to_char(_vl_movimento, 'FM999G999G990D00')
      );
    END IF;
    v_saldo_post := v_saldo_ant - _vl_movimento;
  ELSE
    v_saldo_post := v_saldo_ant + _vl_movimento;
  END IF;

  -- 3. Atualiza a tabela de saldos consolidados
  UPDATE public.cadastro_credito_saldo
  SET vl_saldo_atual = v_saldo_post,
      dt_ultima_movimentacao = now(),
      dt_alteracao = now()
  WHERE credito_saldo_id = v_saldo_id;

  -- 4. Insere o registro imutável no extrato (conta corrente)
  INSERT INTO public.cadastro_credito_movimento (
    empresa_id, cadastro_id, tp_parceiro,
    tp_movimento, vl_movimento, vl_saldo_anterior, vl_saldo_posterior,
    origem_movimento, movimento_id, financeiro_id, caixa_movimento_id,
    historico, usuario_id, dt_movimento
  ) VALUES (
    _empresa_id, _cadastro_id, _tp_parceiro,
    _tp_movimento, _vl_movimento, v_saldo_ant, v_saldo_post,
    _origem_movimento, _movimento_id, _financeiro_id, _caixa_movimento_id,
    _historico, _usuario_id, now()
  )
  RETURNING credito_movimento_id INTO v_mov_id;

  RETURN jsonb_build_object(
    'success', true,
    'credito_movimento_id', v_mov_id,
    'vl_saldo_anterior', v_saldo_ant,
    'vl_saldo_posterior', v_saldo_post
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 4. Atualizar fu_estornar_pedido_sem_nfe para usar fu_registrar_movimento_credito
CREATE OR REPLACE FUNCTION public.fu_estornar_pedido_sem_nfe(
  _movimento_id bigint,
  _empresa_id bigint,
  _usuario_id uuid DEFAULT NULL::uuid,
  _opcao_dinheiro text DEFAULT NULL, -- 'ESPECIE' ou 'CREDITO'
  _itens jsonb DEFAULT '[]'::jsonb,   -- array of { movimento_item_id, produto_id, qt_devolver, deposito_id, vl_devolucao }
  _caixa_abertura_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_nfe RECORD;
  v_item jsonb;
  v_mov_item_id bigint;
  v_produto_id bigint;
  v_qt_devolver numeric;
  v_deposito_id bigint;
  v_vl_item_devolucao numeric;
  v_total_devolucao numeric := 0;
  v_cadastro_id bigint;
  v_meio_dinheiro boolean := false;
  v_rec_row RECORD;
  v_new_cm_id bigint;
  v_cred_res jsonb;
BEGIN
  -- 1. Verifica existência do movimento
  SELECT * INTO v_mov 
  FROM public.movimento 
  WHERE movimento_id = _movimento_id 
    AND empresa_id = _empresa_id 
    AND excluido = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado.');
  END IF;

  v_cadastro_id := v_mov.cadastro_id;

  -- 2. Validação FISCAL: Impedir se houver NF-e vinculada emitida/autorizada
  SELECT * INTO v_nfe
  FROM public.fiscal_nfe_cabecalho
  WHERE movimento_id = _movimento_id
    AND empresa_id = _empresa_id
    AND st_nf IN ('E', '1') -- Emitida / Autorizada
    AND excluido = false
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'error', 
      'Este pedido possui a NF-e n° ' || COALESCE(v_nfe.nr_nota::text, '') || ' autorizada. Este fluxo é exclusivo para pedidos SEM NF-e. Utilize a Devolução de NF-e de Saída.'
    );
  END IF;

  -- 3. Identifica se o recebimento original envolveu DINHEIRO
  FOR v_rec_row IN
    SELECT cmi.meio_pagamento_id, mp.soma_vl_caixa
    FROM public.caixa_movimento cm
    JOIN public.caixa_movimento_item cmi ON cmi.caixa_movimento_id = cm.caixa_movimento_id
    LEFT JOIN public.meio_pagamento mp ON mp.meio_pagamento_id = cmi.meio_pagamento_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false
  LOOP
    IF v_rec_row.meio_pagamento_id = 1 OR UPPER(COALESCE(v_rec_row.soma_vl_caixa, 'N')) = 'S' THEN
      v_meio_dinheiro := true;
    END IF;
  END LOOP;

  -- Se não achou em caixa_movimento, verifica em movimento_pagamento
  IF NOT v_meio_dinheiro THEN
    IF EXISTS (
      SELECT 1 FROM public.movimento_pagamento 
      WHERE movimento_id = _movimento_id 
        AND meio_pagamento_id = 1 
        AND excluido = false
    ) THEN
      v_meio_dinheiro := true;
    END IF;
  END IF;

  -- Valida escolha para dinheiro
  IF v_meio_dinheiro THEN
    IF _opcao_dinheiro IS NULL OR _opcao_dinheiro NOT IN ('ESPECIE', 'CREDITO') THEN
      RETURN jsonb_build_object('error', 'Para recebimentos em dinheiro, é obrigatório selecionar entre DEVOLVER EM ESPÉCIE ou GERAR CRÉDITO PARA O CLIENTE.');
    END IF;

    IF _opcao_dinheiro = 'ESPECIE' AND _caixa_abertura_id IS NULL THEN
      -- Busca o caixa aberto mais recente para este usuário/empresa se não fornecido
      SELECT caixa_abertura_id INTO _caixa_abertura_id
      FROM public.caixa_abertura
      WHERE empresa_id = _empresa_id
        AND status = 'A'
        AND excluido = false
      ORDER BY caixa_abertura_id DESC
      LIMIT 1;

      IF _caixa_abertura_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Não há caixa aberto disponível para registrar a saída em espécie.');
      END IF;
    END IF;
  END IF;

  -- 4. Processa os itens e atualiza o estoque
  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    v_mov_item_id        := (v_item->>'movimento_item_id')::bigint;
    v_produto_id         := (v_item->>'produto_id')::bigint;
    v_qt_devolver        := (v_item->>'qt_devolver')::numeric;
    v_deposito_id        := COALESCE((v_item->>'deposito_id')::bigint, v_mov.deposito_id, 1);
    v_vl_item_devolucao  := (v_item->>'vl_devolucao')::numeric;

    IF v_qt_devolver > 0 THEN
      v_total_devolucao := v_total_devolucao + v_vl_item_devolucao;

      -- 4a. Atualiza qt_devolvido no movimento_item
      UPDATE public.movimento_item
      SET qt_devolvido = COALESCE(qt_devolvido, 0) + v_qt_devolver
      WHERE movimento_item_id = v_mov_item_id;

      -- 4b. Restaura o estoque
      IF NOT EXISTS (
        SELECT 1 FROM public.estoque 
        WHERE produto_id = v_produto_id 
          AND empresa_id = _empresa_id 
          AND deposito_id = v_deposito_id
      ) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (v_produto_id, _empresa_id, v_deposito_id, 0, 0);
      END IF;

      UPDATE public.estoque
      SET estoque_reservado = estoque_reservado + v_qt_devolver
      WHERE produto_id = v_produto_id 
        AND empresa_id = _empresa_id 
        AND deposito_id = v_deposito_id;

      -- 4c. Log de estoque
      INSERT INTO public.estoque_log (
        empresa_id, produto_id, deposito_id,
        qt_movimento, operacao, origem,
        nr_doc, usuario, dt_hs_log
      ) VALUES (
        _empresa_id, v_produto_id, v_deposito_id,
        v_qt_devolver,
        'DEVOLUCAO_PEDIDO_SEM_NFE', 'ESTORNO_SEM_NFE',
        _movimento_id::varchar, COALESCE(_usuario_id::varchar, 'SISTEMA'), now()
      );
    END IF;
  END LOOP;

  IF v_total_devolucao <= 0 THEN
    RETURN jsonb_build_object('error', 'Nenhum item com quantidade a devolver válida foi informado.');
  END IF;

  -- 5. Tratamento de caixa / crédito conforme opção
  IF v_meio_dinheiro AND _opcao_dinheiro = 'ESPECIE' THEN
    -- Gera DÉBITO/SAÍDA no caixa
    INSERT INTO public.caixa_movimento (
      empresa_id, funcionario_id, colaborador_id,
      dt_movimento, tp_movimento, tp_operacao,
      historico, vl_movimento,
      movimento_id, caixa_abertura_id,
      excluido, dt_cadastro, dt_alteracao
    ) VALUES (
      _empresa_id, NULL, NULL,
      CURRENT_DATE, 'S', 'S',
      'DEVOLUÇÃO EM ESPÉCIE - PEDIDO N° ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
      -v_total_devolucao,
      _movimento_id::integer, _caixa_abertura_id,
      false, now(), now()
    )
    RETURNING caixa_movimento_id INTO v_new_cm_id;

    INSERT INTO public.caixa_movimento_item (
      empresa_id, caixa_movimento_id,
      qt_parcela, vl_parcela, vl_recebido,
      meio_pagamento_id, excluido, dt_cadastro, dt_alteracao
    ) VALUES (
      _empresa_id, v_new_cm_id,
      1, -v_total_devolucao, -v_total_devolucao,
      1, false, now(), now()
    );

    UPDATE public.caixa_abertura
    SET vl_fechamento = GREATEST(0, COALESCE(vl_fechamento, 0) - v_total_devolucao)
    WHERE caixa_abertura_id = _caixa_abertura_id;

  ELSIF v_meio_dinheiro AND _opcao_dinheiro = 'CREDITO' THEN
    -- Gera CRÉDITO PARA O CLIENTE no novo módulo de conta corrente de créditos
    IF v_cadastro_id IS NOT NULL THEN
      v_cred_res := public.fu_registrar_movimento_credito(
        _empresa_id           := _empresa_id,
        _cadastro_id          := v_cadastro_id,
        _tp_parceiro          := 'CLIENTE',
        _tp_movimento         := 'C',
        _vl_movimento         := v_total_devolucao,
        _origem_movimento     := 'ESTORNO_PEDIDO_SEM_NFE',
        _historico            := 'CRÉDITO DO CLIENTE GERADO POR ESTORNO SEM NF-E DO PEDIDO N° ' || COALESCE(v_mov.nr_movimento::text, _movimento_id::text),
        _usuario_id           := _usuario_id,
        _movimento_id         := _movimento_id
      );

      IF v_cred_res->>'error' IS NOT NULL THEN
        RETURN v_cred_res;
      END IF;
    END IF;
  END IF;

  -- 6. Registro de Auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES (
    'movimento', 
    _movimento_id::text, 
    'ESTORNO_PEDIDO_SEM_NFE', 
    jsonb_build_object('st_pedido', v_mov.st_pedido), 
    jsonb_build_object(
      'opcao_dinheiro', _opcao_dinheiro, 
      'vl_total_devolucao', v_total_devolucao,
      'meio_dinheiro', v_meio_dinheiro
    ), 
    _usuario_id
  );

  RETURN jsonb_build_object(
    'success', true, 
    'vl_devolucao', v_total_devolucao,
    'opcao_dinheiro', _opcao_dinheiro
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;
