-- Migration: 20260608115400_add_version_mdfe_carga_lotacao_and_payment_flow.sql
-- Registra a versão contendo as melhorias de layout, limites de campos, correção bancária no INI e busca automática de CEP para Carga Lotação no MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.23',
  'MDF-e: Carga Lotação, Limites de Campos e Ajustes de Fluxo',
  'Implementado refinamento de validações e geração de arquivo para o MDF-e:' || chr(10) || chr(10) ||
  '• Busca Automática de CEP: Implementação de consulta via API do ViaCEP para preencher automaticamente os CEPs de carregamento (infLocalCarrega) e descarregamento (infLocalDescarrega) em operações classificadas como Carga Lotação (apenas 1 origem e 1 destino), sanando rejeições da SEFAZ.' || chr(10) ||
  '• Mapeamento de Tags Bancárias: Correção da estrutura do arquivo INI migrando as propriedades codBanco, codAgencia, CNPJIPEF e PIX para a seção correta [infBanc001], obedecendo à regra de priorização e exclusividade no envio.' || chr(10) ||
  '• Validações e Limites: Adicionadas restrições físicas (maxLength) nos formulários e tratamento de limpeza por regex (sanitização e substring) nos serviços para dados de contratantes, motoristas, veículos e fornecedores de vale-pedágio.' || chr(10) ||
  '• Refinamento de UI: Botão de Transmissão reposicionado no cabeçalho do formulário de dados gerais (ao lado de Status) e exibição dinâmica da aba de parcelas dependendo da forma de pagamento selecionada.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'ViaCEP API']
);
