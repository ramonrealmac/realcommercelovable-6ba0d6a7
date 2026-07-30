--
-- PostgreSQL database dump
--

\restrict 9ugcxAf2nVolfEDCadyrcCIMwUaith8a8zBaWJ2NevjLSmecXvJaJnMioRw11c0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: supabase_admin
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO supabase_admin;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE auth.aal_level OWNER TO supabase_auth_admin;

--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


ALTER TYPE auth.code_challenge_method OWNER TO supabase_auth_admin;

--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE auth.factor_status OWNER TO supabase_auth_admin;

--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE auth.factor_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE auth.oauth_authorization_status OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE auth.oauth_client_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE auth.oauth_registration_type OWNER TO supabase_auth_admin;

--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


ALTER TYPE auth.oauth_response_type OWNER TO supabase_auth_admin;

--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE auth.one_time_token_type OWNER TO supabase_auth_admin;

--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION auth.email() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION auth.jwt() OWNER TO supabase_auth_admin;

--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION auth.role() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: supabase_auth_admin
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION auth.uid() OWNER TO supabase_auth_admin;

--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: finalizar_venda_caixa(bigint, bigint, bigint, integer, character varying, integer, integer, character varying, character varying, double precision, double precision, jsonb, character varying, boolean, bigint, bigint, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying DEFAULT 'SISTEMA'::character varying, p_gerar_financeiro boolean DEFAULT false, p_cadastro_id bigint DEFAULT NULL::bigint, p_condicao_id bigint DEFAULT NULL::bigint, p_portador_id integer DEFAULT NULL::integer, p_planoconta_id integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_caixa_movimento_id    integer;
    v_item                  jsonb;
    v_mov_item              RECORD;
    v_financeiro_id         bigint;
    v_nr_parcela            integer;
    v_dt_vencimento         date;
    v_prazo                 integer;
    v_condicao              RECORD;
    v_vl_parcela            numeric;
    v_n_parcelas            integer;
BEGIN
    -- 0. Validações básicas
    IF p_movimento_id IS NULL THEN
        RAISE EXCEPTION 'movimento_id é obrigatório';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.movimento 
        WHERE movimento_id = p_movimento_id 
          AND empresa_id   = p_empresa_id 
          AND st_pedido    = 'A'
          AND excluido     = false
    ) THEN
        RAISE EXCEPTION 'Pedido % não encontrado ou já finalizado.', p_movimento_id;
    END IF;

    -- 1. Inserir em caixa_movimento
    INSERT INTO public.caixa_movimento (
        empresa_id, funcionario_id, colaborador_id,
        dt_movimento, tp_movimento, tp_operacao,
        conta_gerencial_id, centro_custo_id,
        historico, documento,
        vl_movimento, vl_troco,
        movimento_id, caixa_abertura_id,
        excluido, dt_cadastro, dt_alteracao
    ) VALUES (
        p_empresa_id, p_funcionario_id, p_funcionario_id,
        CURRENT_DATE, 'V', p_tp_operacao,
        p_conta_gerencial_id, p_centro_custo_id,
        p_historico, p_documento,
        p_vl_total, p_vl_troco,
        p_movimento_id::integer, p_caixa_abertura_id,
        false, now(), now()
    )
    RETURNING caixa_movimento_id INTO v_caixa_movimento_id;

    -- 2. Inserir itens de pagamento em caixa_movimento_item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_pagamentos)
    LOOP
        INSERT INTO public.caixa_movimento_item (
            empresa_id, caixa_movimento_id,
            condicao_id, prazo_pagamento_id,
            bandeira_id, operadora_id,
            numero_autoriza, qt_parcela,
            vl_parcela, vl_recebido,
            meio_pagamento_id, plano_conta_id,
            excluido, dt_cadastro, dt_alteracao
        ) VALUES (
            p_empresa_id, v_caixa_movimento_id,
            COALESCE((v_item->>'condicao_id')::integer, 0),
            COALESCE((v_item->>'prazo_pagamento_id')::integer, 0),
            COALESCE((v_item->>'bandeira_id')::integer, 0),
            COALESCE((v_item->>'operadora_id')::integer, 0),
            COALESCE(v_item->>'numero_autoriza', ''),
            COALESCE((v_item->>'qt_parcela')::integer, 1),
            COALESCE((v_item->>'vl_parcela')::double precision, 0),
            COALESCE((v_item->>'vl_recebido')::double precision, 0),
            (v_item->>'meio_pagamento_id')::integer,
            p_planoconta_id,
            false, now(), now()
        );
    END LOOP;

    -- 3. Mudar status do pedido para 'R' (Recebido)
    UPDATE public.movimento
    SET st_pedido       = 'R',
        dt_finalizacao  = now(),
        dt_pagamento    = now(),
        dt_alteracao    = now()
    WHERE movimento_id = p_movimento_id
      AND empresa_id   = p_empresa_id;

    -- 4. Processar itens: liberar reserva + log estoque
    FOR v_mov_item IN
        SELECT mi.produto_id, mi.deposito_id,
               mi.qt_movimento, mi.entrega
        FROM public.movimento_item mi
        WHERE mi.movimento_id = p_movimento_id
          AND mi.empresa_id   = p_empresa_id
          AND mi.excluido     = false
          AND mi.produto_id   IS NOT NULL
    LOOP
        -- 4a. Liberar reserva de estoque (somente itens sem entrega pendente)
        IF UPPER(COALESCE(v_mov_item.entrega, 'N')) = 'N' THEN
            UPDATE public.estoque
            SET estoque_reservado = GREATEST(0, COALESCE(estoque_reservado, 0) - v_mov_item.qt_movimento),
                dt_alteracao      = now()
            WHERE produto_id  = v_mov_item.produto_id
              AND deposito_id = v_mov_item.deposito_id
              AND empresa_id  = p_empresa_id;
        END IF;

        -- 4b. Log de saída de estoque (trigger debita estoque_fisico automaticamente)
        INSERT INTO public.estoque_log (
            empresa_id, produto_id, deposito_id,
            qt_movimento, operacao, origem,
            nr_doc, usuario, dt_hs_log
        ) VALUES (
            p_empresa_id, v_mov_item.produto_id, v_mov_item.deposito_id,
            -v_mov_item.qt_movimento,
            'VENDA', 'CAIXA',
            p_movimento_id::varchar, p_usuario, now()
        );
    END LOOP;

    -- 5. Gerar contas a receber (venda a prazo)
    IF p_gerar_financeiro AND p_condicao_id IS NOT NULL AND p_condicao_id > 0 THEN

        SELECT * INTO v_condicao
        FROM public.condicao_pagamento
        WHERE condicao_id = p_condicao_id AND excluido = false
        LIMIT 1;

        IF FOUND THEN
            v_n_parcelas := COALESCE(v_condicao.qtd_parcelas, 1);
            IF v_n_parcelas < 1 THEN v_n_parcelas := 1; END IF;
            v_vl_parcela := ROUND((p_vl_total / v_n_parcelas)::numeric, 2);

            FOR v_nr_parcela IN 1..v_n_parcelas LOOP
                v_prazo := CASE v_nr_parcela
                    WHEN 1  THEN COALESCE(v_condicao.prazo_1,  0)
                    WHEN 2  THEN COALESCE(v_condicao.prazo_2,  0)
                    WHEN 3  THEN COALESCE(v_condicao.prazo_3,  0)
                    WHEN 4  THEN COALESCE(v_condicao.prazo_4,  0)
                    WHEN 5  THEN COALESCE(v_condicao.prazo_5,  0)
                    WHEN 6  THEN COALESCE(v_condicao.prazo_6,  0)
                    WHEN 7  THEN COALESCE(v_condicao.prazo_7,  0)
                    WHEN 8  THEN COALESCE(v_condicao.prazo_8,  0)
                    WHEN 9  THEN COALESCE(v_condicao.prazo_9,  0)
                    WHEN 10 THEN COALESCE(v_condicao.prazo_10, 0)
                    WHEN 11 THEN COALESCE(v_condicao.prazo_11, 0)
                    WHEN 12 THEN COALESCE(v_condicao.prazo_12, 0)
                    ELSE 30 * v_nr_parcela
                END;

                v_dt_vencimento := CURRENT_DATE + v_prazo;

                INSERT INTO public.financeiro (
                    empresa_id, cadastro_id, movimento_id,
                    tp_conta, documento, parcela,
                    dt_emissao, dt_vencto,
                    vl_titulo, vl_pago,
                    portador_id, planoconta_id,
                    observacao1, status,
                    funcionario_id
                ) VALUES (
                    p_empresa_id::integer,
                    p_cadastro_id::integer,
                    p_movimento_id::integer,
                    'R',
                    p_documento,
                    v_nr_parcela,
                    CURRENT_DATE,
                    v_dt_vencimento,
                    v_vl_parcela,
                    0,
                    p_portador_id,
                    p_planoconta_id,
                    'Venda no Caixa - Pedido ' || p_movimento_id::varchar,
                    'A',
                    p_funcionario_id::integer
                )
                RETURNING financeiro_id INTO v_financeiro_id;
            END LOOP;

            UPDATE public.movimento
            SET gerou_financeiro = 'S', dt_alteracao = now()
            WHERE movimento_id = p_movimento_id AND empresa_id = p_empresa_id;
        END IF;
    END IF;

    -- 6. Retorna resultado
    RETURN jsonb_build_object(
        'success',              true,
        'caixa_movimento_id',   v_caixa_movimento_id,
        'movimento_id',         p_movimento_id,
        'message',              'Venda finalizada com sucesso'
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao finalizar venda: %', SQLERRM;
END;
$$;


ALTER FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer) OWNER TO postgres;

--
-- Name: FUNCTION finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer) IS 'Transação atômica para finalização de venda no PDV/Caixa.
Passo 1: Registra caixa_movimento + caixa_movimento_item
Passo 2: Muda status do pedido para R (Recebido)
Passo 3: Libera reserva de estoque (entrega=N)
Passo 4: Gera log de saída no estoque_log (trigger debita estoque_fisico)
Passo 5: Gera contas a receber no financeiro (se p_gerar_financeiro=true)
Em caso de erro em qualquer passo, ROLLBACK total.';


--
-- Name: fn_duplicar_ambiencia(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_duplicar_ambiencia() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Verifica se a origem é 'N' para evitar o loop infinito
    IF (NEW.origem = 'N') THEN
        INSERT INTO public.galpao_ambiencia (
            temperatura, 
            umidade, 
            abc_mq, 
            tensao_mq, 
            temperatura_bmp, 
            pressao_bmp, 
            data_evento, 
            granja, 
            origem
        )
        VALUES (
            NEW.temperatura * 1.07,      -- Acréscimo de 7%
            NEW.umidade * 1.07,          -- Acréscimo de 7%
            NEW.abc_mq,
            NEW.tensao_mq * 1.07,        -- Acréscimo de 7%
            NEW.temperatura_bmp * 1.07,  -- Acréscimo de 7%
            NEW.pressao_bmp * 1.07,      -- Acréscimo de 7%
            NEW.data_evento,
            'YASUHIDE WATANABE',         -- Valor fixo solicitado
            'T'                          -- Define como 'T' para não disparar novamente
        );
    END IF;
    RETURN NULL; -- Em triggers AFTER, o retorno é ignorado
END;
$$;


ALTER FUNCTION public.fn_duplicar_ambiencia() OWNER TO postgres;

--
-- Name: fn_emovimento_item_calc_before(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_emovimento_item_calc_before() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.vl_produto = COALESCE(NEW.qt_movimento, 0) * COALESCE(NEW.vl_und_produto, 0);
    NEW.vl_movimento = COALESCE(NEW.vl_produto, 0) - COALESCE(NEW.vl_desconto, 0);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_emovimento_item_calc_before() OWNER TO postgres;

--
-- Name: fn_emovimento_totalize(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_emovimento_totalize() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_emov_id BIGINT;
    v_vl_produto NUMERIC(18,4) := 0;
    v_vl_desconto NUMERIC(18,4) := 0;
    v_vl_movimento NUMERIC(18,4) := 0;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_emov_id := OLD.emovimento_id;
    ELSE
        v_emov_id := NEW.emovimento_id;
    END IF;

    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    -- Sum totals from active items
    SELECT 
        COALESCE(SUM(vl_produto), 0),
        COALESCE(SUM(vl_desconto), 0),
        COALESCE(SUM(vl_movimento), 0)
    INTO 
        v_vl_produto, v_vl_desconto, v_vl_movimento
    FROM public.emovimento_item
    WHERE emovimento_id = v_emov_id AND excluido = false;

    -- Update emovimento header
    UPDATE public.emovimento
    SET 
        vl_produto = v_vl_produto,
        vl_desconto = v_vl_desconto,
        vl_movimento = v_vl_movimento
    WHERE emovimento_id = v_emov_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_emovimento_totalize() OWNER TO postgres;

--
-- Name: fn_estoque_log_block_mod(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_estoque_log_block_mod() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Não é permitido alterar ou excluir registros de log de estoque. Esta tabela é de auditoria imutável.';
END;
$$;


ALTER FUNCTION public.fn_estoque_log_block_mod() OWNER TO postgres;

--
-- Name: fn_movimento_item_calc_before(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_movimento_item_calc_before() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Calcula valor do produto (qtde * valor unitário)
    NEW.vl_produto = COALESCE(NEW.qt_movimento, 0) * COALESCE(NEW.vl_und_produto, 0);
    
    -- Calcula o valor total do item conforme fórmula solicitada
    -- vl_movimento = vl_produto + vl_frete + vl_seguro + vl_outro + vl_despesa + vl_icmsst - vl_desc_rs
    NEW.vl_movimento = COALESCE(NEW.vl_produto, 0) 
                     + COALESCE(NEW.vl_frete, 0) 
                     + COALESCE(NEW.vl_seguro, 0) 
                     + COALESCE(NEW.vl_outro, 0) 
                     + COALESCE(NEW.vl_despesa, 0) 
                     + COALESCE(NEW.vl_icmsst, 0) 
                     - COALESCE(NEW.vl_desc_rs, 0);

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_movimento_item_calc_before() OWNER TO postgres;

--
-- Name: fn_movimento_totalize(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_movimento_totalize() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_movimento_id BIGINT;
    v_tp_desconto VARCHAR;
    v_mov_vl_desconto NUMERIC(12,2) := 0;
    v_mov_vl_bc_desc NUMERIC(12,2) := 0;
    
    -- Totais
    v_vl_produto NUMERIC(12,2) := 0;
    v_vl_movimento NUMERIC(12,2) := 0;
    v_vl_despesa NUMERIC(12,2) := 0;
    v_vl_seguro NUMERIC(12,2) := 0;
    v_vl_frete NUMERIC(12,2) := 0;
    v_vl_outro NUMERIC(12,2) := 0;
    v_vl_desc_rs NUMERIC(12,2) := 0;
    v_vl_comissao NUMERIC(12,2) := 0;
    
    v_vl_bc_icms NUMERIC(12,2) := 0;
    v_vl_icms NUMERIC(12,2) := 0;
    v_bc_icmsst NUMERIC(12,2) := 0;
    v_vl_icmsst NUMERIC(12,2) := 0;
    v_vl_bc_pis NUMERIC(12,2) := 0;
    v_vl_pis NUMERIC(12,2) := 0;
    v_vl_bc_cofins NUMERIC(12,2) := 0;
    v_vl_cofins NUMERIC(12,2) := 0;
    v_vl_bc_ipi NUMERIC(12,2) := 0;
    v_vl_ipi NUMERIC(12,2) := 0;
    v_vl_bc_iss NUMERIC(12,2) := 0;
    v_vl_iss NUMERIC(12,2) := 0;

    -- Variáveis para rateio (tp_desconto = 'P')
    v_item RECORD;
    v_desconto_aplicado NUMERIC(12,2) := 0;
    v_desc_item NUMERIC(12,2) := 0;
    v_item_count INT := 0;
    v_processed INT := 0;
BEGIN
    -- Define the ID of the movement to process
    IF TG_OP = 'DELETE' THEN
        v_movimento_id := OLD.movimento_id;
    ELSE
        IF TG_TABLE_NAME = 'movimento' THEN
            v_movimento_id := NEW.movimento_id;
        ELSE
            v_movimento_id := NEW.movimento_id;
        END IF;
    END IF;

    -- Prevent recursive trigger loops on movimento and movimento_item
    IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    -- Lê o tipo de desconto atual do movimento
    SELECT tp_desconto, COALESCE(vl_desconto, 0)
    INTO v_tp_desconto, v_mov_vl_desconto
    FROM public.movimento 
    WHERE movimento_id = v_movimento_id;

    -- 2.1 Calcula a base de cálculo de desconto (somente itens SEM st_promo = 'S')
    SELECT COALESCE(SUM(mi.vl_produto), 0)
    INTO v_mov_vl_bc_desc
    FROM public.movimento_item mi
    LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
    WHERE mi.movimento_id = v_movimento_id 
      AND mi.excluido = false
      AND COALESCE(p.st_promo, 'N') <> 'S';

    -- 2.2 Lógica de Rateio (tp_desconto = 'P')
    IF v_tp_desconto = 'P' THEN
        IF v_mov_vl_bc_desc > 0 AND v_mov_vl_desconto > 0 THEN
            v_desconto_aplicado := 0;
            v_processed := 0;
            
            -- Conta quantos itens elegíveis existem
            SELECT COUNT(*) INTO v_item_count
            FROM public.movimento_item mi
            LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
            WHERE mi.movimento_id = v_movimento_id AND mi.excluido = false AND COALESCE(p.st_promo, 'N') <> 'S';

            -- Loop para ratear (do menor vl_produto para o maior)
            FOR v_item IN 
                SELECT mi.movimento_item_id, mi.vl_produto
                FROM public.movimento_item mi
                LEFT JOIN public.produto p ON mi.produto_id = p.produto_id
                WHERE mi.movimento_id = v_movimento_id AND mi.excluido = false AND COALESCE(p.st_promo, 'N') <> 'S'
                ORDER BY mi.vl_produto ASC
            LOOP
                v_processed := v_processed + 1;
                
                -- Se for o último item elegível, atribui o restante para bater o valor exato
                IF v_processed = v_item_count THEN
                    v_desc_item := v_mov_vl_desconto - v_desconto_aplicado;
                ELSE
                    -- Calcula o desconto proporcional, arredondado para 2 casas
                    v_desc_item := ROUND((v_item.vl_produto / v_mov_vl_bc_desc) * v_mov_vl_desconto, 2);
                END IF;
                
                v_desconto_aplicado := v_desconto_aplicado + v_desc_item;

                -- Atualiza o item elegível com o desconto rateado
                UPDATE public.movimento_item 
                SET vl_desconto = v_desc_item,
                    pc_desconto = ROUND((v_desc_item / vl_produto) * 100, 2),
                    vl_desc_rs = v_desc_item
                WHERE movimento_item_id = v_item.movimento_item_id;
            END LOOP;
        ELSE
            -- Se não tem base ou valor, zera tudo
            UPDATE public.movimento_item 
            SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
            WHERE movimento_id = v_movimento_id AND excluido = false;
        END IF;

        -- Zera o desconto dos itens NÃO elegíveis (em promoção)
        UPDATE public.movimento_item mi
        SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
        FROM public.produto p
        WHERE mi.produto_id = p.produto_id
          AND mi.movimento_id = v_movimento_id 
          AND mi.excluido = false 
          AND COALESCE(p.st_promo, 'N') = 'S';

    ELSIF v_tp_desconto = 'N' THEN
        -- tp_desconto = 'N' -> Zera todos os descontos dos itens
        UPDATE public.movimento_item 
        SET vl_desconto = 0, pc_desconto = 0, vl_desc_rs = 0
        WHERE movimento_id = v_movimento_id AND excluido = false AND (vl_desconto > 0 OR pc_desconto > 0);
    END IF;

    -- 2.3 Somatório total do movimento_item para atualizar o cabeçalho (movimento)
    SELECT 
        COALESCE(SUM(vl_produto), 0),
        COALESCE(SUM(vl_movimento), 0),
        COALESCE(SUM(vl_despesa), 0),
        COALESCE(SUM(vl_seguro), 0),
        COALESCE(SUM(vl_frete), 0),
        COALESCE(SUM(vl_outro), 0),
        COALESCE(SUM(vl_desc_rs), 0),
        COALESCE(SUM(vl_comissao), 0),
        COALESCE(SUM(vl_bc_icms), 0),
        COALESCE(SUM(vl_icms), 0),
        COALESCE(SUM(bc_icmsst), 0),
        COALESCE(SUM(vl_icmsst), 0),
        COALESCE(SUM(vl_bc_pis), 0),
        COALESCE(SUM(vl_pis), 0),
        COALESCE(SUM(vl_bc_cofins), 0),
        COALESCE(SUM(vl_cofins), 0),
        COALESCE(SUM(vl_bc_ipi), 0),
        COALESCE(SUM(vl_ipi), 0),
        COALESCE(SUM(vl_bc_iss), 0),
        COALESCE(SUM(vl_iss), 0)
    INTO 
        v_vl_produto, v_vl_movimento, v_vl_despesa, v_vl_seguro, v_vl_frete, v_vl_outro, 
        v_vl_desc_rs, v_vl_comissao, v_vl_bc_icms, v_vl_icms, v_bc_icmsst, v_vl_icmsst, 
        v_vl_bc_pis, v_vl_pis, v_vl_bc_cofins, v_vl_cofins, v_vl_bc_ipi, v_vl_ipi, 
        v_vl_bc_iss, v_vl_iss
    FROM public.movimento_item
    WHERE movimento_id = v_movimento_id AND excluido = false;

    -- Calcula o desconto de Item caso tp_desconto seja 'I'
    IF v_tp_desconto = 'I' THEN
        SELECT COALESCE(SUM(vl_desconto), 0) INTO v_mov_vl_desconto
        FROM public.movimento_item
        WHERE movimento_id = v_movimento_id AND excluido = false;
    ELSIF v_tp_desconto = 'N' THEN
        v_mov_vl_desconto := 0;
    END IF;

    -- 2.4 Atualiza o cabeçalho (movimento) com os totais
    UPDATE public.movimento
    SET 
        vl_bc_desconto = v_mov_vl_bc_desc,
        vl_desconto = v_mov_vl_desconto,
        pc_desconto = CASE 
                        WHEN v_mov_vl_bc_desc > 0 AND v_tp_desconto IN ('I', 'P') THEN ROUND((v_mov_vl_desconto / v_mov_vl_bc_desc) * 100, 2)
                        ELSE 0 
                      END,
        vl_produto = v_vl_produto,
        vl_movimento = v_vl_movimento,
        vl_total_nota = v_vl_movimento, -- Geralmente o total da nota espelha o vl_movimento
        vl_despesa = v_vl_despesa,
        vl_seguro = v_vl_seguro,
        vl_frete = v_vl_frete,
        vl_outro = v_vl_outro,
        vl_desc_rs = v_vl_desc_rs,
        vl_comissao = v_vl_comissao,
        vl_bc_icms = v_vl_bc_icms,
        vl_icms = v_vl_icms,
        bc_icmsst = v_bc_icmsst,
        vl_icmsst = v_vl_icmsst,
        vl_bc_pis = v_vl_bc_pis,
        vl_pis = v_vl_pis,
        vl_bc_cofins = v_vl_bc_cofins,
        vl_cofins = v_vl_cofins,
        vl_bc_ipi = v_vl_bc_ipi,
        vl_ipi = v_vl_ipi,
        vl_bc_iss = v_vl_bc_iss,
        vl_iss = v_vl_iss
    WHERE movimento_id = v_movimento_id;

    RETURN NULL;
END;
$$;


ALTER FUNCTION public.fn_movimento_totalize() OWNER TO postgres;

--
-- Name: fn_prevalidar_nfe(bigint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
    v_cab       RECORD;
    v_emp       RECORD;
    v_item      RECORD;
    v_pag_cnt   integer;
    v_ref_cnt   integer;
    v_item_cnt  integer;
    v_erros     jsonb := '[]'::jsonb;
    v_simples   boolean;
    v_pre       text;
BEGIN
    -- Cabeçalho
    SELECT * INTO v_cab
    FROM public.fiscal_nfe_cabecalho
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valido', false, 'erros',
            jsonb_build_array(jsonb_build_object(
                'campo','Cabeçalho','mensagem','Registro fiscal não localizado.')));
    END IF;

    -- Empresa / regime
    SELECT * INTO v_emp FROM public.empresa WHERE empresa_id = p_empresa_id;

    v_simples := UPPER(COALESCE(v_emp.regime_trib::text,'')) IN
                 ('1','S','SN','SIMPLES','SIMPLES NACIONAL');

    -- ── Cabeçalho ────────────────────────────────────────────────
    IF COALESCE(v_cab.nat_op,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nat. Operação',
            'mensagem','Natureza da Operação (nat_op) não informada.'));
    ELSIF length(v_cab.nat_op) > 60 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nat. Operação',
            'mensagem', format('Natureza da Operação excede 60 caracteres (%s).', length(v_cab.nat_op))));
    END IF;

    IF COALESCE(v_cab.nr_nota,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Nº Nota','mensagem','Número da nota não informado.'));
    END IF;

    IF COALESCE(v_cab.serie,'') = '' THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Série','mensagem','Série da nota não informada.'));
    END IF;

    IF v_cab.dt_emissao IS NULL THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Data Emissão','mensagem','Data de emissão não informada.'));
    END IF;

    IF COALESCE(v_cab.vl_total_nf, 0) <= 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Cabeçalho → Vl. Total','mensagem','Valor total da NF-e é zero ou negativo.'));
    END IF;

    -- ── Devolução exige pelo menos 1 referência ─────────────────
    IF v_cab.fin_nfe = 4 OR v_cab.tp_nf = 0 THEN
        SELECT COUNT(*) INTO v_ref_cnt
        FROM public.fiscal_nfe_referenciada
        WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

        IF v_ref_cnt = 0 THEN
            v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                'campo','Referência',
                'mensagem','Documento referenciado obrigatório para devoluções/entradas (fin_nfe=4).'));
        END IF;
    END IF;

    -- ── Pagamentos ───────────────────────────────────────────────
    SELECT COUNT(*) INTO v_pag_cnt
    FROM public.fiscal_nfe_pagamento
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF v_pag_cnt = 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Pagamento','mensagem','Nenhum pagamento informado na NF-e.'));
    ELSE
        FOR v_item IN
            SELECT * FROM public.fiscal_nfe_pagamento
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
        LOOP
            IF COALESCE(v_item.t_pag,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → t_pag', v_item.nfe_pagamento_id),
                    'mensagem','Tipo de pagamento (t_pag) não informado.'));
            ELSIF length(v_item.t_pag) <> 2 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → t_pag', v_item.nfe_pagamento_id),
                    'mensagem', format('t_pag deve ter 2 dígitos, encontrado "%s".', v_item.t_pag)));
            END IF;

            IF COALESCE(v_item.v_pag, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', format('Pagamento #%s → v_pag', v_item.nfe_pagamento_id),
                    'mensagem','Valor do pagamento é zero ou negativo.'));
            END IF;
        END LOOP;
    END IF;

    -- ── Itens ────────────────────────────────────────────────────
    SELECT COUNT(*) INTO v_item_cnt
    FROM public.fiscal_nfe_item
    WHERE nfe_cabecalho_id = p_nfe_cabecalho_id;

    IF v_item_cnt = 0 THEN
        v_erros := v_erros || jsonb_build_array(jsonb_build_object(
            'campo','Itens','mensagem','Nenhum item inserido na NF-e.'));
    ELSE
        FOR v_item IN
            SELECT * FROM public.fiscal_nfe_item
            WHERE nfe_cabecalho_id = p_nfe_cabecalho_id
            ORDER BY nr_item
        LOOP
            v_pre := format('Item %s (%s)', v_item.nr_item, COALESCE(v_item.nm_produto,'?'));

            -- Descrição
            IF COALESCE(v_item.nm_produto,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Descrição',
                    'mensagem','Descrição do produto não informada.'));
            ELSIF length(v_item.nm_produto) > 120 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Descrição',
                    'mensagem', format('Descrição excede 120 caracteres (%s).', length(v_item.nm_produto))));
            END IF;

            -- Unidade
            IF COALESCE(v_item.unidade,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Unidade',
                    'mensagem','Unidade de medida não informada.'));
            END IF;

            -- Quantidade / Valor
            IF COALESCE(v_item.qt_entrada, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Quantidade',
                    'mensagem','Quantidade zero ou negativa.'));
            END IF;

            IF COALESCE(v_item.vl_total, 0) <= 0 THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Valor Total',
                    'mensagem','Valor total do item é zero ou negativo.'));
            END IF;

            -- NCM: exatamente 8 dígitos numéricos
            IF COALESCE(v_item.ncm,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem','NCM não informado.'));
            ELSIF v_item.ncm !~ '^\d{8}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → NCM',
                    'mensagem', format('NCM deve ter 8 dígitos numéricos. Encontrado: "%s".', v_item.ncm)));
            END IF;

            -- CFOP: 4 dígitos numéricos
            IF COALESCE(v_item.cfop,'') = '' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CFOP',
                    'mensagem','CFOP não informado.'));
            ELSIF v_item.cfop !~ '^\d{4}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CFOP',
                    'mensagem', format('CFOP deve ter 4 dígitos. Encontrado: "%s".', v_item.cfop)));
            END IF;

            -- GTIN: vazio | SEM_GTIN | 8/12/13/14 dígitos
            IF COALESCE(v_item.gtin,'') NOT IN ('','SEM GTIN','SEM_GTIN') THEN
                IF v_item.gtin !~ '^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → GTIN/EAN',
                        'mensagem', format('GTIN inválido: "%s". Use SEM_GTIN ou EAN 8/12/13/14 dígitos.', v_item.gtin)));
                END IF;
            END IF;

            -- Origem: 0-8
            IF v_item.origem IS NOT NULL AND (v_item.origem < 0 OR v_item.origem > 8) THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → Origem',
                    'mensagem', format('Origem ICMS deve ser 0-8. Encontrado: %s.', v_item.origem)));
            END IF;

            -- CEST: 7 dígitos se informado
            IF COALESCE(v_item.cest,'') <> '' AND v_item.cest !~ '^\d{7}$' THEN
                v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                    'campo', v_pre || ' → CEST',
                    'mensagem', format('CEST deve ter 7 dígitos. Encontrado: "%s".', v_item.cest)));
            END IF;

            -- ── Tributação ICMS ──────────────────────────────────
            IF v_simples THEN
                -- Simples Nacional → CSOSN obrigatório (3 dígitos)
                IF COALESCE(v_item.csosn,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem','CSOSN obrigatório para empresas do Simples Nacional.'));
                ELSIF v_item.csosn !~ '^\d{3}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem', format('CSOSN deve ter 3 dígitos. Encontrado: "%s".', v_item.csosn)));
                ELSIF v_item.csosn NOT IN ('101','102','103','201','202','203','300','400','500','900') THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CSOSN',
                        'mensagem', format('CSOSN "%s" inválido (aceitos: 101,102,103,201,202,203,300,400,500,900).', v_item.csosn)));
                END IF;
            ELSE
                -- Regime Normal → CST ICMS obrigatório (2-3 dígitos)
                IF COALESCE(v_item.cst_icms,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST ICMS',
                        'mensagem','CST ICMS obrigatório para regime normal.'));
                ELSIF v_item.cst_icms !~ '^\d{2,3}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST ICMS',
                        'mensagem', format('CST ICMS deve ter 2 ou 3 dígitos. Encontrado: "%s".', v_item.cst_icms)));
                END IF;

                -- CST PIS (2 dígitos)
                IF COALESCE(v_item.cst_pis,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST PIS',
                        'mensagem','CST PIS obrigatório para regime normal.'));
                ELSIF v_item.cst_pis !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST PIS',
                        'mensagem', format('CST PIS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_pis)));
                END IF;

                -- CST COFINS (2 dígitos)
                IF COALESCE(v_item.cst_cofins,'') = '' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST COFINS',
                        'mensagem','CST COFINS obrigatório para regime normal.'));
                ELSIF v_item.cst_cofins !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST COFINS',
                        'mensagem', format('CST COFINS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_cofins)));
                END IF;

                -- CST IBS (2 dígitos, se preenchido)
                IF COALESCE(v_item.cst_ibs,'') <> '' AND v_item.cst_ibs !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST IBS',
                        'mensagem', format('CST IBS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_ibs)));
                END IF;

                -- CST CBS (2 dígitos, se preenchido)
                IF COALESCE(v_item.cst_cbs,'') <> '' AND v_item.cst_cbs !~ '^\d{2}$' THEN
                    v_erros := v_erros || jsonb_build_array(jsonb_build_object(
                        'campo', v_pre || ' → CST CBS',
                        'mensagem', format('CST CBS deve ter 2 dígitos. Encontrado: "%s".', v_item.cst_cbs)));
                END IF;
            END IF;

        END LOOP; -- itens
    END IF;

    RETURN jsonb_build_object(
        'valido',  jsonb_array_length(v_erros) = 0,
        'erros',   v_erros,
        'regime',  CASE WHEN v_simples THEN 'SIMPLES' ELSE 'NORMAL' END,
        'total_erros', jsonb_array_length(v_erros)
    );
END;
$_$;


ALTER FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) OWNER TO postgres;

--
-- Name: FUNCTION fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) IS 'Pré-valida dados fiscais (cabeçalho/itens/pagamentos/referências) antes de despachar ao worker.
Verifica: nat_op (≤60), NCM (8 dig), CFOP (4 dig), GTIN (EAN válido ou SEM_GTIN),
CEST (7 dig), Origem (0-8), CSOSN (Simples, 3 dig + tabela), CST ICMS/PIS/COFINS/IBS/CBS (Regime Normal),
devolução sem referência, pagamentos. Retorna {valido, erros[], regime, total_erros}.';


--
-- Name: fn_processa_estoque_log(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_processa_estoque_log() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_estoque_fisico_novo numeric;
    v_estoque_geral_novo numeric;
    v_existe_estoque boolean;
BEGIN
    -- Validação básica
    IF NEW.empresa_id IS NULL OR NEW.produto_id IS NULL OR NEW.deposito_id IS NULL THEN
        RAISE EXCEPTION 'empresa_id, produto_id e deposito_id são obrigatórios para movimentação de estoque.';
    END IF;

    -- Verifica se o registro no mestre estoque existe (Requirement: No creation)
    SELECT EXISTS (
        SELECT 1 FROM public.estoque 
        WHERE empresa_id = NEW.empresa_id 
          AND produto_id = NEW.produto_id 
          AND deposito_id = NEW.deposito_id
    ) INTO v_existe_estoque;

    IF NOT v_existe_estoque THEN
        RAISE EXCEPTION 'Erro: Produto ID % não possui configuração de estoque para o Depósito ID % na Empresa %. O registro deve ser criado manualmente antes da movimentação.', 
            NEW.produto_id, NEW.deposito_id, NEW.empresa_id;
    END IF;

    -- Atualiza o mestre estoque somando a movimentação
    IF NEW.qt_movimento > 0 THEN
        UPDATE public.estoque 
        SET estoque_fisico = COALESCE(estoque_fisico, 0) + NEW.qt_movimento,
            dt_ult_entrada = now(),
            dt_alteracao = now()
        WHERE empresa_id = NEW.empresa_id 
          AND produto_id = NEW.produto_id 
          AND deposito_id = NEW.deposito_id
        RETURNING estoque_fisico INTO v_estoque_fisico_novo;
    ELSE
        UPDATE public.estoque 
        SET estoque_fisico = COALESCE(estoque_fisico, 0) + NEW.qt_movimento,
            dt_ult_saida = now(),
            dt_alteracao = now()
        WHERE empresa_id = NEW.empresa_id 
          AND produto_id = NEW.produto_id 
          AND deposito_id = NEW.deposito_id
        RETURNING estoque_fisico INTO v_estoque_fisico_novo;
    END IF;

    -- Calcula o estoque geral consolidado do produto na empresa
    SELECT SUM(estoque_fisico) 
    INTO v_estoque_geral_novo
    FROM public.estoque
    WHERE empresa_id = NEW.empresa_id 
      AND produto_id = NEW.produto_id;

    -- Preenche campos automáticos de auditoria no Log
    NEW.qt_estoque_deposito := v_estoque_fisico_novo;
    NEW.qt_estoque_geral := v_estoque_geral_novo;
    NEW.dt_hs_log := now();
    
    -- Tenta capturar o usuário logado se não fornecido
    IF NEW.usuario IS NULL OR NEW.usuario = '' THEN
       NEW.usuario := COALESCE(
           current_setting('request.jwt.claims', true)::jsonb->>'email',
           'SISTEMA'
       );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_processa_estoque_log() OWNER TO postgres;

--
-- Name: fn_set_cd_cadastro(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_set_cd_cadastro() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cd_cadastro IS NULL THEN
    SELECT COALESCE(MAX(cd_cadastro), 0) + 1
    INTO NEW.cd_cadastro
    FROM public.cadastro
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_set_cd_cadastro() OWNER TO postgres;

--
-- Name: fn_set_cd_cadastro_grupo(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fn_set_cd_cadastro_grupo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cd_cadastro_grupo IS NULL THEN
    SELECT COALESCE(MAX(cd_cadastro_grupo), 0) + 1
    INTO NEW.cd_cadastro_grupo
    FROM public.cadastro_grupo
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_set_cd_cadastro_grupo() OWNER TO postgres;

--
-- Name: fu_baixar_titulos_cliente(integer, character varying, character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    CALL public.pcdr_baixar_titulos(p_cadastro_id, p_vl_recebido, p_recibo, p_conta_id, p_tipo_pag_rec_id);
END;
$$;


ALTER FUNCTION public.fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer) OWNER TO postgres;

--
-- Name: fu_calcular_impostos_movimento(bigint, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text DEFAULT '55'::text, p_serie text DEFAULT '001'::text, p_nr_nota text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_mov            RECORD;
  v_emp            RECORD;
  v_cad            RECORD;
  v_uf_dest        text;
  v_uf_orig        text;
  v_cli            text;       -- 'C','N','I','F'
  v_cli_bool       boolean;    -- mapeado para coluna boolean cliente_contribuinte
  v_regra_id       int;
  v_regime         text;
  v_item           RECORD;
  v_prod           RECORD;
  v_grupo_id       int;

  v_ri             RECORD;
  v_cfop_row       RECORD;
  v_cfop_cd        text;

  v_qt             numeric;
  v_vl_unit        numeric;
  v_vl_bruto       numeric;
  v_vl_desc        numeric;
  v_vl_liq         numeric;
  v_vl_prod_total  numeric;
  v_rateio_frete   numeric;
  v_rateio_seguro  numeric;
  v_rateio_outro   numeric;

  v_bc_icms        numeric;
  v_vl_icms        numeric;
  v_bc_st          numeric;
  v_vl_st          numeric;
  v_vl_ipi         numeric;
  v_vl_pis         numeric;
  v_vl_cofins      numeric;
  v_vl_ibs         numeric;
  v_vl_cbs         numeric;
  v_vl_is          numeric;
  v_vl_fcp         numeric;
  v_vl_fcp_st      numeric;
  v_vl_cred_sn     numeric;

  v_csosn          text;
  v_cst_icms       text;

  v_t_prod    numeric := 0;
  v_t_desc    numeric := 0;
  v_t_bc      numeric := 0;
  v_t_icms    numeric := 0;
  v_t_bcst    numeric := 0;
  v_t_st      numeric := 0;
  v_t_ipi     numeric := 0;
  v_t_pis     numeric := 0;
  v_t_cofins  numeric := 0;
  v_t_ibs     numeric := 0;
  v_t_cbs     numeric := 0;
  v_t_is      numeric := 0;
  v_t_fcp     numeric := 0;
  v_t_fcpst   numeric := 0;

  v_nfe_id    bigint;
  v_nr        int := 0;
  v_errors    text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v_mov FROM public.movimento WHERE movimento_id = p_movimento_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'FISCAL_CALC: movimento % não encontrado', p_movimento_id; END IF;

  SELECT e.*, c.estado_id AS uf
    INTO v_emp
    FROM public.empresa e
    LEFT JOIN public.cidade c ON c.cidade_id = e.endereco_cidade_id
   WHERE e.empresa_id = v_mov.empresa_id;
  IF v_emp IS NULL THEN RAISE EXCEPTION 'FISCAL_CALC: empresa não encontrada'; END IF;
  v_regime  := COALESCE(v_emp.regime_trib, 'S');
  v_uf_orig := COALESCE(v_emp.uf, 'SP');

  SELECT cad.*, c.estado_id AS uf
    INTO v_cad
    FROM public.cadastro cad
    LEFT JOIN public.cidade c ON c.cidade_id = cad.endereco_cidade_id
   WHERE cad.cadastro_id = v_mov.cadastro_id;
  v_uf_dest := COALESCE(v_cad.uf, v_uf_orig);

  IF v_cad IS NULL THEN
    v_cli := 'F';
  ELSIF UPPER(COALESCE(v_cad.tp_contribuinte,'')) IN ('S','C','1') THEN
    v_cli := 'C';
  ELSIF UPPER(COALESCE(v_cad.tp_contribuinte,'')) IN ('I','2') THEN
    v_cli := 'I';
  ELSIF UPPER(COALESCE(v_cad.tp_pessoa,'')) = 'F' THEN
    v_cli := 'F';
  ELSE
    v_cli := 'N';
  END IF;
  v_cli_bool := (v_cli = 'C');

  SELECT fiscal_regra_id INTO v_regra_id
    FROM public.fiscal_regra
   WHERE empresa_id = v_mov.empresa_id
     AND excluido = false
     AND (tp_operacao_id = v_mov.tp_operacao_id OR tp_operacao_id IS NULL)
     AND (regime_trib = v_regime OR regime_trib IS NULL OR regime_trib = '')
   ORDER BY (tp_operacao_id = v_mov.tp_operacao_id) DESC,
            COALESCE(prioridade,0) DESC,
            fiscal_regra_id DESC
   LIMIT 1;
  IF v_regra_id IS NULL THEN
    RAISE EXCEPTION 'FISCAL_CALC: nenhuma fiscal_regra para empresa % / tp_operacao % / regime %',
      v_mov.empresa_id, v_mov.tp_operacao_id, v_regime;
  END IF;

  SELECT COALESCE(SUM(qt_movimento * vl_und_produto - COALESCE(vl_desconto,0)),0)
    INTO v_vl_prod_total
    FROM public.movimento_item
   WHERE movimento_id = p_movimento_id AND excluido = false;
  IF v_vl_prod_total <= 0 THEN v_vl_prod_total := 1; END IF;

  INSERT INTO public.fiscal_nfe_cabecalho (
    empresa_id, cadastro_id, movimento_id, modelo, serie, nr_nota,
    tp_nf, fin_nfe, tp_emis, nat_op, origem_inclusao, st_nf,
    dt_emissao, dt_saida, vl_produto, vl_desconto, vl_frete, vl_seguro,
    vl_despesa, vl_outro
  ) VALUES (
    v_mov.empresa_id, v_mov.cadastro_id, p_movimento_id, p_modelo, p_serie,
    COALESCE(p_nr_nota,'0'),
    1, 1, 1, 'VENDA DE MERCADORIA', 'M', 'A',
    CURRENT_DATE, CURRENT_DATE, 0, 0,
    COALESCE(v_mov.vl_frete,0), COALESCE(v_mov.vl_seguro,0),
    COALESCE(v_mov.vl_despesa,0), COALESCE(v_mov.vl_outro,0)
  ) RETURNING nfe_cabecalho_id INTO v_nfe_id;

  FOR v_item IN
    SELECT * FROM public.movimento_item
     WHERE movimento_id = p_movimento_id AND excluido = false
     ORDER BY movimento_item_id
  LOOP
    v_nr := v_nr + 1;

    SELECT * INTO v_prod FROM public.produto WHERE produto_id = v_item.produto_id;
    IF v_prod IS NULL THEN
      v_errors := v_errors || format('item %s: produto não encontrado', v_nr);
      CONTINUE;
    END IF;

    v_qt       := COALESCE(v_item.qt_movimento, 0);
    v_vl_unit  := COALESCE(v_item.vl_und_produto, 0);
    v_vl_bruto := v_qt * v_vl_unit;
    v_vl_desc  := COALESCE(v_item.vl_desconto, 0);
    v_vl_liq   := v_vl_bruto - v_vl_desc;

    v_rateio_frete  := public.fu_round_abnt(COALESCE(v_mov.vl_frete,0)  * v_vl_liq / v_vl_prod_total, 2);
    v_rateio_seguro := public.fu_round_abnt(COALESCE(v_mov.vl_seguro,0) * v_vl_liq / v_vl_prod_total, 2);
    v_rateio_outro  := public.fu_round_abnt((COALESCE(v_mov.vl_despesa,0)+COALESCE(v_mov.vl_outro,0)) * v_vl_liq / v_vl_prod_total, 2);

    SELECT rc.*, c.cd_cfop INTO v_cfop_row
      FROM public.fiscal_regra_cfop rc
      LEFT JOIN public.cfop c ON c.cfop_id = rc.cfop_id
     WHERE rc.fiscal_regra_id = v_regra_id
       AND (rc.uf_destino = v_uf_dest OR rc.uf_destino = 'ZZ' OR rc.uf_destino IS NULL OR rc.uf_destino = '')
       AND (rc.fiscal_grupo_produto_id = v_prod.grupo_icms_id OR rc.fiscal_grupo_produto_id IS NULL)
       AND (rc.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text OR rc.origem_produto::text = '99' OR rc.origem_produto IS NULL OR rc.origem_produto::text = '')
       AND (rc.ncm_filtro = COALESCE(v_prod.ncm,'') OR rc.ncm_filtro = '99999999' OR rc.ncm_filtro IS NULL OR rc.ncm_filtro = '')
       AND (rc.cliente_contribuinte = v_cli_bool OR rc.cliente_contribuinte IS NULL)
     ORDER BY (rc.uf_destino = v_uf_dest) DESC,
              (rc.fiscal_grupo_produto_id = v_prod.grupo_icms_id) DESC,
              (rc.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text) DESC,
              (rc.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC,
              (rc.cliente_contribuinte = v_cli_bool) DESC
     LIMIT 1;

    v_cfop_cd := COALESCE(v_cfop_row.cd_cfop, '5102');
    IF v_cfop_row IS NULL THEN
      v_errors := v_errors || format('item %s: CFOP não encontrado para UF %s', v_nr, v_uf_dest);
    END IF;

    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'ICMS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_icms_id OR ri.fiscal_grupo_produto_id IS NULL)
       AND (ri.uf_destino = v_uf_dest OR ri.uf_destino = 'ZZ' OR ri.uf_destino IS NULL OR ri.uf_destino = '')
       AND (ri.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text OR ri.origem_produto::text = '99' OR ri.origem_produto IS NULL OR ri.origem_produto::text = '')
       AND (ri.ncm_filtro = COALESCE(v_prod.ncm,'') OR ri.ncm_filtro = '99999999' OR ri.ncm_filtro IS NULL OR ri.ncm_filtro = '')
       AND (ri.cliente_contribuinte = v_cli_bool OR ri.cliente_contribuinte IS NULL)
     ORDER BY (ri.uf_destino = v_uf_dest) DESC,
              (ri.fiscal_grupo_produto_id = v_prod.grupo_icms_id) DESC,
              (ri.origem_produto::text = COALESCE(v_prod.tb_a_origem,'0')::text) DESC,
              (ri.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC,
              (ri.cliente_contribuinte = v_cli_bool) DESC
     LIMIT 1;

    v_csosn := NULL; v_cst_icms := NULL;
    v_bc_icms := 0; v_vl_icms := 0; v_bc_st := 0; v_vl_st := 0;
    v_vl_fcp := 0; v_vl_fcp_st := 0; v_vl_cred_sn := 0;

    IF v_ri IS NULL THEN
      v_errors := v_errors || format('item %s: sem regra ICMS para grupo %s/UF %s', v_nr, v_prod.grupo_icms_id, v_uf_dest);
    ELSE
      IF v_regime = 'S' THEN v_csosn := v_ri.cst_csosn; ELSE v_cst_icms := v_ri.cst_csosn; END IF;
      v_bc_icms := public.fu_round_abnt(v_vl_liq * (1 - COALESCE(v_ri.base_reducao,0)/100), 2);
      v_vl_icms := public.fu_round_abnt(v_bc_icms * COALESCE(v_ri.aliquota,0)/100, 2);
      IF COALESCE(v_ri.icms_st_aliquota,0) > 0 THEN
        v_bc_st := public.fu_round_abnt(v_vl_liq * (1 + COALESCE(v_ri.icms_st_mva,0)/100) * (1 - COALESCE(v_ri.icms_st_base_reducao,0)/100), 2);
        v_vl_st := public.fu_round_abnt(v_bc_st * v_ri.icms_st_aliquota/100 - v_vl_icms, 2);
        IF v_vl_st < 0 THEN v_vl_st := 0; END IF;
      END IF;
      IF v_regime = 'S' AND COALESCE(v_ri.p_cre_sn,0) > 0 THEN
        v_vl_cred_sn := public.fu_round_abnt(v_vl_liq * v_ri.p_cre_sn/100, 2);
      END IF;
    END IF;

    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'IPI'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_ipi_id OR ri.fiscal_grupo_produto_id IS NULL)
       AND (ri.uf_destino = v_uf_dest OR ri.uf_destino = 'ZZ' OR ri.uf_destino IS NULL OR ri.uf_destino = '')
       AND (ri.ncm_filtro = COALESCE(v_prod.ncm,'') OR ri.ncm_filtro = '99999999' OR ri.ncm_filtro IS NULL OR ri.ncm_filtro = '')
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_ipi_id) DESC,
              (ri.ncm_filtro = COALESCE(v_prod.ncm,'')) DESC
     LIMIT 1;
    v_vl_ipi := CASE WHEN v_ri IS NULL THEN 0
                     ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'PIS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id) DESC
     LIMIT 1;
    v_vl_pis := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) = 'COFINS'
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_pis_cofins_id) DESC
     LIMIT 1;
    v_vl_cofins := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.aliquota,0)/100, 2) END;

    SELECT * INTO v_ri FROM public.fiscal_regra_item ri
     WHERE ri.fiscal_regra_id = v_regra_id
       AND UPPER(ri.tipo_imposto) IN ('CBSIBS','IBSCBS','IBS')
       AND (ri.fiscal_grupo_produto_id = v_prod.grupo_ibscbs_id OR ri.fiscal_grupo_produto_id IS NULL)
     ORDER BY (ri.fiscal_grupo_produto_id = v_prod.grupo_ibscbs_id) DESC
     LIMIT 1;
    v_vl_ibs := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.ibs_aliquota,0)/100, 2) END;
    v_vl_cbs := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.cbs_aliquota,0)/100, 2) END;
    v_vl_is  := CASE WHEN v_ri IS NULL THEN 0 ELSE public.fu_round_abnt(v_vl_liq * COALESCE(v_ri.is_aliquota,0)/100, 2) END;

    INSERT INTO public.fiscal_nfe_item (
      nfe_cabecalho_id, empresa_id, produto_id, nr_item, cd_prod_fornec,
      nm_produto, ncm, cest, gtin, cfop, unidade,
      qt_entrada, vl_unit, vl_desconto, vl_total,
      vl_frete, vl_seguro, vl_outro,
      qt_tributavel, vl_unit_tributavel,
      origem, csosn, cst_icms,
      vl_bc, pc_icms, vl_icms,
      mod_bc, pc_red_bc, pc_cred_sn, vl_cred_sn,
      vl_bc_st, pc_icms_st, vl_icms_st, mod_bc_st, pc_red_bc_st,
      cst_ipi, c_enq, vl_bc_ipi, pc_ipi, vl_ipi,
      cst_pis, vl_bc_pis, pc_pis, vl_pis,
      cst_cofins, vl_bc_cofins, pc_cofins, vl_cofins,
      cst_ibs, pc_ibs, vl_ibs,
      cst_cbs, pc_cbs, vl_cbs,
      cst_is,  pc_is,  vl_is
    ) VALUES (
      v_nfe_id, v_mov.empresa_id, v_prod.produto_id, v_nr,
      COALESCE(v_prod.referencia, v_prod.produto_id::text),
      COALESCE(v_item.nm_produto, v_prod.nome),
      COALESCE(v_prod.ncm,''), COALESCE(v_prod.cest,''),
      COALESCE(NULLIF(v_prod.gtin,''),'SEM GTIN'),
      v_cfop_cd, COALESCE(v_prod.unidade_id::text,'UN'),
      v_qt, v_vl_unit, v_vl_desc, v_vl_liq,
      v_rateio_frete, v_rateio_seguro, v_rateio_outro,
      v_qt, v_vl_unit,
      COALESCE(NULLIF(v_prod.tb_a_origem, '')::smallint, 0),
      COALESCE(v_csosn,''), COALESCE(v_cst_icms,''),
      v_bc_icms, COALESCE((SELECT aliquota FROM public.fiscal_regra_item WHERE fiscal_regra_id=v_regra_id AND UPPER(tipo_imposto)='ICMS' AND (fiscal_grupo_produto_id=v_prod.grupo_icms_id OR fiscal_grupo_produto_id IS NULL) LIMIT 1),0),
      v_vl_icms,
      3, 0, 0, v_vl_cred_sn,
      v_bc_st, 0, v_vl_st, 4, 0,
      '', '999', v_vl_liq, 0, v_vl_ipi,
      '49', v_vl_liq, 0, v_vl_pis,
      '49', v_vl_liq, 0, v_vl_cofins,
      '', 0, v_vl_ibs,
      '', 0, v_vl_cbs,
      '', 0, v_vl_is
    );

    v_t_prod   := v_t_prod   + v_vl_bruto;
    v_t_desc   := v_t_desc   + v_vl_desc;
    v_t_bc     := v_t_bc     + v_bc_icms;
    v_t_icms   := v_t_icms   + v_vl_icms;
    v_t_bcst   := v_t_bcst   + v_bc_st;
    v_t_st     := v_t_st     + v_vl_st;
    v_t_ipi    := v_t_ipi    + v_vl_ipi;
    v_t_pis    := v_t_pis    + v_vl_pis;
    v_t_cofins := v_t_cofins + v_vl_cofins;
    v_t_ibs    := v_t_ibs    + v_vl_ibs;
    v_t_cbs    := v_t_cbs    + v_vl_cbs;
    v_t_is     := v_t_is     + v_vl_is;
    v_t_fcp    := v_t_fcp    + v_vl_fcp;
    v_t_fcpst  := v_t_fcpst  + v_vl_fcp_st;
  END LOOP;

  UPDATE public.fiscal_nfe_cabecalho SET
    vl_produto   = public.fu_round_abnt(v_t_prod,2),
    vl_desconto  = public.fu_round_abnt(v_t_desc,2),
    vl_bc        = public.fu_round_abnt(v_t_bc,2),
    vl_icms      = public.fu_round_abnt(v_t_icms,2),
    vl_icms_st   = public.fu_round_abnt(v_t_st,2),
    vl_ipi       = public.fu_round_abnt(v_t_ipi,2),
    vl_pis       = public.fu_round_abnt(v_t_pis,2),
    vl_cofins    = public.fu_round_abnt(v_t_cofins,2),
    vl_ibs       = public.fu_round_abnt(v_t_ibs,2),
    vl_cbs       = public.fu_round_abnt(v_t_cbs,2),
    vl_is        = public.fu_round_abnt(v_t_is,2),
    vl_fcp       = public.fu_round_abnt(v_t_fcp,2),
    vl_fcp_st    = public.fu_round_abnt(v_t_fcpst,2),
    vl_total_nf  = public.fu_round_abnt(
                     v_t_prod - v_t_desc + v_t_st + v_t_ipi + v_t_fcp + v_t_fcpst
                     + COALESCE(v_mov.vl_frete,0) + COALESCE(v_mov.vl_seguro,0)
                     + COALESCE(v_mov.vl_despesa,0) + COALESCE(v_mov.vl_outro,0), 2),
    obs_nf = CASE WHEN array_length(v_errors,1) IS NULL THEN COALESCE(v_mov.observacao,'')
                  ELSE COALESCE(v_mov.observacao,'') || E'\n[CALC] ' || array_to_string(v_errors, ' | ') END
  WHERE nfe_cabecalho_id = v_nfe_id;

  BEGIN
    EXECUTE 'UPDATE public.movimento SET nfe_cabecalho_id = $1 WHERE movimento_id = $2'
      USING v_nfe_id, p_movimento_id;
  EXCEPTION WHEN undefined_column THEN NULL;
  END;

  IF array_length(v_errors,1) IS NOT NULL THEN
    RAISE EXCEPTION 'FISCAL_CALC_ERRORS: %', array_to_string(v_errors,' | ');
  END IF;

  RETURN v_nfe_id;
END;
$_$;


ALTER FUNCTION public.fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text, p_serie text, p_nr_nota text) OWNER TO postgres;

--
-- Name: fu_chat_is_membro(bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_chat_is_membro(_sala_id bigint, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_sala_membro
    WHERE chat_sala_id = _sala_id AND user_id = _user_id
  );
$$;


ALTER FUNCTION public.fu_chat_is_membro(_sala_id bigint, _user_id uuid) OWNER TO postgres;

--
-- Name: fu_chat_sala_touch(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_chat_sala_touch() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.chat_sala SET dt_atualizacao = now() WHERE chat_sala_id = NEW.chat_sala_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fu_chat_sala_touch() OWNER TO postgres;

--
-- Name: fu_chat_touch_conversa(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_chat_touch_conversa() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.chat_conversa SET dt_atualizacao = now() WHERE chat_conversa_id = NEW.chat_conversa_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fu_chat_touch_conversa() OWNER TO postgres;

--
-- Name: fu_finalizar_ajuste_estoque(bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_mov RECORD;
    v_item RECORD;
    v_deposito_nome text;
    v_estoque_atual numeric;
    v_estoque_novo numeric;
    v_qt_fisica numeric;
    v_usuario_email text;
BEGIN
    -- 1. Obter e validar o movimento principal
    SELECT * INTO v_mov 
    FROM movimento 
    WHERE movimento_id = _movimento_id 
      AND excluido = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Ajuste de estoque não encontrado.');
    END IF;

    -- Garantir que é um ajuste de estoque
    IF v_mov.tp_movimento != 'AE' THEN
        RETURN jsonb_build_object('error', 'O tipo de movimento não é Ajuste de Estoque (AE).');
    END IF;

    -- Verificar se já foi finalizado
    IF v_mov.status = 'F' THEN
        RETURN jsonb_build_object('error', 'Este ajuste de estoque já foi finalizado.');
    END IF;

    -- Obter e-mail do usuário realizador do ajuste
    IF _usuario_id IS NOT NULL THEN
        SELECT email INTO v_usuario_email 
        FROM auth.users 
        WHERE id = _usuario_id;
    END IF;
    IF v_usuario_email IS NULL THEN
        v_usuario_email := 'SISTEMA';
    END IF;

    -- 2. ETAPA DE PRÉ-VALIDAÇÃO (Estoque Não-Negativo)
    FOR v_item IN 
        SELECT mi.* 
        FROM movimento_item mi
        WHERE mi.movimento_id = _movimento_id 
          AND mi.excluido = false
    LOOP
        -- Se o depósito não estiver definido no item, herdar do cabeçalho
        IF v_item.deposito_id IS NULL THEN
            v_item.deposito_id := v_mov.deposito_id;
        END IF;

        IF v_item.deposito_id IS NULL THEN
            RETURN jsonb_build_object('error', 'O produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ' não possui depósito definido.');
        END IF;

        -- Obter estoque físico atual
        SELECT COALESCE(estoque_fisico, 0) INTO v_estoque_atual
        FROM estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_item.deposito_id
          AND empresa_id = v_mov.empresa_id;

        IF v_estoque_atual IS NULL THEN
            v_estoque_atual := 0;
        END IF;

        -- Calcular estoque projetado
        IF v_item.tp_ajs_estoque = 'A' THEN
            v_estoque_novo := v_estoque_atual + v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'R' THEN
            v_estoque_novo := v_estoque_atual - v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'M' THEN
            v_estoque_novo := v_item.qt_movimento;
        ELSE
            RETURN jsonb_build_object('error', 'O item com produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ' possui tipo de ajuste (tp_ajs_estoque) inválido: ' || COALESCE(v_item.tp_ajs_estoque, 'Nulo'));
        END IF;

        -- Validar estoque não-negativo
        IF v_estoque_novo < 0 THEN
            SELECT nm_deposito INTO v_deposito_nome FROM deposito WHERE deposito_id = v_item.deposito_id;
            RETURN jsonb_build_object('error', 'Validação de estoque: O produto ''' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ''' no depósito ''' || COALESCE(v_deposito_nome, 'ID ' || v_item.deposito_id) || ''' ficaria com saldo negativo (' || v_estoque_novo || ' unidades). Operação abortada.');
        END IF;
    END LOOP;

    -- 3. ETAPA DE PROCESSAMENTO (Inserção no estoque_log e atualização de status)
    FOR v_item IN 
        SELECT mi.* 
        FROM movimento_item mi
        WHERE mi.movimento_id = _movimento_id 
          AND mi.excluido = false
    LOOP
        -- Se o depósito não estiver definido no item, herdar do cabeçalho
        IF v_item.deposito_id IS NULL THEN
            v_item.deposito_id := v_mov.deposito_id;
        END IF;

        -- Garantir que existe o registro mestre na tabela estoque
        IF NOT EXISTS (
            SELECT 1 FROM estoque
            WHERE produto_id = v_item.produto_id
              AND deposito_id = v_item.deposito_id
              AND empresa_id = v_mov.empresa_id
        ) THEN
            INSERT INTO estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado, estoque_disponivel, dt_criacao, dt_alteracao)
            VALUES (v_mov.empresa_id, v_item.produto_id, v_item.deposito_id, 0, 0, 0, now(), now());
        END IF;

        -- Obter estoque físico atual (agora garantido)
        SELECT COALESCE(estoque_fisico, 0) INTO v_estoque_atual
        FROM estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_item.deposito_id
          AND empresa_id = v_mov.empresa_id;

        -- Calcular a variação a ser enviada para a trigger do estoque_log
        IF v_item.tp_ajs_estoque = 'A' THEN
            v_qt_fisica := v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'R' THEN
            v_qt_fisica := -v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'M' THEN
            v_qt_fisica := v_item.qt_movimento - v_estoque_atual;
        END IF;

        -- Inserir na tabela estoque_log. A trigger tr_estoque_log_processamento 
        -- tratará o update no estoque e recalculará os saldos.
        INSERT INTO estoque_log (
            empresa_id,
            produto_id,
            deposito_id,
            qt_movimento,
            usuario,
            operacao,
            origem,
            nr_doc,
            dt_hs_log
        ) VALUES (
            v_mov.empresa_id,
            v_item.produto_id,
            v_item.deposito_id,
            v_qt_fisica,
            v_usuario_email,
            'AJUSTE',
            'AJUSTE_ESTOQUE',
            COALESCE(v_mov.nr_movimento::text, v_mov.movimento_id::text),
            now()
        );
    END LOOP;

    -- 4. Atualizar o cabeçalho do movimento
    UPDATE movimento 
    SET status = 'F',
        dt_finalizacao = now(),
        dt_alteracao = now()
    WHERE movimento_id = _movimento_id;

    -- 5. Gravar na auditoria do sistema
    INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES (
        'movimento', 
        _movimento_id::text, 
        'FINALIZAR_AJUSTE_ESTOQUE', 
        jsonb_build_object('status', v_mov.status), 
        jsonb_build_object('status', 'F'), 
        _usuario_id
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ajuste de estoque finalizado com sucesso!');
END;
$$;


ALTER FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid) OWNER TO postgres;

--
-- Name: fu_form_permissao(uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text) RETURNS TABLE(fl_visualizar boolean, fl_incluir boolean, fl_alterar boolean, fl_excluir_registro boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    CASE WHEN public.fu_is_admin(_user_id, _empresa_id) THEN TRUE
    ELSE COALESCE(bool_or(paf.fl_visualizar), TRUE) END,
    CASE WHEN public.fu_is_admin(_user_id, _empresa_id) THEN TRUE
    ELSE COALESCE(bool_or(paf.fl_incluir), FALSE) END,
    CASE WHEN public.fu_is_admin(_user_id, _empresa_id) THEN TRUE
    ELSE COALESCE(bool_or(paf.fl_alterar), FALSE) END,
    CASE WHEN public.fu_is_admin(_user_id, _empresa_id) THEN TRUE
    ELSE COALESCE(bool_or(paf.fl_excluir_registro), FALSE) END
  FROM public.perfil_acesso_formulario paf
  JOIN public.perfil_usuario pu ON pu.perfil_id = paf.perfil_id AND pu.empresa_id = paf.empresa_id
  WHERE pu.user_id = _user_id
    AND paf.empresa_id = _empresa_id
    AND paf.nm_formulario = _nm_formulario
    AND paf.fl_excluido = FALSE
    AND pu.fl_excluido = FALSE
$$;


ALTER FUNCTION public.fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text) OWNER TO postgres;

--
-- Name: fu_get_cliente_public(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_get_cliente_public(_cpf text) RETURNS TABLE(id bigint, razao_social text, fone_geral text, dep_nome1 text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
BEGIN
  -- First, check main system's cadastro
  RETURN QUERY
  SELECT 
    c.cadastro_id AS id, 
    c.razao_social::text AS razao_social, 
    c.fone_geral::text AS fone_geral, 
    c.dep_nome1::text AS dep_nome1
  FROM public.cadastro c
  WHERE c.excluido = false
    AND c.cnpj = v_cpf
  ORDER BY c.cadastro_id DESC
  LIMIT 1;

  -- If not found in cadastro, check the external cliente table
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      cl.id, 
      cl.razao_social, 
      cl.fone_geral, 
      cl.dep_nome1
    FROM public.cliente cl
    WHERE cl.xnr_cpf_cnpj = v_cpf
    ORDER BY cl.id DESC
    LIMIT 1;
  END IF;
END;
$$;


ALTER FUNCTION public.fu_get_cliente_public(_cpf text) OWNER TO postgres;

--
-- Name: fu_get_parametro_publico(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_get_parametro_publico() RETURNS TABLE(id bigint, xnm_escola text, xcor_primaria text, xcor_secundaria text, xcor_destaque text, xcor_fundo text, xcor_fundo_card text, xcor_texto_principal text, xcor_texto_secundario text, xcor_botao text, xcor_botao_negativo text, xcor_header text, xcor_link text, xcor_menu text, xurl_logo text, xurl_favicon text, xurl_banner_vendas text, xurl_link_vendas text, xmsg_pos_pagamento text, xlg_valida_estoque_link boolean, xlg_valida_estoque_pdv boolean, xcss_customizado text, xnm_aba_lojavirtual text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.empresa_id AS id, 
    COALESCE(e.nm_escola, e.nome_fantasia, e.razao_social) AS xnm_escola,
    e.cor_primaria AS xcor_primaria, 
    e.cor_secundaria AS xcor_secundaria, 
    e.cor_destaque AS xcor_destaque, 
    e.cor_fundo AS xcor_fundo, 
    e.cor_fundo_card AS xcor_fundo_card,
    e.cor_texto_principal AS xcor_texto_principal, 
    e.cor_texto_secundario AS xcor_texto_secundario, 
    e.cor_botao AS xcor_botao,
    e.cor_botao_negativo AS xcor_botao_negativo, 
    e.cor_header AS xcor_header, 
    e.cor_link AS xcor_link, 
    e.cor_menu AS xcor_menu,
    e.url_logo AS xurl_logo, 
    e.url_favicon AS xurl_favicon, 
    e.url_banner_vendas AS xurl_banner_vendas, 
    e.url_link_vendas AS xurl_link_vendas,
    e.msg_pos_pagamento AS xmsg_pos_pagamento, 
    e.lg_valida_estoque_link AS xlg_valida_estoque_link, 
    e.lg_valida_estoque_pdv AS xlg_valida_estoque_pdv,
    e.css_customizado AS xcss_customizado,
    COALESCE(e.nm_aba_lojavirtual, 'Cardápio') AS xnm_aba_lojavirtual
  FROM public.empresa e
  WHERE e.excluido = false
  ORDER BY e.empresa_id ASC
  LIMIT 1;
END;
$$;


ALTER FUNCTION public.fu_get_parametro_publico() OWNER TO postgres;

--
-- Name: fu_get_pedido_status_public(bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_get_pedido_status_public(_pedido_id bigint, _cpf text) RETURNS TABLE(id bigint, nr_movimento bigint, st_pedido text, dt_emissao timestamp with time zone, vl_movimento numeric, url_pagamento text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    em.emovimento_id AS id,
    em.nr_movimento,
    em.st_pedido::text,
    em.dt_emissao,
    em.vl_movimento::numeric,
    em.url_pagamento
  FROM public.emovimento em
  JOIN public.cliente cl
    ON cl.id = em.cliente_id
  WHERE em.emovimento_id = _pedido_id
    AND em.excluido = false
    AND cl.cnpj = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  LIMIT 1;
$$;


ALTER FUNCTION public.fu_get_pedido_status_public(_pedido_id bigint, _cpf text) OWNER TO postgres;

--
-- Name: fu_is_admin(uuid, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfil_usuario pu
    JOIN public.perfil p ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
    WHERE pu.user_id = _user_id
      AND pu.empresa_id = _empresa_id
      AND pu.fl_excluido = FALSE
      AND p.fl_administrador = TRUE
      AND p.fl_excluido = FALSE
  )
$$;


ALTER FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint) OWNER TO postgres;

--
-- Name: fu_is_admin_any(uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_is_admin_any(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfil_usuario pu
    JOIN public.perfil p
      ON p.perfil_id = pu.perfil_id AND p.empresa_id = pu.empresa_id
    WHERE pu.user_id = _user_id
      AND pu.fl_excluido = FALSE
      AND p.fl_administrador = TRUE
      AND p.fl_excluido = FALSE
  )
$$;


ALTER FUNCTION public.fu_is_admin_any(_user_id uuid) OWNER TO postgres;

--
-- Name: fu_list_pedidos_public(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_list_pedidos_public(_cpf text) RETURNS TABLE(id bigint, nr_movimento bigint, dt_emissao timestamp with time zone, vl_movimento numeric, st_pedido text, items jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    em.emovimento_id AS id,
    em.nr_movimento,
    em.dt_emissao,
    em.vl_movimento::numeric,
    em.st_pedido::text,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'xnm_produto', emi.nm_produto,
          'xqt_item', emi.qt_movimento,
          'xvl_unitario', emi.vl_und_produto,
          'xproduto_id', emi.produto_id
        )
        ORDER BY emi.emovimento_item_id
      ) FILTER (WHERE emi.emovimento_item_id IS NOT NULL),
      '[]'::jsonb
    ) AS items
  FROM public.emovimento em
  JOIN public.cliente cl
    ON cl.id = em.cliente_id
  LEFT JOIN public.emovimento_item emi
    ON emi.emovimento_id = em.emovimento_id
   AND emi.excluido = false
  WHERE em.excluido = false
    AND cl.cnpj = regexp_replace(coalesce(_cpf, ''), '\D', '', 'g')
  GROUP BY em.emovimento_id, em.nr_movimento, em.dt_emissao, em.vl_movimento, em.st_pedido
  ORDER BY em.dt_emissao DESC
  LIMIT 10;
$$;


ALTER FUNCTION public.fu_list_pedidos_public(_cpf text) OWNER TO postgres;

--
-- Name: fu_menu_visivel(uuid, bigint, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT 
    CASE 
      WHEN public.fu_is_admin(_user_id, _empresa_id) THEN TRUE
      ELSE COALESCE((
        SELECT pam.fl_visivel
        FROM public.perfil_acesso_menu pam
        JOIN public.perfil_usuario pu ON pu.perfil_id = pam.perfil_id AND pu.empresa_id = pam.empresa_id
        WHERE pu.user_id = _user_id
          AND pam.empresa_id = _empresa_id
          AND pam.nm_menu = _nm_menu
          AND pam.fl_excluido = FALSE
          AND pu.fl_excluido = FALSE
        ORDER BY pam.fl_visivel DESC
        LIMIT 1
      ), FALSE)
    END
$$;


ALTER FUNCTION public.fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text) OWNER TO postgres;

--
-- Name: fu_mudar_status_pedido_pdv(bigint, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE 
    v_mov RECORD; 
    v_item RECORD;
BEGIN
    SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
    IF NOT FOUND THEN 
        RETURN jsonb_build_object('error', 'Movimento não encontrado'); 
    END IF;

    -- REGRA 1: Enviar para o Caixa (O, R -> F)
    IF v_mov.st_pedido IN ('O', 'R') AND _novo_status = 'F' THEN
        IF v_mov.st_pedido = 'O' THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END LOOP;
        END IF;
        UPDATE movimento SET st_pedido = 'F', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 2: Retirar do Caixa (F -> O)
    ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 3: Reservar (O -> V)
    ELSIF v_mov.st_pedido = 'O' AND _novo_status = 'V' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado + v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento SET st_pedido = 'V', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 4: Tirar da Reserva (V -> O)
    ELSIF v_mov.st_pedido = 'V' AND _novo_status = 'O' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            UPDATE estoque 
            SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
            WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
        END LOOP;
        UPDATE movimento_item SET vl_desconto = 0, pc_desconto = 0, vl_movimento = (qt_movimento * vl_und_produto) WHERE movimento_id = _movimento_id AND excluido = false;
        UPDATE movimento SET st_pedido = 'O', dt_alteracao = now(), vl_desconto = 0, pc_desconto = 0, tp_desconto = 'N', vl_movimento = vl_produto WHERE movimento_id = _movimento_id;

    -- REGRA 5: FINALIZAR VENDA / RECEBER (F, O, V -> R)
    ELSIF _novo_status = 'R' THEN
        FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
            -- Se estava no caixa (F) ou reservado (V), remove da reserva E do estoque físico
            IF v_mov.st_pedido IN ('F', 'V') THEN
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento,
                    estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            ELSE
                -- Se era venda direta (O), remove apenas do estoque físico
                UPDATE estoque 
                SET estoque_fisico = estoque_fisico - v_item.qt_movimento
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END IF;
        END LOOP;
        UPDATE movimento SET st_pedido = 'R', dt_alteracao = now() WHERE movimento_id = _movimento_id;

    -- REGRA 6: Cancelar (O, R, V, F -> C)
    ELSIF v_mov.st_pedido IN ('O', 'R', 'V', 'F') AND _novo_status = 'C' THEN
        IF v_mov.st_pedido IN ('R', 'V', 'F') THEN
            FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
                UPDATE estoque 
                SET estoque_reservado = estoque_reservado - v_item.qt_movimento 
                WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
            END LOOP;
        END IF;
        UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now(), dt_alteracao = now() WHERE movimento_id = _movimento_id;

    ELSE
        RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
    END IF;

    -- Auditoria
    INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE_PDV', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);

    RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$$;


ALTER FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid) OWNER TO postgres;

--
-- Name: fu_pdv_confirmar_venda_externa(bigint, bigint, bigint, date, text, bigint, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_emov RECORD;
  v_cl RECORD;
  v_cadastro_id bigint;
  v_movimento_id bigint;
  v_item RECORD;
  v_pag jsonb;
  v_res jsonb;
BEGIN
  -- 1. Load emovimento
  SELECT * INTO v_emov FROM public.emovimento WHERE emovimento_id = _emovimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Pedido da loja virtual não encontrado.');
  END IF;

  IF v_emov.st_pedido = 'F' THEN
    RETURN jsonb_build_object('error', 'Pedido já finalizado no caixa.');
  END IF;

  -- 2. Fetch or create client in public.cadastro
  SELECT * INTO v_cl FROM public.cliente WHERE id = v_emov.cliente_id;
  IF FOUND THEN
    SELECT cadastro_id INTO v_cadastro_id FROM public.cadastro 
    WHERE cnpj = v_cl.cnpj AND excluido = false 
    ORDER BY cadastro_id DESC LIMIT 1;

    IF v_cadastro_id IS NULL THEN
      INSERT INTO public.cadastro (
        empresa_id,
        razao_social,
        cnpj,
        fone_geral,
        dep_nome1,
        tipo_cadastro,
        st_cadastro,
        st_cliente,
        excluido,
        dt_cadastro
      ) VALUES (
        v_emov.empresa_id,
        v_cl.razao_social,
        v_cl.cnpj,
        v_cl.fone_geral,
        v_cl.dep_nome1,
        'C',
        'A',
        'S',
        false,
        now()
      ) RETURNING cadastro_id INTO v_cadastro_id;
    END IF;
  END IF;

  IF v_cadastro_id IS NULL THEN
    v_cadastro_id := v_emov.cadastro_id;
  END IF;

  -- 3. Update cadastro_id in emovimento
  UPDATE public.emovimento SET cadastro_id = v_cadastro_id WHERE emovimento_id = _emovimento_id;

  -- 4. Create internal local movement (draft status so cashier registrar can fatura)
  INSERT INTO public.movimento (
    empresa_id,
    cadastro_id,
    tp_movimento,
    st_pedido, -- 'A' so fu_pdv_registrar_recebimento_venda processes it!
    dt_emissao,
    vl_produto,
    vl_desconto,
    vl_movimento,
    vl_total_nota,
    observacao,
    excluido,
    funcionario_id
  ) VALUES (
    v_emov.empresa_id,
    v_cadastro_id,
    'PD',
    'A',
    now(),
    v_emov.vl_produto,
    v_emov.vl_desconto,
    v_emov.vl_movimento,
    v_emov.vl_movimento,
    'Importado Loja Virtual #' || v_emov.nr_movimento || ' - Resp: ' || v_emov.nm_responsavel,
    false,
    _funcionario_caixa_id
  ) RETURNING movimento_id INTO v_movimento_id;

  -- 5. Copy lines into movimento_item
  FOR v_item IN SELECT * FROM public.emovimento_item WHERE emovimento_id = _emovimento_id AND excluido = false LOOP
    INSERT INTO public.movimento_item (
      empresa_id,
      movimento_id,
      produto_id,
      cd_produto,
      nm_produto,
      unidade_id,
      tp_movimento,
      qt_movimento,
      vl_und_produto,
      vl_produto,
      vl_desconto,
      vl_movimento,
      excluido,
      deposito_id,
      entrega,
      qt_reservada
    ) VALUES (
      v_item.empresa_id,
      v_movimento_id,
      v_item.produto_id,
      v_item.cd_produto,
      v_item.nm_produto,
      v_item.unidade_id,
      v_item.tp_movimento,
      v_item.qt_movimento,
      v_item.vl_und_produto,
      v_item.vl_produto,
      v_item.vl_desconto,
      v_item.vl_movimento,
      false,
      v_item.deposito_id,
      v_item.entrega,
      v_item.qt_reservada
    );
  END LOOP;

  -- 6. Form payments JSONB (meio_pagamento_id = 17 for paid online pix)
  SELECT jsonb_agg(
    jsonb_build_object(
      'vl_recebido', ep.vl_pagamento,
      'condicao_id', COALESCE(ep.condicao_id, 1),
      'condicao_descricao', ep.tp_pagamento,
      'numero_autoriza', COALESCE(ep.nr_autorizacao, ''),
      'qt_parcela', COALESCE(ep.n_parcelas, 1),
      'meio_pagamento_id', 17, -- PIX Dinâmico (Online)
      'plano_conta_id', 1
    )
  ) INTO v_pag
  FROM public.emovimento_pagamento ep
  WHERE ep.emovimento_id = _emovimento_id AND ep.excluido = false;

  IF v_pag IS NULL OR jsonb_array_length(v_pag) = 0 THEN
    v_pag := jsonb_build_array(
      jsonb_build_object(
        'vl_recebido', v_emov.vl_movimento,
        'condicao_id', 1,
        'condicao_descricao', 'PIX ONLINE',
        'numero_autoriza', COALESCE(v_emov.id_transacao_abacatepay, ''),
        'qt_parcela', 1,
        'meio_pagamento_id', 17,
        'plano_conta_id', 1
      )
    );
  END IF;

  -- 7. Call cashier finalizer
  v_res := public.fu_pdv_registrar_recebimento_venda(
    v_emov.empresa_id,
    v_movimento_id,
    _caixa_abertura_id,
    _funcionario_caixa_id,
    _dt_movimento,
    _tp_operacao_caixa,
    _centro_custo_caixa,
    v_pag,
    _usuario_id
  );

  IF v_res->>'error' IS NOT NULL THEN
    RAISE EXCEPTION '%', v_res->>'error';
  END IF;

  -- 8. Mark virtual order as Finalized
  UPDATE public.emovimento 
  SET st_pedido = 'F',
      dt_finalizacao = now()
  WHERE emovimento_id = _emovimento_id;

  RETURN v_res;

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


ALTER FUNCTION public.fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid) OWNER TO postgres;

--
-- Name: fu_pdv_registrar_recebimento_venda(bigint, bigint, bigint, bigint, date, text, bigint, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_mov RECORD;
  v_total_venda numeric;
  v_total_recebido numeric := 0;
  v_troco numeric := 0;
  v_pag_row jsonb;
  v_caixa_mov_id bigint;
  v_meio_pagamento_id integer;
  v_soma_caixa boolean;
  v_valor_somar_caixa numeric := 0;
  v_pag_dinheiro_ajustado numeric;
  v_idx_dinheiro integer := -1;
  v_idx integer := 0;
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  IF v_mov.st_pedido IN ('R', 'C') THEN
    RETURN jsonb_build_object('error', 'Pedido já recebido ou cancelado.');
  END IF;

  v_total_venda := v_mov.vl_movimento;

  -- 2. Limpa pagamentos anteriores do movimento (caso de pedido previamente no caixa)
  DELETE FROM movimento_pagamento WHERE movimento_id = _movimento_id;

  -- 3. Calcula total recebido e troco
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_total_recebido := v_total_recebido + (v_pag_row->>'vl_recebido')::numeric;
  END LOOP;

  v_troco := GREATEST(0, v_total_recebido - v_total_venda);

  -- 4. Grava movimento_pagamento
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    INSERT INTO movimento_pagamento (
      empresa_id, movimento_id, condicao_id, tp_pagamento, vl_pagamento, 
      nr_autorizacao, bandeira_id, operadora_id, n_parcelas, dt_pagamento
    ) VALUES (
      _empresa_id, _movimento_id, (v_pag_row->>'condicao_id')::bigint, v_pag_row->>'condicao_descricao', 
      (v_pag_row->>'vl_recebido')::numeric, COALESCE(v_pag_row->>'numero_autoriza', ''), 
      NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
      (v_pag_row->>'qt_parcela')::integer, now()
    );
  END LOOP;

  -- 5. Grava caixa_movimento
  INSERT INTO caixa_movimento (
    empresa_id, caixa_abertura_id, funcionario_id, colaborador_id, dt_movimento,
    tp_movimento, tp_operacao, centro_custo_id, historico, documento,
    vl_movimento, vl_troco, movimento_id, excluido
  ) VALUES (
    _empresa_id, _caixa_abertura_id, _funcionario_caixa_id, _funcionario_caixa_id, _dt_movimento,
    'E', _tp_operacao_caixa, _centro_custo_caixa, 'Recebimento Pedido ' || v_mov.nr_movimento, v_mov.nr_movimento::text,
    v_total_venda, v_troco, _movimento_id, false
  ) RETURNING caixa_movimento_id INTO v_caixa_mov_id;

  -- 6. Prepara itens do caixa (com ajuste de troco no dinheiro)
  FOR v_pag_row IN SELECT * FROM jsonb_array_elements(_pagamentos) LOOP
    v_meio_pagamento_id := (v_pag_row->>'meio_pagamento_id')::integer;
    v_pag_dinheiro_ajustado := (v_pag_row->>'vl_recebido')::numeric;

    -- Se tem troco e é dinheiro (meio_pagamento_id = 1), deduz do valor que entra no caixa
    IF v_troco > 0 AND v_meio_pagamento_id = 1 THEN
      v_pag_dinheiro_ajustado := GREATEST(0, v_pag_dinheiro_ajustado - v_troco);
      -- Consome o troco para nao deduzir de multiplos dinheiros se houver erro no front
      v_troco := 0; 
    END IF;

    -- Só insere no caixa se sobrou valor
    IF v_pag_dinheiro_ajustado > 0 THEN
      INSERT INTO caixa_movimento_item (
        caixa_movimento_id, empresa_id, condicao_id, prazo_pagamento_id,
        bandeira_id, operadora_id, numero_autoriza, qt_parcela, vl_parcela,
        vl_recebido, plano_conta_id, meio_pagamento_id, excluido
      ) VALUES (
        v_caixa_mov_id, _empresa_id, (v_pag_row->>'condicao_id')::bigint, 0,
        NULLIF((v_pag_row->>'bandeira_id')::text, '')::integer, NULLIF((v_pag_row->>'operadora_id')::text, '')::integer, 
        COALESCE(v_pag_row->>'numero_autoriza', ''), (v_pag_row->>'qt_parcela')::integer, 
        v_pag_dinheiro_ajustado / GREATEST(1, (v_pag_row->>'qt_parcela')::integer), -- Recalcula parcela
        v_pag_dinheiro_ajustado, NULLIF((v_pag_row->>'plano_conta_id')::text, '')::integer, v_meio_pagamento_id, false
      );

      -- 7. Soma ao caixa abertura se meio_pagamento.soma_vl_caixa = 'S'
      IF v_meio_pagamento_id IS NOT NULL THEN
        SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM meio_pagamento WHERE meio_pagamento_id = v_meio_pagamento_id;
        IF v_soma_caixa THEN
          v_valor_somar_caixa := v_valor_somar_caixa + v_pag_dinheiro_ajustado;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 8. Atualiza caixa_abertura
  IF v_valor_somar_caixa > 0 THEN
    UPDATE caixa_abertura 
    SET vl_fechamento = COALESCE(vl_fechamento, 0) + v_valor_somar_caixa
    WHERE caixa_abertura_id = _caixa_abertura_id;
  END IF;

  -- 9. Transição de status do PDV ('R' e baixa de estoque)
  PERFORM public.fu_mudar_status_pedido_pdv(_movimento_id, 'R', _usuario_id);

  -- Retorna sucesso
  RETURN jsonb_build_object(
    'success', true, 
    'movimento_id', _movimento_id, 
    'caixa_movimento_id', v_caixa_mov_id,
    'vl_somado_caixa', v_valor_somar_caixa
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;


ALTER FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid) OWNER TO postgres;

--
-- Name: fu_recalcular_pedido(bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_total numeric(15,2);
BEGIN
  SELECT COALESCE(SUM(qt_movimento * vl_und_produto), 0) INTO v_total
  FROM movimento_item WHERE movimento_id = _movimento_id AND excluido_visivel = false;
  UPDATE movimento SET vl_produto = v_total, vl_movimento = v_total - COALESCE(vl_desconto, 0)
  WHERE movimento_id = _movimento_id;
END;
$$;


ALTER FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) OWNER TO postgres;

--
-- Name: fu_round_abnt(numeric, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_round_abnt(p_val numeric, p_dec integer DEFAULT 2) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_factor numeric;
  v_scaled numeric;
  v_floor  numeric;
  v_diff   numeric;
BEGIN
  IF p_val IS NULL THEN RETURN 0; END IF;
  v_factor := power(10, p_dec);
  v_scaled := p_val * v_factor;
  v_floor  := floor(abs(v_scaled));
  v_diff   := abs(v_scaled) - v_floor;

  IF v_diff < 0.5 THEN
    v_scaled := sign(p_val) * v_floor;
  ELSIF v_diff > 0.5 THEN
    v_scaled := sign(p_val) * (v_floor + 1);
  ELSE
    -- exatamente .5 → arredonda para o par mais próximo
    IF (v_floor::bigint % 2) = 0 THEN
      v_scaled := sign(p_val) * v_floor;
    ELSE
      v_scaled := sign(p_val) * (v_floor + 1);
    END IF;
  END IF;
  RETURN v_scaled / v_factor;
END;
$$;


ALTER FUNCTION public.fu_round_abnt(p_val numeric, p_dec integer) OWNER TO postgres;

--
-- Name: fu_transition_pedido_status(bigint, text, uuid); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_mov RECORD; v_item RECORD;
BEGIN
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido_visivel = false;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Movimento não encontrado'); END IF;
  IF v_mov.st_pedido = 'A' AND _novo_status = 'F' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido_visivel = false LOOP
      UPDATE estoque SET estoque_reservado = estoque_reservado + v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'F', dt_finalizacao = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'T' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido_visivel = false LOOP
      UPDATE estoque SET estoque_fisico = estoque_fisico - v_item.qt_movimento, estoque_reservado = estoque_reservado - v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'T', dt_faturamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'F' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido_visivel = false LOOP
      UPDATE estoque SET estoque_reservado = estoque_reservado - v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'T' AND _novo_status = 'C' THEN
    FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido_visivel = false LOOP
      UPDATE estoque SET estoque_fisico = estoque_fisico + v_item.qt_movimento WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
    END LOOP;
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSIF v_mov.st_pedido = 'A' AND _novo_status = 'C' THEN
    UPDATE movimento SET st_pedido = 'C', dt_cancelamento = now() WHERE movimento_id = _movimento_id;
  ELSE
    RETURN jsonb_build_object('error', 'Transição inválida: ' || v_mov.st_pedido || ' -> ' || _novo_status);
  END IF;
  INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_CHANGE', jsonb_build_object('status', v_mov.st_pedido), jsonb_build_object('status', _novo_status), _usuario_id);
  RETURN jsonb_build_object('success', true, 'old_status', v_mov.st_pedido, 'new_status', _novo_status);
END;
$$;


ALTER FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid) OWNER TO postgres;

--
-- Name: fu_update_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.fu_update_updated_at() OWNER TO postgres;

--
-- Name: fu_upsert_cliente_public(text, text, text, text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  v_id bigint;
BEGIN
  IF length(v_cpf) < 11 THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  IF btrim(coalesce(_nome, '')) = '' THEN
    RAISE EXCEPTION 'Nome obrigatório';
  END IF;

  IF btrim(coalesce(_filhos, '')) = '' THEN
    RAISE EXCEPTION 'Nome do(s) filho(s) obrigatório';
  END IF;

  -- Verify in cliente table
  SELECT cl.id INTO v_id
  FROM public.cliente cl
  WHERE cl.cnpj = v_cpf
  ORDER BY cl.id DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.cliente (
      cnpj,
      razao_social,
      fone_geral,
      dep_nome1
    )
    VALUES (
      v_cpf,
      btrim(_nome),
      nullif(btrim(coalesce(_telefone, '')), ''),
      btrim(_filhos)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.cliente
       SET razao_social = btrim(_nome),
           fone_geral = nullif(btrim(coalesce(_telefone, '')), ''),
           dep_nome1 = btrim(_filhos)
     WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;


ALTER FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) OWNER TO postgres;

--
-- Name: fu_user_in_empresa(uuid, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuario
    WHERE user_id = _user_id AND empresa_id = _empresa_id AND fl_excluido = FALSE
  )
$$;


ALTER FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint) OWNER TO postgres;

--
-- Name: get_or_create_nsu_seq(integer, character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_ult_seq int8;
BEGIN
    -- Verifica se já existe o sequencial para aquela empresa/campo
    SELECT ult_seq INTO v_ult_seq
    FROM public.sys_sequencial
    WHERE empresa_id = p_empresa_id 
      AND tabela = 'fiscal_nfe_recebida' 
      AND nm_campo1 = p_tipo_campo;

    IF v_ult_seq IS NULL THEN
        -- Não existe, vamos criar iniciando em 1
        INSERT INTO public.sys_sequencial (empresa_id, tabela, nm_campo1, ult_seq)
        VALUES (p_empresa_id, 'fiscal_nfe_recebida', p_tipo_campo, 1)
        RETURNING ult_seq INTO v_ult_seq;
    END IF;

    RETURN v_ult_seq;
END;
$$;


ALTER FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying) OWNER TO postgres;

--
-- Name: pcdr_baixar_titulos(integer, character varying, character varying, character varying, integer); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
    v_valor_recebido NUMERIC(12,2);
    v_saldo NUMERIC(12,2);
    v_rec RECORD;
    v_vl_a_aplicar NUMERIC(12,2);
    v_doc varchar;
    v_next_id integer;
BEGIN
    v_valor_recebido := REPLACE(REPLACE(TRIM(p_vl_recebido), '.', ''), ',', '.')::NUMERIC(12,2);
    IF v_valor_recebido IS NULL OR v_valor_recebido <= 0 THEN
        RAISE EXCEPTION 'Valor incompatível para pagamento (0,00)';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.financeiro_view
        WHERE cadastro_id = p_cadastro_id
          AND tp_conta = 'R'
          AND status = 'A'
          AND vl_a_pagar > 0
    ) THEN
        RAISE EXCEPTION 'Cliente sem títulos em aberto!';
    END IF;

    v_saldo := v_valor_recebido;

    FOR v_rec IN
        SELECT empresa_id, financeiro_id, vl_a_pagar, documento
        FROM public.financeiro_view
        WHERE cadastro_id = p_cadastro_id
          AND tp_conta = 'R'
          AND status = 'A'
          AND vl_a_pagar > 0
        ORDER BY dt_vencto ASC
    LOOP
        EXIT WHEN v_saldo <= 0;
        v_vl_a_aplicar := LEAST(v_saldo, v_rec.vl_a_pagar);

        SELECT COALESCE(MAX(financeiro_baixa_id),0) + 1 INTO v_next_id FROM public.financeiro_baixa;

        INSERT INTO public.financeiro_baixa (
            financeiro_baixa_id, empresa_id, financeiro_id, vl_pago, recibo, dt_pagamento,
            cadastro_id, conta_id, tp_conta, tipo_pag_rec_id, documento
        ) VALUES (
            v_next_id, v_rec.empresa_id, v_rec.financeiro_id, v_vl_a_aplicar, p_recibo,
            CURRENT_DATE, p_cadastro_id, p_conta_id, 'R', p_tipo_pag_rec_id,
            COALESCE(v_rec.documento, '')
        );

        UPDATE public.financeiro
        SET vl_pago = COALESCE(vl_pago,0) + v_vl_a_aplicar,
            status = CASE WHEN COALESCE(vl_pago,0) + v_vl_a_aplicar >= vl_titulo THEN 'B' ELSE status END
        WHERE empresa_id = v_rec.empresa_id
          AND financeiro_id = v_rec.financeiro_id;

        v_saldo := v_saldo - v_vl_a_aplicar;
    END LOOP;
END;
$$;


ALTER PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer) OWNER TO postgres;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

--
-- Name: rpb_execute_query(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rpb_execute_query(p_sql text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_safe   TEXT;
BEGIN
  v_safe := upper(trim(p_sql));
  IF v_safe LIKE 'INSERT%' OR v_safe LIKE 'UPDATE%' OR v_safe LIKE 'DELETE%'
     OR v_safe LIKE 'DROP%' OR v_safe LIKE 'TRUNCATE%' OR v_safe LIKE 'ALTER%'
     OR v_safe LIKE 'CREATE%' OR v_safe LIKE 'GRANT%' OR v_safe LIKE 'REVOKE%' THEN
    RAISE EXCEPTION 'Apenas SELECT é permitido no Report Builder.';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t',
    p_sql
  ) INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro na query: %', SQLERRM;
END;
$$;


ALTER FUNCTION public.rpb_execute_query(p_sql text) OWNER TO postgres;

--
-- Name: tr_set_hr_movimento(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.tr_set_hr_movimento() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.hr_movimento IS NULL THEN 
    NEW.hr_movimento := to_char(NEW.dt_emissao AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI:SS'); 
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.tr_set_hr_movimento() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE auth.audit_log_entries OWNER TO supabase_auth_admin;

--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


ALTER TABLE auth.custom_oauth_providers OWNER TO supabase_auth_admin;

--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


ALTER TABLE auth.flow_state OWNER TO supabase_auth_admin;

--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE auth.identities OWNER TO supabase_auth_admin;

--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE auth.instances OWNER TO supabase_auth_admin;

--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


ALTER TABLE auth.mfa_amr_claims OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


ALTER TABLE auth.mfa_challenges OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


ALTER TABLE auth.mfa_factors OWNER TO supabase_auth_admin;

--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


ALTER TABLE auth.oauth_authorizations OWNER TO supabase_auth_admin;

--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


ALTER TABLE auth.oauth_client_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


ALTER TABLE auth.oauth_clients OWNER TO supabase_auth_admin;

--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


ALTER TABLE auth.oauth_consents OWNER TO supabase_auth_admin;

--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


ALTER TABLE auth.one_time_tokens OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


ALTER TABLE auth.refresh_tokens OWNER TO supabase_auth_admin;

--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: supabase_auth_admin
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE auth.refresh_tokens_id_seq OWNER TO supabase_auth_admin;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: supabase_auth_admin
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


ALTER TABLE auth.saml_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


ALTER TABLE auth.saml_relay_states OWNER TO supabase_auth_admin;

--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


ALTER TABLE auth.sessions OWNER TO supabase_auth_admin;

--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


ALTER TABLE auth.sso_domains OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


ALTER TABLE auth.sso_providers OWNER TO supabase_auth_admin;

--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


ALTER TABLE auth.users OWNER TO supabase_auth_admin;

--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: webauthn_challenges; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    challenge_type text NOT NULL,
    session_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT webauthn_challenges_challenge_type_check CHECK ((challenge_type = ANY (ARRAY['signup'::text, 'registration'::text, 'authentication'::text])))
);


ALTER TABLE auth.webauthn_challenges OWNER TO supabase_auth_admin;

--
-- Name: webauthn_credentials; Type: TABLE; Schema: auth; Owner: supabase_auth_admin
--

CREATE TABLE auth.webauthn_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    credential_id bytea NOT NULL,
    public_key bytea NOT NULL,
    attestation_type text DEFAULT ''::text NOT NULL,
    aaguid uuid,
    sign_count bigint DEFAULT 0 NOT NULL,
    transports jsonb DEFAULT '[]'::jsonb NOT NULL,
    backup_eligible boolean DEFAULT false NOT NULL,
    backed_up boolean DEFAULT false NOT NULL,
    friendly_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


ALTER TABLE auth.webauthn_credentials OWNER TO supabase_auth_admin;

--
-- Name: aaaproduto_fornecedor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aaaproduto_fornecedor (
    produto_fornecedor_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    produto_id bigint DEFAULT 1 NOT NULL,
    cadastro_id bigint DEFAULT 0 NOT NULL,
    unidade_id character varying(5) DEFAULT 'UN'::character varying,
    fator_conv numeric(16,8),
    cd_prod_fornec character varying(30)
);


ALTER TABLE public.aaaproduto_fornecedor OWNER TO postgres;

--
-- Name: abate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate (
    empresa_id integer NOT NULL,
    abate_id integer NOT NULL,
    cadastro_id integer NOT NULL,
    lote_id integer NOT NULL,
    data timestamp without time zone NOT NULL,
    turno character(1),
    dt_inicio timestamp without time zone,
    dt_fim_realizado timestamp without time zone,
    tempo_realizado integer,
    tempo_parado integer,
    tempo_redvel integer,
    qt_prevista integer,
    qt_realizada integer,
    qt_problema integer,
    ps_previsto numeric(10,4),
    ps_realizado numeric(10,4),
    qt_funcionarios integer,
    qt_faltas integer,
    qt_mortalidade integer,
    peso_mortalidade numeric(10,5),
    peso_prod numeric(10,5),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate OWNER TO postgres;

--
-- Name: abate_entrada; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate_entrada (
    abate_id integer NOT NULL,
    empresa_id character varying(29) NOT NULL,
    abate_entrada_id integer NOT NULL,
    placa character varying(8),
    ps_previsto numeric(10,2),
    qt_realizada numeric(10,2),
    qt_prevista numeric(10,2),
    ps_realizado numeric(10,2),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate_entrada OWNER TO postgres;

--
-- Name: abate_mortalidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate_mortalidade (
    abate_id integer NOT NULL,
    empresa_id integer NOT NULL,
    mortalidade_id integer NOT NULL,
    data timestamp without time zone,
    motivo_id integer,
    quantidade integer,
    peso numeric(10,4),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate_mortalidade OWNER TO postgres;

--
-- Name: abate_mortalidade_motivo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate_mortalidade_motivo (
    motivo_id integer NOT NULL,
    descricao_id character varying(50),
    setor character(1),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate_mortalidade_motivo OWNER TO postgres;

--
-- Name: abate_mortalidade_motivo_motivo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_mortalidade_motivo ALTER COLUMN motivo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.abate_mortalidade_motivo_motivo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: abate_problema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate_problema (
    abate_id integer NOT NULL,
    empresa_id integer NOT NULL,
    problema_id integer NOT NULL,
    inicio timestamp without time zone,
    termino timestamp without time zone,
    tempo integer,
    tp_problema character(1),
    pc_reducao numeric(10,2),
    qt_reducao integer,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate_problema OWNER TO postgres;

--
-- Name: abate_producao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.abate_producao (
    abate_id integer NOT NULL,
    empresa_id integer NOT NULL,
    producao_id integer NOT NULL,
    produto_id integer NOT NULL,
    pc_chile numeric(10,2) NOT NULL,
    ps_producao numeric(12,4) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.abate_producao OWNER TO postgres;

--
-- Name: agendamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamento (
    empresa_id integer,
    agendamento_id integer NOT NULL,
    paciente_id integer NOT NULL,
    procedimento_id integer NOT NULL,
    profissional_id integer NOT NULL,
    dt_agendamento date NOT NULL,
    hs_agendamento character varying(5) NOT NULL,
    convenio_id integer,
    vl_agendamento numeric(10,2) NOT NULL,
    ob_agendamento text,
    funcionario_id integer,
    dt_inclusao date NOT NULL,
    hs_inclusao character varying(5),
    origem character(2),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.agendamento OWNER TO postgres;

--
-- Name: agendamento_financeiro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamento_financeiro (
    empresa_id integer NOT NULL,
    agendamento_id integer NOT NULL,
    agendamento_financeiro_id integer NOT NULL,
    condicao_id integer NOT NULL,
    portador_id integer NOT NULL,
    nr_autorizacao character varying(20) NOT NULL,
    vl_agendamento numeric(12,2) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.agendamento_financeiro OWNER TO postgres;

--
-- Name: agendamento_proc_split; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamento_proc_split (
    empresa_id integer NOT NULL,
    agendamento_proc_split_id integer NOT NULL,
    agendamento_split_id integer NOT NULL,
    profissional_id integer NOT NULL,
    especialidade_id integer NOT NULL,
    plano_id integer NOT NULL,
    vl_split numeric(12,2) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.agendamento_proc_split OWNER TO postgres;

--
-- Name: agendamento_procedimento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agendamento_procedimento (
    empresa_id integer,
    agendamento_procedimento_id integer NOT NULL,
    agendamento_id integer,
    procedimento_id integer,
    vl_procedimento numeric(12,2),
    vl_split numeric(12,2),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.agendamento_procedimento OWNER TO postgres;

--
-- Name: auditoria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auditoria (
    id bigint NOT NULL,
    xtabela text NOT NULL,
    xregistro_id text NOT NULL,
    xacao text NOT NULL,
    xdados_anteriores jsonb,
    xdados_novos jsonb,
    xusuario_id uuid,
    xip text DEFAULT ''::text NOT NULL,
    xobs text DEFAULT ''::text NOT NULL,
    xdt_auditoria timestamp with time zone DEFAULT now()
);


ALTER TABLE public.auditoria OWNER TO postgres;

--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: balanca; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.balanca (
    comm character varying(50),
    baubrate character varying(50),
    databits character varying(50),
    parity character varying(50),
    stopbits character varying(50),
    delayemerro integer,
    delaynormal integer,
    temp_min numeric(10,2),
    temp_max numeric(10,2),
    umid_min numeric(10,2),
    umid_max numeric(10,2),
    tempo_refresh numeric(10,2),
    co2_min numeric(10,2) DEFAULT 0,
    co2_max numeric(10,2) DEFAULT 0,
    tempo_granja integer DEFAULT 5,
    id integer NOT NULL
);


ALTER TABLE public.balanca OWNER TO postgres;

--
-- Name: balanca_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.balanca_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.balanca_id_seq OWNER TO postgres;

--
-- Name: balanca_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.balanca_id_seq OWNED BY public.balanca.id;


--
-- Name: banco; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.banco (
    banco_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    cd_banco text DEFAULT ''::text NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.banco OWNER TO postgres;

--
-- Name: banco_banco_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.banco ALTER COLUMN banco_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.banco_banco_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bandeira; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bandeira (
    bandeira_id integer NOT NULL,
    descricao character varying(50),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    empresa_id integer DEFAULT 1,
    cd_bandeira integer
);


ALTER TABLE public.bandeira OWNER TO postgres;

--
-- Name: boleto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.boleto (
    empresa_id integer NOT NULL,
    bol_id integer NOT NULL,
    local_pagamento1 character varying(58),
    local_pagamento2 character varying(58),
    instrucoes character varying(120),
    agencia_numero character varying(18),
    agencia_dv character varying(4),
    beneficiario_nome character varying(40),
    conta_corrente_numero character varying(24),
    dt_processamento timestamp without time zone,
    dt_vencimento timestamp without time zone,
    documento_especie character varying(2),
    documento_numero character varying(20),
    documento_data timestamp without time zone,
    valor_boleto numeric(9,2),
    nosso_numero character varying(20),
    pagador_bairro character varying(57),
    pagador_logradouro character varying(60),
    pagador_cep character varying(20),
    pagador_municipio character varying(60),
    pagador_documento character varying(80),
    pagador_nome character varying(60),
    pagador_uf character varying(4),
    beneficiario_email character varying(30),
    nosso_numero_dv character varying(12),
    beneficiario_telefone character varying(21),
    beneficiario_logomarca text,
    conta_corrente_dv character varying(7),
    beneficiario_logradouro character varying(72),
    beneficiario_bairro character varying(30),
    beneficiario_municipio character varying(37),
    beneficiario_cep character varying(14),
    beneficiario_uf character varying(5),
    beneficiario_documento character varying(20),
    beneficiario_cod_cliente character varying(20),
    banco character varying(3),
    carteira character varying(5),
    carteira_modalidade character varying(5),
    carteira_tipo character varying(10),
    desconto_data_limite timestamp without time zone,
    desconto_valor numeric(11,2),
    financeiro_id bigint,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.boleto OWNER TO postgres;

--
-- Name: boleto_bol_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.boleto ALTER COLUMN bol_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.boleto_bol_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cadastro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadastro (
    cadastro_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    cd_cadastro bigint NOT NULL,
    razao_social character varying NOT NULL,
    nome_fantasia character varying DEFAULT ''::character varying NOT NULL,
    nome_curto character varying DEFAULT ''::character varying NOT NULL,
    identificacao character varying DEFAULT ''::character varying NOT NULL,
    cnpj character varying DEFAULT ''::character varying NOT NULL,
    rg character varying DEFAULT ''::character varying NOT NULL,
    inscricao_estadual character varying DEFAULT ''::character varying NOT NULL,
    inscricao_municipal character varying DEFAULT ''::character varying NOT NULL,
    email character varying DEFAULT ''::character varying NOT NULL,
    tp_pessoa character varying(1) DEFAULT 'F'::character varying,
    tp_contribuinte character varying(1) DEFAULT 'N'::character varying,
    tp_cadastro_id integer,
    tipo_cadastro character varying(1) DEFAULT 'A'::character varying,
    st_cadastro character varying(1) DEFAULT 'A'::character varying,
    st_cliente character(1) DEFAULT 'S'::bpchar,
    st_fornecedor character(1) DEFAULT 'N'::bpchar,
    st_transportador character varying(1) DEFAULT 'N'::character varying,
    st_vendedor character(1) DEFAULT 'N'::bpchar,
    nacionalidade character varying DEFAULT 'BRASILEIRA'::character varying,
    estado_civil character varying DEFAULT ''::character varying NOT NULL,
    dt_nasc timestamp with time zone,
    endereco_logradouro character varying DEFAULT ''::character varying NOT NULL,
    endereco_numero character varying DEFAULT ''::character varying NOT NULL,
    endereco_bairro character varying DEFAULT ''::character varying NOT NULL,
    endereco_compl character varying DEFAULT ''::character varying NOT NULL,
    endereco_cep character varying DEFAULT ''::character varying NOT NULL,
    endereco_ptoref character varying DEFAULT ''::character varying NOT NULL,
    endereco_cidade_id integer,
    fone_geral character varying DEFAULT ''::character varying NOT NULL,
    fone_comercial character varying DEFAULT ''::character varying NOT NULL,
    fone_financeiro character varying DEFAULT ''::character varying NOT NULL,
    fone_faturamento character varying DEFAULT ''::character varying NOT NULL,
    latitude numeric,
    longitude numeric,
    grupo_cadastro_id integer,
    condicao_id integer,
    portador_id integer,
    tabela_preco_id integer,
    rota_id integer,
    rota_seq integer DEFAULT 0 NOT NULL,
    funcionario_id integer,
    conj_nome character varying DEFAULT ''::character varying NOT NULL,
    conj_cpf character varying DEFAULT ''::character varying NOT NULL,
    conj_telefone character varying DEFAULT ''::character varying NOT NULL,
    conj_dt_nasc timestamp with time zone,
    dep_nome1 character varying DEFAULT ''::character varying NOT NULL,
    dep_cpf1 character varying DEFAULT ''::character varying NOT NULL,
    dep_telefone1 character varying DEFAULT ''::character varying NOT NULL,
    dep_email1 character varying DEFAULT ''::character varying NOT NULL,
    dep_grau_parent1 character varying DEFAULT ''::character varying NOT NULL,
    dep_dt_nasc1 timestamp with time zone,
    dep_st1 character(1) DEFAULT 'S'::bpchar,
    dep_nome2 character varying DEFAULT ''::character varying NOT NULL,
    dep_cpf2 character varying DEFAULT ''::character varying NOT NULL,
    dep_telefone2 character varying DEFAULT ''::character varying NOT NULL,
    dep_email2 character varying DEFAULT ''::character varying NOT NULL,
    dep_grau_parent2 character varying DEFAULT ''::character varying NOT NULL,
    dep_dt_nasc2 timestamp with time zone,
    dep_st2 character(1) DEFAULT 'N'::bpchar,
    dep_nome3 character varying DEFAULT ''::character varying NOT NULL,
    dep_cpf3 character varying DEFAULT ''::character varying NOT NULL,
    dep_telefone3 character varying DEFAULT ''::character varying NOT NULL,
    dep_email3 character varying DEFAULT ''::character varying NOT NULL,
    dep_dt_nasc3 timestamp with time zone,
    dep_st3 character(1) DEFAULT 'N'::bpchar,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    tp_proprietario character varying(1) DEFAULT NULL::character varying,
    rntrc character varying(20) DEFAULT NULL::character varying,
    uf_proprietario character varying(2) DEFAULT NULL::character varying
);


ALTER TABLE public.cadastro OWNER TO postgres;

--
-- Name: cadastro_cadastro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro ALTER COLUMN cadastro_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cadastro_cadastro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cadastro_grupo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadastro_grupo (
    cadastro_grupo_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    cd_cadastro_grupo bigint NOT NULL,
    nome character varying(255) NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cadastro_grupo OWNER TO postgres;

--
-- Name: cadastro_grupo_cadastro_grupo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_grupo ALTER COLUMN cadastro_grupo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cadastro_grupo_cadastro_grupo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cadastro_motorista; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadastro_motorista (
    motorista_id integer NOT NULL,
    empresa_id integer NOT NULL,
    cadastro_id integer NOT NULL,
    cpf character varying(11) NOT NULL,
    nome character varying(100) NOT NULL,
    telefone character varying(20),
    chave_pix character varying(100),
    ativo boolean DEFAULT true,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.cadastro_motorista OWNER TO postgres;

--
-- Name: cadastro_motorista_motorista_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_motorista ALTER COLUMN motorista_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cadastro_motorista_motorista_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cadastro_preco; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadastro_preco (
    empresa_id integer NOT NULL,
    cadastro_preco_id integer NOT NULL,
    produto_id integer NOT NULL,
    pr_produto numeric(12,2),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    cd_cadastro_preco integer
);


ALTER TABLE public.cadastro_preco OWNER TO postgres;

--
-- Name: cadastro_veiculo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadastro_veiculo (
    veiculo_id integer NOT NULL,
    empresa_id integer NOT NULL,
    cadastro_id integer NOT NULL,
    placa character varying(10) NOT NULL,
    renavam character varying(11),
    tara integer DEFAULT 0,
    capacidade_kg integer DEFAULT 0,
    tp_rodado character varying(2) DEFAULT '01'::character varying,
    tp_carroceria character varying(2) DEFAULT '00'::character varying,
    uf character varying(2),
    tp_veiculo character varying(10) DEFAULT 'TRACAO'::character varying,
    marca character varying(50),
    modelo character varying(50),
    descricao character varying(100),
    ativo boolean DEFAULT true,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    cd_cadastro_veiculo integer
);


ALTER TABLE public.cadastro_veiculo OWNER TO postgres;

--
-- Name: cadastro_veiculo_veiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_veiculo ALTER COLUMN veiculo_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.cadastro_veiculo_veiculo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: caixa_abertura; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caixa_abertura (
    empresa_id integer NOT NULL,
    caixa_abertura_id integer NOT NULL,
    funcionario_id integer NOT NULL,
    dt_abertura date NOT NULL,
    vl_abertura double precision,
    vl_fechamento double precision,
    status character varying(1) DEFAULT 'A'::character varying
);


ALTER TABLE public.caixa_abertura OWNER TO postgres;

--
-- Name: caixa_abertura_caixa_abertura_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_abertura ALTER COLUMN caixa_abertura_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.caixa_abertura_caixa_abertura_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: caixa_movimento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caixa_movimento (
    empresa_id integer NOT NULL,
    caixa_movimento_id integer NOT NULL,
    colaborador_id integer NOT NULL,
    dt_movimento date,
    tp_movimento character varying(1),
    tp_operacao character varying(1),
    conta_gerencial_id integer,
    centro_custo_id integer,
    historico character varying(100),
    documento character varying(20),
    vl_movimento double precision,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    funcionario_id integer NOT NULL,
    movimento_id integer DEFAULT 0,
    caixa_abertura_id integer,
    vl_troco double precision DEFAULT 0
);


ALTER TABLE public.caixa_movimento OWNER TO postgres;

--
-- Name: caixa_movimento_caixa_movimento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_movimento ALTER COLUMN caixa_movimento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.caixa_movimento_caixa_movimento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: caixa_movimento_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.caixa_movimento_item (
    empresa_id integer NOT NULL,
    caixa_movimento_id integer NOT NULL,
    caixa_movimento_item_id integer NOT NULL,
    condicao_id integer,
    prazo_pagamento_id integer,
    bandeira_id integer,
    operadora_id integer,
    numero_autoriza character varying(50),
    qt_parcela integer DEFAULT 1,
    vl_parcela double precision,
    vl_recebido double precision,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    plano_conta_id integer,
    meio_pagamento_id integer
);


ALTER TABLE public.caixa_movimento_item OWNER TO postgres;

--
-- Name: caixa_movimento_item_caixa_movimento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_movimento_item ALTER COLUMN caixa_movimento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.caixa_movimento_item_caixa_movimento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: caixa_movimento_item_caixa_movimento_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq OWNER TO postgres;

--
-- Name: caixa_movimento_item_caixa_movimento_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq OWNED BY public.caixa_movimento_item.caixa_movimento_item_id;


--
-- Name: centro_custo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.centro_custo (
    empresa_id integer,
    centro_custo_id integer NOT NULL,
    nome character varying(30) DEFAULT ''::character varying,
    cd_centro_custo integer
);


ALTER TABLE public.centro_custo OWNER TO postgres;

--
-- Name: centro_custo_centro_custo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.centro_custo ALTER COLUMN centro_custo_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.centro_custo_centro_custo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cfop; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cfop (
    cfop_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    cd_cfop character varying(5) NOT NULL,
    descricao text NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    obs_produto text,
    obs_rodape text,
    aplicacao text
);


ALTER TABLE public.cfop OWNER TO postgres;

--
-- Name: COLUMN cfop.aplicacao; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cfop.aplicacao IS 'Descrição detalhada da aplicação do CFOP conforme guia prático.';


--
-- Name: cfop_cfop_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cfop ALTER COLUMN cfop_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cfop_cfop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chat_conversa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_conversa (
    chat_conversa_id bigint NOT NULL,
    user_id uuid NOT NULL,
    empresa_id bigint,
    ds_titulo text DEFAULT 'Nova conversa'::text NOT NULL,
    dt_criacao timestamp with time zone DEFAULT now() NOT NULL,
    dt_atualizacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_conversa OWNER TO postgres;

--
-- Name: chat_conversa_chat_conversa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_conversa_chat_conversa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_conversa_chat_conversa_id_seq OWNER TO postgres;

--
-- Name: chat_conversa_chat_conversa_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_conversa_chat_conversa_id_seq OWNED BY public.chat_conversa.chat_conversa_id;


--
-- Name: chat_mensagem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_mensagem (
    chat_mensagem_id bigint NOT NULL,
    chat_conversa_id bigint NOT NULL,
    user_id uuid NOT NULL,
    tp_remetente text NOT NULL,
    ds_conteudo text,
    ds_anexo_url text,
    ds_anexo_tipo text,
    ds_audio_url text,
    tp_acao text,
    dados_acao jsonb,
    dt_criacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_mensagem_tp_remetente_check CHECK ((tp_remetente = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text])))
);


ALTER TABLE public.chat_mensagem OWNER TO postgres;

--
-- Name: chat_mensagem_chat_mensagem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_mensagem_chat_mensagem_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_mensagem_chat_mensagem_id_seq OWNER TO postgres;

--
-- Name: chat_mensagem_chat_mensagem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_mensagem_chat_mensagem_id_seq OWNED BY public.chat_mensagem.chat_mensagem_id;


--
-- Name: chat_sala; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_sala (
    chat_sala_id bigint NOT NULL,
    tp_sala text NOT NULL,
    ds_nome text,
    empresa_id bigint,
    criado_por uuid NOT NULL,
    dt_criacao timestamp with time zone DEFAULT now() NOT NULL,
    dt_atualizacao timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_sala_tp_sala_check CHECK ((tp_sala = ANY (ARRAY['D'::text, 'G'::text])))
);


ALTER TABLE public.chat_sala OWNER TO postgres;

--
-- Name: chat_sala_chat_sala_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_sala_chat_sala_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_sala_chat_sala_id_seq OWNER TO postgres;

--
-- Name: chat_sala_chat_sala_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_sala_chat_sala_id_seq OWNED BY public.chat_sala.chat_sala_id;


--
-- Name: chat_sala_membro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_sala_membro (
    chat_sala_membro_id bigint NOT NULL,
    chat_sala_id bigint NOT NULL,
    user_id uuid NOT NULL,
    dt_entrada timestamp with time zone DEFAULT now() NOT NULL,
    dt_ultima_leitura timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_sala_membro OWNER TO postgres;

--
-- Name: chat_sala_membro_chat_sala_membro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq OWNER TO postgres;

--
-- Name: chat_sala_membro_chat_sala_membro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq OWNED BY public.chat_sala_membro.chat_sala_membro_id;


--
-- Name: chat_sala_mensagem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_sala_mensagem (
    chat_sala_mensagem_id bigint NOT NULL,
    chat_sala_id bigint NOT NULL,
    user_id uuid NOT NULL,
    ds_conteudo text,
    ds_anexo_url text,
    ds_anexo_tipo text,
    ds_audio_url text,
    dt_criacao timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.chat_sala_mensagem OWNER TO postgres;

--
-- Name: chat_sala_mensagem_chat_sala_mensagem_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq OWNER TO postgres;

--
-- Name: chat_sala_mensagem_chat_sala_mensagem_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq OWNED BY public.chat_sala_mensagem.chat_sala_mensagem_id;


--
-- Name: cidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cidade (
    cidade_id integer NOT NULL,
    descricao text NOT NULL,
    estado_id character varying DEFAULT 'PR'::character varying,
    cd_ibge character varying,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.cidade OWNER TO postgres;

--
-- Name: cidade_cidade_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cidade ALTER COLUMN cidade_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cidade_cidade_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: clas_trib; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clas_trib (
    clas_trib_id character(6) NOT NULL,
    grupo_ibscbs_id integer,
    descricao character varying(40) NOT NULL,
    bc_legal text,
    ativo boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.clas_trib OWNER TO postgres;

--
-- Name: cliente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cliente (
    id bigint NOT NULL,
    cnpj text NOT NULL,
    razao_social text NOT NULL,
    fone_geral text,
    dep_nome1 text,
    dt_cadastro timestamp with time zone DEFAULT now(),
    excluido boolean DEFAULT false
);


ALTER TABLE public.cliente OWNER TO postgres;

--
-- Name: cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.cliente ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cliente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: comissao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comissao (
    comissao_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    cadastro_id integer,
    tp_comissao character varying DEFAULT 'P'::character varying,
    pc_comis_av numeric DEFAULT 0,
    pc_comis_pr numeric DEFAULT 0,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.comissao OWNER TO postgres;

--
-- Name: comissao_comissao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.comissao ALTER COLUMN comissao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.comissao_comissao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: condicao_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.condicao_pagamento (
    condicao_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    descricao text NOT NULL,
    prazo_1 integer DEFAULT 0,
    prazo_2 integer DEFAULT 0 NOT NULL,
    prazo_3 integer DEFAULT 0 NOT NULL,
    prazo_4 integer DEFAULT 0 NOT NULL,
    prazo_5 integer DEFAULT 0 NOT NULL,
    prazo_6 integer DEFAULT 0 NOT NULL,
    prazo_7 integer DEFAULT 0 NOT NULL,
    prazo_8 integer DEFAULT 0 NOT NULL,
    prazo_9 integer DEFAULT 0 NOT NULL,
    prazo_10 integer DEFAULT 0 NOT NULL,
    prazo_11 integer DEFAULT 0 NOT NULL,
    prazo_12 integer DEFAULT 0 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    tipo_prazo character varying(1),
    qtd_parcelas integer,
    intervalo integer,
    plano_conta_id integer,
    meio_pagamento_id integer,
    cd_condicao integer,
    cd_condicao_pagamento integer
);


ALTER TABLE public.condicao_pagamento OWNER TO postgres;

--
-- Name: condicao_pagamento_condicao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.condicao_pagamento ALTER COLUMN condicao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.condicao_pagamento_condicao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conta (
    empresa_id integer NOT NULL,
    conta_id character varying(10) NOT NULL,
    banco_id character varying(3) NOT NULL,
    nome_conta character varying(30),
    convenio character varying(7),
    beneficiario character varying(50),
    beneficiario_cnpj character varying(18),
    carteira character varying(2),
    caminho_remessa text,
    prx_nosso_numero integer,
    prx_seq_remessa integer,
    cod_cedente character varying(20),
    conta_cobranca character varying(15),
    conta_corrente character varying(20),
    token character varying(200),
    ambiente character varying(1),
    portador_id integer,
    ativo character varying(1),
    saldo numeric(9,2),
    conta_dv character varying(7),
    local_pagamento1 character varying(58),
    local_pagamento2 character varying(58),
    instrucoes character varying(120),
    agencia_numero character varying(18),
    agencia_dv character varying(4),
    beneficiario_nome character varying(40),
    documento_especie character varying(2),
    beneficiario_email character varying(30),
    beneficiario_telefone character varying(21),
    beneficiario_logo text,
    beneficiario_logadouro character varying(72),
    beneficiario_bairro character varying(30),
    beneficiario_municipio character varying(37),
    beneficiario_cep character varying(14),
    beneficiario_uf character varying(5),
    beneficiario_documento character varying(20),
    beneficiario_cod_cliente character varying(20),
    carteira_modalidade character varying(5),
    carteira_tipo character varying(10),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    cd_conta integer
);


ALTER TABLE public.conta OWNER TO postgres;

--
-- Name: convenio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.convenio (
    empresa_id integer,
    convenio_id integer NOT NULL,
    nome character varying(25) NOT NULL,
    plano_id integer,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    cd_convenio integer
);


ALTER TABLE public.convenio OWNER TO postgres;

--
-- Name: corretora; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.corretora (
    corretora_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    cd_corretora integer
);


ALTER TABLE public.corretora OWNER TO postgres;

--
-- Name: corretora_corretora_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.corretora ALTER COLUMN corretora_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.corretora_corretora_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: depara; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.depara (
    c02_pk character varying,
    c04_pk character varying,
    c04_nv integer
);


ALTER TABLE public.depara OWNER TO postgres;

--
-- Name: deposito; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deposito (
    deposito_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    nome character varying NOT NULL,
    endereco character varying DEFAULT ''::character varying NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    st_privado boolean DEFAULT true NOT NULL,
    cd_deposito bigint
);


ALTER TABLE public.deposito OWNER TO postgres;

--
-- Name: deposito_deposito_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.deposito ALTER COLUMN deposito_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.deposito_deposito_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emovimento_nr_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.emovimento_nr_seq
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.emovimento_nr_seq OWNER TO postgres;

--
-- Name: emovimento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emovimento (
    emovimento_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    cadastro_id bigint,
    cliente_id bigint,
    nr_movimento bigint DEFAULT nextval('public.emovimento_nr_seq'::regclass),
    tp_movimento character varying(2) DEFAULT 'PD'::character varying,
    tp_origem character varying(10) DEFAULT 'LINK'::character varying,
    st_pedido character varying(2) DEFAULT 'A'::character varying,
    dt_emissao timestamp with time zone DEFAULT now(),
    dt_finalizacao timestamp with time zone,
    dt_cancelamento timestamp with time zone,
    vl_produto numeric(18,4) DEFAULT 0,
    vl_desconto numeric(18,4) DEFAULT 0,
    vl_movimento numeric(18,4) DEFAULT 0,
    observacao character varying(255) DEFAULT ''::character varying,
    nm_responsavel text DEFAULT ''::text,
    nr_telefone_responsavel text DEFAULT ''::text,
    email_responsavel text DEFAULT ''::text,
    nm_crianca text DEFAULT ''::text,
    excluido boolean DEFAULT false,
    deposito_id bigint,
    id_transacao_abacatepay text DEFAULT ''::text,
    url_pagamento text DEFAULT ''::text,
    qr_code_pagamento text DEFAULT ''::text
);


ALTER TABLE public.emovimento OWNER TO postgres;

--
-- Name: emovimento_emovimento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento ALTER COLUMN emovimento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.emovimento_emovimento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emovimento_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emovimento_item (
    emovimento_item_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    emovimento_id bigint NOT NULL,
    produto_id bigint,
    cd_produto text DEFAULT ''::text,
    nm_produto text DEFAULT ''::text,
    unidade_id character varying(10),
    tp_movimento character varying(2) DEFAULT 'PD'::character varying,
    qt_movimento numeric(18,4) DEFAULT 1,
    vl_und_produto numeric(18,4) DEFAULT 0,
    vl_produto numeric(18,4) DEFAULT 0,
    vl_desconto numeric(18,4) DEFAULT 0,
    vl_movimento numeric(18,4) DEFAULT 0,
    excluido boolean DEFAULT false,
    deposito_id bigint,
    entrega character varying(2) DEFAULT 'S'::character varying,
    qt_reservada numeric(18,4) DEFAULT 0
);


ALTER TABLE public.emovimento_item OWNER TO postgres;

--
-- Name: emovimento_item_emovimento_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento_item ALTER COLUMN emovimento_item_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.emovimento_item_emovimento_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emovimento_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emovimento_pagamento (
    emovimento_pagamento_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    emovimento_id bigint NOT NULL,
    tp_pagamento text NOT NULL,
    vl_pagamento numeric(18,4) DEFAULT 0,
    dt_pagamento timestamp with time zone DEFAULT now(),
    nr_autorizacao text DEFAULT ''::text,
    obs_pagamento text DEFAULT ''::text,
    excluido boolean DEFAULT false,
    condicao_id bigint,
    n_parcelas bigint DEFAULT 1,
    vl_total numeric(18,4) DEFAULT 0
);


ALTER TABLE public.emovimento_pagamento OWNER TO postgres;

--
-- Name: emovimento_pagamento_emovimento_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento_pagamento ALTER COLUMN emovimento_pagamento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.emovimento_pagamento_emovimento_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: empresa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa (
    empresa_id bigint NOT NULL,
    razao_social text DEFAULT 'Empresa Padrão'::text NOT NULL,
    nome_fantasia text DEFAULT ''::text NOT NULL,
    identificacao character varying DEFAULT ''::character varying,
    cnpj character varying DEFAULT ''::character varying NOT NULL,
    ie character varying DEFAULT ''::character varying,
    endereco_logradouro character varying DEFAULT ''::character varying,
    endereco_numero character varying DEFAULT ''::character varying,
    endereco_bairro character varying DEFAULT ''::character varying,
    endereco_cep character varying DEFAULT ''::character varying,
    endereco_cidade_id integer DEFAULT 0,
    fone_geral character varying DEFAULT ''::character varying,
    fone_comercial character varying DEFAULT ''::character varying,
    fone_financeiro character varying DEFAULT ''::character varying,
    fone_faturamento character varying DEFAULT ''::character varying,
    regime_trib character varying DEFAULT 'S'::character varying,
    empresa_matriz_id integer,
    qt_saida_qt_decimais smallint DEFAULT 2,
    vl_saida_qt_decimais smallint DEFAULT 2,
    qt_venda_qt_decimais smallint DEFAULT 2,
    vl_venda_qt_decimais smallint DEFAULT 2,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    cor_primaria text DEFAULT '#8B5CF6'::text,
    cor_secundaria text DEFAULT '#6D28D9'::text,
    cor_destaque text DEFAULT '#F59E0B'::text,
    cor_fundo text DEFAULT '#FFFFFF'::text,
    cor_fundo_card text DEFAULT '#F8FAFC'::text,
    cor_texto_principal text DEFAULT '#1E293B'::text,
    cor_texto_secundario text DEFAULT '#64748B'::text,
    cor_botao text DEFAULT '#8B5CF6'::text,
    cor_botao_negativo text DEFAULT '#EF4444'::text,
    cor_header text DEFAULT '#7C3AED'::text,
    cor_link text DEFAULT '#8B5CF6'::text,
    cor_menu text DEFAULT '#4C1D95'::text,
    nm_escola text DEFAULT 'Escola'::text,
    url_logo text DEFAULT ''::text,
    url_favicon text DEFAULT ''::text,
    url_banner_vendas text DEFAULT ''::text,
    url_link_vendas text DEFAULT ''::text,
    msg_pos_pagamento text DEFAULT 'Pagamento confirmado! Seu lanche estará disponível para retirada.'::text,
    lg_valida_estoque_link boolean DEFAULT true,
    lg_valida_estoque_pdv boolean DEFAULT false,
    email_remetente text DEFAULT ''::text,
    abacatepay_api_key text DEFAULT ''::text,
    abacatepay_webhook_url text DEFAULT ''::text,
    abacatepay_webhook_secret text DEFAULT ''::text,
    css_customizado text DEFAULT ''::text,
    logomarca text DEFAULT ''::text,
    valida_estoque character varying(1) DEFAULT 'S'::character varying,
    tp_operacao_caixa integer DEFAULT 1 NOT NULL,
    conta_gerencial_caixa integer DEFAULT 1,
    centro_custo_caixa integer DEFAULT 1 NOT NULL,
    empresa_deposito_caixa integer DEFAULT 1,
    deposito_estoque_caixa integer DEFAULT 1 NOT NULL,
    imagem_caixa text DEFAULT ''::text NOT NULL,
    cor_input_fundo text DEFAULT '#FFFFFF'::text,
    cor_input_readonly text DEFAULT '#F1F5F9'::text,
    cor_input_borda text DEFAULT '#CBD5E1'::text,
    cor_input_label text DEFAULT '#64748B'::text,
    tempo_animacao integer DEFAULT 5 NOT NULL,
    dfe_maxnsu_busca smallint DEFAULT 20,
    pc_icms_interestadual numeric(10,4) DEFAULT 12,
    pc_fcp_empresa numeric(10,4) DEFAULT 0,
    pdv_pesquisa_campos text DEFAULT '["codigo","nome","unidade","preco","estoque_disp","reservado"]'::text,
    pdv_pesquisa_campos_cliente text DEFAULT '["codigo","cnpj","razao_social","fantasia"]'::text,
    ia_ativa boolean DEFAULT false,
    ia_instrucoes text DEFAULT ''::text,
    ia_modelo text DEFAULT 'gpt-4o'::text,
    pesquisa_prod_min_letras smallint DEFAULT 3 NOT NULL,
    pesquisa_prod_limite integer DEFAULT 200 NOT NULL,
    deposito_venda_externa_id bigint,
    nm_aba_lojavirtual text DEFAULT 'Cardápio'::text
);


ALTER TABLE public.empresa OWNER TO postgres;

--
-- Name: COLUMN empresa.cor_input_fundo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.cor_input_fundo IS 'Cor de fundo dos campos editáveis (hex)';


--
-- Name: COLUMN empresa.cor_input_readonly; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.cor_input_readonly IS 'Cor de fundo dos campos somente leitura (hex)';


--
-- Name: COLUMN empresa.cor_input_borda; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.cor_input_borda IS 'Cor da moldura/borda dos campos (hex)';


--
-- Name: COLUMN empresa.cor_input_label; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.cor_input_label IS 'Cor dos labels/rótulos dos campos (hex)';


--
-- Name: COLUMN empresa.tempo_animacao; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.tempo_animacao IS 'Intervalo (s) entre execucoes da animacao do bot RealSys. 0 desativa.';


--
-- Name: COLUMN empresa.pc_icms_interestadual; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.pc_icms_interestadual IS 'Aliquota ICMS interestadual das saidas desta empresa (ex: 12). CRT derivado de regime_trib: S=1, L/N=3.';


--
-- Name: COLUMN empresa.pc_fcp_empresa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.pc_fcp_empresa IS 'FCP do estado sede da empresa (para DIFAL interno).';


--
-- Name: COLUMN empresa.ia_ativa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.ia_ativa IS 'Indica se o processamento por IA (Realsys) está ativo para a empresa.';


--
-- Name: COLUMN empresa.ia_instrucoes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.ia_instrucoes IS 'System Prompt / Instruções detalhadas de como a IA deve agir.';


--
-- Name: COLUMN empresa.ia_modelo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.ia_modelo IS 'Modelo de IA utilizado para o serviço.';


--
-- Name: COLUMN empresa.pesquisa_prod_min_letras; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.pesquisa_prod_min_letras IS 'Quantidade mínima de caracteres para iniciar a busca dinâmica de produtos';


--
-- Name: COLUMN empresa.pesquisa_prod_limite; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.empresa.pesquisa_prod_limite IS 'Limite de registros retornados na pesquisa dinâmica de produtos';


--
-- Name: empresa_empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa ALTER COLUMN empresa_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.empresa_empresa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: empresa_hs_lojavirtual; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa_hs_lojavirtual (
    id bigint NOT NULL,
    empresa_id bigint,
    dia_semana integer NOT NULL,
    hr_inicio_matutino time without time zone,
    hr_fim_matutino time without time zone,
    hr_inicio_vespertino time without time zone,
    hr_fim_vespertino time without time zone,
    hr_inicio_noturno time without time zone,
    hr_fim_noturno time without time zone,
    lg_dia_ativo boolean DEFAULT false,
    excluido boolean DEFAULT false
);


ALTER TABLE public.empresa_hs_lojavirtual OWNER TO postgres;

--
-- Name: empresa_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.empresa_usuario (
    empresa_usuario_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    user_id uuid NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.empresa_usuario OWNER TO postgres;

--
-- Name: empresa_usuario_empresa_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa_usuario ALTER COLUMN empresa_usuario_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.empresa_usuario_empresa_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estado; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estado (
    estado_id character varying(2) NOT NULL,
    icms_interno numeric(9,3),
    pc_fcp numeric(9,3),
    icms_externo numeric(9,3),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    nm_estado character varying(30),
    cd_ibge character varying(2),
    pc_fcp_st numeric(10,4) DEFAULT 0,
    reducao_bc_interna numeric(10,4) DEFAULT 0
);


ALTER TABLE public.estado OWNER TO postgres;

--
-- Name: COLUMN estado.icms_interno; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.estado.icms_interno IS 'Aliquota ICMS interna (operacoes dentro do estado).';


--
-- Name: COLUMN estado.pc_fcp; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.estado.pc_fcp IS 'FCP - Fundo de Combate a Pobreza (%).';


--
-- Name: COLUMN estado.icms_externo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.estado.icms_externo IS 'Aliquota ICMS interestadual de entrada (fallback).';


--
-- Name: COLUMN estado.pc_fcp_st; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.estado.pc_fcp_st IS 'FCP-ST na Substituicao Tributaria.';


--
-- Name: COLUMN estado.reducao_bc_interna; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.estado.reducao_bc_interna IS 'Reducao percentual da BC ICMS interno padrao do estado.';


--
-- Name: estoque; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estoque (
    estoque_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    produto_id bigint NOT NULL,
    deposito_id integer DEFAULT 1 NOT NULL,
    estoque_fisico numeric(20,8) DEFAULT 0,
    estoque_reservado numeric(20,8) DEFAULT 0,
    estoque_minimo numeric DEFAULT 0,
    estoque_padrao numeric DEFAULT 0,
    estoque_inventario numeric DEFAULT 0,
    endereco character varying DEFAULT ''::character varying NOT NULL,
    dt_ult_entrada timestamp with time zone,
    dt_ult_saida timestamp with time zone,
    excluido boolean DEFAULT false,
    dt_alteracao timestamp with time zone DEFAULT now(),
    estoque_disponivel numeric(20,8) GENERATED ALWAYS AS ((estoque_fisico - estoque_reservado)) STORED,
    cd_estoque bigint
);


ALTER TABLE public.estoque OWNER TO postgres;

--
-- Name: estoque_estoque_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.estoque ALTER COLUMN estoque_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.estoque_estoque_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: estoque_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.estoque_log (
    estoque_log_id bigint NOT NULL,
    empresa_id bigint,
    produto_id bigint,
    deposito_id bigint,
    qt_movimento numeric,
    qt_estoque_deposito numeric,
    qt_estoque_geral numeric,
    usuario character varying,
    dt_hs_log timestamp with time zone DEFAULT now(),
    operacao character varying,
    origem character varying,
    nr_doc character varying
);


ALTER TABLE public.estoque_log OWNER TO postgres;

--
-- Name: estoque_log_estoque_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.estoque_log ALTER COLUMN estoque_log_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.estoque_log_estoque_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fator_conversao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fator_conversao (
    empresa_id integer NOT NULL,
    fator_conversao_id integer NOT NULL,
    produto_id integer NOT NULL,
    unidade_id character varying(5) NOT NULL,
    fator numeric(9,2) NOT NULL,
    tp_movimento character varying(2) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    cd_fator_conversao integer
);


ALTER TABLE public.fator_conversao OWNER TO postgres;

--
-- Name: fator_conversao_fator_conversao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fator_conversao ALTER COLUMN fator_conversao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fator_conversao_fator_conversao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: financeiro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financeiro (
    empresa_id integer DEFAULT 1 NOT NULL,
    financeiro_id bigint NOT NULL,
    movimento_id integer DEFAULT 0,
    documento character varying(20) DEFAULT ''::character varying NOT NULL,
    parcela integer DEFAULT 0,
    tp_documento_id character varying(2) DEFAULT ''::character varying,
    tp_conta character varying(1) DEFAULT ''::character varying,
    dt_emissao timestamp without time zone,
    dt_vencto timestamp without time zone,
    portador_id integer DEFAULT 0,
    cadastro_id integer DEFAULT 0,
    observacao1 character varying(100) DEFAULT ''::character varying,
    observacao2 character varying(100) DEFAULT ''::character varying,
    vl_titulo numeric(12,2) DEFAULT 0,
    vl_desconto numeric(12,2) DEFAULT 0,
    vl_pago numeric(12,2) DEFAULT 0,
    vl_adicional numeric(12,2) DEFAULT 0,
    vl_despesa numeric(12,2) DEFAULT 0,
    linha_digitavel character varying(60) DEFAULT ''::character varying,
    cod_barras character varying(50) DEFAULT ''::character varying,
    nosso_numero character varying(20) DEFAULT ''::character varying,
    enviado_remissa character varying(1) DEFAULT 'N'::character varying,
    emitido_bol character varying(1) DEFAULT 'N'::character varying,
    planoconta_id integer DEFAULT 0,
    plano_id integer DEFAULT 0,
    funcionario_id integer DEFAULT 0,
    st_programacao character varying(1) DEFAULT ''::character varying,
    st_execucao character varying(1) DEFAULT ''::character varying,
    cadastro_id_dest integer DEFAULT 0,
    aviario character varying(2) DEFAULT ''::character varying,
    modelo character varying(2) DEFAULT ''::character varying,
    serie character varying(2) DEFAULT ''::character varying,
    quantidade numeric(9,2) DEFAULT 0,
    autenticacao character varying(200) DEFAULT ''::character varying,
    cobranca_asaas character varying(25) DEFAULT ''::character varying,
    gerou_cobranca character varying(1) DEFAULT 'N'::character varying,
    ativo character varying(1) DEFAULT 'S'::character varying,
    pct_juros numeric(12,2) DEFAULT 0,
    pct_multa numeric(12,2) DEFAULT 0,
    aplica_juros character varying(1) DEFAULT 'S'::character varying,
    aplica_multa character varying(1) DEFAULT 'S'::character varying,
    status character varying(1) DEFAULT 'A'::character varying,
    cd_financeiro bigint
);


ALTER TABLE public.financeiro OWNER TO postgres;

--
-- Name: TABLE financeiro; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.financeiro IS 'Tabela base de títulos financeiros (dados inseridos)';


--
-- Name: financeiro_baixa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.financeiro_baixa (
    financeiro_baixa_id integer NOT NULL,
    empresa_id integer DEFAULT 0 NOT NULL,
    financeiro_id bigint NOT NULL,
    planoconta_id integer DEFAULT 0,
    plano_id integer DEFAULT 0,
    vl_pago numeric(12,2) DEFAULT 0,
    vl_desconto numeric(12,2) DEFAULT 0,
    vl_despesa numeric(12,2) DEFAULT 0,
    vl_juros numeric(12,2) DEFAULT 0,
    observacao character varying(200) DEFAULT ''::character varying,
    recibo character varying(10) DEFAULT ''::character varying,
    dt_pagamento timestamp without time zone,
    dt_operacao timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    funcionario_id integer DEFAULT 0,
    documento character varying(15) DEFAULT ''::character varying,
    cadastro_id integer DEFAULT 0,
    conta_id character varying(10) DEFAULT ''::character varying,
    tp_conta character varying(1) DEFAULT ''::character varying,
    tipo_pag_rec_id integer
);


ALTER TABLE public.financeiro_baixa OWNER TO postgres;

--
-- Name: TABLE financeiro_baixa; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.financeiro_baixa IS 'Registro de baixas/pagamentos aplicados aos títulos financeiros';


--
-- Name: financeiro_baixa_financeiro_baixa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.financeiro_baixa ALTER COLUMN financeiro_baixa_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.financeiro_baixa_financeiro_baixa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: financeiro_financeiro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.financeiro ALTER COLUMN financeiro_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.financeiro_financeiro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: financeiro_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.financeiro_view AS
 SELECT empresa_id,
    financeiro_id,
    movimento_id,
    documento,
    parcela,
    tp_documento_id,
    tp_conta,
    dt_emissao,
    dt_vencto,
    portador_id,
    cadastro_id,
    observacao1,
    observacao2,
    vl_titulo,
    vl_desconto,
    vl_pago,
    vl_adicional,
    vl_despesa,
    linha_digitavel,
    cod_barras,
    nosso_numero,
    enviado_remissa,
    emitido_bol,
    planoconta_id,
    plano_id,
    funcionario_id,
    st_programacao,
    st_execucao,
    cadastro_id_dest,
    aviario,
    modelo,
    serie,
    quantidade,
    autenticacao,
    cobranca_asaas,
    gerou_cobranca,
    ativo,
    pct_juros,
    pct_multa,
    aplica_juros,
    aplica_multa,
    status,
        CASE
            WHEN ((vl_pago < vl_titulo) AND ((ativo)::text = 'S'::text) AND (dt_vencto IS NOT NULL)) THEN GREATEST(0, (CURRENT_DATE - (dt_vencto)::date))
            ELSE 0
        END AS dias_atraso,
        CASE
            WHEN (((aplica_multa)::text = 'S'::text) AND ((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date < CURRENT_DATE)) THEN (vl_titulo * (pct_multa / 100.00))
            ELSE (0)::numeric
        END AS vl_multa,
        CASE
            WHEN (((aplica_juros)::text = 'S'::text) AND ((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date < CURRENT_DATE)) THEN (((vl_titulo * (pct_juros / 100.00)) / 30.0) * ((CURRENT_DATE - (dt_vencto)::date))::numeric)
            ELSE (0)::numeric
        END AS vl_juros,
    ((((((vl_titulo +
        CASE
            WHEN (((aplica_multa)::text = 'S'::text) AND ((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date < CURRENT_DATE)) THEN (vl_titulo * (pct_multa / 100.00))
            ELSE (0)::numeric
        END) +
        CASE
            WHEN (((aplica_juros)::text = 'S'::text) AND ((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date < CURRENT_DATE)) THEN (((vl_titulo * (pct_juros / 100.00)) / 30.0) * ((CURRENT_DATE - (dt_vencto)::date))::numeric)
            ELSE (0)::numeric
        END) + vl_adicional) + vl_despesa) - vl_desconto) - vl_pago) AS vl_a_pagar,
        CASE
            WHEN (((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date >= CURRENT_DATE) AND (vl_pago = (0)::numeric)) THEN 'A VENCER'::text
            WHEN (((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date >= CURRENT_DATE) AND (vl_pago > (0)::numeric)) THEN 'PAGTO PARCIAL'::text
            WHEN (((status)::text = 'A'::text) AND (dt_vencto IS NOT NULL) AND ((dt_vencto)::date < CURRENT_DATE)) THEN 'VENCIDO'::text
            WHEN ((status)::text = 'B'::text) THEN 'BAIXADO'::text
            WHEN ((status)::text = 'C'::text) THEN 'CANCELADO'::text
            ELSE 'INDEFINIDO'::text
        END AS situacao
   FROM public.financeiro f;


ALTER VIEW public.financeiro_view OWNER TO postgres;

--
-- Name: fiscal_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_config (
    empresa_id integer NOT NULL,
    certificado character varying(300),
    licenca character varying(200),
    webser_nfce character varying(10),
    ultima_nfce integer,
    serie_nfce character varying(5),
    modelo_nfce character varying(3),
    ambiente_nfce character varying(1),
    webser_nfe character varying(10),
    ultima_nfe integer,
    serie_nfe character varying(5),
    modelo_nfe character varying(3),
    ambiente_nfe character varying(1),
    versao_nf character varying(5),
    contingencia_nfce character varying(1),
    contingencia_nfe character varying(1),
    url_consulta character varying(300),
    url_consultah character varying(300),
    url_chave character varying(300),
    url_chaveh character varying(300),
    licenca_mdf character varying(200),
    webser_mdf character varying(10),
    modelo_mdf character varying(3),
    ambiente_mdf character varying(1),
    versao_mdf character varying(5),
    contingencia_mdf character varying(1),
    serie_mdf character varying(5),
    ultimo_mdf integer,
    ti_emitente_mdf integer,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    senha_certificado character varying(100),
    tipo_certificado character varying(20) DEFAULT 'ARQUIVO'::character varying,
    dfe_maxnsu_busca integer DEFAULT 0 NOT NULL,
    cliente_padrao_id bigint DEFAULT 1,
    email_smtp_host text,
    email_smtp_port integer DEFAULT 587,
    email_smtp_user text,
    email_smtp_pass text,
    email_smtp_ssl boolean DEFAULT false,
    email_smtp_tls boolean DEFAULT true,
    email_assunto_nfe text DEFAULT 'NF-e emitida: [CHAVE]'::text,
    email_corpo_nfe text DEFAULT 'Olá, segue em anexo a NF-e e o DANFE referente à sua compra.'::text,
    pasta_arquivos_fiscais text,
    nr_timeout_nfe integer DEFAULT 60 NOT NULL,
    nfe_versao_metodo text DEFAULT '1.0'::text,
    nfce_versao_metodo text DEFAULT '1.0'::text,
    ssl_lib text,
    ssl_crypt_lib text,
    ssl_http_lib text,
    ssl_xml_sign_lib text,
    ssl_type text,
    verificar_validade_cert boolean DEFAULT true
);


ALTER TABLE public.fiscal_config OWNER TO postgres;

--
-- Name: COLUMN fiscal_config.email_smtp_host; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_config.email_smtp_host IS 'Servidor SMTP para envio de e-mails fiscais.';


--
-- Name: COLUMN fiscal_config.email_smtp_port; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_config.email_smtp_port IS 'Porta do servidor SMTP (Ex: 587 para TLS, 465 para SSL).';


--
-- Name: COLUMN fiscal_config.nfe_versao_metodo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_config.nfe_versao_metodo IS 'Versão do método de emissão NFe (1.0 = INI, 2.0 = XML)';


--
-- Name: COLUMN fiscal_config.nfce_versao_metodo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_config.nfce_versao_metodo IS 'Versão do método de emissão NFCe (1.0 = INI, 2.0 = XML)';


--
-- Name: fiscal_config_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_config_item (
    empresa_id integer NOT NULL,
    fiscal_config_item_id integer NOT NULL,
    modelo character varying(5) DEFAULT '65'::character varying NOT NULL,
    serie character varying(10) DEFAULT '45'::character varying NOT NULL,
    sequencia integer DEFAULT 1 NOT NULL,
    csc character varying(20),
    id_csc character varying(20),
    nome character varying(30),
    enviar_email character(1) DEFAULT 'N'::bpchar,
    tp_imp character varying(20) DEFAULT 'PDF'::character varying,
    nm_impressora character varying(100),
    CONSTRAINT fiscal_config_item_enviar_email_check CHECK ((enviar_email = ANY (ARRAY['S'::bpchar, 'N'::bpchar])))
);


ALTER TABLE public.fiscal_config_item OWNER TO postgres;

--
-- Name: COLUMN fiscal_config_item.enviar_email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_config_item.enviar_email IS 'Define se deve abrir o formulário de envio de e-mail após a emissão (S=Sim, N=Não)';


--
-- Name: fiscal_evento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_evento (
    id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    tipo character varying(50) NOT NULL,
    comando character varying(100) NOT NULL,
    payload jsonb,
    status character varying(50) DEFAULT 'PENDENTE'::character varying NOT NULL,
    resposta text,
    xml_retorno text,
    mensagem_erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    ambiente smallint,
    user_id uuid,
    nfe_cabecalho_id bigint,
    mdf_manifesto_id bigint
);

ALTER TABLE ONLY public.fiscal_evento REPLICA IDENTITY FULL;


ALTER TABLE public.fiscal_evento OWNER TO postgres;

--
-- Name: COLUMN fiscal_evento.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_evento.user_id IS 'ID do usuário que disparou o comando';


--
-- Name: COLUMN fiscal_evento.nfe_cabecalho_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_evento.nfe_cabecalho_id IS 'Vínculo direto com o cabeçalho da NF-e para facilitar rastreabilidade de logs.';


--
-- Name: COLUMN fiscal_evento.mdf_manifesto_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_evento.mdf_manifesto_id IS 'Vínculo direto com o MDF-e para rastreabilidade de logs e eventos.';


--
-- Name: fiscal_evento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_evento ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fiscal_evento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_grupo_produto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_grupo_produto (
    fiscal_grupo_produto_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    nome character varying(30) NOT NULL,
    tp_imposto character varying(20) NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_grupo_produto OWNER TO postgres;

--
-- Name: fiscal_grupo_produto_fiscal_grupo_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_grupo_produto ALTER COLUMN fiscal_grupo_produto_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_grupo_produto_fiscal_grupo_produto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_mdf_carrega; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_carrega (
    empresa_id integer NOT NULL,
    mdf_carrega_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    cidade_id integer NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_carrega OWNER TO postgres;

--
-- Name: fiscal_mdf_componente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_componente (
    empresa_id character varying(18) NOT NULL,
    mdf_componente_id integer NOT NULL,
    mdf_manifesto_id numeric NOT NULL,
    tp_componente character varying(2),
    vl_componente numeric(18,2),
    ds_componente character varying(60),
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_componente OWNER TO postgres;

--
-- Name: fiscal_mdf_condutor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_condutor (
    empresa_id integer NOT NULL,
    mdf_condutor_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    condutor_id integer NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_condutor OWNER TO postgres;

--
-- Name: fiscal_mdf_descarrega; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_descarrega (
    empresa_id integer NOT NULL,
    mdf_descarrega_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    cidade_id integer NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_descarrega OWNER TO postgres;

--
-- Name: fiscal_mdf_documento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_documento (
    empresa_id integer NOT NULL,
    mdf_documento_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    cidade_id integer NOT NULL,
    chave character varying(44) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_documento OWNER TO postgres;

--
-- Name: fiscal_mdf_historicoxml; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_historicoxml (
    empresa_id integer NOT NULL,
    mdf_historicoxml_id integer NOT NULL,
    mdf_historico_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    protocolo_autorizado character varying(20),
    dt_autorizado date,
    hr_autorizado character varying(20),
    protocolo_encerrado character varying(20),
    dt_encerrado date,
    hr_encerrado character varying(20),
    protocolo_cancelado character varying(20),
    dt_cancelado date,
    hr_cancelado character varying(20),
    chave character varying(44),
    status_retorno integer,
    xml_enviado text,
    xml_retorno text,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_historicoxml OWNER TO postgres;

--
-- Name: fiscal_mdf_manifesto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_manifesto (
    empresa_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    numero integer NOT NULL,
    serie character(10) NOT NULL,
    modelo character varying(5) NOT NULL,
    dt_emissao date,
    dt_viagem date,
    hr_viagem character varying(8),
    modalidade character varying(1),
    ufini character varying(2),
    uffim character varying(2),
    peso_total numeric(18,3),
    valor_total numeric(18,2),
    qtd_nfe integer,
    tp_emitente character varying(1),
    tp_transportador character varying(1),
    unidade character varying(6),
    status character varying(1),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    rntrc character varying(20),
    chave_acesso character varying(44),
    numero_protocolo character varying(20),
    codigo_numerico integer,
    digito_verificador integer,
    ciot character varying(12) DEFAULT NULL::character varying,
    ciot_cnpj_cpf character varying(14) DEFAULT NULL::character varying,
    contratante_cnpj_cpf character varying(14) DEFAULT NULL::character varying,
    contratante_nome character varying(60) DEFAULT NULL::character varying,
    transp_cnpj_cpf character varying(14) DEFAULT NULL::character varying
);


ALTER TABLE public.fiscal_mdf_manifesto OWNER TO postgres;

--
-- Name: COLUMN fiscal_mdf_manifesto.chave_acesso; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_mdf_manifesto.chave_acesso IS 'Chave de acesso de 44 caracteres gerada pela SEFAZ.';


--
-- Name: COLUMN fiscal_mdf_manifesto.numero_protocolo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_mdf_manifesto.numero_protocolo IS 'Número do protocolo de autorização retornado pela SEFAZ.';


--
-- Name: fiscal_mdf_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_pagamento (
    empresa_id character varying(18) NOT NULL,
    mdf_pagamento_id integer NOT NULL,
    mdf_manifesto_id numeric NOT NULL,
    vl_contrato numeric(18,2),
    forma_pagto character varying(1),
    banco character varying(10),
    agencia character varying(10),
    cnpjipef character varying(14),
    chave_pix character varying(60),
    adiantamento numeric(18,2),
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_pagamento OWNER TO postgres;

--
-- Name: fiscal_mdf_pagtos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_pagtos (
    empresa_id character varying(18) NOT NULL,
    mdf_pagtos_id integer NOT NULL,
    mdf_manifesto_id numeric NOT NULL,
    nr_parcela character varying(3) NOT NULL,
    dt_vencimento date,
    vl_parcela numeric(18,2),
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_pagtos OWNER TO postgres;

--
-- Name: fiscal_mdf_percurso; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_percurso (
    empresa_id integer NOT NULL,
    mdf_percurso_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    uf character varying(2) NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_mdf_percurso OWNER TO postgres;

--
-- Name: fiscal_mdf_veiculo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_mdf_veiculo (
    empresa_id integer NOT NULL,
    mdf_veiculo_id integer NOT NULL,
    mdf_manifesto_id integer NOT NULL,
    veiculo_id integer NOT NULL,
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone,
    placa character varying(10),
    renavam character varying(11),
    tara integer DEFAULT 0,
    capacidade_kg integer DEFAULT 0,
    tp_rodado character varying(2),
    tp_carroceria character varying(2),
    uf character varying(2),
    tp_veiculo character varying(10)
);


ALTER TABLE public.fiscal_mdf_veiculo OWNER TO postgres;

--
-- Name: fiscal_nfe_cabecalho; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_cabecalho (
    nfe_cabecalho_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    cadastro_id bigint,
    deposito_id bigint,
    origem_inclusao text DEFAULT 'M'::text NOT NULL,
    st_nf text DEFAULT 'A'::text NOT NULL,
    nr_nota text DEFAULT ''::text NOT NULL,
    serie text DEFAULT ''::text NOT NULL,
    dt_emissao date,
    dt_entrada date,
    dt_saida date,
    chave_nfe text DEFAULT ''::text NOT NULL,
    nr_protocolo text DEFAULT ''::text NOT NULL,
    vl_produto numeric(15,2) DEFAULT 0 NOT NULL,
    vl_desconto numeric(15,2) DEFAULT 0 NOT NULL,
    vl_frete numeric(15,2) DEFAULT 0 NOT NULL,
    vl_seguro numeric(15,2) DEFAULT 0 NOT NULL,
    vl_despesa numeric(15,2) DEFAULT 0 NOT NULL,
    vl_ipi numeric(15,2) DEFAULT 0 NOT NULL,
    vl_icms_st numeric(15,2) DEFAULT 0 NOT NULL,
    vl_total_nf numeric(15,2) DEFAULT 0 NOT NULL,
    obs_nf text DEFAULT ''::text NOT NULL,
    xml_nf text,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    dt_alteracao timestamp with time zone,
    modelo character varying(2) DEFAULT '55'::character varying NOT NULL,
    tp_nf smallint DEFAULT 0 NOT NULL,
    fin_nfe smallint DEFAULT 1 NOT NULL,
    nat_op character varying(60) DEFAULT ''::character varying NOT NULL,
    tp_emis smallint DEFAULT 1 NOT NULL,
    c_stat integer,
    x_motivo character varying(255),
    recibo_sefaz character varying(50),
    vl_pis numeric(15,2) DEFAULT 0 NOT NULL,
    vl_cofins numeric(15,2) DEFAULT 0 NOT NULL,
    vl_ibs numeric(15,2) DEFAULT 0 NOT NULL,
    vl_cbs numeric(15,2) DEFAULT 0 NOT NULL,
    vl_is numeric(15,2) DEFAULT 0 NOT NULL,
    movimento_id bigint,
    vl_icms numeric(15,2) DEFAULT 0 NOT NULL,
    vl_bc numeric(15,2) DEFAULT 0 NOT NULL,
    motivo_cancelamento text,
    protocolo_cancelamento text,
    dt_cancelamento timestamp with time zone,
    vl_fcp numeric DEFAULT 0 NOT NULL,
    vl_fcp_st numeric DEFAULT 0 NOT NULL,
    vl_fcp_st_ret numeric DEFAULT 0 NOT NULL,
    vl_icms_deson numeric DEFAULT 0 NOT NULL,
    vl_ii numeric DEFAULT 0 NOT NULL,
    vl_ipi_devol numeric DEFAULT 0 NOT NULL,
    vl_outro numeric DEFAULT 0 NOT NULL,
    pedido_id bigint,
    CONSTRAINT fiscal_nfe_cabecalho_origem_inclusao_check CHECK ((origem_inclusao = ANY (ARRAY['M'::text, 'X'::text]))),
    CONSTRAINT nfe_cabecalho_st_nf_check CHECK ((st_nf = ANY (ARRAY['A'::text, 'C'::text, 'E'::text, 'D'::text, 'R'::text, 'P'::text])))
);


ALTER TABLE public.fiscal_nfe_cabecalho OWNER TO postgres;

--
-- Name: COLUMN fiscal_nfe_cabecalho.modelo; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_nfe_cabecalho.modelo IS 'Modelo do Documento (55, 65, etc)';


--
-- Name: COLUMN fiscal_nfe_cabecalho.motivo_cancelamento; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_nfe_cabecalho.motivo_cancelamento IS 'Justificativa para o cancelamento da nota (mínimo 15 caracteres)';


--
-- Name: COLUMN fiscal_nfe_cabecalho.protocolo_cancelamento; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_nfe_cabecalho.protocolo_cancelamento IS 'Número do protocolo de homologação do cancelamento pela SEFAZ';


--
-- Name: COLUMN fiscal_nfe_cabecalho.dt_cancelamento; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_nfe_cabecalho.dt_cancelamento IS 'Data e hora em que o cancelamento foi processado';


--
-- Name: fiscal_nfe_cce; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_cce (
    nfe_cce_id bigint NOT NULL,
    nfe_cabecalho_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    nr_sequencial integer DEFAULT 1 NOT NULL,
    x_correcao text NOT NULL,
    dt_evento timestamp with time zone DEFAULT now() NOT NULL,
    tp_evento character varying(10) DEFAULT '110110'::character varying NOT NULL,
    st_evento character varying(1) DEFAULT 'A'::character varying NOT NULL,
    c_stat integer,
    x_motivo text,
    nr_protocolo character varying(50),
    xml_evento text,
    xml_retorno text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fiscal_nfe_cce OWNER TO postgres;

--
-- Name: fiscal_nfe_cce_nfe_cce_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_cce ALTER COLUMN nfe_cce_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fiscal_nfe_cce_nfe_cce_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_nfe_inutilizacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_inutilizacao (
    inutilizacao_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    modelo character varying(2) DEFAULT '55'::character varying NOT NULL,
    serie character varying(5) NOT NULL,
    nr_ini integer NOT NULL,
    nr_fin integer NOT NULL,
    justificativa character varying(255) NOT NULL,
    ambiente smallint DEFAULT 1 NOT NULL,
    cnpj character varying(18),
    c_stat integer,
    x_motivo character varying(255),
    nr_protocolo character varying(50),
    xml_retorno text,
    st_inutilizacao character varying(20) DEFAULT 'PENDENTE'::character varying NOT NULL,
    fiscal_evento_id bigint,
    usuario_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.fiscal_nfe_inutilizacao OWNER TO postgres;

--
-- Name: TABLE fiscal_nfe_inutilizacao; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fiscal_nfe_inutilizacao IS 'Registro de inutilizações de numeração NF-e/NFC-e comunicadas à SEFAZ.
Números inutilizados não podem ser reutilizados.';


--
-- Name: fiscal_nfe_inutilizacao_inutilizacao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_inutilizacao ALTER COLUMN inutilizacao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_nfe_inutilizacao_inutilizacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_nfe_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_item (
    nfe_item_id bigint NOT NULL,
    nfe_cabecalho_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    produto_id bigint,
    nr_item integer DEFAULT 0 NOT NULL,
    cd_prod_fornec text DEFAULT ''::text NOT NULL,
    nm_produto text DEFAULT ''::text NOT NULL,
    ncm text DEFAULT ''::text NOT NULL,
    cfop text DEFAULT ''::text NOT NULL,
    unidade text DEFAULT ''::text NOT NULL,
    gtin text DEFAULT ''::text NOT NULL,
    qt_entrada numeric(15,4) DEFAULT 0 NOT NULL,
    vl_unit numeric(15,4) DEFAULT 0 NOT NULL,
    vl_desconto numeric(15,2) DEFAULT 0 NOT NULL,
    vl_total numeric(15,2) DEFAULT 0 NOT NULL,
    vl_ipi numeric(15,2) DEFAULT 0 NOT NULL,
    vl_icms_st numeric(15,2) DEFAULT 0 NOT NULL,
    vl_pis numeric(15,2) DEFAULT 0 NOT NULL,
    vl_cofins numeric(15,2) DEFAULT 0 NOT NULL,
    vl_fcp_st numeric(15,2) DEFAULT 0 NOT NULL,
    pc_ipi numeric(8,4) DEFAULT 0 NOT NULL,
    pc_icms numeric(8,4) DEFAULT 0 NOT NULL,
    pc_icms_st numeric(8,4) DEFAULT 0 NOT NULL,
    pc_pis numeric(8,4) DEFAULT 0 NOT NULL,
    pc_cofins numeric(8,4) DEFAULT 0 NOT NULL,
    pc_fcp_st numeric(8,4) DEFAULT 0 NOT NULL,
    cst_icms text DEFAULT ''::text NOT NULL,
    cst_ipi text DEFAULT ''::text NOT NULL,
    cst_pis text DEFAULT ''::text NOT NULL,
    cst_cofins text DEFAULT ''::text NOT NULL,
    pc_mva numeric(8,4) DEFAULT 0 NOT NULL,
    vl_bc_st numeric(15,2) DEFAULT 0 NOT NULL,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    origem smallint DEFAULT 0 NOT NULL,
    csosn character varying(3) DEFAULT ''::character varying NOT NULL,
    cest character varying(7) DEFAULT ''::character varying NOT NULL,
    c_enq character varying(3) DEFAULT '999'::character varying NOT NULL,
    cst_ibs character varying(2) DEFAULT ''::character varying NOT NULL,
    pc_ibs numeric(8,4) DEFAULT 0 NOT NULL,
    vl_ibs numeric(15,2) DEFAULT 0 NOT NULL,
    cst_cbs character varying(2) DEFAULT ''::character varying NOT NULL,
    pc_cbs numeric(8,4) DEFAULT 0 NOT NULL,
    vl_cbs numeric(15,2) DEFAULT 0 NOT NULL,
    cst_is character varying(2) DEFAULT ''::character varying NOT NULL,
    pc_is numeric(8,4) DEFAULT 0 NOT NULL,
    vl_is numeric(15,2) DEFAULT 0 NOT NULL,
    vl_icms numeric(15,2) DEFAULT 0 NOT NULL,
    vl_bc numeric(15,2) DEFAULT 0 NOT NULL,
    vl_frete numeric DEFAULT 0 NOT NULL,
    vl_seguro numeric DEFAULT 0 NOT NULL,
    vl_outro numeric DEFAULT 0 NOT NULL,
    qt_tributavel numeric DEFAULT 0 NOT NULL,
    vl_unit_tributavel numeric DEFAULT 0 NOT NULL,
    vl_bc_ipi numeric DEFAULT 0 NOT NULL,
    vl_bc_pis numeric DEFAULT 0 NOT NULL,
    vl_bc_cofins numeric DEFAULT 0 NOT NULL,
    pc_fcp numeric DEFAULT 0 NOT NULL,
    vl_fcp numeric DEFAULT 0 NOT NULL,
    mod_bc smallint DEFAULT 3,
    mod_bc_st smallint DEFAULT 4,
    pc_red_bc numeric DEFAULT 0 NOT NULL,
    pc_red_bc_st numeric DEFAULT 0 NOT NULL,
    vl_icms_deson numeric DEFAULT 0 NOT NULL,
    pc_cred_sn numeric DEFAULT 0 NOT NULL,
    vl_cred_sn numeric DEFAULT 0 NOT NULL
);


ALTER TABLE public.fiscal_nfe_item OWNER TO postgres;

--
-- Name: fiscal_nfe_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_pagamento (
    nfe_pagamento_id bigint NOT NULL,
    nfe_cabecalho_id bigint NOT NULL,
    t_pag character varying(2) NOT NULL,
    v_pag numeric(15,2) DEFAULT 0 NOT NULL,
    tp_integra smallint,
    cnpj_credenciadora character varying(14),
    c_aut character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fiscal_nfe_pagamento OWNER TO postgres;

--
-- Name: fiscal_nfe_pagamento_nfe_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_pagamento ALTER COLUMN nfe_pagamento_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fiscal_nfe_pagamento_nfe_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_nfe_recebida; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_recebida (
    nfe_recebida_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    chave_nfe text NOT NULL,
    cnpj_emitente text NOT NULL,
    nm_emitente text NOT NULL,
    dt_emissao date,
    vl_total numeric(15,2),
    nr_nota text,
    serie text,
    nsu bigint DEFAULT 0,
    st_manifesto text DEFAULT '0'::text NOT NULL,
    st_download boolean DEFAULT false NOT NULL,
    xml_resumo text,
    xml_completo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT nfe_recebida_st_manifesto_check CHECK ((st_manifesto = ANY (ARRAY['0'::text, '210200'::text, '210210'::text, '210220'::text, '210240'::text])))
);


ALTER TABLE public.fiscal_nfe_recebida OWNER TO postgres;

--
-- Name: fiscal_nfe_referenciada; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_nfe_referenciada (
    nfe_referenciada_id bigint NOT NULL,
    nfe_cabecalho_id bigint NOT NULL,
    chave_ref character varying(44) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.fiscal_nfe_referenciada OWNER TO postgres;

--
-- Name: fiscal_nfe_referenciada_nfe_referenciada_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_referenciada ALTER COLUMN nfe_referenciada_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fiscal_nfe_referenciada_nfe_referenciada_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_regra; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_regra (
    fiscal_regra_id integer NOT NULL,
    descricao text NOT NULL,
    cfop_id integer,
    observacao text,
    empresa_id integer DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    regime_trib character varying(30),
    tp_operacao_id bigint DEFAULT 1,
    prioridade integer DEFAULT 0,
    vigencia_inicio date,
    vigencia_fim date
);


ALTER TABLE public.fiscal_regra OWNER TO postgres;

--
-- Name: TABLE fiscal_regra; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fiscal_regra IS 'Header das regras fiscais.';


--
-- Name: COLUMN fiscal_regra.regime_trib; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra.regime_trib IS 'S=Simples Nacional, L=Lucro Presumido, N=Lucro Real, *=Todos';


--
-- Name: COLUMN fiscal_regra.tp_operacao_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra.tp_operacao_id IS 'FK para tp_operacao. NULL = aplica a todos os tipos.';


--
-- Name: fiscal_regra_cfop; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_regra_cfop (
    fiscal_regra_cfop_id integer NOT NULL,
    fiscal_regra_id integer NOT NULL,
    cfop_id integer NOT NULL,
    uf_destino character varying(2) DEFAULT '*'::character varying,
    cliente_contribuinte boolean,
    cliente_consumidor_final boolean,
    ncm_filtro character varying(10) DEFAULT '99999999'::character varying,
    cest_filtro character varying(10) DEFAULT '9999999'::character varying,
    fiscal_grupo_produto_id integer,
    origem_produto character varying(1),
    empresa_id integer DEFAULT 1 NOT NULL,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_regra_cfop OWNER TO postgres;

--
-- Name: TABLE fiscal_regra_cfop; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fiscal_regra_cfop IS 'CFOP resultante por combinação de filtros dentro de uma regra fiscal.';


--
-- Name: COLUMN fiscal_regra_cfop.cfop_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_cfop.cfop_id IS 'FK para tabela cfop. Carrega codigo e descricao do CFOP aplicavel.';


--
-- Name: COLUMN fiscal_regra_cfop.ncm_filtro; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_cfop.ncm_filtro IS '99999999 = wildcard (todos os NCMs).';


--
-- Name: COLUMN fiscal_regra_cfop.cest_filtro; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_cfop.cest_filtro IS '9999999  = wildcard (todos os CESTs).';


--
-- Name: fiscal_regra_cfop_fiscal_regra_cfop_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra_cfop ALTER COLUMN fiscal_regra_cfop_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_regra_cfop_fiscal_regra_cfop_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_regra_fiscal_regra_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra ALTER COLUMN fiscal_regra_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_regra_fiscal_regra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: fiscal_regra_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fiscal_regra_item (
    fiscal_regra_item_id integer NOT NULL,
    fiscal_regra_id integer NOT NULL,
    tipo_imposto character varying(10) NOT NULL,
    uf_destino character varying(2) DEFAULT '*'::character varying,
    cliente_contribuinte boolean,
    cliente_consumidor_final boolean,
    ncm_filtro character varying(10) DEFAULT '99999999'::character varying,
    cest_filtro character varying(10) DEFAULT '9999999'::character varying,
    fiscal_grupo_produto_id bigint,
    origem_produto character varying(1),
    cst_csosn character varying(3),
    aliquota numeric(10,4) DEFAULT 0,
    base_reducao numeric(10,4) DEFAULT 0,
    motivo_desoneracao integer,
    p_cre_sn numeric(10,4) DEFAULT 0,
    icms_st_aliquota numeric(10,4) DEFAULT 0,
    icms_st_mva numeric(10,4) DEFAULT 0,
    icms_st_base_reducao numeric(10,4) DEFAULT 0,
    mod_bc integer DEFAULT 3,
    mod_bc_st integer DEFAULT 4,
    ipi_c_enq character varying(3) DEFAULT '999'::character varying,
    cst_pis_cofins character varying(3),
    nat_receita_pis_cofins character varying(6),
    ibs_aliquota numeric(10,4) DEFAULT 0,
    cbs_aliquota numeric(10,4) DEFAULT 0,
    is_aliquota numeric(10,4) DEFAULT 0,
    empresa_id integer DEFAULT 1 NOT NULL,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.fiscal_regra_item OWNER TO postgres;

--
-- Name: TABLE fiscal_regra_item; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.fiscal_regra_item IS 'Itens da regra fiscal: filtros + campos de cálculo por tributo.';


--
-- Name: COLUMN fiscal_regra_item.tipo_imposto; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.tipo_imposto IS 'ICMS | IPI | PIS | COFINS | CBSIBS';


--
-- Name: COLUMN fiscal_regra_item.ncm_filtro; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.ncm_filtro IS '99999999 = wildcard (todos os NCMs).';


--
-- Name: COLUMN fiscal_regra_item.cest_filtro; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.cest_filtro IS '9999999 (todos 9s) = wildcard geral. Valor especifico sobrep a regra geral.';


--
-- Name: COLUMN fiscal_regra_item.icms_st_mva; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.icms_st_mva IS 'MVA da regra. Sobrep ao MVA do produto se > 0.';


--
-- Name: COLUMN fiscal_regra_item.mod_bc; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.mod_bc IS '0=MVA, 1=Pauta, 2=Preço Max, 3=Valor Op.';


--
-- Name: COLUMN fiscal_regra_item.mod_bc_st; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.fiscal_regra_item.mod_bc_st IS '0=Preço Tab, 1=Pauta, 2=Preço Max, 3=Valor Op., 4=MVA';


--
-- Name: fiscal_regra_item_fiscal_regra_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra_item ALTER COLUMN fiscal_regra_item_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.fiscal_regra_item_fiscal_regra_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: funcionario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.funcionario (
    funcionario_id bigint NOT NULL,
    empresa_id bigint,
    nome character varying(40),
    corretora_id bigint,
    usr_id bigint,
    tp_comissao character varying(20),
    pc_comissao_av numeric(6,2),
    pc_comissao_prz numeric(6,2),
    caixa character varying(1) DEFAULT 'N'::character varying,
    vendedor character varying(1) DEFAULT 'N'::character varying,
    gerente character varying(1) DEFAULT 'N'::character varying,
    motorista character varying(1) DEFAULT 'N'::character varying,
    entregador character varying(1) DEFAULT 'N'::character varying,
    caixa_inf_vend character varying(1) DEFAULT 'N'::character varying,
    caixa_cnc_venda character varying(1) DEFAULT 'N'::character varying,
    tamanho_fonte_pedidos smallint DEFAULT 12 NOT NULL,
    tamanho_fonte_produtos smallint DEFAULT 12 NOT NULL,
    tempo_refresh_pdv integer DEFAULT 30 NOT NULL,
    caixa_edit_venda character varying(1) DEFAULT 'N'::character varying NOT NULL,
    nfe_config_item bigint,
    nfce_config_item bigint,
    tamanho_fonte_totais integer DEFAULT 12,
    mdf_config_item bigint,
    cd_funcionario bigint
);


ALTER TABLE public.funcionario OWNER TO postgres;

--
-- Name: funcionario_funcionario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.funcionario ALTER COLUMN funcionario_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.funcionario_funcionario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: galpao_ambiencia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.galpao_ambiencia (
    id bigint NOT NULL,
    temperatura numeric(10,2),
    umidade numeric(10,2),
    abc_mq character varying(12),
    tensao_mq numeric(10,2),
    temperatura_bmp numeric(10,2),
    pressao_bmp numeric(10,2),
    data_evento timestamp with time zone DEFAULT now(),
    granja character varying(30) DEFAULT 'GRANJA FAROL'::character varying,
    origem character varying DEFAULT 'N'::character varying
);


ALTER TABLE public.galpao_ambiencia OWNER TO postgres;

--
-- Name: galpao_ambiencia_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.galpao_ambiencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.galpao_ambiencia_id_seq OWNER TO postgres;

--
-- Name: galpao_ambiencia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.galpao_ambiencia_id_seq OWNED BY public.galpao_ambiencia.id;


--
-- Name: grupo_icms_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grupo_icms_item (
    empresa_id integer NOT NULL,
    grupo_icms_id integer NOT NULL,
    grupo_icms_item_id integer NOT NULL,
    tp_operacao_id integer NOT NULL,
    tp_movimento character varying(2) NOT NULL,
    tp_contribuinte character varying(2) NOT NULL,
    tp_saida character varying(2) NOT NULL,
    uf_destino character varying(2) NOT NULL,
    pc_icms numeric(9,3),
    pc_icms_st numeric(9,3),
    pc_st_debito numeric(9,3),
    cfop character varying(8),
    ncm character varying(15),
    cst character varying(3),
    iva numeric(9,3),
    mob_bc_st character varying(3),
    pc_reducao numeric(9,3),
    pc_red_icmsst numeric(9,3),
    regime_tributario character varying(1),
    ti_red_icms character varying(1),
    pc_fcp numeric(9,3),
    pc_fcpst numeric(9,3),
    excluido boolean,
    dt_cadastro timestamp with time zone,
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.grupo_icms_item OWNER TO postgres;

--
-- Name: linha_produto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.linha_produto (
    linha_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    cd_linha integer
);


ALTER TABLE public.linha_produto OWNER TO postgres;

--
-- Name: linha_produto_linha_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.linha_produto ALTER COLUMN linha_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.linha_produto_linha_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_carrega_mdf_carrega_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_carrega ALTER COLUMN mdf_carrega_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_carrega_mdf_carrega_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_componente_mdf_componente_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_componente ALTER COLUMN mdf_componente_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_componente_mdf_componente_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_descarrega_mdf_descarrega_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_descarrega ALTER COLUMN mdf_descarrega_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_descarrega_mdf_descarrega_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_documento_mdf_documento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_documento ALTER COLUMN mdf_documento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_documento_mdf_documento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_historicoxml_mdf_historicoxml_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_historicoxml ALTER COLUMN mdf_historicoxml_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_historicoxml_mdf_historicoxml_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_manifesto_mdf_manifesto_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_manifesto ALTER COLUMN mdf_manifesto_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_manifesto_mdf_manifesto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_motorista_mdf_motorista_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_condutor ALTER COLUMN mdf_condutor_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_motorista_mdf_motorista_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_pagamento_mdf_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_pagamento ALTER COLUMN mdf_pagamento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_pagamento_mdf_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_pagtos_mdf_pagtos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_pagtos ALTER COLUMN mdf_pagtos_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_pagtos_mdf_pagtos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_percurso_mdf_percurso_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_percurso ALTER COLUMN mdf_percurso_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_percurso_mdf_percurso_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mdf_veiculo_mdf_veiculo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_veiculo ALTER COLUMN mdf_veiculo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mdf_veiculo_mdf_veiculo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: meio_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.meio_pagamento (
    meio_pagamento_id integer NOT NULL,
    codigo character varying(2),
    descricao character varying(50),
    soma_vl_caixa character varying(1)
);


ALTER TABLE public.meio_pagamento OWNER TO postgres;

--
-- Name: meios_pagamento_meios_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.meio_pagamento ALTER COLUMN meio_pagamento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.meios_pagamento_meios_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimento_nr_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.movimento_nr_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.movimento_nr_seq OWNER TO postgres;

--
-- Name: movimento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimento (
    movimento_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    cadastro_id bigint,
    nr_movimento bigint DEFAULT nextval('public.movimento_nr_seq'::regclass),
    tp_movimento character varying DEFAULT 'PD'::character varying,
    tp_origem character varying DEFAULT 'PDV'::character varying,
    st_pedido character varying DEFAULT 'A'::character varying,
    status character varying DEFAULT 'A'::character varying,
    faturado character varying DEFAULT 'N'::character varying,
    dt_emissao timestamp with time zone DEFAULT now(),
    hr_movimento text DEFAULT ''::text NOT NULL,
    dt_finalizacao timestamp with time zone,
    dt_faturamento timestamp with time zone,
    dt_pagamento timestamp with time zone,
    dt_cancelamento timestamp with time zone,
    vl_produto numeric DEFAULT 0,
    vl_desconto numeric DEFAULT 0,
    vl_movimento numeric DEFAULT 0,
    observacao character varying DEFAULT ''::character varying NOT NULL,
    obs_pedido text DEFAULT ''::text NOT NULL,
    nm_responsavel text DEFAULT ''::text NOT NULL,
    nr_telefone_responsavel text DEFAULT ''::text NOT NULL,
    email_responsavel text DEFAULT ''::text NOT NULL,
    nm_crianca text DEFAULT ''::text NOT NULL,
    usuario_id uuid,
    lg_pedido_link boolean DEFAULT false,
    lg_pedido_pdv boolean DEFAULT false,
    lg_pagamento_online boolean DEFAULT false,
    url_pagamento text DEFAULT ''::text NOT NULL,
    qr_code_pagamento text DEFAULT ''::text NOT NULL,
    id_transacao_abacatepay text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false,
    dt_entrega timestamp with time zone,
    dt_validade date,
    supervisor_id bigint,
    funcionario_id bigint,
    condicao_id bigint,
    tp_operacao_id bigint DEFAULT 0,
    tp_documento_id bigint,
    tp_comissao_id bigint DEFAULT 0,
    pedido_origem_id bigint DEFAULT 0,
    rota_id bigint,
    cidade_id bigint,
    minuta_id bigint,
    deposito_id bigint,
    produto_id bigint,
    nota_fiscal_id bigint,
    transportadora_id bigint,
    veiculo_id bigint,
    mensagem_fisco_id bigint,
    mensagem_contr_id bigint,
    vl_total_nota numeric(12,2) DEFAULT 0,
    vl_pago numeric(12,2) DEFAULT 0,
    vl_despesa numeric(12,2) DEFAULT 0,
    vl_seguro numeric(12,2) DEFAULT 0,
    vl_frete numeric(12,2) DEFAULT 0,
    vl_outro numeric(12,2) DEFAULT 0,
    vl_desc_rs numeric(12,2),
    vl_comissao numeric(12,2) DEFAULT 0,
    tp_desconto character varying(2) DEFAULT ''::character varying,
    pc_desconto numeric(9,2) DEFAULT 0,
    vl_bc_icms numeric(12,2) DEFAULT 0,
    vl_icms numeric(12,2) DEFAULT 0,
    bc_icmsst numeric(12,2) DEFAULT 0,
    vl_icmsst numeric(12,2) DEFAULT 0,
    aliq_icms numeric(12,2),
    vl_bc_pis numeric(12,2) DEFAULT 0,
    vl_pis numeric(12,2) DEFAULT 0,
    vl_bc_cofins numeric(12,2) DEFAULT 0,
    vl_cofins numeric(12,2) DEFAULT 0,
    vl_bc_ipi numeric(12,2) DEFAULT 0,
    vl_ipi numeric(12,2) DEFAULT 0,
    vl_bc_iss numeric(12,2) DEFAULT 0,
    vl_iss numeric(12,2) DEFAULT 0,
    numero_nfe character varying(30),
    serie bigint,
    modelo_nf bigint,
    observacao_nf text,
    cnpj character varying(18),
    peso_liquido numeric(12,4),
    peso_bruto numeric(12,4),
    ind_pres character varying(1),
    mod_frete character varying(1),
    logradouro_entrega character varying(60),
    numero_entrega character varying(5),
    bairro_entrega character varying(50),
    cep_entrega character varying(13),
    email_entrega character varying(50),
    termo_adesao character varying(20) DEFAULT ''::character varying,
    gerou_financeiro character varying(1) DEFAULT 'N'::character varying NOT NULL,
    motivo_cancelamento character varying(100) DEFAULT ''::character varying,
    pag_entrada character varying(200) DEFAULT ''::character varying,
    autenticacao character varying(200) DEFAULT ''::character varying,
    condicao_unica character varying(1),
    altera_custo character varying(1),
    mot_cancelamento text DEFAULT ''::text NOT NULL,
    dt_alteracao timestamp with time zone,
    vl_bc_desconto numeric(12,2) DEFAULT 0
);


ALTER TABLE public.movimento OWNER TO postgres;

--
-- Name: movimento_item; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimento_item (
    movimento_item_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    movimento_id bigint NOT NULL,
    produto_id bigint,
    cd_produto text DEFAULT ''::text NOT NULL,
    nm_produto text DEFAULT ''::text NOT NULL,
    unidade_id character varying,
    tp_movimento character varying DEFAULT 'PD'::character varying,
    qt_movimento numeric DEFAULT 1,
    vl_und_produto numeric DEFAULT 0,
    vl_produto numeric DEFAULT 0,
    vl_desconto numeric DEFAULT 0,
    vl_movimento numeric DEFAULT 0,
    excluido boolean DEFAULT false,
    pedido_origem_id bigint,
    deposito_id bigint,
    lote bigint DEFAULT 0,
    tp_desconto character varying(2) DEFAULT ''::character varying,
    pc_desconto numeric(12,2) DEFAULT 0,
    vl_despesa numeric(12,2) DEFAULT 0,
    vl_seguro numeric(12,2) DEFAULT 0,
    vl_frete numeric(12,2) DEFAULT 0,
    vl_outro numeric(12,2) DEFAULT 0,
    vl_bc_icms numeric(12,2) DEFAULT 0,
    vl_icms numeric(12,2) DEFAULT 0,
    pc_icms numeric(5,2) DEFAULT 0,
    pc_red_icms numeric(5,2) DEFAULT 0,
    cst_icms character varying(2) DEFAULT ''::character varying,
    vl_bc_pis numeric(12,2) DEFAULT 0,
    vl_pis numeric(12,2) DEFAULT 0,
    pc_pis numeric(5,2) DEFAULT 0,
    cst_pis character varying(2) DEFAULT ''::character varying,
    vl_bc_cofins numeric(12,2) DEFAULT 0,
    vl_cofins numeric(12,2) DEFAULT 0,
    pc_cofins numeric(5,2) DEFAULT 0,
    cst_cofins character varying(2) DEFAULT ''::character varying,
    vl_bc_ipi numeric(12,2) DEFAULT 0,
    vl_ipi numeric(12,2) DEFAULT 0,
    pc_ipi numeric(5,2) DEFAULT 0,
    cst_ipi character varying(2) DEFAULT ''::character varying,
    bc_icmsst numeric(12,2) DEFAULT 0,
    vl_icmsst numeric(12,2) DEFAULT 0,
    pc_icmsst numeric(5,2) DEFAULT 0,
    pc_red_icmsst numeric(5,2) DEFAULT 0,
    vl_bc_iss numeric(12,2) DEFAULT 0,
    vl_iss numeric(12,2) DEFAULT 0,
    pc_iss numeric(5,2) DEFAULT 0,
    entrega character varying(1) DEFAULT 'N'::character varying,
    cfop_id character varying(8),
    pc_aliq_icms numeric(5,2) DEFAULT 0,
    cest character varying(10) DEFAULT ''::character varying,
    vl_bc_fcp numeric(12,2) DEFAULT 0,
    pc_fcp numeric(12,2) DEFAULT 0,
    vl_fcp numeric(12,2) DEFAULT 0,
    vl_bc_fcpst numeric(12,2) DEFAULT 0,
    pc_fcpst numeric(12,2) DEFAULT 0,
    vl_fcpst numeric(12,2) DEFAULT 0,
    vl_custo numeric(12,2) DEFAULT 0,
    infad_produto character varying(100),
    vl_desc_rs numeric(12,2),
    vl_comissao numeric(12,2) DEFAULT 0,
    qt_entregue numeric(18,8) DEFAULT 0,
    qt_reservada numeric(18,8) DEFAULT 0,
    tp_ajs_estoque character(1)
);


ALTER TABLE public.movimento_item OWNER TO postgres;

--
-- Name: COLUMN movimento_item.tp_ajs_estoque; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.movimento_item.tp_ajs_estoque IS 'Tipo de ajuste de estoque: R = Retira, A = Adiciona, M = Modifica';


--
-- Name: movimento_item_movimento_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento_item ALTER COLUMN movimento_item_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.movimento_item_movimento_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimento_movimento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento ALTER COLUMN movimento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.movimento_movimento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimento_pagamento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.movimento_pagamento (
    movimento_pagamento_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    movimento_id bigint NOT NULL,
    tp_pagamento text NOT NULL,
    vl_pagamento numeric DEFAULT 0,
    dt_pagamento timestamp with time zone DEFAULT now(),
    nr_autorizacao text DEFAULT ''::text NOT NULL,
    obs_pagamento text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false,
    condicao_id bigint NOT NULL,
    vl_total numeric(9,2) DEFAULT 0,
    n_parcelas bigint DEFAULT 0,
    vl_parcelas numeric(9,2) DEFAULT 0,
    tipo_recebimento character varying(1),
    dt_inicio timestamp with time zone,
    dt_fim timestamp with time zone,
    operadora_id bigint,
    bandeira_id bigint,
    numero_autorizacao character varying(20)
);


ALTER TABLE public.movimento_pagamento OWNER TO postgres;

--
-- Name: movimento_pagamento_movimento_pagamento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento_pagamento ALTER COLUMN movimento_pagamento_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.movimento_pagamento_movimento_pagamento_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nfe_cabecalho_nfe_cabecalho_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_cabecalho ALTER COLUMN nfe_cabecalho_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.nfe_cabecalho_nfe_cabecalho_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nfe_item_nfe_item_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_item ALTER COLUMN nfe_item_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.nfe_item_nfe_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: nfe_recebida_nfe_recebida_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_recebida ALTER COLUMN nfe_recebida_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.nfe_recebida_nfe_recebida_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: operadora; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operadora (
    empresa_id integer NOT NULL,
    operadora_id integer NOT NULL,
    razao character varying(100),
    cnpj character varying(20)
);


ALTER TABLE public.operadora OWNER TO postgres;

--
-- Name: operadora_operadora_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.operadora ALTER COLUMN operadora_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.operadora_operadora_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: parametro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.parametro (
    id bigint NOT NULL,
    xnm_escola text DEFAULT 'Escola'::text,
    xcor_primaria text DEFAULT '#8B5CF6'::text,
    xcor_secundaria text DEFAULT '#6D28D9'::text,
    xcor_destaque text DEFAULT '#F59E0B'::text,
    xcor_fundo text DEFAULT '#FFFFFF'::text,
    xcor_fundo_card text DEFAULT '#F8FAFC'::text,
    xcor_texto_principal text DEFAULT '#1E293B'::text,
    xcor_texto_secundario text DEFAULT '#64748B'::text,
    xcor_botao text DEFAULT '#8B5CF6'::text,
    xcor_botao_negativo text DEFAULT '#EF4444'::text,
    xcor_header text DEFAULT '#7C3AED'::text,
    xcor_link text DEFAULT '#8B5CF6'::text,
    xcor_menu text DEFAULT '#4C1D95'::text,
    xurl_logo text DEFAULT ''::text NOT NULL,
    xurl_favicon text DEFAULT ''::text NOT NULL,
    xurl_banner_vendas text DEFAULT ''::text NOT NULL,
    xurl_link_vendas text DEFAULT ''::text NOT NULL,
    xmsg_pos_pagamento text DEFAULT 'Pagamento confirmado! Seu lanche estará disponível para retirada.'::text,
    xlg_valida_estoque_link boolean DEFAULT true,
    xlg_valida_estoque_pdv boolean DEFAULT false,
    xemail_remetente text DEFAULT ''::text NOT NULL,
    xabacatepay_api_key text DEFAULT ''::text NOT NULL,
    xabacatepay_webhook_url text DEFAULT ''::text NOT NULL,
    xabacatepay_webhook_secret text DEFAULT ''::text NOT NULL,
    xcss_customizado text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false,
    xdt_cadastro timestamp with time zone DEFAULT now(),
    xdt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.parametro OWNER TO postgres;

--
-- Name: parametro_horario; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.parametro_horario AS
 SELECT id,
    empresa_id,
    dia_semana AS xdia_semana,
    hr_inicio_matutino AS xhr_inicio_matutino,
    hr_fim_matutino AS xhr_fim_matutino,
    hr_inicio_vespertino AS xhr_inicio_vespertino,
    hr_fim_vespertino AS xhr_fim_vespertino,
    hr_inicio_noturno AS xhr_inicio_noturno,
    hr_fim_noturno AS xhr_fim_noturno,
    lg_dia_ativo AS xlg_dia_ativo,
    excluido AS excluido_visivel
   FROM public.empresa_hs_lojavirtual;


ALTER VIEW public.parametro_horario OWNER TO postgres;

--
-- Name: parametro_horario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa_hs_lojavirtual ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.parametro_horario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: parametro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.parametro ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.parametro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pedido_nr_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pedido_nr_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedido_nr_seq OWNER TO postgres;

--
-- Name: perfil; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil (
    perfil_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    nm_perfil text NOT NULL,
    fl_administrador boolean DEFAULT false NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil OWNER TO postgres;

--
-- Name: perfil_acesso_botao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_acesso_botao (
    perfil_acesso_botao_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    perfil_id bigint NOT NULL,
    nm_formulario text NOT NULL,
    nm_botao text NOT NULL,
    fl_editavel boolean DEFAULT true NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_acesso_botao OWNER TO postgres;

--
-- Name: perfil_acesso_botao_perfil_acesso_botao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_botao ALTER COLUMN perfil_acesso_botao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_acesso_botao_perfil_acesso_botao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_acesso_campo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_acesso_campo (
    perfil_acesso_campo_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    perfil_id bigint NOT NULL,
    nm_formulario text NOT NULL,
    nm_campo text NOT NULL,
    tp_editavel text DEFAULT 'EDITAVEL'::text NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_acesso_campo OWNER TO postgres;

--
-- Name: perfil_acesso_campo_perfil_acesso_campo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_campo ALTER COLUMN perfil_acesso_campo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_acesso_campo_perfil_acesso_campo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_acesso_formulario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_acesso_formulario (
    perfil_acesso_formulario_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    perfil_id bigint NOT NULL,
    nm_formulario text NOT NULL,
    fl_visualizar boolean DEFAULT true NOT NULL,
    fl_incluir boolean DEFAULT false NOT NULL,
    fl_alterar boolean DEFAULT false NOT NULL,
    fl_excluir_registro boolean DEFAULT false NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_acesso_formulario OWNER TO postgres;

--
-- Name: perfil_acesso_formulario_perfil_acesso_formulario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_formulario ALTER COLUMN perfil_acesso_formulario_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_acesso_formulario_perfil_acesso_formulario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_acesso_menu; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_acesso_menu (
    perfil_acesso_menu_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    perfil_id bigint NOT NULL,
    nm_menu text NOT NULL,
    nm_menu_pai text,
    fl_visivel boolean DEFAULT true NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_acesso_menu OWNER TO postgres;

--
-- Name: perfil_acesso_menu_perfil_acesso_menu_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_menu ALTER COLUMN perfil_acesso_menu_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_acesso_menu_perfil_acesso_menu_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_horario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_horario (
    perfil_horario_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    perfil_id bigint NOT NULL,
    nr_dia_semana integer NOT NULL,
    fl_matutino boolean DEFAULT false NOT NULL,
    hr_matutino_inicio character varying,
    hr_matutino_fim character varying,
    fl_vespertino boolean DEFAULT false NOT NULL,
    hr_vespertino_inicio character varying,
    hr_vespertino_fim character varying,
    fl_noturno boolean DEFAULT false NOT NULL,
    hr_noturno_inicio character varying,
    hr_noturno_fim character varying,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_horario OWNER TO postgres;

--
-- Name: perfil_horario_perfil_horario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_horario ALTER COLUMN perfil_horario_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_horario_perfil_horario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_perfil_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil ALTER COLUMN perfil_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_perfil_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: perfil_usuario; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.perfil_usuario (
    perfil_usuario_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    user_id uuid NOT NULL,
    perfil_id bigint NOT NULL,
    fl_excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.perfil_usuario OWNER TO postgres;

--
-- Name: perfil_usuario_perfil_usuario_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_usuario ALTER COLUMN perfil_usuario_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.perfil_usuario_perfil_usuario_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: plano; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plano (
    empresa_id integer NOT NULL,
    plano_id integer NOT NULL,
    conta character varying(15),
    nome character varying(50),
    tp_conta character varying(1),
    plano_id_pai integer,
    natureza character varying(1),
    cd_plano integer
);


ALTER TABLE public.plano OWNER TO postgres;

--
-- Name: plano_conta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plano_conta (
    plano_conta_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    conta character varying NOT NULL,
    nome text NOT NULL,
    tp_conta character varying,
    tp_natureza character varying,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    nivel smallint,
    cd_plano_conta integer
);


ALTER TABLE public.plano_conta OWNER TO postgres;

--
-- Name: plano_conta_plano_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.plano_conta ALTER COLUMN plano_conta_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.plano_conta_plano_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: portador; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portador (
    portador_id integer NOT NULL,
    empresa_id integer DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    banco_id integer,
    conta_id character varying,
    caminho_remessa character varying DEFAULT ''::character varying NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone,
    cd_portador integer
);


ALTER TABLE public.portador OWNER TO postgres;

--
-- Name: portador_portador_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.portador ALTER COLUMN portador_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.portador_portador_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto (
    produto_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    produto_grupo_id bigint,
    produto_subgrupo_id integer,
    linha_id integer,
    nome character varying(80) NOT NULL,
    nome_reduzido character varying(80) DEFAULT ''::character varying NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    unidade_id character varying(5) DEFAULT 'UN'::character varying,
    gtin character varying(14) DEFAULT ''::character varying,
    referencia character varying(20) DEFAULT ''::character varying NOT NULL,
    ncm character varying(20) DEFAULT ''::character varying NOT NULL,
    cest character varying(20) DEFAULT ''::character varying,
    tp_produto character varying(2) DEFAULT 'PA'::character varying,
    ativo character varying(1) DEFAULT 'S'::character varying,
    controla_estoque character varying(1) DEFAULT 'S'::character varying,
    url_foto text DEFAULT ''::text NOT NULL,
    venda_online boolean DEFAULT true,
    dias_venda_online text DEFAULT '0,1,2,3,4'::text,
    tb_a_origem character varying(1) DEFAULT ''::character varying NOT NULL,
    mva numeric(9,4) DEFAULT 0 NOT NULL,
    grupo_icms_id integer,
    grupo_ipi_id integer,
    grupo_pis_cofins_id integer,
    grupo_ibscbs_id integer,
    pc_ipi numeric(9,4) DEFAULT 0 NOT NULL,
    pc_frete numeric(9,4) DEFAULT 0 NOT NULL,
    pc_icms_cred numeric(9,4) DEFAULT 0 NOT NULL,
    pc_ipi_cred numeric(9,4) DEFAULT 0 NOT NULL,
    pc_emb numeric(9,4) DEFAULT 0 NOT NULL,
    pc_seguro numeric(9,4) DEFAULT 0 NOT NULL,
    pc_st_trib numeric(9,4) DEFAULT 0 NOT NULL,
    pc_outras_desp numeric(9,4) DEFAULT 0 NOT NULL,
    pc_pis numeric(9,4) DEFAULT 0 NOT NULL,
    pc_cofins numeric(9,4) DEFAULT 0 NOT NULL,
    pc_fcp_st numeric(9,4) DEFAULT 0 NOT NULL,
    pc_difal_sn numeric(9,4) DEFAULT 0 NOT NULL,
    vl_compra numeric(12,2) DEFAULT 0,
    vl_ipi numeric(12,2) DEFAULT 0 NOT NULL,
    vl_frete numeric(12,2) DEFAULT 0 NOT NULL,
    vl_icms_cred numeric(12,2) DEFAULT 0 NOT NULL,
    vl_ipi_cred numeric(12,2) DEFAULT 0 NOT NULL,
    vl_emb numeric(9,2) DEFAULT 0 NOT NULL,
    vl_seguro numeric(12,2) DEFAULT 0 NOT NULL,
    vl_st numeric(12,2) DEFAULT 0 NOT NULL,
    vl_outras_desp numeric(12,2) DEFAULT 0 NOT NULL,
    vl_pis numeric(12,2) DEFAULT 0 NOT NULL,
    vl_cofins numeric(12,2) DEFAULT 0 NOT NULL,
    vl_fcp_st numeric(12,2) DEFAULT 0 NOT NULL,
    vl_difal_sn numeric(12,2) DEFAULT 0 NOT NULL,
    vl_custo numeric(12,2) DEFAULT 0 NOT NULL,
    vl_custo_medio numeric(12,2) DEFAULT 0 NOT NULL,
    pc_markup numeric(10,2) DEFAULT 0,
    pc_multiplicador numeric(10,5) DEFAULT 0 NOT NULL,
    vl_multiplicador numeric(12,2) DEFAULT 0 NOT NULL,
    preco_sugerido numeric(14,4) DEFAULT 0,
    preco_venda numeric(14,4) DEFAULT 0,
    preco_venda_faturado numeric(12,2) DEFAULT 0 NOT NULL,
    preco_promocional numeric(14,4) DEFAULT 0,
    preco_promocional_fat numeric(12,2) DEFAULT 0 NOT NULL,
    st_promo character varying(1) DEFAULT 'N'::character varying NOT NULL,
    pc_desconto numeric(9,2) DEFAULT 0 NOT NULL,
    vl_desconto numeric(9,2) DEFAULT 0 NOT NULL,
    vl_outro numeric(9,2) DEFAULT 0 NOT NULL,
    altura numeric(10,4) DEFAULT 0 NOT NULL,
    comprimento numeric(10,4) DEFAULT 0 NOT NULL,
    largura numeric(10,4) DEFAULT 0 NOT NULL,
    area numeric(10,4) DEFAULT 0 NOT NULL,
    peso_bruto numeric(10,4) DEFAULT 0 NOT NULL,
    peso_liquido numeric(10,4) DEFAULT 0 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    nm_ecommerce character varying(80) DEFAULT ''::character varying NOT NULL,
    ds_ecommerce text DEFAULT ''::text NOT NULL,
    loja_virtual boolean DEFAULT false,
    forca_venda boolean DEFAULT false,
    ecommerce boolean DEFAULT false,
    cd_produto bigint
);


ALTER TABLE public.produto OWNER TO postgres;

--
-- Name: produto_codbarra; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_codbarra (
    produto_codbarra_id bigint NOT NULL,
    cod_barra character varying(20),
    produto_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.produto_codbarra OWNER TO postgres;

--
-- Name: produto_codbarra_produto_codbarra_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_codbarra ALTER COLUMN produto_codbarra_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.produto_codbarra_produto_codbarra_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_conversao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_conversao (
    conversao_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    unidade_id character varying(10) DEFAULT ''::character varying NOT NULL,
    fator_mult numeric(12,5) DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.produto_conversao OWNER TO postgres;

--
-- Name: produto_conversao_conversao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_conversao ALTER COLUMN conversao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.produto_conversao_conversao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_fornecedor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_fornecedor (
    produto_fornecedor_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    produto_id bigint NOT NULL,
    cadastro_id bigint NOT NULL,
    cd_prod_fornec text DEFAULT ''::text NOT NULL,
    nm_prod_fornec text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fator_conversao numeric(14,6) DEFAULT 1 NOT NULL
);


ALTER TABLE public.produto_fornecedor OWNER TO postgres;

--
-- Name: produto_fornecedor_produto_fornecedor_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.aaaproduto_fornecedor ALTER COLUMN produto_fornecedor_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.produto_fornecedor_produto_fornecedor_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_fornecedor_produto_fornecedor_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_fornecedor ALTER COLUMN produto_fornecedor_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.produto_fornecedor_produto_fornecedor_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_grupo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_grupo (
    produto_grupo_id bigint NOT NULL,
    nome text NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    cd_produto_grupo bigint
);


ALTER TABLE public.produto_grupo OWNER TO postgres;

--
-- Name: produto_grupo_grupo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_grupo ALTER COLUMN produto_grupo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.produto_grupo_grupo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_produto_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto ALTER COLUMN produto_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.produto_produto_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: produto_subgrupo; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.produto_subgrupo (
    produto_subgrupo_id bigint NOT NULL,
    nome text NOT NULL,
    produto_grupo_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now(),
    cd_produto_subgrupo bigint
);


ALTER TABLE public.produto_subgrupo OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    nm_usuario text DEFAULT ''::text,
    ds_login text DEFAULT ''::text,
    ds_foto text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: rb_conexao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rb_conexao (
    rb_conexao_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    url text DEFAULT ''::text NOT NULL,
    api_key text DEFAULT ''::text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rb_conexao OWNER TO postgres;

--
-- Name: rb_conexao_rb_conexao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_conexao ALTER COLUMN rb_conexao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rb_conexao_rb_conexao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rb_relatorio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rb_relatorio (
    rb_relatorio_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    rb_conexao_id bigint,
    menu text DEFAULT ''::text NOT NULL,
    submenu text DEFAULT ''::text NOT NULL,
    ordem integer DEFAULT 0,
    query_sql text DEFAULT ''::text NOT NULL,
    report_json jsonb,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rb_relatorio OWNER TO postgres;

--
-- Name: rb_relatorio_rb_relatorio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_relatorio ALTER COLUMN rb_relatorio_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rb_relatorio_rb_relatorio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rb_relatorio_variavel; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rb_relatorio_variavel (
    rb_relatorio_variavel_id bigint NOT NULL,
    rb_relatorio_id bigint NOT NULL,
    rb_templatepesquisa_id bigint NOT NULL,
    operador text DEFAULT '='::text NOT NULL,
    excluido boolean DEFAULT false
);


ALTER TABLE public.rb_relatorio_variavel OWNER TO postgres;

--
-- Name: rb_relatorio_variavel_rb_relatorio_variavel_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_relatorio_variavel ALTER COLUMN rb_relatorio_variavel_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rb_relatorio_variavel_rb_relatorio_variavel_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rb_templatepesquisa; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rb_templatepesquisa (
    rb_templatepesquisa_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    nome text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    obrigatorio boolean DEFAULT false,
    valor_padrao text DEFAULT ''::text,
    opcoes_fixas text DEFAULT ''::text,
    query text DEFAULT ''::text,
    rb_conexao_id bigint,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone DEFAULT now()
);


ALTER TABLE public.rb_templatepesquisa OWNER TO postgres;

--
-- Name: rb_templatepesquisa_rb_templatepesquisa_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_templatepesquisa ALTER COLUMN rb_templatepesquisa_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.rb_templatepesquisa_rb_templatepesquisa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rpb_conexao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rpb_conexao (
    rpb_conexao_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    nome text NOT NULL,
    url text DEFAULT ''::text NOT NULL,
    api_key text DEFAULT ''::text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.rpb_conexao OWNER TO postgres;

--
-- Name: rpb_conexao_rpb_conexao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_conexao ALTER COLUMN rpb_conexao_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rpb_conexao_rpb_conexao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rpb_filtro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rpb_filtro (
    rpb_filtro_id bigint NOT NULL,
    rpb_relatorio_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    nome text NOT NULL,
    label text NOT NULL,
    tipo text DEFAULT 'text'::text NOT NULL,
    obrigatorio boolean DEFAULT false NOT NULL,
    valor_padrao text DEFAULT ''::text NOT NULL,
    opcoes_fixas text DEFAULT ''::text NOT NULL,
    query_opcoes text DEFAULT ''::text NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rpb_filtro_tipo_check CHECK ((tipo = ANY (ARRAY['text'::text, 'date'::text, 'date_range'::text, 'number'::text, 'select'::text, 'boolean'::text, 'query_select'::text])))
);


ALTER TABLE public.rpb_filtro OWNER TO postgres;

--
-- Name: rpb_filtro_rpb_filtro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_filtro ALTER COLUMN rpb_filtro_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rpb_filtro_rpb_filtro_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rpb_relatorio; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rpb_relatorio (
    rpb_relatorio_id bigint NOT NULL,
    empresa_id bigint NOT NULL,
    nome text NOT NULL,
    descricao text DEFAULT ''::text NOT NULL,
    categoria text DEFAULT ''::text NOT NULL,
    query_sql text DEFAULT ''::text NOT NULL,
    rpb_conexao_id bigint,
    layout_json jsonb,
    excluido boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nm_form text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.rpb_relatorio OWNER TO postgres;

--
-- Name: rpb_relatorio_rpb_relatorio_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_relatorio ALTER COLUMN rpb_relatorio_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rpb_relatorio_rpb_relatorio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sequenciais_sequencia_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_config_item ALTER COLUMN fiscal_config_item_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.sequenciais_sequencia_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sistema_versoes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sistema_versoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    versao text NOT NULL,
    fase text,
    titulo text NOT NULL,
    detalhes text,
    tecnologias text[],
    autor text DEFAULT 'AI Antigravity'::text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sistema_versoes OWNER TO postgres;

--
-- Name: subgrupo_produto_subgrupo_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_subgrupo ALTER COLUMN produto_subgrupo_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.subgrupo_produto_subgrupo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sys_backup_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_backup_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    backup_type text NOT NULL,
    status text NOT NULL,
    file_name text,
    file_size_bytes bigint,
    error_message text,
    started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.sys_backup_log OWNER TO postgres;

--
-- Name: sys_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_config (
    id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid NOT NULL,
    db_server_host text DEFAULT 'localhost'::text NOT NULL,
    db_server_port text DEFAULT '5432'::text NOT NULL,
    db_name text DEFAULT 'postgres'::text NOT NULL,
    db_port text DEFAULT '5432'::text NOT NULL,
    db_version text DEFAULT '1.15.0'::text NOT NULL,
    backup_folder_path text DEFAULT ''::text NOT NULL,
    backup_periodicity text DEFAULT 'manual'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    backup_time text DEFAULT '03:00'::text NOT NULL,
    system_folder_path text DEFAULT ''::text NOT NULL,
    supabase_folder_path text DEFAULT ''::text NOT NULL,
    CONSTRAINT only_one_row CHECK ((id = '00000000-0000-0000-0000-000000000000'::uuid))
);


ALTER TABLE public.sys_config OWNER TO postgres;

--
-- Name: sys_sequencial; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sys_sequencial (
    empresa_id integer NOT NULL,
    tabela character varying(30) DEFAULT ''::character varying,
    nm_campo1 character varying(30) DEFAULT ''::character varying NOT NULL,
    nm_campo2 character varying(30) DEFAULT ''::character varying NOT NULL,
    ult_seq bigint DEFAULT 0
);


ALTER TABLE public.sys_sequencial OWNER TO postgres;

--
-- Name: tp_operacao; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tp_operacao (
    tp_operacao_id bigint NOT NULL,
    empresa_id bigint DEFAULT 1 NOT NULL,
    tp_movimento character varying(2) DEFAULT ''::character varying NOT NULL,
    descricao character varying(40) DEFAULT ''::character varying NOT NULL,
    gera_financeiro character varying(1) DEFAULT 'S'::character varying,
    gera_nf character varying(1) DEFAULT 'S'::character varying,
    gera_boleto character varying(1) DEFAULT 'S'::character varying,
    altera_estoque character varying(1) DEFAULT 'S'::character varying,
    valida_preco character varying(1) DEFAULT 'S'::character varying,
    plano_id bigint,
    excluido boolean DEFAULT false,
    dt_cadastro timestamp with time zone DEFAULT now(),
    dt_alteracao timestamp with time zone
);


ALTER TABLE public.tp_operacao OWNER TO postgres;

--
-- Name: tp_operacao_tp_operacao_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.tp_operacao ALTER COLUMN tp_operacao_id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.tp_operacao_tp_operacao_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: unidade; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unidade (
    unidade_id character varying(5) DEFAULT ''::character varying NOT NULL,
    descricao character varying(20) DEFAULT ''::character varying,
    empresa_id integer DEFAULT 1 NOT NULL,
    excluido boolean DEFAULT false
);


ALTER TABLE public.unidade OWNER TO postgres;

--
-- Name: usuario_atalho; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuario_atalho (
    usuario_atalho_id bigint NOT NULL,
    user_id uuid NOT NULL,
    nm_menu text NOT NULL,
    nr_ordem integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.usuario_atalho OWNER TO postgres;

--
-- Name: usuario_atalho_usuario_atalho_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuario_atalho_usuario_atalho_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuario_atalho_usuario_atalho_id_seq OWNER TO postgres;

--
-- Name: usuario_atalho_usuario_atalho_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuario_atalho_usuario_atalho_id_seq OWNED BY public.usuario_atalho.usuario_atalho_id;


--
-- Name: vw_pedidos_caixa_union; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_pedidos_caixa_union AS
 SELECT m.movimento_id,
    m.nr_movimento,
    m.cadastro_id,
    (COALESCE(c.nome_fantasia, c.razao_social, '(Consumidor)'::character varying))::text AS cliente_nome,
    m.funcionario_id AS vendedor_id,
    (( SELECT f.nome
           FROM public.funcionario f
          WHERE (f.funcionario_id = m.funcionario_id)))::text AS vendedor_nome,
    m.vl_movimento,
    m.dt_emissao,
    false AS is_external,
    'LOCAL'::text AS origem
   FROM (public.movimento m
     LEFT JOIN public.cadastro c ON ((c.cadastro_id = m.cadastro_id)))
  WHERE (((m.st_pedido)::text = 'F'::text) AND (m.excluido = false))
UNION ALL
 SELECT em.emovimento_id AS movimento_id,
    em.nr_movimento,
    em.cadastro_id,
    COALESCE(cl.razao_social, '(Consumidor Virtual)'::text) AS cliente_nome,
    NULL::bigint AS vendedor_id,
    'Loja Virtual'::text AS vendedor_nome,
    em.vl_movimento,
    em.dt_emissao,
    true AS is_external,
    'VIRTUAL'::text AS origem
   FROM (public.emovimento em
     LEFT JOIN public.cliente cl ON ((cl.id = em.cliente_id)))
  WHERE (((em.st_pedido)::text = 'R'::text) AND (em.excluido = false));


ALTER VIEW public.vw_pedidos_caixa_union OWNER TO postgres;

--
-- Name: vw_produtos_disponiveis; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.vw_produtos_disponiveis WITH (security_invoker='true') AS
 SELECT p.produto_id AS id,
    (p.produto_id)::text AS xcd_produto,
    p.nome AS xnm_produto,
    p.preco_venda AS xvl_preco_venda,
    p.url_foto AS xurl_foto,
    pg.nome AS xnm_grupo_produto,
    COALESCE(e.estoque_disponivel, (0)::numeric) AS xqt_estoque_disponivel,
    p.venda_online AS xlg_venda_online,
    p.dias_venda_online AS xdias_venda_online,
    p.excluido AS excluido_visivel
   FROM (((public.produto p
     LEFT JOIN public.produto_grupo pg ON ((pg.produto_grupo_id = p.produto_grupo_id)))
     LEFT JOIN public.empresa emp ON ((emp.empresa_id = p.empresa_id)))
     LEFT JOIN public.estoque e ON (((e.produto_id = p.produto_id) AND (e.empresa_id = p.empresa_id) AND (e.deposito_id = COALESCE(emp.deposito_venda_externa_id, (emp.deposito_estoque_caixa)::bigint, (1)::bigint)))))
  WHERE (p.excluido = false);


ALTER VIEW public.vw_produtos_disponiveis OWNER TO postgres;

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: balanca id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balanca ALTER COLUMN id SET DEFAULT nextval('public.balanca_id_seq'::regclass);


--
-- Name: caixa_movimento_item caixa_movimento_item_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento_item ALTER COLUMN caixa_movimento_item_id SET DEFAULT nextval('public.caixa_movimento_item_caixa_movimento_item_id_seq'::regclass);


--
-- Name: chat_conversa chat_conversa_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversa ALTER COLUMN chat_conversa_id SET DEFAULT nextval('public.chat_conversa_chat_conversa_id_seq'::regclass);


--
-- Name: chat_mensagem chat_mensagem_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagem ALTER COLUMN chat_mensagem_id SET DEFAULT nextval('public.chat_mensagem_chat_mensagem_id_seq'::regclass);


--
-- Name: chat_sala chat_sala_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala ALTER COLUMN chat_sala_id SET DEFAULT nextval('public.chat_sala_chat_sala_id_seq'::regclass);


--
-- Name: chat_sala_membro chat_sala_membro_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_membro ALTER COLUMN chat_sala_membro_id SET DEFAULT nextval('public.chat_sala_membro_chat_sala_membro_id_seq'::regclass);


--
-- Name: chat_sala_mensagem chat_sala_mensagem_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_mensagem ALTER COLUMN chat_sala_mensagem_id SET DEFAULT nextval('public.chat_sala_mensagem_chat_sala_mensagem_id_seq'::regclass);


--
-- Name: galpao_ambiencia id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.galpao_ambiencia ALTER COLUMN id SET DEFAULT nextval('public.galpao_ambiencia_id_seq'::regclass);


--
-- Name: usuario_atalho usuario_atalho_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_atalho ALTER COLUMN usuario_atalho_id SET DEFAULT nextval('public.usuario_atalho_usuario_atalho_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webauthn_challenges webauthn_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id);


--
-- Name: webauthn_credentials webauthn_credentials_pkey; Type: CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id);


--
-- Name: aaaproduto_fornecedor aaaproduto_fornecedor_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aaaproduto_fornecedor
    ADD CONSTRAINT aaaproduto_fornecedor_pe UNIQUE (empresa_id, produto_id);


--
-- Name: aaaproduto_fornecedor aaaproduto_fornecedor_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aaaproduto_fornecedor
    ADD CONSTRAINT aaaproduto_fornecedor_pk PRIMARY KEY (produto_fornecedor_id);


--
-- Name: abate_entrada abate_entrada_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_entrada
    ADD CONSTRAINT abate_entrada_pe UNIQUE (empresa_id, abate_entrada_id);


--
-- Name: abate_entrada abate_entrada_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_entrada
    ADD CONSTRAINT abate_entrada_pk PRIMARY KEY (abate_entrada_id);


--
-- Name: abate_mortalidade_motivo abate_mortalidade_motivo_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_mortalidade_motivo
    ADD CONSTRAINT abate_mortalidade_motivo_pk PRIMARY KEY (motivo_id);


--
-- Name: abate_mortalidade abate_mortalidade_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_mortalidade
    ADD CONSTRAINT abate_mortalidade_pe UNIQUE (empresa_id, mortalidade_id);


--
-- Name: abate_mortalidade abate_mortalidade_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_mortalidade
    ADD CONSTRAINT abate_mortalidade_pk PRIMARY KEY (mortalidade_id);


--
-- Name: abate abate_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate
    ADD CONSTRAINT abate_pe UNIQUE (empresa_id, abate_id);


--
-- Name: abate abate_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate
    ADD CONSTRAINT abate_pk PRIMARY KEY (abate_id);


--
-- Name: abate_problema abate_problema_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_problema
    ADD CONSTRAINT abate_problema_pe UNIQUE (empresa_id, problema_id);


--
-- Name: abate_problema abate_problema_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_problema
    ADD CONSTRAINT abate_problema_pk PRIMARY KEY (problema_id);


--
-- Name: abate_producao abate_producao_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_producao
    ADD CONSTRAINT abate_producao_pe UNIQUE (empresa_id, producao_id);


--
-- Name: abate_producao abate_producao_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_producao
    ADD CONSTRAINT abate_producao_pk PRIMARY KEY (producao_id);


--
-- Name: agendamento_financeiro agendamento_financeiro_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_financeiro
    ADD CONSTRAINT agendamento_financeiro_pe UNIQUE (empresa_id, agendamento_financeiro_id);


--
-- Name: agendamento_financeiro agendamento_financeiro_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_financeiro
    ADD CONSTRAINT agendamento_financeiro_pk PRIMARY KEY (agendamento_financeiro_id);


--
-- Name: agendamento agendamento_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_pe UNIQUE (empresa_id, agendamento_id);


--
-- Name: agendamento agendamento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento
    ADD CONSTRAINT agendamento_pk PRIMARY KEY (agendamento_id);


--
-- Name: agendamento_proc_split agendamento_proc_split_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_proc_split
    ADD CONSTRAINT agendamento_proc_split_pe UNIQUE (empresa_id, agendamento_proc_split_id);


--
-- Name: agendamento_proc_split agendamento_proc_split_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_proc_split
    ADD CONSTRAINT agendamento_proc_split_pk PRIMARY KEY (agendamento_proc_split_id);


--
-- Name: agendamento_procedimento agendamento_procedimento_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_procedimento
    ADD CONSTRAINT agendamento_procedimento_pe UNIQUE (empresa_id, agendamento_procedimento_id);


--
-- Name: agendamento_procedimento agendamento_procedimento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_procedimento
    ADD CONSTRAINT agendamento_procedimento_pk PRIMARY KEY (agendamento_procedimento_id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: balanca balanca_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balanca
    ADD CONSTRAINT balanca_pkey PRIMARY KEY (id);


--
-- Name: banco banco_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banco
    ADD CONSTRAINT banco_pe UNIQUE (empresa_id, banco_id);


--
-- Name: banco banco_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.banco
    ADD CONSTRAINT banco_pk PRIMARY KEY (banco_id);


--
-- Name: bandeira bandeira_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bandeira
    ADD CONSTRAINT bandeira_pk PRIMARY KEY (bandeira_id);


--
-- Name: boleto boleto_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_pe UNIQUE (empresa_id, bol_id);


--
-- Name: boleto boleto_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.boleto
    ADD CONSTRAINT boleto_pk PRIMARY KEY (bol_id);


--
-- Name: cadastro_grupo cadastro_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_grupo
    ADD CONSTRAINT cadastro_grupo_pkey PRIMARY KEY (cadastro_grupo_id);


--
-- Name: cadastro_motorista cadastro_motorista_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_motorista
    ADD CONSTRAINT cadastro_motorista_pkey PRIMARY KEY (motorista_id);


--
-- Name: cadastro cadastro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro
    ADD CONSTRAINT cadastro_pkey PRIMARY KEY (cadastro_id);


--
-- Name: cadastro_preco cadastro_preco_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_preco
    ADD CONSTRAINT cadastro_preco_pe UNIQUE (empresa_id, cadastro_preco_id);


--
-- Name: cadastro_preco cadastro_preco_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_preco
    ADD CONSTRAINT cadastro_preco_pk PRIMARY KEY (cadastro_preco_id);


--
-- Name: cadastro_veiculo cadastro_veiculo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_veiculo
    ADD CONSTRAINT cadastro_veiculo_pkey PRIMARY KEY (veiculo_id);


--
-- Name: caixa_abertura caixa_abertura_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_abertura
    ADD CONSTRAINT caixa_abertura_pe UNIQUE (empresa_id, caixa_abertura_id);


--
-- Name: caixa_abertura caixa_abertura_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_abertura
    ADD CONSTRAINT caixa_abertura_pk PRIMARY KEY (caixa_abertura_id);


--
-- Name: caixa_movimento_item caixa_movimento_item_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento_item
    ADD CONSTRAINT caixa_movimento_item_pe UNIQUE (empresa_id, caixa_movimento_item_id);


--
-- Name: caixa_movimento_item caixa_movimento_item_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento_item
    ADD CONSTRAINT caixa_movimento_item_pk PRIMARY KEY (caixa_movimento_item_id);


--
-- Name: caixa_movimento caixa_movimento_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento
    ADD CONSTRAINT caixa_movimento_pe UNIQUE (empresa_id, caixa_movimento_id);


--
-- Name: caixa_movimento caixa_movimento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento
    ADD CONSTRAINT caixa_movimento_pk PRIMARY KEY (caixa_movimento_id);


--
-- Name: centro_custo centro_custo_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.centro_custo
    ADD CONSTRAINT centro_custo_pe UNIQUE (empresa_id, centro_custo_id);


--
-- Name: centro_custo centro_custo_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.centro_custo
    ADD CONSTRAINT centro_custo_pk PRIMARY KEY (centro_custo_id);


--
-- Name: cfop cfop_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cfop
    ADD CONSTRAINT cfop_pe UNIQUE (empresa_id, cd_cfop);


--
-- Name: cfop cfop_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cfop
    ADD CONSTRAINT cfop_pk UNIQUE (cfop_id);


--
-- Name: cfop cfop_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cfop
    ADD CONSTRAINT cfop_pkey PRIMARY KEY (cfop_id);


--
-- Name: chat_conversa chat_conversa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversa
    ADD CONSTRAINT chat_conversa_pkey PRIMARY KEY (chat_conversa_id);


--
-- Name: chat_mensagem chat_mensagem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagem
    ADD CONSTRAINT chat_mensagem_pkey PRIMARY KEY (chat_mensagem_id);


--
-- Name: chat_sala_membro chat_sala_membro_chat_sala_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_membro
    ADD CONSTRAINT chat_sala_membro_chat_sala_id_user_id_key UNIQUE (chat_sala_id, user_id);


--
-- Name: chat_sala_membro chat_sala_membro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_membro
    ADD CONSTRAINT chat_sala_membro_pkey PRIMARY KEY (chat_sala_membro_id);


--
-- Name: chat_sala_mensagem chat_sala_mensagem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_mensagem
    ADD CONSTRAINT chat_sala_mensagem_pkey PRIMARY KEY (chat_sala_mensagem_id);


--
-- Name: chat_sala chat_sala_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala
    ADD CONSTRAINT chat_sala_pkey PRIMARY KEY (chat_sala_id);


--
-- Name: cidade cidade_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cidade
    ADD CONSTRAINT cidade_pk PRIMARY KEY (cidade_id);


--
-- Name: clas_trib clas_trib_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clas_trib
    ADD CONSTRAINT clas_trib_pkey PRIMARY KEY (clas_trib_id);


--
-- Name: cliente cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cliente
    ADD CONSTRAINT cliente_pkey PRIMARY KEY (id);


--
-- Name: comissao comissao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comissao
    ADD CONSTRAINT comissao_pkey PRIMARY KEY (comissao_id);


--
-- Name: condicao_pagamento condicao_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condicao_pagamento
    ADD CONSTRAINT condicao_pagamento_pkey PRIMARY KEY (condicao_id);


--
-- Name: fiscal_config configura_nf_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_config
    ADD CONSTRAINT configura_nf_pk PRIMARY KEY (empresa_id);


--
-- Name: conta conta_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conta
    ADD CONSTRAINT conta_pe UNIQUE (empresa_id, conta_id);


--
-- Name: conta conta_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conta
    ADD CONSTRAINT conta_pk PRIMARY KEY (conta_id);


--
-- Name: convenio convenio_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.convenio
    ADD CONSTRAINT convenio_pe UNIQUE (empresa_id, convenio_id);


--
-- Name: convenio convenio_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.convenio
    ADD CONSTRAINT convenio_pk PRIMARY KEY (convenio_id);


--
-- Name: corretora corretora_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corretora
    ADD CONSTRAINT corretora_pkey PRIMARY KEY (corretora_id);


--
-- Name: deposito deposito_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposito
    ADD CONSTRAINT deposito_pkey PRIMARY KEY (deposito_id);


--
-- Name: emovimento_item emovimento_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento_item
    ADD CONSTRAINT emovimento_item_pkey PRIMARY KEY (emovimento_item_id);


--
-- Name: emovimento_pagamento emovimento_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento_pagamento
    ADD CONSTRAINT emovimento_pagamento_pkey PRIMARY KEY (emovimento_pagamento_id);


--
-- Name: emovimento emovimento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento
    ADD CONSTRAINT emovimento_pkey PRIMARY KEY (emovimento_id);


--
-- Name: empresa empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa
    ADD CONSTRAINT empresa_pkey PRIMARY KEY (empresa_id);


--
-- Name: empresa_usuario empresa_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_usuario
    ADD CONSTRAINT empresa_usuario_pkey PRIMARY KEY (empresa_usuario_id);


--
-- Name: estado estado_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estado
    ADD CONSTRAINT estado_pk PRIMARY KEY (estado_id);


--
-- Name: estoque_log estoque_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_log
    ADD CONSTRAINT estoque_log_pkey PRIMARY KEY (estoque_log_id);


--
-- Name: estoque estoque_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque
    ADD CONSTRAINT estoque_pe UNIQUE (empresa_id, estoque_id);


--
-- Name: estoque estoque_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque
    ADD CONSTRAINT estoque_pk PRIMARY KEY (estoque_id);


--
-- Name: fator_conversao fator_conversao_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fator_conversao
    ADD CONSTRAINT fator_conversao_pe UNIQUE (empresa_id, fator_conversao_id);


--
-- Name: fator_conversao fator_conversao_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fator_conversao
    ADD CONSTRAINT fator_conversao_pk PRIMARY KEY (fator_conversao_id);


--
-- Name: fiscal_evento fiscal_evento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_evento
    ADD CONSTRAINT fiscal_evento_pkey PRIMARY KEY (id);


--
-- Name: fiscal_grupo_produto fiscal_grupo_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_grupo_produto
    ADD CONSTRAINT fiscal_grupo_produto_pkey PRIMARY KEY (fiscal_grupo_produto_id);


--
-- Name: fiscal_nfe_cce fiscal_nfe_cce_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_cce
    ADD CONSTRAINT fiscal_nfe_cce_pkey PRIMARY KEY (nfe_cce_id);


--
-- Name: fiscal_nfe_inutilizacao fiscal_nfe_inutilizacao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_inutilizacao
    ADD CONSTRAINT fiscal_nfe_inutilizacao_pkey PRIMARY KEY (inutilizacao_id);


--
-- Name: fiscal_nfe_pagamento fiscal_nfe_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_pagamento
    ADD CONSTRAINT fiscal_nfe_pagamento_pkey PRIMARY KEY (nfe_pagamento_id);


--
-- Name: fiscal_nfe_referenciada fiscal_nfe_referenciada_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_referenciada
    ADD CONSTRAINT fiscal_nfe_referenciada_pkey PRIMARY KEY (nfe_referenciada_id);


--
-- Name: fiscal_regra_cfop fiscal_regra_cfop_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_cfop
    ADD CONSTRAINT fiscal_regra_cfop_pkey PRIMARY KEY (fiscal_regra_cfop_id);


--
-- Name: fiscal_regra_item fiscal_regra_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_item
    ADD CONSTRAINT fiscal_regra_item_pkey PRIMARY KEY (fiscal_regra_item_id);


--
-- Name: fiscal_regra fiscal_regra_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra
    ADD CONSTRAINT fiscal_regra_pkey PRIMARY KEY (fiscal_regra_id);


--
-- Name: funcionario funcionario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.funcionario
    ADD CONSTRAINT funcionario_pkey PRIMARY KEY (funcionario_id);


--
-- Name: galpao_ambiencia galpao_ambiencia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.galpao_ambiencia
    ADD CONSTRAINT galpao_ambiencia_pkey PRIMARY KEY (id);


--
-- Name: grupo_icms_item grupo_icms_item_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupo_icms_item
    ADD CONSTRAINT grupo_icms_item_pe UNIQUE (empresa_id, grupo_icms_item_id);


--
-- Name: grupo_icms_item grupo_icms_item_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grupo_icms_item
    ADD CONSTRAINT grupo_icms_item_pk PRIMARY KEY (grupo_icms_item_id);


--
-- Name: usuario_atalho iu_usuario_atalho; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_atalho
    ADD CONSTRAINT iu_usuario_atalho UNIQUE (user_id, nm_menu);


--
-- Name: linha_produto linha_produto_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linha_produto
    ADD CONSTRAINT linha_produto_pk PRIMARY KEY (linha_id);


--
-- Name: fiscal_mdf_componente mdf_componente_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_componente
    ADD CONSTRAINT mdf_componente_pe UNIQUE (empresa_id, mdf_componente_id);


--
-- Name: fiscal_mdf_componente mdf_componente_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_componente
    ADD CONSTRAINT mdf_componente_pk PRIMARY KEY (mdf_componente_id);


--
-- Name: fiscal_mdf_condutor mdf_condutor_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_condutor
    ADD CONSTRAINT mdf_condutor_pe UNIQUE (empresa_id, mdf_condutor_id);


--
-- Name: fiscal_mdf_condutor mdf_condutor_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_condutor
    ADD CONSTRAINT mdf_condutor_pk PRIMARY KEY (mdf_condutor_id);


--
-- Name: fiscal_mdf_descarrega mdf_descarrega_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_descarrega
    ADD CONSTRAINT mdf_descarrega_pe UNIQUE (empresa_id, mdf_descarrega_id);


--
-- Name: fiscal_mdf_descarrega mdf_descarrega_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_descarrega
    ADD CONSTRAINT mdf_descarrega_pk PRIMARY KEY (mdf_descarrega_id);


--
-- Name: fiscal_mdf_documento mdf_documento_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_documento
    ADD CONSTRAINT mdf_documento_pe UNIQUE (empresa_id, mdf_documento_id);


--
-- Name: fiscal_mdf_documento mdf_documento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_documento
    ADD CONSTRAINT mdf_documento_pk PRIMARY KEY (mdf_documento_id);


--
-- Name: fiscal_mdf_historicoxml mdf_historicoxml_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_historicoxml
    ADD CONSTRAINT mdf_historicoxml_pe UNIQUE (empresa_id, mdf_historicoxml_id);


--
-- Name: fiscal_mdf_historicoxml mdf_historicoxml_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_historicoxml
    ADD CONSTRAINT mdf_historicoxml_pk PRIMARY KEY (mdf_historicoxml_id);


--
-- Name: fiscal_mdf_carrega mdf_man_carrega_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_carrega
    ADD CONSTRAINT mdf_man_carrega_pe UNIQUE (empresa_id, mdf_carrega_id);


--
-- Name: fiscal_mdf_carrega mdf_man_carrega_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_carrega
    ADD CONSTRAINT mdf_man_carrega_pk PRIMARY KEY (mdf_carrega_id);


--
-- Name: fiscal_mdf_manifesto mdf_manifesto_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_manifesto
    ADD CONSTRAINT mdf_manifesto_pe UNIQUE (empresa_id, mdf_manifesto_id);


--
-- Name: fiscal_mdf_manifesto mdf_manifesto_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_manifesto
    ADD CONSTRAINT mdf_manifesto_pk PRIMARY KEY (mdf_manifesto_id);


--
-- Name: fiscal_mdf_pagamento mdf_pagamento_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_pagamento
    ADD CONSTRAINT mdf_pagamento_pe UNIQUE (empresa_id, mdf_pagamento_id);


--
-- Name: fiscal_mdf_pagamento mdf_pagamento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_pagamento
    ADD CONSTRAINT mdf_pagamento_pk PRIMARY KEY (mdf_pagamento_id);


--
-- Name: fiscal_mdf_pagtos mdf_pagtos_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_pagtos
    ADD CONSTRAINT mdf_pagtos_pe UNIQUE (empresa_id, mdf_pagtos_id);


--
-- Name: fiscal_mdf_pagtos mdf_pagtos_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_pagtos
    ADD CONSTRAINT mdf_pagtos_pk PRIMARY KEY (mdf_pagtos_id);


--
-- Name: fiscal_mdf_percurso mdf_percurso_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_percurso
    ADD CONSTRAINT mdf_percurso_pe UNIQUE (empresa_id, mdf_percurso_id);


--
-- Name: fiscal_mdf_percurso mdf_percurso_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_percurso
    ADD CONSTRAINT mdf_percurso_pk PRIMARY KEY (mdf_percurso_id);


--
-- Name: fiscal_mdf_veiculo mdf_veiculo_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_veiculo
    ADD CONSTRAINT mdf_veiculo_pe UNIQUE (empresa_id, mdf_veiculo_id);


--
-- Name: fiscal_mdf_veiculo mdf_veiculo_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_veiculo
    ADD CONSTRAINT mdf_veiculo_pk PRIMARY KEY (mdf_veiculo_id);


--
-- Name: meio_pagamento meios_pagamento_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.meio_pagamento
    ADD CONSTRAINT meios_pagamento_pk PRIMARY KEY (meio_pagamento_id);


--
-- Name: movimento_item movimento_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_item
    ADD CONSTRAINT movimento_item_pkey PRIMARY KEY (movimento_item_id);


--
-- Name: movimento_pagamento movimento_pagamento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_pagamento
    ADD CONSTRAINT movimento_pagamento_pkey PRIMARY KEY (movimento_pagamento_id);


--
-- Name: movimento movimento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento
    ADD CONSTRAINT movimento_pkey PRIMARY KEY (movimento_id);


--
-- Name: fiscal_nfe_cabecalho nfe_cabecalho_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_cabecalho
    ADD CONSTRAINT nfe_cabecalho_pkey PRIMARY KEY (nfe_cabecalho_id);


--
-- Name: fiscal_nfe_item nfe_item_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_item
    ADD CONSTRAINT nfe_item_pkey PRIMARY KEY (nfe_item_id);


--
-- Name: fiscal_nfe_recebida nfe_recebida_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_recebida
    ADD CONSTRAINT nfe_recebida_pkey PRIMARY KEY (nfe_recebida_id);


--
-- Name: operadora operadora_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operadora
    ADD CONSTRAINT operadora_pe UNIQUE (empresa_id, operadora_id);


--
-- Name: operadora operadora_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operadora
    ADD CONSTRAINT operadora_pk PRIMARY KEY (operadora_id);


--
-- Name: empresa_hs_lojavirtual parametro_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_hs_lojavirtual
    ADD CONSTRAINT parametro_horario_pkey PRIMARY KEY (id);


--
-- Name: parametro parametro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.parametro
    ADD CONSTRAINT parametro_pkey PRIMARY KEY (id);


--
-- Name: perfil_acesso_botao perfil_acesso_botao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_botao
    ADD CONSTRAINT perfil_acesso_botao_pkey PRIMARY KEY (perfil_acesso_botao_id);


--
-- Name: perfil_acesso_campo perfil_acesso_campo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_campo
    ADD CONSTRAINT perfil_acesso_campo_pkey PRIMARY KEY (perfil_acesso_campo_id);


--
-- Name: perfil_acesso_formulario perfil_acesso_formulario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_formulario
    ADD CONSTRAINT perfil_acesso_formulario_pkey PRIMARY KEY (perfil_acesso_formulario_id);


--
-- Name: perfil_acesso_menu perfil_acesso_menu_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_menu
    ADD CONSTRAINT perfil_acesso_menu_pkey PRIMARY KEY (perfil_acesso_menu_id);


--
-- Name: perfil_horario perfil_horario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_horario
    ADD CONSTRAINT perfil_horario_pkey PRIMARY KEY (perfil_horario_id);


--
-- Name: perfil perfil_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil
    ADD CONSTRAINT perfil_pkey PRIMARY KEY (perfil_id);


--
-- Name: perfil_usuario perfil_usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_usuario
    ADD CONSTRAINT perfil_usuario_pkey PRIMARY KEY (perfil_usuario_id);


--
-- Name: financeiro pk_financeiro; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT pk_financeiro PRIMARY KEY (empresa_id, financeiro_id);


--
-- Name: financeiro_baixa pk_financeiro_baixa; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.financeiro_baixa
    ADD CONSTRAINT pk_financeiro_baixa PRIMARY KEY (financeiro_baixa_id, empresa_id, financeiro_id);


--
-- Name: plano_conta plano_conta_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_conta
    ADD CONSTRAINT plano_conta_pk PRIMARY KEY (plano_conta_id);


--
-- Name: plano plano_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano
    ADD CONSTRAINT plano_pe UNIQUE (empresa_id, plano_id);


--
-- Name: plano plano_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano
    ADD CONSTRAINT plano_pk PRIMARY KEY (plano_id);


--
-- Name: portador portador_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portador
    ADD CONSTRAINT portador_pkey PRIMARY KEY (portador_id);


--
-- Name: produto_codbarra produto_codbarra_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_codbarra
    ADD CONSTRAINT produto_codbarra_pk PRIMARY KEY (produto_codbarra_id);


--
-- Name: produto_conversao produto_conversao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_conversao
    ADD CONSTRAINT produto_conversao_pkey PRIMARY KEY (conversao_id);


--
-- Name: estoque produto_deposito_uk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque
    ADD CONSTRAINT produto_deposito_uk UNIQUE (deposito_id, produto_id);


--
-- Name: produto_fornecedor produto_fornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_fornecedor
    ADD CONSTRAINT produto_fornecedor_pkey PRIMARY KEY (produto_fornecedor_id);


--
-- Name: produto_grupo produto_grupo_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_grupo
    ADD CONSTRAINT produto_grupo_pkey PRIMARY KEY (produto_grupo_id);


--
-- Name: produto produto_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT produto_pe UNIQUE (empresa_id, produto_id);


--
-- Name: produto produto_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT produto_pk PRIMARY KEY (produto_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rb_conexao rb_conexao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_conexao
    ADD CONSTRAINT rb_conexao_pkey PRIMARY KEY (rb_conexao_id);


--
-- Name: rb_relatorio rb_relatorio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_relatorio
    ADD CONSTRAINT rb_relatorio_pkey PRIMARY KEY (rb_relatorio_id);


--
-- Name: rb_relatorio_variavel rb_relatorio_variavel_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_relatorio_variavel
    ADD CONSTRAINT rb_relatorio_variavel_pkey PRIMARY KEY (rb_relatorio_variavel_id);


--
-- Name: rb_templatepesquisa rb_templatepesquisa_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_templatepesquisa
    ADD CONSTRAINT rb_templatepesquisa_pkey PRIMARY KEY (rb_templatepesquisa_id);


--
-- Name: rpb_conexao rpb_conexao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rpb_conexao
    ADD CONSTRAINT rpb_conexao_pkey PRIMARY KEY (rpb_conexao_id);


--
-- Name: rpb_filtro rpb_filtro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rpb_filtro
    ADD CONSTRAINT rpb_filtro_pkey PRIMARY KEY (rpb_filtro_id);


--
-- Name: rpb_relatorio rpb_relatorio_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rpb_relatorio
    ADD CONSTRAINT rpb_relatorio_pkey PRIMARY KEY (rpb_relatorio_id);


--
-- Name: fiscal_config_item sequenciais_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_config_item
    ADD CONSTRAINT sequenciais_pe UNIQUE (empresa_id, fiscal_config_item_id);


--
-- Name: fiscal_config_item sequenciais_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_config_item
    ADD CONSTRAINT sequenciais_pk PRIMARY KEY (fiscal_config_item_id);


--
-- Name: sistema_versoes sistema_versoes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sistema_versoes
    ADD CONSTRAINT sistema_versoes_pkey PRIMARY KEY (id);


--
-- Name: produto_subgrupo subgrupo_produto_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_subgrupo
    ADD CONSTRAINT subgrupo_produto_pkey PRIMARY KEY (produto_subgrupo_id);


--
-- Name: sys_backup_log sys_backup_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_backup_log
    ADD CONSTRAINT sys_backup_log_pkey PRIMARY KEY (id);


--
-- Name: sys_config sys_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_config
    ADD CONSTRAINT sys_config_pkey PRIMARY KEY (id);


--
-- Name: sys_sequencial sys_sequencial_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sys_sequencial
    ADD CONSTRAINT sys_sequencial_pk UNIQUE (empresa_id, tabela, nm_campo1, nm_campo2);


--
-- Name: tp_operacao tp_operacao_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tp_operacao
    ADD CONSTRAINT tp_operacao_pkey PRIMARY KEY (tp_operacao_id, tp_movimento, empresa_id);


--
-- Name: unidade unidade_pe; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unidade
    ADD CONSTRAINT unidade_pe UNIQUE (empresa_id, unidade_id);


--
-- Name: unidade unidade_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unidade
    ADD CONSTRAINT unidade_pk PRIMARY KEY (unidade_id);


--
-- Name: bandeira uq_bandeira_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bandeira
    ADD CONSTRAINT uq_bandeira_empresa_codigo UNIQUE (empresa_id, cd_bandeira);


--
-- Name: cadastro uq_cadastro_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro
    ADD CONSTRAINT uq_cadastro_empresa_codigo UNIQUE (empresa_id, cd_cadastro);


--
-- Name: cadastro_grupo uq_cadastro_grupo_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_grupo
    ADD CONSTRAINT uq_cadastro_grupo_empresa_codigo UNIQUE (empresa_id, cd_cadastro_grupo);


--
-- Name: linha_produto uq_linha_produto_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linha_produto
    ADD CONSTRAINT uq_linha_produto_empresa_codigo UNIQUE (empresa_id, cd_linha);


--
-- Name: produto uq_produto_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT uq_produto_empresa_codigo UNIQUE (empresa_id, cd_produto);


--
-- Name: produto_grupo uq_produto_grupo_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_grupo
    ADD CONSTRAINT uq_produto_grupo_empresa_codigo UNIQUE (empresa_id, cd_produto_grupo);


--
-- Name: produto_subgrupo uq_produto_subgrupo_empresa_codigo; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_subgrupo
    ADD CONSTRAINT uq_produto_subgrupo_empresa_codigo UNIQUE (empresa_id, cd_produto_subgrupo);


--
-- Name: usuario_atalho usuario_atalho_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuario_atalho
    ADD CONSTRAINT usuario_atalho_pkey PRIMARY KEY (usuario_atalho_id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: supabase_auth_admin
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: webauthn_challenges_expires_at_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_expires_at_idx ON auth.webauthn_challenges USING btree (expires_at);


--
-- Name: webauthn_challenges_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_challenges_user_id_idx ON auth.webauthn_challenges USING btree (user_id);


--
-- Name: webauthn_credentials_credential_id_key; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE UNIQUE INDEX webauthn_credentials_credential_id_key ON auth.webauthn_credentials USING btree (credential_id);


--
-- Name: webauthn_credentials_user_id_idx; Type: INDEX; Schema: auth; Owner: supabase_auth_admin
--

CREATE INDEX webauthn_credentials_user_id_idx ON auth.webauthn_credentials USING btree (user_id);


--
-- Name: cidade_cd_ibge_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cidade_cd_ibge_idx ON public.cidade USING btree (cd_ibge);


--
-- Name: idx_cadastro_cidade; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_cidade ON public.cadastro USING btree (endereco_cidade_id);


--
-- Name: idx_cadastro_cnpj; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_cnpj ON public.cadastro USING btree (cnpj) WHERE (excluido = false);


--
-- Name: idx_cadastro_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_codigo ON public.cadastro USING btree (cd_cadastro);


--
-- Name: idx_cadastro_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_empresa ON public.cadastro USING btree (empresa_id);


--
-- Name: idx_cadastro_excluido; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_excluido ON public.cadastro USING btree (excluido);


--
-- Name: idx_cadastro_fantasia; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_fantasia ON public.cadastro USING btree (nome_fantasia);


--
-- Name: idx_cadastro_grupo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_grupo ON public.cadastro USING btree (grupo_cadastro_id);


--
-- Name: idx_cadastro_grupo_codigo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_grupo_codigo ON public.cadastro_grupo USING btree (cd_cadastro_grupo);


--
-- Name: idx_cadastro_grupo_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_grupo_empresa ON public.cadastro_grupo USING btree (empresa_id);


--
-- Name: idx_cadastro_grupo_excluido; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_grupo_excluido ON public.cadastro_grupo USING btree (excluido);


--
-- Name: idx_cadastro_grupo_nome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_grupo_nome ON public.cadastro_grupo USING btree (nome);


--
-- Name: idx_cadastro_razao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cadastro_razao ON public.cadastro USING btree (razao_social);


--
-- Name: idx_estoque_log_dt_hs; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_estoque_log_dt_hs ON public.estoque_log USING btree (dt_hs_log DESC);


--
-- Name: idx_estoque_log_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_estoque_log_empresa ON public.estoque_log USING btree (empresa_id);


--
-- Name: idx_estoque_log_operacao; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_estoque_log_operacao ON public.estoque_log USING btree (operacao);


--
-- Name: idx_estoque_log_produto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_estoque_log_produto ON public.estoque_log USING btree (produto_id);


--
-- Name: idx_estoque_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_estoque_lookup ON public.estoque USING btree (empresa_id, produto_id, deposito_id) WHERE (excluido = false);


--
-- Name: idx_movimento_data; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_movimento_data ON public.movimento USING btree (dt_emissao DESC);


--
-- Name: idx_movimento_item_mov; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_movimento_item_mov ON public.movimento_item USING btree (movimento_id) WHERE (excluido = false);


--
-- Name: idx_produto_gtin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_produto_gtin ON public.produto USING btree (gtin) WHERE (excluido = false);


--
-- Name: idx_produto_nome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_produto_nome ON public.produto USING gin (nome public.gin_trgm_ops) WHERE (excluido = false);


--
-- Name: idx_sys_backup_log_type_completed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sys_backup_log_type_completed ON public.sys_backup_log USING btree (backup_type, completed_at DESC);


--
-- Name: iu_nfe_cabecalho_chave; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX iu_nfe_cabecalho_chave ON public.fiscal_nfe_cabecalho USING btree (chave_nfe) WHERE ((chave_nfe <> ''::text) AND (excluido = false));


--
-- Name: iu_nfe_recebida_chave; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX iu_nfe_recebida_chave ON public.fiscal_nfe_recebida USING btree (chave_nfe) WHERE (chave_nfe <> ''::text);


--
-- Name: iu_produto_fornecedor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX iu_produto_fornecedor ON public.produto_fornecedor USING btree (empresa_id, cadastro_id, cd_prod_fornec) WHERE (excluido = false);


--
-- Name: ix_chat_conversa_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_conversa_user ON public.chat_conversa USING btree (user_id, dt_atualizacao DESC);


--
-- Name: ix_chat_mensagem_conversa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_mensagem_conversa ON public.chat_mensagem USING btree (chat_conversa_id, dt_criacao);


--
-- Name: ix_chat_sala_membro_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_sala_membro_user ON public.chat_sala_membro USING btree (user_id);


--
-- Name: ix_chat_sala_mensagem_sala; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_sala_mensagem_sala ON public.chat_sala_mensagem USING btree (chat_sala_id, dt_criacao DESC);


--
-- Name: ix_fiscal_evento_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_evento_empresa ON public.fiscal_evento USING btree (empresa_id);


--
-- Name: ix_fiscal_evento_nfe_cabecalho_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_evento_nfe_cabecalho_id ON public.fiscal_evento USING btree (nfe_cabecalho_id);


--
-- Name: ix_fiscal_evento_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_evento_status ON public.fiscal_evento USING btree (status);


--
-- Name: ix_fiscal_nfe_cce_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_nfe_cce_empresa ON public.fiscal_nfe_cce USING btree (empresa_id);


--
-- Name: ix_fiscal_nfe_cce_nfe; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_nfe_cce_nfe ON public.fiscal_nfe_cce USING btree (nfe_cabecalho_id);


--
-- Name: ix_fiscal_nfe_pagamento_cab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_nfe_pagamento_cab ON public.fiscal_nfe_pagamento USING btree (nfe_cabecalho_id);


--
-- Name: ix_fiscal_nfe_ref_cab; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_nfe_ref_cab ON public.fiscal_nfe_referenciada USING btree (nfe_cabecalho_id);


--
-- Name: ix_fiscal_regra_cfop_cascata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_regra_cfop_cascata ON public.fiscal_regra_cfop USING btree (fiscal_regra_id, fiscal_grupo_produto_id);


--
-- Name: ix_fiscal_regra_item_cascata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_fiscal_regra_item_cascata ON public.fiscal_regra_item USING btree (fiscal_regra_id, tipo_imposto, fiscal_grupo_produto_id);


--
-- Name: ix_nfe_cabecalho_cadastro; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_cabecalho_cadastro ON public.fiscal_nfe_cabecalho USING btree (cadastro_id);


--
-- Name: ix_nfe_cabecalho_dt_entrada; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_cabecalho_dt_entrada ON public.fiscal_nfe_cabecalho USING btree (dt_entrada);


--
-- Name: ix_nfe_cabecalho_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_cabecalho_empresa ON public.fiscal_nfe_cabecalho USING btree (empresa_id);


--
-- Name: ix_nfe_item_cabecalho; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_item_cabecalho ON public.fiscal_nfe_item USING btree (nfe_cabecalho_id);


--
-- Name: ix_nfe_item_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_item_empresa ON public.fiscal_nfe_item USING btree (empresa_id);


--
-- Name: ix_nfe_item_produto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_item_produto ON public.fiscal_nfe_item USING btree (produto_id);


--
-- Name: ix_nfe_recebida_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_nfe_recebida_empresa ON public.fiscal_nfe_recebida USING btree (empresa_id);


--
-- Name: ix_produto_fornecedor_cadastro; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_produto_fornecedor_cadastro ON public.produto_fornecedor USING btree (cadastro_id);


--
-- Name: ix_produto_fornecedor_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_produto_fornecedor_empresa ON public.produto_fornecedor USING btree (empresa_id);


--
-- Name: ix_produto_fornecedor_produto; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_produto_fornecedor_produto ON public.produto_fornecedor USING btree (produto_id);


--
-- Name: ix_rpb_filtro_relatorio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_rpb_filtro_relatorio ON public.rpb_filtro USING btree (rpb_relatorio_id);


--
-- Name: ix_rpb_relatorio_empresa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_rpb_relatorio_empresa ON public.rpb_relatorio USING btree (empresa_id);


--
-- Name: ix_usuario_atalho_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_usuario_atalho_user ON public.usuario_atalho USING btree (user_id);


--
-- Name: uix_inutilizacao_faixa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uix_inutilizacao_faixa ON public.fiscal_nfe_inutilizacao USING btree (empresa_id, modelo, serie, nr_ini, nr_fin, ambiente) WHERE ((st_inutilizacao)::text <> 'ERRO'::text);


--
-- Name: emovimento_item tg_emovimento_item_after; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_emovimento_item_after AFTER INSERT OR DELETE OR UPDATE ON public.emovimento_item FOR EACH ROW EXECUTE FUNCTION public.fn_emovimento_totalize();


--
-- Name: emovimento_item tg_emovimento_item_before; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_emovimento_item_before BEFORE INSERT OR UPDATE ON public.emovimento_item FOR EACH ROW EXECUTE FUNCTION public.fn_emovimento_item_calc_before();


--
-- Name: movimento tg_movimento_after; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_movimento_after AFTER UPDATE OF tp_desconto, vl_desconto, pc_desconto ON public.movimento FOR EACH ROW WHEN ((((new.tp_desconto)::text IS DISTINCT FROM (old.tp_desconto)::text) OR (new.vl_desconto IS DISTINCT FROM old.vl_desconto) OR (new.pc_desconto IS DISTINCT FROM old.pc_desconto))) EXECUTE FUNCTION public.fn_movimento_totalize();


--
-- Name: movimento_item tg_movimento_item_after; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_movimento_item_after AFTER INSERT OR DELETE OR UPDATE ON public.movimento_item FOR EACH ROW EXECUTE FUNCTION public.fn_movimento_totalize();


--
-- Name: movimento_item tg_movimento_item_before; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_movimento_item_before BEFORE INSERT OR UPDATE ON public.movimento_item FOR EACH ROW EXECUTE FUNCTION public.fn_movimento_item_calc_before();


--
-- Name: cadastro tg_set_cd_cadastro; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_set_cd_cadastro BEFORE INSERT ON public.cadastro FOR EACH ROW EXECUTE FUNCTION public.fn_set_cd_cadastro();


--
-- Name: cadastro_grupo tg_set_cd_cadastro_grupo; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tg_set_cd_cadastro_grupo BEFORE INSERT ON public.cadastro_grupo FOR EACH ROW EXECUTE FUNCTION public.fn_set_cd_cadastro_grupo();


--
-- Name: chat_mensagem tr_chat_mensagem_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_chat_mensagem_touch AFTER INSERT ON public.chat_mensagem FOR EACH ROW EXECUTE FUNCTION public.fu_chat_touch_conversa();


--
-- Name: chat_sala_mensagem tr_chat_sala_mensagem_touch; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_chat_sala_mensagem_touch AFTER INSERT ON public.chat_sala_mensagem FOR EACH ROW EXECUTE FUNCTION public.fu_chat_sala_touch();


--
-- Name: estoque_log tr_estoque_log_block_mod; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_estoque_log_block_mod BEFORE DELETE OR UPDATE ON public.estoque_log FOR EACH ROW EXECUTE FUNCTION public.fn_estoque_log_block_mod();


--
-- Name: estoque_log tr_estoque_log_processamento; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_estoque_log_processamento BEFORE INSERT ON public.estoque_log FOR EACH ROW EXECUTE FUNCTION public.fn_processa_estoque_log();


--
-- Name: fiscal_nfe_cabecalho tr_nfe_cabecalho_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_nfe_cabecalho_updated_at BEFORE UPDATE ON public.fiscal_nfe_cabecalho FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: fiscal_nfe_item tr_nfe_item_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_nfe_item_updated_at BEFORE UPDATE ON public.fiscal_nfe_item FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: fiscal_nfe_recebida tr_nfe_recebida_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_nfe_recebida_updated_at BEFORE UPDATE ON public.fiscal_nfe_recebida FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: produto_fornecedor tr_produto_fornecedor_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_produto_fornecedor_updated_at BEFORE UPDATE ON public.produto_fornecedor FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: profiles tr_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: rpb_conexao tr_rpb_conexao_upd; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_rpb_conexao_upd BEFORE UPDATE ON public.rpb_conexao FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: rpb_relatorio tr_rpb_relatorio_upd; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_rpb_relatorio_upd BEFORE UPDATE ON public.rpb_relatorio FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: usuario_atalho tr_usuario_atalho_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_usuario_atalho_updated_at BEFORE UPDATE ON public.usuario_atalho FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: webauthn_challenges webauthn_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_challenges
    ADD CONSTRAINT webauthn_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: webauthn_credentials webauthn_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE ONLY auth.webauthn_credentials
    ADD CONSTRAINT webauthn_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cadastro cadastro_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro
    ADD CONSTRAINT cadastro_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: cadastro_grupo cadastro_grupo_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_grupo
    ADD CONSTRAINT cadastro_grupo_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: cadastro_motorista cadastro_motorista_cadastro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_motorista
    ADD CONSTRAINT cadastro_motorista_cadastro_id_fkey FOREIGN KEY (cadastro_id) REFERENCES public.cadastro(cadastro_id) ON DELETE CASCADE;


--
-- Name: cadastro_motorista cadastro_motorista_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_motorista
    ADD CONSTRAINT cadastro_motorista_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id) ON DELETE CASCADE;


--
-- Name: cfop cfop_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cfop
    ADD CONSTRAINT cfop_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: chat_mensagem chat_mensagem_chat_conversa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mensagem
    ADD CONSTRAINT chat_mensagem_chat_conversa_id_fkey FOREIGN KEY (chat_conversa_id) REFERENCES public.chat_conversa(chat_conversa_id) ON DELETE CASCADE;


--
-- Name: chat_sala_membro chat_sala_membro_chat_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_membro
    ADD CONSTRAINT chat_sala_membro_chat_sala_id_fkey FOREIGN KEY (chat_sala_id) REFERENCES public.chat_sala(chat_sala_id) ON DELETE CASCADE;


--
-- Name: chat_sala_mensagem chat_sala_mensagem_chat_sala_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sala_mensagem
    ADD CONSTRAINT chat_sala_mensagem_chat_sala_id_fkey FOREIGN KEY (chat_sala_id) REFERENCES public.chat_sala(chat_sala_id) ON DELETE CASCADE;


--
-- Name: comissao comissao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comissao
    ADD CONSTRAINT comissao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: condicao_pagamento condicao_pagamento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.condicao_pagamento
    ADD CONSTRAINT condicao_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: corretora corretora_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.corretora
    ADD CONSTRAINT corretora_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: deposito deposito_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deposito
    ADD CONSTRAINT deposito_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: emovimento emovimento_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento
    ADD CONSTRAINT emovimento_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.cliente(id);


--
-- Name: emovimento_item emovimento_item_emovimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento_item
    ADD CONSTRAINT emovimento_item_emovimento_id_fkey FOREIGN KEY (emovimento_id) REFERENCES public.emovimento(emovimento_id) ON DELETE CASCADE;


--
-- Name: emovimento_item emovimento_item_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento_item
    ADD CONSTRAINT emovimento_item_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id);


--
-- Name: emovimento_pagamento emovimento_pagamento_emovimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emovimento_pagamento
    ADD CONSTRAINT emovimento_pagamento_emovimento_id_fkey FOREIGN KEY (emovimento_id) REFERENCES public.emovimento(emovimento_id) ON DELETE CASCADE;


--
-- Name: estoque estoque_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque
    ADD CONSTRAINT estoque_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: estoque_log estoque_log_deposito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_log
    ADD CONSTRAINT estoque_log_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.deposito(deposito_id);


--
-- Name: estoque_log estoque_log_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_log
    ADD CONSTRAINT estoque_log_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: estoque_log estoque_log_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.estoque_log
    ADD CONSTRAINT estoque_log_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id);


--
-- Name: fiscal_evento fiscal_evento_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_evento
    ADD CONSTRAINT fiscal_evento_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: fiscal_mdf_condutor fiscal_mdf_condutor_condutor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_mdf_condutor
    ADD CONSTRAINT fiscal_mdf_condutor_condutor_id_fkey FOREIGN KEY (condutor_id) REFERENCES public.cadastro_motorista(motorista_id) ON DELETE CASCADE;


--
-- Name: fiscal_nfe_cce fiscal_nfe_cce_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_cce
    ADD CONSTRAINT fiscal_nfe_cce_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: fiscal_nfe_cce fiscal_nfe_cce_nfe_cabecalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_cce
    ADD CONSTRAINT fiscal_nfe_cce_nfe_cabecalho_id_fkey FOREIGN KEY (nfe_cabecalho_id) REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id);


--
-- Name: fiscal_nfe_inutilizacao fiscal_nfe_inutilizacao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_inutilizacao
    ADD CONSTRAINT fiscal_nfe_inutilizacao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: fiscal_nfe_pagamento fiscal_nfe_pagamento_nfe_cabecalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_pagamento
    ADD CONSTRAINT fiscal_nfe_pagamento_nfe_cabecalho_id_fkey FOREIGN KEY (nfe_cabecalho_id) REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id) ON DELETE CASCADE;


--
-- Name: fiscal_nfe_referenciada fiscal_nfe_referenciada_nfe_cabecalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_referenciada
    ADD CONSTRAINT fiscal_nfe_referenciada_nfe_cabecalho_id_fkey FOREIGN KEY (nfe_cabecalho_id) REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id) ON DELETE CASCADE;


--
-- Name: fiscal_regra_cfop fiscal_regra_cfop_cfop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_cfop
    ADD CONSTRAINT fiscal_regra_cfop_cfop_id_fkey FOREIGN KEY (cfop_id) REFERENCES public.cfop(cfop_id);


--
-- Name: fiscal_regra_cfop fiscal_regra_cfop_fiscal_regra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_cfop
    ADD CONSTRAINT fiscal_regra_cfop_fiscal_regra_id_fkey FOREIGN KEY (fiscal_regra_id) REFERENCES public.fiscal_regra(fiscal_regra_id) ON DELETE CASCADE;


--
-- Name: fiscal_regra fiscal_regra_cfop_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra
    ADD CONSTRAINT fiscal_regra_cfop_id_fkey FOREIGN KEY (cfop_id) REFERENCES public.cfop(cfop_id);


--
-- Name: fiscal_regra_item fiscal_regra_item_fiscal_regra_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_item
    ADD CONSTRAINT fiscal_regra_item_fiscal_regra_id_fkey FOREIGN KEY (fiscal_regra_id) REFERENCES public.fiscal_regra(fiscal_regra_id) ON DELETE CASCADE;


--
-- Name: abate_entrada fk_abate_entrada; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_entrada
    ADD CONSTRAINT fk_abate_entrada FOREIGN KEY (abate_id) REFERENCES public.abate(abate_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: abate_mortalidade fk_abate_mortalidade; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_mortalidade
    ADD CONSTRAINT fk_abate_mortalidade FOREIGN KEY (abate_id) REFERENCES public.abate(abate_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: abate_problema fk_abate_problema; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_problema
    ADD CONSTRAINT fk_abate_problema FOREIGN KEY (empresa_id, abate_id) REFERENCES public.abate(empresa_id, abate_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: abate_producao fk_abate_producao; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.abate_producao
    ADD CONSTRAINT fk_abate_producao FOREIGN KEY (abate_id) REFERENCES public.abate(abate_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento_financeiro fk_agendamento_financeiro; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_financeiro
    ADD CONSTRAINT fk_agendamento_financeiro FOREIGN KEY (agendamento_id) REFERENCES public.agendamento(agendamento_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: agendamento_procedimento fk_agendamento_procedimento; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agendamento_procedimento
    ADD CONSTRAINT fk_agendamento_procedimento FOREIGN KEY (agendamento_id) REFERENCES public.agendamento(agendamento_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cadastro fk_cadastro_cidade; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro
    ADD CONSTRAINT fk_cadastro_cidade FOREIGN KEY (endereco_cidade_id) REFERENCES public.cidade(cidade_id);


--
-- Name: caixa_movimento_item fk_caixa_item_condicao; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento_item
    ADD CONSTRAINT fk_caixa_item_condicao FOREIGN KEY (condicao_id) REFERENCES public.condicao_pagamento(condicao_id) NOT VALID;


--
-- Name: caixa_movimento fk_caixa_movimento_abertura; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento
    ADD CONSTRAINT fk_caixa_movimento_abertura FOREIGN KEY (caixa_abertura_id) REFERENCES public.caixa_abertura(caixa_abertura_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: caixa_movimento_item fk_caixa_movimento_item_movimento; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.caixa_movimento_item
    ADD CONSTRAINT fk_caixa_movimento_item_movimento FOREIGN KEY (caixa_movimento_id) REFERENCES public.caixa_movimento(caixa_movimento_id) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: cadastro_veiculo fk_empresa; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadastro_veiculo
    ADD CONSTRAINT fk_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: empresa_hs_lojavirtual fk_empresa_hs_lojavirtual_empresa; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.empresa_hs_lojavirtual
    ADD CONSTRAINT fk_empresa_hs_lojavirtual_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: fiscal_regra_cfop fk_fiscal_regra_cfop_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_cfop
    ADD CONSTRAINT fk_fiscal_regra_cfop_grupo FOREIGN KEY (fiscal_grupo_produto_id) REFERENCES public.fiscal_grupo_produto(fiscal_grupo_produto_id);


--
-- Name: fiscal_regra_item fk_fiscal_regra_item_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_regra_item
    ADD CONSTRAINT fk_fiscal_regra_item_grupo FOREIGN KEY (fiscal_grupo_produto_id) REFERENCES public.fiscal_grupo_produto(fiscal_grupo_produto_id);


--
-- Name: movimento_pagamento fk_mov_pag_condicao; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_pagamento
    ADD CONSTRAINT fk_mov_pag_condicao FOREIGN KEY (condicao_id) REFERENCES public.condicao_pagamento(condicao_id) NOT VALID;


--
-- Name: movimento fk_movimento_condicao; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento
    ADD CONSTRAINT fk_movimento_condicao FOREIGN KEY (condicao_id) REFERENCES public.condicao_pagamento(condicao_id) NOT VALID;


--
-- Name: movimento fk_movimento_deposito; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento
    ADD CONSTRAINT fk_movimento_deposito FOREIGN KEY (deposito_id) REFERENCES public.deposito(deposito_id) NOT VALID;


--
-- Name: movimento fk_movimento_funcionario; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento
    ADD CONSTRAINT fk_movimento_funcionario FOREIGN KEY (funcionario_id) REFERENCES public.funcionario(funcionario_id) NOT VALID;


--
-- Name: produto fk_produto_grupo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT fk_produto_grupo FOREIGN KEY (produto_grupo_id) REFERENCES public.produto_grupo(produto_grupo_id) NOT VALID;


--
-- Name: produto fk_produto_unidade; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto
    ADD CONSTRAINT fk_produto_unidade FOREIGN KEY (unidade_id) REFERENCES public.unidade(unidade_id) NOT VALID;


--
-- Name: linha_produto linha_produto_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.linha_produto
    ADD CONSTRAINT linha_produto_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: movimento movimento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento
    ADD CONSTRAINT movimento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: movimento_item movimento_item_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_item
    ADD CONSTRAINT movimento_item_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: movimento_item movimento_item_movimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_item
    ADD CONSTRAINT movimento_item_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.movimento(movimento_id);


--
-- Name: movimento_pagamento movimento_pagamento_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_pagamento
    ADD CONSTRAINT movimento_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: movimento_pagamento movimento_pagamento_movimento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.movimento_pagamento
    ADD CONSTRAINT movimento_pagamento_movimento_id_fkey FOREIGN KEY (movimento_id) REFERENCES public.movimento(movimento_id);


--
-- Name: fiscal_nfe_cabecalho nfe_cabecalho_deposito_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_cabecalho
    ADD CONSTRAINT nfe_cabecalho_deposito_id_fkey FOREIGN KEY (deposito_id) REFERENCES public.deposito(deposito_id);


--
-- Name: fiscal_nfe_item nfe_item_nfe_cabecalho_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_item
    ADD CONSTRAINT nfe_item_nfe_cabecalho_id_fkey FOREIGN KEY (nfe_cabecalho_id) REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id) ON DELETE CASCADE;


--
-- Name: fiscal_nfe_item nfe_item_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fiscal_nfe_item
    ADD CONSTRAINT nfe_item_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id);


--
-- Name: perfil_acesso_botao perfil_acesso_botao_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_botao
    ADD CONSTRAINT perfil_acesso_botao_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: perfil_acesso_campo perfil_acesso_campo_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_campo
    ADD CONSTRAINT perfil_acesso_campo_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: perfil_acesso_formulario perfil_acesso_formulario_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_formulario
    ADD CONSTRAINT perfil_acesso_formulario_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: perfil_acesso_menu perfil_acesso_menu_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_acesso_menu
    ADD CONSTRAINT perfil_acesso_menu_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: perfil_horario perfil_horario_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_horario
    ADD CONSTRAINT perfil_horario_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: perfil_usuario perfil_usuario_perfil_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.perfil_usuario
    ADD CONSTRAINT perfil_usuario_perfil_id_fkey FOREIGN KEY (perfil_id) REFERENCES public.perfil(perfil_id);


--
-- Name: plano_conta plano_conta_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plano_conta
    ADD CONSTRAINT plano_conta_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: portador portador_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portador
    ADD CONSTRAINT portador_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: produto_fornecedor produto_fornecedor_produto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.produto_fornecedor
    ADD CONSTRAINT produto_fornecedor_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produto(produto_id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: rb_relatorio rb_relatorio_rb_conexao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_relatorio
    ADD CONSTRAINT rb_relatorio_rb_conexao_id_fkey FOREIGN KEY (rb_conexao_id) REFERENCES public.rb_conexao(rb_conexao_id);


--
-- Name: rb_relatorio_variavel rb_relatorio_variavel_rb_relatorio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_relatorio_variavel
    ADD CONSTRAINT rb_relatorio_variavel_rb_relatorio_id_fkey FOREIGN KEY (rb_relatorio_id) REFERENCES public.rb_relatorio(rb_relatorio_id);


--
-- Name: rb_relatorio_variavel rb_relatorio_variavel_rb_templatepesquisa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_relatorio_variavel
    ADD CONSTRAINT rb_relatorio_variavel_rb_templatepesquisa_id_fkey FOREIGN KEY (rb_templatepesquisa_id) REFERENCES public.rb_templatepesquisa(rb_templatepesquisa_id);


--
-- Name: rb_templatepesquisa rb_templatepesquisa_rb_conexao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rb_templatepesquisa
    ADD CONSTRAINT rb_templatepesquisa_rb_conexao_id_fkey FOREIGN KEY (rb_conexao_id) REFERENCES public.rb_conexao(rb_conexao_id);


--
-- Name: rpb_filtro rpb_filtro_rpb_relatorio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rpb_filtro
    ADD CONSTRAINT rpb_filtro_rpb_relatorio_id_fkey FOREIGN KEY (rpb_relatorio_id) REFERENCES public.rpb_relatorio(rpb_relatorio_id) ON DELETE CASCADE;


--
-- Name: rpb_relatorio rpb_relatorio_rpb_conexao_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rpb_relatorio
    ADD CONSTRAINT rpb_relatorio_rpb_conexao_id_fkey FOREIGN KEY (rpb_conexao_id) REFERENCES public.rpb_conexao(rpb_conexao_id);


--
-- Name: tp_operacao tp_operacao_empresa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tp_operacao
    ADD CONSTRAINT tp_operacao_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: supabase_auth_admin
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_acesso_botao Admins can insert PERFIL_ACESSO_BOTAO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_campo Admins can insert PERFIL_ACESSO_CAMPO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_formulario Admins can insert PERFIL_ACESSO_FORMULARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_menu Admins can insert PERFIL_ACESSO_MENU; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_horario Admins can insert PERFIL_HORARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_HORARIO" ON public.perfil_horario FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_usuario Admins can insert PERFIL_USUARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert PERFIL_USUARIO" ON public.perfil_usuario FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: parametro Admins can select parametro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can select parametro" ON public.parametro FOR SELECT TO authenticated USING (public.fu_is_admin_any(auth.uid()));


--
-- Name: empresa_usuario Admins can update EMPRESA_USUARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update EMPRESA_USUARIO" ON public.empresa_usuario FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil Admins can update PERFIL; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL" ON public.perfil FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_botao Admins can update PERFIL_ACESSO_BOTAO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_campo Admins can update PERFIL_ACESSO_CAMPO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_formulario Admins can update PERFIL_ACESSO_FORMULARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_acesso_menu Admins can update PERFIL_ACESSO_MENU; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_horario Admins can update PERFIL_HORARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_HORARIO" ON public.perfil_horario FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: perfil_usuario Admins can update PERFIL_USUARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update PERFIL_USUARIO" ON public.perfil_usuario FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: parametro Admins can update parametro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update parametro" ON public.parametro FOR UPDATE TO authenticated USING (public.fu_is_admin_any(auth.uid())) WITH CHECK (public.fu_is_admin_any(auth.uid()));


--
-- Name: empresa_usuario Admins or bootstrap can insert EMPRESA_USUARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins or bootstrap can insert EMPRESA_USUARIO" ON public.empresa_usuario FOR INSERT TO authenticated WITH CHECK ((public.fu_is_admin(auth.uid(), empresa_id) OR ((user_id = auth.uid()) AND (NOT (EXISTS ( SELECT 1
   FROM public.empresa_usuario eu
  WHERE ((eu.empresa_id = empresa_usuario.empresa_id) AND (eu.fl_excluido = false))))))));


--
-- Name: perfil Admins or bootstrap can insert PERFIL; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins or bootstrap can insert PERFIL" ON public.perfil FOR INSERT TO authenticated WITH CHECK ((public.fu_is_admin(auth.uid(), empresa_id) OR (NOT (EXISTS ( SELECT 1
   FROM public.perfil p
  WHERE ((p.empresa_id = perfil.empresa_id) AND (p.fl_excluido = false)))))));


--
-- Name: profiles Admins view profiles same empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins view profiles same empresa" ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.empresa_usuario eu_self
     JOIN public.empresa_usuario eu_target ON ((eu_target.empresa_id = eu_self.empresa_id)))
  WHERE ((eu_self.user_id = auth.uid()) AND (eu_self.fl_excluido = false) AND (eu_target.user_id = profiles.id) AND (eu_target.fl_excluido = false) AND public.fu_is_admin(auth.uid(), eu_self.empresa_id)))));


--
-- Name: sys_backup_log Allow read/write sys_backup_log for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow read/write sys_backup_log for all users" ON public.sys_backup_log USING (true) WITH CHECK (true);


--
-- Name: sys_config Allow read/write sys_config for all users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow read/write sys_config for all users" ON public.sys_config USING (true) WITH CHECK (true);


--
-- Name: movimento_item Anon can insert mov_item link; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can insert mov_item link" ON public.movimento_item FOR INSERT TO anon WITH CHECK ((EXISTS ( SELECT 1
   FROM public.movimento
  WHERE ((movimento.movimento_id = movimento_item.movimento_id) AND ((movimento.tp_origem)::text = 'LINK'::text)))));


--
-- Name: movimento_pagamento Anon can insert mov_pgto link; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can insert mov_pgto link" ON public.movimento_pagamento FOR INSERT TO anon WITH CHECK ((EXISTS ( SELECT 1
   FROM public.movimento
  WHERE ((movimento.movimento_id = movimento_pagamento.movimento_id) AND ((movimento.tp_origem)::text = 'LINK'::text)))));


--
-- Name: movimento Anon can insert movimento link; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can insert movimento link" ON public.movimento FOR INSERT TO anon WITH CHECK (((tp_origem)::text = 'LINK'::text));


--
-- Name: galpao_ambiencia Anon can select galpao_ambiencia; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can select galpao_ambiencia" ON public.galpao_ambiencia FOR SELECT TO anon USING (true);


--
-- Name: empresa_hs_lojavirtual Anon can view empresa_hs_lojavirtual; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can view empresa_hs_lojavirtual" ON public.empresa_hs_lojavirtual FOR SELECT TO anon USING (true);


--
-- Name: estoque Anon can view estoque; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can view estoque" ON public.estoque FOR SELECT TO anon USING (true);


--
-- Name: movimento_item Anon can view mov_item link; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can view mov_item link" ON public.movimento_item FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.movimento
  WHERE ((movimento.movimento_id = movimento_item.movimento_id) AND ((movimento.tp_origem)::text = 'LINK'::text)))));


--
-- Name: movimento_pagamento Anon can view mov_pgto link; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Anon can view mov_pgto link" ON public.movimento_pagamento FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.movimento
  WHERE ((movimento.movimento_id = movimento_pagamento.movimento_id) AND ((movimento.tp_origem)::text = 'LINK'::text)))));


--
-- Name: cadastro Auth can delete cadastro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can delete cadastro" ON public.cadastro FOR DELETE TO authenticated USING (true);


--
-- Name: cadastro_grupo Auth can delete cadastro_grupo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can delete cadastro_grupo" ON public.cadastro_grupo FOR DELETE TO authenticated USING (true);


--
-- Name: fiscal_config_item Auth can delete fiscal_config_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can delete fiscal_config_item" ON public.fiscal_config_item FOR DELETE TO authenticated USING (true);


--
-- Name: funcionario Auth can delete funcionario; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can delete funcionario" ON public.funcionario FOR DELETE TO authenticated USING (true);


--
-- Name: movimento_item Auth can delete mov_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can delete mov_item" ON public.movimento_item FOR DELETE TO authenticated USING (true);


--
-- Name: auditoria Auth can insert auditoria; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: banco Auth can insert banco; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert banco" ON public.banco FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cadastro Auth can insert cadastro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert cadastro" ON public.cadastro FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: cadastro_grupo Auth can insert cadastro_grupo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert cadastro_grupo" ON public.cadastro_grupo FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: empresa_hs_lojavirtual Auth can insert empresa_hs_lojavirtual; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert empresa_hs_lojavirtual" ON public.empresa_hs_lojavirtual FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: fiscal_config_item Auth can insert fiscal_config_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert fiscal_config_item" ON public.fiscal_config_item FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: funcionario Auth can insert funcionario; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert funcionario" ON public.funcionario FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: movimento_item Auth can insert mov_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert mov_item" ON public.movimento_item FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: movimento_pagamento Auth can insert mov_pgto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert mov_pgto" ON public.movimento_pagamento FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: aaaproduto_fornecedor Auth can insert produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert produto" ON public.aaaproduto_fornecedor FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: produto Auth can insert produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can insert produto" ON public.produto FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: caixa_abertura Auth can manage caixa_abertura; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage caixa_abertura" ON public.caixa_abertura TO authenticated USING (true) WITH CHECK (true);


--
-- Name: caixa_movimento Auth can manage caixa_movimento; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage caixa_movimento" ON public.caixa_movimento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: caixa_movimento_item Auth can manage caixa_movimento_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage caixa_movimento_item" ON public.caixa_movimento_item TO authenticated USING (true) WITH CHECK (true);


--
-- Name: deposito Auth can manage deposito; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage deposito" ON public.deposito TO authenticated USING (true) WITH CHECK (true);


--
-- Name: estoque Auth can manage estoque; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage estoque" ON public.estoque TO authenticated USING (true) WITH CHECK (true);


--
-- Name: produto_codbarra Auth can manage produto_codbarra; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage produto_codbarra" ON public.produto_codbarra TO authenticated USING (true) WITH CHECK (true);


--
-- Name: produto_conversao Auth can manage produto_conversao; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage produto_conversao" ON public.produto_conversao TO authenticated USING (true) WITH CHECK (true);


--
-- Name: produto_grupo Auth can manage produto_grupo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage produto_grupo" ON public.produto_grupo TO authenticated USING (true) WITH CHECK (true);


--
-- Name: produto_subgrupo Auth can manage subgrupo_produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage subgrupo_produto" ON public.produto_subgrupo TO authenticated USING (true) WITH CHECK (true);


--
-- Name: tp_operacao Auth can manage tp_operacao; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can manage tp_operacao" ON public.tp_operacao TO authenticated USING (true) WITH CHECK (true);


--
-- Name: banco Auth can read banco; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can read banco" ON public.banco FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_config_item Auth can read fiscal_config_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can read fiscal_config_item" ON public.fiscal_config_item FOR SELECT TO authenticated USING (true);


--
-- Name: cadastro Auth can select cadastro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can select cadastro" ON public.cadastro FOR SELECT TO authenticated USING (true);


--
-- Name: cadastro_grupo Auth can select cadastro_grupo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can select cadastro_grupo" ON public.cadastro_grupo FOR SELECT TO authenticated USING (true);


--
-- Name: banco Auth can update banco; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update banco" ON public.banco FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cadastro Auth can update cadastro; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update cadastro" ON public.cadastro FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cadastro_grupo Auth can update cadastro_grupo; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update cadastro_grupo" ON public.cadastro_grupo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: empresa_hs_lojavirtual Auth can update empresa_hs_lojavirtual; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update empresa_hs_lojavirtual" ON public.empresa_hs_lojavirtual FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_config_item Auth can update fiscal_config_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update fiscal_config_item" ON public.fiscal_config_item FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: funcionario Auth can update funcionario; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update funcionario" ON public.funcionario FOR UPDATE TO authenticated USING (true);


--
-- Name: movimento_item Auth can update mov_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update mov_item" ON public.movimento_item FOR UPDATE TO authenticated USING (true);


--
-- Name: aaaproduto_fornecedor Auth can update produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update produto" ON public.aaaproduto_fornecedor FOR UPDATE TO authenticated USING (true);


--
-- Name: produto Auth can update produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can update produto" ON public.produto FOR UPDATE TO authenticated USING (true);


--
-- Name: deposito Auth can view deposito; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view deposito" ON public.deposito FOR SELECT TO authenticated USING (true);


--
-- Name: empresa_hs_lojavirtual Auth can view empresa_hs_lojavirtual; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view empresa_hs_lojavirtual" ON public.empresa_hs_lojavirtual FOR SELECT TO authenticated USING (true);


--
-- Name: estoque Auth can view estoque; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view estoque" ON public.estoque FOR SELECT TO authenticated USING (true);


--
-- Name: funcionario Auth can view funcionario; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view funcionario" ON public.funcionario FOR SELECT TO authenticated USING (true);


--
-- Name: movimento_item Auth can view mov_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view mov_item" ON public.movimento_item FOR SELECT TO authenticated USING (true);


--
-- Name: movimento_pagamento Auth can view mov_pgto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view mov_pgto" ON public.movimento_pagamento FOR SELECT TO authenticated USING (true);


--
-- Name: aaaproduto_fornecedor Auth can view produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view produto" ON public.aaaproduto_fornecedor FOR SELECT TO authenticated USING (true);


--
-- Name: produto Auth can view produto; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Auth can view produto" ON public.produto FOR SELECT TO authenticated USING (true);


--
-- Name: estado Authenticated can insert estado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can insert estado" ON public.estado FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: estado Authenticated can select estado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can select estado" ON public.estado FOR SELECT TO authenticated USING (true);


--
-- Name: estado Authenticated can update estado; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated can update estado" ON public.estado FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cliente Authenticated staff full access client; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated staff full access client" ON public.cliente TO authenticated USING (true) WITH CHECK (true);


--
-- Name: emovimento Authenticated staff full access emov; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated staff full access emov" ON public.emovimento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: emovimento_item Authenticated staff full access emov_item; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated staff full access emov_item" ON public.emovimento_item TO authenticated USING (true) WITH CHECK (true);


--
-- Name: emovimento_pagamento Authenticated staff full access emov_pag; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated staff full access emov_pag" ON public.emovimento_pagamento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_nfe_cabecalho Authenticated users can insert NFE_CABECALHO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert NFE_CABECALHO" ON public.fiscal_nfe_cabecalho FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: fiscal_nfe_item Authenticated users can insert NFE_ITEM; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert NFE_ITEM" ON public.fiscal_nfe_item FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: fiscal_nfe_recebida Authenticated users can insert NFE_RECEBIDA; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert NFE_RECEBIDA" ON public.fiscal_nfe_recebida FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: produto_fornecedor Authenticated users can insert PRODUTO_FORNECEDOR; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can insert PRODUTO_FORNECEDOR" ON public.produto_fornecedor FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: fiscal_nfe_cabecalho Authenticated users can read NFE_CABECALHO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read NFE_CABECALHO" ON public.fiscal_nfe_cabecalho FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_nfe_item Authenticated users can read NFE_ITEM; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read NFE_ITEM" ON public.fiscal_nfe_item FOR SELECT TO authenticated USING (true);


--
-- Name: perfil Authenticated users can read PERFIL; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL" ON public.perfil FOR SELECT TO authenticated USING (true);


--
-- Name: perfil_acesso_botao Authenticated users can read PERFIL_ACESSO_BOTAO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL_ACESSO_BOTAO" ON public.perfil_acesso_botao FOR SELECT TO authenticated USING (true);


--
-- Name: perfil_acesso_campo Authenticated users can read PERFIL_ACESSO_CAMPO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL_ACESSO_CAMPO" ON public.perfil_acesso_campo FOR SELECT TO authenticated USING (true);


--
-- Name: perfil_acesso_formulario Authenticated users can read PERFIL_ACESSO_FORMULARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL_ACESSO_FORMULARIO" ON public.perfil_acesso_formulario FOR SELECT TO authenticated USING (true);


--
-- Name: perfil_acesso_menu Authenticated users can read PERFIL_ACESSO_MENU; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL_ACESSO_MENU" ON public.perfil_acesso_menu FOR SELECT TO authenticated USING (true);


--
-- Name: perfil_horario Authenticated users can read PERFIL_HORARIO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PERFIL_HORARIO" ON public.perfil_horario FOR SELECT TO authenticated USING (true);


--
-- Name: produto_fornecedor Authenticated users can read PRODUTO_FORNECEDOR; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can read PRODUTO_FORNECEDOR" ON public.produto_fornecedor FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_nfe_cabecalho Authenticated users can update NFE_CABECALHO; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update NFE_CABECALHO" ON public.fiscal_nfe_cabecalho FOR UPDATE TO authenticated USING (true);


--
-- Name: fiscal_nfe_item Authenticated users can update NFE_ITEM; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update NFE_ITEM" ON public.fiscal_nfe_item FOR UPDATE TO authenticated USING (true);


--
-- Name: fiscal_nfe_recebida Authenticated users can update NFE_RECEBIDA; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update NFE_RECEBIDA" ON public.fiscal_nfe_recebida FOR UPDATE TO authenticated USING (true);


--
-- Name: produto_fornecedor Authenticated users can update PRODUTO_FORNECEDOR; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Authenticated users can update PRODUTO_FORNECEDOR" ON public.produto_fornecedor FOR UPDATE TO authenticated USING (true);


--
-- Name: empresa_usuario EU read same empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "EU read same empresa" ON public.empresa_usuario FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: empresa Empresa delete admin only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa delete admin only" ON public.empresa FOR DELETE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: empresa Empresa insert admin only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa insert admin only" ON public.empresa FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: fiscal_config Empresa members can insert fiscal_config; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can insert fiscal_config" ON public.fiscal_config FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: fiscal_evento Empresa members can insert fiscal_evento; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can insert fiscal_evento" ON public.fiscal_evento FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: fiscal_config Empresa members can read fiscal_config; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can read fiscal_config" ON public.fiscal_config FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: fiscal_config Empresa members can update fiscal_config; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can update fiscal_config" ON public.fiscal_config FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: empresa Empresa members can view empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can view empresa" ON public.empresa FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: fiscal_evento Empresa members can view fiscal_evento; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa members can view fiscal_evento" ON public.fiscal_evento FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: fiscal_nfe_inutilizacao Empresa própria pode atualizar inutilizações; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa própria pode atualizar inutilizações" ON public.fiscal_nfe_inutilizacao FOR UPDATE USING ((empresa_id IN ( SELECT empresa_usuario.empresa_id
   FROM public.empresa_usuario
  WHERE (fiscal_nfe_inutilizacao.usuario_id = auth.uid()))));


--
-- Name: fiscal_nfe_inutilizacao Empresa própria pode inserir inutilizações; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa própria pode inserir inutilizações" ON public.fiscal_nfe_inutilizacao FOR INSERT WITH CHECK ((empresa_id IN ( SELECT empresa_usuario.empresa_id
   FROM public.empresa_usuario
  WHERE (fiscal_nfe_inutilizacao.usuario_id = auth.uid()))));


--
-- Name: fiscal_nfe_inutilizacao Empresa própria pode ler inutilizações; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa própria pode ler inutilizações" ON public.fiscal_nfe_inutilizacao FOR SELECT USING ((empresa_id IN ( SELECT empresa_usuario.empresa_id
   FROM public.empresa_usuario
  WHERE (fiscal_nfe_inutilizacao.usuario_id = auth.uid()))));


--
-- Name: empresa Empresa update admin only; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Empresa update admin only" ON public.empresa FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id)) WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: cadastro_motorista Enable all for authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for authenticated" ON public.cadastro_motorista TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cadastro_veiculo Enable all for authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all for authenticated" ON public.cadastro_veiculo TO authenticated USING (true) WITH CHECK (true);


--
-- Name: estoque_log Enable all operations for authenticated users on estoque_log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Enable all operations for authenticated users on estoque_log" ON public.estoque_log TO authenticated USING (true) WITH CHECK (true);


--
-- Name: sistema_versoes Leitura pública sistema_versoes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Leitura pública sistema_versoes" ON public.sistema_versoes FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_nfe_recebida NFE select same empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "NFE select same empresa" ON public.fiscal_nfe_recebida FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: perfil_usuario PU read same empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "PU read same empresa" ON public.perfil_usuario FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: fiscal_config_item Permitir leitura para todos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Permitir leitura para todos" ON public.fiscal_config_item FOR SELECT USING (true);


--
-- Name: emovimento Public storefront emovimento insertion; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento insertion" ON public.emovimento FOR INSERT TO anon WITH CHECK (true);


--
-- Name: emovimento Public storefront emovimento selection; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento selection" ON public.emovimento FOR SELECT TO anon USING (true);


--
-- Name: emovimento Public storefront emovimento update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento update" ON public.emovimento FOR UPDATE TO anon USING (true);


--
-- Name: emovimento_item Public storefront emovimento_item insertion; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento_item insertion" ON public.emovimento_item FOR INSERT TO anon WITH CHECK (true);


--
-- Name: emovimento_item Public storefront emovimento_item selection; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento_item selection" ON public.emovimento_item FOR SELECT TO anon USING (true);


--
-- Name: emovimento_pagamento Public storefront emovimento_pagamento insertion; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento_pagamento insertion" ON public.emovimento_pagamento FOR INSERT TO anon WITH CHECK (true);


--
-- Name: emovimento_pagamento Public storefront emovimento_pagamento selection; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront emovimento_pagamento selection" ON public.emovimento_pagamento FOR SELECT TO anon USING (true);


--
-- Name: cliente Public storefront guest insertion; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront guest insertion" ON public.cliente FOR INSERT TO anon WITH CHECK (true);


--
-- Name: cliente Public storefront guest selection; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public storefront guest selection" ON public.cliente FOR SELECT TO anon USING (true);


--
-- Name: fiscal_evento Users can insert fiscal_evento; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert fiscal_evento" ON public.fiscal_evento FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: fiscal_nfe_cce Users can insert fiscal_nfe_cce; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert fiscal_nfe_cce" ON public.fiscal_nfe_cce FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: fiscal_evento Users can read fiscal_evento; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read fiscal_evento" ON public.fiscal_evento FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_nfe_cce Users can read fiscal_nfe_cce; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read fiscal_nfe_cce" ON public.fiscal_nfe_cce FOR SELECT TO authenticated USING (true);


--
-- Name: fiscal_nfe_cce Users can update fiscal_nfe_cce; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update fiscal_nfe_cce" ON public.fiscal_nfe_cce FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: financeiro Users insert financeiro of own empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users insert financeiro of own empresa" ON public.financeiro FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: financeiro Users select financeiro of own empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users select financeiro of own empresa" ON public.financeiro FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: financeiro Users update financeiro of own empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users update financeiro of own empresa" ON public.financeiro FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: chat_conversa Usuario altera suas conversas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario altera suas conversas" ON public.chat_conversa FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chat_mensagem Usuario altera suas mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario altera suas mensagens" ON public.chat_mensagem FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: chat_conversa Usuario cria suas conversas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario cria suas conversas" ON public.chat_conversa FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_mensagem Usuario cria suas mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario cria suas mensagens" ON public.chat_mensagem FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: usuario_atalho Usuario pode atualizar seus atalhos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario pode atualizar seus atalhos" ON public.usuario_atalho FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: usuario_atalho Usuario pode excluir seus atalhos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario pode excluir seus atalhos" ON public.usuario_atalho FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: usuario_atalho Usuario pode inserir seus atalhos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario pode inserir seus atalhos" ON public.usuario_atalho FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: usuario_atalho Usuario pode ver seus atalhos; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario pode ver seus atalhos" ON public.usuario_atalho FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_conversa Usuario remove suas conversas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario remove suas conversas" ON public.chat_conversa FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chat_mensagem Usuario remove suas mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario remove suas mensagens" ON public.chat_mensagem FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: chat_conversa Usuario ve suas conversas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario ve suas conversas" ON public.chat_conversa FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_mensagem Usuario ve suas mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Usuario ve suas mensagens" ON public.chat_mensagem FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: aaaproduto_fornecedor; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.aaaproduto_fornecedor ENABLE ROW LEVEL SECURITY;

--
-- Name: abate; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate ENABLE ROW LEVEL SECURITY;

--
-- Name: abate_entrada; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_entrada ENABLE ROW LEVEL SECURITY;

--
-- Name: abate_mortalidade; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_mortalidade ENABLE ROW LEVEL SECURITY;

--
-- Name: abate_mortalidade_motivo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_mortalidade_motivo ENABLE ROW LEVEL SECURITY;

--
-- Name: abate_problema; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_problema ENABLE ROW LEVEL SECURITY;

--
-- Name: abate_producao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.abate_producao ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agendamento ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamento_financeiro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agendamento_financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamento_proc_split; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agendamento_proc_split ENABLE ROW LEVEL SECURITY;

--
-- Name: agendamento_procedimento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.agendamento_procedimento ENABLE ROW LEVEL SECURITY;

--
-- Name: auditoria; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_cabecalho auth_all_fiscal_nfe_cab; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_fiscal_nfe_cab ON public.fiscal_nfe_cabecalho TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_nfe_pagamento auth_all_fiscal_nfe_pag; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_fiscal_nfe_pag ON public.fiscal_nfe_pagamento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_nfe_referenciada auth_all_fiscal_nfe_ref; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_fiscal_nfe_ref ON public.fiscal_nfe_referenciada TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_carrega auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_carrega TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_componente auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_componente TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_condutor auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_condutor TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_descarrega auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_descarrega TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_documento auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_documento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_historicoxml auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_historicoxml TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_manifesto auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_manifesto TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_pagamento auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_pagamento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_pagtos auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_pagtos TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_percurso auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_percurso TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_veiculo auth_all_policy; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY auth_all_policy ON public.fiscal_mdf_veiculo TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chat_sala_mensagem autor exclui sua mensagem; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "autor exclui sua mensagem" ON public.chat_sala_mensagem FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: balanca; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.balanca ENABLE ROW LEVEL SECURITY;

--
-- Name: balanca balanca_select_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY balanca_select_auth ON public.balanca FOR SELECT TO authenticated USING (true);


--
-- Name: balanca balanca_update_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY balanca_update_auth ON public.balanca FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: banco; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.banco ENABLE ROW LEVEL SECURITY;

--
-- Name: bandeira; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bandeira ENABLE ROW LEVEL SECURITY;

--
-- Name: bandeira bandeira_delete_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bandeira_delete_auth ON public.bandeira FOR DELETE TO authenticated USING (true);


--
-- Name: bandeira bandeira_read_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bandeira_read_auth ON public.bandeira FOR SELECT TO authenticated USING (true);


--
-- Name: bandeira bandeira_update_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bandeira_update_auth ON public.bandeira FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: bandeira bandeira_write_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY bandeira_write_auth ON public.bandeira FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: boleto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.boleto ENABLE ROW LEVEL SECURITY;

--
-- Name: boleto boleto_insert_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY boleto_insert_own ON public.boleto FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: boleto boleto_select_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY boleto_select_own ON public.boleto FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: boleto boleto_update_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY boleto_update_own ON public.boleto FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: cadastro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro ENABLE ROW LEVEL SECURITY;

--
-- Name: cadastro_grupo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: cadastro_motorista; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_motorista ENABLE ROW LEVEL SECURITY;

--
-- Name: cadastro_preco; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_preco ENABLE ROW LEVEL SECURITY;

--
-- Name: cadastro_veiculo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cadastro_veiculo ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_abertura; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_abertura ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_movimento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_movimento ENABLE ROW LEVEL SECURITY;

--
-- Name: caixa_movimento_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.caixa_movimento_item ENABLE ROW LEVEL SECURITY;

--
-- Name: centro_custo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.centro_custo ENABLE ROW LEVEL SECURITY;

--
-- Name: cfop; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cfop ENABLE ROW LEVEL SECURITY;

--
-- Name: cfop cfop_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cfop_all ON public.cfop TO authenticated USING (true) WITH CHECK (true);


--
-- Name: cfop cfop_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cfop_auth ON public.cfop TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chat_conversa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_conversa ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_mensagem; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_mensagem ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sala; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_sala ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sala_membro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_sala_membro ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sala_mensagem; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.chat_sala_mensagem ENABLE ROW LEVEL SECURITY;

--
-- Name: cidade; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cidade ENABLE ROW LEVEL SECURITY;

--
-- Name: cidade cidade_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY cidade_auth ON public.cidade TO authenticated USING (true) WITH CHECK (true);


--
-- Name: clas_trib; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.clas_trib ENABLE ROW LEVEL SECURITY;

--
-- Name: cliente; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;

--
-- Name: comissao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.comissao ENABLE ROW LEVEL SECURITY;

--
-- Name: comissao comissao_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY comissao_auth ON public.comissao TO authenticated USING (true) WITH CHECK (true);


--
-- Name: condicao_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.condicao_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: condicao_pagamento condicao_pagamento_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY condicao_pagamento_auth ON public.condicao_pagamento TO authenticated USING (true) WITH CHECK (true);


--
-- Name: conta; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.conta ENABLE ROW LEVEL SECURITY;

--
-- Name: conta conta_insert_admin_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conta_insert_admin_empresa ON public.conta FOR INSERT TO authenticated WITH CHECK (public.fu_is_admin(auth.uid(), (empresa_id)::bigint));


--
-- Name: conta conta_select_admin_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conta_select_admin_empresa ON public.conta FOR SELECT TO authenticated USING (public.fu_is_admin(auth.uid(), (empresa_id)::bigint));


--
-- Name: conta conta_update_admin_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY conta_update_admin_empresa ON public.conta FOR UPDATE TO authenticated USING (public.fu_is_admin(auth.uid(), (empresa_id)::bigint)) WITH CHECK (public.fu_is_admin(auth.uid(), (empresa_id)::bigint));


--
-- Name: convenio; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.convenio ENABLE ROW LEVEL SECURITY;

--
-- Name: corretora; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.corretora ENABLE ROW LEVEL SECURITY;

--
-- Name: corretora corretora_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY corretora_auth ON public.corretora TO authenticated USING (true) WITH CHECK (true);


--
-- Name: chat_sala criador atualiza sala; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "criador atualiza sala" ON public.chat_sala FOR UPDATE TO authenticated USING ((criado_por = auth.uid()));


--
-- Name: depara; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.depara ENABLE ROW LEVEL SECURITY;

--
-- Name: deposito; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.deposito ENABLE ROW LEVEL SECURITY;

--
-- Name: emovimento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento ENABLE ROW LEVEL SECURITY;

--
-- Name: emovimento_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento_item ENABLE ROW LEVEL SECURITY;

--
-- Name: emovimento_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.emovimento_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: empresa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: empresa_hs_lojavirtual; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa_hs_lojavirtual ENABLE ROW LEVEL SECURITY;

--
-- Name: empresa_usuario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.empresa_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: estado; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.estado ENABLE ROW LEVEL SECURITY;

--
-- Name: estoque; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;

--
-- Name: estoque_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.estoque_log ENABLE ROW LEVEL SECURITY;

--
-- Name: fator_conversao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fator_conversao ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_baixa fb_insert_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fb_insert_own_empresa ON public.financeiro_baixa FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: financeiro_baixa fb_select_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fb_select_own_empresa ON public.financeiro_baixa FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: financeiro_baixa fb_update_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fb_update_own_empresa ON public.financeiro_baixa FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), (empresa_id)::bigint));


--
-- Name: financeiro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_baixa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.financeiro_baixa ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_config_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_config_item ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_evento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_evento ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_grupo_produto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_grupo_produto ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_grupo_produto fiscal_grupo_produto_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fiscal_grupo_produto_all ON public.fiscal_grupo_produto TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_mdf_carrega; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_carrega ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_componente; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_componente ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_condutor; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_condutor ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_descarrega; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_descarrega ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_documento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_documento ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_historicoxml; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_historicoxml ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_manifesto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_manifesto ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_pagtos; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_pagtos ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_percurso; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_percurso ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_mdf_veiculo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_mdf_veiculo ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_cabecalho; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_cabecalho ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_cce; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_cce ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_inutilizacao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_inutilizacao ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_item ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_recebida; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_recebida ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_nfe_referenciada; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_nfe_referenciada ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_regra; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_regra fiscal_regra_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fiscal_regra_all ON public.fiscal_regra TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_regra_cfop; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra_cfop ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_regra_cfop fiscal_regra_cfop_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fiscal_regra_cfop_all ON public.fiscal_regra_cfop TO authenticated USING (true) WITH CHECK (true);


--
-- Name: fiscal_regra_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.fiscal_regra_item ENABLE ROW LEVEL SECURITY;

--
-- Name: fiscal_regra_item fiscal_regra_item_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY fiscal_regra_item_all ON public.fiscal_regra_item TO authenticated USING (true) WITH CHECK (true);


--
-- Name: funcionario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.funcionario ENABLE ROW LEVEL SECURITY;

--
-- Name: galpao_ambiencia; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.galpao_ambiencia ENABLE ROW LEVEL SECURITY;

--
-- Name: grupo_icms_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.grupo_icms_item ENABLE ROW LEVEL SECURITY;

--
-- Name: linha_produto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.linha_produto ENABLE ROW LEVEL SECURITY;

--
-- Name: linha_produto linha_produto_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY linha_produto_auth ON public.linha_produto TO authenticated USING (true) WITH CHECK (true);


--
-- Name: meio_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.meio_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sala_membro membro atualiza sua propria leitura; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membro atualiza sua propria leitura" ON public.chat_sala_membro FOR UPDATE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_sala_membro membro insere a si mesmo ou criador adiciona; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membro insere a si mesmo ou criador adiciona" ON public.chat_sala_membro FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.chat_sala s
  WHERE ((s.chat_sala_id = chat_sala_membro.chat_sala_id) AND (s.criado_por = auth.uid()))))));


--
-- Name: chat_sala_membro membro sai da sala; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membro sai da sala" ON public.chat_sala_membro FOR DELETE TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_sala_mensagem membros enviam mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membros enviam mensagens" ON public.chat_sala_mensagem FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.fu_chat_is_membro(chat_sala_id, auth.uid())));


--
-- Name: chat_sala_mensagem membros leem mensagens; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membros leem mensagens" ON public.chat_sala_mensagem FOR SELECT TO authenticated USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));


--
-- Name: chat_sala_membro membros veem membros da sala; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membros veem membros da sala" ON public.chat_sala_membro FOR SELECT TO authenticated USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));


--
-- Name: chat_sala membros veem suas salas; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "membros veem suas salas" ON public.chat_sala FOR SELECT TO authenticated USING (public.fu_chat_is_membro(chat_sala_id, auth.uid()));


--
-- Name: movimento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento ENABLE ROW LEVEL SECURITY;

--
-- Name: movimento movimento_insert_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY movimento_insert_own_empresa ON public.movimento FOR INSERT TO authenticated WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: movimento_item; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento_item ENABLE ROW LEVEL SECURITY;

--
-- Name: movimento_pagamento; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.movimento_pagamento ENABLE ROW LEVEL SECURITY;

--
-- Name: movimento movimento_select_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY movimento_select_own_empresa ON public.movimento FOR SELECT TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: movimento movimento_update_own_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY movimento_update_own_empresa ON public.movimento FOR UPDATE TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: meio_pagamento mp_delete_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_delete_auth ON public.meio_pagamento FOR DELETE TO authenticated USING (true);


--
-- Name: meio_pagamento mp_insert_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_insert_auth ON public.meio_pagamento FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: meio_pagamento mp_read_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_read_auth ON public.meio_pagamento FOR SELECT TO authenticated USING (true);


--
-- Name: meio_pagamento mp_update_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_update_auth ON public.meio_pagamento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: operadora; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.operadora ENABLE ROW LEVEL SECURITY;

--
-- Name: operadora operadora_delete_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY operadora_delete_auth ON public.operadora FOR DELETE TO authenticated USING (true);


--
-- Name: operadora operadora_insert_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY operadora_insert_auth ON public.operadora FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: operadora operadora_read_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY operadora_read_auth ON public.operadora FOR SELECT TO authenticated USING (true);


--
-- Name: operadora operadora_update_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY operadora_update_auth ON public.operadora FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: parametro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.parametro ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_acesso_botao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_botao ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_acesso_campo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_campo ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_acesso_formulario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_formulario ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_acesso_menu; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_acesso_menu ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_horario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_horario ENABLE ROW LEVEL SECURITY;

--
-- Name: perfil_usuario; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.perfil_usuario ENABLE ROW LEVEL SECURITY;

--
-- Name: plano; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.plano ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_conta; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.plano_conta ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_conta plano_conta_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY plano_conta_auth ON public.plano_conta TO authenticated USING (true) WITH CHECK (true);


--
-- Name: portador; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.portador ENABLE ROW LEVEL SECURITY;

--
-- Name: portador portador_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY portador_auth ON public.portador TO authenticated USING (true) WITH CHECK (true);


--
-- Name: produto; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_codbarra; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_codbarra ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_conversao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_conversao ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_fornecedor; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_fornecedor ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_grupo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_grupo ENABLE ROW LEVEL SECURITY;

--
-- Name: produto_subgrupo; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.produto_subgrupo ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_sala qualquer autenticado cria sala; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "qualquer autenticado cria sala" ON public.chat_sala FOR INSERT TO authenticated WITH CHECK ((criado_por = auth.uid()));


--
-- Name: rb_conexao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_conexao ENABLE ROW LEVEL SECURITY;

--
-- Name: rb_conexao rb_conexao_admin_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rb_conexao_admin_empresa ON public.rb_conexao TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id)) WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: rb_relatorio; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_relatorio ENABLE ROW LEVEL SECURITY;

--
-- Name: rb_relatorio rb_relatorio_empresa_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rb_relatorio_empresa_members ON public.rb_relatorio TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: rb_relatorio_variavel; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_relatorio_variavel ENABLE ROW LEVEL SECURITY;

--
-- Name: rb_relatorio_variavel rb_relatorio_variavel_auth; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rb_relatorio_variavel_auth ON public.rb_relatorio_variavel TO authenticated USING (true) WITH CHECK (true);


--
-- Name: rb_templatepesquisa; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rb_templatepesquisa ENABLE ROW LEVEL SECURITY;

--
-- Name: rb_templatepesquisa rb_templatepesquisa_empresa_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rb_templatepesquisa_empresa_members ON public.rb_templatepesquisa TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: rpb_conexao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_conexao ENABLE ROW LEVEL SECURITY;

--
-- Name: rpb_conexao rpb_conexao_admin_empresa; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rpb_conexao_admin_empresa ON public.rpb_conexao TO authenticated USING (public.fu_is_admin(auth.uid(), empresa_id)) WITH CHECK (public.fu_is_admin(auth.uid(), empresa_id));


--
-- Name: rpb_filtro; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_filtro ENABLE ROW LEVEL SECURITY;

--
-- Name: rpb_filtro rpb_filtro_empresa_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rpb_filtro_empresa_members ON public.rpb_filtro TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: rpb_relatorio; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.rpb_relatorio ENABLE ROW LEVEL SECURITY;

--
-- Name: rpb_relatorio rpb_relatorio_empresa_members; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY rpb_relatorio_empresa_members ON public.rpb_relatorio TO authenticated USING (public.fu_user_in_empresa(auth.uid(), empresa_id)) WITH CHECK (public.fu_user_in_empresa(auth.uid(), empresa_id));


--
-- Name: sistema_versoes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sistema_versoes ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_backup_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sys_backup_log ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_config; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sys_config ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_sequencial; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sys_sequencial ENABLE ROW LEVEL SECURITY;

--
-- Name: sys_sequencial sys_sequencial_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sys_sequencial_insert ON public.sys_sequencial FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: sys_sequencial sys_sequencial_select; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sys_sequencial_select ON public.sys_sequencial FOR SELECT TO authenticated USING (true);


--
-- Name: sys_sequencial sys_sequencial_update; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sys_sequencial_update ON public.sys_sequencial FOR UPDATE TO authenticated USING (true);


--
-- Name: tp_operacao; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tp_operacao ENABLE ROW LEVEL SECURITY;

--
-- Name: tp_operacao tp_operacao_all; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY tp_operacao_all ON public.tp_operacao TO authenticated USING (true) WITH CHECK (true);


--
-- Name: unidade; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.unidade ENABLE ROW LEVEL SECURITY;

--
-- Name: unidade unidade_delete_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY unidade_delete_authenticated ON public.unidade FOR DELETE TO authenticated USING (true);


--
-- Name: unidade unidade_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY unidade_insert_authenticated ON public.unidade FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: unidade unidade_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY unidade_select_authenticated ON public.unidade FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.empresa_usuario eu
     LEFT JOIN public.empresa e ON ((e.empresa_id = eu.empresa_id)))
  WHERE ((eu.user_id = auth.uid()) AND (eu.fl_excluido = false) AND ((eu.empresa_id = unidade.empresa_id) OR (COALESCE((e.empresa_matriz_id)::bigint, e.empresa_id) = unidade.empresa_id))))));


--
-- Name: unidade unidade_update_authenticated; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY unidade_update_authenticated ON public.unidade FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: usuario_atalho; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.usuario_atalho ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: supabase_admin
--

GRANT USAGE ON SCHEMA auth TO anon;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO dashboard_user;
GRANT USAGE ON SCHEMA auth TO postgres;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION email(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.email() TO dashboard_user;


--
-- Name: FUNCTION jwt(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.jwt() TO postgres;
GRANT ALL ON FUNCTION auth.jwt() TO dashboard_user;


--
-- Name: FUNCTION role(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.role() TO dashboard_user;


--
-- Name: FUNCTION uid(); Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON FUNCTION auth.uid() TO dashboard_user;


--
-- Name: FUNCTION finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer) TO anon;
GRANT ALL ON FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.finalizar_venda_caixa(p_movimento_id bigint, p_empresa_id bigint, p_funcionario_id bigint, p_caixa_abertura_id integer, p_tp_operacao character varying, p_conta_gerencial_id integer, p_centro_custo_id integer, p_historico character varying, p_documento character varying, p_vl_total double precision, p_vl_troco double precision, p_pagamentos jsonb, p_usuario character varying, p_gerar_financeiro boolean, p_cadastro_id bigint, p_condicao_id bigint, p_portador_id integer, p_planoconta_id integer) TO service_role;


--
-- Name: FUNCTION fn_duplicar_ambiencia(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_duplicar_ambiencia() TO anon;
GRANT ALL ON FUNCTION public.fn_duplicar_ambiencia() TO authenticated;
GRANT ALL ON FUNCTION public.fn_duplicar_ambiencia() TO service_role;


--
-- Name: FUNCTION fn_emovimento_item_calc_before(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_emovimento_item_calc_before() TO anon;
GRANT ALL ON FUNCTION public.fn_emovimento_item_calc_before() TO authenticated;
GRANT ALL ON FUNCTION public.fn_emovimento_item_calc_before() TO service_role;


--
-- Name: FUNCTION fn_emovimento_totalize(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_emovimento_totalize() TO anon;
GRANT ALL ON FUNCTION public.fn_emovimento_totalize() TO authenticated;
GRANT ALL ON FUNCTION public.fn_emovimento_totalize() TO service_role;


--
-- Name: FUNCTION fn_estoque_log_block_mod(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_estoque_log_block_mod() TO anon;
GRANT ALL ON FUNCTION public.fn_estoque_log_block_mod() TO authenticated;
GRANT ALL ON FUNCTION public.fn_estoque_log_block_mod() TO service_role;


--
-- Name: FUNCTION fn_movimento_item_calc_before(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_movimento_item_calc_before() TO anon;
GRANT ALL ON FUNCTION public.fn_movimento_item_calc_before() TO authenticated;
GRANT ALL ON FUNCTION public.fn_movimento_item_calc_before() TO service_role;


--
-- Name: FUNCTION fn_movimento_totalize(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_movimento_totalize() TO anon;
GRANT ALL ON FUNCTION public.fn_movimento_totalize() TO authenticated;
GRANT ALL ON FUNCTION public.fn_movimento_totalize() TO service_role;


--
-- Name: FUNCTION fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fn_prevalidar_nfe(p_nfe_cabecalho_id bigint, p_empresa_id bigint) TO service_role;


--
-- Name: FUNCTION fn_processa_estoque_log(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_processa_estoque_log() TO anon;
GRANT ALL ON FUNCTION public.fn_processa_estoque_log() TO authenticated;
GRANT ALL ON FUNCTION public.fn_processa_estoque_log() TO service_role;


--
-- Name: FUNCTION fn_set_cd_cadastro(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_set_cd_cadastro() TO anon;
GRANT ALL ON FUNCTION public.fn_set_cd_cadastro() TO authenticated;
GRANT ALL ON FUNCTION public.fn_set_cd_cadastro() TO service_role;


--
-- Name: FUNCTION fn_set_cd_cadastro_grupo(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fn_set_cd_cadastro_grupo() TO anon;
GRANT ALL ON FUNCTION public.fn_set_cd_cadastro_grupo() TO authenticated;
GRANT ALL ON FUNCTION public.fn_set_cd_cadastro_grupo() TO service_role;


--
-- Name: FUNCTION fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer) TO anon;
GRANT ALL ON FUNCTION public.fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.fu_baixar_titulos_cliente(p_cadastro_id integer, p_vl_recebido character varying, p_recibo character varying, p_conta_id character varying, p_tipo_pag_rec_id integer) TO service_role;


--
-- Name: FUNCTION fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text, p_serie text, p_nr_nota text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text, p_serie text, p_nr_nota text) TO anon;
GRANT ALL ON FUNCTION public.fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text, p_serie text, p_nr_nota text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_calcular_impostos_movimento(p_movimento_id bigint, p_modelo text, p_serie text, p_nr_nota text) TO service_role;


--
-- Name: FUNCTION fu_chat_is_membro(_sala_id bigint, _user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_chat_is_membro(_sala_id bigint, _user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_chat_is_membro(_sala_id bigint, _user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_chat_is_membro(_sala_id bigint, _user_id uuid) TO service_role;


--
-- Name: FUNCTION fu_chat_sala_touch(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_chat_sala_touch() TO anon;
GRANT ALL ON FUNCTION public.fu_chat_sala_touch() TO authenticated;
GRANT ALL ON FUNCTION public.fu_chat_sala_touch() TO service_role;


--
-- Name: FUNCTION fu_chat_touch_conversa(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_chat_touch_conversa() TO anon;
GRANT ALL ON FUNCTION public.fu_chat_touch_conversa() TO authenticated;
GRANT ALL ON FUNCTION public.fu_chat_touch_conversa() TO service_role;


--
-- Name: FUNCTION fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid) TO service_role;


--
-- Name: FUNCTION fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text) TO anon;
GRANT ALL ON FUNCTION public.fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_form_permissao(_user_id uuid, _empresa_id bigint, _nm_formulario text) TO service_role;


--
-- Name: FUNCTION fu_get_cliente_public(_cpf text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_get_cliente_public(_cpf text) TO anon;
GRANT ALL ON FUNCTION public.fu_get_cliente_public(_cpf text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_get_cliente_public(_cpf text) TO service_role;


--
-- Name: FUNCTION fu_get_parametro_publico(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_get_parametro_publico() TO anon;
GRANT ALL ON FUNCTION public.fu_get_parametro_publico() TO authenticated;
GRANT ALL ON FUNCTION public.fu_get_parametro_publico() TO service_role;


--
-- Name: FUNCTION fu_get_pedido_status_public(_pedido_id bigint, _cpf text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_get_pedido_status_public(_pedido_id bigint, _cpf text) TO anon;
GRANT ALL ON FUNCTION public.fu_get_pedido_status_public(_pedido_id bigint, _cpf text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_get_pedido_status_public(_pedido_id bigint, _cpf text) TO service_role;


--
-- Name: FUNCTION fu_is_admin(_user_id uuid, _empresa_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fu_is_admin(_user_id uuid, _empresa_id bigint) TO service_role;


--
-- Name: FUNCTION fu_is_admin_any(_user_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_is_admin_any(_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_is_admin_any(_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_is_admin_any(_user_id uuid) TO service_role;


--
-- Name: FUNCTION fu_list_pedidos_public(_cpf text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_list_pedidos_public(_cpf text) TO anon;
GRANT ALL ON FUNCTION public.fu_list_pedidos_public(_cpf text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_list_pedidos_public(_cpf text) TO service_role;


--
-- Name: FUNCTION fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text) TO anon;
GRANT ALL ON FUNCTION public.fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_menu_visivel(_user_id uuid, _empresa_id bigint, _nm_menu text) TO service_role;


--
-- Name: FUNCTION fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_mudar_status_pedido_pdv(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO service_role;


--
-- Name: FUNCTION fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_pdv_confirmar_venda_externa(_emovimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _usuario_id uuid) TO service_role;


--
-- Name: FUNCTION fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_pdv_registrar_recebimento_venda(_empresa_id bigint, _movimento_id bigint, _caixa_abertura_id bigint, _funcionario_caixa_id bigint, _dt_movimento date, _tp_operacao_caixa text, _centro_custo_caixa bigint, _pagamentos jsonb, _usuario_id uuid) TO service_role;


--
-- Name: FUNCTION fu_recalcular_pedido(_movimento_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fu_recalcular_pedido(_movimento_id bigint) TO service_role;


--
-- Name: FUNCTION fu_round_abnt(p_val numeric, p_dec integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_round_abnt(p_val numeric, p_dec integer) TO anon;
GRANT ALL ON FUNCTION public.fu_round_abnt(p_val numeric, p_dec integer) TO authenticated;
GRANT ALL ON FUNCTION public.fu_round_abnt(p_val numeric, p_dec integer) TO service_role;


--
-- Name: FUNCTION fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO anon;
GRANT ALL ON FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fu_transition_pedido_status(_movimento_id bigint, _novo_status text, _usuario_id uuid) TO service_role;


--
-- Name: FUNCTION fu_update_updated_at(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.fu_update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.fu_update_updated_at() TO service_role;


--
-- Name: FUNCTION fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) TO anon;
GRANT ALL ON FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) TO authenticated;
GRANT ALL ON FUNCTION public.fu_upsert_cliente_public(_cpf text, _nome text, _telefone text, _filhos text) TO service_role;


--
-- Name: FUNCTION fu_user_in_empresa(_user_id uuid, _empresa_id bigint); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint) TO anon;
GRANT ALL ON FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.fu_user_in_empresa(_user_id uuid, _empresa_id bigint) TO service_role;


--
-- Name: FUNCTION get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying) TO anon;
GRANT ALL ON FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo character varying) TO service_role;


--
-- Name: PROCEDURE pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer) TO anon;
GRANT ALL ON PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer) TO authenticated;
GRANT ALL ON PROCEDURE public.pcdr_baixar_titulos(IN p_cadastro_id integer, IN p_vl_recebido character varying, IN p_recibo character varying, IN p_conta_id character varying, IN p_tipo_pag_rec_id integer) TO service_role;


--
-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;


--
-- Name: FUNCTION rpb_execute_query(p_sql text); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rpb_execute_query(p_sql text) TO anon;
GRANT ALL ON FUNCTION public.rpb_execute_query(p_sql text) TO authenticated;
GRANT ALL ON FUNCTION public.rpb_execute_query(p_sql text) TO service_role;


--
-- Name: FUNCTION tr_set_hr_movimento(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.tr_set_hr_movimento() TO anon;
GRANT ALL ON FUNCTION public.tr_set_hr_movimento() TO authenticated;
GRANT ALL ON FUNCTION public.tr_set_hr_movimento() TO service_role;


--
-- Name: TABLE audit_log_entries; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.audit_log_entries TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.audit_log_entries TO postgres;
GRANT SELECT ON TABLE auth.audit_log_entries TO postgres WITH GRANT OPTION;


--
-- Name: TABLE custom_oauth_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.custom_oauth_providers TO postgres;
GRANT ALL ON TABLE auth.custom_oauth_providers TO dashboard_user;


--
-- Name: TABLE flow_state; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.flow_state TO postgres;
GRANT SELECT ON TABLE auth.flow_state TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.flow_state TO dashboard_user;


--
-- Name: TABLE identities; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.identities TO postgres;
GRANT SELECT ON TABLE auth.identities TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.identities TO dashboard_user;


--
-- Name: TABLE instances; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.instances TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.instances TO postgres;
GRANT SELECT ON TABLE auth.instances TO postgres WITH GRANT OPTION;


--
-- Name: TABLE mfa_amr_claims; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_amr_claims TO postgres;
GRANT SELECT ON TABLE auth.mfa_amr_claims TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_amr_claims TO dashboard_user;


--
-- Name: TABLE mfa_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_challenges TO postgres;
GRANT SELECT ON TABLE auth.mfa_challenges TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_challenges TO dashboard_user;


--
-- Name: TABLE mfa_factors; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.mfa_factors TO postgres;
GRANT SELECT ON TABLE auth.mfa_factors TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.mfa_factors TO dashboard_user;


--
-- Name: TABLE oauth_authorizations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_authorizations TO postgres;
GRANT ALL ON TABLE auth.oauth_authorizations TO dashboard_user;


--
-- Name: TABLE oauth_client_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_client_states TO postgres;
GRANT ALL ON TABLE auth.oauth_client_states TO dashboard_user;


--
-- Name: TABLE oauth_clients; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_clients TO postgres;
GRANT ALL ON TABLE auth.oauth_clients TO dashboard_user;


--
-- Name: TABLE oauth_consents; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.oauth_consents TO postgres;
GRANT ALL ON TABLE auth.oauth_consents TO dashboard_user;


--
-- Name: TABLE one_time_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.one_time_tokens TO postgres;
GRANT SELECT ON TABLE auth.one_time_tokens TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.one_time_tokens TO dashboard_user;


--
-- Name: TABLE refresh_tokens; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.refresh_tokens TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.refresh_tokens TO postgres;
GRANT SELECT ON TABLE auth.refresh_tokens TO postgres WITH GRANT OPTION;


--
-- Name: SEQUENCE refresh_tokens_id_seq; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO dashboard_user;
GRANT ALL ON SEQUENCE auth.refresh_tokens_id_seq TO postgres;


--
-- Name: TABLE saml_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_providers TO postgres;
GRANT SELECT ON TABLE auth.saml_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_providers TO dashboard_user;


--
-- Name: TABLE saml_relay_states; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.saml_relay_states TO postgres;
GRANT SELECT ON TABLE auth.saml_relay_states TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.saml_relay_states TO dashboard_user;


--
-- Name: TABLE schema_migrations; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT SELECT ON TABLE auth.schema_migrations TO postgres WITH GRANT OPTION;


--
-- Name: TABLE sessions; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sessions TO postgres;
GRANT SELECT ON TABLE auth.sessions TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sessions TO dashboard_user;


--
-- Name: TABLE sso_domains; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_domains TO postgres;
GRANT SELECT ON TABLE auth.sso_domains TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_domains TO dashboard_user;


--
-- Name: TABLE sso_providers; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.sso_providers TO postgres;
GRANT SELECT ON TABLE auth.sso_providers TO postgres WITH GRANT OPTION;
GRANT ALL ON TABLE auth.sso_providers TO dashboard_user;


--
-- Name: TABLE users; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.users TO dashboard_user;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE auth.users TO postgres;
GRANT SELECT ON TABLE auth.users TO postgres WITH GRANT OPTION;


--
-- Name: TABLE webauthn_challenges; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_challenges TO postgres;
GRANT ALL ON TABLE auth.webauthn_challenges TO dashboard_user;


--
-- Name: TABLE webauthn_credentials; Type: ACL; Schema: auth; Owner: supabase_auth_admin
--

GRANT ALL ON TABLE auth.webauthn_credentials TO postgres;
GRANT ALL ON TABLE auth.webauthn_credentials TO dashboard_user;


--
-- Name: TABLE aaaproduto_fornecedor; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.aaaproduto_fornecedor TO anon;
GRANT ALL ON TABLE public.aaaproduto_fornecedor TO authenticated;
GRANT ALL ON TABLE public.aaaproduto_fornecedor TO service_role;


--
-- Name: TABLE abate; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate TO anon;
GRANT ALL ON TABLE public.abate TO authenticated;
GRANT ALL ON TABLE public.abate TO service_role;


--
-- Name: TABLE abate_entrada; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate_entrada TO anon;
GRANT ALL ON TABLE public.abate_entrada TO authenticated;
GRANT ALL ON TABLE public.abate_entrada TO service_role;


--
-- Name: TABLE abate_mortalidade; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate_mortalidade TO anon;
GRANT ALL ON TABLE public.abate_mortalidade TO authenticated;
GRANT ALL ON TABLE public.abate_mortalidade TO service_role;


--
-- Name: TABLE abate_mortalidade_motivo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate_mortalidade_motivo TO anon;
GRANT ALL ON TABLE public.abate_mortalidade_motivo TO authenticated;
GRANT ALL ON TABLE public.abate_mortalidade_motivo TO service_role;


--
-- Name: SEQUENCE abate_mortalidade_motivo_motivo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.abate_mortalidade_motivo_motivo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.abate_mortalidade_motivo_motivo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.abate_mortalidade_motivo_motivo_id_seq TO service_role;


--
-- Name: TABLE abate_problema; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate_problema TO anon;
GRANT ALL ON TABLE public.abate_problema TO authenticated;
GRANT ALL ON TABLE public.abate_problema TO service_role;


--
-- Name: TABLE abate_producao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.abate_producao TO anon;
GRANT ALL ON TABLE public.abate_producao TO authenticated;
GRANT ALL ON TABLE public.abate_producao TO service_role;


--
-- Name: TABLE agendamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agendamento TO anon;
GRANT ALL ON TABLE public.agendamento TO authenticated;
GRANT ALL ON TABLE public.agendamento TO service_role;


--
-- Name: TABLE agendamento_financeiro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agendamento_financeiro TO anon;
GRANT ALL ON TABLE public.agendamento_financeiro TO authenticated;
GRANT ALL ON TABLE public.agendamento_financeiro TO service_role;


--
-- Name: TABLE agendamento_proc_split; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agendamento_proc_split TO anon;
GRANT ALL ON TABLE public.agendamento_proc_split TO authenticated;
GRANT ALL ON TABLE public.agendamento_proc_split TO service_role;


--
-- Name: TABLE agendamento_procedimento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.agendamento_procedimento TO anon;
GRANT ALL ON TABLE public.agendamento_procedimento TO authenticated;
GRANT ALL ON TABLE public.agendamento_procedimento TO service_role;


--
-- Name: TABLE auditoria; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.auditoria TO anon;
GRANT ALL ON TABLE public.auditoria TO authenticated;
GRANT ALL ON TABLE public.auditoria TO service_role;


--
-- Name: SEQUENCE auditoria_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.auditoria_id_seq TO anon;
GRANT ALL ON SEQUENCE public.auditoria_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.auditoria_id_seq TO service_role;


--
-- Name: TABLE balanca; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.balanca TO anon;
GRANT ALL ON TABLE public.balanca TO authenticated;
GRANT ALL ON TABLE public.balanca TO service_role;


--
-- Name: SEQUENCE balanca_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.balanca_id_seq TO anon;
GRANT ALL ON SEQUENCE public.balanca_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.balanca_id_seq TO service_role;


--
-- Name: TABLE banco; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.banco TO anon;
GRANT ALL ON TABLE public.banco TO authenticated;
GRANT ALL ON TABLE public.banco TO service_role;


--
-- Name: SEQUENCE banco_banco_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.banco_banco_id_seq TO anon;
GRANT ALL ON SEQUENCE public.banco_banco_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.banco_banco_id_seq TO service_role;


--
-- Name: TABLE bandeira; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bandeira TO anon;
GRANT ALL ON TABLE public.bandeira TO authenticated;
GRANT ALL ON TABLE public.bandeira TO service_role;


--
-- Name: TABLE boleto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.boleto TO anon;
GRANT ALL ON TABLE public.boleto TO authenticated;
GRANT ALL ON TABLE public.boleto TO service_role;


--
-- Name: SEQUENCE boleto_bol_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.boleto_bol_id_seq TO anon;
GRANT ALL ON SEQUENCE public.boleto_bol_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.boleto_bol_id_seq TO service_role;


--
-- Name: TABLE cadastro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cadastro TO anon;
GRANT ALL ON TABLE public.cadastro TO authenticated;
GRANT ALL ON TABLE public.cadastro TO service_role;


--
-- Name: SEQUENCE cadastro_cadastro_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cadastro_cadastro_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cadastro_cadastro_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cadastro_cadastro_id_seq TO service_role;


--
-- Name: TABLE cadastro_grupo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cadastro_grupo TO anon;
GRANT ALL ON TABLE public.cadastro_grupo TO authenticated;
GRANT ALL ON TABLE public.cadastro_grupo TO service_role;


--
-- Name: SEQUENCE cadastro_grupo_cadastro_grupo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cadastro_grupo_cadastro_grupo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cadastro_grupo_cadastro_grupo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cadastro_grupo_cadastro_grupo_id_seq TO service_role;


--
-- Name: TABLE cadastro_motorista; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cadastro_motorista TO anon;
GRANT ALL ON TABLE public.cadastro_motorista TO authenticated;
GRANT ALL ON TABLE public.cadastro_motorista TO service_role;


--
-- Name: SEQUENCE cadastro_motorista_motorista_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cadastro_motorista_motorista_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cadastro_motorista_motorista_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cadastro_motorista_motorista_id_seq TO service_role;


--
-- Name: TABLE cadastro_preco; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cadastro_preco TO anon;
GRANT ALL ON TABLE public.cadastro_preco TO authenticated;
GRANT ALL ON TABLE public.cadastro_preco TO service_role;


--
-- Name: TABLE cadastro_veiculo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cadastro_veiculo TO anon;
GRANT ALL ON TABLE public.cadastro_veiculo TO authenticated;
GRANT ALL ON TABLE public.cadastro_veiculo TO service_role;


--
-- Name: SEQUENCE cadastro_veiculo_veiculo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cadastro_veiculo_veiculo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cadastro_veiculo_veiculo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cadastro_veiculo_veiculo_id_seq TO service_role;


--
-- Name: TABLE caixa_abertura; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caixa_abertura TO anon;
GRANT ALL ON TABLE public.caixa_abertura TO authenticated;
GRANT ALL ON TABLE public.caixa_abertura TO service_role;


--
-- Name: SEQUENCE caixa_abertura_caixa_abertura_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.caixa_abertura_caixa_abertura_id_seq TO anon;
GRANT ALL ON SEQUENCE public.caixa_abertura_caixa_abertura_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.caixa_abertura_caixa_abertura_id_seq TO service_role;


--
-- Name: TABLE caixa_movimento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caixa_movimento TO anon;
GRANT ALL ON TABLE public.caixa_movimento TO authenticated;
GRANT ALL ON TABLE public.caixa_movimento TO service_role;


--
-- Name: SEQUENCE caixa_movimento_caixa_movimento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.caixa_movimento_caixa_movimento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.caixa_movimento_caixa_movimento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.caixa_movimento_caixa_movimento_id_seq TO service_role;


--
-- Name: TABLE caixa_movimento_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.caixa_movimento_item TO anon;
GRANT ALL ON TABLE public.caixa_movimento_item TO authenticated;
GRANT ALL ON TABLE public.caixa_movimento_item TO service_role;


--
-- Name: SEQUENCE caixa_movimento_item_caixa_movimento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_id_seq TO service_role;


--
-- Name: SEQUENCE caixa_movimento_item_caixa_movimento_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.caixa_movimento_item_caixa_movimento_item_id_seq TO service_role;


--
-- Name: TABLE centro_custo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.centro_custo TO anon;
GRANT ALL ON TABLE public.centro_custo TO authenticated;
GRANT ALL ON TABLE public.centro_custo TO service_role;


--
-- Name: SEQUENCE centro_custo_centro_custo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.centro_custo_centro_custo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.centro_custo_centro_custo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.centro_custo_centro_custo_id_seq TO service_role;


--
-- Name: TABLE cfop; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cfop TO anon;
GRANT ALL ON TABLE public.cfop TO authenticated;
GRANT ALL ON TABLE public.cfop TO service_role;


--
-- Name: SEQUENCE cfop_cfop_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cfop_cfop_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cfop_cfop_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cfop_cfop_id_seq TO service_role;


--
-- Name: TABLE chat_conversa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_conversa TO anon;
GRANT ALL ON TABLE public.chat_conversa TO authenticated;
GRANT ALL ON TABLE public.chat_conversa TO service_role;


--
-- Name: SEQUENCE chat_conversa_chat_conversa_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.chat_conversa_chat_conversa_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chat_conversa_chat_conversa_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_conversa_chat_conversa_id_seq TO service_role;


--
-- Name: TABLE chat_mensagem; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_mensagem TO anon;
GRANT ALL ON TABLE public.chat_mensagem TO authenticated;
GRANT ALL ON TABLE public.chat_mensagem TO service_role;


--
-- Name: SEQUENCE chat_mensagem_chat_mensagem_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.chat_mensagem_chat_mensagem_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chat_mensagem_chat_mensagem_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_mensagem_chat_mensagem_id_seq TO service_role;


--
-- Name: TABLE chat_sala; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_sala TO anon;
GRANT ALL ON TABLE public.chat_sala TO authenticated;
GRANT ALL ON TABLE public.chat_sala TO service_role;


--
-- Name: SEQUENCE chat_sala_chat_sala_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.chat_sala_chat_sala_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chat_sala_chat_sala_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_sala_chat_sala_id_seq TO service_role;


--
-- Name: TABLE chat_sala_membro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_sala_membro TO anon;
GRANT ALL ON TABLE public.chat_sala_membro TO authenticated;
GRANT ALL ON TABLE public.chat_sala_membro TO service_role;


--
-- Name: SEQUENCE chat_sala_membro_chat_sala_membro_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_sala_membro_chat_sala_membro_id_seq TO service_role;


--
-- Name: TABLE chat_sala_mensagem; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.chat_sala_mensagem TO anon;
GRANT ALL ON TABLE public.chat_sala_mensagem TO authenticated;
GRANT ALL ON TABLE public.chat_sala_mensagem TO service_role;


--
-- Name: SEQUENCE chat_sala_mensagem_chat_sala_mensagem_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq TO anon;
GRANT ALL ON SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.chat_sala_mensagem_chat_sala_mensagem_id_seq TO service_role;


--
-- Name: TABLE cidade; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cidade TO anon;
GRANT ALL ON TABLE public.cidade TO authenticated;
GRANT ALL ON TABLE public.cidade TO service_role;


--
-- Name: SEQUENCE cidade_cidade_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cidade_cidade_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cidade_cidade_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cidade_cidade_id_seq TO service_role;


--
-- Name: TABLE clas_trib; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.clas_trib TO anon;
GRANT ALL ON TABLE public.clas_trib TO authenticated;
GRANT ALL ON TABLE public.clas_trib TO service_role;


--
-- Name: TABLE cliente; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.cliente TO anon;
GRANT ALL ON TABLE public.cliente TO authenticated;
GRANT ALL ON TABLE public.cliente TO service_role;


--
-- Name: SEQUENCE cliente_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.cliente_id_seq TO anon;
GRANT ALL ON SEQUENCE public.cliente_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.cliente_id_seq TO service_role;


--
-- Name: TABLE comissao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.comissao TO anon;
GRANT ALL ON TABLE public.comissao TO authenticated;
GRANT ALL ON TABLE public.comissao TO service_role;


--
-- Name: SEQUENCE comissao_comissao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.comissao_comissao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.comissao_comissao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.comissao_comissao_id_seq TO service_role;


--
-- Name: TABLE condicao_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.condicao_pagamento TO anon;
GRANT ALL ON TABLE public.condicao_pagamento TO authenticated;
GRANT ALL ON TABLE public.condicao_pagamento TO service_role;


--
-- Name: SEQUENCE condicao_pagamento_condicao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.condicao_pagamento_condicao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.condicao_pagamento_condicao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.condicao_pagamento_condicao_id_seq TO service_role;


--
-- Name: TABLE conta; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.conta TO anon;
GRANT ALL ON TABLE public.conta TO authenticated;
GRANT ALL ON TABLE public.conta TO service_role;


--
-- Name: TABLE convenio; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.convenio TO anon;
GRANT ALL ON TABLE public.convenio TO authenticated;
GRANT ALL ON TABLE public.convenio TO service_role;


--
-- Name: TABLE corretora; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.corretora TO anon;
GRANT ALL ON TABLE public.corretora TO authenticated;
GRANT ALL ON TABLE public.corretora TO service_role;


--
-- Name: SEQUENCE corretora_corretora_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.corretora_corretora_id_seq TO anon;
GRANT ALL ON SEQUENCE public.corretora_corretora_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.corretora_corretora_id_seq TO service_role;


--
-- Name: TABLE depara; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.depara TO anon;
GRANT ALL ON TABLE public.depara TO authenticated;
GRANT ALL ON TABLE public.depara TO service_role;


--
-- Name: TABLE deposito; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.deposito TO anon;
GRANT ALL ON TABLE public.deposito TO authenticated;
GRANT ALL ON TABLE public.deposito TO service_role;


--
-- Name: SEQUENCE deposito_deposito_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.deposito_deposito_id_seq TO anon;
GRANT ALL ON SEQUENCE public.deposito_deposito_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.deposito_deposito_id_seq TO service_role;


--
-- Name: SEQUENCE emovimento_nr_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.emovimento_nr_seq TO anon;
GRANT ALL ON SEQUENCE public.emovimento_nr_seq TO authenticated;
GRANT ALL ON SEQUENCE public.emovimento_nr_seq TO service_role;


--
-- Name: TABLE emovimento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.emovimento TO anon;
GRANT ALL ON TABLE public.emovimento TO authenticated;
GRANT ALL ON TABLE public.emovimento TO service_role;


--
-- Name: SEQUENCE emovimento_emovimento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.emovimento_emovimento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.emovimento_emovimento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.emovimento_emovimento_id_seq TO service_role;


--
-- Name: TABLE emovimento_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.emovimento_item TO anon;
GRANT ALL ON TABLE public.emovimento_item TO authenticated;
GRANT ALL ON TABLE public.emovimento_item TO service_role;


--
-- Name: SEQUENCE emovimento_item_emovimento_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.emovimento_item_emovimento_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.emovimento_item_emovimento_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.emovimento_item_emovimento_item_id_seq TO service_role;


--
-- Name: TABLE emovimento_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.emovimento_pagamento TO anon;
GRANT ALL ON TABLE public.emovimento_pagamento TO authenticated;
GRANT ALL ON TABLE public.emovimento_pagamento TO service_role;


--
-- Name: SEQUENCE emovimento_pagamento_emovimento_pagamento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.emovimento_pagamento_emovimento_pagamento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.emovimento_pagamento_emovimento_pagamento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.emovimento_pagamento_emovimento_pagamento_id_seq TO service_role;


--
-- Name: TABLE empresa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresa TO anon;
GRANT ALL ON TABLE public.empresa TO authenticated;
GRANT ALL ON TABLE public.empresa TO service_role;


--
-- Name: SEQUENCE empresa_empresa_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.empresa_empresa_id_seq TO anon;
GRANT ALL ON SEQUENCE public.empresa_empresa_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.empresa_empresa_id_seq TO service_role;


--
-- Name: TABLE empresa_hs_lojavirtual; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresa_hs_lojavirtual TO anon;
GRANT ALL ON TABLE public.empresa_hs_lojavirtual TO authenticated;
GRANT ALL ON TABLE public.empresa_hs_lojavirtual TO service_role;


--
-- Name: TABLE empresa_usuario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.empresa_usuario TO anon;
GRANT ALL ON TABLE public.empresa_usuario TO authenticated;
GRANT ALL ON TABLE public.empresa_usuario TO service_role;


--
-- Name: SEQUENCE empresa_usuario_empresa_usuario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.empresa_usuario_empresa_usuario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.empresa_usuario_empresa_usuario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.empresa_usuario_empresa_usuario_id_seq TO service_role;


--
-- Name: TABLE estado; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.estado TO anon;
GRANT ALL ON TABLE public.estado TO authenticated;
GRANT ALL ON TABLE public.estado TO service_role;


--
-- Name: TABLE estoque; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.estoque TO anon;
GRANT ALL ON TABLE public.estoque TO authenticated;
GRANT ALL ON TABLE public.estoque TO service_role;


--
-- Name: SEQUENCE estoque_estoque_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.estoque_estoque_id_seq TO anon;
GRANT ALL ON SEQUENCE public.estoque_estoque_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.estoque_estoque_id_seq TO service_role;


--
-- Name: TABLE estoque_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.estoque_log TO anon;
GRANT ALL ON TABLE public.estoque_log TO authenticated;
GRANT ALL ON TABLE public.estoque_log TO service_role;


--
-- Name: SEQUENCE estoque_log_estoque_log_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.estoque_log_estoque_log_id_seq TO anon;
GRANT ALL ON SEQUENCE public.estoque_log_estoque_log_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.estoque_log_estoque_log_id_seq TO service_role;


--
-- Name: TABLE fator_conversao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fator_conversao TO anon;
GRANT ALL ON TABLE public.fator_conversao TO authenticated;
GRANT ALL ON TABLE public.fator_conversao TO service_role;


--
-- Name: SEQUENCE fator_conversao_fator_conversao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fator_conversao_fator_conversao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fator_conversao_fator_conversao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fator_conversao_fator_conversao_id_seq TO service_role;


--
-- Name: TABLE financeiro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financeiro TO anon;
GRANT ALL ON TABLE public.financeiro TO authenticated;
GRANT ALL ON TABLE public.financeiro TO service_role;


--
-- Name: TABLE financeiro_baixa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financeiro_baixa TO anon;
GRANT ALL ON TABLE public.financeiro_baixa TO authenticated;
GRANT ALL ON TABLE public.financeiro_baixa TO service_role;


--
-- Name: SEQUENCE financeiro_baixa_financeiro_baixa_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.financeiro_baixa_financeiro_baixa_id_seq TO anon;
GRANT ALL ON SEQUENCE public.financeiro_baixa_financeiro_baixa_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.financeiro_baixa_financeiro_baixa_id_seq TO service_role;


--
-- Name: SEQUENCE financeiro_financeiro_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.financeiro_financeiro_id_seq TO anon;
GRANT ALL ON SEQUENCE public.financeiro_financeiro_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.financeiro_financeiro_id_seq TO service_role;


--
-- Name: TABLE financeiro_view; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.financeiro_view TO anon;
GRANT ALL ON TABLE public.financeiro_view TO authenticated;
GRANT ALL ON TABLE public.financeiro_view TO service_role;


--
-- Name: TABLE fiscal_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_config TO anon;
GRANT ALL ON TABLE public.fiscal_config TO authenticated;
GRANT ALL ON TABLE public.fiscal_config TO service_role;


--
-- Name: TABLE fiscal_config_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_config_item TO anon;
GRANT ALL ON TABLE public.fiscal_config_item TO authenticated;
GRANT ALL ON TABLE public.fiscal_config_item TO service_role;


--
-- Name: TABLE fiscal_evento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_evento TO anon;
GRANT ALL ON TABLE public.fiscal_evento TO authenticated;
GRANT ALL ON TABLE public.fiscal_evento TO service_role;


--
-- Name: SEQUENCE fiscal_evento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_evento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_evento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_evento_id_seq TO service_role;


--
-- Name: TABLE fiscal_grupo_produto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_grupo_produto TO anon;
GRANT ALL ON TABLE public.fiscal_grupo_produto TO authenticated;
GRANT ALL ON TABLE public.fiscal_grupo_produto TO service_role;


--
-- Name: SEQUENCE fiscal_grupo_produto_fiscal_grupo_produto_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_grupo_produto_fiscal_grupo_produto_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_grupo_produto_fiscal_grupo_produto_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_grupo_produto_fiscal_grupo_produto_id_seq TO service_role;


--
-- Name: TABLE fiscal_mdf_carrega; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_carrega TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_carrega TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_carrega TO service_role;


--
-- Name: TABLE fiscal_mdf_componente; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_componente TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_componente TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_componente TO service_role;


--
-- Name: TABLE fiscal_mdf_condutor; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_condutor TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_condutor TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_condutor TO service_role;


--
-- Name: TABLE fiscal_mdf_descarrega; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_descarrega TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_descarrega TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_descarrega TO service_role;


--
-- Name: TABLE fiscal_mdf_documento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_documento TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_documento TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_documento TO service_role;


--
-- Name: TABLE fiscal_mdf_historicoxml; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_historicoxml TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_historicoxml TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_historicoxml TO service_role;


--
-- Name: TABLE fiscal_mdf_manifesto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_manifesto TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_manifesto TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_manifesto TO service_role;


--
-- Name: TABLE fiscal_mdf_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_pagamento TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_pagamento TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_pagamento TO service_role;


--
-- Name: TABLE fiscal_mdf_pagtos; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_pagtos TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_pagtos TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_pagtos TO service_role;


--
-- Name: TABLE fiscal_mdf_percurso; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_percurso TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_percurso TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_percurso TO service_role;


--
-- Name: TABLE fiscal_mdf_veiculo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_mdf_veiculo TO anon;
GRANT ALL ON TABLE public.fiscal_mdf_veiculo TO authenticated;
GRANT ALL ON TABLE public.fiscal_mdf_veiculo TO service_role;


--
-- Name: TABLE fiscal_nfe_cabecalho; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_cabecalho TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_cabecalho TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_cabecalho TO service_role;


--
-- Name: TABLE fiscal_nfe_cce; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_cce TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_cce TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_cce TO service_role;


--
-- Name: SEQUENCE fiscal_nfe_cce_nfe_cce_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_nfe_cce_nfe_cce_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_nfe_cce_nfe_cce_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_nfe_cce_nfe_cce_id_seq TO service_role;


--
-- Name: TABLE fiscal_nfe_inutilizacao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_inutilizacao TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_inutilizacao TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_inutilizacao TO service_role;


--
-- Name: SEQUENCE fiscal_nfe_inutilizacao_inutilizacao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_nfe_inutilizacao_inutilizacao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_nfe_inutilizacao_inutilizacao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_nfe_inutilizacao_inutilizacao_id_seq TO service_role;


--
-- Name: TABLE fiscal_nfe_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_item TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_item TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_item TO service_role;


--
-- Name: TABLE fiscal_nfe_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_pagamento TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_pagamento TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_pagamento TO service_role;


--
-- Name: SEQUENCE fiscal_nfe_pagamento_nfe_pagamento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_nfe_pagamento_nfe_pagamento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_nfe_pagamento_nfe_pagamento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_nfe_pagamento_nfe_pagamento_id_seq TO service_role;


--
-- Name: TABLE fiscal_nfe_recebida; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_recebida TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_recebida TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_recebida TO service_role;


--
-- Name: TABLE fiscal_nfe_referenciada; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_nfe_referenciada TO anon;
GRANT ALL ON TABLE public.fiscal_nfe_referenciada TO authenticated;
GRANT ALL ON TABLE public.fiscal_nfe_referenciada TO service_role;


--
-- Name: SEQUENCE fiscal_nfe_referenciada_nfe_referenciada_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_nfe_referenciada_nfe_referenciada_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_nfe_referenciada_nfe_referenciada_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_nfe_referenciada_nfe_referenciada_id_seq TO service_role;


--
-- Name: TABLE fiscal_regra; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_regra TO anon;
GRANT ALL ON TABLE public.fiscal_regra TO authenticated;
GRANT ALL ON TABLE public.fiscal_regra TO service_role;


--
-- Name: TABLE fiscal_regra_cfop; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_regra_cfop TO anon;
GRANT ALL ON TABLE public.fiscal_regra_cfop TO authenticated;
GRANT ALL ON TABLE public.fiscal_regra_cfop TO service_role;


--
-- Name: SEQUENCE fiscal_regra_cfop_fiscal_regra_cfop_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_regra_cfop_fiscal_regra_cfop_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_regra_cfop_fiscal_regra_cfop_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_regra_cfop_fiscal_regra_cfop_id_seq TO service_role;


--
-- Name: SEQUENCE fiscal_regra_fiscal_regra_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_regra_fiscal_regra_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_regra_fiscal_regra_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_regra_fiscal_regra_id_seq TO service_role;


--
-- Name: TABLE fiscal_regra_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.fiscal_regra_item TO anon;
GRANT ALL ON TABLE public.fiscal_regra_item TO authenticated;
GRANT ALL ON TABLE public.fiscal_regra_item TO service_role;


--
-- Name: SEQUENCE fiscal_regra_item_fiscal_regra_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.fiscal_regra_item_fiscal_regra_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fiscal_regra_item_fiscal_regra_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fiscal_regra_item_fiscal_regra_item_id_seq TO service_role;


--
-- Name: TABLE funcionario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.funcionario TO anon;
GRANT ALL ON TABLE public.funcionario TO authenticated;
GRANT ALL ON TABLE public.funcionario TO service_role;


--
-- Name: SEQUENCE funcionario_funcionario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.funcionario_funcionario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.funcionario_funcionario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.funcionario_funcionario_id_seq TO service_role;


--
-- Name: TABLE galpao_ambiencia; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.galpao_ambiencia TO anon;
GRANT ALL ON TABLE public.galpao_ambiencia TO authenticated;
GRANT ALL ON TABLE public.galpao_ambiencia TO service_role;


--
-- Name: SEQUENCE galpao_ambiencia_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.galpao_ambiencia_id_seq TO anon;
GRANT ALL ON SEQUENCE public.galpao_ambiencia_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.galpao_ambiencia_id_seq TO service_role;


--
-- Name: TABLE grupo_icms_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.grupo_icms_item TO anon;
GRANT ALL ON TABLE public.grupo_icms_item TO authenticated;
GRANT ALL ON TABLE public.grupo_icms_item TO service_role;


--
-- Name: TABLE linha_produto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.linha_produto TO anon;
GRANT ALL ON TABLE public.linha_produto TO authenticated;
GRANT ALL ON TABLE public.linha_produto TO service_role;


--
-- Name: SEQUENCE linha_produto_linha_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.linha_produto_linha_id_seq TO anon;
GRANT ALL ON SEQUENCE public.linha_produto_linha_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.linha_produto_linha_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_carrega_mdf_carrega_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_carrega_mdf_carrega_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_carrega_mdf_carrega_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_carrega_mdf_carrega_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_componente_mdf_componente_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_componente_mdf_componente_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_componente_mdf_componente_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_componente_mdf_componente_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_descarrega_mdf_descarrega_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_descarrega_mdf_descarrega_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_descarrega_mdf_descarrega_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_descarrega_mdf_descarrega_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_documento_mdf_documento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_documento_mdf_documento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_documento_mdf_documento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_documento_mdf_documento_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_historicoxml_mdf_historicoxml_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_historicoxml_mdf_historicoxml_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_historicoxml_mdf_historicoxml_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_historicoxml_mdf_historicoxml_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_manifesto_mdf_manifesto_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_manifesto_mdf_manifesto_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_manifesto_mdf_manifesto_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_manifesto_mdf_manifesto_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_motorista_mdf_motorista_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_motorista_mdf_motorista_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_motorista_mdf_motorista_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_motorista_mdf_motorista_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_pagamento_mdf_pagamento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_pagamento_mdf_pagamento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_pagamento_mdf_pagamento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_pagamento_mdf_pagamento_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_pagtos_mdf_pagtos_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_pagtos_mdf_pagtos_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_pagtos_mdf_pagtos_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_pagtos_mdf_pagtos_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_percurso_mdf_percurso_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_percurso_mdf_percurso_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_percurso_mdf_percurso_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_percurso_mdf_percurso_id_seq TO service_role;


--
-- Name: SEQUENCE mdf_veiculo_mdf_veiculo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.mdf_veiculo_mdf_veiculo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.mdf_veiculo_mdf_veiculo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.mdf_veiculo_mdf_veiculo_id_seq TO service_role;


--
-- Name: TABLE meio_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.meio_pagamento TO anon;
GRANT ALL ON TABLE public.meio_pagamento TO authenticated;
GRANT ALL ON TABLE public.meio_pagamento TO service_role;


--
-- Name: SEQUENCE meios_pagamento_meios_pagamento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.meios_pagamento_meios_pagamento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.meios_pagamento_meios_pagamento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.meios_pagamento_meios_pagamento_id_seq TO service_role;


--
-- Name: SEQUENCE movimento_nr_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.movimento_nr_seq TO anon;
GRANT ALL ON SEQUENCE public.movimento_nr_seq TO authenticated;
GRANT ALL ON SEQUENCE public.movimento_nr_seq TO service_role;


--
-- Name: TABLE movimento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.movimento TO anon;
GRANT ALL ON TABLE public.movimento TO authenticated;
GRANT ALL ON TABLE public.movimento TO service_role;


--
-- Name: TABLE movimento_item; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.movimento_item TO anon;
GRANT ALL ON TABLE public.movimento_item TO authenticated;
GRANT ALL ON TABLE public.movimento_item TO service_role;


--
-- Name: SEQUENCE movimento_item_movimento_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.movimento_item_movimento_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.movimento_item_movimento_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.movimento_item_movimento_item_id_seq TO service_role;


--
-- Name: SEQUENCE movimento_movimento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.movimento_movimento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.movimento_movimento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.movimento_movimento_id_seq TO service_role;


--
-- Name: TABLE movimento_pagamento; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.movimento_pagamento TO anon;
GRANT ALL ON TABLE public.movimento_pagamento TO authenticated;
GRANT ALL ON TABLE public.movimento_pagamento TO service_role;


--
-- Name: SEQUENCE movimento_pagamento_movimento_pagamento_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.movimento_pagamento_movimento_pagamento_id_seq TO anon;
GRANT ALL ON SEQUENCE public.movimento_pagamento_movimento_pagamento_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.movimento_pagamento_movimento_pagamento_id_seq TO service_role;


--
-- Name: SEQUENCE nfe_cabecalho_nfe_cabecalho_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.nfe_cabecalho_nfe_cabecalho_id_seq TO anon;
GRANT ALL ON SEQUENCE public.nfe_cabecalho_nfe_cabecalho_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.nfe_cabecalho_nfe_cabecalho_id_seq TO service_role;


--
-- Name: SEQUENCE nfe_item_nfe_item_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.nfe_item_nfe_item_id_seq TO anon;
GRANT ALL ON SEQUENCE public.nfe_item_nfe_item_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.nfe_item_nfe_item_id_seq TO service_role;


--
-- Name: SEQUENCE nfe_recebida_nfe_recebida_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.nfe_recebida_nfe_recebida_id_seq TO anon;
GRANT ALL ON SEQUENCE public.nfe_recebida_nfe_recebida_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.nfe_recebida_nfe_recebida_id_seq TO service_role;


--
-- Name: TABLE operadora; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.operadora TO anon;
GRANT ALL ON TABLE public.operadora TO authenticated;
GRANT ALL ON TABLE public.operadora TO service_role;


--
-- Name: SEQUENCE operadora_operadora_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.operadora_operadora_id_seq TO anon;
GRANT ALL ON SEQUENCE public.operadora_operadora_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.operadora_operadora_id_seq TO service_role;


--
-- Name: TABLE parametro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.parametro TO anon;
GRANT ALL ON TABLE public.parametro TO authenticated;
GRANT ALL ON TABLE public.parametro TO service_role;


--
-- Name: TABLE parametro_horario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.parametro_horario TO anon;
GRANT ALL ON TABLE public.parametro_horario TO authenticated;
GRANT ALL ON TABLE public.parametro_horario TO service_role;


--
-- Name: SEQUENCE parametro_horario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.parametro_horario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.parametro_horario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.parametro_horario_id_seq TO service_role;


--
-- Name: SEQUENCE parametro_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.parametro_id_seq TO anon;
GRANT ALL ON SEQUENCE public.parametro_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.parametro_id_seq TO service_role;


--
-- Name: SEQUENCE pedido_nr_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.pedido_nr_seq TO anon;
GRANT ALL ON SEQUENCE public.pedido_nr_seq TO authenticated;
GRANT ALL ON SEQUENCE public.pedido_nr_seq TO service_role;


--
-- Name: TABLE perfil; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil TO anon;
GRANT ALL ON TABLE public.perfil TO authenticated;
GRANT ALL ON TABLE public.perfil TO service_role;


--
-- Name: TABLE perfil_acesso_botao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_acesso_botao TO anon;
GRANT ALL ON TABLE public.perfil_acesso_botao TO authenticated;
GRANT ALL ON TABLE public.perfil_acesso_botao TO service_role;


--
-- Name: SEQUENCE perfil_acesso_botao_perfil_acesso_botao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_acesso_botao_perfil_acesso_botao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_acesso_botao_perfil_acesso_botao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_acesso_botao_perfil_acesso_botao_id_seq TO service_role;


--
-- Name: TABLE perfil_acesso_campo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_acesso_campo TO anon;
GRANT ALL ON TABLE public.perfil_acesso_campo TO authenticated;
GRANT ALL ON TABLE public.perfil_acesso_campo TO service_role;


--
-- Name: SEQUENCE perfil_acesso_campo_perfil_acesso_campo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_acesso_campo_perfil_acesso_campo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_acesso_campo_perfil_acesso_campo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_acesso_campo_perfil_acesso_campo_id_seq TO service_role;


--
-- Name: TABLE perfil_acesso_formulario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_acesso_formulario TO anon;
GRANT ALL ON TABLE public.perfil_acesso_formulario TO authenticated;
GRANT ALL ON TABLE public.perfil_acesso_formulario TO service_role;


--
-- Name: SEQUENCE perfil_acesso_formulario_perfil_acesso_formulario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_acesso_formulario_perfil_acesso_formulario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_acesso_formulario_perfil_acesso_formulario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_acesso_formulario_perfil_acesso_formulario_id_seq TO service_role;


--
-- Name: TABLE perfil_acesso_menu; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_acesso_menu TO anon;
GRANT ALL ON TABLE public.perfil_acesso_menu TO authenticated;
GRANT ALL ON TABLE public.perfil_acesso_menu TO service_role;


--
-- Name: SEQUENCE perfil_acesso_menu_perfil_acesso_menu_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_acesso_menu_perfil_acesso_menu_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_acesso_menu_perfil_acesso_menu_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_acesso_menu_perfil_acesso_menu_id_seq TO service_role;


--
-- Name: TABLE perfil_horario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_horario TO anon;
GRANT ALL ON TABLE public.perfil_horario TO authenticated;
GRANT ALL ON TABLE public.perfil_horario TO service_role;


--
-- Name: SEQUENCE perfil_horario_perfil_horario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_horario_perfil_horario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_horario_perfil_horario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_horario_perfil_horario_id_seq TO service_role;


--
-- Name: SEQUENCE perfil_perfil_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_perfil_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_perfil_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_perfil_id_seq TO service_role;


--
-- Name: TABLE perfil_usuario; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.perfil_usuario TO anon;
GRANT ALL ON TABLE public.perfil_usuario TO authenticated;
GRANT ALL ON TABLE public.perfil_usuario TO service_role;


--
-- Name: SEQUENCE perfil_usuario_perfil_usuario_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.perfil_usuario_perfil_usuario_id_seq TO anon;
GRANT ALL ON SEQUENCE public.perfil_usuario_perfil_usuario_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.perfil_usuario_perfil_usuario_id_seq TO service_role;


--
-- Name: TABLE plano; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plano TO anon;
GRANT ALL ON TABLE public.plano TO authenticated;
GRANT ALL ON TABLE public.plano TO service_role;


--
-- Name: TABLE plano_conta; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.plano_conta TO anon;
GRANT ALL ON TABLE public.plano_conta TO authenticated;
GRANT ALL ON TABLE public.plano_conta TO service_role;


--
-- Name: SEQUENCE plano_conta_plano_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.plano_conta_plano_id_seq TO anon;
GRANT ALL ON SEQUENCE public.plano_conta_plano_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.plano_conta_plano_id_seq TO service_role;


--
-- Name: TABLE portador; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.portador TO anon;
GRANT ALL ON TABLE public.portador TO authenticated;
GRANT ALL ON TABLE public.portador TO service_role;


--
-- Name: SEQUENCE portador_portador_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.portador_portador_id_seq TO anon;
GRANT ALL ON SEQUENCE public.portador_portador_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.portador_portador_id_seq TO service_role;


--
-- Name: TABLE produto; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto TO anon;
GRANT ALL ON TABLE public.produto TO authenticated;
GRANT ALL ON TABLE public.produto TO service_role;


--
-- Name: TABLE produto_codbarra; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto_codbarra TO anon;
GRANT ALL ON TABLE public.produto_codbarra TO authenticated;
GRANT ALL ON TABLE public.produto_codbarra TO service_role;


--
-- Name: SEQUENCE produto_codbarra_produto_codbarra_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_codbarra_produto_codbarra_id_seq TO anon;
GRANT ALL ON SEQUENCE public.produto_codbarra_produto_codbarra_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_codbarra_produto_codbarra_id_seq TO service_role;


--
-- Name: TABLE produto_conversao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto_conversao TO anon;
GRANT ALL ON TABLE public.produto_conversao TO authenticated;
GRANT ALL ON TABLE public.produto_conversao TO service_role;


--
-- Name: SEQUENCE produto_conversao_conversao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_conversao_conversao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.produto_conversao_conversao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_conversao_conversao_id_seq TO service_role;


--
-- Name: TABLE produto_fornecedor; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto_fornecedor TO anon;
GRANT ALL ON TABLE public.produto_fornecedor TO authenticated;
GRANT ALL ON TABLE public.produto_fornecedor TO service_role;


--
-- Name: SEQUENCE produto_fornecedor_produto_fornecedor_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq TO anon;
GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq TO service_role;


--
-- Name: SEQUENCE produto_fornecedor_produto_fornecedor_id_seq1; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq1 TO anon;
GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq1 TO authenticated;
GRANT ALL ON SEQUENCE public.produto_fornecedor_produto_fornecedor_id_seq1 TO service_role;


--
-- Name: TABLE produto_grupo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto_grupo TO anon;
GRANT ALL ON TABLE public.produto_grupo TO authenticated;
GRANT ALL ON TABLE public.produto_grupo TO service_role;


--
-- Name: SEQUENCE produto_grupo_grupo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_grupo_grupo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.produto_grupo_grupo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_grupo_grupo_id_seq TO service_role;


--
-- Name: SEQUENCE produto_produto_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.produto_produto_id_seq TO anon;
GRANT ALL ON SEQUENCE public.produto_produto_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.produto_produto_id_seq TO service_role;


--
-- Name: TABLE produto_subgrupo; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.produto_subgrupo TO anon;
GRANT ALL ON TABLE public.produto_subgrupo TO authenticated;
GRANT ALL ON TABLE public.produto_subgrupo TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE rb_conexao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rb_conexao TO anon;
GRANT ALL ON TABLE public.rb_conexao TO authenticated;
GRANT ALL ON TABLE public.rb_conexao TO service_role;


--
-- Name: SEQUENCE rb_conexao_rb_conexao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rb_conexao_rb_conexao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rb_conexao_rb_conexao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rb_conexao_rb_conexao_id_seq TO service_role;


--
-- Name: TABLE rb_relatorio; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rb_relatorio TO anon;
GRANT ALL ON TABLE public.rb_relatorio TO authenticated;
GRANT ALL ON TABLE public.rb_relatorio TO service_role;


--
-- Name: SEQUENCE rb_relatorio_rb_relatorio_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rb_relatorio_rb_relatorio_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rb_relatorio_rb_relatorio_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rb_relatorio_rb_relatorio_id_seq TO service_role;


--
-- Name: TABLE rb_relatorio_variavel; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rb_relatorio_variavel TO anon;
GRANT ALL ON TABLE public.rb_relatorio_variavel TO authenticated;
GRANT ALL ON TABLE public.rb_relatorio_variavel TO service_role;


--
-- Name: SEQUENCE rb_relatorio_variavel_rb_relatorio_variavel_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rb_relatorio_variavel_rb_relatorio_variavel_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rb_relatorio_variavel_rb_relatorio_variavel_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rb_relatorio_variavel_rb_relatorio_variavel_id_seq TO service_role;


--
-- Name: TABLE rb_templatepesquisa; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rb_templatepesquisa TO anon;
GRANT ALL ON TABLE public.rb_templatepesquisa TO authenticated;
GRANT ALL ON TABLE public.rb_templatepesquisa TO service_role;


--
-- Name: SEQUENCE rb_templatepesquisa_rb_templatepesquisa_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rb_templatepesquisa_rb_templatepesquisa_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rb_templatepesquisa_rb_templatepesquisa_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rb_templatepesquisa_rb_templatepesquisa_id_seq TO service_role;


--
-- Name: TABLE rpb_conexao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rpb_conexao TO anon;
GRANT ALL ON TABLE public.rpb_conexao TO authenticated;
GRANT ALL ON TABLE public.rpb_conexao TO service_role;


--
-- Name: SEQUENCE rpb_conexao_rpb_conexao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rpb_conexao_rpb_conexao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rpb_conexao_rpb_conexao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rpb_conexao_rpb_conexao_id_seq TO service_role;


--
-- Name: TABLE rpb_filtro; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rpb_filtro TO anon;
GRANT ALL ON TABLE public.rpb_filtro TO authenticated;
GRANT ALL ON TABLE public.rpb_filtro TO service_role;


--
-- Name: SEQUENCE rpb_filtro_rpb_filtro_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rpb_filtro_rpb_filtro_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rpb_filtro_rpb_filtro_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rpb_filtro_rpb_filtro_id_seq TO service_role;


--
-- Name: TABLE rpb_relatorio; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.rpb_relatorio TO anon;
GRANT ALL ON TABLE public.rpb_relatorio TO authenticated;
GRANT ALL ON TABLE public.rpb_relatorio TO service_role;


--
-- Name: SEQUENCE rpb_relatorio_rpb_relatorio_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.rpb_relatorio_rpb_relatorio_id_seq TO anon;
GRANT ALL ON SEQUENCE public.rpb_relatorio_rpb_relatorio_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.rpb_relatorio_rpb_relatorio_id_seq TO service_role;


--
-- Name: SEQUENCE sequenciais_sequencia_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.sequenciais_sequencia_id_seq TO anon;
GRANT ALL ON SEQUENCE public.sequenciais_sequencia_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.sequenciais_sequencia_id_seq TO service_role;


--
-- Name: TABLE sistema_versoes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sistema_versoes TO anon;
GRANT ALL ON TABLE public.sistema_versoes TO authenticated;
GRANT ALL ON TABLE public.sistema_versoes TO service_role;


--
-- Name: SEQUENCE subgrupo_produto_subgrupo_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.subgrupo_produto_subgrupo_id_seq TO anon;
GRANT ALL ON SEQUENCE public.subgrupo_produto_subgrupo_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.subgrupo_produto_subgrupo_id_seq TO service_role;


--
-- Name: TABLE sys_backup_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sys_backup_log TO anon;
GRANT ALL ON TABLE public.sys_backup_log TO authenticated;
GRANT ALL ON TABLE public.sys_backup_log TO service_role;


--
-- Name: TABLE sys_config; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sys_config TO anon;
GRANT ALL ON TABLE public.sys_config TO authenticated;
GRANT ALL ON TABLE public.sys_config TO service_role;


--
-- Name: TABLE sys_sequencial; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sys_sequencial TO anon;
GRANT ALL ON TABLE public.sys_sequencial TO authenticated;
GRANT ALL ON TABLE public.sys_sequencial TO service_role;


--
-- Name: TABLE tp_operacao; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tp_operacao TO anon;
GRANT ALL ON TABLE public.tp_operacao TO authenticated;
GRANT ALL ON TABLE public.tp_operacao TO service_role;


--
-- Name: SEQUENCE tp_operacao_tp_operacao_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.tp_operacao_tp_operacao_id_seq TO anon;
GRANT ALL ON SEQUENCE public.tp_operacao_tp_operacao_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.tp_operacao_tp_operacao_id_seq TO service_role;


--
-- Name: TABLE unidade; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.unidade TO anon;
GRANT ALL ON TABLE public.unidade TO authenticated;
GRANT ALL ON TABLE public.unidade TO service_role;


--
-- Name: TABLE usuario_atalho; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.usuario_atalho TO anon;
GRANT ALL ON TABLE public.usuario_atalho TO authenticated;
GRANT ALL ON TABLE public.usuario_atalho TO service_role;


--
-- Name: SEQUENCE usuario_atalho_usuario_atalho_id_seq; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE public.usuario_atalho_usuario_atalho_id_seq TO anon;
GRANT ALL ON SEQUENCE public.usuario_atalho_usuario_atalho_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.usuario_atalho_usuario_atalho_id_seq TO service_role;


--
-- Name: TABLE vw_pedidos_caixa_union; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vw_pedidos_caixa_union TO anon;
GRANT ALL ON TABLE public.vw_pedidos_caixa_union TO authenticated;
GRANT ALL ON TABLE public.vw_pedidos_caixa_union TO service_role;


--
-- Name: TABLE vw_produtos_disponiveis; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.vw_produtos_disponiveis TO anon;
GRANT ALL ON TABLE public.vw_produtos_disponiveis TO authenticated;
GRANT ALL ON TABLE public.vw_produtos_disponiveis TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON FUNCTIONS TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: auth; Owner: supabase_auth_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL ON TABLES TO dashboard_user;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict 9ugcxAf2nVolfEDCadyrcCIMwUaith8a8zBaWJ2NevjLSmecXvJaJnMioRw11c0

