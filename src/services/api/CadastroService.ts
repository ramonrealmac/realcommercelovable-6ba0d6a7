import { BaseService } from "./BaseService";
import type { Database } from "@/integrations/supabase/types";

type Cadastro = Database["public"]["Tables"]["cadastro"]["Row"];
type CadastroInsert = Database["public"]["Tables"]["cadastro"]["Insert"];
type CadastroUpdate = Database["public"]["Tables"]["cadastro"]["Update"];

export class CadastroService extends BaseService<Cadastro, CadastroInsert, CadastroUpdate> {
  constructor() {
    super("cadastro", "cadastro_id");
  }

  /**
   * Valida os campos obrigatórios para cadastro.
   * Retorna uma string com o erro de validação ou null se estiver válido.
   */
  validate(payload: Partial<CadastroInsert>): string | null {
    if (!payload.razao_social || !payload.razao_social.trim()) {
      return "O campo razão social (razao_social) é obrigatório.";
    }
    if (!payload.cnpj || !payload.cnpj.trim()) {
      return "O campo CPF/CNPJ (cnpj) é obrigatório.";
    }
    if (!payload.empresa_id) {
      return "O campo ID da empresa (empresa_id) é obrigatório.";
    }
    return null;
  }

  /**
   * Executa o cadastro de um novo cliente após validar e higienizar os campos.
   */
  async cadastrarCliente(payload: CadastroInsert): Promise<{ success: boolean; message: string; data?: Cadastro }> {
    const errorMsg = this.validate(payload);
    if (errorMsg) {
      return { success: false, message: errorMsg };
    }

    try {
      // Limpeza de caracteres não numéricos para campos específicos
      const sanitizedPayload = {
        ...payload,
        cnpj: payload.cnpj ? payload.cnpj.replace(/\D/g, "") : "",
        fone_geral: payload.fone_geral ? payload.fone_geral.replace(/\D/g, "") : "",
        fone_comercial: payload.fone_comercial ? payload.fone_comercial.replace(/\D/g, "") : "",
        fone_financeiro: payload.fone_financeiro ? payload.fone_financeiro.replace(/\D/g, "") : "",
        fone_faturamento: payload.fone_faturamento ? payload.fone_faturamento.replace(/\D/g, "") : "",
        st_cliente: payload.st_cliente || "S",
        st_cadastro: payload.st_cadastro || "A",
        excluido: false,
      };

      const result = await this.create(sanitizedPayload);
      
      return {
        success: true,
        message: "Cliente cadastrado com sucesso",
        data: result,
      };
    } catch (error) {
      const err = error as Error;
      return {
        success: false,
        message: err.message || "Erro interno ao cadastrar cliente no banco",
      };
    }
  }
}
