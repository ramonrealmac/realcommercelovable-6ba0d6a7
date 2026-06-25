-- Migration: 20260625094900_add_version_caixa_pdv_adjustments.sql
-- Registra a versão 1.18.2 com as melhorias de Abertura de Caixa Automática e Exclusão imediata de pagamentos

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.2',
  'Abertura de Caixa Automática e Exclusão de Pagamentos',
  'Implementado o redirecionamento automático e login transparente (sem flash visual) para a tela de PDV/Caixa após abertura de caixa, e a exclusão lógica imediata com confirmação e rollback na lixeira de pagamentos do pedido.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'PostgreSQL', 'Supabase']
)
ON CONFLICT DO NOTHING;
