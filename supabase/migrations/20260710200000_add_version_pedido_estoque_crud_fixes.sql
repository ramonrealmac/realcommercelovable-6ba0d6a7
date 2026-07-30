-- Migration: 20260710200000_add_version_pedido_estoque_crud_fixes.sql
-- Description: Registers version 1.18.32 for order, stock, and CRUD fixes applied on 2026-07-10.

-- 1. Registro da Versão 1.18.32 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.32';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.32',
  'Pedido / Estoque / CRUD - Correções de UX e Comportamento (2026-07-10)',
  'PEDIDO - ITENS: Campo de quantidade nos itens agora respeita as casas decimais configuradas no cadastro da empresa (qt_venda_qt_decimais), tanto no campo de digitação quanto na exibição na grid. '
  || 'PEDIDO - CADASTRO: Ao teclar Enter no campo "Tipo de Desconto" durante inclusão de novo pedido, o sistema salva, muda para a aba Itens e atualiza corretamente a aba Cadastro com o número e dados do novo pedido gerado. '
  || 'ESTOQUE: Inputs de Mínimo, Padrão e Inventário substituídos por CurrencyInput com formatação brasileira e casas decimais dinâmicas da empresa. Depósitos privados incluídos no filtro para exibição correta dos registros salvos na grid. '
  || 'CRUD BASE (useCrudController): '
  || '(1) Bug de exclusão corrigido: registro removido imediatamente do estado local após delete, sem depender do recarregamento do cache. '
  || '(2) Bug de seleção após insert corrigido: substituído setTimeout por uso direto da lista retornada pelo refetch(), eliminando race condition que mantinha o registro antigo selecionado na aba Cadastro. '
  || '(3) Substituído invalidateQueries por removeQueries para forçar limpeza total do cache React Query antes do refetch, garantindo dados atualizados do banco.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL', 'React Query'],
  now()
);
