-- Migration: 20260813141500_fix_estoque_trigger_null_produto.sql
-- Description: Adiciona verificação de NULL no produto_id dentro da fn_tr_movimento_item_estoque_adjust para ignorar atualizações de estoque em lançamentos financeiros/movimentações de caixa (Suprimento/Sangria/Taxas) que não possuem produto de estoque vinculado.

CREATE OR REPLACE FUNCTION public.fn_tr_movimento_item_estoque_adjust()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $_$
DECLARE
  v_mov RECORD;
  v_deposito_id bigint;
BEGIN
  -- Se produto_id não for informado, este item não é um produto de estoque (ex: Suprimento, Sangria, Fretes, Taxas)
  IF (TG_OP = 'DELETE' AND OLD.produto_id IS NULL) OR (TG_OP <> 'DELETE' AND NEW.produto_id IS NULL) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Identifica os detalhes do movimento pai
  IF TG_OP = 'DELETE' THEN
    SELECT st_pedido, empresa_id, deposito_id, excluido INTO v_mov FROM public.movimento WHERE movimento_id = OLD.movimento_id;
  ELSE
    SELECT st_pedido, empresa_id, deposito_id, excluido INTO v_mov FROM public.movimento WHERE movimento_id = NEW.movimento_id;
  END IF;

  -- Se movimento não existe ou está excluído, não faz nada
  IF v_mov IS NULL OR COALESCE(v_mov.excluido, false) = true THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- 1. Inserção de Novo Item
  IF TG_OP = 'INSERT' THEN
    IF NOT COALESCE(NEW.excluido, false) THEN
      v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
      
      -- Garante registro de estoque
      IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
      END IF;

      -- Adiciona à reserva se o status for F, V ou se for R e marcado para entrega ('S')
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = estoque_reservado + NEW.qt_movimento
        WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
    END IF;

  -- 2. Remoção de Item (Física)
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT COALESCE(OLD.excluido, false) THEN
      v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);

      -- Remove da reserva se o status exigia reserva
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
        WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
    END IF;

  -- 3. Atualização de Item (inclui soft-delete excluido=true)
  ELSIF TG_OP = 'UPDATE' THEN
    -- Caso 3.1: Soft-delete (excluido mudou de false para true)
    IF COALESCE(OLD.excluido, false) = false AND COALESCE(NEW.excluido, false) = true THEN
      v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);
      
      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
        WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
      
    -- Caso 3.2: Restauração de soft-delete (excluido mudou de true para false)
    ELSIF COALESCE(OLD.excluido, false) = true AND COALESCE(NEW.excluido, false) = false THEN
      v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);

      IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
        INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
        VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
      END IF;

      IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
        UPDATE public.estoque 
        SET estoque_reservado = estoque_reservado + NEW.qt_movimento
        WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
      END IF;
      
    -- Caso 3.3: Atualização padrão de campos de um item ativo
    ELSIF COALESCE(NEW.excluido, false) = false THEN
      -- Se houve alteração de produto ou depósito
      IF OLD.produto_id <> NEW.produto_id OR COALESCE(OLD.deposito_id, 0) <> COALESCE(NEW.deposito_id, 0) THEN
        -- Remove reserva do produto/depósito antigo
        v_deposito_id := COALESCE(OLD.deposito_id, v_mov.deposito_id, 1);
        IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S') THEN
          UPDATE public.estoque 
          SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
          WHERE produto_id = OLD.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END IF;

        -- Adiciona reserva ao produto/depósito novo
        v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
        IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
          INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
        END IF;

        IF v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S') THEN
          UPDATE public.estoque 
          SET estoque_reservado = estoque_reservado + NEW.qt_movimento
          WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
        END IF;

      -- Se alterou apenas a quantidade ou o flag de entrega do mesmo produto
      ELSE
        v_deposito_id := COALESCE(NEW.deposito_id, v_mov.deposito_id, 1);
        IF NOT EXISTS (SELECT 1 FROM public.estoque WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id) THEN
          INSERT INTO public.estoque (produto_id, empresa_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.produto_id, v_mov.empresa_id, v_deposito_id, 0, 0);
        END IF;

        -- Determina se o estado antigo e novo exigiam reserva
        DECLARE
          v_old_reserved boolean := v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(OLD.entrega, 'N')) = 'S');
          v_new_reserved boolean := v_mov.st_pedido IN ('F', 'V') OR (v_mov.st_pedido = 'R' AND UPPER(COALESCE(NEW.entrega, 'N')) = 'S');
        BEGIN
          IF v_old_reserved AND v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado + (NEW.qt_movimento - OLD.qt_movimento))
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          ELSIF v_old_reserved AND NOT v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = GREATEST(0, estoque_reservado - OLD.qt_movimento)
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          ELSIF NOT v_old_reserved AND v_new_reserved THEN
            UPDATE public.estoque 
            SET estoque_reservado = estoque_reservado + NEW.qt_movimento
            WHERE produto_id = NEW.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = v_deposito_id;
          END IF;
        END;
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$_$;
