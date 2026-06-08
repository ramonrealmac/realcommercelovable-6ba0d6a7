-- Migration: 20260605115900_auto_generate_cd_linha.sql
-- Auto-geração de cd_linha para novos registros quando nulos

CREATE OR REPLACE FUNCTION public.fn_set_cd_linha()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cd_linha IS NULL THEN
    SELECT COALESCE(MAX(cd_linha), 0) + 1
    INTO NEW.cd_linha
    FROM public.linha_produto
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_set_cd_linha ON public.linha_produto;
CREATE TRIGGER tg_set_cd_linha
BEFORE INSERT ON public.linha_produto
FOR EACH ROW
EXECUTE FUNCTION public.fn_set_cd_linha();


-- Insere registro da nova versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.20',
  'Auto-geração de Códigos de Linha de Produto',
  'Implementada a auto-geração automática de códigos de linha de produto (cd_linha) por empresa quando novos registros são inseridos sem valor explícito na interface.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Triggers']
);
