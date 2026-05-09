-- Migration: 20260509144400_movimento_totalizers_triggers.sql
-- Implementa funções e triggers para automatizar cálculos da tabela movimento e movimento_item

-- 1. Função BEFORE INSERT/UPDATE no item para cálculo de totais da linha
CREATE OR REPLACE FUNCTION public.fn_movimento_item_calc_before()
RETURNS TRIGGER AS $$
BEGIN
    -- Calcula valor do produto (qtde * valor unitário)
    NEW.vl_produto = COALESCE(NEW.qt_movimento, 0) * COALESCE(NEW.vl_und_produto, 0);
    
    -- Calcula o valor total do item conforme fórmula solicitada
    -- vl_movimento = vl_produto + vl_frete + vl_seguro + vl_outro + vl_despesa + vl_icmsst - vl_desc_rs
    NEW.vl_movimento = COALESCE(NEW.vl_produto, 0) 
                     + COALESCE(NEW.vl_frete, 0) 
                     + COALESCE(NEW.vl_seguro, 0) 
                     + COALESCE(NEW.vl_outro, 0) 
                     + COALESCE(NEW.vl_despesa, 0) 
                     + COALESCE(NEW.vl_icmsst, 0) 
                     - COALESCE(NEW.vl_desc_rs, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criação ou substituição da trigger BEFORE em movimento_item
DROP TRIGGER IF EXISTS tg_movimento_item_before ON public.movimento_item;
CREATE TRIGGER tg_movimento_item_before
    BEFORE INSERT OR UPDATE ON public.movimento_item
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_movimento_item_calc_before();

-- 2. Função para totalizar movimento baseado nos itens e calcular rateio de descontos
CREATE OR REPLACE FUNCTION public.fn_movimento_totalize()
RETURNS TRIGGER AS $$
DECLARE
    v_movimento_id BIGINT;
    v_tp_desconto VARCHAR;
    v_mov_vl_desconto NUMERIC(12,2) := 0;
    v_mov_vl_bc_desc NUMERIC(12,2) := 0;
    
    -- Totais
    v_vl_produto NUMERIC(12,2) := 0;
    v_vl_movimento NUMERIC(12,2) := 0;
    v_vl_despesa NUMERIC(12,2) := 0;
    v_vl_seguro NUMERIC(12,2) := 0;
    v_vl_frete NUMERIC(12,2) := 0;
    v_vl_outro NUMERIC(12,2) := 0;
    v_vl_desc_rs NUMERIC(12,2) := 0;
    v_vl_comissao NUMERIC(12,2) := 0;
    
    v_vl_bc_icms NUMERIC(12,2) := 0;
    v_vl_icms NUMERIC(12,2) := 0;
    v_bc_icmsst NUMERIC(12,2) := 0;
    v_vl_icmsst NUMERIC(12,2) := 0;
    v_vl_bc_pis NUMERIC(12,2) := 0;
    v_vl_pis NUMERIC(12,2) := 0;
    v_vl_bc_cofins NUMERIC(12,2) := 0;
    v_vl_cofins NUMERIC(12,2) := 0;
    v_vl_bc_ipi NUMERIC(12,2) := 0;
    v_vl_ipi NUMERIC(12,2) := 0;
    v_vl_bc_iss NUMERIC(12,2) := 0;
    v_vl_iss NUMERIC(12,2) := 0;

    -- Variáveis para rateio (tp_desconto = 'P')
    v_item RECORD;
    v_desconto_aplicado NUMERIC(12,2) := 0;
    v_desc_item NUMERIC(12,2) := 0;
    v_item_count INT := 0;
    v_processed INT := 0;
BEGIN
    -- Define the ID of the movement to process
    IF TG_OP = 'DELETE' THEN
        v_movimento_id := OLD.movimento_id;
    ELSE
        IF TG_TABLE_NAME = 'movimento' THEN
            v_movimento_id := NEW.movimento_id;
        ELSE
            v_movimento_id := NEW.movimento_id;
        END IF;
    END IF;

    -- Prevent recursive trigger loops on movimento and movimento_item
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    -- Lê o tipo de desconto atual do movimento
    SELECT tp_desconto, COALESCE(vl_desconto, 0)
    INTO v_tp_desconto, v_mov_vl_desconto
    FROM public.movimento 
    WHERE movimento_id = v_movimento_id;

    -- 2.1 Calcula a base de cálculo de desconto (somente itens SEM st_promo = 'S')
    SELECT COALESCE(SUM(mi.vl_produto), 0)
    INTO v_mov_vl_bc_desc
    FROM public.movimento_item mi
    LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
    WHERE mi.movimento_id = v_movimento_id 
      AND mi.excluido = false
      AND COALESCE(p.st_promo, 'N') <> 'S';

    -- 2.2 Lógica de Rateio (tp_desconto = 'P')
    IF v_tp_desconto = 'P' THEN
        IF v_mov_vl_bc_desc > 0 AND v_mov_vl_desconto > 0 THEN
            v_desconto_aplicado := 0;
            v_processed := 0;
            
            -- Conta quantos itens elegíveis existem
            SELECT COUNT(*) INTO v_item_count
            FROM public.movimento_item mi
            LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
            WHERE mi.movimento_id = v_movimento_id AND mi.excluido = false AND COALESCE(p.st_promo, 'N') <> 'S';

            -- Loop para ratear (do menor vl_produto para o maior)
            FOR v_item IN 
                SELECT mi.movimento_item_id, mi.vl_produto
                FROM public.movimento_item mi
                LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
                WHERE mi.movimento_id = v_movimento_id AND mi.excluido = false AND COALESCE(p.st_promo, 'N') <> 'S'
                ORDER BY mi.vl_produto ASC
            LOOP
                v_processed := v_processed + 1;
                
                -- Se for o último item elegível, atribui o restante para bater o valor exato
                IF v_processed = v_item_count THEN
                    v_desc_item := v_mov_vl_desconto - v_desconto_aplicado;
                ELSE
                    -- Calcula o desconto proporcional, arredondado para 2 casas
                    v_desc_item := ROUND((v_item.vl_produto / v_mov_vl_bc_desc) * v_mov_vl_desconto, 2);
                END IF;
                
                v_desconto_aplicado := v_desconto_aplicado + v_desc_item;

                -- Atualiza o item elegível com o desconto rateado
                UPDATE public.movimento_item 
                SET vl_desconto = v_desc_item,
                    pc_desconto = CASE WHEN COALESCE(vl_produto, 0) > 0 THEN ROUND((v_desc_item / vl_produto) * 100, 2) ELSE 0 END,
                    vl_desc_rs = v_desc_item
                WHERE movimento_item_id = v_item.movimento_item_id;
            END LOOP;
        ELSE
            -- Se não tem base ou valor, zera tudo
            UPDATE public.movimento_item 
            SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
            WHERE movimento_id = v_movimento_id AND excluido = false;
        END IF;

        -- Zera o desconto dos itens NÃO elegíveis (em promoção)
        UPDATE public.movimento_item mi
        SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
        FROM public.produto p
        WHERE mi.produto_id = p.produto_id
          AND mi.movimento_id = v_movimento_id 
          AND mi.excluido = false 
          AND COALESCE(p.st_promo, 'N') = 'S';

    ELSIF v_tp_desconto = 'N' THEN
        -- tp_desconto = 'N' -> Zera todos os descontos dos itens
        UPDATE public.movimento_item 
        SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
        WHERE movimento_id = v_movimento_id AND excluido = false AND (vl_desconto > 0 OR pc_desconto > 0);
    END IF;

    -- 2.3 Somatório total do movimento_item para atualizar o cabeçalho (movimento)
    SELECT 
        COALESCE(SUM(vl_produto), 0),
        COALESCE(SUM(vl_movimento), 0),
        COALESCE(SUM(vl_despesa), 0),
        COALESCE(SUM(vl_seguro), 0),
        COALESCE(SUM(vl_frete), 0),
        COALESCE(SUM(vl_outro), 0),
        COALESCE(SUM(vl_desc_rs), 0),
        COALESCE(SUM(vl_comissao), 0),
        COALESCE(SUM(vl_bc_icms), 0),
        COALESCE(SUM(vl_icms), 0),
        COALESCE(SUM(bc_icmsst), 0),
        COALESCE(SUM(vl_icmsst), 0),
        COALESCE(SUM(vl_bc_pis), 0),
        COALESCE(SUM(vl_pis), 0),
        COALESCE(SUM(vl_bc_cofins), 0),
        COALESCE(SUM(vl_cofins), 0),
        COALESCE(SUM(vl_bc_ipi), 0),
        COALESCE(SUM(vl_ipi), 0),
        COALESCE(SUM(vl_bc_iss), 0),
        COALESCE(SUM(vl_iss), 0)
    INTO 
        v_vl_produto, v_vl_movimento, v_vl_despesa, v_vl_seguro, v_vl_frete, v_vl_outro, 
        v_vl_desc_rs, v_vl_comissao, v_vl_bc_icms, v_vl_icms, v_bc_icmsst, v_vl_icmsst, 
        v_vl_bc_pis, v_vl_pis, v_vl_bc_cofins, v_vl_cofins, v_vl_bc_ipi, v_vl_ipi, 
        v_vl_bc_iss, v_vl_iss
    FROM public.movimento_item
    WHERE movimento_id = v_movimento_id AND excluido = false;

    -- Calcula o desconto de Item caso tp_desconto seja 'I'
    IF v_tp_desconto = 'I' THEN
        SELECT COALESCE(SUM(vl_desconto), 0) INTO v_mov_vl_desconto
        FROM public.movimento_item
        WHERE movimento_id = v_movimento_id AND excluido = false;
    ELSIF v_tp_desconto = 'N' THEN
        v_mov_vl_desconto := 0;
    END IF;

    -- 2.4 Atualiza o cabeçalho (movimento) com os totais
    UPDATE public.movimento
    SET 
        vl_bc_desconto = v_mov_vl_bc_desc,
        vl_desconto = v_mov_vl_desconto,
        pc_desconto = CASE 
                        WHEN v_mov_vl_bc_desc > 0 AND v_tp_desconto IN ('I', 'P') THEN ROUND((v_mov_vl_desconto / v_mov_vl_bc_desc) * 100, 2)
                        ELSE 0 
                      END,
        vl_produto = v_vl_produto,
        vl_movimento = v_vl_movimento,
        vl_total_nota = v_vl_movimento, -- Geralmente o total da nota espelha o vl_movimento
        vl_despesa = v_vl_despesa,
        vl_seguro = v_vl_seguro,
        vl_frete = v_vl_frete,
        vl_outro = v_vl_outro,
        vl_desc_rs = v_vl_desc_rs,
        vl_comissao = v_vl_comissao,
        vl_bc_icms = v_vl_bc_icms,
        vl_icms = v_vl_icms,
        bc_icmsst = v_bc_icmsst,
        vl_icmsst = v_vl_icmsst,
        vl_bc_pis = v_vl_bc_pis,
        vl_pis = v_vl_pis,
        vl_bc_cofins = v_vl_bc_cofins,
        vl_cofins = v_vl_cofins,
        vl_bc_ipi = v_vl_bc_ipi,
        vl_ipi = v_vl_ipi,
        vl_bc_iss = v_vl_bc_iss,
        vl_iss = v_vl_iss
    WHERE movimento_id = v_movimento_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Criação da trigger AFTER em movimento_item
DROP TRIGGER IF EXISTS tg_movimento_item_after ON public.movimento_item;
CREATE TRIGGER tg_movimento_item_after
    AFTER INSERT OR UPDATE OR DELETE ON public.movimento_item
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_movimento_totalize();

-- Criação da trigger AFTER em movimento (para recalcular quando tp_desconto ou vl_desconto forem alterados no cabeçalho)
DROP TRIGGER IF EXISTS tg_movimento_after ON public.movimento;
CREATE TRIGGER tg_movimento_after
    AFTER UPDATE OF tp_desconto, vl_desconto, pc_desconto ON public.movimento
    FOR EACH ROW
    WHEN (NEW.tp_desconto IS DISTINCT FROM OLD.tp_desconto OR 
          NEW.vl_desconto IS DISTINCT FROM OLD.vl_desconto OR 
          NEW.pc_desconto IS DISTINCT FROM OLD.pc_desconto)
    EXECUTE FUNCTION public.fn_movimento_totalize();
