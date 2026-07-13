-- Migration: 20260714001000_add_version_operadora_bandeira_crud.sql
-- Description: Registers version 1.18.33 for Operadoras and Bandeiras CRUD screens and company filtering fixes.

-- 1. Registro da Versão 1.18.33 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.33';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.33',
  'Operadoras e Bandeiras de Cartões - CRUD e Filtros por Empresa (2026-07-13)',
  'CADASTROS - FINANCEIRO: Criadas as telas de cadastro de Operadoras de Cartões e Bandeiras de Cartões no menu Cadastros → Financeiro, seguindo o padrão StandardCrudForm do sistema. '
  || 'OPERADORAS DE CARTÕES: CRUD completo com campos Razão Social e CNPJ, filtrado por empresa logada. Configurado com XSoftDelete=false pois a tabela operadora não possui coluna excluido. '
  || 'BANDEIRAS DE CARTÕES: CRUD completo com campo Descrição e auto-incremento de código (cd_bandeira), filtrado por empresa logada. '
  || 'MENU: Adicionados os itens "Operadoras Cartões" e "Bandeiras Cartões" no submenu Financeiro do menu Cadastros. '
  || 'BANCO DE DADOS: Migration para atualizar registros existentes da tabela bandeira com empresa_id=5 e normalizar descrições para letra maiúscula (UPPER). '
  || 'PDV/CAIXA: Filtro por empresa logada aplicado nos combos de Condições de Pagamento, Bandeiras e Operadoras na tela de Pagamento do Caixa. '
  || 'PEDIDOS: Combos carregam somente itens da empresa logada. '
  || 'CAIXA: Pedidos a receber filtrados pela empresa logada.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
