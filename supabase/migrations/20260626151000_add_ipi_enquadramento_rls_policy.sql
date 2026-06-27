-- Migration: 20260626151000_add_ipi_enquadramento_rls_policy.sql
-- Description: Habilita RLS e cria política de leitura para a tabela public.ipi_enquadramento, e registra a versão 1.18.7 do sistema

-- 1. RLS e Políticas para a tabela public.ipi_enquadramento
ALTER TABLE public.ipi_enquadramento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipi_enquadramento_select_public ON public.ipi_enquadramento;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ipi_enquadramento' AND policyname = 'ipi_enquadramento_select_public'
  ) THEN
    CREATE POLICY ipi_enquadramento_select_public ON public.ipi_enquadramento 
    FOR SELECT TO public USING (true);
  END IF;
END $$;

-- 2. Registro da Versão 1.18.7
DELETE FROM public.sistema_versoes WHERE versao = '1.18.7';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.7',
  'Políticas de RLS para Enquadramento do IPI e Combo c. enquadramento',
  'Adicionada a política de leitura (SELECT) na tabela public.ipi_enquadramento para usuários públicos/autenticados, e configurado o combo box para carregar códigos de Enquadramento do IPI na aba IPI da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);
