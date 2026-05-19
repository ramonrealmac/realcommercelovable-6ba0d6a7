
-- =============================================
-- Sistema Lanchonete Escolar - Schema Completo
-- =============================================

-- Role enum
CREATE TYPE public.app_role AS ENUM ('ADM', 'CAIXA');

-- User roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer: check role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Bootstrap role (first user = ADM)
CREATE OR REPLACE FUNCTION public.fu_bootstrap_role(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'ADM') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'ADM') ON CONFLICT DO NOTHING;
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'CAIXA') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Ensure profile exists
CREATE OR REPLACE FUNCTION public.fu_ensure_profile(_user_id uuid, _name text, _email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, xnm_usuario, xemail) VALUES (_user_id, _name, _email) ON CONFLICT (id) DO NOTHING;
END;
$$;

-- User roles RLS
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADM'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xnm_usuario text NOT NULL DEFAULT '',
  xemail text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- GRUPO_PRODUTO
CREATE TABLE public.grupo_produto (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xcd_grupo_produto text NOT NULL,
  xnm_grupo_produto text NOT NULL,
  xdt_cadastro timestamptz DEFAULT now(),
  xdt_alteracao timestamptz DEFAULT now(),
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.grupo_produto ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX iu_grupo_produto_cd ON public.grupo_produto(xcd_grupo_produto) WHERE excluido_visivel = false;
CREATE INDEX ix_grupo_produto_nome ON public.grupo_produto(xnm_grupo_produto);
CREATE POLICY "Auth can view grupos" ON public.grupo_produto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert grupos" ON public.grupo_produto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Admins can update grupos" ON public.grupo_produto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADM'));

-- PRODUTO
CREATE TABLE public.produto (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id int DEFAULT 1,
  xcd_produto text NOT NULL,
  xcd_barra text,
  xnm_produto text NOT NULL,
  xun_produto text DEFAULT 'UN',
  xurl_foto text,
  xgrupo_produto_id bigint REFERENCES public.grupo_produto(id),
  xqt_estoque_fisico numeric(15,3) DEFAULT 0,
  xqt_estoque_reservado numeric(15,3) DEFAULT 0,
  xqt_estoque_disponivel numeric(15,3) GENERATED ALWAYS AS (xqt_estoque_fisico - xqt_estoque_reservado) STORED,
  xqt_estoque_minimo numeric(15,3) DEFAULT 0,
  xqt_estoque_padrao numeric(15,3) DEFAULT 0,
  xvl_preco_compra numeric(15,2) DEFAULT 0,
  xpc_markup numeric(7,2) DEFAULT 0,
  xvl_preco_sugerido numeric(15,2) DEFAULT 0,
  xvl_preco_venda numeric(15,2) DEFAULT 0,
  xlg_venda_online boolean DEFAULT true,
  xdt_cadastro timestamptz DEFAULT now(),
  xdt_alteracao timestamptz DEFAULT now(),
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX iu_produto_cd ON public.produto(xcd_produto) WHERE excluido_visivel = false;
CREATE UNIQUE INDEX iu_produto_barra ON public.produto(xcd_barra) WHERE xcd_barra IS NOT NULL AND xcd_barra != '' AND excluido_visivel = false;
CREATE INDEX ix_produto_nome ON public.produto(xnm_produto);
CREATE INDEX ix_produto_grupo ON public.produto(xgrupo_produto_id);
CREATE POLICY "Auth can view produtos" ON public.produto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can view produtos online" ON public.produto FOR SELECT TO anon USING (xlg_venda_online = true AND excluido_visivel = false);
CREATE POLICY "Admins can insert produtos" ON public.produto FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Admins can update produtos" ON public.produto FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADM'));

-- CLIENTE
CREATE TABLE public.cliente (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xcd_cliente text NOT NULL,
  xnr_cpf_cnpj text,
  xnm_razao_social text NOT NULL,
  xnm_fantasia_social text,
  xnr_telefone text,
  xnm_crianca text,
  xdt_cadastro timestamptz DEFAULT now(),
  xdt_alteracao timestamptz DEFAULT now(),
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX iu_cliente_cd ON public.cliente(xcd_cliente) WHERE excluido_visivel = false;
CREATE INDEX ix_cliente_nome ON public.cliente(xnm_razao_social);
CREATE POLICY "Auth can view clientes" ON public.cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert clientes" ON public.cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update clientes" ON public.cliente FOR UPDATE TO authenticated USING (true);

-- PEDIDO
CREATE SEQUENCE IF NOT EXISTS public.pedido_nr_seq START 1;
CREATE TABLE public.pedido (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xnr_pedido bigint DEFAULT nextval('public.pedido_nr_seq'),
  xcliente_id bigint REFERENCES public.cliente(id),
  xtipo_origem_pedido text DEFAULT 'PDV' CHECK (xtipo_origem_pedido IN ('PDV', 'LINK')),
  xst_pedido text DEFAULT 'A' CHECK (xst_pedido IN ('A', 'F', 'T', 'C')),
  xdt_pedido timestamptz DEFAULT now(),
  xhr_pedido text,
  xvl_total_bruto numeric(15,2) DEFAULT 0,
  xvl_total_desconto numeric(15,2) DEFAULT 0,
  xvl_total_liquido numeric(15,2) DEFAULT 0,
  xnm_responsavel text,
  xnr_telefone_responsavel text,
  xemail_responsavel text,
  xnm_crianca text,
  xlg_pedido_link boolean DEFAULT false,
  xlg_pedido_pdv boolean DEFAULT false,
  xlg_pagamento_online boolean DEFAULT false,
  xobs_pedido text,
  xid_transacao_abacatepay text,
  xurl_pagamento text,
  xqr_code_pagamento text,
  xdt_pagamento timestamptz,
  xdt_finalizacao timestamptz,
  xdt_faturamento timestamptz,
  xdt_cancelamento timestamptz,
  xusuario_id uuid,
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.pedido ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_pedido_nr ON public.pedido(xnr_pedido);
CREATE INDEX ix_pedido_cliente ON public.pedido(xcliente_id);
CREATE INDEX ix_pedido_status ON public.pedido(xst_pedido);
CREATE INDEX ix_pedido_data ON public.pedido(xdt_pedido);
CREATE POLICY "Auth can view pedidos" ON public.pedido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert pedidos" ON public.pedido FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update pedidos" ON public.pedido FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anon can insert pedidos link" ON public.pedido FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can view pedidos link" ON public.pedido FOR SELECT TO anon USING (xtipo_origem_pedido = 'LINK');
CREATE POLICY "Anon can update pedidos link" ON public.pedido FOR UPDATE TO anon USING (xtipo_origem_pedido = 'LINK');

-- PEDIDO_ITEM
CREATE TABLE public.pedido_item (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xpedido_id bigint REFERENCES public.pedido(id) ON DELETE CASCADE NOT NULL,
  xproduto_id bigint REFERENCES public.produto(id),
  xcd_produto text,
  xnm_produto text,
  xun_produto text,
  xqt_item numeric(15,3) DEFAULT 1,
  xvl_unitario numeric(15,2) DEFAULT 0,
  xvl_total_item numeric(15,2) GENERATED ALWAYS AS (xqt_item * xvl_unitario) STORED,
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.pedido_item ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_pedido_item_pedido ON public.pedido_item(xpedido_id);
CREATE POLICY "Auth can view items" ON public.pedido_item FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert items" ON public.pedido_item FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth can update items" ON public.pedido_item FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth can delete items" ON public.pedido_item FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon can insert items" ON public.pedido_item FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can view items" ON public.pedido_item FOR SELECT TO anon USING (true);

-- PEDIDO_PAGAMENTO
CREATE TABLE public.pedido_pagamento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xpedido_id bigint REFERENCES public.pedido(id) ON DELETE CASCADE NOT NULL,
  xtp_pagamento text NOT NULL CHECK (xtp_pagamento IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'OUTROS')),
  xvl_pagamento numeric(15,2) DEFAULT 0,
  xnr_autorizacao text,
  xobs_pagamento text,
  xdt_pagamento timestamptz DEFAULT now(),
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.pedido_pagamento ENABLE ROW LEVEL SECURITY;
CREATE INDEX ix_pedido_pagamento_pedido ON public.pedido_pagamento(xpedido_id);
CREATE POLICY "Auth can view pagamentos" ON public.pedido_pagamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth can insert pagamentos" ON public.pedido_pagamento FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert pagamentos" ON public.pedido_pagamento FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can view pagamentos" ON public.pedido_pagamento FOR SELECT TO anon USING (true);

-- PARAMETRO
CREATE TABLE public.parametro (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xnm_escola text DEFAULT 'Escola',
  xurl_logo text,
  xurl_favicon text,
  xurl_banner_vendas text,
  xurl_link_vendas text,
  xlg_valida_estoque_link boolean DEFAULT true,
  xlg_valida_estoque_pdv boolean DEFAULT false,
  xmsg_pos_pagamento text DEFAULT 'Pagamento confirmado! Seu lanche estará disponível para retirada.',
  xemail_remetente text,
  xabacatepay_api_key text,
  xabacatepay_webhook_url text,
  xcor_primaria text DEFAULT '#8B5CF6',
  xcor_secundaria text DEFAULT '#6D28D9',
  xcor_destaque text DEFAULT '#F59E0B',
  xcor_fundo text DEFAULT '#FFFFFF',
  xcor_fundo_card text DEFAULT '#F8FAFC',
  xcor_texto_principal text DEFAULT '#1E293B',
  xcor_texto_secundario text DEFAULT '#64748B',
  xcor_botao text DEFAULT '#8B5CF6',
  xcor_botao_negativo text DEFAULT '#EF4444',
  xcor_header text DEFAULT '#7C3AED',
  xcor_menu text DEFAULT '#4C1D95',
  xcor_link text DEFAULT '#8B5CF6',
  xcss_customizado text,
  xdt_cadastro timestamptz DEFAULT now(),
  xdt_alteracao timestamptz DEFAULT now(),
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.parametro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view parametro" ON public.parametro FOR SELECT USING (true);
CREATE POLICY "Admins can update parametro" ON public.parametro FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Admins can insert parametro" ON public.parametro FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADM'));

-- PARAMETRO_HORARIO
CREATE TABLE public.parametro_horario (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xparametro_id bigint REFERENCES public.parametro(id) ON DELETE CASCADE,
  xdia_semana int NOT NULL CHECK (xdia_semana BETWEEN 0 AND 6),
  xhr_inicio_matutino time,
  xhr_fim_matutino time,
  xhr_inicio_vespertino time,
  xhr_fim_vespertino time,
  xlg_dia_ativo boolean DEFAULT false,
  excluido_visivel boolean DEFAULT false
);
ALTER TABLE public.parametro_horario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view horarios" ON public.parametro_horario FOR SELECT USING (true);
CREATE POLICY "Admins can update horarios" ON public.parametro_horario FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Admins can insert horarios" ON public.parametro_horario FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADM'));

-- AUDITORIA
CREATE TABLE public.auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  xtabela text NOT NULL,
  xregistro_id text NOT NULL,
  xacao text NOT NULL,
  xdados_anteriores jsonb,
  xdados_novos jsonb,
  xusuario_id uuid,
  xdt_auditoria timestamptz DEFAULT now(),
  xip text,
  xobs text
);
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view auditoria" ON public.auditoria FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADM'));
CREATE POLICY "Auth can insert auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- Views
CREATE OR REPLACE VIEW public.vw_produtos_disponiveis AS
SELECT p.*, g.xnm_grupo_produto
FROM public.produto p
LEFT JOIN public.grupo_produto g ON g.id = p.xgrupo_produto_id AND g.excluido_visivel = false
WHERE p.excluido_visivel = false AND p.xlg_venda_online = true;

CREATE OR REPLACE VIEW public.vw_pedidos_completos AS
SELECT p.*, c.xnm_razao_social as xnm_cliente
FROM public.pedido p
LEFT JOIN public.cliente c ON c.id = p.xcliente_id
WHERE p.excluido_visivel = false;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.tr_update_dt_alteracao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.xdt_alteracao = now(); RETURN NEW; END;
$$;

CREATE TRIGGER tr_grupo_produto_dt BEFORE UPDATE ON public.grupo_produto FOR EACH ROW EXECUTE FUNCTION public.tr_update_dt_alteracao();
CREATE TRIGGER tr_produto_dt BEFORE UPDATE ON public.produto FOR EACH ROW EXECUTE FUNCTION public.tr_update_dt_alteracao();
CREATE TRIGGER tr_cliente_dt BEFORE UPDATE ON public.cliente FOR EACH ROW EXECUTE FUNCTION public.tr_update_dt_alteracao();
CREATE TRIGGER tr_parametro_dt BEFORE UPDATE ON public.parametro FOR EACH ROW EXECUTE FUNCTION public.tr_update_dt_alteracao();

-- Seed: cliente padrão
INSERT INTO public.cliente (xcd_cliente, xnm_razao_social, xnm_fantasia_social) VALUES ('001', 'CONSUMIDOR FINAL', 'CONSUMIDOR');

-- Seed: parâmetros
INSERT INTO public.parametro (xnm_escola) VALUES ('Minha Escola');

-- Seed: horários (Seg-Sex ativos)
INSERT INTO public.parametro_horario (xparametro_id, xdia_semana, xhr_inicio_matutino, xhr_fim_matutino, xhr_inicio_vespertino, xhr_fim_vespertino, xlg_dia_ativo) VALUES
  (1, 0, '07:00', '11:30', '13:00', '17:30', false),
  (1, 1, '07:00', '11:30', '13:00', '17:30', true),
  (1, 2, '07:00', '11:30', '13:00', '17:30', true),
  (1, 3, '07:00', '11:30', '13:00', '17:30', true),
  (1, 4, '07:00', '11:30', '13:00', '17:30', true),
  (1, 5, '07:00', '11:30', '13:00', '17:30', true),
  (1, 6, '07:00', '11:30', '13:00', '17:30', false);

-- Seed: grupos de produto
INSERT INTO public.grupo_produto (xcd_grupo_produto, xnm_grupo_produto) VALUES
  ('01', 'Lanches'), ('02', 'Bebidas'), ('03', 'Doces'), ('04', 'Salgados');
