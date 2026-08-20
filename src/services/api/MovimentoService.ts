import { BaseService } from "./BaseService";
import type { Database } from "@/integrations/supabase/types";
import { obterProximoNrMovimento } from "@/services/movimentoSequenceService";

type Movimento = Database["public"]["Tables"]["movimento"]["Row"];
type MovimentoInsert = Database["public"]["Tables"]["movimento"]["Insert"];
type MovimentoUpdate = Database["public"]["Tables"]["movimento"]["Update"];

export interface CriarPedidoPayload {
  empresa_id: number;
  cadastro_id: number;
  funcionario_id?: number;
  deposito_id?: number;
  tp_operacao_id?: number;
  vl_desconto?: number;
  pc_desconto?: number;
  itens: Array<{
    produto_id: number;
    cd_produto?: string;
    nm_produto?: string;
    unidade_id?: number;
    qt_movimento: number;
    vl_und_produto: number;
    deposito_id?: number;
  }>;
}

export class MovimentoService extends BaseService<Movimento, MovimentoInsert, MovimentoUpdate> {
  constructor() {
    super("movimento", "movimento_id");
  }

  /**
   * Obtém o próximo número do movimento sequencial para a empresa.
   */
  private async getProximoNumeroMovimento(empresaId: number): Promise<number> {
    return obterProximoNrMovimento(empresaId);
  }

  /**
   * Valida os campos do pedido e de cada item.
   * Retorna mensagem de erro ou null se estiver válido.
   */
  validate(payload: CriarPedidoPayload): string | null {
    if (!payload.empresa_id) {
      return "O campo ID da empresa (empresa_id) é obrigatório.";
    }
    if (!payload.cadastro_id) {
      return "O campo ID do cliente (cadastro_id) é obrigatório.";
    }
    if (!payload.itens || !Array.isArray(payload.itens) || payload.itens.length === 0) {
      return "É obrigatório enviar pelo menos um item para o pedido.";
    }

    for (let i = 0; i < payload.itens.length; i++) {
      const item = payload.itens[i];
      if (!item.produto_id) {
        return `O item no índice ${i} não possui produto_id válido.`;
      }
      if (!item.qt_movimento || item.qt_movimento <= 0) {
        return `O item no índice ${i} deve ter qt_movimento maior que zero.`;
      }
      if (item.vl_und_produto === undefined || item.vl_und_produto < 0) {
        return `O item no índice ${i} deve ter vl_und_produto válido (maior ou igual a zero).`;
      }
    }

    return null;
  }

  /**
   * Grava o movimento de pedido (movimento + movimento_item).
   */
  async criarPedido(payload: CriarPedidoPayload): Promise<{ success: boolean; message: string; data?: unknown }> {
    const errorMsg = this.validate(payload);
    if (errorMsg) {
      return { success: false, message: errorMsg };
    }

    try {
      // 1. Gerar o número sequencial do movimento
      const nrMovimento = await this.getProximoNumeroMovimento(payload.empresa_id);

      // 2. Montar cabeçalho do movimento
      const movimentoPayload: MovimentoInsert = {
        empresa_id: payload.empresa_id,
        cadastro_id: payload.cadastro_id,
        funcionario_id: payload.funcionario_id || null,
        nr_movimento: nrMovimento,
        tp_movimento: "S", // Saída por padrão
        tp_origem: "API", // Origem automatizada por API
        st_pedido: "P", // Status do pedido ("P" = Pedido)
        faturado: "N", // Não faturado inicialmente
        dt_emissao: new Date().toISOString(),
        tp_operacao_id: payload.tp_operacao_id || null,
        vl_desconto: payload.vl_desconto || 0,
        pc_desconto: payload.pc_desconto || 0,
        deposito_id: payload.deposito_id || null,
        excluido: false,
      };

      // 3. Criar registro principal do movimento
      const movimentoCriado = await this.create(movimentoPayload);
      const movimentoId = movimentoCriado.movimento_id;

      // 4. Montar e criar itens do movimento
      const itensPayload: Database["public"]["Tables"]["movimento_item"]["Insert"][] = payload.itens.map(item => ({
        empresa_id: payload.empresa_id,
        movimento_id: movimentoId,
        produto_id: item.produto_id,
        cd_produto: item.cd_produto || "",
        nm_produto: item.nm_produto || "",
        unidade_id: item.unidade_id || null,
        tp_movimento: "S",
        qt_movimento: item.qt_movimento,
        vl_und_produto: item.vl_und_produto,
        deposito_id: item.deposito_id || payload.deposito_id || null,
        excluido: false,
      }));

      const { data: itensCriados, error: erroItens } = await this.client
        .from("movimento_item")
        .insert(itensPayload)
        .select();

      if (erroItens) {
        // Rollback do cabeçalho caso ocorra erro ao inserir itens para manter integridade
        await this.client.from("movimento").delete().eq("movimento_id", movimentoId);
        throw new Error(`Erro ao criar itens do pedido: ${erroItens.message}`);
      }

      return {
        success: true,
        message: "Pedido criado com sucesso",
        data: {
          movimento: movimentoCriado,
          itens: itensCriados,
        },
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        message: err.message || "Erro interno ao criar pedido no banco",
      };
    }
  }
}
