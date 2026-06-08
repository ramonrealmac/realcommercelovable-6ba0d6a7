-- Migration: 20260603103500_add_version_mdfe_ini_ssl_ajustes.sql
-- Registra a nova versão com os ajustes de integração, nomenclatura INI e conectividade SSL no MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.16',
  'Ajustes de Integração e Conectividade do MDF-e',
  'Implementadas correções estruturais no gerador de INI e na infraestrutura de rede do worker para o MDF-e:' || chr(10) || chr(10) ||
  '• Nomenclatura do INI (ACBrLib): Corrigidas as seções de Condutor (de [condutor] para [moto]), Descarregamento (de [infMunDesc] para [DESC], com chaves cMunDescarga e xMunDescarga), Carregamento (de [infMunCarrega] para [CARR]) e Percurso (de [infPercurso] para [perc]) para conformidade com o parser oficial da ACBrLib.' || chr(10) ||
  '• Separação de Consultas (PGRST200): Removidos os joins diretos nas tabelas relacionais do MDF-e que falhavam silenciosamente devido à ausência de chaves estrangeiras declaradas no Supabase, passando a buscar cidades e motoristas em memória.' || chr(10) ||
  '• Correção Winsock 10091 (Network Unusable): Copiadas as DLLs de dependência do OpenSSL e LibXML2 de 64 bits para as pastas de StdCall e raiz de execução do worker, viabilizando a comunicação SSL/TLS com a SEFAZ.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Node.js', 'OpenSSL', 'ACBrLib']
);
