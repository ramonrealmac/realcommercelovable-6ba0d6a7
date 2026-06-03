-- Migration: 20260602101500_add_version_tp_proprietario_options.sql
-- Insere registro da nova versão contendo a automação do MDF-e e novos campos no cadastro

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.15',
  'Automação MDF-e e Novos Campos de Proprietário no Cadastro',
  '1. Automação do MDF-e:' || chr(10) ||
  '• Removidos os campos manuais de Contratante, Transportador e CIOT da tela de emissão do MDF-e.' || chr(10) ||
  '• O contratante é preenchido automaticamente com os dados da empresa logada.' || chr(10) ||
  '• O documento do transportador é obtido dinamicamente a partir do proprietário do veículo de tração adicionado.' || chr(10) ||
  '• As validações de salvamento foram flexibilizadas para permitir rascunhos, validando dados obrigatórios no envio.' || chr(10) || chr(10) ||
  '2. Novos Campos no Cadastro de Parceiros:' || chr(10) ||
  '• Adicionados os campos "Tipo de Proprietário" (0 - TAC Agregado, 1 - TAC Independente, 2 - Outros), "RNTRC" e "UF Proprietário" na aba Endereço/Contato (seção Vínculos).' || chr(10) ||
  '• Os campos são opcionais e ficam editáveis apenas se "Transportador?" estiver marcado como "Sim".',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
