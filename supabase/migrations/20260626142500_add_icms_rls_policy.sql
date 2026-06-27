-- Migration: 20260626142500_add_icms_rls_policy.sql
-- Description: Habilita RLS e cria política de leitura para a tabela public.icms, e registra a versão 1.18.5 do sistema

-- 1. RLS e Políticas para a tabela public.icms
ALTER TABLE public.icms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS icms_select_authenticated ON public.icms;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'icms' AND policyname = 'icms_select_public'
  ) THEN
    CREATE POLICY icms_select_public ON public.icms 
    FOR SELECT TO public USING (true);
  END IF;
END $$;

-- 2. Registro da Versão 1.18.5
DELETE FROM public.sistema_versoes WHERE versao = '1.18.5';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.5',
  'Políticas de RLS para ICMS e Correção do Combo CST/CSOSN',
  'Adicionada a política de leitura (SELECT) na tabela public.icms para usuários autenticados, permitindo o carregamento dos códigos CST/CSOSN na aba ICMS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);
