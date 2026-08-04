-- Migration: Unify status columns in movimento table
-- Description: Drop unused 'status' column and migrate stock adjustment status values to 'st_pedido'.

-- 1. Copy values from 'status' to 'st_pedido' for all Ajuste de Estoque records where st_pedido is null
UPDATE public.movimento 
SET st_pedido = COALESCE(status, 'A') 
WHERE tp_movimento = 'AE' AND st_pedido IS NULL;

-- 2. Drop the unused 'status' column from movimento table
ALTER TABLE public.movimento DROP COLUMN IF EXISTS status;

-- 3. Recreate the 'fu_finalizar_ajuste_estoque' function to use 'st_pedido' instead of 'status'
CREATE OR REPLACE FUNCTION public.fu_finalizar_ajuste_estoque(_movimento_id bigint, _usuario_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_mov RECORD;
    v_item RECORD;
    v_deposito_nome text;
    v_estoque_atual numeric;
    v_estoque_novo numeric;
    v_qt_fisica numeric;
    v_usuario_email text;
BEGIN
    -- 1. Obter e validar o movimento principal
    SELECT * INTO v_mov 
    FROM movimento 
    WHERE movimento_id = _movimento_id 
      AND excluido = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Ajuste de estoque não encontrado.');
    END IF;

    -- Garantir que é um ajuste de estoque
    IF v_mov.tp_movimento != 'AE' THEN
        RETURN jsonb_build_object('error', 'O tipo de movimento não é Ajuste de Estoque (AE).');
    END IF;

    -- Verificar se já foi finalizado
    IF v_mov.st_pedido = 'F' THEN
        RETURN jsonb_build_object('error', 'Este ajuste de estoque já foi finalizado.');
    END IF;

    -- Obter e-mail do usuário realizador do ajuste
    IF _usuario_id IS NOT NULL THEN
        SELECT email INTO v_usuario_email 
        FROM auth.users 
        WHERE id = _usuario_id;
    END IF;
    IF v_usuario_email IS NULL THEN
        v_usuario_email := 'SISTEMA';
    END IF;

    -- 2. ETAPA DE PRÉ-VALIDAÇÃO (Estoque Não-Negativo)
    FOR v_item IN 
        SELECT mi.* 
        FROM movimento_item mi
        WHERE mi.movimento_id = _movimento_id 
          AND mi.excluido = false
    LOOP
        -- Se o depósito não estiver definido no item, herdar do cabeçalho
        IF v_item.deposito_id IS NULL THEN
            v_item.deposito_id := v_mov.deposito_id;
        END IF;

        IF v_item.deposito_id IS NULL THEN
            RETURN jsonb_build_object('error', 'O produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ' não possui depósito definido.');
        END IF;

        -- Obter estoque físico atual
        SELECT COALESCE(estoque_fisico, 0) INTO v_estoque_atual
        FROM estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_item.deposito_id
          AND empresa_id = v_mov.empresa_id;

        IF v_estoque_atual IS NULL THEN
            v_estoque_atual := 0;
        END IF;

        -- Calcular estoque projetado
        IF v_item.tp_ajs_estoque = 'A' THEN
            v_estoque_novo := v_estoque_atual + v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'R' THEN
            v_estoque_novo := v_estoque_atual - v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'M' THEN
            v_estoque_novo := v_item.qt_movimento;
        ELSE
            RETURN jsonb_build_object('error', 'O item com produto ' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ' possui tipo de ajuste (tp_ajs_estoque) inválido: ' || COALESCE(v_item.tp_ajs_estoque, 'Nulo'));
        END IF;

        -- Validar estoque não-negativo
        IF v_estoque_novo < 0 THEN
            SELECT nm_deposito INTO v_deposito_nome FROM deposito WHERE deposito_id = v_item.deposito_id;
            RETURN jsonb_build_object('error', 'Validação de estoque: O produto ''' || COALESCE(v_item.nm_produto, 'ID ' || v_item.produto_id) || ''' no depósito ''' || COALESCE(v_deposito_nome, 'ID ' || v_item.deposito_id) || ''' ficaria com saldo negativo (' || v_estoque_novo || ' unidades). Operação abortada.');
        END IF;
    END LOOP;

    -- 3. ETAPA DE PROCESSAMENTO (Inserção no estoque_log e atualização de status)
    FOR v_item IN 
        SELECT mi.* 
        FROM movimento_item mi
        WHERE mi.movimento_id = _movimento_id 
          AND mi.excluido = false
    LOOP
        -- Se o depósito não estiver definido no item, herdar do cabeçalho
        IF v_item.deposito_id IS NULL THEN
            v_item.deposito_id := v_mov.deposito_id;
        END IF;

        -- Garantir que existe o registro mestre na tabela estoque
        IF NOT EXISTS (
            SELECT 1 FROM estoque
            WHERE produto_id = v_item.produto_id
              AND deposito_id = v_item.deposito_id
              AND empresa_id = v_mov.empresa_id
        ) THEN
            INSERT INTO estoque (empresa_id, produto_id, deposito_id, estoque_fisico, estoque_reservado, estoque_disponivel, dt_criacao, dt_alteracao)
            VALUES (v_mov.empresa_id, v_item.produto_id, v_item.deposito_id, 0, 0, 0, now(), now());
        END IF;

        -- Obter estoque físico atual (agora garantido)
        SELECT COALESCE(estoque_fisico, 0) INTO v_estoque_atual
        FROM estoque
        WHERE produto_id = v_item.produto_id
          AND deposito_id = v_item.deposito_id
          AND empresa_id = v_mov.empresa_id;

        -- Calcular a variação a ser enviada para a trigger do estoque_log
        IF v_item.tp_ajs_estoque = 'A' THEN
            v_qt_fisica := v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'R' THEN
            v_qt_fisica := -v_item.qt_movimento;
        ELSIF v_item.tp_ajs_estoque = 'M' THEN
            v_qt_fisica := v_item.qt_movimento - v_estoque_atual;
        END IF;

        -- Inserir na tabela estoque_log. A trigger tr_estoque_log_processamento 
        -- tratará o update no estoque e recalculará os saldos.
        INSERT INTO estoque_log (
            empresa_id,
            produto_id,
            deposito_id,
            qt_movimento,
            usuario,
            operacao,
            origem,
            nr_doc,
            dt_hs_log
        ) VALUES (
            v_mov.empresa_id,
            v_item.produto_id,
            v_item.deposito_id,
            v_qt_fisica,
            v_usuario_email,
            'AJUSTE',
            'AJUSTE_ESTOQUE',
            COALESCE(v_mov.nr_movimento::text, v_mov.movimento_id::text),
            now()
        );
    END LOOP;

    -- 4. Atualizar o cabeçalho do movimento
    UPDATE movimento 
    SET st_pedido = 'F',
        dt_finalizacao = now(),
        dt_alteracao = now()
    WHERE movimento_id = _movimento_id;

    -- 5. Gravar na auditoria do sistema
    INSERT INTO auditoria (xtabela, xregistro_id, xacao, xdados_anteriores, xdados_novos, xusuario_id)
    VALUES (
        'movimento', 
        _movimento_id::text, 
        'FINALIZAR_AJUSTE_ESTOQUE', 
        jsonb_build_object('st_pedido', v_mov.st_pedido), 
        jsonb_build_object('st_pedido', 'F'), 
        _usuario_id
    );

    RETURN jsonb_build_object('success', true, 'message', 'Ajuste de estoque finalizado com sucesso!');
END;
$$;

-- 4. Registrar versão do sistema
DELETE FROM public.sistema_versoes WHERE versao = '1.18.37';
INSERT INTO public.sistema_versoes (versao, titulo, detalhes, autor, fase, tecnologias)
VALUES (
  '1.18.37',
  'Lançamento de Pagamentos, Descontos e Unificação de Status',
  'Melhorias no lançamento de pagamentos de pedidos e limpeza de colunas no banco de dados:' || chr(10) || chr(10) ||
  '• Reversão automática de pagamentos: Permite finalizar com zero pagamentos (excluindo lançados), revertendo o status do pedido para Orçamento e mantendo os descontos e tipo de desconto originais (em vez de resetar).' || chr(10) ||
  '• Preservação de descontos ao retirar do Caixa/Reserva: O tipo de desconto, percentual e valor do cabeçalho e os descontos dos itens são mantidos automaticamente.' || chr(10) ||
  '• Correção de cálculo do Subtotal bruto dos itens (vl_produto) nas telas de pagamento e no total da aba Cadastro para evitar a aplicação dupla de descontos.' || chr(10) ||
  '• Unificação e limpeza no banco de dados: Remoção da coluna duplicada ''status'' na tabela movimento, migrando todos os históricos de status de Ajuste de Estoque (AE) para a coluna unificada ''st_pedido''.' || chr(10) ||
  '• Atualização correspondente na RPC fu_finalizar_ajuste_estoque para rodar sobre a coluna st_pedido.',
  'AI Antigravity',
  'Desenvolvimento',
  ARRAY['PostgreSQL', 'React', 'TypeScript']
);

