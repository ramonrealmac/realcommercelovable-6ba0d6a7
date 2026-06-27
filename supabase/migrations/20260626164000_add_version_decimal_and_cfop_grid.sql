-- Migration: 20260626164000_add_version_decimal_and_cfop_grid.sql
-- Description: Registra a versão 1.18.10 do sistema com ajustes de formatação decimal e largura das colunas da grid CFOP

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
