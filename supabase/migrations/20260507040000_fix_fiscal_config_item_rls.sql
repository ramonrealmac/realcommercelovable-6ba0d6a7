-- Ativa RLS e permite leitura pública para as configurações fiscais
ALTER TABLE fiscal_config_item ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura para todos" ON fiscal_config_item;
CREATE POLICY "Permitir leitura para todos" ON fiscal_config_item FOR SELECT USING (true);
