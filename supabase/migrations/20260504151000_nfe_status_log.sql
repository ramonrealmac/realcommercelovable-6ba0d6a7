-- ================================================
-- LOG DE ALTERAÇÕES DE STATUS (MANIFESTO) DA NFE
-- ================================================

CREATE TABLE IF NOT EXISTS public.nfe_recebida_status_log (
    nfe_status_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nfe_recebida_id   BIGINT NOT NULL REFERENCES public.nfe_recebida(nfe_recebida_id) ON DELETE CASCADE,
    st_anterior      TEXT,
    st_novo          TEXT NOT NULL,
    justificativa    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_nfe_status_log_nfe ON public.nfe_recebida_status_log(nfe_recebida_id);

ALTER TABLE public.nfe_recebida_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read nfe_recebida_status_log"
  ON public.nfe_recebida_status_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert nfe_recebida_status_log"
  ON public.nfe_recebida_status_log FOR INSERT TO authenticated WITH CHECK (true);
