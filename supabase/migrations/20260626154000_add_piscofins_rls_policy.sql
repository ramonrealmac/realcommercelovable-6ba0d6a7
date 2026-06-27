-- Migration: 20260626154000_add_piscofins_rls_policy.sql
-- Description: Habilita RLS e cria política de leitura para a tabela public.piscofins, e registra a versão 1.18.8 do sistema

-- 1. RLS e Políticas para a tabela public.piscofins
ALTER TABLE public.piscofins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS piscofins_select_public ON public.piscofins;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'piscofins' AND policyname = 'piscofins_select_public'
  ) THEN
    CREATE POLICY piscofins_select_public ON public.piscofins 
    FOR SELECT TO public USING (true);
  END IF;
END $$;

-- 2. Registro da Versão 1.18.8
DELETE FROM public.sistema_versoes WHERE versao = '1.18.8';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.8',
  'Políticas de RLS para PIS/COFINS e Combo CST PIS/COFINS',
  'Adicionada a política de leitura (SELECT) na tabela public.piscofins para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST PIS e COFINS nas abas PIS e COFINS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);
