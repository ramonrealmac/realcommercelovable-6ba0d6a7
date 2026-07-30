-- Migration: 20260714113500_add_version_pedido_keyboard_navigation_fixes.sql
-- Description: Registers version 1.18.34 for keyboard navigation in Payment dialog and order creation flow fixes.

-- 1. Registro da Versão 1.18.34 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.34';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.34',
  'Pedidos e Meios de Pagamento - Navegação por Teclado e Foco (2026-07-14)',
  'MEIOS DE PAGAMENTO (PDV): Implementada navegação completa por teclado utilizando a tecla ENTER para navegar sequencialmente entre os campos (Condição, Bandeira, Operadora, Nº Autorização, Valor a Pagar, Confirmar, Finalizar Recebimento). '
  || 'SELECTS/COMBOBOX: Adicionado suporte para Alt+Seta Baixo para abrir o seletor, Setas Cima/Baixo para navegar pelos itens sem abrir a combo, e ENTER para confirmar a seleção e pular para o próximo campo. '
  || 'BOTÕES: Invertida a ordem dos botões de rodapé na tela de pagamento para exibir o botão de Finalizar Recebimento primeiro e o Sair em seguida. '
  || 'INCLUSÃO DE PEDIDOS: Configurado que ao teclar ENTER no campo Tipo de Desconto em modo de inserção, o pedido é salvo imediatamente, o campo do número do pedido é populado com o código gerado no banco, o formulário altera para modo de edição e a aba muda para Itens com o foco apontando diretamente para o campo Código/EAN. '
  || 'CONTROLE CRUD: Corrigido bug crítico e condição de corrida no useCrudController que fazia o formulário re-renderizar apontando para o primeiro registro da listagem (Pedido 1) ao alternar de inserção para edição antes que a recarga assíncrona do banco finalizasse.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
