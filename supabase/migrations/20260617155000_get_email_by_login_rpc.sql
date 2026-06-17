-- Migration: 20260617155000_get_email_by_login_rpc.sql
-- Descrição: Cria função RPC para permitir login usando ds_login ou nm_usuario

CREATE OR REPLACE FUNCTION public.get_email_by_login(p_login text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email text;
BEGIN
    -- Busca o e-mail associado ao login ou nome de usuário
    SELECT email INTO v_email 
    FROM public.profiles 
    WHERE ds_login = p_login OR nm_usuario = p_login OR email = p_login
    LIMIT 1;
    
    RETURN v_email;
END;
$$;

-- Permite que usuários anônimos (antes do login) executem a função
GRANT EXECUTE ON FUNCTION public.get_email_by_login(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_login(text) TO authenticated;
