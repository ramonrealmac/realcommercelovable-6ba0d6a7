-- Migration: 20260813163000_add_version_1_18_48_devolucao_vendas_danfe.sql
-- Description: Registro de versionamento 1.18.48 para os ajustes na Devolução de Vendas, emissão de DANFE e movimentação de caixa no DBGate.

INSERT INTO public.sistema_versoes (
  id,
  versao,
  fase,
  titulo,
  detalhes,
  tecnologias,
  autor,
  created_at
) VALUES (
  gen_random_uuid(),
  '1.18.48',
  'Produção',
  'Ajustes na Devolução de Vendas e Emissão de DANFE',
  'Inclusão do grupo DFeReferenciado por item no XML/INI da NF-e de Devolução (finNFe = 4), validações SEFAZ 2026, substituição dinâmica pelo botão Emitir DANFE após autorização e correções na movimentação de caixa.',
  ARRAY['NF-e 4.00', 'SEFAZ 2026', 'React', 'PostgreSQL', 'ACBrNFe'],
  'AI Antigravity',
  NOW()
);
