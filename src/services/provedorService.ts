import { toast } from "sonner";

/**
 * Serviço de integração com o Provedor via Ponte Node.js (provedor-bridge.cjs)
 */
export const provedorService = {
  // Configurações padrão
  config: {
    baseUrl: "http://localhost:3001",
  },

  /**
   * Envia um comando genérico para o provedor
   */
  async enviarComando(comando: string): Promise<string> {
    try {
      const response = await fetch(this.config.baseUrl, {
        method: "POST",
        body: comando,
        headers: { "Content-Type": "text/plain" },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Erro na ponte do provedor");
      }

      const result = await response.text();
      return result;
    } catch (error: any) {
      console.error("Erro provedorService:", error);
      toast.error("Falha ao comunicar com o provedor: " + error.message);
      throw error;
    }
  },

  /**
   * Consulta o status do serviço na SEFAZ
   */
  async consultarStatus(): Promise<string> {
    return this.enviarComando("NFE.StatusServico()");
  },

  /**
   * Ativa o monitor do provedor
   */
  async ativar(): Promise<string> {
    return this.enviarComando("ACBr.Ativar()");
  },

  /**
   * Desativa o monitor do provedor
   */
  async desativar(): Promise<string> {
    return this.enviarComando("ACBr.Desativar()");
  },

  /**
   * Cria e envia uma NFe a partir de um arquivo INI ou comandos
   */
  async enviarNFe(dadosIni: string): Promise<string> {
    return this.enviarComando(`NFE.CriarEnviarNFe("${dadosIni}", 1, 1, 1)`);
  },

  /**
   * Busca documentos fiscais eletrônicos emitidos contra o CNPJ
   */
  async distribuicaoDFe(cUF: string, cnpj: string, nNSU: string = "0"): Promise<string> {
    return this.enviarComando(`NFE.DistribuicaoDFe(${cUF}, "${cnpj}", "${nNSU}")`);
  },

  /**
   * Envia evento de manifestação do destinatário
   */
  async enviarManifesto(chNFe: string, tipo: string, cnpj: string): Promise<string> {
    return this.enviarComando(`NFE.EnviarEvento("ID110110${chNFe}01", "${chNFe}", "${cnpj}", 1, "${new Date().toISOString()}", ${tipo})`);
  },

  /**
   * Converte uma resposta INI do provedor em um objeto JavaScript
   */
  parseIni(text: string): any {
    const result: any = {};
    let currentSection: string | null = null;
    const cleanText = text.replace(/^OK:\s*/i, "");
    const lines = cleanText.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";")) continue;

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        currentSection = trimmed.substring(1, trimmed.length - 1);
        result[currentSection] = {};
        continue;
      }

      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1 && currentSection) {
        const key = trimmed.substring(0, eqIdx).trim();
        const value = trimmed.substring(eqIdx + 1).trim();
        result[currentSection][key] = value;
      }
    }
    return result;
  }
};
