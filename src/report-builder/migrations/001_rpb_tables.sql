-- ============================================================
-- Report Builder Pro — Tabelas (prefixo rpb_)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Conexões externas (SQL Server / APIs externas)
CREATE TABLE public.rpb_conexao (
  rpb_conexao_id  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id      BIGINT NOT NULL,
  nome            TEXT NOT NULL,
  url             TEXT NOT NULL DEFAULT '',
  api_key         TEXT NOT NULL DEFAULT '',
  descricao       TEXT NOT NULL DEFAULT '',
  excluido        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rpb_conexao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpb_conexao_all" ON public.rpb_conexao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Relatório (definição completa em layout_json)
CREATE TABLE public.rpb_relatorio (
  rpb_relatorio_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id       BIGINT NOT NULL,
  nome             TEXT NOT NULL,
  descricao        TEXT NOT NULL DEFAULT '',
  categoria        TEXT NOT NULL DEFAULT '',
  nm_form          TEXT NOT NULL DEFAULT '',    -- Nome do formulário vinculado (ex: PedidoForm)
  query_sql        TEXT NOT NULL DEFAULT '',
  rpb_conexao_id   BIGINT REFERENCES public.rpb_conexao(rpb_conexao_id),
  layout_json      JSONB,       -- IRpbLayout serializado
  excluido         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IX_rpb_relatorio_empresa ON public.rpb_relatorio (empresa_id);
ALTER TABLE public.rpb_relatorio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpb_relatorio_all" ON public.rpb_relatorio FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Filtros parametrizados por relatório
CREATE TABLE public.rpb_filtro (
  rpb_filtro_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rpb_relatorio_id    BIGINT NOT NULL REFERENCES public.rpb_relatorio(rpb_relatorio_id) ON DELETE CASCADE,
  empresa_id          BIGINT NOT NULL,
  nome                TEXT NOT NULL,   -- {{variavel}} na query
  label               TEXT NOT NULL,   -- rótulo exibido ao usuário
  tipo                TEXT NOT NULL DEFAULT 'text'
                        CHECK (tipo IN ('text','date','date_range','number','select','boolean','query_select')),
  obrigatorio         BOOLEAN NOT NULL DEFAULT FALSE,
  valor_padrao        TEXT NOT NULL DEFAULT '',
  opcoes_fixas        TEXT NOT NULL DEFAULT '',    -- "Ativo|Inativo|Todos" (para tipo=select)
  query_opcoes        TEXT NOT NULL DEFAULT '',    -- SELECT para tipo=query_select
  ordem               INTEGER NOT NULL DEFAULT 0,
  excluido            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IX_rpb_filtro_relatorio ON public.rpb_filtro (rpb_relatorio_id);
ALTER TABLE public.rpb_filtro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rpb_filtro_all" ON public.rpb_filtro FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger para updated_at (reusa função existente ou cria)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fu_update_updated_at') THEN
    CREATE FUNCTION public.fu_update_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $fn$;
  END IF;
END$$;

CREATE TRIGGER TR_rpb_relatorio_UPD BEFORE UPDATE ON public.rpb_relatorio
  FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();
CREATE TRIGGER TR_rpb_conexao_UPD BEFORE UPDATE ON public.rpb_conexao
  FOR EACH ROW EXECUTE FUNCTION public.fu_update_updated_at();

-- ============================================================
-- RPC: Execução dinâmica de SQL para o Report Builder Pro
-- ⚠️  SECURITY DEFINER — use apenas em ambiente interno/ERP
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpb_execute_query(p_sql TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_safe   TEXT;
BEGIN
  -- Bloqueia comandos de escrita (proteção básica)
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

-- Permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.rpb_execute_query(TEXT) TO authenticated;

