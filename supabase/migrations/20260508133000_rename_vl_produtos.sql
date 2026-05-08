-- Renomear vl_produtos para vl_produto na tabela fiscal_nfe_cabecalho
-- Padronização com a tabela movimento
ALTER TABLE public.fiscal_nfe_cabecalho RENAME COLUMN vl_produtos TO vl_produto;
