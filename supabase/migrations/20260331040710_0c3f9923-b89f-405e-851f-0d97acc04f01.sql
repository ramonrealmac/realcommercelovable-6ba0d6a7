
-- PART 5: INDEXES

CREATE UNIQUE INDEX IF NOT EXISTS iu_cadastro_empresa_id ON public.cadastro USING btree (empresa_id, cadastro_id);
CREATE UNIQUE INDEX IF NOT EXISTS iu_cliente_cd ON public.cliente_old USING btree (xcd_cliente) WHERE (excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_deposito_empresa_nome ON public.deposito USING btree (empresa_id, nome) WHERE (excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_estoque_empresa_prod ON public.estoque USING btree (empresa_id, deposito_id, produto_id);
CREATE UNIQUE INDEX IF NOT EXISTS iu_grupo_cadastro_empresa_nome ON public.grupo_cadastro USING btree (empresa_id, nome) WHERE (excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_grupo_produto_cd ON public.grupo_produto_old USING btree (xcd_grupo_produto) WHERE (excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_movimento_empresa ON public.movimento USING btree (empresa_id, movimento_id);
CREATE UNIQUE INDEX IF NOT EXISTS iu_produto_barra ON public.produto_old USING btree (xcd_barra) WHERE (xcd_barra IS NOT NULL AND xcd_barra <> '' AND excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_produto_cd ON public.produto_old USING btree (xcd_produto) WHERE (excluido = false);
CREATE UNIQUE INDEX IF NOT EXISTS iu_produto_empresa ON public.produto USING btree (empresa_id, produto_id);
CREATE UNIQUE INDEX IF NOT EXISTS iu_produto_grupo_empresa ON public.produto_grupo USING btree (empresa_id, grupo_id);

CREATE INDEX IF NOT EXISTS ix_cadastro_cnpj ON public.cadastro USING btree (cnpj);
CREATE INDEX IF NOT EXISTS ix_cadastro_razao ON public.cadastro USING btree (razao_social);
CREATE INDEX IF NOT EXISTS ix_cliente_nome ON public.cliente_old USING btree (xnm_razao_social);
CREATE INDEX IF NOT EXISTS ix_estoque_produto ON public.estoque USING btree (produto_id);
CREATE INDEX IF NOT EXISTS ix_financeiro_baixa_financeiro ON public.financeiro_baixa USING btree (financeiro_id);
CREATE INDEX IF NOT EXISTS ix_financeiro_cadastro ON public.financeiro USING btree (cadastro_id);
CREATE INDEX IF NOT EXISTS ix_financeiro_empresa_tp ON public.financeiro USING btree (empresa_id, tp_financeiro);
CREATE INDEX IF NOT EXISTS ix_financeiro_vencimento ON public.financeiro USING btree (dt_vencimento);
CREATE INDEX IF NOT EXISTS ix_grupo_produto_nome ON public.grupo_produto_old USING btree (xnm_grupo_produto);
CREATE INDEX IF NOT EXISTS ix_mov_item_movimento ON public.movimento_item USING btree (movimento_id);
CREATE INDEX IF NOT EXISTS ix_mov_item_produto ON public.movimento_item USING btree (produto_id);
CREATE INDEX IF NOT EXISTS ix_mov_pgto_movimento ON public.movimento_pagamento USING btree (movimento_id);
CREATE INDEX IF NOT EXISTS ix_movimento_cadastro ON public.movimento USING btree (cadastro_id);
CREATE INDEX IF NOT EXISTS ix_movimento_dt_emissao ON public.movimento USING btree (dt_emissao);
CREATE INDEX IF NOT EXISTS ix_movimento_st ON public.movimento USING btree (st_pedido);
CREATE INDEX IF NOT EXISTS ix_pedido_cliente ON public.pedido_old USING btree (xcliente_id);
CREATE INDEX IF NOT EXISTS ix_pedido_data ON public.pedido_old USING btree (xdt_pedido);
CREATE INDEX IF NOT EXISTS ix_pedido_item_pedido ON public.pedido_item_old USING btree (xpedido_id);
CREATE INDEX IF NOT EXISTS ix_pedido_nr ON public.pedido_old USING btree (xnr_pedido);
CREATE INDEX IF NOT EXISTS ix_pedido_pagamento_pedido ON public.pedido_pagamento_old USING btree (xpedido_id);
CREATE INDEX IF NOT EXISTS ix_pedido_status ON public.pedido_old USING btree (xst_pedido);
CREATE INDEX IF NOT EXISTS ix_produto_grupo ON public.produto USING btree (grupo_id);
CREATE INDEX IF NOT EXISTS ix_produto_gtin ON public.produto USING btree (gtin);
CREATE INDEX IF NOT EXISTS ix_produto_nome ON public.produto USING btree (nome);

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.fu_get_cliente_public(_cpf text) RETURNS TABLE(id bigint, razao_social text, fone_geral text, dep_nome1 text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT c.cadastro_id, c.razao_social, c.fone_geral, c.dep_nome1
  FROM public.cadastro c WHERE c.excluido = false
    AND c.cnpj = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  ORDER BY c.cadastro_id DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fu_get_parametro_publico() RETURNS TABLE(id bigint, xnm_escola text, xcor_primaria text, xcor_secundaria text, xcor_destaque text, xcor_fundo text, xcor_fundo_card text, xcor_texto_principal text, xcor_texto_secundario text, xcor_botao text, xcor_botao_negativo text, xcor_header text, xcor_link text, xcor_menu text, xurl_logo text, xurl_favicon text, xurl_banner_vendas text, xurl_link_vendas text, xmsg_pos_pagamento text, xlg_valida_estoque_link boolean, xlg_valida_estoque_pdv boolean, xcss_customizado text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.xnm_escola, p.xcor_primaria, p.xcor_secundaria, 
    p.xcor_destaque, p.xcor_fundo, p.xcor_fundo_card,
    p.xcor_texto_principal, p.xcor_texto_secundario, p.xcor_botao,
    p.xcor_botao_negativo, p.xcor_header, p.xcor_link, p.xcor_menu,
    p.xurl_logo, p.xurl_favicon, p.xurl_banner_vendas, p.xurl_link_vendas,
    p.xmsg_pos_pagamento, p.xlg_valida_estoque_link, p.xlg_valida_estoque_pdv,
    p.xcss_customizado
  FROM parametro p WHERE p.excluido = false LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fu_get_pedido_status_public(_movimento_id bigint, _cpf text) RETURNS TABLE(id bigint, nr_movimento bigint, st_pedido text, dt_emissao timestamp with time zone, vl_movimento numeric, url_pagamento text)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.movimento_id, m.nr_movimento, m.st_pedido, m.dt_emissao, m.vl_movimento, m.url_pagamento
  FROM public.movimento m JOIN public.cadastro c ON c.cadastro_id = m.cadastro_id
  WHERE m.movimento_id = _movimento_id AND m.excluido = false AND m.tp_origem = 'LINK'
    AND c.cnpj = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g') LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fu_list_pedidos_public(_cpf text) RETURNS TABLE(id bigint, nr_movimento bigint, dt_emissao timestamp with time zone, vl_movimento numeric, st_pedido text, items jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT m.movimento_id, m.nr_movimento, m.dt_emissao, m.vl_movimento, m.st_pedido,
    COALESCE(jsonb_agg(jsonb_build_object('nm_produto', mi.nm_produto, 'qt_movimento', mi.qt_movimento, 'vl_und_produto', mi.vl_und_produto, 'produto_id', mi.produto_id) ORDER BY mi.movimento_item_id) FILTER (WHERE mi.movimento_item_id IS NOT NULL), '[]'::jsonb)
  FROM public.movimento m JOIN public.cadastro c ON c.cadastro_id = m.cadastro_id
  LEFT JOIN public.movimento_item mi ON mi.movimento_id = m.movimento_id AND mi.excluido = false
  WHERE m.excluido = false AND m.tp_origem = 'LINK' AND c.cnpj = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  GROUP BY m.movimento_id, m.nr_movimento, m.dt_emissao, m.vl_movimento, m.st_pedido
  ORDER BY m.dt_emissao DESC LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(qt_movimento * vl_und_produto), 0) INTO v_total
  FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false;
  UPDATE movimento SET vl_produto = v_total, vl_movimento = v_total - COALESCE(vl_desconto, 0)
  WHERE movimento_id = _movimento_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_mov RECORD; v_item RECORD;
BEGIN
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Movimento não encontrado'); END IF;
  IF v_mov.st_pedido = 'A' AND _novo_status = 'F' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
      UPDATE estoque SET estoque_reservado = estoque_reservado + v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'F', dt_finalizacao = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'T' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
      UPDATE estoque SET estoque_fisico = estoque_fisico - v_item.qt_movimento, estoque_reservado = estoque_reservado - v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'T', dt_faturamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
      UPDATE estoque SET estoque_reservado = estoque_reservado - v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'T' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
      UPDATE estoque SET estoque_fisico = estoque_fisico + v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'A' AND _novo_status = 'C' THEN
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSE
    RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
  END IF;
  INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);
  RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g'); v_id bigint;
BEGIN
  IF length(v_cpf) < 11 THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF btrim(coalesce(_nome, '')) = '' THEN RAISE EXCEPTION 'Nome obrigatório'; END IF;
  IF btrim(coalesce(_filhos, '')) = '' THEN RAISE EXCEPTION 'Nome do(s) filho(s) obrigatório'; END IF;
  SELECT c.cadastro_id INTO v_id FROM public.cadastro c WHERE c.excluido = false AND c.cnpj = v_cpf ORDER BY c.cadastro_id DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.cadastro (cnpj, razao_social, fone_geral, dep_nome1) VALUES (v_cpf, btrim(_nome), nullif(btrim(coalesce(_telefone, '')), ''), btrim(_filhos)) RETURNING cadastro_id INTO v_id;
  ELSE
    UPDATE public.cadastro SET razao_social = btrim(_nome), fone_geral = nullif(btrim(coalesce(_telefone, '')), ''), dep_nome1 = btrim(_filhos), dt_alteracao = now() WHERE cadastro_id = v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.tr_set_hr_movimento() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.hr_movimento IS NULL THEN NEW.hr_movimento := to_char(NEW.dt_emissao AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS'); END IF;
  RETURN NEW;
END;
$$;

-- TRIGGER
DROP TRIGGER IF EXISTS tr_set_hr_movimento ON public.movimento;
CREATE TRIGGER tr_set_hr_movimento BEFORE INSERT ON public.movimento FOR EACH ROW EXECUTE FUNCTION public.tr_set_hr_movimento();

-- VIEWS
CREATE OR REPLACE VIEW public.vw_pedidos_completos AS
 SELECT m.movimento_id, m.empresa_id, m.tp_movimento, m.nr_movimento, m.cadastro_id, m.dt_emissao, m.hr_movimento,
    m.vl_produto, m.vl_desconto, m.vl_movimento, m.st_pedido, m.status, m.faturado, m.observacao, m.tp_origem,
    m.lg_pedido_link, m.lg_pedido_pdv, m.lg_pagamento_online, m.dt_pagamento, m.dt_finalizacao, m.dt_faturamento,
    m.dt_cancelamento, m.usuario_id, m.nm_responsavel, m.nr_telefone_responsavel, m.email_responsavel, m.nm_crianca,
    m.obs_pedido, m.id_transacao_abacatepay, m.url_pagamento, m.qr_code_pagamento, m.excluido,
    c.razao_social AS nm_cliente
 FROM public.movimento m LEFT JOIN public.cadastro c ON c.cadastro_id = m.cadastro_id;

CREATE OR REPLACE VIEW public.vw_produtos_disponiveis AS
 SELECT p.produto_id, p.empresa_id, p.grupo_id, p.nome, p.nome_reduzido, p.descricao, p.unidade_id, p.gtin,
    p.referencia, p.tp_produto, p.ativo, p.preco_venda, p.preco_promocional, p.vl_compra, p.pc_markup,
    p.preco_sugerido, p.url_foto, p.venda_online, p.dias_venda_online, p.controla_estoque, p.excluido,
    p.dt_cadastro, p.dt_alteracao, pg.nome AS nm_grupo_produto, e.estoque_fisico, e.estoque_reservado,
    e.estoque_disponivel, e.estoque_minimo, e.estoque_padrao
 FROM public.produto p
 LEFT JOIN public.produto_grupo pg ON pg.grupo_id = p.grupo_id
 LEFT JOIN public.estoque e ON e.produto_id = p.produto_id AND e.empresa_id = p.empresa_id AND e.deposito_id = 1
 WHERE p.excluido = false;
