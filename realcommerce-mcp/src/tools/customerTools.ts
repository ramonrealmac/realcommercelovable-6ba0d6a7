import { supabase } from '../index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { parseStringPromise } from 'xml2js';

export const customerTools = {
  list_customers: async (args: { query?: string; limit?: number }) => {
    const { query, limit = 10 } = args;
    
    let dbQuery = supabase
      .from('cadastro')
      .select('cadastro_id, razao_social, nome_fantasia, cnpj, fone_geral, email')
      .eq('excluido', false);

    if (query) {
      dbQuery = dbQuery.or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%,cnpj.ilike.%${query}%`);
    }

    const { data, error } = await dbQuery.limit(limit);

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar clientes: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  },

  get_customer_details: async (args: { customer_id: number }) => {
    const { customer_id } = args;
    
    const { data, error } = await supabase
      .from('cadastro')
      .select('*')
      .eq('cadastro_id', customer_id)
      .single();

    if (error) {
      throw new McpError(ErrorCode.InternalError, `Erro ao buscar detalhes do cliente: ${error.message}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
  },

  lookup_cnpj: async (args: { cnpj: string }) => {
    const { cnpj } = args;
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      throw new McpError(ErrorCode.InvalidParams, 'CNPJ inválido. Deve conter 14 dígitos.');
    }

    try {
      // Chama a Edge Function do Supabase
      const { data, error } = await supabase.functions.invoke('consulta-cnpj', {
        body: { cnpj: cleanCnpj },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
      };
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Erro ao consultar CNPJ: ${err.message}`);
    }
  },

  create_customer: async (args: { customer_data: any }) => {
    const { customer_data } = args;
    
    // Se tiver ID, atualiza, senão insere
    if (customer_data.cadastro_id) {
      const { data, error } = await supabase
        .from('cadastro')
        .update(customer_data)
        .eq('cadastro_id', customer_data.cadastro_id)
        .select()
        .single();
        
      if (error) throw new McpError(ErrorCode.InternalError, `Erro ao atualizar cliente: ${error.message}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    } else {
      const { data, error } = await supabase
        .from('cadastro')
        .insert(customer_data)
        .select()
        .single();
        
      if (error) throw new McpError(ErrorCode.InternalError, `Erro ao cadastrar cliente: ${error.message}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  },

  import_customer_xml: async (args: { xml_content: string }) => {
    const { xml_content } = args;

    try {
      const result = await parseStringPromise(xml_content, { explicitArray: false });
      const nfe = result.nfeProc?.NFe || result.NFe;
      if (!nfe) throw new Error('Estrutura NFe não encontrada no XML.');

      const emit = nfe.infNFe.emit;
      const enderEmit = emit.enderEmit;

      const customerData = {
        cnpj: (emit.CNPJ || emit.CPF || '').replace(/\D/g, ''),
        razao_social: (emit.xNome || '').toUpperCase(),
        nome_fantasia: (emit.xFant || emit.xNome || '').toUpperCase(),
        inscricao_estadual: emit.IE,
        endereco_logradouro: (enderEmit.xLgr || '').toUpperCase(),
        endereco_numero: enderEmit.nro,
        endereco_bairro: (enderEmit.xBairro || '').toUpperCase(),
        endereco_cep: (enderEmit.CEP || '').replace(/\D/g, ''),
        fone_geral: (emit.fone || '').replace(/\D/g, ''),
        st_fornecedor: 'S', // Geralmente importamos XML de fornecedores
        st_cliente: 'N'
      };

      // Tenta encontrar cidade_id pelo código IBGE
      if (enderEmit.cMun) {
        const { data: cidade } = await supabase
          .from('cidade')
          .select('cidade_id')
          .eq('cd_ibge', enderEmit.cMun)
          .maybeSingle();
        if (cidade) {
          (customerData as any).endereco_cidade_id = cidade.cidade_id;
        }
      }

      return await customerTools.create_customer({ customer_data: customerData });
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Erro ao importar XML: ${err.message}`);
    }
  }
};
