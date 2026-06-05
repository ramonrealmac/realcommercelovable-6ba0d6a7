-- Migration: 20260605183000_add_vale_pedagio_and_rota_to_manifesto.sql
-- Cria a tabela public.rota e adiciona colunas de Rota, Pedágio e CIOT no MDF-e

-- 1. Cria a tabela public.rota se não existir
CREATE TABLE IF NOT EXISTS public.rota (
  rota_id SERIAL PRIMARY KEY,
  descricao VARCHAR(100) NOT NULL,
  possui_pedagio BOOLEAN DEFAULT FALSE,
  excluido BOOLEAN DEFAULT FALSE,
  empresa_id INTEGER DEFAULT 1,
  dt_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  dt_alteracao TIMESTAMP WITH TIME ZONE
);

-- 2. Habilita RLS e cria políticas para public.rota
ALTER TABLE public.rota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can select rota" ON public.rota;
DROP POLICY IF EXISTS "Auth can insert rota" ON public.rota;
DROP POLICY IF EXISTS "Auth can update rota" ON public.rota;
DROP POLICY IF EXISTS "Auth can delete rota" ON public.rota;

CREATE POLICY "Auth can select rota" ON public.rota 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth can insert rota" ON public.rota 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth can update rota" ON public.rota 
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth can delete rota" ON public.rota 
  FOR DELETE TO authenticated USING (true);

-- 3. Adiciona colunas na tabela fiscal_mdf_manifesto
ALTER TABLE public.fiscal_mdf_manifesto
  ADD COLUMN IF NOT EXISTS rota_id INTEGER REFERENCES public.rota(rota_id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS possui_pedagio BOOLEAN DEFAULT FALSE;

-- 4. Adiciona colunas na tabela fiscal_mdf_componente
ALTER TABLE public.fiscal_mdf_componente
  ADD COLUMN IF NOT EXISTS cnpj_fornecedor VARCHAR(14) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comprovante VARCHAR(20) DEFAULT NULL;

-- 5. Insere rotas de teste padrão
INSERT INTO public.rota (descricao, possui_pedagio, empresa_id)
VALUES 
  ('Rota Curitiba - São Paulo (Com Pedágio)', TRUE, 1),
  ('Rota Curitiba - Paranaguá (Com Pedágio)', TRUE, 1),
  ('Rota Local Curitiba (Sem Pedágio)', FALSE, 1)
ON CONFLICT DO NOTHING;

-- 6. Atualizar versão do sistema
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES ('1.16.22', 'Vale-Pedágio, CIOT e Rotas no MDF-e', 'Tabela rota e validações de pagamento/pedágio para TAC', 'Antigravity', 'Desenvolvimento', ARRAY['React', 'Supabase', 'PostgreSQL']);
