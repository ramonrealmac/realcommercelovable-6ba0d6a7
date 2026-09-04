-- Migration: 20260903155500_add_st_avista_to_condicao_pagamento.sql
-- Descrição: Adiciona o campo st_avista (S = À Vista, N = A Prazo) na tabela condicao_pagamento

ALTER TABLE public.condicao_pagamento 
  ADD COLUMN IF NOT EXISTS st_avista character varying(1) DEFAULT 'N';

-- 1. Condições marcadas explicitamente como Promoção À Vista ('V') ou Tipo Prazo Único ('U')
UPDATE public.condicao_pagamento 
SET st_avista = 'S' 
WHERE promocao = 'V' OR tipo_prazo = 'U';

-- 2. Meios diretos comuns (Dinheiro, PIX) com parcela única e sem carência
UPDATE public.condicao_pagamento 
SET st_avista = 'S' 
WHERE (descricao ILIKE '%DINHEIRO%' OR descricao ILIKE '%PIX%')
  AND (qtd_parcelas IS NULL OR qtd_parcelas <= 1)
  AND (prazo_1 IS NULL OR prazo_1 = 0);

-- 3. Demais condições existentes recebem 'N' caso estejam nulas
UPDATE public.condicao_pagamento 
SET st_avista = 'N' 
WHERE st_avista IS NULL;
