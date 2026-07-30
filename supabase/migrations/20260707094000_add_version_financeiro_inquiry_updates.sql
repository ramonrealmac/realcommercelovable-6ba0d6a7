-- Migration: 20260707094000_add_version_financeiro_inquiry_updates.sql
-- Description: Registers version 1.18.18 for date period filters, keyboard navigation, and client search column layout.

-- 1. Registro da Versão 1.18.18 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.18';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.18',
  'Melhorias na Consulta de Títulos e Busca de Clientes',
  'Implementação de melhorias e validações no módulo financeiro e na pesquisa de clientes:' || chr(10) || chr(10) ||
  '• Filtro por Período de Datas: Integração de Dt. Inicial e Dt. Final condicionadas à combo de Tipo de Data (Emissão, Vencimento e Baixa) com inputs desabilitados por padrão.' || chr(10) ||
  '• Validação de Intervalo: Bloqueio de buscas com Dt. Inicial maior que Dt. Final, exibindo modal de alerta central e destacando campos com proteção de digitação (ano com 4 dígitos).' || chr(10) ||
  '• Coluna Dt. Baixa: Exibição da coluna com a data de pagamento na grid de títulos, resolvida por meio de relacionamento paralelo com a tabela financeiro_baixa.' || chr(10) ||
  '• Carregamento Manual: A grid passa a iniciar vazia e não executa buscas automáticas ao alterar os filtros, exigindo o clique em "Aplicar" para processar a consulta e limpar a grade no botão "Limpar".' || chr(10) ||
  '• Pesquisa por Colunas: Reformulação estética do diálogo de busca de clientes, passando a alinhar os resultados em colunas (Código sem # alinhado à esquerda e CPF/CNPJ formatado com máscara).',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
