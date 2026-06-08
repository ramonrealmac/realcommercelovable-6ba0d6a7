-- Migration: 20260605085000_add_version_mdfe_cancellation_and_close_actions.sql
-- Registra a versão contendo a remoção dos botões do cadastro, adição da opção de cancelamento e melhorias no encerramento de MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.18',
  'Melhorias no Fluxo de MDF-e: Cancelamento, Encerramento e Cores de Status',
  'Implementado melhorias na experiência de gerenciamento de MDF-e:' || chr(10) || chr(10) ||
  '• Remoção de Botões no Cadastro: Removido os botões de Encerrar e Cancelar da tela de cadastramento para evitar duplicidade de fluxos.' || chr(10) ||
  '• Opção de Cancelamento no Gerenciador: Adicionado a opção Cancelar MDF-e no menu de opções do gerenciador, habilitada somente para manifestos autorizados e com fluxo de justificativa mínima de 15 caracteres.' || chr(10) ||
  '• Autopreenchimento de Encerramento: Atualizada a tela de encerramento para carregar automaticamente a UF e o código IBGE com base na cidade de descarregamento vinculada ao manifesto, mantendo os campos editáveis.' || chr(10) ||
  '• Cores de Status: Atualizado o padrão visual do status Encerrado de roxo para azul no gerenciador e formulário.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
