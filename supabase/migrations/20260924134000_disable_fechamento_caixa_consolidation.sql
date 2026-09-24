-- Migration: 20260924134000_disable_fechamento_caixa_consolidation.sql
-- Descrição: Remove a consolidação por fechamento de caixa (origem 'C') conforme regra de negócio, mantendo a consolidação por recebimento/estorno/cancelamento (origens 'V', 'E', 'P', 'R').

-- 1. Remove o trigger tg_caixa_abertura_consolidacao da tabela caixa_abertura
DROP TRIGGER IF EXISTS tg_caixa_abertura_consolidacao ON public.caixa_abertura;

-- 2. Limpa lançamentos antigos de fechamento acumulado (origem = 'C') do financeiro_consolidado
DELETE FROM public.financeiro_consolidado WHERE origem = 'C';

-- 3. Atualiza a função fu_caixa_abertura_consolidacao para No-Operation (sem efeito)
CREATE OR REPLACE FUNCTION public.fu_caixa_abertura_consolidacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN NEW;
END;
$$;
