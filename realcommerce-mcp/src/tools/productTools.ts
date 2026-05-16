import { supabase } from '../index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const productTools = {
  list_products: async (args: { query?: string; limit?: number }) => {
    const { query, limit = 10 } = args;
    
    let dbQuery = supabase
      .from('produto')
      .select('produto_id, nome, cd_barras, referencia, vl_venda, qt_estoque')
      .eq('excluido', false);

    if (query) {
      const isId = /^\d+$/.test(query);
      if (isId) {
        dbQuery = dbQuery.or(`produto_id.eq.${query},nome.ilike.%${query}%,cd_barras.ilike.%${query}%,referencia.ilike.%${query}%`);
      } else {
        dbQuery = dbQuery.or(`nome.ilike.%${query}%,cd_barras.ilike.%${query}%,referencia.ilike.%${query}%`);
      }
    }

    const { data, error } = await dbQuery.limit(limit);

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar produtos: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  },

  get_product_details: async (args: { product_id: number }) => {
    const { product_id } = args;
    
    const { data, error } = await supabase
      .from('produto')
      .select('*')
      .eq('produto_id', product_id)
      .single();

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar detalhes do produto: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
