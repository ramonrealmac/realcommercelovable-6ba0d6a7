
-- Storage bucket para fotos de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('produtos', 'produtos', true);

-- Storage RLS
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'produtos');
CREATE POLICY "Auth can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos');
CREATE POLICY "Auth can update product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'produtos');
CREATE POLICY "Auth can delete product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'produtos');

-- Função de transição de status de pedido com controle de estoque
CREATE OR REPLACE FUNCTION public.fu_transition_pedido_status(
  _pedido_id bigint,
  _novo_status text,
  _usuario_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_item RECORD;
BEGIN
  SELECT * INTO v_pedido FROM pedido WHERE id = _pedido_id AND excluido_visivel = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido não encontrado');
  END IF;

  IF v_pedido.xst_pedido = 'A' AND _novo_status = 'F' THEN
    FOR v_item IN SELECT * FROM pedido_item WHERE xpedido_id = _pedido_id AND excluido_visivel = false LOOP
      UPDATE produto SET xqt_estoque_reservado = xqt_estoque_reservado + v_item.xqt_item WHERE id = v_item.xproduto_id;
    END LOOP;
    UPDATE pedido SET xst_pedido = 'F', xdt_finalizacao = now() WHERE id = _pedido_id;

  ELSIF v_pedido.xst_pedido = 'F' AND _novo_status = 'T' THEN
    FOR v_item IN SELECT * FROM pedido_item WHERE xpedido_id = _pedido_id AND excluido_visivel = false LOOP
      UPDATE produto SET
        xqt_estoque_fisico = xqt_estoque_fisico - v_item.xqt_item,
        xqt_estoque_reservado = xqt_estoque_reservado - v_item.xqt_item
      WHERE id = v_item.xproduto_id;
    END LOOP;
    UPDATE pedido SET xst_pedido = 'T', xdt_faturamento = now() WHERE id = _pedido_id;

  ELSIF v_pedido.xst_pedido = 'F' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM pedido_item WHERE xpedido_id = _pedido_id AND excluido_visivel = false LOOP
      UPDATE produto SET xqt_estoque_reservado = xqt_estoque_reservado - v_item.xqt_item WHERE id = v_item.xproduto_id;
    END LOOP;
    UPDATE pedido SET xst_pedido = 'C', xdt_cancelamento = now() WHERE id = _pedido_id;

  ELSIF v_pedido.xst_pedido = 'T' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM pedido_item WHERE xpedido_id = _pedido_id AND excluido_visivel = false LOOP
      UPDATE produto SET xqt_estoque_fisico = xqt_estoque_fisico + v_item.xqt_item WHERE id = v_item.xproduto_id;
    END LOOP;
    UPDATE pedido SET xst_pedido = 'C', xdt_cancelamento = now() WHERE id = _pedido_id;

  ELSIF v_pedido.xst_pedido = 'A' AND _novo_status = 'C' THEN
    UPDATE pedido SET xst_pedido = 'C', xdt_cancelamento = now() WHERE id = _pedido_id;

  ELSE
    RETURN jsonb_build_object('error', 'Transição inválida: ' || v_pedido.xst_pedido || ' -> ' || _novo_status);
  END IF;

  INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('pedido', _pedido_id::text, 'STATUS_CHANGE',
    jsonb_build_object('status', v_pedido.xst_pedido),
    jsonb_build_object('status', _novo_status),
    _usuario_id);

  RETURN jsonb_build_object('success', true, 'old_status', v_pedido.xst_pedido, 'new_status', _novo_status);
END;
$$;

-- Função para recalcular totais do pedido
CREATE OR REPLACE FUNCTION public.fu_recalcular_pedido(_pedido_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(xqt_item * xvl_unitario), 0) INTO v_total
  FROM pedido_item WHERE xpedido_id = _pedido_id AND excluido_visivel = false;
  
  UPDATE pedido SET
    xvl_total_bruto = v_total,
    xvl_total_liquido = v_total - COALESCE(xvl_total_desconto, 0)
  WHERE id = _pedido_id;
END;
$$;
