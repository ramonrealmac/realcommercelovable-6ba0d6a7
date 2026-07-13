-- Migration: 20260713110000_alter_vw_pedidos_caixa_union.sql
-- Description: Re-cria a view vw_pedidos_caixa_union incluindo as colunas tp_origem e empresa_id para permitir o filtro por empresa no Caixa/PDV

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
  -- Se a empresa bloqueia pedido e o pedido está bloqueado por crédito, não exibe no PDV/Caixa
  AND NOT (COALESCE(e.bloquear_pedido, 'N') = 'S' AND COALESCE(m.st_bloqueado, 'N') = 'S')

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

-- Registro da Versão 1.18.34
DELETE FROM public.sistema_versoes WHERE versao = '1.18.34';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.34',
  'Adição de empresa_id na view de Pedidos do Caixa e Filtro de PDV',
  'Re-criação da view public.vw_pedidos_caixa_union com DROP CASCADE prévio para adicionar a coluna empresa_id (da tabela de movimento e emovimento) e preservar tp_origem, permitindo que a listagem de pedidos/pré-vendas na tela do Caixa/PDV seja filtrada estritamente pela empresa ativa logada.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
