
-- ================================================
-- MDF-e: MANIFESTO ELETRÔNICO DE DOCUMENTOS FISCAIS
-- Prefixo: MDF_
-- ================================================

-- ================================================
-- TABELA MDF_CABECALHO (Cabeçalho do MDF-e)
-- ================================================
CREATE TABLE public.MDF_CABECALHO (
  MDF_CABECALHO_ID      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  EMPRESA_ID            BIGINT NOT NULL,

  -- Identificação
  NR_MDF                TEXT    NOT NULL DEFAULT '',   -- Número do MDF-e
  SERIE                 TEXT    NOT NULL DEFAULT '1',  -- Série
  DT_EMISSAO            DATE    NOT NULL,              -- Data de emissão
  DT_INI_VIAGEM         DATE    NOT NULL,              -- Início da viagem
  DT_FIM_VIAGEM         DATE,                          -- Fim da viagem (preenchido após encerramento)

  -- Emitente / Transportador
  CNPJ_EMIT             TEXT    NOT NULL DEFAULT '',   -- CNPJ emitente (empresa)
  IE_EMIT               TEXT    NOT NULL DEFAULT '',   -- IE emitente

  -- Percurso
  UF_INI                TEXT    NOT NULL DEFAULT '',   -- UF carregamento
  UF_FIM                TEXT    NOT NULL DEFAULT '',   -- UF descarregamento final
  CIDADES_PERCURSO      TEXT    NOT NULL DEFAULT '',   -- Lista cidades intermediárias separadas por ;

  -- Veículo tração
  PLACA_VEICULO         TEXT    NOT NULL DEFAULT '',
  RNTRC_VEICULO         TEXT    NOT NULL DEFAULT '',
  UF_VEICULO            TEXT    NOT NULL DEFAULT '',
  TARA_VEICULO          NUMERIC(12,2) NOT NULL DEFAULT 0,
  CAP_KG_VEICULO        NUMERIC(12,2) NOT NULL DEFAULT 0,
  CAP_M3_VEICULO        NUMERIC(12,2) NOT NULL DEFAULT 0,
  TP_RODADO             TEXT    NOT NULL DEFAULT '',   -- 01=Truck, 02=Toco, etc.
  TP_CARROCERIA         TEXT    NOT NULL DEFAULT '',   -- 00=Não aplicável, 01=Aberta, etc.

  -- Condutor principal
  CONDUTOR_NOME         TEXT    NOT NULL DEFAULT '',
  CONDUTOR_CPF          TEXT    NOT NULL DEFAULT '',

  -- Totais carregamento
  QT_NF                 INTEGER NOT NULL DEFAULT 0,    -- Qtd de NF-e vinculadas
  VL_CARGA              NUMERIC(15,2) NOT NULL DEFAULT 0,
  KG_CARGA              NUMERIC(12,4) NOT NULL DEFAULT 0,
  UNID_MEDIDA_CARGA     TEXT    NOT NULL DEFAULT 'KG',

  -- CIOT (opcional)
  CIOT                  TEXT,
  CNPJ_CIOT             TEXT,

  -- Seguro (opcional)
  SEGURADORA_NOME       TEXT,
  SEGURADORA_CNPJ       TEXT,
  NR_APOLICE            TEXT,
  NR_AVERBACAO          TEXT,

  -- Status e autorização
  ST_MDF                TEXT    NOT NULL DEFAULT 'A'
                          CHECK (ST_MDF IN ('A','E','C','X')),
                          -- A=Aberto/Pendente  E=Encerrado  C=Cancelado  X=Autorizado

  -- Dados da autorização (preenchidos pelo retorno do ACBr)
  CHAVE_MDF             TEXT    NOT NULL DEFAULT '',
  NR_PROTOCOLO          TEXT    NOT NULL DEFAULT '',
  DT_AUTORIZACAO        TIMESTAMPTZ,
  XML_AUTORIZADO        TEXT,
  XML_ENCERRAMENTO      TEXT,
  OBS_MDF               TEXT    NOT NULL DEFAULT '',

  EXCLUIDO              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IX_MDF_CABECALHO_EMPRESA    ON public.MDF_CABECALHO (EMPRESA_ID);
CREATE INDEX IX_MDF_CABECALHO_DT_EMISSAO ON public.MDF_CABECALHO (DT_EMISSAO);
CREATE INDEX IX_MDF_CABECALHO_ST         ON public.MDF_CABECALHO (ST_MDF);
CREATE UNIQUE INDEX IU_MDF_CHAVE ON public.MDF_CABECALHO (CHAVE_MDF)
  WHERE CHAVE_MDF <> '' AND EXCLUIDO = FALSE;

ALTER TABLE public.MDF_CABECALHO ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_mdf_cabecalho"
  ON public.MDF_CABECALHO FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_mdf_cabecalho"
  ON public.MDF_CABECALHO FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_mdf_cabecalho"
  ON public.MDF_CABECALHO FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_mdf_cabecalho"
  ON public.MDF_CABECALHO FOR DELETE TO authenticated USING (true);

CREATE TRIGGER TR_MDF_CABECALHO_UPDATED_AT
  BEFORE UPDATE ON public.MDF_CABECALHO
  FOR EACH ROW EXECUTE FUNCTION public.FU_UPDATE_UPDATED_AT();

-- ================================================
-- TABELA MDF_NF (NF-e vinculadas ao MDF-e)
-- ================================================
CREATE TABLE public.MDF_NF (
  MDF_NF_ID             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  MDF_CABECALHO_ID      BIGINT NOT NULL REFERENCES public.MDF_CABECALHO(MDF_CABECALHO_ID) ON DELETE CASCADE,
  EMPRESA_ID            BIGINT NOT NULL,

  -- Identificação do documento
  TP_DOC                TEXT    NOT NULL DEFAULT 'NFE'
                          CHECK (TP_DOC IN ('NFE','NFCE','CTE')),
  CHAVE_DOC             TEXT    NOT NULL DEFAULT '',   -- Chave de acesso 44 dígitos
  NR_NOTA               TEXT    NOT NULL DEFAULT '',
  SERIE                 TEXT    NOT NULL DEFAULT '',
  CNPJ_EMIT_DOC         TEXT    NOT NULL DEFAULT '',
  VL_DOC                NUMERIC(15,2) NOT NULL DEFAULT 0,
  KG_DOC                NUMERIC(12,4) NOT NULL DEFAULT 0,

  -- Cidade de descarregamento deste documento
  CIDADE_DESCARREG      TEXT    NOT NULL DEFAULT '',
  ESTADO_DESCARREG      TEXT    NOT NULL DEFAULT '',

  EXCLUIDO              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IX_MDF_NF_CABECALHO ON public.MDF_NF (MDF_CABECALHO_ID);
CREATE INDEX IX_MDF_NF_CHAVE     ON public.MDF_NF (CHAVE_DOC);

ALTER TABLE public.MDF_NF ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_mdf_nf"
  ON public.MDF_NF FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_mdf_nf"
  ON public.MDF_NF FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_mdf_nf"
  ON public.MDF_NF FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_mdf_nf"
  ON public.MDF_NF FOR DELETE TO authenticated USING (true);

-- ================================================
-- TABELA MDF_VEICULO_REBOQUE (Reboques/Semi)
-- ================================================
CREATE TABLE public.MDF_VEICULO_REBOQUE (
  MDF_REBOQUE_ID        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  MDF_CABECALHO_ID      BIGINT NOT NULL REFERENCES public.MDF_CABECALHO(MDF_CABECALHO_ID) ON DELETE CASCADE,
  EMPRESA_ID            BIGINT NOT NULL,
  PLACA                 TEXT    NOT NULL DEFAULT '',
  UF                    TEXT    NOT NULL DEFAULT '',
  TARA                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  CAP_KG                NUMERIC(12,2) NOT NULL DEFAULT 0,
  CAP_M3                NUMERIC(12,2) NOT NULL DEFAULT 0,
  TP_CARROCERIA         TEXT    NOT NULL DEFAULT '',
  EXCLUIDO              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IX_MDF_REBOQUE_CABECALHO ON public.MDF_VEICULO_REBOQUE (MDF_CABECALHO_ID);

ALTER TABLE public.MDF_VEICULO_REBOQUE ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_mdf_reboque" ON public.MDF_VEICULO_REBOQUE FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_mdf_reboque" ON public.MDF_VEICULO_REBOQUE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_mdf_reboque" ON public.MDF_VEICULO_REBOQUE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_mdf_reboque" ON public.MDF_VEICULO_REBOQUE FOR DELETE TO authenticated USING (true);

-- ================================================
-- TABELA MDF_LOG (Log de transmissão / retorno ACBr)
-- ================================================
CREATE TABLE public.MDF_LOG (
  MDF_LOG_ID            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  MDF_CABECALHO_ID      BIGINT NOT NULL REFERENCES public.MDF_CABECALHO(MDF_CABECALHO_ID) ON DELETE CASCADE,
  EMPRESA_ID            BIGINT NOT NULL,
  TP_ACAO               TEXT    NOT NULL DEFAULT '', -- EMISSAO, CANCELAMENTO, ENCERRAMENTO, CONSULTA
  DT_LOG                TIMESTAMPTZ NOT NULL DEFAULT now(),
  RETORNO_ACBR          TEXT,
  SUCESSO               BOOLEAN NOT NULL DEFAULT FALSE,
  OBS                   TEXT
);

CREATE INDEX IX_MDF_LOG_CABECALHO ON public.MDF_LOG (MDF_CABECALHO_ID);

ALTER TABLE public.MDF_LOG ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_select_mdf_log" ON public.MDF_LOG FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_mdf_log" ON public.MDF_LOG FOR INSERT TO authenticated WITH CHECK (true);
