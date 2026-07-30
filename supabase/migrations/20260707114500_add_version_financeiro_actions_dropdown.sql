-- Migration: 20260707114500_add_version_financeiro_actions_dropdown.sql
-- Description: Registers version 1.18.22 for financeiro actions dropdown (Baixar, Estornar, Cancelar) and double confirmation flows.

-- 1. Registro da Versão 1.18.22 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.22';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.22',
  'Consulta de Títulos - Menu de Ações e Operações',
  'Refatoração das operações da tela de Consulta de Títulos a Receber:' || chr(10) || chr(10) ||
  '• Nova Coluna Ações: Substituição do ícone de visualizar (olho) no início da grid por um menu dropdown de "Opções" ao final (após Situação).' || chr(10) ||
  '• Operações Assistidas: Implementação das funções de Baixar (com preenchimento de portador, plano, juros, desconto e data), Estornar (deletando baixas vinculadas) e Cancelar.' || chr(10) ||
  '• Confirmação Dupla: Inserção do fluxo de dupla confirmação ("Deseja realmente realizar esta ação?") que permite cancelar a operação ou prosseguir com a gravação segura no banco.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
