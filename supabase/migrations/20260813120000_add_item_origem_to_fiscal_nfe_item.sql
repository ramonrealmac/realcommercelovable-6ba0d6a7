-- Migration: 20260813120000_add_item_origem_to_fiscal_nfe_item.sql
-- Description: Adiciona colunas nfe_item_origem_id, nr_item_origem e chave_ref_item em fiscal_nfe_item para referenciamento por item (<DFeReferenciado>) em NF-e de devolução (finNFe = 4).

ALTER TABLE public.fiscal_nfe_item
  ADD COLUMN IF NOT EXISTS nfe_item_origem_id bigint REFERENCES public.fiscal_nfe_item(nfe_item_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nr_item_origem integer NULL,
  ADD COLUMN IF NOT EXISTS chave_ref_item varchar(44) NULL;

CREATE INDEX IF NOT EXISTS ix_nfe_item_origem ON public.fiscal_nfe_item USING btree (nfe_item_origem_id);

-- Atualiza a função fn_prevalidar_nfe para validar rigorosamente a devolução por item antes da transmissão
CREATE OR REPLACE FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $_$
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
    v_has_item_ref boolean;
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

    -- ── Devolução exige pelo menos 1 referência de cabeçalho (44 dígitos) ─────────
    IF v_cab.fin_nfe = 4 THEN
        SELECT COUNT(*) INTO v_ref_cnt
        FROM public.fiscal_nfe_referenciada
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
          AND length(regexp_replace(COALESCE(chave_ref, ''), '[^0-9]', '', 'g')) = 44;

        IF v_ref_cnt = 0 THEN
            v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                'campo','Referência',
                'mensagem','Documento referenciado com chave de 44 dígitos é obrigatório para NF-e de devolução (fin_nfe=4).'));
        END IF;
    END IF;

    -- ── Pagamentos ───────────────────────────────────────────────
    SELECT COUNT(*) INTO v_pag_cnt
    FROM public.fiscal_nfe_pagamento
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF v_pag_cnt = 0 AND v_cab.fin_nfe <> 4 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Pagamento','mensagem','Nenhum pagamento informado na NF-e.'));
    ELSIF v_pag_cnt > 0 THEN
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

            IF COALESCE(v_item.v_pag, 0) <= 0 AND v_item.t_pag <> '90' AND v_cab.fin_nfe <> 4 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → v_pag', v_item.nfe_pagamento_id),
                    'mensagem','Valor do pagamento é zero ou negativo.'));
            END IF;
        END LOOP;
    END IF;

    -- ── Itens ────────────────────────────────────────────────────
    SELECT COUNT(*) INTO v_item_cnt
    FROM public.fiscal_nfe_item
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id AND excluido = false;

    IF v_item_cnt = 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Itens','mensagem','Nenhum item inserido na NF-e.'));
    ELSE
        FOR v_item IN
            SELECT * FROM public.fiscal_nfe_item
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id AND excluido = false
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

            -- NCM
            IF COALESCE(v_item.ncm,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem','NCM não informado.'));
            ELSIF v_item.ncm !~ '^\d{8}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem', format('NCM deve ter exatamente 8 dígitos numéricos, encontrado "%s".', v_item.ncm)));
            END IF;

            -- ── Validação impeditiva de vínculo de item para devoluções (fin_nfe = 4) ──
            IF v_cab.fin_nfe = 4 THEN
                v_has_item_ref := (v_item.nfe_item_origem_id IS NOT NULL) OR
                                  (COALESCE(v_item.nr_item_origem, 0) > 0 AND length(regexp_replace(COALESCE(v_item.chave_ref_item, ''), '[^0-9]', '', 'g')) = 44);

                IF NOT v_has_item_ref THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → Referência de Item',
                        'mensagem', format('Não foi possível transmitir a NF-e de devolução. O item %s - %s não possui vínculo com o item da NF-e original.', COALESCE(NULLIF(v_item.cd_prod_fornec, ''), v_item.produto_id::text, '?'), COALESCE(v_item.nm_produto, ''))));
                END IF;
            END IF;
        END LOOP;
    END IF;

    IF jsonb_array_length(v_erros) > 0 THEN
        RETURN jsonb_build_object('valido', false, 'erros', v_erros, 'regime', CASE WHEN v_simples THEN 'SIMPLES' ELSE 'NORMAL' END);
    END IF;

    RETURN jsonb_build_object('valido', true, 'erros', '[]'::jsonb, 'regime', CASE WHEN v_simples THEN 'SIMPLES' ELSE 'NORMAL' END);
END;
$_$;
