-- Migration: 20260624165500_add_movimento_pagamento_rls_policies.sql
-- Adiciona políticas de UPDATE e DELETE na tabela movimento_pagamento para usuários autenticados

-- 1. Cria a política de UPDATE para usuários autenticados
CREATE POLICY "Auth can update mov_pgto" ON public.movimento_pagamento 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 2. Cria a política de DELETE para usuários autenticados
CREATE POLICY "Auth can delete mov_pgto" ON public.movimento_pagamento 
FOR DELETE 
TO authenticated 
USING (true);

-- 3. Registrar versão
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.1',
  'Políticas de RLS para movimento_pagamento',
  'Adicionadas as políticas de UPDATE e DELETE na tabela movimento_pagamento para permitir que usuários autenticados possam alterar e excluir formas de pagamento de pedidos.',
  'Antigravity',
  'Produção',
  ARRAY['PostgreSQL', 'Supabase', 'Database Schema']
);
