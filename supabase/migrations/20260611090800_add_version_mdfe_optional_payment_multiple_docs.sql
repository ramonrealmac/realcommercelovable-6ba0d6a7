-- Migration: 20260611090800_add_version_mdfe_optional_payment_multiple_docs.sql
-- Registra a versão contendo a flexibilização das obrigatoriedades de pagamento e componentes no MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.25',
  'MDF-e: Opcionalidade de Pagamento para Múltiplos Documentos',
  'Implementada a flexibilização de regras de validação para emissão de MDF-e:' || chr(10) || chr(10) ||
  '• Opcionalidade de Pagamento e Componentes (TAC): Quando o manifesto eletrônico possuir mais de 1 documento fiscal (NF-e ou CT-e) cadastrado, o preenchimento de componentes de pagamento, dados bancários e parcelas passa a ser opcional (não obrigatório).' || chr(10) ||
  '• Validação no Frontend e Backend: As validações no formulário de cadastro (MdfeForm) e no serviço de emissão/transmissão (mdfeEmissaoService) foram atualizadas para verificar a quantidade de documentos ativos antes de exigir as informações financeiras de TAC.' || chr(10) ||
  '• Visibilidade das Abas: As abas de Pagamento, Componentes e Parcelas permanecem visíveis para transportadores do tipo TAC, permitindo que o usuário as preencha opcionalmente caso seja de seu interesse.',
  'Antigravity',
  'Desenvolvimento',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
