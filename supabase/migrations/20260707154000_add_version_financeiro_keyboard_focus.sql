-- Migration: 20260707154000_add_version_financeiro_keyboard_focus.sql
-- Description: Registers version 1.18.24 for financeiro action footer order, enter focus shifting, and success alert OK dialog.

-- 1. Registro da Versão 1.18.24 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.24';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.24',
  'Consulta de Títulos - Navegação e Fluxo de Teclado',
  'Melhorias no fluxo e navegação por teclado nos modais operacionais da Consulta de Títulos:' || chr(10) || chr(10) ||
  '• Ordem dos Botões: Reordenação dos botões de rodapé para posicionar primeiro a confirmação (ex: Confirmar Baixa) e depois o Cancelamento.' || chr(10) ||
  '• Foco no Plano de Contas: Pressionar Enter na combo do plano de contas move automaticamente o foco do teclado para o botão de confirmação.' || chr(10) ||
  '• Sucesso e Recarga Grid: Substituição do toast temporário por um modal de sucesso centralizado com botão OK auto-focado (pressionar Enter executa a gravação, recarrega a grid e volta para a tela de consulta).',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
