-- Migration: 20260605112500_auto_generate_cd_produto_grupo.sql
-- Auto-geração de cd_produto_grupo para novos registros quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_cd_produto_grupo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_produto_grupo IS NULL THEN
    SELECT COALESCE(MAX(cd_produto_grupo), 0) + 1
    INTO NEW.cd_produto_grupo
    FROM public.produto_grupo
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_produto_grupo ON public.produto_grupo;
CREATE TRIGGER tg_set_cd_produto_grupo
BEFORE INSERT ON public.produto_grupo
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_produto_grupo();


-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.18',
  'Auto-geração de Códigos de Grupo de Produto',
  'Implementada a auto-geração automática de códigos de grupo de produto (cd_produto_grupo) por empresa quando novos registros são inseridos sem valor explícito na interface.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
