-- Migration: 20260605114000_auto_generate_cd_produto_subgrupo.sql
-- Auto-geração de cd_produto_subgrupo para novos registros quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_cd_produto_subgrupo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_produto_subgrupo IS NULL THEN
    SELECT COALESCE(MAX(cd_produto_subgrupo), 0) + 1
    INTO NEW.cd_produto_subgrupo
    FROM public.produto_subgrupo
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_produto_subgrupo ON public.produto_subgrupo;
CREATE TRIGGER tg_set_cd_produto_subgrupo
BEFORE INSERT ON public.produto_subgrupo
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_produto_subgrupo();


-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.19',
  'Auto-geração de Códigos de Subgrupo de Produto',
  'Implementada a auto-geração automática de códigos de subgrupo de produto (cd_produto_subgrupo) por empresa quando novos registros são inseridos sem valor explícito na interface.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
