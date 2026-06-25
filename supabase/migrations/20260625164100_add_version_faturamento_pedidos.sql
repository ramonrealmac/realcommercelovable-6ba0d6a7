-- Migration: 20260625164100_add_version_faturamento_pedidos.sql
-- Registra a versão 1.18.3 com a funcionalidade de Faturar Pedido (Cupom e NF-e) no Caixa

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.3',
  'Faturar Pedidos no PDV/Caixa',
  'Adicionado o card "Faturar Pedido" nas Funções do Caixa, permitindo ao usuário abrir a listagem de pedidos pendentes de faturamento (faturado = N), filtrar por número ou cliente, escolher o modelo de emissão (Cupom NFC-e ou Nota Fiscal NF-e) e atualizar automaticamente o status para faturado = S após a emissão.',
  'Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'PostgreSQL', 'Supabase']
)
ON CONFLICT (versao) DO UPDATE 
SET titulo = EXCLUDED.titulo,
    detalhes = EXCLUDED.detalhes,
    autor = EXCLUDED.autor,
    fase = EXCLUDED.fase,
    tecnologias = EXCLUDED.tecnologias;
