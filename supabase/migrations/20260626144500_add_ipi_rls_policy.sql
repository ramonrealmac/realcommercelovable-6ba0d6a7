-- Migration: 20260626144500_add_ipi_rls_policy.sql
-- Description: Habilita RLS e cria política de leitura para a tabela public.ipi, e registra a versão 1.18.6 do sistema

-- 1. RLS e Políticas para a tabela public.ipi
ALTER TABLE public.ipi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipi_select_public ON public.ipi;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ipi' AND policyname = 'ipi_select_public'
  ) THEN
    CREATE POLICY ipi_select_public ON public.ipi 
    FOR SELECT TO public USING (true);
  END IF;
END $$;

-- 2. Registro da Versão 1.18.6
DELETE FROM public.sistema_versoes WHERE versao = '1.18.6';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.6',
  'Políticas de RLS para IPI e Combo CST IPI',
  'Adicionada a política de leitura (SELECT) na tabela public.ipi para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST IPI na aba IPI da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);
