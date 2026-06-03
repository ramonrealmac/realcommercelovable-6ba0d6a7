-- Migration: 20260603021500_alter_get_parametro_publico.sql
-- Redefine a função fu_get_parametro_publico para aceitar _empresa_id e _url_link_vendas
-- Reconfigura a view vw_produtos_disponiveis para incluir empresa_id e desativar security_invoker

CREATE OR REPLACE FUNCTION public.fu_get_parametro_publico(
  _empresa_id bigint DEFAULT NULL,
  _url_link_vendas text DEFAULT NULL
) RETURNS TABLE(
  id bigint, 
  xnm_escola text, 
  xcor_primaria text, 
  xcor_secundaria text, 
  xcor_destaque text, 
  xcor_fundo text, 
  xcor_fundo_card text, 
  xcor_texto_principal text, 
  xcor_texto_secundario text, 
  xcor_botao text, 
  xcor_botao_negativo text, 
  xcor_header text, 
  xcor_link text, 
  xcor_menu text, 
  xurl_logo text, 
  xurl_favicon text, 
  xurl_banner_vendas text, 
  xurl_link_vendas text, 
  xmsg_pos_pagamento text, 
  xlg_valida_estoque_link boolean, 
  xlg_valida_estoque_pdv boolean, 
  xcss_customizado text, 
  xnm_aba_lojavirtual text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.empresa_id AS id, 
    COALESCE(e.nm_escola, e.nome_fantasia, e.razao_social) AS xnm_escola,
    e.cor_primaria AS xcor_primaria, 
    e.cor_secundaria AS xcor_secundaria, 
    e.cor_destaque AS xcor_destaque, 
    e.cor_fundo AS xcor_fundo, 
    e.cor_fundo_card AS xcor_fundo_card,
    e.cor_texto_principal AS xcor_texto_principal, 
    e.cor_texto_secundario AS xcor_texto_secundario, 
    e.cor_botao AS xcor_botao,
    e.cor_botao_negativo AS xcor_botao_negativo, 
    e.cor_header AS xcor_header, 
    e.cor_link AS xcor_link, 
    e.cor_menu AS xcor_menu,
    e.url_logo AS xurl_logo, 
    e.url_favicon AS xurl_favicon, 
    e.url_banner_vendas AS xurl_banner_vendas, 
    e.url_link_vendas AS xurl_link_vendas,
    e.msg_pos_pagamento AS xmsg_pos_pagamento, 
    e.lg_valida_estoque_link AS xlg_valida_estoque_link, 
    e.lg_valida_estoque_pdv AS xlg_valida_estoque_pdv,
    e.css_customizado AS xcss_customizado,
    COALESCE(e.nm_aba_lojavirtual, 'Cardápio') AS xnm_aba_lojavirtual
  FROM public.empresa e
  WHERE e.excluido = false
    AND (_empresa_id IS NULL OR e.empresa_id = _empresa_id)
    AND (_url_link_vendas IS NULL OR e.url_link_vendas = _url_link_vendas OR e.url_link_vendas LIKE '%' || _url_link_vendas || '%')
  ORDER BY e.empresa_id ASC
  LIMIT 1;
END;
$$;

-- Recreate view to select p.empresa_id and disable security_invoker for anonymous access
CREATE OR REPLACE VIEW public.vw_produtos_disponiveis AS
 SELECT p.produto_id AS id,
    p.produto_id::text AS xcd_produto,
    p.nome AS xnm_produto,
    p.preco_venda AS xvl_preco_venda,
    p.url_foto AS xurl_foto,
    pg.nome AS xnm_grupo_produto,
    COALESCE(e.estoque_disponivel, 0) AS xqt_estoque_disponivel,
    p.venda_online AS xlg_venda_online,
    p.dias_venda_online AS xdias_venda_online,
    p.excluido AS excluido_visivel,
    p.empresa_id AS empresa_id
 FROM public.produto p
 LEFT JOIN public.produto_grupo pg ON pg.produto_grupo_id = p.produto_grupo_id
 LEFT JOIN public.empresa emp ON emp.empresa_id = p.empresa_id
 LEFT JOIN public.estoque e ON e.produto_id = p.produto_id 
     AND e.empresa_id = p.empresa_id 
     AND e.deposito_id = COALESCE(emp.deposito_venda_externa_id, emp.deposito_estoque_caixa, 1)
 WHERE p.excluido = false;

ALTER VIEW public.vw_produtos_disponiveis SET (security_invoker = false);
