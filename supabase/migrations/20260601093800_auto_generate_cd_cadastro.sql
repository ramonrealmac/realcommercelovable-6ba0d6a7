-- Migration: 20260601093800_auto_generate_cd_cadastro.sql
-- Auto-geração de cd_cadastro e cd_cadastro_grupo para novos registros quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_cd_cadastro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_cadastro IS NULL THEN
    SELECT COALESCE(MAX(cd_cadastro), 0) + 1
    INTO NEW.cd_cadastro
    FROM public.cadastro
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_cadastro ON public.cadastro;
CREATE TRIGGER tg_set_cd_cadastro
BEFORE INSERT ON public.cadastro
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_cadastro();


CREATE OR REPLACE FUNCTION public.fn_set_cd_cadastro_grupo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_cadastro_grupo IS NULL THEN
    SELECT COALESCE(MAX(cd_cadastro_grupo), 0) + 1
    INTO NEW.cd_cadastro_grupo
    FROM public.cadastro_grupo
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_cadastro_grupo ON public.cadastro_grupo;
CREATE TRIGGER tg_set_cd_cadastro_grupo
BEFORE INSERT ON public.cadastro_grupo
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_cadastro_grupo();


-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.5',
  'Auto-geração de Códigos de Cadastro',
  'Implementada a auto-geração automática de códigos únicos (cd_cadastro e cd_cadastro_grupo) por empresa quando novos registros são inseridos sem valor explícito. Isso resolve o erro de violação de not-null constraint ao salvar novos fornecedores, transportadores, clientes e grupos de cadastro via interface.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
