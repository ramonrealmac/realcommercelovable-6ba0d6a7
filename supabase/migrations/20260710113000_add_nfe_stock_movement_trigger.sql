-- Migration: 20260710113000_add_nfe_stock_movement_trigger.sql
-- Description: Creates a trigger on fiscal_nfe_cabecalho to automatically debit stock on outgoing NF-e authorization and reverse it on cancellation.

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
BEGIN
  -- Only process outgoing NF-e (tp_nf = 1)
  IF (NEW.tp_nf = 1) THEN
    -- 1. TRANSITION TO AUTHORIZED ('E')
    IF (
      (TG_OP = 'INSERT' AND NEW.st_nf = 'E') OR
      (TG_OP = 'UPDATE' AND NEW.st_nf = 'E' AND COALESCE(OLD.st_nf, '') <> 'E')
    ) THEN
      -- Check if already debited by cashier
      IF (NEW.movimento_id IS NOT NULL) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.caixa_movimento 
          WHERE movimento_id = NEW.movimento_id 
            AND excluido = false
        ) INTO v_ja_debited;
      END IF;

      -- If not debited by cashier, generate estoque_log for each item
      IF NOT v_ja_debited THEN
        FOR v_item IN 
          SELECT * FROM public.fiscal_nfe_item 
          WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
            AND excluido = false
        LOOP
          v_deposito_id := NEW.deposito_id;
          IF (v_deposito_id IS NULL) THEN
            SELECT deposito_id INTO v_deposito_id FROM public.deposito 
            WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
          END IF;

          IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
            INSERT INTO public.estoque_log (
              empresa_id, produto_id, deposito_id,
              qt_movimento, operacao, origem,
              nr_doc, usuario, dt_hs_log
            ) VALUES (
              NEW.empresa_id, v_item.produto_id, v_deposito_id,
              -COALESCE(v_item.qt_entrada, 0),
              'VENDA', 'NF-E',
              COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
              'SISTEMA', now()
            );
          END IF;
        END LOOP;
      END IF;

    -- 2. TRANSITION TO CANCELLED ('C')
    ELSIF (TG_OP = 'UPDATE' AND NEW.st_nf = 'C' AND COALESCE(OLD.st_nf, '') = 'E') THEN
      -- Check if it was managed by cashier
      IF (NEW.movimento_id IS NOT NULL) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.caixa_movimento 
          WHERE movimento_id = NEW.movimento_id 
            AND excluido = false
        ) INTO v_ja_debited;
      END IF;

      -- If not managed by cashier, reverse the debit (add back the stock)
      IF NOT v_ja_debited THEN
        FOR v_item IN 
          SELECT * FROM public.fiscal_nfe_item 
          WHERE nfe_cabecalho_id = NEW.nfe_cabecalho_id
            AND excluido = false
        LOOP
          v_deposito_id := NEW.deposito_id;
          IF (v_deposito_id IS NULL) THEN
            SELECT deposito_id INTO v_deposito_id FROM public.deposito 
            WHERE empresa_id = NEW.empresa_id AND excluido = false LIMIT 1;
          END IF;

          IF (v_item.produto_id IS NOT NULL AND v_deposito_id IS NOT NULL) THEN
            INSERT INTO public.estoque_log (
              empresa_id, produto_id, deposito_id,
              qt_movimento, operacao, origem,
              nr_doc, usuario, dt_hs_log
            ) VALUES (
              NEW.empresa_id, v_item.produto_id, v_deposito_id,
              COALESCE(v_item.qt_entrada, 0), -- positive to add back stock
              'ESTORNO_VENDA', 'NF-E',
              COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
              'SISTEMA', now()
            );
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nfe_cabecalho_estoque ON public.fiscal_nfe_cabecalho;

CREATE TRIGGER tr_nfe_cabecalho_estoque
AFTER INSERT OR UPDATE ON public.fiscal_nfe_cabecalho
FOR EACH ROW
EXECUTE FUNCTION public.fn_processa_nfe_estoque();
