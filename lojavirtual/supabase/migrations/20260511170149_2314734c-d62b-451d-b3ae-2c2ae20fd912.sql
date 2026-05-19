
-- 1. cliente: restrict SELECT to ADM/CAIXA
DROP POLICY IF EXISTS "Auth can view clientes" ON public.cliente;
CREATE POLICY "Staff can view clientes" ON public.cliente
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

-- 2. pedido_item: remove anon SELECT (anon only needs INSERT during checkout)
DROP POLICY IF EXISTS "Anon can view items linked orders" ON public.pedido_item;

-- 3. pedido_pagamento: remove anon SELECT
DROP POLICY IF EXISTS "Anon can view pagamentos linked orders" ON public.pedido_pagamento;

-- 4. produto: hide cost/markup columns from anon role
REVOKE SELECT ON public.produto FROM anon;
GRANT SELECT (
  id, empresa_id, xcd_produto, xcd_barra, xnm_produto, xun_produto, xurl_foto,
  xgrupo_produto_id, xqt_estoque_fisico, xqt_estoque_reservado, xqt_estoque_disponivel,
  xqt_estoque_minimo, xqt_estoque_padrao, xvl_preco_venda, xvl_preco_sugerido,
  xlg_venda_online, xdias_venda_online, xdt_cadastro, xdt_alteracao, excluido_visivel
) ON public.produto TO anon;

-- 5. storage.objects: restrict produtos bucket writes to ADM
DROP POLICY IF EXISTS "Auth can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Auth can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Auth can delete product images" ON storage.objects;

CREATE POLICY "Admins can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'produtos' AND has_role(auth.uid(), 'ADM'::app_role));

CREATE POLICY "Admins can update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'produtos' AND has_role(auth.uid(), 'ADM'::app_role));

CREATE POLICY "Admins can delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'produtos' AND has_role(auth.uid(), 'ADM'::app_role));
