-- Migration: 20260715163000_add_version_nfe_entrada_enhancements.sql
-- Description: Registers version 1.18.35 for NFe Entrada enhancements.

-- 1. Registro da Versão 1.18.35 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.35';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.35',
  'Entrada de NF-e - Decimais, Simplificação de Tributos e Vínculo de Estoque (2026-07-15)',
  'FILTRO DE DEPÓSITOS: A combo de depósitos na aba Cadastro agora é filtrada estritamente pela empresa logada. '
  || 'DADOS ADICIONAIS: Removido o campo redundante de Chave NF-e, redimensionados os inputs de Protocolo e Origem, e adicionados os campos de Observação do Contribuinte (obs_nf) e Interesse do Fisco (obs_fisco) de forma empilhada na vertical, mapeados automaticamente do XML. '
  || 'DECIMAIS: Ajustadas as funções fmt2 e fmtInput para carregar e formatar todos os inputs de valores e impostos com exatamente 2 casas decimais no carregamento inicial. '
  || 'GRID DE ITENS: Otimizada a largura das colunas curtas (Item, Cód. Forn., NCM, CEST, CFOP, Unidade) e aumentada a coluna de Descrição para 450px. '
  || 'TRIBUTOS DA NF-E: Ocultados impostos adicionais secundários (FCP, FCP-ST e Reforma IS) das colunas da grid e seções do formulário de itens, mantendo apenas os tributos principais da NF-e (ICMS, ICMS-ST, IPI, PIS, COFINS) e da Reforma (IBS e CBS). '
  || 'VÍNCULO COM CÓDIGO: O botão de vínculo com o estoque na grid exibe o código de cadastro do produto (cd_produto) em vez do ID interno sequencial do produto, mantendo a relação lógica intacta pelo ID. '
  || 'CONTROLE DE STATUS: Ajustado o status padrão da Entrada de NF-e para Pendente (P) ao salvar, e para Escriturado (E) após realizar a escrituração da nota, aplicando os devidos bloqueios de edição (XCanEdit) no formulário e sub-abas.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
