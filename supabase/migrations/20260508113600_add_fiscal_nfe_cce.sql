-- Tabela para Carta de Correção Eletrônica (CC-e)
CREATE TABLE IF NOT EXISTS public.fiscal_nfe_cce (
    nfe_cce_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nfe_cabecalho_id BIGINT NOT NULL REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id),
    empresa_id BIGINT NOT NULL REFERENCES public.empresa(empresa_id),
    nr_sequencial INTEGER NOT NULL DEFAULT 1,
    x_correcao TEXT NOT NULL, -- Mínimo 15 caracteres conforme SEFAZ
    dt_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
    tp_evento VARCHAR(10) NOT NULL DEFAULT '110110',
    st_evento VARCHAR(1) NOT NULL DEFAULT 'A', -- A=Aberto, E=Enviado, F=Falha
    c_stat INTEGER,
    x_motivo TEXT,
    nr_protocolo VARCHAR(50),
    xml_evento TEXT,
    xml_retorno TEXT,
    excluido BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para busca rápida
CREATE INDEX IF NOT EXISTS ix_fiscal_nfe_cce_nfe ON public.fiscal_nfe_cce(nfe_cabecalho_id);
CREATE INDEX IF NOT EXISTS ix_fiscal_nfe_cce_empresa ON public.fiscal_nfe_cce(empresa_id);

-- RLS
ALTER TABLE public.fiscal_nfe_cce ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert fiscal_nfe_cce" ON public.fiscal_nfe_cce
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read fiscal_nfe_cce" ON public.fiscal_nfe_cce
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update fiscal_nfe_cce" ON public.fiscal_nfe_cce
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Trigger para updated_at (assumindo que existe a função handle_updated_at)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_updated_at') THEN
        CREATE TRIGGER tr_fiscal_nfe_cce_updated_at
            BEFORE UPDATE ON public.fiscal_nfe_cce
            FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;
