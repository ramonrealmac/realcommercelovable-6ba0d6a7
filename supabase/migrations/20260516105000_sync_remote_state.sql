-- Adiciona colunas de IA na tabela empresa se não existirem
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS ia_instrucoes text;
ALTER TABLE public.empresa ADD COLUMN IF NOT EXISTS ia_modelo text DEFAULT 'gpt-4o-mini';

-- Atualiza a função fu_mudar_status_pedido_pdv com suporte ao status 'R' e nomes de colunas corretos
CREATE OR REPLACE FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE 
    v_mov RECORD; 
    v_item RECORD;
BEGIN
    SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
    IF NOT FOUND THEN 
        RETURN jsonb_build_object('error', 'Movimento não encontrado'); 
    END IF;

    -- REGRA 1: Enviar para o Caixa (O, R -> F)
    IF v_mov.st_pedido IN ('O', 'R') AND _novo_status = 'F' THEN
        IF v_mov.st_pedido = 'O' THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END LOOP;
        END IF;
        UPDATE movimento SET st_pedido = 'F', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 2: Retirar do Caixa (F -> O)
    ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 3: Reservar (O -> V)
    ELSIF v_mov.st_pedido = 'O' AND _novo_status = 'V' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento SET st_pedido = 'V', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 4: Tirar da Reserva (V -> O)
    ELSIF v_mov.st_pedido = 'V' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 5: FINALIZAR VENDA / RECEBER (F, O, V -> R)
    ELSIF _novo_status = 'R' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            -- Se estava no caixa (F) ou reservado (V), remove da reserva E do estoque físico
            IF v_mov.st_pedido IN ('F', 'V') THEN
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento,
                    estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            ELSE
                -- Se era venda direta (O), remove apenas do estoque físico
                UPDATE estoque 
                SET estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END IF;
        END LOOP;
        UPDATE movimento SET st_pedido = 'R', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 6: Cancelar (O, R, V, F -> C)
    ELSIF v_mov.st_pedido IN ('O', 'R', 'V', 'F') AND _novo_status = 'C' THEN
        IF v_mov.st_pedido IN ('R', 'V', 'F') THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END LOOP;
        END IF;
        UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now(), dt_alteracao = now() WHERE movimento_id = _movimento_id;

    ELSE
        RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
    END IF;

    -- Auditoria
    INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE_PDV', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);

    RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$function$;

-- Atualiza a função fn_prevalidar_nfe (versão completa do banco)
CREATE OR REPLACE FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_cab       RECORD;
    v_emp       RECORD;
    v_item      RECORD;
    v_pag_cnt   integer;
    v_ref_cnt   integer;
    v_item_cnt  integer;
    v_erros     jsonb := '[]'::jsonb;
    v_simples   boolean;
    v_pre       text;
BEGIN
    -- Cabeçalho
    SELECT * INTO v_cab
    FROM public.fiscal_nfe_cabecalho
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false, 'erros',
            jsonb_build_array(jsonb_build_object(
                'campo','Cabeçalho','mensagem','Registro fiscal não localizado.')));
    END IF;

    -- Empresa / regime
    SELECT * INTO v_emp FROM public.empresa WHERE empresa_id = p_empresa_id;

    v_simples := UPPER(COALESCE(v_emp.regime_trib::text,'')) IN
                 ('1','S','SN','SIMPLES','SIMPLES NACIONAL');

    -- ── Cabeçalho ────────────────────────────────────────────────
    IF COALESCE(v_cab.nat_op,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nat. Operação',
            'mensagem','Natureza da Operação (nat_op) não informada.'));
    ELSIF length(v_cab.nat_op) > 60 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nat. Operação',
            'mensagem', format('Natureza da Operação excede 60 caracteres (%s).', length(v_cab.nat_op))));
    END IF;

    IF COALESCE(v_cab.nr_nota,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nº Nota','mensagem','Número da nota não informado.'));
    END IF;

    IF COALESCE(v_cab.serie,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Série','mensagem','Série da nota não informada.'));
    END IF;

    IF v_cab.dt_emissao IS NULL THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Data Emissão','mensagem','Data de emissão não informada.'));
    END IF;

    IF COALESCE(v_cab.vl_total_nf, 0) <= 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Vl. Total','mensagem','Valor total da NF-e é zero ou negativo.'));
    END IF;

    -- ── Devolução exige pelo menos 1 referência ─────────────────
    IF v_cab.fin_nfe = 4 OR v_cab.tp_nf = 0 THEN
        SELECT COUNT(*) INTO v_ref_cnt
        FROM public.fiscal_nfe_referenciada
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

        IF v_ref_cnt = 0 THEN
            v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                'campo','Referência',
                'mensagem','Documento referenciado obrigatório para devoluções/entradas (fin_nfe=4).'));
        END IF;
    END IF;

    -- ── Pagamentos ───────────────────────────────────────────────
    SELECT COUNT(*) INTO v_pag_cnt
    FROM public.fiscal_nfe_pagamento
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF v_pag_cnt = 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Pagamento','mensagem','Nenhum pagamento informado na NF-e.'));
    ELSE
        FOR v_item IN
            SELECT * FROM public.fiscal_nfe_pagamento
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
        LOOP
            IF COALESCE(v_item.t_pag,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → t_pag', v_item.nfe_pagamento_id),
                    'mensagem','Tipo de pagamento (t_pag) não informado.'));
            ELSIF length(v_item.t_pag) <> 2 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → t_pag', v_item.nfe_pagamento_id),
                    'mensagem', format('t_pag deve ter 2 dígitos, encontrado "%s".', v_item.t_pag)));
            END IF;

            IF COALESCE(v_item.v_pag, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → v_pag', v_item.nfe_pagamento_id),
                    'mensagem','Valor do pagamento é zero ou negativo.'));
            END IF;
        END LOOP;
    END IF;

    -- ── Itens ────────────────────────────────────────────────────
    SELECT COUNT(*) INTO v_item_cnt
    FROM public.fiscal_nfe_item
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF v_item_cnt = 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Itens','mensagem','Nenhum item inserido na NF-e.'));
    ELSE
        FOR v_item IN
            SELECT * FROM public.fiscal_nfe_item
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
            ORDER BY nr_item
        LOOP
            v_pre := format('Item %s (%s)', v_item.nr_item, COALESCE(v_item.nm_produto,'?'));

            -- Descrição
            IF COALESCE(v_item.nm_produto,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Descrição',
                    'mensagem','Descrição do produto não informada.'));
            ELSIF length(v_item.nm_produto) > 120 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Descrição',
                    'mensagem', format('Descrição excede 120 caracteres (%s).', length(v_item.nm_produto))));
            END IF;

            -- Unidade
            IF COALESCE(v_item.unidade,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Unidade',
                    'mensagem','Unidade de medida não informada.'));
            END IF;

            -- Quantidade / Valor
            IF COALESCE(v_item.qt_entrada, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Quantidade',
                    'mensagem','Quantidade zero ou negativa.'));
            END IF;

            IF COALESCE(v_item.vl_total, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Valor Total',
                    'mensagem','Valor total do item é zero ou negativo.'));
            END IF;

            -- NCM: exatamente 8 dígitos numéricos
            IF COALESCE(v_item.ncm,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem','NCM não informado.'));
            ELSIF v_item.ncm !~ '^\d{8}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem', format('NCM deve ter 8 dígitos numéricos. Encontrado: "%s".', v_item.ncm)));
            END IF;

            -- CFOP: 4 dígitos numéricos
            IF COALESCE(v_item.cfop,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CFOP',
                    'mensagem','CFOP não informado.'));
            ELSIF v_item.cfop !~ '^\d{4}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CFOP',
                    'mensagem', format('CFOP deve ter 4 dígitos. Encontrado: "%s".', v_item.cfop)));
            END IF;

            -- GTIN: vazio | SEM_GTIN | 8/12/13/14 dígitos
            IF COALESCE(v_item.gtin,'') NOT IN ('','SEM GTIN','SEM_GTIN') THEN
                IF v_item.gtin !~ '^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → GTIN/EAN',
                        'mensagem', format('GTIN inválido: "%s". Use SEM_GTIN ou EAN 8/12/13/14 dígitos.', v_item.gtin)));
                END IF;
            END IF;

            -- Origem: 0-8
            IF v_item.origem IS NOT NULL AND (v_item.origem < 0 OR v_item.origem > 8) THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Origem',
                    'mensagem', format('Origem ICMS deve ser 0-8. Encontrado: %s.', v_item.origem)));
            END IF;

            -- CEST: 7 dígitos se informado
            IF COALESCE(v_item.cest,'') <> '' AND v_item.cest !~ '^\d{7}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CEST',
                    'mensagem', format('CEST deve ter 7 dígitos. Encontrado: "%s".', v_item.cest)));
            END IF;

            -- ── Tributação ICMS ──────────────────────────────────
            IF v_simples THEN
                -- Simples Nacional → CSOSN obrigatório (3 dígitos)
                IF COALESCE(v_item.csosn,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem','CSOSN obrigatório para empresas do Simples Nacional.'));
                ELSIF v_item.csosn !~ '^\d{3}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem', format('CSOSN deve ter 3 dígitos. Encontrado: "%s".', v_item.csosn)));
                ELSIF v_item.csosn NOT IN ('101','102','103','201','202','203','300','400','500','900') THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem', format('CSOSN "%s" inválido (aceitos: 101,102,103,201,202,203,300,400,500,900).', v_item.csosn)));
                END IF;
            ELSE
                -- Regime Normal → CST ICMS obrigatório (2-3 dígitos)
                IF COALESCE(v_item.cst_icms,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST ICMS',
                        'mensagem','CST ICMS obrigatório para regime normal.'));
                ELSIF v_item.cst_icms !~ '^\d{2,3}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST ICMS',
                        'mensagem', format('CST ICMS deve ter 2 ou 3 dígitos. Encontrado: "%s".', v_item.cst_icms)));
                END IF;

                -- CST PIS (2 dígitos)
                IF COALESCE(v_item.cst_pis,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST PIS',
                        'mensagem','CST PIS obrigatório para regime normal.'));
                ELSIF v_item.cst_pis !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST PIS',
                        'mensagem', format('CST PIS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_pis)));
                END IF;

                -- CST COFINS (2 dígitos)
                IF COALESCE(v_item.cst_cofins,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST COFINS',
                        'mensagem','CST COFINS obrigatório para regime normal.'));
                ELSIF v_item.cst_cofins !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST COFINS',
                        'mensagem', format('CST COFINS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_cofins)));
                END IF;

                -- CST IBS (2 dígitos, se preenchido)
                IF COALESCE(v_item.cst_ibs,'') <> '' AND v_item.cst_ibs !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST IBS',
                        'mensagem', format('CST IBS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_ibs)));
                END IF;

                -- CST CBS (2 dígitos, se preenchido)
                IF COALESCE(v_item.cst_cbs,'') <> '' AND v_item.cst_cbs !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST CBS',
                        'mensagem', format('CST CBS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_cbs)));
                END IF;
            END IF;

        END LOOP; -- itens
    END IF;

    RETURN jsonb_build_object(
        'valido',  jsonb_array_length(v_erros) = 0,
        'erros',   v_erros,
        'regime',  CASE WHEN v_simples THEN 'SIMPLES' ELSE 'NORMAL' END,
        'total_erros', jsonb_array_length(v_erros)
    );
END;
$function$;
