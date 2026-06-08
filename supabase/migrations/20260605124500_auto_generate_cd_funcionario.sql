-- Migration: 20260605124500_auto_generate_cd_funcionario.sql
-- Auto-geração e constraint de unicidade para cd_funcionario

-- 1. Atualiza registros legados com cd_funcionario nulo para o próprio funcionario_id
UPDATE public.funcionario
SET cd_funcionario = funcionario_id
WHERE cd_funcionario IS NULL;

-- 2. Cria restrição de unicidade composta por empresa
ALTER TABLE public.funcionario
ADD CONSTRAINT uq_funcionario_empresa_codigo UNIQUE (empresa_id, cd_funcionario);

-- 3. Função trigger para autogeração
CREATE OR REPLACE FUNCTION public.fn_set_cd_funcionario()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_funcionario IS NULL OR NEW.cd_funcionario = 0 THEN
    SELECT COALESCE(MAX(cd_funcionario), 0) + 1
    INTO NEW.cd_funcionario
    FROM public.funcionario
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Associa o trigger BEFORE INSERT
DROP TRIGGER IF EXISTS tg_set_cd_funcionario ON public.funcionario;
CREATE TRIGGER tg_set_cd_funcionario
BEFORE INSERT ON public.funcionario
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_funcionario();

-- 5. Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.21',
  'Auto-geração de Códigos de Funcionários',
  'Implementada a autogeração automática de cd_funcionario por empresa e adicionada restrição de unicidade uq_funcionario_empresa_codigo.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers', 'Constraints']
);
