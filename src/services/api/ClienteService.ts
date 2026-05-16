import { BaseService } from "./BaseService";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type ClienteRow = Database["public"]["Tables"]["cadastro"]["Row"];
type ClienteInsert = Database["public"]["Tables"]["cadastro"]["Insert"];
type ClienteUpdate = Database["public"]["Tables"]["cadastro"]["Update"];

export const clienteSchema = z.object({
  razao_social: z.string().min(3, "Razão Social deve ter no mínimo 3 caracteres."),
  cnpj: z.string().min(11, "CPF/CNPJ inválido."),
  endereco_logradouro: z.string().min(2, "O logradouro é obrigatório para emissão fiscal."),
  endereco_numero: z.string().min(1, "O número é obrigatório para emissão fiscal."),
  endereco_bairro: z.string().min(2, "O bairro é obrigatório para emissão fiscal."),
  endereco_cidade_id: z.number().positive("A cidade é obrigatória para emissão fiscal."),
});

export class ClienteService extends BaseService<ClienteRow, ClienteInsert, ClienteUpdate> {
  constructor() {
    super("cadastro", "cadastro_id");
  }

  /**
   * Busca clientes de forma segura, pesquisando por nome, cpf_cnpj ou fantasia.
   */
  async buscar(termo: string, empresaId: number, limite: number = 20): Promise<ClienteRow[]> {
    if (!termo || termo.length < 2) return [];

    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("excluido", false)
      .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj_cpf.ilike.%${termo}%`)
      .limit(limite);

    if (error) throw new Error("Erro na busca de clientes: " + error.message);
    return data as ClienteRow[];
  }

  /**
   * Valida os dados criticamente antes de salvar ou enviar para ferramentas MCP/Fiscais
   */
  validarParaFiscal(cliente: Partial<ClienteRow>) {
    return clienteSchema.safeParse(cliente);
  }
}

// Singleton export
export const clienteService = new ClienteService();
