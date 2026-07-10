-- Migration: 20260708084800_add_fu_pdv_estornar_venda.sql
-- Description: Creates the fu_pdv_estornar_venda database function to revert a finalized cashier sale (status R) back to open/draft (status F), restoring stock and removing cash register & financeiro data. Registers version 1.18.29.

CREATE OR REPLACE FUNCTION public.fu_pdv_estornar_venda(
  _movimento_id bigint, 
  _usuario_id uuid DEFAULT NULL::uuid
) 
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mov RECORD;
  v_item RECORD;
  v_valor_deduzir_caixa numeric := 0;
  v_caixa_abertura_id bigint;
  v_soma_caixa boolean;
BEGIN
  -- 1. Verifica movimento
  SELECT * INTO v_mov FROM movimento WHERE movimento_id = _movimento_id AND excluido = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Movimento não encontrado.');
  END IF;

  -- Só permite estornar movimentos recebidos (status 'R')
  IF v_mov.st_pedido <> 'R' THEN
    RETURN jsonb_build_object('error', 'Apenas vendas finalizadas (status R) podem ser estornadas.');
  END IF;

  -- 2. Restaura o estoque físico e reservado dos itens do movimento
  FOR v_item IN SELECT * FROM movimento_item WHERE movimento_id = _movimento_id AND excluido = false LOOP
    UPDATE estoque 
    SET estoque_reservado = estoque_reservado + v_item.qt_movimento,
        estoque_fisico = estoque_fisico + v_item.qt_movimento
    WHERE produto_id = v_item.produto_id AND empresa_id = v_mov.empresa_id AND deposito_id = 1;
  END LOOP;

  -- 3. Calcula o valor a deduzir do caixa_abertura (meios de pagamento que somam ao caixa)
  FOR v_item IN 
    SELECT cmi.vl_recebido, cmi.meio_pagamento_id 
    FROM caixa_movimento_item cmi
    JOIN caixa_movimento cm ON cm.caixa_movimento_id = cmi.caixa_movimento_id
    WHERE cm.movimento_id = _movimento_id AND cm.excluido = false
  LOOP
    IF v_item.meio_pagamento_id IS NOT NULL THEN
      SELECT UPPER(soma_vl_caixa) = 'S' INTO v_soma_caixa FROM meio_pagamento WHERE meio_pagamento_id = v_item.meio_pagamento_id;
      IF v_soma_caixa THEN
        v_valor_deduzir_caixa := v_valor_deduzir_caixa + v_item.vl_recebido;
      END IF;
    END IF;
  END LOOP;

  -- 4. Deduz do caixa_abertura
  IF v_valor_deduzir_caixa > 0 THEN
    SELECT DISTINCT caixa_abertura_id INTO v_caixa_abertura_id
    FROM caixa_movimento
    WHERE movimento_id = _movimento_id AND excluido = false;
    
    IF v_caixa_abertura_id IS NOT NULL THEN
      UPDATE caixa_abertura
      SET vl_fechamento = GREATEST(0, COALESCE(vl_fechamento, 0) - v_valor_deduzir_caixa)
      WHERE caixa_abertura_id = v_caixa_abertura_id;
    END IF;
  END IF;

  -- 5. Exclui os lançamentos de caixa_movimento e caixa_movimento_item
  DELETE FROM caixa_movimento_item WHERE caixa_movimento_id IN (
    SELECT caixa_movimento_id FROM caixa_movimento WHERE movimento_id = _movimento_id
  );
  DELETE FROM caixa_movimento WHERE movimento_id = _movimento_id;

  -- 6. Exclui parcelas do financeiro associadas a este movimento_id
  DELETE FROM public.financeiro WHERE movimento_id = _movimento_id;

  -- 7. Atualiza o status do pedido de volta para 'F' (No Caixa)
  UPDATE movimento 
  SET st_pedido = 'F', 
      dt_alteracao = now() 
  WHERE movimento_id = _movimento_id;

  -- 8. Registra auditoria
  INSERT INTO public.auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
  VALUES ('movimento', _movimento_id::text, 'STATUS_ESTORNO_PDV', jsonb_build_object('status', 'R'), jsonb_build_object('status', 'F'), _usuario_id);

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- 9. Registro da Versão 1.18.29 (DML)
DELETE FROM public.sistema_versoes WHERE versao = '1.18.29';

INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias, created_at)
VALUES (
  '1.18.29',
  'Funcionalidade de Estornar Venda no PDV',
  'Implementação da rotina de estorno/reversão de venda recebida de volta ao estado de pré-venda (status F) no caixa. Atualiza estoque, caixa abertura e exclui lançamentos do caixa e do financeiro.',
  'AI Antigravity',
  'Produção',
  ARRAY['React', 'TypeScript', 'Supabase', 'PostgreSQL'],
  now()
);
