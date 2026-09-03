-- Migration: Aumenta o tamanho dos campos 'nome', 'nome_reduzido' e 'nm_ecommerce' da tabela produto para 100 caracteres
-- Dropa temporariamente a view dependentevw_produtos_disponiveis antes de alterar os tipos das colunas

DROP VIEW IF EXISTS public.vw_produtos_disponiveis CASCADE;

ALTER TABLE public.produto ALTER COLUMN nome TYPE character varying(100);
ALTER TABLE public.produto ALTER COLUMN nome_reduzido TYPE character varying(100);
ALTER TABLE public.produto ALTER COLUMN nm_ecommerce TYPE character varying(100);

-- Recria a view vw_produtos_disponiveis
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

GRANT ALL ON TABLE public.vw_produtos_disponiveis TO anon;
GRANT ALL ON TABLE public.vw_produtos_disponiveis TO authenticated;
GRANT ALL ON TABLE public.vw_produtos_disponiveis TO service_role;
