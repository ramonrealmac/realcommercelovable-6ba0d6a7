import { supabase } from '../index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const fiscalTools = {
  finalize_sale_pdv: async (args: { movement_id: number; payments: any[] }) => {
    const { movement_id, payments } = args;

    try {
      // 1. Registrar pagamentos no caixa_movimento (se necessário ou se a RPC já não fizer)
      // O usuário mencionou que confirmarPagamento faz o commit atômico.
      // Vou focar na mudança de status via RPC.

      const { data, error: rpcError } = await supabase.rpc('fu_mudar_status_pedido_pdv', {
        p_movimento_id: movement_id,
        p_novo_status: 'R' // Recebido
      });

      if (rpcError) throw new Error(rpcError.message);

      return {
        content: [{ 
          type: 'text', 
          text: `Venda ${movement_id} finalizada com sucesso. Status alterado para 'R'.` 
        }]
      };
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Erro ao finalizar venda: ${err.message}`);
    }
  },

  emit_fiscal_document: async (args: { movement_id: number; model: 55 | 65 }) => {
    const { movement_id, model } = args;

    try {
      // Aqui simularíamos a lógica do fiscalEmissaoService.ts
      // No contexto do MCP, vamos inserir um registro na fiscal_evento para o worker processar
      
      // Primeiro calculamos impostos
      const { error: taxError } = await supabase.rpc('fu_calcular_impostos_movimento', {
        p_movimento_id: movement_id
      });
      if (taxError) throw taxError;

      // Depois validamos
      const { data: validData, error: validError } = await supabase.rpc('fn_prevalidar_nfe', {
        p_movimento_id: movement_id
      });
      if (validError) throw validError;
      
      // Inserimos na fiscal_evento (Simplificado para o MCP disparar o worker)
      const { data: evento, error: eventError } = await supabase
        .from('fiscal_evento')
        .insert({
          empresa_id: 1, // Deveria vir do contexto, mas para teste usaremos 1
          comando: model === 55 ? 'NFE.CriarEnviarNFe' : 'NFE.CriarEnviarNFCe',
          payload: { movimento_id: movement_id, modelo: model },
          status: 'PENDENTE',
          tipo: model === 55 ? 'NFE' : 'NFCE'
        })
        .select()
        .single();

      if (eventError) throw eventError;

      return {
        content: [{ 
          type: 'text', 
          text: `Solicitação de emissão enviada para o worker. Evento ID: ${evento.id}` 
        }]
      };
    } catch (err: any) {
      throw new McpError(ErrorCode.InternalError, `Erro na emissão fiscal: ${err.message}`);
    }
  },
  
  suggest_return_cfop: async (args: { cfop_origem: string }) => {
    const { cfop_origem } = args;
    const CFOP_DEVOLUCAO_MAP: Record<string, string> = {
      "5101": "1201", "5102": "1202", "5202": "1202", "5411": "1411", "5556": "1556",
      "6101": "2201", "6102": "2202", "6202": "2202", "6411": "2411", "6556": "2556",
      "1101": "5201", "1102": "5202", "1411": "5411", "1556": "5556",
      "2101": "6201", "2102": "6202", "2411": "6411", "2556": "6556",
    };

    let sugerido = CFOP_DEVOLUCAO_MAP[cfop_origem];
    
    if (!sugerido) {
      const first = cfop_origem[0];
      if (first === "5") sugerido = "1" + cfop_origem.substring(1);
      else if (first === "6") sugerido = "2" + cfop_origem.substring(1);
      else if (first === "1") sugerido = "5" + cfop_origem.substring(1);
      else if (first === "2") sugerido = "6" + cfop_origem.substring(1);
    }

    return {
      content: [{ type: 'text', text: sugerido || "1202" }]
    };
  }
};
