-- Migration: 20260601144000_add_version_fornecedores_motoristas.sql
-- Insere o registro da nova versão referente à aba independente de Motoristas no cadastro de Fornecedores/Transportadores

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.7',
  'Aba Motoristas no Cadastro de Fornecedores/Transportadores',
  'Implementada a nova aba "Motoristas" no formulário de cadastro de Fornecedores e Transportadores:' || chr(10) || chr(10) || 
  '• Exibição Dinâmica: Assim como a aba de Veículos, a aba "Motoristas" é exibida de forma independente apenas quando a opção "Transportador" for definida como "Sim".' || chr(10) || 
  '• Integração de Dados: O grid de motoristas foi integrado à nova tabela "cadastro_motorista", permitindo a persistência das informações de CPF, Nome, Telefone e Chave PIX diretamente vinculadas ao parceiro.' || chr(10) || 
  '• Gravação em Lote (Bulk Save): Configurada a gravação em lote dos motoristas inseridos temporariamente em memória no momento da inclusão de novos parceiros.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
