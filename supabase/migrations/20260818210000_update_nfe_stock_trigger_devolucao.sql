-- Migration: 20260818210000_update_nfe_stock_trigger_devolucao.sql
-- Description: Atualiza a trigger fn_processa_nfe_estoque para suportar movimentação de estoque por depósito individual de cada item (fiscal_nfe_item.deposito_id), gerando log em estoque_log e atualizando o saldo físico na tabela estoque para devoluções de compra e venda.

CREATE OR REPLACE FUNCTION public.fn_processa_nfe_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item RECORD;
  v_ja_debited BOOLEAN := false;
  v_deposito_id bigint;
  v_qt_mov numeric;
  v_op varchar;
  v_op_estorno varchar;
BEGIN
  -- 1. NOTA FISCAL AUTORIZADA ('E', '1', ou 'A')
  IF (
    (TG_OP = 'INSERT' AND NEW.st_nf IN ('E', '1', 'A')) OR
    (TG_OP = 'UPDATE' AND NEW.st_nf IN ('E', '1', 'A') AND COALESCE(OLD.st_nf, '') NOT IN ('E', '1', 'A'))
  ) THEN
    -- Verifica se já foi baixado pelo caixa/PDV em caso de venda normal
    IF (NEW.movimento_id IS NOT NULL AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.caixa_movimento 
        WHERE movimento_id = NEW.movimento_id 
          AND excluido = false
      ) INTO v_ja_debited;
    END IF;

    IF NOT v_ja_debited THEN
      FOR v_item IN 
        SELECT * FROM public.fiscal_nfe_item 
        WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
          AND excluido = false
      LOOP
        -- Prioriza o deposito_id do item; se nulo, utiliza o deposito_id do cabeçalho
        v_deposito_id := COALESCE(v_item.deposito_id, NEW.deposito_id);
        IF (v_deposito_id IS NULL) THEN
          SELECT deposito_id INTO v_deposito_id FROM public.deposito 
          WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
        END IF;

        IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
          -- Garante a existência do registro na tabela mestre 'estoque'
          IF NOT EXISTS (
            SELECT 1 FROM public.estoque 
            WHERE empresa_id = NEW.empresa_id AND produto_id = v_item.produto_id AND deposito_id = v_deposito_id
          ) THEN
            INSERT INTO public.estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado)
            VALUES (NEW.empresa_id, v_item.produto_id, v_deposito_id, 0, 0);
          END IF;

          -- Determina a operação e a direção do saldo (+ ou -)
          IF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
            IF (NEW.tp_nf = 0) THEN
              -- Devolução de Venda: Entrada/Retorno de mercadoria ao estoque (+qt)
              v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
              v_op := 'DEVOLUCAO_VENDA';
            ELSE
              -- Devolução de Compra: Saída/Devolução de mercadoria ao fornecedor (-qt)
              v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
              v_op := 'DEVOLUCAO_COMPRA';
            END IF;
          ELSE
            -- Venda Normal: Saída de mercadoria ao cliente (-qt)
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'VENDA';
          END IF;

          -- Inserção no log oficial de estoque
          INSERT INTO public.estoque_log (
            empresa_id, produto_id, deposito_id,
            qt_movimento, operacao, origem,
            nr_doc, usuario, dt_hs_log
          ) VALUES (
            NEW.empresa_id, v_item.produto_id, v_deposito_id,
            v_qt_mov,
            v_op, 'NF-E',
            COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
            'SISTEMA', now()
          );
        END IF;
      END LOOP;
    END IF;

  -- 2. NOTA FISCAL CANCELADA ('C')
  ELSIF (TG_OP = 'UPDATE' AND NEW.st_nf = 'C' AND COALESCE(OLD.st_nf, '') IN ('E', '1', 'A')) THEN
    IF (NEW.movimento_id IS NOT NULL AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
      SELECT EXISTS (
        SELECT 1 FROM public.caixa_movimento 
        WHERE movimento_id = NEW.movimento_id 
          AND excluido = false
      ) INTO v_ja_debited;
    END IF;

    IF NOT v_ja_debited THEN
      FOR v_item IN 
        SELECT * FROM public.fiscal_nfe_item 
        WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
          AND excluido = false
      LOOP
        v_deposito_id := COALESCE(v_item.deposito_id, NEW.deposito_id);
        IF (v_deposito_id IS NULL) THEN
          SELECT deposito_id INTO v_deposito_id FROM public.deposito 
          WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
        END IF;

        IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
          IF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
            IF (NEW.tp_nf = 0) THEN
              -- Cancelamento de Devolução de Venda: Reverte a entrada (-qt)
              v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
              v_op_estorno := 'ESTORNO_DEVOLUCAO_VENDA';
            ELSE
              -- Cancelamento de Devolução de Compra: Reverte a saída (+qt)
              v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
              v_op_estorno := 'ESTORNO_DEVOLUCAO_COMPRA';
            END IF;
          ELSE
            -- Cancelamento de Venda Normal: Reverte a saída (+qt)
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_VENDA';
          END IF;

          INSERT INTO public.estoque_log (
            empresa_id, produto_id, deposito_id,
            qt_movimento, operacao, origem,
            nr_doc, usuario, dt_hs_log
          ) VALUES (
            NEW.empresa_id, v_item.produto_id, v_deposito_id,
            v_qt_mov,
            v_op_estorno, 'NF-E',
            COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
            'SISTEMA', now()
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
