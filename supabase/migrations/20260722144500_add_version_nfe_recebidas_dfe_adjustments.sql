-- Migration: 20260722144500_add_version_nfe_recebidas_dfe_adjustments.sql
-- Description: Registers version 1.18.36 for log query logic optimization, deposit filtering, quantity formatting, referenced NF-e key, and multiple referenced keys support.

-- Registro de Versionamento do Sistema (Versão 1.18.36)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.36';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.36',
  'Melhorias Fiscais: Logs, Depósitos, Devoluções e Multi-Referenciamento de NF-e',
  'MONITOR FISCAL: Ajustada a lógica de filtragem de logs no MonitorFiscalLogDialog para realizar buscas paralelas pelo ID do cabeçalho da nota e pela chave de acesso (chaveNfe) quando ambos estão presentes. '
  || 'COMBO DEPÓSITO: Corrigida a listagem de depósitos nas telas de Devolução de NF-e de Entrada e de Saída para carregar apenas os depósitos vinculados à empresa ativa logada (empresa_id). '
  || 'CAMPO QUANTIDADE A DEVOLVER: Implementada formatação padrão do sistema no input de quantidade a devolver (qt_devolver) com máscara numérica decimal direita-para-esquerda (0,01 -> 0,10 -> 1,00). '
  || 'TELA DE NOTAS EMITIDAS (CADASTRO): Ocultado o campo ID (controle interno) na aba Cadastro do formulário NfeEmitidaForm, permitindo subir e alinhar o campo Status na mesma primeira linha de 12 colunas do grid. '
  || 'TELA DE NOTAS EMITIDAS (ITENS): Ocultada a coluna Vincular Produto Estoque na grid de itens (NfeItensTab) para notas fiscais de saída normais, habilitando-a dinamicamente quando a finalidade da nota de saída for Devolução (fin_nfe = 4). '
  || 'NF-E REFERENCIADA (MULTI): Implementado suporte completo a múltiplos referenciamentos de NF-e na tabela fiscal_nfe_referenciada. Ao gerar uma devolução, a chave de acesso correspondente é gravada automaticamente. O formulário NfeEmitidaForm foi aprimorado para exibir uma lista dinâmica de campos, permitindo adicionar, editar e remover múltiplos vínculos de chaves referenciadas quando a finalidade for Devolução (fin_nfe = 4). Os emissores de INI e XML foram reestruturados para iterar sobre todas as chaves vinculadas e gerar os blocos fiscais correspondentes (múltiplos grupos [NFRefXXX] e tags <NFref>), atendendo as exigências de devoluções parciais ou consolidadas da SEFAZ. '
  || 'PAGAMENTO EM DEVOLUÇÕES: Ajustada a geração de INI e XML de Notas Fiscais para emitir automaticamente o grupo de pagamento com a opção "Sem Pagamento" (tPag = 90 e vPag = 0.00) quando a finalidade da nota for Devolução (fin_nfe = 4), resolvendo a rejeição da SEFAZ.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'SQL/Migrations'],
  now()
);
