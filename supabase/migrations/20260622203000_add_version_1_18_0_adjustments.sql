-- Migration: 20260622203000_add_version_1_18_0_adjustments.sql
-- Registra a versão 1.18.0 com as melhorias do formulário de pedidos, busca automática de CEP, rota e pagamentos

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.0',
  'Pedidos: Dados de Entrega Dinâmicos, CEP Autocomplete e Teclado no Pagamento',
  'Implementada exibição e ocultação dinâmica da aba Dados de Entrega baseada no status de entrega, bem como a limpeza automática de seus campos ao selecionar Não. Adicionada a busca e preenchimento automático de endereço via ViaCEP por código IBGE ou nome de cidade sem acentuação (ex: SAO LUIS - MA). Adicionado filtro de rotas por empresa logada e navegação por Enter na aba de entrega. Atualizada a tela de pagamento com atalho F6, abertura por Alt+Seta Baixo da condição, navegação por Enter nos campos de valor/adicionar e bloqueio de inputs ao zerar o saldo.',
  'AI Antigravity',
  'Fase 18',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'SQL/Migrations'],
  now()
);
