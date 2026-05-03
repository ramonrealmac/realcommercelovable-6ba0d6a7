
-- ================================================
-- TABELA DE LOG DE COMANDOS ACBR
-- ================================================

CREATE TABLE public.ACBR_LOG (
  ACBR_LOG_ID       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  EMPRESA_ID        BIGINT NOT NULL,
  COMANDO           TEXT NOT NULL,
  RESPOSTA          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IX_ACBR_LOG_EMPRESA ON public.ACBR_LOG (EMPRESA_ID);
CREATE INDEX IX_ACBR_LOG_CREATED ON public.ACBR_LOG (created_at DESC);

ALTER TABLE public.ACBR_LOG ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ACBR_LOG"
  ON public.ACBR_LOG FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ACBR_LOG"
  ON public.ACBR_LOG FOR INSERT TO authenticated WITH CHECK (true);
