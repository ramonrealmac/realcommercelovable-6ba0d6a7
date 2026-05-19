
-- Remove anon direct access to parametro
DROP POLICY IF EXISTS "Anon can view parametro" ON parametro;

-- Create a function that returns only safe parametro fields (no API key)
CREATE OR REPLACE FUNCTION public.fu_get_parametro_publico()
RETURNS TABLE (
  id bigint, xnm_escola text, xcor_primaria text, xcor_secundaria text, 
  xcor_destaque text, xcor_fundo text, xcor_fundo_card text,
  xcor_texto_principal text, xcor_texto_secundario text, xcor_botao text,
  xcor_botao_negativo text, xcor_header text, xcor_link text, xcor_menu text,
  xurl_logo text, xurl_favicon text, xurl_banner_vendas text, xurl_link_vendas text,
  xmsg_pos_pagamento text, xlg_valida_estoque_link boolean, xlg_valida_estoque_pdv boolean,
  xcss_customizado text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.xnm_escola, p.xcor_primaria, p.xcor_secundaria, 
    p.xcor_destaque, p.xcor_fundo, p.xcor_fundo_card,
    p.xcor_texto_principal, p.xcor_texto_secundario, p.xcor_botao,
    p.xcor_botao_negativo, p.xcor_header, p.xcor_link, p.xcor_menu,
    p.xurl_logo, p.xurl_favicon, p.xurl_banner_vendas, p.xurl_link_vendas,
    p.xmsg_pos_pagamento, p.xlg_valida_estoque_link, p.xlg_valida_estoque_pdv,
    p.xcss_customizado
  FROM parametro p WHERE p.excluido_visivel = false LIMIT 1;
$$;
