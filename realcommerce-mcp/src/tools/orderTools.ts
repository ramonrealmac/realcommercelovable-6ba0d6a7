import { supabase } from '../index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const orderTools = {
  create_order: async (args: { customer_id: number; items: any[]; order_data?: any }) => {
    const { customer_id, items, order_data = {} } = args;

    try {
      // 1. Inserir Cabeçalho do Movimento (caixa_movimento)
      const { data: movement, error: movError } = await supabase
        .from('caixa_movimento')
        .insert({
          cadastro_id: customer_id,
          empresa_id: 1, // Default para exemplo
          tp_mov: 'S', // Saída/Venda
          st_mov: 'O', // Orçamento inicial
          dt_mov: new Date().toISOString(),
          vl_total: items.reduce((acc, item) => acc + (item.vl_unit * item.qt_item), 0),
          ...order_data
        })
        .select()
        .single();

      if (movError) throw movError;

      // 2. Inserir Itens (caixa_movimento_item)
      const movementItems = items.map((item, index) => ({
        movimento_id: movement.movimento_id,
        produto_id: item.produto_id,
        nr_item: index + 1,
        qt_item: item.qt_item,
        vl_unit: item.vl_unit,
        vl_total: item.vl_unit * item.qt_item,
        unidade: item.unidade || 'UN'
      }));

      const { error: itemsError } = await supabase
        .from('caixa_movimento_item')
        .insert(movementItems);

      if (itemsError) throw itemsError;

      return {
        content: [{ 
          type: 'text', 
          text: `Pedido criado com sucesso. Movimento ID: ${movement.movimento_id}` 
        }]
      };
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Erro ao criar pedido: ${err.message}`);
    }
  },

  list_orders: async (args: { customer_id?: number; limit?: number }) => {
    const { customer_id, limit = 10 } = args;
    
    let query = supabase
      .from('caixa_movimento')
      .select('movimento_id, dt_mov, st_mov, vl_total, cadastro(razao_social)')
      .eq('excluido', false);

    if (customer_id) {
      query = query.eq('cadastro_id', customer_id);
    }

    const { data, error } = await query.order('dt_mov', { ascending: false }).limit(limit);

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao listar pedidos: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  },
  
  list_payment_conditions: async (args: { query?: string; limit?: number }) => {
    const { query, limit = 20 } = args;
    
    let dbQuery = supabase
      .from('condicao_pagamento')
      .select('*')
      .eq('excluido', false);

    if (query) {
      dbQuery = dbQuery.ilike('descricao', `%${query}%`);
    }

    const { data, error } = await dbQuery.limit(limit);

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar condições de pagamento: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
