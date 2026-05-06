-- ========================================================
-- TABELA DE CONTROLE SEQUENCIAL E REMOÇÃO DFE_NSU_LOG
-- ========================================================

CREATE TABLE IF NOT EXISTS public.sys_sequencial (
	empresa_id int4 NOT NULL,
	tabela varchar(30) DEFAULT ''::character varying NULL,
	nm_campo1 varchar(30) DEFAULT ''::character varying NULL,
	nm_campo3 varchar(30) DEFAULT ''::character varying NULL,
	ult_seq int8 DEFAULT 0 NULL
);

-- Ativar RLS
ALTER TABLE public.sys_sequencial ENABLE ROW LEVEL SECURITY;

-- Permissoes
CREATE POLICY "sys_sequencial_select" ON public.sys_sequencial FOR SELECT TO authenticated USING (true);
CREATE POLICY "sys_sequencial_insert" ON public.sys_sequencial FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sys_sequencial_update" ON public.sys_sequencial FOR UPDATE TO authenticated USING (true);

-- ========================================================
-- REMOÇÃO DA TABELA ANTIGA (MIGRANDO PARA A NOVA FILA)
-- ========================================================
DROP TABLE IF EXISTS public.dfe_nsu_log CASCADE;

-- Função utilitária opcional (pode ser chamada pelo Worker via RPC)
CREATE OR REPLACE FUNCTION public.get_or_create_nsu_seq(p_empresa_id integer, p_tipo_campo varchar)
RETURNS int8
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ult_seq int8;
BEGIN
    -- Verifica se já existe o sequencial para aquela empresa/campo
    SELECT ult_seq INTO v_ult_seq
    FROM public.sys_sequencial
    WHERE empresa_id = p_empresa_id 
      AND tabela = 'fiscal_nfe_recebida' 
      AND nm_campo1 = p_tipo_campo;

    IF v_ult_seq IS NULL THEN
        -- Não existe, vamos criar iniciando em 1
        INSERT INTO public.sys_sequencial (empresa_id, tabela, nm_campo1, ult_seq)
        VALUES (p_empresa_id, 'fiscal_nfe_recebida', p_tipo_campo, 1)
        RETURNING ult_seq INTO v_ult_seq;
    END IF;

    RETURN v_ult_seq;
END;
$$;
