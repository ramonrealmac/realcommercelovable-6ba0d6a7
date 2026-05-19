
-- 1) Lock down auditoria: remove open INSERT, force inserts via SECURITY DEFINER function with auth.uid()
DROP POLICY IF EXISTS "Auth can insert auditoria" ON public.auditoria;

CREATE OR REPLACE FUNCTION public.fu_log_auditoria(
  _tabela text,
  _registro_id text,
  _acao text,
  _dados_anteriores jsonb DEFAULT NULL,
  _dados_novos jsonb DEFAULT NULL,
  _obs text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auditoria requer usuário autenticado';
  END IF;
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xobs, xusuario_id)
  VALUES (_tabela, _registro_id, _acao, _dados_anteriores, _dados_novos, _obs, auth.uid());
END;
$$;

REVOKE INSERT ON public.auditoria FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.fu_log_auditoria(text, text, text, jsonb, jsonb, text) TO authenticated;

-- 2) Tighten permissive RLS policies on business tables to ADM/CAIXA roles
DROP POLICY IF EXISTS "Auth can insert pedidos" ON public.pedido;
CREATE POLICY "Staff can insert pedidos"
ON public.pedido FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

DROP POLICY IF EXISTS "Auth can update pedidos" ON public.pedido;
CREATE POLICY "Staff can update pedidos"
ON public.pedido FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

DROP POLICY IF EXISTS "Auth can insert items" ON public.pedido_item;
CREATE POLICY "Staff can insert pedido_item"
ON public.pedido_item FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

DROP POLICY IF EXISTS "Auth can update items" ON public.pedido_item;
CREATE POLICY "Staff can update pedido_item"
ON public.pedido_item FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role))
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

DROP POLICY IF EXISTS "Auth can delete items" ON public.pedido_item;
CREATE POLICY "Admins can delete pedido_item"
ON public.pedido_item FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'ADM'::app_role));

DROP POLICY IF EXISTS "Auth can insert pagamentos" ON public.pedido_pagamento;
CREATE POLICY "Staff can insert pedido_pagamento"
ON public.pedido_pagamento FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));

DROP POLICY IF EXISTS "Auth can create orders" ON public.orders;
CREATE POLICY "Staff can create orders"
ON public.orders FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'ADM'::app_role) OR has_role(auth.uid(), 'CAIXA'::app_role));
