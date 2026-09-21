-- Migration: 20260921180000_hide_blocked_orders_from_caixa_view.sql
-- Description: Ensures vw_pedidos_caixa_union excludes any order where st_bloqueado = 'S' so blocked orders are not sent to Caixa/PDV and instead wait for release in LiberacaoPedidosForm.

DROP VIEW IF EXISTS public.vw_pedidos_caixa_union CASCADE;

CREATE VIEW public.vw_pedidos_caixa_union AS
SELECT 
  m.movimento_id,
  m.nr_movimento,
  m.cadastro_id,
  COALESCE(c.nome_fantasia, c.razao_social, '(Consumidor)')::text AS cliente_nome,
  m.funcionario_id AS vendedor_id,
  (SELECT f.nome FROM public.funcionario f WHERE f.funcionario_id = m.funcionario_id)::text AS vendedor_nome,
  m.vl_movimento,
  m.dt_emissao,
  false AS is_external,
  'LOCAL'::text AS origem,
  m.tp_origem,
  m.empresa_id
FROM public.movimento m
LEFT JOIN public.cadastro c ON c.cadastro_id = m.cadastro_id
LEFT JOIN public.empresa e ON e.empresa_id = m.empresa_id
WHERE m.st_pedido = 'F' 
  AND m.excluido = false
  AND COALESCE(m.tp_movimento, '') NOT IN ('SUP', 'SAN')
  AND COALESCE(m.st_bloqueado, 'N') <> 'S'

UNION ALL

SELECT 
  em.emovimento_id AS movimento_id,
  em.nr_movimento,
  em.cadastro_id,
  COALESCE(cl.razao_social, '(Consumidor Virtual)')::text AS cliente_nome,
  NULL::bigint AS vendedor_id,
  'Loja Virtual'::text AS vendedor_nome,
  em.vl_movimento,
  em.dt_emissao,
  true AS is_external,
  'VIRTUAL'::text AS origem,
  em.tp_origem,
  em.empresa_id
FROM public.emovimento em
LEFT JOIN public.cliente cl ON cl.id = em.cliente_id
WHERE em.st_pedido = 'R' 
  AND em.excluido = false;

COMMENT ON VIEW public.vw_pedidos_caixa_union IS 'View de união de pedidos pendentes para o Caixa/PDV, omitindo pedidos com st_bloqueado = S.';
