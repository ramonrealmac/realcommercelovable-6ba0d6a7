import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Serviço de integração com o Provedor via Worker Nativo (Supabase Realtime)
 */
export const provedorService = {
  /**
   * Envia um comando para o worker através da tabela fiscal_evento e aguarda a resposta
   */
  async enviarComando(comando: string, empresaId?: string | number, ambiente?: string | number, configPayload?: any): Promise<string> {
    if (!empresaId) {
      console.error("Tentativa de enviar comando fiscal sem empresaId:", comando);
      throw new Error("ID da empresa não informado para o comando fiscal.");
    }

    try {
      // 1. Busca a configuração fiscal da empresa automaticamente se não foi passada
      let finalConfig = configPayload;
      if (!finalConfig && empresaId) {
        console.log(`[ProvedorService] 🔍 Buscando config fiscal para empresa ${empresaId}...`);
        const { data: config } = await supabase
          .from("fiscal_config")
          .select("*")
          .eq("empresa_id", empresaId)
          .maybeSingle();
        
        if (config) {
          console.log(`[ProvedorService] ✅ Config fiscal encontrada. Buscando endereço da empresa...`);
          // Busca a UF da empresa via cidade para ser preciso
          let empresaUF = "";
          const { data: empData, error: empError } = await supabase
            .from("empresa")
            .select("endereco_cidade_id")
            .eq("empresa_id", empresaId)
            .maybeSingle();
          
          if (empError) console.error(`[ProvedorService] ❌ Erro ao buscar empresa:`, empError);
          console.log(`[ProvedorService] 🏢 Dados da empresa:`, empData);

          if (empData?.endereco_cidade_id) {
            const { data: cityData, error: cityError } = await supabase
              .from("cidade")
              .select("estado_id, cd_ibge")
              .eq("cidade_id", empData.endereco_cidade_id)
              .maybeSingle();
            
            if (cityError) console.error(`[ProvedorService] ❌ Erro ao buscar cidade:`, cityError);
            console.log(`[ProvedorService] 📍 Cidade encontrada:`, cityData);
            
            // Prioriza o código numérico (ex: 21 para MA) pois é mais aceito em comandos diretos
            if (cityData?.cd_ibge && cityData.cd_ibge.length >= 2) {
              empresaUF = cityData.cd_ibge.substring(0, 2);
            } else if (cityData?.estado_id) {
              empresaUF = cityData.estado_id;
            }
          } else {
            console.warn(`[ProvedorService] ⚠️ Empresa ${empresaId} está sem endereco_cidade_id no cadastro!`);
          }

          finalConfig = {
            tipo_certificado: config.tipo_certificado,
            certificadoPath: config.certificado,
            certificadoSenha: config.senha_certificado ? atob(config.senha_certificado) : "",
            ambiente: Number(config.ambiente_nfe || 2),
            uf: empresaUF, 
            modelo: 55
          };
          console.log(`[ProvedorService] 📦 Payload de Config finalizado:`, finalConfig);
        }
      }

      // Obtém o usuário logado para auditoria
      const { data: { user } } = await supabase.auth.getUser();

      // 2. Insere o comando na fila com o payload completo
      const { data, error } = await supabase
        .from("fiscal_evento")
        .insert({
          empresa_id: empresaId,
          user_id: user?.id,
          ambiente: finalConfig?.ambiente || (ambiente ? Number(ambiente) : null),
          comando: comando.split('(')[0],
          payload: { 
            comando_full: comando,
            dados: comando.includes('("') ? comando.match(/\("(.+)"\)/)?.[1] : "",
            config: finalConfig || {}
          },
          status: "PENDENTE",
          tipo: "NFE"
        })
        .select("id")
        .single();

      if (error) throw error;
      const eventoId = data.id;

      // Lê o timeout configurado em fiscal_config.nr_timeout_nfe (segundos).
      let timeoutSeg = 60;
      if (empresaId) {
        try {
          const { data: cfg } = await supabase
            .from("fiscal_config")
            .select("nr_timeout_nfe")
            .eq("empresa_id", Number(empresaId))
            .maybeSingle();
          if (cfg && (cfg as any).nr_timeout_nfe) {
            timeoutSeg = Math.max(10, Math.min(600, Number((cfg as any).nr_timeout_nfe)));
          }
        } catch { /* fallback 60s */ }
      }
      const timeoutMs = timeoutSeg * 1000;

      // 2. Aguarda a resposta via Realtime
      return new Promise((resolve, reject) => {
        const channel = supabase
          .channel(`provedor_res_${eventoId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "fiscal_evento",
              filter: `id=eq.${eventoId}`
            },
            (payload) => {
              const row = payload.new as any;
              if (row.status === "CONCLUIDO") {
                channel.unsubscribe();
                // O worker retorna um JSON, mas os forms esperam a string "OK: ..." ou similar do padrão ACBr
                const resObj = JSON.parse(row.resposta || "{}");
                let responseText = "";
                
                if (resObj.sucesso) {
                  // Tenta reconstruir a string de resposta padrão ACBr para manter compatibilidade com os parsers legados
                  responseText = resObj.retorno_completo || resObj.status_retorno || resObj.xml_retorno || "OK: Operação realizada";
                  if (!responseText.startsWith("OK:")) responseText = "OK: " + responseText;
                } else {
                  responseText = "ERRO: " + (resObj.erro || "Falha desconhecida");
                }
                
                resolve(responseText.replace(/ACBr/gi, "MonitorFiscal"));
              } else if (row.status === "ERRO") {
                channel.unsubscribe();
                reject(new Error(row.mensagem_erro || "Erro no processamento do worker."));
              }
            }
          )
          .subscribe();

        setTimeout(() => {
          channel.unsubscribe();
          // Marca o evento como TIMEOUT (best effort)
          (supabase as any).from("fiscal_evento")
            .update({ status: "TIMEOUT", mensagem_erro: `Tempo limite excedido (${timeoutSeg}s) aguardando o Fiscal Worker.` })
            .eq("id", eventoId)
            .in("status", ["PENDENTE", "PROCESSANDO"])
            .then(() => {}, () => {});
          reject(new Error(`Tempo limite excedido (${timeoutSeg}s) aguardando o Fiscal Worker. Verifique se o serviço está rodando.`));
        }, timeoutMs);
      });
    } catch (error: any) {
      console.error("Erro provedorService:", error);
      toast.error("Falha ao comunicar com o provedor: " + error.message);
      throw error;
    }
  },

  /**
   * Consulta o status do serviço na SEFAZ
   */
  async consultarStatus(empresaId?: string | number): Promise<string> {
    return this.enviarComando("NFE.StatusServico()", empresaId);
  },

  /**
   * Ativa o MonitorFiscal
   */
  async ativar(empresaId?: string | number): Promise<string> {
    return this.enviarComando("ACBr.Ativar()", empresaId);
  },

  /**
   * Desativa o MonitorFiscal
   */
  async desativar(empresaId?: string | number): Promise<string> {
    return this.enviarComando("ACBr.Desativar()", empresaId);
  },

  /**
   * Cria e envia uma NFe a partir de um arquivo INI ou comandos
   */
  async enviarNFe(dadosIni: string, empresaId?: string | number): Promise<string> {
    return this.enviarComando(`NFE.CriarEnviarNFe("${dadosIni}", 1, 1, 1)`, empresaId);
  },

  /**
   * Busca documentos fiscais eletrônicos emitidos contra o CNPJ
   */
  async distribuicaoDFe(cUF: string, cnpj: string, nNSU: string = "0", empresaId?: string | number): Promise<string> {
    // Usa NFE.DistribuicaoDFePorUltNSU que reflete exatamente a função da DLL chamada
    return this.enviarComando(`NFE.DistribuicaoDFePorUltNSU(${cUF}, "${cnpj}", "${nNSU}")`, empresaId);
  },

  /**
   * Envia evento de manifestação do destinatário (210200, 210210, 210220, 210240)
   */
  async enviarManifesto(chNFe: string, tipo: string, cnpj: string, justificativa?: string, empresaId?: string | number): Promise<string> {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, "0");
    const i = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const dhEvento = `${d}/${m}/${y} ${h}:${i}:${s}`;
    
    const nSeqEvento = "1";
    
    let eventoIni = `[EVENTO]
idLote=1
[EVENTO001]
cOrgao=91
CNPJ=${cnpj.replace(/\D/g, "")}
chNFe=${chNFe}
dhEvento=${dhEvento}
tpEvento=${tipo}
nSeqEvento=${nSeqEvento}
versaoEvento=1.00`;

    if (tipo === "210240" && justificativa) {
      eventoIni += `\nxJust=${justificativa}`;
    }

    return this.enviarComando(`NFE.EnviarEvento("${eventoIni}")`, empresaId);
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
