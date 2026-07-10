-- Migration: 20260707104500_add_version_order_payment_updates.sql
-- Description: Registers version 1.18.19 for dynamic portador filtering, selective finance installments generation, and codebase clean up.

-- 1. Registro da Versão 1.18.19 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.19';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.19',
  'Filtro de Portador e Geração Seletiva de Contas a Receber',
  'Implementação de melhorias e validações na tela de Condições de Pagamento do Pedido:' || chr(10) || chr(10) ||
  '• Filtragem Dinâmica de Portadores: A combo de seleção de portadores limita as opções exibidas com base na forma de pagamento selecionada (meio_pagamento_id). Para formas em Dinheiro/Crediário/Duplicata/Posterior (1, 5, 14, 91), exibe portadores sem banco vinculados (banco_id nulo/0, ex: Carteira); para formas em Banco/Cartão/Pix (3, 4, 15, 16, 17, 20), exibe apenas portadores com banco e conta associados; caso contrário, exibe todos.' || chr(10) ||
  '• Geração Seletiva no Financeiro: O processamento de parcelas em public.financeiro (tp_conta = ''R'', status = ''A'') é realizado estritamente para meios de pagamento a prazo/futuros (03 - Cartão de Crédito, 05 - Crediário, 14 - Duplicata, 15 - Boleto, 91 - Posterior). Pagamentos imediatos (Dinheiro, Débito e Pix) registram no pedido mas não geram lançamentos de Contas a Receber em aberto.' || chr(10) ||
  '• Qualidade e Refatoração: Remoção de lints de TypeScript/ESLint (conversão de tipos explicitamente banidos ''any'' para interfaces de tipos estritos) nos componentes PedidoPagamentoTab.tsx e PedidoPagamentoDialog.tsx.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
