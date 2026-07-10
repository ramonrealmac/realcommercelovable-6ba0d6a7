-- Migration: 20260707160000_add_version_financeiro_baixa_accumulation.sql
-- Description: Registers version 1.18.27 for financeiro discount/interest accumulation and account plan clearance on Estorno.

-- 1. Registro da Versão 1.18.27 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.27';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.27',
  'Consulta de Títulos - Acúmulo de Valores e Limpeza no Estorno',
  'Aprimoramentos de conformidade financeira e correção nas rotinas de baixa e estorno:' || chr(10) || chr(10) ||
  '• Acúmulo de Valores na Baixa: A baixa de título passa a acumular e atualizar os campos vl_pago, vl_desconto e vl_adicional (juros) diretamente no registro da tabela financeiro. Com isso, a visualização de saldo (vl_a_pagar) da view é calculada corretamente.' || chr(10) ||
  '• Limpeza Completa no Estorno: O comando de estornar título foi aprimorado para, além de zerar o valor pago, limpar a associação do plano de contas (definindo plano_id e planoconta_id como 0).',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
