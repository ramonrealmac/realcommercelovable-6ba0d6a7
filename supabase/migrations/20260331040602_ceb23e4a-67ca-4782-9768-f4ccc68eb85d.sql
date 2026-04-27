
-- PART 4: FOREIGN KEYS (using DO blocks to skip if already exist)

DO $$ BEGIN
  ALTER TABLE public.banco ADD CONSTRAINT banco_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cadastro ADD CONSTRAINT cadastro_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cfop ADD CONSTRAINT cfop_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cidade ADD CONSTRAINT cidade_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.comissao ADD CONSTRAINT comissao_cadastro_id_fkey FOREIGN KEY (cadastro_id) REFERENCES public.cadastro(cadastro_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.comissao ADD CONSTRAINT comissao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.condicao_pagamento ADD CONSTRAINT condicao_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.corretora ADD CONSTRAINT corretora_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.deposito ADD CONSTRAINT deposito_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.estoque ADD CONSTRAINT estoque_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.estoque ADD CONSTRAINT estoque_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.financeiro_baixa ADD CONSTRAINT financeiro_baixa_financeiro_id_fkey FOREIGN KEY (financeiro_id) REFERENCES public.financeiro(financeiro_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.grupo_cadastro ADD CONSTRAINT grupo_cadastro_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.grupo_icms ADD CONSTRAINT grupo_icms_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.grupo_ipi ADD CONSTRAINT grupo_ipi_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.grupo_pis_cofins ADD CONSTRAINT grupo_pis_cofins_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.linha_produto ADD CONSTRAINT linha_produto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento ADD CONSTRAINT movimento_cadastro_id_fkey FOREIGN KEY (cadastro_id) REFERENCES public.cadastro(cadastro_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento ADD CONSTRAINT movimento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento_item ADD CONSTRAINT movimento_item_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento_item ADD CONSTRAINT movimento_item_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.movimento(movimento_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento_item ADD CONSTRAINT movimento_item_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento_pagamento ADD CONSTRAINT movimento_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.movimento_pagamento ADD CONSTRAINT movimento_pagamento_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.movimento(movimento_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.parametro_horario ADD CONSTRAINT parametro_horario_xparametro_id_fkey FOREIGN KEY (xparametro_id) REFERENCES public.parametro(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.pedido_item_old ADD CONSTRAINT pedido_item_xpedido_id_fkey FOREIGN KEY (xpedido_id) REFERENCES public.pedido_old(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.pedido_item_old ADD CONSTRAINT pedido_item_xproduto_id_fkey FOREIGN KEY (xproduto_id) REFERENCES public.produto_old(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.pedido_pagamento_old ADD CONSTRAINT pedido_pagamento_xpedido_id_fkey FOREIGN KEY (xpedido_id) REFERENCES public.pedido_old(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.pedido_old ADD CONSTRAINT pedido_xcliente_id_fkey FOREIGN KEY (xcliente_id) REFERENCES public.cliente_old(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.plano_conta ADD CONSTRAINT plano_conta_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.portador ADD CONSTRAINT portador_banco_id_fkey FOREIGN KEY (banco_id) REFERENCES public.banco(banco_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.portador ADD CONSTRAINT portador_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.produto ADD CONSTRAINT produto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.produto_grupo ADD CONSTRAINT produto_grupo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.produto ADD CONSTRAINT produto_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.produto_grupo(grupo_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.produto_old ADD CONSTRAINT produto_xgrupo_produto_id_fkey FOREIGN KEY (xgrupo_produto_id) REFERENCES public.grupo_produto_old(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rota ADD CONSTRAINT rota_cadastro_id_fkey FOREIGN KEY (cadastro_id) REFERENCES public.cadastro(cadastro_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.rota ADD CONSTRAINT rota_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.subgrupo_produto ADD CONSTRAINT subgrupo_produto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.subgrupo_produto ADD CONSTRAINT subgrupo_produto_grupo_id_fkey FOREIGN KEY (grupo_id) REFERENCES public.produto_grupo(grupo_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tabela_preco ADD CONSTRAINT tabela_preco_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tipo_cadastro ADD CONSTRAINT tipo_cadastro_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tipo_operacao ADD CONSTRAINT tipo_operacao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tipo_pag_rec ADD CONSTRAINT tipo_pag_rec_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.unidade ADD CONSTRAINT unidade_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.veiculo ADD CONSTRAINT veiculo_cadastro_id_fkey FOREIGN KEY (cadastro_id) REFERENCES public.cadastro(cadastro_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.veiculo ADD CONSTRAINT veiculo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
