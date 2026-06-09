-- Migration: 20260605111000_auto_generate_cd_produto.sql
-- Auto-geração de cd_produto para novos registros quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_cd_produto()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_produto IS NULL THEN
    SELECT COALESCE(MAX(cd_produto), 0) + 1
    INTO NEW.cd_produto
    FROM public.produto
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_produto ON public.produto;
CREATE TRIGGER tg_set_cd_produto
BEFORE INSERT ON public.produto
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_produto();


-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.17',
  'Auto-geração de Códigos de Produto',
  'Implementada a auto-geração automática de códigos de produto (cd_produto) por empresa quando novos registros são inseridos sem valor explícito na interface.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
