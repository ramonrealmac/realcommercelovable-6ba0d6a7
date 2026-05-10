-- 1) Backfill cabeçalhos a partir do último evento autorizado
WITH ult AS (
  SELECT DISTINCT ON (nfe_cabecalho_id)
    nfe_cabecalho_id,
    resposta::jsonb AS r
  FROM public.fiscal_evento
  WHERE nfe_cabecalho_id IS NOT NULL
    AND resposta IS NOT NULL
    AND status IN ('CONCLUIDO','EMITIDO')
  ORDER BY nfe_cabecalho_id, created_at DESC
)
UPDATE public.fiscal_nfe_cabecalho c
SET
  chave_nfe    = COALESCE(NULLIF(c.chave_nfe,''), ult.r->>'chave_nfe'),
  nr_protocolo = COALESCE(NULLIF(c.nr_protocolo,''), ult.r->>'nr_protocolo'),
  recibo_sefaz = COALESCE(NULLIF(c.recibo_sefaz,''), ult.r->>'recibo_sefaz'),
  c_stat       = COALESCE(c.c_stat, NULLIF(ult.r->>'c_stat','')::int),
  x_motivo     = COALESCE(c.x_motivo, ult.r->>'x_motivo'),
  xml_nf       = COALESCE(c.xml_nf, ult.r->>'xml_retorno'),
  st_nf        = CASE WHEN (ult.r->>'sucesso')::boolean THEN 'E' ELSE c.st_nf END,
  updated_at   = now()
FROM ult
WHERE c.nfe_cabecalho_id = ult.nfe_cabecalho_id
  AND (ult.r->>'sucesso')::boolean = true
  AND (c.chave_nfe IS NULL OR c.chave_nfe = '');

-- 2) Padroniza status dos eventos autorizados como EMITIDO
UPDATE public.fiscal_evento
SET status = 'EMITIDO'
WHERE status = 'CONCLUIDO'
  AND resposta IS NOT NULL
  AND (resposta::jsonb->>'sucesso')::boolean = true;