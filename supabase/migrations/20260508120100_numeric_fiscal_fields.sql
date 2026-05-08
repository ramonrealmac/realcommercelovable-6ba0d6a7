-- Alteração de tipos de campos fiscais para numéricos
-- Facilita o controle sequencial e ordenação
ALTER TABLE public.fiscal_nfe_cabecalho 
  ALTER COLUMN nr_nota TYPE bigint USING (NULLIF(nr_nota, '')::bigint),
  ALTER COLUMN serie TYPE integer USING (NULLIF(serie, '')::integer),
  ALTER COLUMN modelo TYPE integer USING (NULLIF(modelo, '')::integer);

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.fiscal_nfe_cabecalho.nr_nota IS 'Número da Nota Fiscal (nNF)';
COMMENT ON COLUMN public.fiscal_nfe_cabecalho.serie IS 'Série da Nota Fiscal';
COMMENT ON COLUMN public.fiscal_nfe_cabecalho.modelo IS 'Modelo do Documento (55, 65, etc)';
