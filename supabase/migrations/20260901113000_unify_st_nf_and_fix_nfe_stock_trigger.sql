-- Migration: 20260901113000_unify_st_nf_and_fix_nfe_stock_trigger.sql
-- Description: Unifica status da NF-e (st_nf), adiciona status 'L' (Lançada) para entradas, migra dados legados ('1' -> 'A', '2' -> 'C', 'E' de entrada -> 'L'), corrige a trigger fn_processa_nfe_estoque para não gerar saídas indevidas na entrada de compras e limpa os registros espúrios do doc 1302227.

-- 1. Atualiza a constraint de status permitidos em fiscal_nfe_cabecalho
ALTER TABLE public.fiscal_nfe_cabecalho 
  DROP CONSTRAINT IF EXISTS nfe_cabecalho_st_nf_check;

ALTER TABLE public.fiscal_nfe_cabecalho 
  ADD CONSTRAINT nfe_cabecalho_st_nf_check 
  CHECK (st_nf = ANY (ARRAY['A'::text, 'C'::text, 'E'::text, 'D'::text, 'R'::text, 'P'::text, 'L'::text]));

-- 2. Migração de dados legados existentes
-- 2.1 Converte '1' para 'A' (Autorizada)
UPDATE public.fiscal_nfe_cabecalho 
SET st_nf = 'A' 
WHERE st_nf = '1';

-- 2.2 Converte '2' para 'C' (Cancelada)
UPDATE public.fiscal_nfe_cabecalho 
SET st_nf = 'C' 
WHERE st_nf = '2';

-- 2.3 Converte notas de entrada (tp_nf = 0) que estavam como 'E' para 'L' (Lançada)
UPDATE public.fiscal_nfe_cabecalho 
SET st_nf = 'L' 
WHERE tp_nf = 0 AND st_nf = 'E';

-- 3. Atualiza a trigger de movimentação de estoque
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
  -- 1. NOTA FISCAL AUTORIZADA ('A')
  -- Notas de entrada normal (tp_nf = 0, fin_nfe <> 4) são gerenciadas pela rotina de escrituração ('L'),
  -- portanto esta trigger processa apenas:
  --   a) Saídas (tp_nf = 1, vendas normais ou devoluções de compra)
  --   b) Devoluções de Venda de entrada (tp_nf = 0, fin_nfe = 4)
  IF (
    (TG_OP = 'INSERT' AND NEW.st_nf = 'A') OR
    (TG_OP = 'UPDATE' AND NEW.st_nf = 'A' AND COALESCE(OLD.st_nf, '') <> 'A')
  ) THEN
    -- Ignora entradas normais de compras
    IF (COALESCE(NEW.tp_nf, 1) = 0 AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
      RETURN NEW;
    END IF;

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
              -- Devolução de Venda: Entrada/Retorno de mercadoria (+qt)
              v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
              v_op := 'DEVOLUCAO_VENDA';
            ELSE
              -- Devolução de Compra: Saída de mercadoria ao fornecedor (-qt)
              v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
              v_op := 'DEVOLUCAO_COMPRA';
            END IF;
          ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
            -- Venda Normal / Saída: Saída de mercadoria (-qt)
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'VENDA';
          ELSE
            CONTINUE;
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
  ELSIF (TG_OP = 'UPDATE' AND NEW.st_nf = 'C' AND COALESCE(OLD.st_nf, '') = 'A') THEN
    -- Ignora entradas normais de compras
    IF (COALESCE(NEW.tp_nf, 1) = 0 AND COALESCE(NEW.fin_nfe, 1) <> 4) THEN
      RETURN NEW;
    END IF;

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
          ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
            -- Cancelamento de Venda Normal: Reverte a saída (+qt)
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_VENDA';
          ELSE
            CONTINUE;
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

-- 4. Limpeza dos lançamentos indevidos de saída da nota 1302227
-- Remove temporariamente o trigger de bloqueio para permitir a limpeza da auditoria
DROP TRIGGER IF EXISTS tr_estoque_log_block_mod ON public.estoque_log;

DELETE FROM public.estoque_log 
WHERE nr_doc = '1302227' 
  AND operacao = 'VENDA' 
  AND origem = 'NF-E' 
  AND usuario = 'SISTEMA';

CREATE TRIGGER tr_estoque_log_block_mod 
BEFORE UPDATE OR DELETE ON public.estoque_log 
FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_log_block_mod();

-- Recalcula o saldo físico de todos os produtos movimentados na nota 1302227
UPDATE public.estoque e
SET estoque_fisico = COALESCE((
  SELECT SUM(el.qt_movimento)
  FROM public.estoque_log el
  WHERE el.produto_id = e.produto_id
    AND el.deposito_id = e.deposito_id
    AND el.empresa_id = e.empresa_id
), 0)
WHERE e.produto_id IN (
  SELECT DISTINCT produto_id 
  FROM public.fiscal_nfe_item 
  WHERE nfe_cabecalho_id = (SELECT nfe_cabecalho_id FROM public.fiscal_nfe_cabecalho WHERE nr_nota = '1302227' LIMIT 1)
    AND produto_id IS NOT NULL
);
