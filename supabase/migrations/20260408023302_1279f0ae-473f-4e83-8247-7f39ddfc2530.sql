DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'unidade'
      AND policyname = 'unidade_select_authenticated'
  ) THEN
    CREATE POLICY unidade_select_authenticated
    ON public.unidade
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.empresa_usuario eu
        LEFT JOIN public.empresa e
          ON e.empresa_id = eu.empresa_id
        WHERE eu.user_id = auth.uid()
          AND eu.fl_excluido = false
          AND (
            eu.empresa_id = unidade.empresa_id
            OR COALESCE(e.empresamatriz_id, e.empresa_matriz_id, e.empresa_id) = unidade.empresa_id
          )
      )
    );
  END IF;
END
$$;