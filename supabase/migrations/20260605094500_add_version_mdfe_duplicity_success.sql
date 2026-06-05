-- Migration: 20260605094500_add_version_mdfe_duplicity_success.sql
-- Registra a versão contendo o tratamento do código 631 (Duplicidade) no Encerramento de MDF-e no worker fiscal

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.20',
  'Tratamento de Duplicidade no Encerramento de MDF-e',
  'Implementado tratamento para duplicidade de encerramento no worker fiscal:' || chr(10) || chr(10) ||
  '• Tratamento de cStat 631: Adicionado o código de retorno 631 (Rejeição: Duplicidade de evento) como indicativo de sucesso no worker. Isso garante que, se um encerramento for enviado para um manifesto que já consta como encerrado na SEFAZ, o status local seja atualizado para Encerrado (E) sem gerar falhas visuais ou travamentos para o usuário.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['Node.js', 'ACBrLib', 'Supabase', 'PostgreSQL']
);
