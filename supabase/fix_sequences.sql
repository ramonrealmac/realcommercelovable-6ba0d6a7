-- ================================================================
-- Fix Sequences: Corrige sequências desincronizadas
-- Cobre tanto SERIAL/nextval quanto GENERATED AS IDENTITY
-- Execute no SQL Editor do Supabase quando houver erro de PK duplicada
-- ================================================================
DO $$
DECLARE
  r         RECORD;
  max_val   BIGINT;
  seq_name  TEXT;
BEGIN
  -- ── 1. Colunas com SERIAL / DEFAULT nextval ──────────────────
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_default LIKE 'nextval%'
  LOOP
    BEGIN
      seq_name := pg_get_serial_sequence('public.' || r.table_name, r.column_name);
      IF seq_name IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(MAX(' || quote_ident(r.column_name) || '), 1) FROM public.' || quote_ident(r.table_name) INTO max_val;
        PERFORM setval(seq_name, max_val);
        RAISE NOTICE 'SERIAL corrigido: %.% -> %', r.table_name, r.column_name, max_val;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro em %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;

  -- ── 2. Colunas GENERATED ALWAYS/BY DEFAULT AS IDENTITY ───────
  FOR r IN
    SELECT
      c.table_name,
      c.column_name,
      pg_get_serial_sequence('public.' || c.table_name, c.column_name) AS seq
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public'
      AND c.is_identity = 'YES'
      AND t.table_type = 'BASE TABLE'
  LOOP
    BEGIN
      IF r.seq IS NOT NULL THEN
        EXECUTE 'SELECT COALESCE(MAX(' || quote_ident(r.column_name) || '), 1) FROM public.' || quote_ident(r.table_name) INTO max_val;
        PERFORM setval(r.seq, max_val);
        RAISE NOTICE 'IDENTITY corrigido: %.% -> %', r.table_name, r.column_name, max_val;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro identity em %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END $$;
