-- Fix return NFe headers that were mistakenly inserted with st_nf = 'A' without SEFAZ authorization/chave/protocolo
UPDATE public.fiscal_nfe_cabecalho
SET st_nf = 'P'
WHERE fin_nfe = 4 AND st_nf = 'A' AND (chave_nfe IS NULL OR chave_nfe = '');
