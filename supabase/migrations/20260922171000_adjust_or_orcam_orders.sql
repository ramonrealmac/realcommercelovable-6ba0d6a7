-- Migration: Adjust tp_operacao and movimento for ORCAMENTO (OR) and withdraw from caixa
-- 1. Atualizar tp_operacao com descrição contendo ORCAMENTO para tp_movimento = 'OR'
UPDATE public.tp_operacao
SET tp_movimento = 'OR',
    dt_alteracao = NOW()
WHERE unaccent(UPPER(descricao)) ILIKE '%ORCAMENTO%' OR tp_movimento = 'OR';

-- 2. Atualizar os pedidos (movimento) vinculados a tipos de operação ORCAMENTO/OR para tp_movimento = 'OR'
UPDATE public.movimento m
SET tp_movimento = 'OR',
    dt_alteracao = NOW()
FROM public.tp_operacao t
WHERE m.tp_operacao_id = t.tp_operacao_id
  AND (unaccent(UPPER(t.descricao)) ILIKE '%ORCAMENTO%' OR t.tp_movimento = 'OR' OR m.tp_movimento = 'OR')
  AND (m.tp_movimento IS NULL OR m.tp_movimento <> 'OR');

-- 3. Retirar do caixa os pedidos com tp_movimento = 'OR' que atualmente estejam com status no caixa (st_pedido = 'F')
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT m.movimento_id
        FROM public.movimento m
        JOIN public.tp_operacao t ON t.tp_operacao_id = m.tp_operacao_id
        WHERE (unaccent(UPPER(t.descricao)) ILIKE '%ORCAMENTO%' OR t.tp_movimento = 'OR' OR m.tp_movimento = 'OR')
          AND m.st_pedido = 'F'
          AND m.excluido = false
    LOOP
        PERFORM public.fu_mudar_status_pedido_pdv(r.movimento_id, 'O', NULL);
    END LOOP;
END $$;
