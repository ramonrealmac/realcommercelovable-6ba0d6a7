-- =========================================================================
-- ADEQUAÇÃO PARA NF-e (Entradas/Saídas) e REFORMA TRIBUTÁRIA (2026-2028)
-- =========================================================================

DO $$ 
BEGIN

    -- 1. AJUSTES NO CABEÇALHO (fiscal_nfe_cabecalho)
    
    -- a) Renomear tp_entrada para origem_inclusao (para evitar confusão com tp_nf da Sefaz)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'tp_entrada'
    ) THEN
        -- Remover constraint antiga se existir
        ALTER TABLE public.fiscal_nfe_cabecalho DROP CONSTRAINT IF EXISTS nfe_cabecalho_tp_entrada_check;
        ALTER TABLE public.fiscal_nfe_cabecalho RENAME COLUMN tp_entrada TO origem_inclusao;
        ALTER TABLE public.fiscal_nfe_cabecalho ADD CONSTRAINT fiscal_nfe_cabecalho_origem_inclusao_check CHECK (origem_inclusao = ANY (ARRAY['M'::text, 'X'::text]));
    END IF;

    -- b) Adicionar campos padrões da Sefaz (caso não existam)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'modelo') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN modelo varchar(2) DEFAULT '55' NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'tp_nf') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN tp_nf int2 DEFAULT 0 NOT NULL; -- 0=Entrada, 1=Saída
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'fin_nfe') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN fin_nfe int2 DEFAULT 1 NOT NULL; -- 1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'nat_op') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN nat_op varchar(60) DEFAULT '' NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'tp_emis') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN tp_emis int2 DEFAULT 1 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'c_stat') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN c_stat int4 NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'x_motivo') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN x_motivo varchar(255) NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'recibo_sefaz') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN recibo_sefaz varchar(50) NULL;
    END IF;

    -- c) Adicionar totalizadores faltantes (PIS, COFINS e Reforma Tributária)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_pis') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_pis numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_cofins') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_cofins numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_ibs') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_ibs numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_cbs') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_cbs numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_cabecalho' AND column_name = 'vl_is') THEN
        ALTER TABLE public.fiscal_nfe_cabecalho ADD COLUMN vl_is numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;


    -- =========================================================================
    -- 2. AJUSTES NOS ITENS (fiscal_nfe_item)
    -- =========================================================================

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'origem') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN origem int2 DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'csosn') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN csosn varchar(3) DEFAULT '' NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'cest') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN cest varchar(7) DEFAULT '' NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'c_enq') THEN
        ALTER TABLE public.fiscal_nfe_item ADD COLUMN c_enq varchar(3) DEFAULT '999' NOT NULL;
    END IF;

    -- Reforma Tributária (Itens)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'cst_ibs') THEN
        ALTER TABLE public.fiscal_nfe_item 
            ADD COLUMN cst_ibs varchar(2) DEFAULT '' NOT NULL,
            ADD COLUMN pc_ibs numeric(8,4) DEFAULT 0 NOT NULL,
            ADD COLUMN vl_ibs numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'cst_cbs') THEN
        ALTER TABLE public.fiscal_nfe_item 
            ADD COLUMN cst_cbs varchar(2) DEFAULT '' NOT NULL,
            ADD COLUMN pc_cbs numeric(8,4) DEFAULT 0 NOT NULL,
            ADD COLUMN vl_cbs numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fiscal_nfe_item' AND column_name = 'cst_is') THEN
        ALTER TABLE public.fiscal_nfe_item 
            ADD COLUMN cst_is varchar(2) DEFAULT '' NOT NULL,
            ADD COLUMN pc_is numeric(8,4) DEFAULT 0 NOT NULL,
            ADD COLUMN vl_is numeric(15,2) DEFAULT 0 NOT NULL;
    END IF;

END $$;


-- =========================================================================
-- 3. CRIAÇÃO DE NOVAS TABELAS AUXILIARES
-- =========================================================================

-- TABELA PAGAMENTO
CREATE TABLE IF NOT EXISTS public.fiscal_nfe_pagamento (
    nfe_pagamento_id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nfe_cabecalho_id int8 NOT NULL REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id) ON DELETE CASCADE,
    t_pag varchar(2) NOT NULL, -- 01=Dinheiro, 03=Cartão, etc
    v_pag numeric(15,2) DEFAULT 0 NOT NULL,
    tp_integra int2 NULL, -- 1=Integrado, 2=POS
    cnpj_credenciadora varchar(14) NULL,
    c_aut varchar(20) NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fiscal_nfe_pagamento_cab ON public.fiscal_nfe_pagamento(nfe_cabecalho_id);

ALTER TABLE public.fiscal_nfe_pagamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_pag" ON public.fiscal_nfe_pagamento;
CREATE POLICY "auth_all_fiscal_nfe_pag" ON public.fiscal_nfe_pagamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABELA REFERENCIADA (Para Devoluções)
CREATE TABLE IF NOT EXISTS public.fiscal_nfe_referenciada (
    nfe_referenciada_id int8 GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nfe_cabecalho_id int8 NOT NULL REFERENCES public.fiscal_nfe_cabecalho(nfe_cabecalho_id) ON DELETE CASCADE,
    chave_ref varchar(44) NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_fiscal_nfe_ref_cab ON public.fiscal_nfe_referenciada(nfe_cabecalho_id);

ALTER TABLE public.fiscal_nfe_referenciada ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_fiscal_nfe_ref" ON public.fiscal_nfe_referenciada;
CREATE POLICY "auth_all_fiscal_nfe_ref" ON public.fiscal_nfe_referenciada FOR ALL TO authenticated USING (true) WITH CHECK (true);
