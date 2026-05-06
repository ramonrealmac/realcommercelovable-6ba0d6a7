-- Adiciona coluna user_id na tabela fiscal_evento para auditoria
ALTER TABLE public.fiscal_evento ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
COMMENT ON COLUMN public.fiscal_evento.user_id IS 'ID do usuário que disparou o comando';
