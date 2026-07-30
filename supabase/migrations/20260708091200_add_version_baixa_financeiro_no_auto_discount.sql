-- Migration: 20260708091200_add_version_baixa_financeiro_no_auto_discount.sql
-- Description: Registers version 1.18.30 for the adjustment in Contas a Receber Baixa which prevents auto-discount from zeroing out the outstanding balance on partial payments.

-- 1. Registro da Versão 1.18.30 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.30';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.30',
  'Baixa de Contas a Receber - Ajuste de Pagamento Parcial',
  'Ajustada a rotina de recebimento de títulos (baixa) para que pagamentos de valores menores que o saldo pendente (pagamentos parciais) não calculem desconto automático nem zerem o saldo a pagar, permitindo o controle de saldo devedor restante.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
