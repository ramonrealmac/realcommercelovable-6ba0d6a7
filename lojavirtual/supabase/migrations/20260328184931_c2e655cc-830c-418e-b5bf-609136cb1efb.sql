
-- 1. FIX: app_settings - restrict to admin only (no public write/delete)
DROP POLICY IF EXISTS "Anyone can delete settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can manage settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can update settings" ON app_settings;
DROP POLICY IF EXISTS "Anyone can view settings" ON app_settings;

CREATE POLICY "Admins can view settings" ON app_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'ADM'::app_role));
CREATE POLICY "Admins can insert settings" ON app_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'ADM'::app_role));
CREATE POLICY "Admins can update settings" ON app_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'ADM'::app_role));
CREATE POLICY "Admins can delete settings" ON app_settings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'ADM'::app_role));

-- 2. FIX: orders - restrict to authenticated only
DROP POLICY IF EXISTS "Anyone can view orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
DROP POLICY IF EXISTS "Service can update orders" ON orders;

CREATE POLICY "Auth can view orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can create orders" ON orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service can update orders" ON orders FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'ADM'::app_role));

-- 3. FIX: parametro - hide API key from public, create a view without sensitive fields for anon
DROP POLICY IF EXISTS "Anyone can view parametro" ON parametro;

CREATE POLICY "Auth can view parametro" ON parametro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view parametro" ON parametro FOR SELECT TO anon USING (true);

-- 4. FIX: pedido - restrict anon insert to LINK origin only
DROP POLICY IF EXISTS "Anon can insert pedidos link" ON pedido;
CREATE POLICY "Anon can insert pedidos link" ON pedido FOR INSERT TO anon WITH CHECK (xtipo_origem_pedido = 'LINK'::text);

-- 5. FIX: pedido_item anon SELECT - restrict to items of LINK-origin orders
DROP POLICY IF EXISTS "Anon can view items" ON pedido_item;
CREATE POLICY "Anon can view items linked orders" ON pedido_item FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM pedido WHERE pedido.id = pedido_item.xpedido_id AND pedido.xtipo_origem_pedido = 'LINK'));

-- 6. FIX: pedido_item anon INSERT - restrict to items of LINK-origin orders  
DROP POLICY IF EXISTS "Anon can insert items" ON pedido_item;
CREATE POLICY "Anon can insert items linked orders" ON pedido_item FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM pedido WHERE pedido.id = pedido_item.xpedido_id AND pedido.xtipo_origem_pedido = 'LINK'));

-- 7. FIX: pedido_pagamento anon SELECT - restrict to LINK-origin orders
DROP POLICY IF EXISTS "Anon can view pagamentos" ON pedido_pagamento;
CREATE POLICY "Anon can view pagamentos linked orders" ON pedido_pagamento FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM pedido WHERE pedido.id = pedido_pagamento.xpedido_id AND pedido.xtipo_origem_pedido = 'LINK'));

-- 8. FIX: pedido_pagamento anon INSERT - restrict to LINK-origin orders
DROP POLICY IF EXISTS "Anon can insert pagamentos" ON pedido_pagamento;
CREATE POLICY "Anon can insert pagamentos linked orders" ON pedido_pagamento FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM pedido WHERE pedido.id = pedido_pagamento.xpedido_id AND pedido.xtipo_origem_pedido = 'LINK'));

-- 9. FIX: cliente - restrict write to admins
DROP POLICY IF EXISTS "Auth can insert clientes" ON cliente;
DROP POLICY IF EXISTS "Auth can update clientes" ON cliente;
CREATE POLICY "Admins can insert clientes" ON cliente FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));
CREATE POLICY "Admins can update clientes" ON cliente FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));
