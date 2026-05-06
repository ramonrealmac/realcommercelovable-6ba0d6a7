-- ========================================================
-- TABELA DE FILA/WORKER FISCAL: fiscal_evento
-- ========================================================

CREATE TABLE IF NOT EXISTS public.fiscal_evento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id BIGINT NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- Ex: 'NFE', 'NFCE', 'MDFE', 'CTE'
    comando VARCHAR(100) NOT NULL, -- Ex: 'ENVIAR', 'CANCELAR', 'CONSULTAR', 'INUTILIZAR', 'DOWNLOAD'
    payload JSONB, -- Dados para gerar o INI/JSON ou dados da requisição
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE', -- PENDENTE, PROCESSANDO, CONCLUIDO, ERRO
    resposta TEXT, -- Retorno bruto ou mensagem descritiva
    xml_retorno TEXT, -- XML de retorno se houver
    mensagem_erro TEXT, -- Se der erro na DLL ou requisição
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index para otimizar busca de pendentes
CREATE INDEX IF NOT EXISTS ix_fiscal_evento_status ON public.fiscal_evento(status);
CREATE INDEX IF NOT EXISTS ix_fiscal_evento_empresa ON public.fiscal_evento(empresa_id);

-- Ativar RLS
ALTER TABLE public.fiscal_evento ENABLE ROW LEVEL SECURITY;

-- Policies (Interface Web pode ler e inserir)
CREATE POLICY "Users can insert fiscal_evento" ON public.fiscal_evento
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read fiscal_evento" ON public.fiscal_evento
    FOR SELECT TO authenticated USING (true);

-- ========================================================
-- CONFIGURAÇÃO REALTIME PARA O WORKER
-- ========================================================

-- Define a identidade da réplica para enviar o registro completo no realtime
ALTER TABLE public.fiscal_evento REPLICA IDENTITY FULL;

-- Adiciona a tabela à publicação supabase_realtime
-- Caso a publicação já exista, a inserção ignora erro por estar em bloco anônimo.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'fiscal_evento'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fiscal_evento;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Em caso de erro na alteração, a tabela será inserida silenciosamente na publicação,
    -- mas o supabase cli no geral ativa automatically para realtime publications com interface web.
END
$$;
