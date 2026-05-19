
-- Drop and recreate view with new column
DROP VIEW IF EXISTS public.vw_produtos_disponiveis;

CREATE VIEW public.vw_produtos_disponiveis AS
SELECT p.id, p.empresa_id, p.xcd_produto, p.xcd_barra, p.xnm_produto, p.xun_produto,
  p.xgrupo_produto_id, g.xnm_grupo_produto,
  p.xqt_estoque_fisico, p.xqt_estoque_reservado, p.xqt_estoque_disponivel,
  p.xqt_estoque_minimo, p.xqt_estoque_padrao,
  p.xvl_preco_compra, p.xpc_markup, p.xvl_preco_sugerido, p.xvl_preco_venda,
  p.xlg_venda_online, p.xurl_foto, p.xdt_cadastro, p.xdt_alteracao, p.excluido_visivel,
  p.xdias_venda_online
FROM produto p
LEFT JOIN grupo_produto g ON g.id = p.xgrupo_produto_id
WHERE p.excluido_visivel = false AND p.xlg_venda_online = true;
