-- Migration: 20260706144600_fix_conta_table.sql
-- Description: Fixes conta table default constraints, updates existing records for soft-delete and multi-company key compatibility, and registers version 1.18.13.

-- 1. Set default value for excluido column to false to prevent future nulls
ALTER TABLE public.conta ALTER COLUMN excluido SET DEFAULT false;

-- 2. Correct any existing NULL values in the excluido column to false
UPDATE public.conta SET excluido = false WHERE excluido IS NULL;

-- 3. Update the existing test account to the new company-prefixed key format to free up single digits and prevent PK conflicts
UPDATE public.conta SET conta_id = '5-1' WHERE conta_id = '1' AND empresa_id = 5;

-- 4. Set default value for dt_cadastro to America/Sao_Paulo timezone (local) and fix nulls
ALTER TABLE public.conta ALTER COLUMN dt_cadastro SET DEFAULT timezone('America/Sao_Paulo'::text, now());
UPDATE public.conta SET dt_cadastro = timezone('America/Sao_Paulo'::text, now()) WHERE dt_cadastro IS NULL;

-- 5. Force update existing records to match local timezone (subtract 3 hours if they were stored in UTC timezone)
UPDATE public.conta SET dt_cadastro = dt_cadastro - INTERVAL '3 hours' WHERE dt_cadastro > now() - INTERVAL '1 hour';

-- 6. Registro da Versão 1.18.13 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.13';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.13',
  'Tela de Cadastro de Contas Bancárias e Ajustes Multi-Empresa',
  'Desenvolvimento e refinamento da tela de Contas Bancárias (Abas de Dados Principais, Cobrança/Boletos, Beneficiário). Validação de DV de agência/conta, remoção de portador/saldo e conversão do ativo para checkbox padrão do sistema (accent-primary). Navegação sequencial de campos com Enter (com suporte a troca de abas e foco em Salvar). Configuração de limites maxLength nos inputs. Correção de colisão de PK multi-empresa (conta_id como empresa-codigo) e valor padrão de excluido para false.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
