-- Migration: 20260601144500_auto_generate_condutor_id.sql
-- Auto-geração de condutor_id para novos registros de condutores de MDF-e quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_condutor_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.condutor_id IS NULL OR NEW.condutor_id = 0 THEN
    SELECT COALESCE(MAX(condutor_id), 0) + 1
    INTO NEW.condutor_id
    FROM public.fiscal_mdf_condutor
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_condutor_id ON public.fiscal_mdf_condutor;
CREATE TRIGGER tg_set_condutor_id
BEFORE INSERT ON public.fiscal_mdf_condutor
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_condutor_id();

-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.8',
  'Auto-geração de ID do Condutor no MDF-e',
  'Implementada a auto-geração automática do condutor_id por empresa na tabela fiscal_mdf_condutor através de trigger BEFORE INSERT quando novos registros são inseridos. Isso corrige a falha de violação de not-null constraint ao salvar novos motoristas/condutores na tela de Cadastramento do MDF-e.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
