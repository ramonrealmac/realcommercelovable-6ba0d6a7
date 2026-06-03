-- Migration: 20260601155000_add_version_mdfe_veiculos_motoristas.sql
-- Registra a nova versão do sistema com as melhorias implementadas na aba Veículos/Motoristas do MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.10',
  'Aba Veículos e Motoristas do MDF-e',
  'Implementadas melhorias críticas de usabilidade e integridade na aba de Veículos/Motoristas do MDF-e:' || chr(10) || chr(10) ||
  '• Layout Lado a Lado: Grid de Veículos e Motoristas reposicionados lado a lado para otimizar espaço de tela.' || chr(10) ||
  '• Ajuste do Campo CPF: Redimensionada a coluna de CPF para 160px e configurado whitespace-nowrap para impedir quebras de linha indesejadas.' || chr(10) ||
  '• Regra de Desvinculação Automática: Se o último veículo de um transportador for removido do manifesto, todos os motoristas associados àquele transportador são automaticamente desvinculados.' || chr(10) ||
  '• Sincronização em Tempo Real: Adicionado controle de re-renderização por gatilho (refresh trigger) entre as abas de Veículos e Motoristas no formulário do MDF-e.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
