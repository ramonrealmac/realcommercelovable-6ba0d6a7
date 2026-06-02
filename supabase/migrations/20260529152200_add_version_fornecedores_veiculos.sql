-- Migration: 20260529152200_add_version_fornecedores_veiculos.sql
-- Insere registro da nova versão contendo a exibição dinâmica da aba Veículos e comboboxes no cadastro de Fornecedores/Transportadores

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.4',
  'Exibição Dinâmica de Veículos em Fornecedores/Transportadores',
  'Implementada a exibição condicional da aba de Veículos na tela de Fornecedores/Transportadores:' || chr(10) || chr(10) || 
  '• Aba Dinâmica: A aba "Veículos" passa a ser exibida somente quando o parceiro possuir a opção "Transportador" definida como "Sim". Caso seja alterado para "Não", a aba é ocultada e a visualização é redirecionada de volta à aba geral.' || chr(10) || 
  '• Integração com cadastro_veiculo: A aba de veículos foi integrada com a tabela cadastro_veiculo, carregando e salvando as informações vinculadas ao parceiro.' || chr(10) || 
  '• Componentes de Combobox Premium: Substituídos os selects HTML nativos pelos componentes shadcn Select para os campos de Tipo de Veículo (Tração/Reboque), Tipo de Rodado e Tipo de Carroceria. Incluída limpeza inteligente dos dados de rodado/carroceria antigos da base para compatibilizar com os códigos de 2 dígitos exigidos pelo MDF-e.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
