INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.13.0',
  'Rotina de Liberação e Bloqueio de Pedidos',
  'Implementação da Rotina de Liberação e Bloqueio de Pedidos. Adicionados os campos bloquear_pedido em empresa, st_bloqueado em movimento, e campos de análise de crédito (bloqueia_cliente, vl_lim_credito, qt_tit_aberto, qt_tit_vencido) em cadastro. Atualizadas as views vw_pedidos_caixa_union e as RPCs fu_mudar_status_pedido_pdv e fu_pdv_registrar_recebimento_venda para suportar o bloqueio de vendas e análise de crédito automática. Desenvolvida a tela LiberacaoPedidosForm sob a aba Financeiro, fornecendo interface de liberação, painel de crédito e subgrade de contas a receber. Adicionado controle Switch bloquear_pedido no EmpresaForm.',
  'AI Antigravity - Gemini',
  'Fase 13',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'SQL/Migrations'],
  now()
);
