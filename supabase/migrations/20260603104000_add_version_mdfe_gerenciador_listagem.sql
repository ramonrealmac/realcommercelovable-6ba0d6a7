-- Migration: 20260603104000_add_version_mdfe_gerenciador_listagem.sql
-- Registra a nova versão contendo a correção da listagem de manifestos no Gerenciador Fiscal

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.17',
  'Correção na Listagem do Gerenciador Fiscal de MDF-e',
  'Corrigido erro crítico que inviabilizava o carregamento do Gerenciador Fiscal de MDF-e:' || chr(10) || chr(10) ||
  '• Correção da Ordenação da Grid: Substituída a ordenação pela coluna inexistente created_at na tabela fiscal_mdf_manifesto por ordenação com base na chave primária mdf_manifesto_id em ordem decrescente, exibindo os manifestos mais recentes primeiro e de forma performática.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
