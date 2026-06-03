-- Migration: 20260601153000_rename_mdf_motorista_to_condutor.sql
-- Exclui a tabela fiscal_mdf_condutor antiga e renomeia a tabela fiscal_mdf_motorista para fiscal_mdf_condutor

-- 1. Remover triggers e funções antigas da fiscal_mdf_condutor
DROP TRIGGER IF EXISTS tg_set_condutor_id ON public.fiscal_mdf_condutor CASCADE;
DROP FUNCTION IF EXISTS public.fn_set_condutor_id() CASCADE;

-- 2. Excluir a tabela fiscal_mdf_condutor antiga
DROP TABLE IF EXISTS public.fiscal_mdf_condutor CASCADE;

-- 3. Renomear a tabela fiscal_mdf_motorista para fiscal_mdf_condutor
ALTER TABLE IF EXISTS public.fiscal_mdf_motorista RENAME TO fiscal_mdf_condutor;

-- 4. Ajustar as colunas e constraints na nova tabela fiscal_mdf_condutor
ALTER TABLE public.fiscal_mdf_condutor RENAME COLUMN mdf_motorista_id TO mdf_condutor_id;

-- Renomear constraints se existirem
ALTER TABLE public.fiscal_mdf_condutor RENAME CONSTRAINT mdf_motorista_pk TO mdf_condutor_pk;
ALTER TABLE public.fiscal_mdf_condutor RENAME CONSTRAINT mdf_motorista_pe TO mdf_condutor_pe;

-- 5. Adicionar a Foreign Key apontando para cadastro_motorista(motorista_id)
-- Limpar qualquer condutor_id órfão se houver dados de teste
DELETE FROM public.fiscal_mdf_condutor 
WHERE condutor_id NOT IN (SELECT motorista_id FROM public.cadastro_motorista);

ALTER TABLE public.fiscal_mdf_condutor
ADD CONSTRAINT fiscal_mdf_condutor_condutor_id_fkey 
FOREIGN KEY (condutor_id) REFERENCES public.cadastro_motorista(motorista_id) ON DELETE CASCADE;

-- 6. Garantir RLS e Políticas
ALTER TABLE public.fiscal_mdf_condutor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all_policy ON public.fiscal_mdf_condutor;
CREATE POLICY auth_all_policy ON public.fiscal_mdf_condutor TO authenticated USING (true) WITH CHECK (true);

-- 7. Registrar versão
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.9',
  'Reestruturação de Tabelas de Motoristas do MDF-e',
  'Excluída a tabela duplicada fiscal_mdf_condutor e renomeada a fiscal_mdf_motorista para fiscal_mdf_condutor, vinculando-a diretamente à tabela de cadastro_motorista.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Schema']
);
