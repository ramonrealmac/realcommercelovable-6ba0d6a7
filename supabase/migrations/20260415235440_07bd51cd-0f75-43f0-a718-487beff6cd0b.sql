-- Copiar dados antes de dropar
UPDATE empresa 
SET empresa_matriz_id = empresamatriz_id 
WHERE empresa_matriz_id IS NULL AND empresamatriz_id IS NOT NULL;

-- Recriar a policy sem referência a empresamatriz_id
DROP POLICY IF EXISTS unidade_select_authenticated ON unidade;
CREATE POLICY unidade_select_authenticated ON unidade
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM empresa_usuario eu
      LEFT JOIN empresa e ON e.empresa_id = eu.empresa_id
      WHERE eu.user_id = auth.uid()
        AND eu.fl_excluido = false
        AND (
          eu.empresa_id = unidade.empresa_id
          OR COALESCE(e.empresa_matriz_id::bigint, e.empresa_id) = unidade.empresa_id
        )
    )
  );

-- Agora podemos dropar a coluna
ALTER TABLE empresa DROP COLUMN empresamatriz_id;