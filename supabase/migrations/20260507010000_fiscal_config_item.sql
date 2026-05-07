-- Migração: Criação e RLS da tabela fiscal_config_item
-- Renomeia sequenciais para fiscal_config_item e ajusta estrutura

ALTER TABLE IF EXISTS sequenciais RENAME TO fiscal_config_item;
ALTER TABLE IF EXISTS fiscal_config_item RENAME COLUMN sequencia_id TO fiscal_config_item_id;

ALTER TABLE fiscal_config_item ADD COLUMN IF NOT EXISTS csc VARCHAR(20);
ALTER TABLE fiscal_config_item ADD COLUMN IF NOT EXISTS id_csc VARCHAR(20);
ALTER TABLE fiscal_config_item ADD COLUMN IF NOT EXISTS nome VARCHAR(30);

-- Habilita RLS
ALTER TABLE public.fiscal_config_item ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem
DROP POLICY IF EXISTS "Auth can read fiscal_config_item" ON public.fiscal_config_item;
DROP POLICY IF EXISTS "Auth can insert fiscal_config_item" ON public.fiscal_config_item;
DROP POLICY IF EXISTS "Auth can update fiscal_config_item" ON public.fiscal_config_item;
DROP POLICY IF EXISTS "Auth can delete fiscal_config_item" ON public.fiscal_config_item;

-- Cria políticas de acesso para usuários autenticados
CREATE POLICY "Auth can read fiscal_config_item" ON public.fiscal_config_item 
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert fiscal_config_item" ON public.fiscal_config_item 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth can update fiscal_config_item" ON public.fiscal_config_item 
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can delete fiscal_config_item" ON public.fiscal_config_item 
FOR DELETE TO authenticated USING (true);
