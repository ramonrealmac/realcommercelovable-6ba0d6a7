-- Migration: 20260601164000_add_excluido_to_payment_tables.sql
-- Adiciona as colunas excluido, dt_cadastro e dt_alteracao nas tabelas de pagamento do MDF-e

-- 1. Tabela fiscal_mdf_pagamento
ALTER TABLE public.fiscal_mdf_pagamento 
ADD COLUMN IF NOT EXISTS excluido boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dt_cadastro timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS dt_alteracao timestamp with time zone;

-- 2. Tabela fiscal_mdf_componente
ALTER TABLE public.fiscal_mdf_componente 
ADD COLUMN IF NOT EXISTS excluido boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dt_cadastro timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS dt_alteracao timestamp with time zone;

-- 3. Tabela fiscal_mdf_pagtos
ALTER TABLE public.fiscal_mdf_pagtos 
ADD COLUMN IF NOT EXISTS excluido boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dt_cadastro timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS dt_alteracao timestamp with time zone;

-- 4. Registrar versão
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.12',
  'Soft-delete nas Tabelas de Pagamento do MDF-e',
  'Adicionadas as colunas excluido, dt_cadastro e dt_alteracao nas tabelas de pagamento (fiscal_mdf_pagamento, fiscal_mdf_componente e fiscal_mdf_pagtos), permitindo o uso consistente do padrão de soft-delete no sistema.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Schema']
);
