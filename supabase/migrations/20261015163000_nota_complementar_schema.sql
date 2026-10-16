-- Migration: Suporte a Nota Fiscal Complementar (finNFe = 2)
-- File: supabase/migrations/20261015163000_nota_complementar_schema.sql

-- 1. Colunas adicionais em public.fiscal_nfe_cabecalho
ALTER TABLE public.fiscal_nfe_cabecalho
ADD COLUMN IF NOT EXISTS tp_complemento smallint,
ADD COLUMN IF NOT EXISTS nfe_origem_id bigint,
ADD COLUMN IF NOT EXISTS chave_nfe_origem varchar(44),
ADD COLUMN IF NOT EXISTS gera_financeiro_comp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS movimenta_estoque_comp boolean DEFAULT false;

-- Índices para consultas ágeis
CREATE INDEX IF NOT EXISTS ix_nfe_cabecalho_fin_nfe ON public.fiscal_nfe_cabecalho(fin_nfe);
CREATE INDEX IF NOT EXISTS ix_nfe_cabecalho_nfe_origem ON public.fiscal_nfe_cabecalho(nfe_origem_id);
CREATE INDEX IF NOT EXISTS ix_nfe_cabecalho_tp_comp ON public.fiscal_nfe_cabecalho(tp_complemento);

-- 2. Colunas adicionais em public.fiscal_nfe_item para histórico de origem
ALTER TABLE public.fiscal_nfe_item
ADD COLUMN IF NOT EXISTS qt_origem numeric(15,4),
ADD COLUMN IF NOT EXISTS vl_unit_origem numeric(15,4);

-- 3. Atualiza trigger de estoque fn_processa_nfe_estoque para tratar notas complementares (fin_nfe = 2)
CREATE OR REPLACE FUNCTION public.fn_processa_nfe_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item RECORD;
  v_ja_debited BOOLEAN := false;
  v_deposito_id bigint;
  v_qt_mov numeric;
  v_op varchar;
  v_op_estorno varchar;
  v_tp_op_desc varchar := NULL;
  v_tp_op_altera varchar := NULL;
  v_origem varchar := 'NF-E';
BEGIN
  -- 1. NOTA FISCAL AUTORIZADA ('A')
  IF (
    (TG_OP = 'INSERT' AND NEW.st_nf = 'A') OR
    (TG_OP = 'UPDATE' AND NEW.st_nf = 'A' AND COALESCE(OLD.st_nf, '') <> 'A')
  ) THEN

    -- TRATAMENTO PARA NOTA COMPLEMENTAR (fin_nfe = 2)
    IF (COALESCE(NEW.fin_nfe, 1) = 2) THEN
      -- Se for complemento exclusivamente de valor (1) ou impostos (2), NÃO movimenta estoque
      IF (COALESCE(NEW.tp_complemento, 1) IN (1, 2) OR COALESCE(NEW.movimenta_estoque_comp, false) = false) THEN
        RETURN NEW;
      END IF;

      -- Se for complemento de quantidade (3) ou valor+quantidade (4) e estiver autorizado a movimentar:
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
          IF NOT EXISTS (
            SELECT 1 FROM public.estoque 
            WHERE empresa_id = NEW.empresa_id AND produto_id = v_item.produto_id AND deposito_id = v_deposito_id
          ) THEN
            INSERT INTO public.estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado)
            VALUES (NEW.empresa_id, v_item.produto_id, v_deposito_id, 0, 0);
          END IF;

          -- Direção da movimentação complementar (Saída = baixa adicional, Entrada = entrada adicional)
          IF (COALESCE(NEW.tp_nf, 1) = 1) THEN
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
            v_op := 'COMPLEMENTO_NF_SAIDA';
          ELSE
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
            v_op := 'COMPLEMENTO_NF_ENTRADA';
          END IF;

          IF (v_qt_mov <> 0) THEN
            INSERT INTO public.estoque_log (
              empresa_id, produto_id, deposito_id,
              qt_movimento, operacao, origem,
              nr_doc, usuario, dt_hs_log
            ) VALUES (
              NEW.empresa_id, v_item.produto_id, v_deposito_id,
              v_qt_mov,
              v_op, 'COMPLEMENTAR',
              COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
              'SISTEMA', now()
            );
          END IF;
        END IF;
      END LOOP;

      RETURN NEW;
    END IF;

    -- TRATAMENTO ESPECIAL PARA DEVOLUÇÃO (fin_nfe = 4 E tp_nf = 0)
    IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
      PERFORM public.fu_gerar_movimento_devolucao_nfe(NEW.nfe_cabecalho_id);

      IF NEW.movimento_id IS NOT NULL THEN
        UPDATE public.movimento
        SET faturado = 'S',
            st_pedido = 'F',
            numero_nfe = COALESCE(NEW.nr_nota, ''),
            serie = COALESCE(NULLIF(regexp_replace(NEW.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            dt_faturamento = now(),
            dt_alteracao = now()
        WHERE movimento_id = NEW.movimento_id;
      END IF;

      SELECT descricao, altera_estoque 
      INTO v_tp_op_desc, v_tp_op_altera
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := 'DEVOLUCAO_NFE';

    -- TRATAMENTO ESPECIAL SE TIVER tp_operacao_id (ex: Outras Notas)
    ELSIF NEW.tp_operacao_id IS NOT NULL THEN
      PERFORM public.fu_sincronizar_movimento_outras_notas(NEW.nfe_cabecalho_id);

      IF NEW.movimento_id IS NOT NULL THEN
        UPDATE public.movimento
        SET faturado = 'S',
            st_pedido = 'F',
            numero_nfe = COALESCE(NEW.nr_nota, ''),
            serie = COALESCE(NULLIF(regexp_replace(NEW.serie, '[^0-9]', '', 'g'), '')::bigint, 1),
            dt_faturamento = now(),
            dt_alteracao = now()
        WHERE movimento_id = NEW.movimento_id;
      END IF;

      SELECT descricao, altera_estoque 
      INTO v_tp_op_desc, v_tp_op_altera
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := 'OUTRAS_NOTAS';
    ELSE
      -- Regra padrão para notas de compra
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

      IF v_ja_debited THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Movimenta itens no estoque para casos padrão
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
        IF NOT EXISTS (
          SELECT 1 FROM public.estoque 
          WHERE empresa_id = NEW.empresa_id AND produto_id = v_item.produto_id AND deposito_id = v_deposito_id
        ) THEN
          INSERT INTO public.estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado)
          VALUES (NEW.empresa_id, v_item.produto_id, v_deposito_id, 0, 0);
        END IF;

        -- Determina a operação e a direção do saldo (+ ou -)
        IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
          v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          v_op := COALESCE(v_tp_op_desc, 'DEVOLUÇÃO DE VENDAS');
        ELSIF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
          v_op := v_tp_op_desc;
          IF (NEW.tp_nf = 1) THEN
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          ELSE
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          END IF;
        ELSIF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
          IF (NEW.tp_nf = 0) THEN
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'DEVOLUCAO_VENDA';
          ELSE
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op := 'DEVOLUCAO_COMPRA';
          END IF;
        ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
          v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
          v_op := 'VENDA';
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
          v_op, v_origem,
          COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
          'SISTEMA', now()
        );
      END IF;
    END LOOP;

  -- 2. NOTA FISCAL CANCELADA ('C')
  ELSIF (TG_OP = 'UPDATE' AND NEW.st_nf = 'C' AND COALESCE(OLD.st_nf, '') = 'A') THEN
    IF (COALESCE(NEW.fin_nfe, 1) = 2) THEN
      IF (COALESCE(NEW.tp_complemento, 1) IN (1, 2) OR COALESCE(NEW.movimenta_estoque_comp, false) = false) THEN
        RETURN NEW;
      END IF;

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
          IF (COALESCE(NEW.tp_nf, 1) = 1) THEN
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
            v_op_estorno := 'ESTORNO_COMPLEMENTO_NF_SAIDA';
          ELSE
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
            v_op_estorno := 'ESTORNO_COMPLEMENTO_NF_ENTRADA';
          END IF;

          IF (v_qt_mov <> 0) THEN
            INSERT INTO public.estoque_log (
              empresa_id, produto_id, deposito_id,
              qt_movimento, operacao, origem,
              nr_doc, usuario, dt_hs_log
            ) VALUES (
              NEW.empresa_id, v_item.produto_id, v_deposito_id,
              v_qt_mov,
              v_op_estorno, 'COMPLEMENTAR',
              COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
              'SISTEMA', now()
            );
          END IF;
        END IF;
      END LOOP;

      RETURN NEW;
    END IF;

    IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) OR NEW.tp_operacao_id IS NOT NULL THEN
      IF NEW.movimento_id IS NOT NULL THEN
        UPDATE public.movimento
        SET faturado = 'N',
            st_pedido = 'C',
            dt_cancelamento = now(),
            motivo_cancelamento = COALESCE(NEW.motivo_cancelamento, 'Cancelamento da NF-e'),
            dt_alteracao = now()
        WHERE movimento_id = NEW.movimento_id;
      END IF;

      SELECT descricao, altera_estoque 
      INTO v_tp_op_desc, v_tp_op_altera
      FROM public.tp_operacao 
      WHERE tp_operacao_id = NEW.tp_operacao_id;

      IF FOUND AND v_tp_op_altera = 'N' THEN
        RETURN NEW;
      END IF;

      v_origem := CASE WHEN COALESCE(NEW.fin_nfe, 1) = 4 THEN 'DEVOLUCAO_NFE' ELSE 'OUTRAS_NOTAS' END;
    ELSE
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

      IF v_ja_debited THEN
        RETURN NEW;
      END IF;
    END IF;

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
        IF (COALESCE(NEW.fin_nfe, 1) = 4 AND COALESCE(NEW.tp_nf, 1) = 0) THEN
          v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          v_op_estorno := 'ESTORNO ' || COALESCE(v_tp_op_desc, 'DEVOLUÇÃO DE VENDAS');
        ELSIF NEW.tp_operacao_id IS NOT NULL AND v_tp_op_desc IS NOT NULL THEN
          v_op_estorno := 'ESTORNO ' || v_tp_op_desc;
          IF (NEW.tp_nf = 1) THEN
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          ELSE
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, v_item.qt_tributavel, 0));
          END IF;
        ELSIF (COALESCE(NEW.fin_nfe, 1) = 4) THEN
          IF (NEW.tp_nf = 0) THEN
            v_qt_mov := -ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_DEVOLUCAO_VENDA';
          ELSE
            v_qt_mov := ABS(COALESCE(v_item.qt_entrada, 0));
            v_op_estorno := 'ESTORNO_DEVOLUCAO_COMPRA';
          END IF;
        ELSIF (COALESCE(NEW.tp_nf, 1) = 1) THEN
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
          v_op_estorno, v_origem,
          COALESCE(NEW.nr_nota::varchar, NEW.nfe_cabecalho_id::varchar),
          'SISTEMA', now()
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;
