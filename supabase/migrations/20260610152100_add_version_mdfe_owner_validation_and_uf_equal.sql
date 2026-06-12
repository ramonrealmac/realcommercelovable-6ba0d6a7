-- Migration: 20260610152100_add_version_mdfe_owner_validation_and_uf_equal.sql
-- Registra a versão contendo as melhorias de validação do proprietário, filtro de veículos, limpeza de dados e correção de percurso para UFs iguais no MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.24',
  'MDF-e: Validação de Proprietário e Correção de Percurso para UFs Iguais',
  'Implementado refinamento de validações e persistência de dados para o MDF-e:' || chr(10) || chr(10) ||
  '• Validação de Proprietário (TAC): Ajustada a validação do tipo de transportador no cadastro e na emissão. Agora, proprietários com CPF são restritos a TAC Agregado (0) ou TAC Independente (1), enquanto proprietários com CNPJ são restritos a Outros (2). O Tipo de Proprietário passa a ser obrigatório apenas para parceiros cujo documento difere do CNPJ da empresa logada.' || chr(10) ||
  '• Filtro de Veículos por Transportador: A aba de veículos vinculados ao manifesto foi ajustada para listar e permitir selecionar apenas os veículos cadastrados para o transportador do cabeçalho.' || chr(10) ||
  '• Geração Segura do INI: Mapeamento direto de tpProp e tpTransp no INI com regras de segurança adicionais para compatibilidade na SEFAZ baseada no documento do proprietário da tração.' || chr(10) ||
  '• Limpeza de Grids: Desvinculação automática de veículos e motoristas vinculados quando o transportador do MDF-e é alterado na edição.' || chr(10) ||
  '• Correção de UFs Iguais / Divisas: Correção do fluxo de salvamento de UFs iguais/vizinhas (ex: SP para SP). O sistema agora desabilita a adição de percurso no frontend e, durante a gravação (XOnBeforeSave), marca todos os percursos intermediários anteriores associados ao MDF-e como excluídos (excluido = true) no banco de dados, permitindo a correta gravação da UF de Descarregamento (uffim).',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
