
-- Renomear coluna vlr_movimento para vl_movimento na tabela caixa_movimento
ALTER TABLE public.caixa_movimento 
RENAME COLUMN vlr_movimento TO vl_movimento;
