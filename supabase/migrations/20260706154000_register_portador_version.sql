-- Migration: 20260706154000_register_portador_version.sql
-- Description: Registers version 1.18.14 for Portadores Form implementation.

-- Registro da Versão 1.18.14 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.14';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.14',
  'Tela de Cadastro de Portadores e Vinculação Financeira',
  'Desenvolvimento da tela de Portadores (PortadorForm.tsx) alinhada ao design premium de Contas Bancárias. Integração do campo Código (auto-incrementado no insert) e Empresa na mesma linha. Vinculação dinâmica de Bancos (banco_id) e Contas Bancárias (conta_id) via dropdowns select nativos do HTML. Navegação por teclado utilizando a tecla Enter e preenchimento de metadados dt_cadastro (fuso local de Brasília) e excluido (false) para conformidade com RLS.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
