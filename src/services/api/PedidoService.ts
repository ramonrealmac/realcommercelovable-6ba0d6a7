import { BaseService } from "./BaseService";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type PedidoRow = Database["public"]["Tables"]["movimento"]["Row"];
type PedidoInsert = Database["public"]["Tables"]["movimento"]["Insert"];
type PedidoUpdate = Database["public"]["Tables"]["movimento"]["Update"];

export const pedidoSchema = z.object({
  empresa_id: z.number().positive("A empresa é obrigatória."),
  cadastro_id: z.number().positive("O cliente é obrigatório.").nullable().optional(),
  dt_movimento: z.string().min(10, "A data do movimento é inválida."),
  tp_movimento: z.string().min(1, "O tipo de movimento é obrigatório."),
  status: z.enum(['O', 'F', 'R', 'C']).optional(),
  vl_total_mov: z.number().min(0, "O valor total não pode ser negativo.").optional(),
});

export class PedidoService extends BaseService<PedidoRow, PedidoInsert, PedidoUpdate> {
  constructor() {
    super("movimento", "movimento_id");
  }

  /**
   * Valida os dados criticamente antes de salvar.
   */
  validar(pedido: Partial<PedidoRow>) {
    return pedidoSchema.safeParse(pedido);
  }

  /**
   * Altera o status de um pedido via RPC, garantindo atômico no banco (Reserva ou Baixa de estoque).
   */
  async alterarStatus(movimentoId: number, novoStatus: 'O' | 'F' | 'R' | 'C', usuarioId?: string) {
    const { data, error } = await this.client.rpc("fu_mudar_status_pedido_pdv", {
      _movimento_id: movimentoId,
      _novo_status: novoStatus,
      _usuario_id: usuarioId
    });

    if (error) throw new Error("Erro na comunicação com o banco: " + error.message);
    if (data?.error) throw new Error("Erro ao mudar status: " + data.error);
    
    return true;
  }

  /**
   * Finaliza uma venda do PDV de forma 100% transacional usando a nova Função RPC (Phase 1).
   */
  async finalizarVendaCaixa(payload: {
    empresa_id: number;
    movimento_id: number;
    caixa_abertura_id: number;
    funcionario_caixa_id: number;
    dt_movimento: string;
    tp_operacao_caixa: string;
    centro_custo_caixa: number;
    pagamentos: any[];
    usuario_id?: string;
  }) {
    const { data, error } = await this.client.rpc("fu_pdv_registrar_recebimento_venda", {
      _empresa_id: payload.empresa_id,
      _movimento_id: payload.movimento_id,
      _caixa_abertura_id: payload.caixa_abertura_id,
      _funcionario_caixa_id: payload.funcionario_caixa_id,
      _dt_movimento: payload.dt_movimento,
      _tp_operacao_caixa: payload.tp_operacao_caixa,
      _centro_custo_caixa: payload.centro_custo_caixa,
      _pagamentos: payload.pagamentos,
      _usuario_id: payload.usuario_id
    });

    if (error) throw new Error("Erro na comunicação com o servidor: " + error.message);
    if (data?.error) throw new Error("Recusado pelo Banco de Dados: " + data.error);

    return data; // { success, movimento_id, caixa_movimento_id, vl_somado_caixa }
  }
}

export const pedidoService = new PedidoService();
