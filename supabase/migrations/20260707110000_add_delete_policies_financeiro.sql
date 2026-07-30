-- Migration: 20260707110000_add_delete_policies_financeiro.sql
-- Description: Creates DELETE policies for public.financeiro and public.financeiro_baixa, and registers system version 1.18.21.

-- 1. Criação das Políticas de Exclusão (DDL)
DROP POLICY IF EXISTS "Users delete financeiro of own empresa" ON public.financeiro;
CREATE POLICY "Users delete financeiro of own empresa" ON public.financeiro
  FOR DELETE
  TO authenticated
  USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));

DROP POLICY IF EXISTS "Users delete financeiro_baixa of own empresa" ON public.financeiro_baixa;
CREATE POLICY "Users delete financeiro_baixa of own empresa" ON public.financeiro_baixa
  FOR DELETE
  TO authenticated
  USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));

-- 2. Registro da Versão 1.18.21 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.21';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.21',
  'Políticas de Exclusão no Financeiro e RLS Fix',
  'Ajustes de segurança e de controle RLS no banco de dados para evitar acúmulo de parcelas no pedido:' || chr(10) || chr(10) ||
  '• Políticas de Exclusão RLS: Criação das políticas para permitir operações de exclusão (DELETE) nas tabelas public.financeiro e public.financeiro_baixa para usuários autenticados da mesma empresa.' || chr(10) ||
  '• Correção de Duplicidades: Correção do fluxo de renegociação de pagamentos, garantindo que parcelas anteriores sejam limpas e substituídas com sucesso.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
