-- Fix error-level issues: restrict broad order reads, remove anonymous pedido read/update exposure,
-- provide constrained public RPC access, and set views to security invoker.

-- 1) Tighten legacy orders table read access
DROP POLICY IF EXISTS "Auth can view orders" ON public.orders;

CREATE POLICY "Staff can view orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'ADM'::public.app_role)
  OR public.has_role(auth.uid(), 'CAIXA'::public.app_role)
);

-- 2) Remove risky anonymous policies on pedido (PII exposure + arbitrary updates)
DROP POLICY IF EXISTS "Anon can view pedidos link" ON public.pedido;
DROP POLICY IF EXISTS "Anon can update pedidos link" ON public.pedido;

-- 3) Public-safe RPCs for loja flow (minimal data surface + CPF-scoped)
CREATE OR REPLACE FUNCTION public.fu_get_cliente_public(_cpf text)
RETURNS TABLE(
  id bigint,
  xnm_razao_social text,
  xnr_telefone text,
  xnm_crianca text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.xnm_razao_social, c.xnr_telefone, c.xnm_crianca
  FROM public.cliente c
  WHERE c.excluido_visivel = false
    AND c.xnr_cpf_cnpj = regexp_replace(coalesce(_cpf, ''), '\\D', '', 'g')
  ORDER BY c.id DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fu_upsert_cliente_public(
  _cpf text,
  _nome text,
  _telefone text,
  _filhos text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(_cpf, ''), '\\D', '', 'g');
  v_id bigint;
BEGIN
  IF length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  IF btrim(coalesce(_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  IF btrim(coalesce(_filhos, '')) = '' THEN
    RAISE EXCEPTION 'Nome do(s) filho(s) obrigatório';
  END IF;

  SELECT c.id
    INTO v_id
  FROM public.cliente c
  WHERE c.excluido_visivel = false
    AND c.xnr_cpf_cnpj = v_cpf
  ORDER BY c.id DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.cliente (
      xcd_cliente,
      xnr_cpf_cnpj,
      xnm_razao_social,
      xnr_telefone,
      xnm_crianca
    )
    VALUES (
      'CLI' || right(v_cpf, 6),
      v_cpf,
      btrim(_nome),
      nullif(btrim(coalesce(_telefone, '')), ''),
      btrim(_filhos)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.cliente
       SET xnm_razao_social = btrim(_nome),
           xnr_telefone = nullif(btrim(coalesce(_telefone, '')), ''),
           xnm_crianca = btrim(_filhos),
           xdt_alteracao = now()
     WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fu_list_pedidos_public(_cpf text)
RETURNS TABLE(
  id bigint,
  xnr_pedido bigint,
  xdt_pedido timestamp with time zone,
  xvl_total_liquido numeric,
  xst_pedido text,
  items jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.xnr_pedido,
    p.xdt_pedido,
    p.xvl_total_liquido,
    p.xst_pedido,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'xnm_produto', pi.xnm_produto,
          'xqt_item', pi.xqt_item,
          'xvl_unitario', pi.xvl_unitario,
          'xproduto_id', pi.xproduto_id
        )
        ORDER BY pi.id
      ) FILTER (WHERE pi.id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM public.pedido p
  JOIN public.cliente c
    ON c.id = p.xcliente_id
  LEFT JOIN public.pedido_item pi
    ON pi.xpedido_id = p.id
   AND pi.excluido_visivel = false
  WHERE p.excluido_visivel = false
    AND p.xtipo_origem_pedido = 'LINK'
    AND c.xnr_cpf_cnpj = regexp_replace(coalesce(_cpf, ''), '\\D', '', 'g')
  GROUP BY p.id, p.xnr_pedido, p.xdt_pedido, p.xvl_total_liquido, p.xst_pedido
  ORDER BY p.xdt_pedido DESC
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.fu_get_pedido_status_public(
  _pedido_id bigint,
  _cpf text
)
RETURNS TABLE(
  id bigint,
  xnr_pedido bigint,
  xst_pedido text,
  xdt_pedido timestamp with time zone,
  xvl_total_liquido numeric,
  xurl_pagamento text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.xnr_pedido,
    p.xst_pedido,
    p.xdt_pedido,
    p.xvl_total_liquido,
    p.xurl_pagamento
  FROM public.pedido p
  JOIN public.cliente c
    ON c.id = p.xcliente_id
  WHERE p.id = _pedido_id
    AND p.excluido_visivel = false
    AND p.xtipo_origem_pedido = 'LINK'
    AND c.xnr_cpf_cnpj = regexp_replace(coalesce(_cpf, ''), '\\D', '', 'g')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.fu_get_cliente_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fu_upsert_cliente_public(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fu_list_pedidos_public(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fu_get_pedido_status_public(bigint, text) TO anon, authenticated;

-- 4) Mitigate SECURITY DEFINER VIEW scanner finding by enforcing invoker security
ALTER VIEW public.vw_pedidos_completos SET (security_invoker = true);
ALTER VIEW public.vw_produtos_disponiveis SET (security_invoker = true);