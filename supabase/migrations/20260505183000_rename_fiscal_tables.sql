-- ========================================================
-- RENOMEAÇÃO DE TABELAS FISCAIS (PREFIXO fiscal_)
-- ========================================================

DO $$ 
BEGIN
    -- Tabelas NFe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nfe_recebida') THEN
        ALTER TABLE public.nfe_recebida RENAME TO fiscal_nfe_recebida;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nfe_recebida_status_log') THEN
        ALTER TABLE public.nfe_recebida_status_log RENAME TO fiscal_nfe_status_log;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nfe_cabecalho') THEN
        ALTER TABLE public.nfe_cabecalho RENAME TO fiscal_nfe_cabecalho;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nfe_item') THEN
        ALTER TABLE public.nfe_item RENAME TO fiscal_nfe_item;
    END IF;

    -- Tabelas MDFe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_cabecalho') THEN
        ALTER TABLE public.mdf_cabecalho RENAME TO fiscal_mdf_cabecalho;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_nf') THEN
        ALTER TABLE public.mdf_nf RENAME TO fiscal_mdf_nf;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_veiculo_reboque') THEN
        ALTER TABLE public.mdf_veiculo_reboque RENAME TO fiscal_mdf_veiculo_reboque;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_log') THEN
        ALTER TABLE public.mdf_log RENAME TO fiscal_mdf_log;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_manifesto') THEN
        ALTER TABLE public.mdf_manifesto RENAME TO fiscal_mdf_manifesto;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_carrega') THEN
        ALTER TABLE public.mdf_carrega RENAME TO fiscal_mdf_carrega;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_descarrega') THEN
        ALTER TABLE public.mdf_descarrega RENAME TO fiscal_mdf_descarrega;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_documento') THEN
        ALTER TABLE public.mdf_documento RENAME TO fiscal_mdf_documento;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_veiculo') THEN
        ALTER TABLE public.mdf_veiculo RENAME TO fiscal_mdf_veiculo;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_condutor') THEN
        ALTER TABLE public.mdf_condutor RENAME TO fiscal_mdf_condutor;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_motorista') THEN
        ALTER TABLE public.mdf_motorista RENAME TO fiscal_mdf_motorista;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_percurso') THEN
        ALTER TABLE public.mdf_percurso RENAME TO fiscal_mdf_percurso;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_pagamento') THEN
        ALTER TABLE public.mdf_pagamento RENAME TO fiscal_mdf_pagamento;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_componente') THEN
        ALTER TABLE public.mdf_componente RENAME TO fiscal_mdf_componente;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_pagtos') THEN
        ALTER TABLE public.mdf_pagtos RENAME TO fiscal_mdf_pagtos;
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mdf_historicoxml') THEN
        ALTER TABLE public.mdf_historicoxml RENAME TO fiscal_mdf_historicoxml;
    END IF;

END $$;
