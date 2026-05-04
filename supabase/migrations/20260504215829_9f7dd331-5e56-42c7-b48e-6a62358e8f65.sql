
-- ============ financeiro / financeiro_baixa ============
DROP POLICY IF EXISTS "Authenticated can select financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Authenticated can insert financeiro" ON public.financeiro;
DROP POLICY IF EXISTS "Authenticated can update financeiro" ON public.financeiro;

CREATE POLICY "Users select financeiro of own empresa" ON public.financeiro
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Users insert financeiro of own empresa" ON public.financeiro
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Users update financeiro of own empresa" ON public.financeiro
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- financeiro_baixa: drop any existing permissive then add scoped
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='financeiro_baixa' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.financeiro_baixa', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "fb_select_own_empresa" ON public.financeiro_baixa
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "fb_insert_own_empresa" ON public.financeiro_baixa
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "fb_update_own_empresa" ON public.financeiro_baixa
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ cadastro ============
DROP POLICY IF EXISTS "Auth can view cadastro" ON public.cadastro;
DROP POLICY IF EXISTS "Staff can insert cadastro" ON public.cadastro;
DROP POLICY IF EXISTS "Staff can update cadastro" ON public.cadastro;

CREATE POLICY "Cadastro select own empresa" ON public.cadastro
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Cadastro insert own empresa" ON public.cadastro
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "Cadastro update own empresa" ON public.cadastro
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ movimento ============
DROP POLICY IF EXISTS "Auth can view movimento" ON public.movimento;
DROP POLICY IF EXISTS "Auth can insert movimento" ON public.movimento;
DROP POLICY IF EXISTS "Auth can update movimento" ON public.movimento;

CREATE POLICY "movimento_select_own_empresa" ON public.movimento
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "movimento_insert_own_empresa" ON public.movimento
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "movimento_update_own_empresa" ON public.movimento
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ conta ============
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='conta' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conta', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "conta_select_admin_empresa" ON public.conta
  FOR SELECT TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));
CREATE POLICY "conta_insert_admin_empresa" ON public.conta
  FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));
CREATE POLICY "conta_update_admin_empresa" ON public.conta
  FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id))
  WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));

-- ============ mdf_condutor ============
DROP POLICY IF EXISTS "auth_all_policy" ON public.mdf_condutor;
CREATE POLICY "mdf_condutor_select_own" ON public.mdf_condutor
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "mdf_condutor_insert_own" ON public.mdf_condutor
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "mdf_condutor_update_own" ON public.mdf_condutor
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "mdf_condutor_delete_own" ON public.mdf_condutor
  FOR DELETE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ rb_conexao / rpb_conexao ============
DROP POLICY IF EXISTS "rb_conexao_auth" ON public.rb_conexao;
CREATE POLICY "rb_conexao_admin_empresa" ON public.rb_conexao
  FOR ALL TO authenticated
  USING (public.fu_is_admin(auth.uid(), empresa_id))
  WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "rpb_conexao_all" ON public.rpb_conexao;
CREATE POLICY "rpb_conexao_admin_empresa" ON public.rpb_conexao
  FOR ALL TO authenticated
  USING (public.fu_is_admin(auth.uid(), empresa_id))
  WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));

-- ============ boleto ============
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='boleto' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.boleto', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "boleto_select_own" ON public.boleto
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "boleto_insert_own" ON public.boleto
  FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));
CREATE POLICY "boleto_update_own" ON public.boleto
  FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id))
  WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ empresa - restringir UPDATE/DELETE a admin ============
DROP POLICY IF EXISTS "Auth can manage empresa" ON public.empresa;
CREATE POLICY "Empresa update admin only" ON public.empresa
  FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id))
  WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));
CREATE POLICY "Empresa delete admin only" ON public.empresa
  FOR DELETE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));
CREATE POLICY "Empresa insert admin only" ON public.empresa
  FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));

-- ============ empresa_usuario / perfil_usuario - same empresa ============
DROP POLICY IF EXISTS "Authenticated users can read EMPRESA_USUARIO" ON public.empresa_usuario;
CREATE POLICY "EU read same empresa" ON public.empresa_usuario
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

DROP POLICY IF EXISTS "Authenticated users can read PERFIL_USUARIO" ON public.perfil_usuario;
CREATE POLICY "PU read same empresa" ON public.perfil_usuario
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ profiles - admins veem apenas da mesma empresa ============
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins view profiles same empresa" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.empresa_usuario eu_self
      JOIN public.empresa_usuario eu_target ON eu_target.empresa_id = eu_self.empresa_id
      WHERE eu_self.user_id = auth.uid()
        AND eu_self.fl_excluido = false
        AND eu_target.user_id = profiles.id
        AND eu_target.fl_excluido = false
        AND public.fu_is_admin(auth.uid(), eu_self.empresa_id)
    )
  );

-- ============ nfe_recebida - remover anon ============
DROP POLICY IF EXISTS "Temp allow anon read nfe_recebida" ON public.nfe_recebida;
DROP POLICY IF EXISTS "Authenticated users can read NFE_RECEBIDA" ON public.nfe_recebida;
CREATE POLICY "NFE select same empresa" ON public.nfe_recebida
  FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));

-- ============ balanca - remover anon ============
DROP POLICY IF EXISTS "Anon can select balanca" ON public.balanca;
DROP POLICY IF EXISTS "Anon can update balanca" ON public.balanca;
CREATE POLICY "balanca_select_auth" ON public.balanca
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "balanca_update_auth" ON public.balanca
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============ tabelas de domínio: remover acesso público total ============
DROP POLICY IF EXISTS "Acesso total bandeira" ON public.bandeira;
CREATE POLICY "bandeira_read_auth" ON public.bandeira
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bandeira_write_auth" ON public.bandeira
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "bandeira_update_auth" ON public.bandeira
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "bandeira_delete_auth" ON public.bandeira
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso total meio_pagamento" ON public.meio_pagamento;
CREATE POLICY "mp_read_auth" ON public.meio_pagamento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "mp_insert_auth" ON public.meio_pagamento
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mp_update_auth" ON public.meio_pagamento
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "mp_delete_auth" ON public.meio_pagamento
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso total operadora" ON public.operadora;
CREATE POLICY "operadora_read_auth" ON public.operadora
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "operadora_insert_auth" ON public.operadora
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operadora_update_auth" ON public.operadora
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "operadora_delete_auth" ON public.operadora
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Acesso total condicao_pagamento" ON public.condicao_pagamento;
-- existing condicao_pagamento_auth(authenticated ALL) já existe; mantém

-- ============ chat_sala_membro - corrigir bug da política INSERT ============
DROP POLICY IF EXISTS "membro insere a si mesmo ou criador adiciona" ON public.chat_sala_membro;
CREATE POLICY "membro insere a si mesmo ou criador adiciona"
  ON public.chat_sala_membro FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_sala s
      WHERE s.chat_sala_id = chat_sala_membro.chat_sala_id
        AND s.criado_por = auth.uid()
    )
  );

-- ============ financeiro_view - usar security_invoker ============
ALTER VIEW public.financeiro_view SET (security_invoker = on);
