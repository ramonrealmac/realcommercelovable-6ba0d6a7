-- =============================================================================
-- Script Consolidado de Versionamento e Políticas RLS (Ajustes Fiscais)
-- Data: 26/06/2026
-- Versões Aplicadas: 1.18.4 a 1.18.9
-- Uso: Executar no DBGate / Postgres Editor
-- =============================================================================

BEGIN;

-- ==========================================
-- VERSÃO 1.18.4: Gestão Fiscal por Empresa
-- ==========================================

-- 1. Ajustes de Esquema para fiscal_regra
ALTER TABLE public.fiscal_regra 
ADD COLUMN IF NOT EXISTS empresa_id integer DEFAULT 1 NOT NULL;

-- Adiciona a FK para a tabela empresa se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_fiscal_regra_empresa' AND table_name = 'fiscal_regra'
  ) THEN
    ALTER TABLE public.fiscal_regra 
    ADD CONSTRAINT fk_fiscal_regra_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresa(empresa_id);
  END IF;
END $$;

-- Registro da Versão 1.18.4
DELETE FROM public.sistema_versoes WHERE versao = '1.18.4';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.4',
  'Gestão Fiscal por Empresa e Filtros de Regra',
  'Adicionado o campo empresa_id na tabela fiscal_regra com FK para empresa. Ajustada a tela de Regras Fiscais e CFOP para associar novos cadastros à Empresa Matriz (compartilhamento de regras com filiais). Implementada a filtragem dos seletores de CFOP, Tipo de Operação e Grupo Tributário no form de regras fiscais para listar apenas registros pertencentes à Matriz ou filiais. Alterado o campo CST/CSOSN na aba ICMS para combo box, exibindo opções de CSOSN para empresas do Simples Nacional e opções de CST para regime normal, carregados a partir da tabela icms.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'PostgreSQL', 'Supabase'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.5: RLS para a Tabela ICMS
-- ==========================================

ALTER TABLE public.icms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS icms_select_authenticated ON public.icms;
DROP POLICY IF EXISTS icms_select_public ON public.icms;

CREATE POLICY icms_select_public ON public.icms 
FOR SELECT TO public USING (true);

-- Registro da Versão 1.18.5
DELETE FROM public.sistema_versoes WHERE versao = '1.18.5';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.5',
  'Políticas de RLS para ICMS e Correção do Combo CST/CSOSN',
  'Adicionada a política de leitura (SELECT) na tabela public.icms para usuários públicos, permitindo o carregamento dos códigos CST/CSOSN na aba ICMS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.6: RLS para a Tabela IPI (CST)
-- ==========================================

ALTER TABLE public.ipi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipi_select_public ON public.ipi;

CREATE POLICY ipi_select_public ON public.ipi 
FOR SELECT TO public USING (true);

-- Registro da Versão 1.18.6
DELETE FROM public.sistema_versoes WHERE versao = '1.18.6';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.6',
  'Políticas de RLS para IPI e Combo CST IPI',
  'Adicionada a política de leitura (SELECT) na tabela public.ipi para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST IPI na aba IPI da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.7: RLS para Enquadramento do IPI
-- ==========================================

ALTER TABLE public.ipi_enquadramento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipi_enquadramento_select_public ON public.ipi_enquadramento;

CREATE POLICY ipi_enquadramento_select_public ON public.ipi_enquadramento 
FOR SELECT TO public USING (true);

-- Registro da Versão 1.18.7
DELETE FROM public.sistema_versoes WHERE versao = '1.18.7';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.7',
  'Políticas de RLS para Enquadramento do IPI e Combo c. enquadramento',
  'Adicionada a política de leitura (SELECT) na tabela public.ipi_enquadramento para usuários públicos/autenticados, e configurado o combo box para carregar códigos de Enquadramento do IPI na aba IPI da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.8: RLS para PIS/COFINS
-- ==========================================

ALTER TABLE public.piscofins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS piscofins_select_public ON public.piscofins;

CREATE POLICY piscofins_select_public ON public.piscofins 
FOR SELECT TO public USING (true);

-- Registro da Versão 1.18.8
DELETE FROM public.sistema_versoes WHERE versao = '1.18.8';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.8',
  'Políticas de RLS para PIS/COFINS e Combo CST PIS/COFINS',
  'Adicionada a política de leitura (SELECT) na tabela public.piscofins para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST PIS e COFINS nas abas PIS e COFINS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.9: RLS para IBS/CBS
-- ==========================================

ALTER TABLE public.ibscbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ibscbs_select_public ON public.ibscbs;

CREATE POLICY ibscbs_select_public ON public.ibscbs 
FOR SELECT TO public USING (true);

-- Registro da Versão 1.18.9
DELETE FROM public.sistema_versoes WHERE versao = '1.18.9';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.9',
  'Políticas de RLS para IBS/CBS e Combo CST IBS/CBS',
  'Adicionada a política de leitura (SELECT) na tabela public.ibscbs para usuários públicos/autenticados, e configurado o combo box para carregar códigos de CST IBS e CBS na aba CBS/IBS da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'RLS'],
  now()
);


-- ==========================================
-- VERSÃO 1.18.10: Máscara Decimal e Ajuste na Grid de CFOP
-- ==========================================

-- Registro da Versão 1.18.10
DELETE FROM public.sistema_versoes WHERE versao = '1.18.10';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.10',
  'Máscara Decimal e Ajuste na Grid de CFOP',
  'Implementado o componente DecimalInput para digitação de alíquotas e percentuais com alinhamento à direita e digitação da direita para a esquerda. Ajustada a largura das colunas Descrição e Grupo Tributário na grid de CFOP da tela de Regras Fiscais.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'PostgreSQL'],
  now()
);

COMMIT;
