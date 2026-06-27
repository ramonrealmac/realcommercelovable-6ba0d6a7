-- Migration: 20260626161500_add_ibscbs_rls_policy.sql
-- Description: Habilita RLS e cria política de leitura para a tabela public.ibscbs, e registra a versão 1.18.9 do sistema

-- 1. RLS e Políticas para a tabela public.ibscbs
ALTER TABLE public.ibscbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ibscbs_select_public ON public.ibscbs;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ibscbs' AND policyname = 'ibscbs_select_public'
  ) THEN
    CREATE POLICY ibscbs_select_public ON public.ibscbs 
    FOR SELECT TO public USING (true);
  END IF;
END $$;

-- 2. Registro da Versão 1.18.9
DELETE FROM public.sistema_versoes WHERE versao = '1.18.9';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.9',
  'Políticas de RLS para IBS/CBS e Combo CST IBS/CBS',
  'Adicionada a política de leitura (SELECT) na tabela public.ibscbs para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST IBS e CBS na aba CBS/IBS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);
