-- Migration: 20261008180500_update_piscofins_uppercase.sql
-- Description: Adiciona política de UPDATE/ALL para a tabela piscofins e converte todas as descrições para maiúsculo (UPPERCASE)

-- 1. Garante política de acesso para UPDATE/INSERT/DELETE na tabela piscofins
DROP POLICY IF EXISTS piscofins_all_policy ON public.piscofins;

CREATE POLICY piscofins_all_policy ON public.piscofins
FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. Atualiza todas as descrições existentes para maiúsculas (UPPERCASE)
UPDATE public.piscofins
SET piscofins_descricao = UPPER(piscofins_descricao)
WHERE piscofins_descricao IS NOT NULL;
