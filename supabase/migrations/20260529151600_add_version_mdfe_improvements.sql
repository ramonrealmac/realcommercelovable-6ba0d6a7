-- Migration: 20260529151600_add_version_mdfe_improvements.sql
-- Insere registro da nova versão contendo melhorias e correções na tela de MDF-e (Manifesto)

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.3',
  'Melhorias e Ajustes no Emissor de MDF-e (Manifesto)',
  'Implementadas melhorias importantes no módulo de MDF-e (Manifesto Eletrônico):' || chr(10) || chr(10) || 
  '• Filtro por Cidade na Grid de Documentos: Adicionado seletor de Cidade de Descarregamento que filtra dinamicamente a grade de documentos cadastrados (NF-e/CT-e), mantendo o seletor sempre visível (mesmo em modo de leitura) para facilitar a conferência.' || chr(10) || 
  '• Correção do Gerador INI do MDF-e: Ajustada a exportação de dados do manifesto para o formato ACBr INI, diferenciando corretamente NF-e de CT-e nas seções infNFe/infCTe e totais (qNFe/qCTe). Corrigido o mapeamento dos códigos de IBGE (cd_ibge) e descrições dos municípios carregados e descarregados.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
