-- Migration: Update bandeira table
-- Set empresa_id = 5 for all existing rows and normalize descricao to uppercase

-- 1. Update empresa_id for all existing bandeira rows
UPDATE public.bandeira
SET empresa_id = 5
WHERE empresa_id IS NULL OR empresa_id <> 5;

-- 2. Normalize descricao to uppercase
UPDATE public.bandeira
SET descricao = UPPER(descricao)
WHERE descricao IS NOT NULL AND descricao <> UPPER(descricao);
