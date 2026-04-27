
-- PART 3: ENABLE RLS + POLICIES FOR ALL NEW TABLES

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cfop ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condicao_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corretora ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_baixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_icms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_ipi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_pis_cofins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_produto_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linha_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimento_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimento_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametro_horario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_item_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_pagamento_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plano_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_old ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rota ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subgrupo_produto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabela_preco ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_operacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_pag_rec ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES (DROP IF EXISTS + CREATE)
DO $$ BEGIN
  -- AUDITORIA
  DROP POLICY IF EXISTS "Auth can insert auditoria" ON public.auditoria;
  CREATE POLICY "Auth can insert auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

  -- BANCO
  DROP POLICY IF EXISTS "banco_auth" ON public.banco;
  CREATE POLICY "banco_auth" ON public.banco TO authenticated USING (true) WITH CHECK (true);

  -- CADASTRO
  DROP POLICY IF EXISTS "Auth can view cadastro" ON public.cadastro;
  CREATE POLICY "Auth can view cadastro" ON public.cadastro FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Staff can insert cadastro" ON public.cadastro;
  CREATE POLICY "Staff can insert cadastro" ON public.cadastro FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Staff can update cadastro" ON public.cadastro;
  CREATE POLICY "Staff can update cadastro" ON public.cadastro FOR UPDATE TO authenticated USING (true);

  -- CFOP
  DROP POLICY IF EXISTS "cfop_auth" ON public.cfop;
  CREATE POLICY "cfop_auth" ON public.cfop TO authenticated USING (true) WITH CHECK (true);

  -- CIDADE
  DROP POLICY IF EXISTS "cidade_auth" ON public.cidade;
  CREATE POLICY "cidade_auth" ON public.cidade TO authenticated USING (true) WITH CHECK (true);

  -- CLIENTE_OLD
  DROP POLICY IF EXISTS "Auth can view clientes" ON public.cliente_old;
  CREATE POLICY "Auth can view clientes" ON public.cliente_old FOR SELECT TO authenticated USING (true);

  -- COMISSAO
  DROP POLICY IF EXISTS "comissao_auth" ON public.comissao;
  CREATE POLICY "comissao_auth" ON public.comissao TO authenticated USING (true) WITH CHECK (true);

  -- CONDICAO_PAGAMENTO
  DROP POLICY IF EXISTS "condicao_pagamento_auth" ON public.condicao_pagamento;
  CREATE POLICY "condicao_pagamento_auth" ON public.condicao_pagamento TO authenticated USING (true) WITH CHECK (true);

  -- CORRETORA
  DROP POLICY IF EXISTS "corretora_auth" ON public.corretora;
  CREATE POLICY "corretora_auth" ON public.corretora TO authenticated USING (true) WITH CHECK (true);

  -- DEPOSITO
  DROP POLICY IF EXISTS "Auth can view deposito" ON public.deposito;
  CREATE POLICY "Auth can view deposito" ON public.deposito FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage deposito" ON public.deposito;
  CREATE POLICY "Auth can manage deposito" ON public.deposito FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- EMPRESA
  DROP POLICY IF EXISTS "Auth can view empresa" ON public.empresa;
  CREATE POLICY "Auth can view empresa" ON public.empresa FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage empresa" ON public.empresa;
  CREATE POLICY "Auth can manage empresa" ON public.empresa FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- ESTOQUE
  DROP POLICY IF EXISTS "Auth can view estoque" ON public.estoque;
  CREATE POLICY "Auth can view estoque" ON public.estoque FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can view estoque" ON public.estoque;
  CREATE POLICY "Anon can view estoque" ON public.estoque FOR SELECT TO anon USING (true);
  DROP POLICY IF EXISTS "Auth can manage estoque" ON public.estoque;
  CREATE POLICY "Auth can manage estoque" ON public.estoque FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- FINANCEIRO
  DROP POLICY IF EXISTS "Auth can view financeiro" ON public.financeiro;
  CREATE POLICY "Auth can view financeiro" ON public.financeiro FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage financeiro" ON public.financeiro;
  CREATE POLICY "Auth can manage financeiro" ON public.financeiro FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- FINANCEIRO_BAIXA
  DROP POLICY IF EXISTS "Auth can view financeiro_baixa" ON public.financeiro_baixa;
  CREATE POLICY "Auth can view financeiro_baixa" ON public.financeiro_baixa FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage financeiro_baixa" ON public.financeiro_baixa;
  CREATE POLICY "Auth can manage financeiro_baixa" ON public.financeiro_baixa FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- GRUPO_CADASTRO
  DROP POLICY IF EXISTS "Auth can view grupo_cadastro" ON public.grupo_cadastro;
  CREATE POLICY "Auth can view grupo_cadastro" ON public.grupo_cadastro FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage grupo_cadastro" ON public.grupo_cadastro;
  CREATE POLICY "Auth can manage grupo_cadastro" ON public.grupo_cadastro FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- GRUPO_ICMS
  DROP POLICY IF EXISTS "grupo_icms_auth" ON public.grupo_icms;
  CREATE POLICY "grupo_icms_auth" ON public.grupo_icms TO authenticated USING (true) WITH CHECK (true);

  -- GRUPO_IPI
  DROP POLICY IF EXISTS "grupo_ipi_auth" ON public.grupo_ipi;
  CREATE POLICY "grupo_ipi_auth" ON public.grupo_ipi TO authenticated USING (true) WITH CHECK (true);

  -- GRUPO_PIS_COFINS
  DROP POLICY IF EXISTS "grupo_pis_cofins_auth" ON public.grupo_pis_cofins;
  CREATE POLICY "grupo_pis_cofins_auth" ON public.grupo_pis_cofins TO authenticated USING (true) WITH CHECK (true);

  -- GRUPO_PRODUTO_OLD
  DROP POLICY IF EXISTS "Auth can view grupos" ON public.grupo_produto_old;
  CREATE POLICY "Auth can view grupos" ON public.grupo_produto_old FOR SELECT TO authenticated USING (true);

  -- LINHA_PRODUTO
  DROP POLICY IF EXISTS "linha_produto_auth" ON public.linha_produto;
  CREATE POLICY "linha_produto_auth" ON public.linha_produto TO authenticated USING (true) WITH CHECK (true);

  -- MOVIMENTO
  DROP POLICY IF EXISTS "Auth can view movimento" ON public.movimento;
  CREATE POLICY "Auth can view movimento" ON public.movimento FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert movimento" ON public.movimento;
  CREATE POLICY "Auth can insert movimento" ON public.movimento FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Auth can update movimento" ON public.movimento;
  CREATE POLICY "Auth can update movimento" ON public.movimento FOR UPDATE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can insert movimento link" ON public.movimento;
  CREATE POLICY "Anon can insert movimento link" ON public.movimento FOR INSERT TO anon WITH CHECK ((tp_origem)::text = 'LINK'::text);

  -- MOVIMENTO_ITEM
  DROP POLICY IF EXISTS "Auth can view mov_item" ON public.movimento_item;
  CREATE POLICY "Auth can view mov_item" ON public.movimento_item FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert mov_item" ON public.movimento_item;
  CREATE POLICY "Auth can insert mov_item" ON public.movimento_item FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Auth can update mov_item" ON public.movimento_item;
  CREATE POLICY "Auth can update mov_item" ON public.movimento_item FOR UPDATE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can delete mov_item" ON public.movimento_item;
  CREATE POLICY "Auth can delete mov_item" ON public.movimento_item FOR DELETE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can view mov_item link" ON public.movimento_item;
  CREATE POLICY "Anon can view mov_item link" ON public.movimento_item FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.movimento WHERE movimento.movimento_id = movimento_item.movimento_id AND (movimento.tp_origem)::text = 'LINK'::text));
  DROP POLICY IF EXISTS "Anon can insert mov_item link" ON public.movimento_item;
  CREATE POLICY "Anon can insert mov_item link" ON public.movimento_item FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.movimento WHERE movimento.movimento_id = movimento_item.movimento_id AND (movimento.tp_origem)::text = 'LINK'::text));

  -- MOVIMENTO_PAGAMENTO
  DROP POLICY IF EXISTS "Auth can view mov_pgto" ON public.movimento_pagamento;
  CREATE POLICY "Auth can view mov_pgto" ON public.movimento_pagamento FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert mov_pgto" ON public.movimento_pagamento;
  CREATE POLICY "Auth can insert mov_pgto" ON public.movimento_pagamento FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Anon can view mov_pgto link" ON public.movimento_pagamento;
  CREATE POLICY "Anon can view mov_pgto link" ON public.movimento_pagamento FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.movimento WHERE movimento.movimento_id = movimento_pagamento.movimento_id AND (movimento.tp_origem)::text = 'LINK'::text));
  DROP POLICY IF EXISTS "Anon can insert mov_pgto link" ON public.movimento_pagamento;
  CREATE POLICY "Anon can insert mov_pgto link" ON public.movimento_pagamento FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.movimento WHERE movimento.movimento_id = movimento_pagamento.movimento_id AND (movimento.tp_origem)::text = 'LINK'::text));

  -- PARAMETRO_HORARIO
  DROP POLICY IF EXISTS "Anyone can view horarios" ON public.parametro_horario;
  CREATE POLICY "Anyone can view horarios" ON public.parametro_horario FOR SELECT USING (true);

  -- PEDIDO_OLD
  DROP POLICY IF EXISTS "Auth can view pedidos" ON public.pedido_old;
  CREATE POLICY "Auth can view pedidos" ON public.pedido_old FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert pedidos" ON public.pedido_old;
  CREATE POLICY "Auth can insert pedidos" ON public.pedido_old FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Auth can update pedidos" ON public.pedido_old;
  CREATE POLICY "Auth can update pedidos" ON public.pedido_old FOR UPDATE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can insert pedidos link" ON public.pedido_old;
  CREATE POLICY "Anon can insert pedidos link" ON public.pedido_old FOR INSERT TO anon WITH CHECK (xtipo_origem_pedido = 'LINK'::text);

  -- PEDIDO_ITEM_OLD
  DROP POLICY IF EXISTS "Auth can view items" ON public.pedido_item_old;
  CREATE POLICY "Auth can view items" ON public.pedido_item_old FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert items" ON public.pedido_item_old;
  CREATE POLICY "Auth can insert items" ON public.pedido_item_old FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Auth can update items" ON public.pedido_item_old;
  CREATE POLICY "Auth can update items" ON public.pedido_item_old FOR UPDATE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can delete items" ON public.pedido_item_old;
  CREATE POLICY "Auth can delete items" ON public.pedido_item_old FOR DELETE TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can view items linked orders" ON public.pedido_item_old;
  CREATE POLICY "Anon can view items linked orders" ON public.pedido_item_old FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.pedido_old WHERE pedido_old.id = pedido_item_old.xpedido_id AND pedido_old.xtipo_origem_pedido = 'LINK'::text));
  DROP POLICY IF EXISTS "Anon can insert items linked orders" ON public.pedido_item_old;
  CREATE POLICY "Anon can insert items linked orders" ON public.pedido_item_old FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.pedido_old WHERE pedido_old.id = pedido_item_old.xpedido_id AND pedido_old.xtipo_origem_pedido = 'LINK'::text));

  -- PEDIDO_PAGAMENTO_OLD
  DROP POLICY IF EXISTS "Auth can view pagamentos" ON public.pedido_pagamento_old;
  CREATE POLICY "Auth can view pagamentos" ON public.pedido_pagamento_old FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can insert pagamentos" ON public.pedido_pagamento_old;
  CREATE POLICY "Auth can insert pagamentos" ON public.pedido_pagamento_old FOR INSERT TO authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "Anon can view pagamentos linked orders" ON public.pedido_pagamento_old;
  CREATE POLICY "Anon can view pagamentos linked orders" ON public.pedido_pagamento_old FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.pedido_old WHERE pedido_old.id = pedido_pagamento_old.xpedido_id AND pedido_old.xtipo_origem_pedido = 'LINK'::text));
  DROP POLICY IF EXISTS "Anon can insert pagamentos linked orders" ON public.pedido_pagamento_old;
  CREATE POLICY "Anon can insert pagamentos linked orders" ON public.pedido_pagamento_old FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM public.pedido_old WHERE pedido_old.id = pedido_pagamento_old.xpedido_id AND pedido_old.xtipo_origem_pedido = 'LINK'::text));

  -- PLANO_CONTA
  DROP POLICY IF EXISTS "plano_conta_auth" ON public.plano_conta;
  CREATE POLICY "plano_conta_auth" ON public.plano_conta TO authenticated USING (true) WITH CHECK (true);

  -- PORTADOR
  DROP POLICY IF EXISTS "portador_auth" ON public.portador;
  CREATE POLICY "portador_auth" ON public.portador TO authenticated USING (true) WITH CHECK (true);

  -- PRODUTO
  DROP POLICY IF EXISTS "Auth can view produto" ON public.produto;
  CREATE POLICY "Auth can view produto" ON public.produto FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can view produto online" ON public.produto;
  CREATE POLICY "Anon can view produto online" ON public.produto FOR SELECT TO anon USING (venda_online = true AND excluido = false);
  DROP POLICY IF EXISTS "Auth can manage produto" ON public.produto;
  CREATE POLICY "Auth can manage produto" ON public.produto FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- PRODUTO_GRUPO
  DROP POLICY IF EXISTS "Auth can view produto_grupo" ON public.produto_grupo;
  CREATE POLICY "Auth can view produto_grupo" ON public.produto_grupo FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Auth can manage produto_grupo" ON public.produto_grupo;
  CREATE POLICY "Auth can manage produto_grupo" ON public.produto_grupo FOR ALL TO authenticated USING (true) WITH CHECK (true);

  -- PRODUTO_OLD
  DROP POLICY IF EXISTS "Auth can view produtos" ON public.produto_old;
  CREATE POLICY "Auth can view produtos" ON public.produto_old FOR SELECT TO authenticated USING (true);
  DROP POLICY IF EXISTS "Anon can view produtos online" ON public.produto_old;
  CREATE POLICY "Anon can view produtos online" ON public.produto_old FOR SELECT TO anon USING (xlg_venda_online = true AND excluido = false);

  -- ROTA
  DROP POLICY IF EXISTS "rota_auth" ON public.rota;
  CREATE POLICY "rota_auth" ON public.rota TO authenticated USING (true) WITH CHECK (true);

  -- SUBGRUPO_PRODUTO
  DROP POLICY IF EXISTS "subgrupo_produto_auth" ON public.subgrupo_produto;
  CREATE POLICY "subgrupo_produto_auth" ON public.subgrupo_produto TO authenticated USING (true) WITH CHECK (true);

  -- TABELA_PRECO
  DROP POLICY IF EXISTS "tabela_preco_auth" ON public.tabela_preco;
  CREATE POLICY "tabela_preco_auth" ON public.tabela_preco TO authenticated USING (true) WITH CHECK (true);

  -- TIPO_CADASTRO
  DROP POLICY IF EXISTS "tipo_cadastro_auth" ON public.tipo_cadastro;
  CREATE POLICY "tipo_cadastro_auth" ON public.tipo_cadastro TO authenticated USING (true) WITH CHECK (true);

  -- TIPO_OPERACAO
  DROP POLICY IF EXISTS "tipo_operacao_auth" ON public.tipo_operacao;
  CREATE POLICY "tipo_operacao_auth" ON public.tipo_operacao TO authenticated USING (true) WITH CHECK (true);

  -- TIPO_PAG_REC
  DROP POLICY IF EXISTS "tipo_pag_rec_auth" ON public.tipo_pag_rec;
  CREATE POLICY "tipo_pag_rec_auth" ON public.tipo_pag_rec TO authenticated USING (true) WITH CHECK (true);

  -- UNIDADE
  DROP POLICY IF EXISTS "unidade_auth" ON public.unidade;
  CREATE POLICY "unidade_auth" ON public.unidade TO authenticated USING (true) WITH CHECK (true);

  -- VEICULO
  DROP POLICY IF EXISTS "veiculo_auth" ON public.veiculo;
  CREATE POLICY "veiculo_auth" ON public.veiculo TO authenticated USING (true) WITH CHECK (true);
END $$;
