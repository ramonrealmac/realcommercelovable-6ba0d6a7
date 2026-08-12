-- Migration: 20260807155500_alter_operadora_taxa_new_grid.sql
-- Description: Recreates public.operadora_taxa table to support the new installment/rates structure.

-- 1. Drop existing table if exists (cascade to remove RLS policies and dependent constraints)
DROP TABLE IF EXISTS public.operadora_taxa CASCADE;

-- 2. Create the new public.operadora_taxa table
CREATE TABLE public.operadora_taxa (
    operadora_taxa_id UUID NOT NULL DEFAULT gen_random_uuid(),
    empresa_id INTEGER NOT NULL REFERENCES public.empresa (empresa_id),
    operadora_id INTEGER NOT NULL REFERENCES public.operadora (operadora_id) ON DELETE CASCADE,
    parcela VARCHAR(20) NOT NULL,
    taxa_cartao NUMERIC(5,2) NOT NULL,
    taxa_antecipacao NUMERIC(5,2) NOT NULL,
    excluido BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT operadora_taxa_pkey PRIMARY KEY (operadora_taxa_id)
);

-- 3. Create indexes for foreign keys and queries
CREATE INDEX IF NOT EXISTS idx_operadora_taxa_operadora ON public.operadora_taxa (operadora_id);
CREATE INDEX IF NOT EXISTS idx_operadora_taxa_empresa ON public.operadora_taxa (empresa_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.operadora_taxa ENABLE ROW LEVEL SECURITY;

-- 5. Create policy for authenticated users
DROP POLICY IF EXISTS operadora_taxa_all_authenticated ON public.operadora_taxa;
CREATE POLICY operadora_taxa_all_authenticated ON public.operadora_taxa
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Register version 1.18.39
DELETE FROM public.sistema_versoes WHERE versao = '1.18.39';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.39',
  'Sub-grid de Parcelas e Taxas de Operadoras',
  'FINANCEIRO: Reestruturação da tabela operadora_taxa para suportar taxas por parcela e taxa de antecipação.' || chr(10) ||
  '• Banco de dados: Recriada a tabela operadora_taxa com colunas parcela, taxa_cartao e taxa_antecipacao.' || chr(10) ||
  '• Interface: Adicionada a sub-grid de taxas por parcela dentro do formulário de operadoras com CRUD direto (adicionar, editar, excluir e duplo clique).',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'React', 'TypeScript', 'Supabase']
);
