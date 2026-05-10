
-- Adiciona campos de configuração de e-mail na tabela fiscal_config
ALTER TABLE public.fiscal_config 
    ADD COLUMN IF NOT EXISTS email_smtp_host text,
    ADD COLUMN IF NOT EXISTS email_smtp_port integer DEFAULT 587,
    ADD COLUMN IF NOT EXISTS email_smtp_user text,
    ADD COLUMN IF NOT EXISTS email_smtp_pass text,
    ADD COLUMN IF NOT EXISTS email_smtp_ssl boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS email_smtp_tls boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS email_assunto_nfe text DEFAULT 'NF-e emitida: [CHAVE]',
    ADD COLUMN IF NOT EXISTS email_corpo_nfe text DEFAULT 'Olá, segue em anexo a NF-e e o DANFE referente à sua compra.';

COMMENT ON COLUMN public.fiscal_config.email_smtp_host IS 'Servidor SMTP para envio de e-mails fiscais.';
COMMENT ON COLUMN public.fiscal_config.email_smtp_port IS 'Porta do servidor SMTP (Ex: 587 para TLS, 465 para SSL).';
