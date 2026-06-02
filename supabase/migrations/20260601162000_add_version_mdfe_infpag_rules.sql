-- Migration: 20260601162000_add_version_mdfe_infpag_rules.sql
-- Registra a nova versão do sistema com as regras da tag infPag e melhorias no MDF-e

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.16.11',
  'Regras de Pagamento infPag no MDF-e',
  'Implementado o controle condicional do grupo infPag para MDF-e conforme regras de Carga Lotação:' || chr(10) || chr(10) ||
  '• Ocultação Dinâmica de Abas: As abas "Pagamento", "Componentes" e "Parcelas" são dinamicamente exibidas apenas quando a tag infPag for obrigatória (Modal Rodoviário, 1 Documento vinculado e tpEmit 1, 2 [com tpTransp] ou 3).' || chr(10) ||
  '• Correção de Exclusão de Itens: Corrigido o bug na exclusão de Parcelas e Componentes de pagamento de frete (alterando de soft-delete para deleção direta devido à ausência da coluna excluido no banco).' || chr(10) ||
  '• Limpeza dos Componentes: Limpo o combobox de tipos de componentes na aba de Componentes para exibir apenas as opções oficiais da NT 2025.001 (Vale Pedágio, Impostos, Despesas, Frete e Outros).' || chr(10) ||
  '• Geração Automática do INI: Configurada a geração dinâmica das seções [infPag001], [Comp001xxx] e [infPrazo001xxx] no gerador de arquivos INI enviado ao ACBrLib.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL']
);
