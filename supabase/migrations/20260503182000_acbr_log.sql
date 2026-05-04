
-- ================================================
-- TABELA DE LOG DE COMANDOS ACBR (DFE NSU)
-- ================================================

DROP TABLE IF EXISTS public.ACBR_LOG;

CREATE TABLE public.dfe_nsu_log (
	dfe_log_id int8 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL,
	empresa_id int8 NOT NULL,
	comando text NOT NULL,
	resposta text NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	max_nsu int8 DEFAULT 0 NULL,
	ult_nsu int8 DEFAULT 0 NULL,
	CONSTRAINT dfe_nsu_log_pe UNIQUE (empresa_id, dfe_log_id),
	CONSTRAINT dfe_nsu_log_pk PRIMARY KEY (dfe_log_id)
);

CREATE INDEX ix_acbr_log_created ON public.dfe_nsu_log USING btree (created_at DESC);
CREATE INDEX ix_acbr_log_empresa ON public.dfe_nsu_log USING btree (empresa_id);

ALTER TABLE public.dfe_nsu_log ENABLE ROW LEVEL SECURITY;

-- Table Policies
CREATE POLICY "Authenticated users can insert ACBR_LOG" ON public.dfe_nsu_log
 FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read ACBR_LOG" ON public.dfe_nsu_log
 FOR SELECT TO authenticated USING (true);
