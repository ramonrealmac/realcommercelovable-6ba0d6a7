-- Migration para limpar notas geradas indevidamente nos testes da Empresa 5 / Pedido 197 (movimento_id 358)
-- Mantendo apenas a NF-e original #45 (ID 137) reconfigurada com o NCM correto (64019990)

DO $$
BEGIN
  -- 1. Remover itens e registros de rascunhos temporários criados nos testes
  DELETE FROM public.fiscal_nfe_item WHERE nfe_cabecalho_id IN (138, 139, 140, 141, 142, 143, 144);
  DELETE FROM public.fiscal_evento WHERE nfe_cabecalho_id IN (138, 139, 140, 141, 142, 143, 144);
  DELETE FROM public.fiscal_nfe_pagamento WHERE nfe_cabecalho_id IN (138, 139, 140, 141, 142, 143, 144);
  DELETE FROM public.fiscal_nfe_referenciada WHERE nfe_cabecalho_id IN (138, 139, 140, 141, 142, 143, 144);
  DELETE FROM public.fiscal_nfe_cabecalho WHERE nfe_cabecalho_id IN (138, 139, 140, 141, 142, 143, 144);

  -- 2. Atualizar NCM e dados do item da NF-e #45 (ID 137) com base no cadastro correto do produto
  UPDATE public.fiscal_nfe_item
     SET ncm = '64019990',
         nm_produto = 'TESTE DE PRODUTO',
         gtin = 'SEM GTIN'
   WHERE nfe_cabecalho_id = 137;

  -- 3. Resetar status da NF-e #45 para 'R' (Rejeitada/Pronta para envio) e limpar chave temporária
  UPDATE public.fiscal_nfe_cabecalho
     SET st_nf = 'R',
         chave_nfe = ''
   WHERE nfe_cabecalho_id = 137;
END $$;
