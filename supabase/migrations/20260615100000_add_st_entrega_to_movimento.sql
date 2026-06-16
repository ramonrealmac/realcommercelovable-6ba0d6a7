-- Adiciona coluna st_entrega na tabela movimento
ALTER TABLE public.movimento ADD COLUMN IF NOT EXISTS st_entrega character varying(1) DEFAULT 'N';

-- Adiciona a restrição CHECK para os valores permitidos (S = Sim, N = Não, P = Parcial)
ALTER TABLE public.movimento DROP CONSTRAINT IF EXISTS check_st_entrega;
ALTER TABLE public.movimento ADD CONSTRAINT check_st_entrega CHECK (st_entrega IN ('S', 'N', 'P'));
