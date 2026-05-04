import { toast } from "sonner";

/**
 * Serviço de integração com o Provedor via Ponte Node.js (provedor-bridge.cjs)
 */
export const provedorService = {
  // Configurações padrão
  config: {
    baseUrl: "http://localhost:3434",
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
      // Mascara retornos técnicos para manter a marca MonitorFiscal
      return result
        .replace(/ACBrMonitorPLUS/gi, "MonitorFiscal")
        .replace(/ACBr/gi, "MonitorFiscal")
        .replace(/SCBRMonitor/gi, "MonitorFiscal");
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
   * Ativa o MonitorFiscal
   */
  async ativar(): Promise<string> {
    return this.enviarComando("ACBr.Ativar()");
  },

  /**
   * Desativa o MonitorFiscal
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
   * Envia evento de manifestação do destinatário (210200, 210210, 210220, 210240)
   */
  async enviarManifesto(chNFe: string, tipo: string, cnpj: string, justificativa?: string): Promise<string> {
    // Mapeia códigos SEFAZ para índices ACBr se necessário, ou usa EnviarEvento
    // NFE.ManifestacaoDestinatario(cChave, nTipo, [xJust])
    // nTipo: 0-Confirmação, 1-Ciência, 2-Desconhecimento, 3-Não Realizada
    const map: Record<string, string> = {
      "210200": "0",
      "210210": "1",
      "210220": "2",
      "210240": "3"
    };
    const nTipo = map[tipo] || "1";
    const xJust = justificativa ? `, "${justificativa}"` : "";
    return this.enviarComando(`NFE.ManifestacaoDestinatario("${chNFe}", ${nTipo}${xJust})`);
  },

  /**
   * Converte uma resposta (INI ou JSON) do provedor em um objeto JavaScript
   */
  parseIni(text: string): any {
    const cleanText = text.replace(/^OK:\s*/i, "").trim();
    
    // Se for JSON, parseia diretamente
    if (cleanText.startsWith("{") && cleanText.endsWith("}")) {
      try {
        return JSON.parse(cleanText);
      } catch (e) {
        console.error("Erro ao parsear JSON do monitor:", e);
      }
    }

    // Se não, assume formato INI
    const result: any = {};
    let currentSection: string | null = null;
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
