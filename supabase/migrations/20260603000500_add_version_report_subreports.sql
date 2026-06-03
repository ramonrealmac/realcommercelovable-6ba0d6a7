-- Migration: 20260603000500_add_version_report_subreports.sql
-- Insere registro da nova versão contendo a opção de subrelatórios no gerador de relatórios

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.16',
  'Suporte a Sub-Relatórios no Gerador de Relatórios',
  'Implementada a funcionalidade de Sub-Relatórios (Subreports) no gerador de relatórios do sistema:' || chr(10) || chr(10) || 
  '• Vínculo Pai-Filho: Permite associar sub-relatórios a um relatório principal, definindo parâmetros e chaves de ligação entre as consultas.' || chr(10) || 
  '• Renderização Aninhada: Ajustada a engine de PDF para processar e renderizar sub-relatórios dinamicamente com base nas linhas do relatório pai.' || chr(10) || 
  '• Interface Avançada: Adicionada a opção de adicionar, configurar e visualizar sub-relatórios no canvas do Report Builder.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'PDF Engine']
);
