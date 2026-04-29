-- Script de "Limpeza Total" de RLS para tabelas MDF-e
-- Execute isso no SQL Editor do seu Dashboard Supabase

DO $$
DECLARE
    r RECORD;
    mdf_tables text[] := ARRAY[
        'mdf_manifesto', 'mdf_carrega', 'mdf_descarrega', 'mdf_documento', 
        'mdf_veiculo', 'mdf_condutor', 'mdf_motorista', 'mdf_percurso', 
        'mdf_pagamento', 'mdf_componente', 'mdf_pagtos', 'mdf_historicoxml'
    ];
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY mdf_tables LOOP
        -- 1. Desabilita RLS temporariamente para garantir limpeza
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', tbl);

        -- 2. Remove TODAS as políticas existentes nessa tabela (independente do nome)
        FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl) LOOP
            EXECUTE format('DROP POLICY %I ON public.%I;', r.policyname, tbl);
        END LOOP;

        -- 3. Habilita RLS novamente
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        -- 4. Cria a política de acesso total para usuários autenticados
        EXECUTE format('CREATE POLICY "global_auth_access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
        
        RAISE NOTICE 'RLS resetado e liberado para: %', tbl;
    END LOOP;
END;
$$;
