-- Migration: 20260601131000_add_cadastro_id_to_condutor.sql
-- Adiciona a coluna cadastro_id na tabela fiscal_mdf_condutor para relacionar motoristas a transportadores/parceiros

ALTER TABLE public.fiscal_mdf_condutor 
ADD COLUMN cadastro_id integer REFERENCES public.cadastro(cadastro_id) ON DELETE CASCADE;

-- Comentário explicativo na coluna
COMMENT ON COLUMN public.fiscal_mdf_condutor.cadastro_id IS 'ID do parceiro/cadastro de tipo Transportador associado a este motorista/condutor';
