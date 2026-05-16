import { supabase } from '../index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const companyTools = {
  get_company_config: async (args: { empresa_id?: number }) => {
    const { empresa_id } = args;
    
    let dbQuery = supabase
      .from('empresa')
      .select('*')
      .eq('excluido', false);

    if (empresa_id) {
      dbQuery = dbQuery.eq('empresa_id', empresa_id);
    } else {
      // Default to first company if not specified
      dbQuery = dbQuery.limit(1);
    }

    const { data, error } = await dbQuery.single();

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar configuração da empresa: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  }
};
