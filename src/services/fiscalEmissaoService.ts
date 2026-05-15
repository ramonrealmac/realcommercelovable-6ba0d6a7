import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { gerarIniNfe } from "./gerarIniNfe";
import { gerarXmlNfe } from "./gerarXmlNfe";
import { validarDadosFiscais } from "./fiscalPreValidacao";

const db = supabase as any;

/**
 * Anexa o objeto cidade no registro com base em endereco_cidade_id.
 * Necessário porque não existe FK declarada entre empresa/cadastro e cidade,
 * o que faria o embed do PostgREST falhar e devolver null.
 */
async function attachCidade<T extends { endereco_cidade_id?: number | null } | null>(rec: T): Promise<T> {
  if (!rec || !rec.endereco_cidade_id) return rec;
  const { data: cidade } = await db.from("cidade").select("*").eq("cidade_id", rec.endereco_cidade_id).maybeSingle();
  (rec as any).cidade = cidade || null;
  return rec;
}

function mapearSefazPagamento(tp: string): string {
  const mapa: Record<string, string> = {
    "DI": "01", "DH": "01", "DINHEIRO": "01", "01": "01",
    "CH": "02", "CHEQUE": "02", "02": "02",
    "CC": "03", "CARTAO_CREDITO": "03", "03": "03",
    "CD": "04", "CARTAO_DEBITO": "04", "04": "04",
    "PX": "17", "PIX": "17", "17": "17",
    "BL": "15", "BOLETO": "15", "15": "15",
    "OUTRO": "99", "99": "99"
  };
  return mapa[tp?.toUpperCase()] || "01";
}

function validarIniAcbr(ini: string) {
  const proibidos = ["Modelo=", "Serie=", "NumDocumento=", "RazaoSocial=", "CodigoMunicipio=", "FormaPagamento001=", "[Item001]", "[Pagamento]"];
  const encontrado = proibidos.find((token) => ini.includes(token));
  if (encontrado) throw new Error(`INI fiscal em layout legado detectado (${encontrado}). Recarregue a aplicação e tente novamente.`);
  if (!ini.includes("[infNFe]") || !ini.includes("[Produto001]") || !ini.includes("[pag001]")) {
    throw new Error("INI fiscal incompleto para ACBrLib.");
  }
}

export interface FiscalEmissaoResult {
  success: boolean;
  nfe_cabecalho_id?: number;
  fiscal_evento_id?: number;
  message?: string;
}

export const fiscalEmissaoService = {
  /**
   * Gera um documento fiscal (NFe ou NFCe) a partir de um movimento de venda.
   */
  gerarDocumentoFiscalFromMovimento: async (
    movimentoId: number,
    tipo: "NFE" | "NFCE",
    empresaId: number,
    funcionarioId: number
  ): Promise<FiscalEmissaoResult> => {
    try {
      console.log(`[FiscalService] Iniciando geração de ${tipo} para movimento ${movimentoId}`);

      // 1. Obter dados do movimento
      const { data: movimento, error: movErr } = await db
        .from("movimento")
        .select("*, movimento_item(*), movimento_pagamento(*)")
        .eq("movimento_id", movimentoId)
        .single();

      if (movErr || !movimento) {
        throw new Error("Movimento não localizado: " + movErr?.message);
      }

      // 1.1 Obter dados dos produtos manualmente (devido à falta de relacionamento no cache do schema)
      if (movimento.movimento_item && movimento.movimento_item.length > 0) {
        const productIds = movimento.movimento_item.map((i: any) => i.produto_id).filter(Boolean);
        if (productIds.length > 0) {
          const { data: produtos } = await db
            .from("produto")
            .select("*")
            .in("produto_id", productIds);

          if (produtos) {
            movimento.movimento_item = movimento.movimento_item.map((item: any) => ({
              ...item,
              produto: produtos.find((p: any) => p.produto_id === item.produto_id)
            }));
          }
        }
      }

      // 2. Obter dados da empresa (emitente) e do cadastro (destinatário)
      const { data: empresaRaw, error: empErr } = await db.from("empresa").select("*").eq("empresa_id", empresaId).single();
      if (empErr || !empresaRaw) throw new Error("Empresa não localizada: " + (empErr?.message || empresaId));
      const empresa = await attachCidade(empresaRaw);

      let parceiro: any = null;
      if (movimento.cadastro_id) {
        const { data: parceiroRaw } = await db.from("cadastro").select("*").eq("cadastro_id", movimento.cadastro_id).maybeSingle();
        parceiro = await attachCidade(parceiroRaw);
      }

      // 3. Obter configurações fiscais
      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();

      const { data: funcionario } = await db.from("funcionario").select("nfe_config_item, nfce_config_item").eq("funcionario_id", funcionarioId).single();
      const configItemId = tipo === "NFE" ? funcionario?.nfe_config_item : funcionario?.nfce_config_item;

      if (!configItemId) {
        throw new Error(`Configuração de ${tipo} não definida para o funcionário.`);
      }

      const { data: fConfigItem } = await db.from("fiscal_config_item").select("*").eq("fiscal_config_item_id", configItemId).single();

      if (!fConfigItem) {
        throw new Error(`Item de configuração fiscal ${configItemId} não localizado.`);
      }

      // PRÉ-VALIDAÇÃO — verifica dados obrigatórios antes de consumir sequência ou acionar o worker
      const preVal = validarDadosFiscais({
        empresa,
        parceiro,
        movimento,
        itens: movimento.movimento_item || [],
        fConfig,
        fConfigItem,
        tipo,
      });

      if (!preVal.valido) {
        const linhas = preVal.erros.map(er => `• ${er.campo}: ${er.mensagem}`).join("\n");
        throw new Error(`Dados incompletos para emissão da ${tipo}:\n\n${linhas}`);
      }

      // 4. Sequência da nota
      const nrNota = Number(fConfigItem.sequencia || 1);
      console.log(`[FiscalService] Utilizando nr_nota: ${nrNota} para ${tipo}`);

      // 5. CALCULA NO BANCO via RPC — popula fiscal_nfe_cabecalho/item
      const modelo = tipo === "NFE" ? "55" : "65";
      const { data: nfeIdRet, error: eCalc } = await db.rpc("fu_calcular_impostos_movimento", {
        p_movimento_id: movimentoId,
        p_modelo: modelo,
        p_serie: String(fConfigItem.serie || "001"),
        p_nr_nota: String(nrNota),
      });
      if (eCalc) throw new Error(eCalc.message || "Erro no cálculo fiscal.");
      const cabId: number = nfeIdRet as number;

      // 5.0 Vincula o pedido (movimento) ao cabeçalho fiscal
      try {
        await db.from("fiscal_nfe_cabecalho")
          .update({ pedido_id: movimentoId })
          .eq("nfe_cabecalho_id", cabId);
      } catch (eUpdPed) {
        console.warn("[FiscalService] Falha ao gravar pedido_id no cabeçalho:", eUpdPed);
      }

      // 5.1 Incrementa sequencial
      const { error: updateSeqErr } = await db
        .from("fiscal_config_item")
        .update({ sequencia: nrNota + 1 })
        .eq("fiscal_config_item_id", fConfigItem.fiscal_config_item_id);
      if (updateSeqErr) console.error("[FiscalService] Erro ao incrementar sequência:", updateSeqErr);

      // 6. Relê cabeçalho calculado
      const { data: cabData } = await db
        .from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("nfe_cabecalho_id", cabId)
        .single();
      const nfeCabecalho = cabData;

      // 7. Inserir Pagamentos
      const totalVenda = Number(nfeCabecalho.vl_total_nf || 0);
      console.log(`[FiscalService] Verificando pagamentos para movimento ${movimentoId}. Total Venda: ${totalVenda}`);
      const { data: pagtosMov, error: errPagtos } = await db
        .from("movimento_pagamento")
        .select(`
          *,
          condicao_pagamento (
            condicao_id,
            meio_pagamento (
              codigo
            )
          )
        `)
        .eq("movimento_id", movimentoId)
        .eq("excluido", false);

      if (errPagtos) {
        console.error("[FiscalService] Erro ao buscar pagamentos do movimento:", errPagtos);
      }

      let pagamentosGerados = 0;

      if (pagtosMov && pagtosMov.length > 0) {
        console.log(`[FiscalService] Processando ${pagtosMov.length} pagamentos do movimento.`);
        for (const p of pagtosMov) {
          const condRaw = p.condicao_pagamento as any;
          const condicao = Array.isArray(condRaw) ? condRaw[0] : condRaw;
          const sefazCode = condicao?.meio_pagamento?.codigo || mapearSefazPagamento(p.tp_pagamento) || "01";

          const nfePag = {
            nfe_cabecalho_id: cabId,
            t_pag: sefazCode,
            v_pag: Number(p.vl_pagamento || 0),
            tp_integra: (p.tp_pagamento?.toUpperCase().includes("CARTAO") || p.tp_pagamento?.toUpperCase().includes("PIX")) ? 1 : 2,
            c_aut: p.nr_autorizacao || "",
          };

          if (nfePag.v_pag > 0) {
            console.log(`[FiscalService] Inserindo pagamento #${++pagamentosGerados}:`, nfePag);
            const { error: pagErr } = await db.from("fiscal_nfe_pagamento").insert(nfePag);
            if (pagErr) console.error("[FiscalService] Erro ao inserir pagamento:", pagErr);
          } else {
            console.warn("[FiscalService] Pulando pagamento com valor zerado:", p.tp_pagamento);
          }
        }
      }

      // Se nenhum pagamento válido foi inserido até agora, usa o fallback para evitar rejeição da SEFAZ
      if (pagamentosGerados === 0) {
        console.warn("[FiscalService] Nenhum pagamento válido gerado. Aplicando fallback (Dinheiro)...");
        const { error: fbkErr } = await db.from("fiscal_nfe_pagamento").insert({
          nfe_cabecalho_id: cabId,
          t_pag: "01",
          v_pag: totalVenda > 0 ? totalVenda : (nfeCabecalho.vl_total_nf || 0),
          tp_integra: 2
        });
        if (fbkErr) console.error("[FiscalService] Erro crítico ao inserir pagamento fallback:", fbkErr);
        else console.log("[FiscalService] Pagamento fallback inserido com sucesso.");
      }

      // 9. PRÉ-VALIDAÇÃO PÓS-CÁLCULO — valida os dados fiscais gravados antes de acionar o worker
      console.log(`[FiscalService] Executando pré-validação fiscal (fn_prevalidar_nfe) para cabeçalho ${cabId}...`);
      const { data: validacaoResult, error: validacaoErr } = await db.rpc("fn_prevalidar_nfe", {
        p_nfe_cabecalho_id: cabId,
        p_empresa_id: empresaId,
      });

      if (validacaoErr) {
        console.warn("[FiscalService] Falha ao executar pré-validação:", validacaoErr.message);
        // Não bloqueia — loga o aviso e continua
      } else if (validacaoResult && !validacaoResult.valido) {
        const regime: string = validacaoResult.regime || "?";
        const erros: Array<{ campo: string; mensagem: string }> = validacaoResult.erros || [];
        const linhas = erros.map((er) => `• ${er.campo}: ${er.mensagem}`).join("\n");
        console.error(`[FiscalService] Pré-validação falhou (${regime}) — ${erros.length} erro(s):\n${linhas}`);
        throw new Error(`Dados incompletos para emissão da ${tipo}:\n\n${linhas}`);
      } else {
        console.log(`[FiscalService] Pré-validação OK (regime: ${validacaoResult?.regime}).`);
      }

      // 10. Gerar Documento (INI v1.0 ou XML v2.0) e Despachar Evento para o Worker
      const versaoMetodo = tipo === "NFE" ? fConfig?.nfe_versao_metodo : fConfig?.nfce_versao_metodo;
      const isV2 = versaoMetodo === '2.0';

      console.log(`[FiscalService] Gerando ${isV2 ? 'XML (v2.0)' : 'INI (v1.0)'} para ${tipo}...`);

      // Busca dados dos itens inseridos para garantir integridade no conteúdo gerado
      const { data: nfeItens } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", cabId);
      const { data: nfePagtos } = await db.from("fiscal_nfe_pagamento").select("*").eq("nfe_cabecalho_id", cabId);

      const params = {
        cabecalho: { ...nfeCabecalho, nfe_cabecalho_id: cabId },
        itens: nfeItens || [],
        pagamentos: nfePagtos || [],
        empresa: empresa,
        cadastro: parceiro,
        fiscalConfig: fConfig,
        configItem: fConfigItem
      };

      const dadosGerados = isV2 ? gerarXmlNfe(params) : gerarIniNfe(params);
      
      if (!isV2) {
        validarIniAcbr(dadosGerados);
      }

      const ambienteNfe = Number(fConfig?.ambiente_nfe || 2);
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: cabId,
        tipo: tipo,
        comando: isV2 
          ? (tipo === "NFE" ? "EMITIR_XML_NFE" : "EMITIR_XML_NFCE")
          : (tipo === "NFE" ? "EMITIR_NFE" : "EMITIR_NFCE"),
        status: "PENDENTE",
        ambiente: ambienteNfe,
        user_id: authUser?.id || null,
        payload: {
          dados: dadosGerados,
          config: {
            uf: empresa.endereco_uf || empresa.cidade?.estado_id || empresa.cidade?.uf || "SP",
            modelo: nfeCabecalho.modelo,
            ambiente: ambienteNfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            csc: fConfigItem.csc || "",
            id_csc: fConfigItem.id_csc || "",
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ""
          }
        }
      }).select("id").single();

      if (evErr) {
        console.error("[FiscalService] Erro ao criar evento fiscal:", evErr);
        toast.error("Documento gerado, mas falhou ao criar evento de transmissão: " + evErr.message);
      }

      console.log(`[FiscalService] Documento ${cabId} e Evento ${evento?.id} gerados com sucesso.`);
      return {
        success: true,
        nfe_cabecalho_id: cabId,
        fiscal_evento_id: evento?.id
      };

    } catch (e: any) {
      console.error("[FiscalService] Erro:", e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Re-enfileira a transmissão de uma NF-e/NFC-e existente, criando um novo
   * fiscal_evento com status PENDENTE para que o fiscal-worker reprocesse.
   */
  retransmitirDocumento: async (
    nfeCabecalhoId: number,
    empresaId: number
  ): Promise<FiscalEmissaoResult> => {
    try {
      const { data: cab, error: cabErr } = await db
        .from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .single();
      if (cabErr || !cab) throw new Error("NF-e não localizada: " + cabErr?.message);

      const tipo: "NFE" | "NFCE" = Number(cab.modelo) === 65 ? "NFCE" : "NFE";

      const { data: empresaRaw, error: empErr } = await db.from("empresa").select("*").eq("empresa_id", empresaId).single();
      if (empErr || !empresaRaw) throw new Error("Empresa não localizada: " + (empErr?.message || empresaId));
      const empresa = await attachCidade(empresaRaw);

      let parceiro: any = null;
      if (cab.cadastro_id) {
        const { data: parceiroRaw } = await db.from("cadastro").select("*").eq("cadastro_id", cab.cadastro_id).maybeSingle();
        parceiro = await attachCidade(parceiroRaw);
      }

      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();

      const { data: fConfigItens } = await db
        .from("fiscal_config_item")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("modelo", cab.modelo)
        .eq("serie", cab.serie);
      const fConfigItem = fConfigItens?.[0];
      if (!fConfigItem) throw new Error(`Configuração fiscal (modelo ${cab.modelo}/série ${cab.serie}) não localizada.`);

      const { data: nfeItens } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId);
      const { data: nfePagtos } = await db.from("fiscal_nfe_pagamento").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId);

      const versaoMetodo = tipo === "NFE" ? fConfig?.nfe_versao_metodo : fConfig?.nfce_versao_metodo;
      const isV2 = versaoMetodo === '2.0';

      const params = {
        cabecalho: cab,
        itens: nfeItens || [],
        pagamentos: nfePagtos || [],
        empresa: empresa,
        cadastro: parceiro,
        fiscalConfig: fConfig,
        configItem: fConfigItem
      };

      const dadosGerados = isV2 ? gerarXmlNfe(params) : gerarIniNfe(params);
      
      if (!isV2) {
        validarIniAcbr(dadosGerados);
      }

      const ambienteNfe = Number(fConfig?.ambiente_nfe || 2);
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: isV2 
          ? (tipo === "NFE" ? "EMITIR_XML_NFE" : "EMITIR_XML_NFCE")
          : (tipo === "NFE" ? "EMITIR_NFE" : "EMITIR_NFCE"),
        status: "PENDENTE",
        ambiente: ambienteNfe,
        user_id: authUser?.id || null,
        payload: {
          dados: dadosGerados,
          config: {
            uf: empresa.endereco_uf || empresa.cidade?.estado_id || empresa.cidade?.uf || "SP",
            modelo: cab.modelo,
            ambiente: ambienteNfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            csc: fConfigItem.csc || "",
            id_csc: fConfigItem.id_csc || "",
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ""
          }
        }
      }).select("id").single();

      if (evErr) throw new Error("Falha ao criar evento de transmissão: " + evErr.message);

      // Reseta status da NF-e para pendente, para refletir nova tentativa
      await db.from("fiscal_nfe_cabecalho")
        .update({ st_nf: "A" })
        .eq("nfe_cabecalho_id", nfeCabecalhoId);

      return { success: true, nfe_cabecalho_id: nfeCabecalhoId, fiscal_evento_id: evento?.id };
    } catch (e: any) {
      console.error("[FiscalService] retransmitirDocumento erro:", e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Gera o XML/INI e solicita ao worker apenas a validação contra os schemas (XSD),
   * sem transmitir para a SEFAZ. Útil para conferência prévia.
   */
  validarDocumento: async (
    nfeCabecalhoId: number,
    empresaId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const { data: cab, error: cabErr } = await db
        .from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .single();
      if (cabErr || !cab) throw new Error("NF-e não localizada.");

      const tipo: "NFE" | "NFCE" = Number(cab.modelo) === 65 ? "NFCE" : "NFE";

      const { data: empresaRaw } = await db.from("empresa").select("*").eq("empresa_id", empresaId).single();
      const empresa = await attachCidade(empresaRaw);

      let parceiro: any = null;
      if (cab.cadastro_id) {
        const { data: parceiroRaw } = await db.from("cadastro").select("*").eq("cadastro_id", cab.cadastro_id).maybeSingle();
        parceiro = await attachCidade(parceiroRaw);
      }

      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
      const { data: fConfigItens } = await db.from("fiscal_config_item").select("*").eq("empresa_id", empresaId).eq("modelo", cab.modelo).eq("serie", cab.serie);
      const fConfigItem = fConfigItens?.[0];

      const { data: nfeItens } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId);
      const { data: nfePagtos } = await db.from("fiscal_nfe_pagamento").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId);

      const params = {
        cabecalho: cab,
        itens: nfeItens || [],
        pagamentos: nfePagtos || [],
        empresa,
        cadastro: parceiro,
        fiscalConfig: fConfig,
        configItem: fConfigItem
      };

      const versaoMetodo = tipo === "NFE" ? fConfig?.nfe_versao_metodo : fConfig?.nfce_versao_metodo;
      const isV2 = versaoMetodo === '2.0';
      const dadosGerados = isV2 ? gerarXmlNfe(params) : gerarIniNfe(params);

      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: tipo === "NFE" ? "VALIDAR_XML_NFE" : "VALIDAR_XML_NFCE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          dados: dadosGerados,
          config: {
            uf: empresa.endereco_uf || "SP",
            modelo: cab.modelo,
            ambiente: fConfig.ambiente_nfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ""
          }
        }
      }).select("id").single();

      if (evErr) throw evErr;

      const res = await (fiscalEmissaoService as any).aguardarEvento(evento.id, { empresaId });
      return { success: res.success, message: res.mensagem || res.resposta?.mensagem };
    } catch (e: any) {
      console.error("[FiscalService] validarDocumento erro:", e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Cache simples de timeout por empresa (evita refazer a query a cada operação).
   * Chave: empresa_id; valor: { ts, segundos }.
   */
  _timeoutCache: new Map<number, { ts: number; segundos: number }>(),

  /**
   * Lê o parâmetro `nr_timeout_nfe` da fiscal_config (em segundos).
   * Cache de 30s por empresa. Fallback: 60 segundos.
   */
  async obterTimeoutFiscalSeg(empresaId: number): Promise<number> {
    if (!empresaId) return 60;
    const cached = (this._timeoutCache as any).get(empresaId);
    if (cached && Date.now() - cached.ts < 30000) return cached.segundos;
    try {
      const { data } = await db.from("fiscal_config").select("nr_timeout_nfe").eq("empresa_id", empresaId).maybeSingle();
      const s = Math.max(10, Math.min(600, Number(data?.nr_timeout_nfe) || 60));
      (this._timeoutCache as any).set(empresaId, { ts: Date.now(), segundos: s });
      return s;
    } catch {
      return 60;
    }
  },

  /**
   * Invalida o cache de timeout (chamar quando a config for atualizada).
   */
  invalidarTimeoutCache(empresaId?: number) {
    if (empresaId) (this._timeoutCache as any).delete(empresaId);
    else (this._timeoutCache as any).clear();
  },

  /**
   * Aguarda um fiscal_evento finalizar (CONCLUIDO/ERRO) consultando por polling.
   * Retorna a resposta parseada do worker.
   *
   * Assinatura compatível:
   *  - aguardarEvento(eventoId, timeoutMs)
   *  - aguardarEvento(eventoId, { timeoutMs?, empresaId?, onTick? })
   *  - aguardarEvento(eventoId, undefined, onTick, empresaId)  (variação utilitária)
   *
   * Quando `timeoutMs` é omitido e `empresaId` é informado, usa
   * `nr_timeout_nfe` da `fiscal_config`. Caso contrário, 60s.
   *
   * `onTick(segundosRestantes)` é disparado a cada 2 segundos para a UI.
   */
  async aguardarEvento(
    eventoId: number,
    optsOrTimeout?: number | { timeoutMs?: number; empresaId?: number; onTick?: (segundosRestantes: number) => void },
    onTick?: (segundosRestantes: number) => void,
    empresaId?: number,
  ): Promise<{ success: boolean; resposta?: any; status?: string; mensagem?: string }> {
    // Normaliza parâmetros (aceita assinatura antiga e nova).
    let timeoutMs: number | undefined;
    let tickCb: ((s: number) => void) | undefined = onTick;
    let empId: number | undefined = empresaId;
    if (typeof optsOrTimeout === "number") {
      timeoutMs = optsOrTimeout;
    } else if (optsOrTimeout && typeof optsOrTimeout === "object") {
      timeoutMs = optsOrTimeout.timeoutMs;
      tickCb = optsOrTimeout.onTick || tickCb;
      empId = optsOrTimeout.empresaId || empId;
    }
    if (!timeoutMs) {
      const seg = empId ? await this.obterTimeoutFiscalSeg(empId) : 60;
      timeoutMs = seg * 1000;
    }
    const segundosTotais = Math.ceil(timeoutMs / 1000);

    const inicio = Date.now();
    const intervalo = 1000;
    let proximoTick = 0;

    if (tickCb) tickCb(segundosTotais);

    while (true) {
      const decorridoMs = Date.now() - inicio;
      if (decorridoMs >= timeoutMs) break;

      // Tick a cada 2 segundos
      const decorridoSeg = Math.floor(decorridoMs / 1000);
      if (tickCb && decorridoSeg >= proximoTick) {
        const restante = Math.max(0, segundosTotais - decorridoSeg);
        try { tickCb(restante); } catch { /* noop */ }
        proximoTick = decorridoSeg + 2;
      }

      await new Promise(r => setTimeout(r, intervalo));
      const { data: ev } = await db
        .from("fiscal_evento")
        .select("status,resposta,mensagem_erro")
        .eq("id", eventoId)
        .maybeSingle();
      if (!ev) continue;
      if (ev.status === "EMITIDO" || ev.status === "CONCLUIDO" || ev.status === "ERRO") {
        let resposta: any = null;
        try { resposta = typeof ev.resposta === "string" ? JSON.parse(ev.resposta) : ev.resposta; } catch { /* ignore */ }
        const ok = (ev.status === "EMITIDO" || ev.status === "CONCLUIDO") && !!resposta?.sucesso;
        if (tickCb) { try { tickCb(0); } catch { /* noop */ } }
        return {
          success: ok,
          status: ev.status,
          resposta,
          mensagem: ev.mensagem_erro || resposta?.x_motivo || resposta?.erro || null,
        };
      }
    }

    // Timeout — marca o evento (best effort) e retorna.
    const msg = `Tempo limite excedido (${segundosTotais}s) aguardando o Fiscal Worker.`;
    try {
      await db.from("fiscal_evento")
        .update({ status: "TIMEOUT", mensagem_erro: msg })
        .eq("id", eventoId)
        .in("status", ["PENDENTE", "PROCESSANDO"]);
    } catch { /* noop */ }
    if (tickCb) { try { tickCb(0); } catch { /* noop */ } }
    return { success: false, status: "TIMEOUT", mensagem: msg };
  },

  /**
   * Enfileira um comando LISTAR_IMPRESSORAS no worker e aguarda resposta (polling até 8s).
   */
  async listarImpressoras(empresaId: number): Promise<{ success: boolean; impressoras?: string[]; message?: string }> {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        comando: "LISTAR_IMPRESSORAS",
        status: "PENDENTE",
        tipo: "UTIL",
        user_id: authUser?.id || null,
        payload: {}
      }).select("id").single();
      if (evErr) return { success: false, message: evErr.message };

      // Poll for response
      for (let i = 0; i < 16; i++) {
        await new Promise(r => setTimeout(r, 500));
        const { data: ev } = await db.from("fiscal_evento").select("status,resposta").eq("id", evento.id).maybeSingle();
        if (ev?.status === "EMITIDO" || ev?.status === "CONCLUIDO" || ev?.status === "ERRO") {
          try {
            const r = typeof ev.resposta === "string" ? JSON.parse(ev.resposta) : ev.resposta;
            return { success: !!r?.sucesso, impressoras: r?.impressoras || [], message: r?.erro };
          } catch { return { success: false, message: "Resposta inválida do worker" }; }
        }
      }
      return { success: false, message: "Timeout aguardando worker" };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  /**
   * Enfileira comando de impressão de DANFE/DANFCE para uma nota já emitida.
   */
  async imprimirDocumento(nfeCabecalhoId: number, empresaId: number): Promise<{ success: boolean; pdf_base64?: string; message?: string }> {
    try {
      const { data: cab, error: cabErr } = await db.from("fiscal_nfe_cabecalho")
        .select("xml_nf, modelo, chave_nfe")
        .eq("nfe_cabecalho_id", nfeCabecalhoId).single();

      if (cabErr || !cab || !cab.xml_nf) {
        return { success: false, message: "XML da nota não localizado para impressão." };
      }

      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
      if (!fConfig) return { success: false, message: "Configuração fiscal não encontrada." };

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const tipo: "NFE" | "NFCE" = Number(cab.modelo) === 65 ? "NFCE" : "NFE";

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: tipo === "NFE" ? "IMPRIMIR_NFE" : "IMPRIMIR_NFCE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          dados: cab.xml_nf,
          chave: cab.chave_nfe,
          print_config: {
            tp_imp: "PDF", // Força PDF para retorno no browser
            nm_impressora: ""
          },
          config: {
            uf: fConfig.uf || "SP",
            modelo: cab.modelo,
            ambiente: fConfig.ambiente_nfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ""
          }
        }
      }).select("id").single();

      if (evErr) return { success: false, message: evErr.message };

      const res = await this.aguardarEvento(evento.id, { empresaId });
      if (res.success && res.resposta?.pdf_base64) {
        return { success: true, pdf_base64: res.resposta.pdf_base64 };
      }
      return { success: false, message: res.mensagem || "Falha ao gerar PDF do DANFE." };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  /**
   * Envia a nota por e-mail (XML + DANFE + Opcionais).
   */
  async enviarEmail(nfeCabecalhoId: number, empresaId: number, para?: string, assunto?: string, mensagem?: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { data: cab, error: cabErr } = await db.from("fiscal_nfe_cabecalho")
        .select("xml_nf, chave_nfe, cadastro_id, modelo, nr_nota")
        .eq("nfe_cabecalho_id", nfeCabecalhoId).single();

      if (cabErr || !cab || !cab.xml_nf) return { success: false, message: "XML não localizado." };

      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
      if (!fConfig) return { success: false, message: "Configuração fiscal não encontrada." };

      const { data: emp } = await db.from("empresa").select("nome_fantasia").eq("empresa_id", empresaId).single();
      const nomeEmpresa = emp?.nome_fantasia || "Realcommerce";

      let emailDestino = para;
      if (!emailDestino && cab.cadastro_id) {
        const { data: cad } = await db.from("cadastro").select("email").eq("cadastro_id", cab.cadastro_id).single();
        emailDestino = cad?.email;
      }

      if (!emailDestino) return { success: false, message: "Destinatário não informado e não localizado no cadastro." };

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const tipo: "NFE" | "NFCE" = Number(cab.modelo) === 65 ? "NFCE" : "NFE";

      // Prepara o assunto e mensagem se não fornecidos
      const finalAssunto = (assunto || fConfig.email_assunto_nfe || "Nota Fiscal Eletrônica [CHAVE]")
        .replace("[CHAVE]", cab.chave_nfe || "")
        .replace("[NOTA]", cab.nr_nota || "");

      const finalMensagem = mensagem || fConfig.email_corpo_nfe || "Segue em anexo a sua nota fiscal eletrônica.";

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: "ENVIAR_EMAIL_NFE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          para: emailDestino,
          assunto: finalAssunto,
          mensagem: finalMensagem,
          xml: cab.xml_nf,
          dados: cab.xml_nf,
          config_email: {
            host: fConfig.email_smtp_host,
            port: fConfig.email_smtp_port,
            user: fConfig.email_smtp_user,
            pass: fConfig.email_smtp_pass,
            ssl: fConfig.email_smtp_ssl,
            tls: fConfig.email_smtp_tls,
            // HELO/EHLO: alguns servidores SMTP rejeitam "Invalid helo name" quando
            // o cliente envia um hostname inválido (ex: localhost). Usamos o domínio
            // do remetente como FQDN — é o valor mais aceito pelos servidores.
            helo: (fConfig.email_smtp_user || "").split("@")[1] || fConfig.email_smtp_host || ""
          },
          config: {
            uf: fConfig.uf,
            modelo: cab.modelo,
            ambiente: fConfig.ambiente_nfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado,
            tipo_certificado: fConfig.tipo_certificado,
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ''
          }
        }
      }).select("id").single();

      if (evErr) return { success: false, message: evErr.message };

      const res = await this.aguardarEvento(evento.id, { empresaId });
      return { success: res.success, message: res.mensagem };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },

  /**
   * Cancela uma NF-e ou NFC-e.
   */
  async cancelarDocumento(nfeCabecalhoId: number, empresaId: number, justificativa: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log(`[FiscalService] Iniciando cancelamento da nota ID: ${nfeCabecalhoId}, Empresa: ${empresaId}`);
      if (justificativa.length < 15) return { success: false, message: "A justificativa deve ter no mínimo 15 caracteres." };

      // Busca a nota completa para evitar erros de colunas faltantes no select
      const { data: cab, error: cabErr } = await db.from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("nfe_cabecalho_id", nfeCabecalhoId).single();

      if (cabErr || !cab) {
        console.error("[FiscalService] Erro ao buscar nota:", cabErr);
        return { success: false, message: "Nota não localizada para cancelamento." };
      }

      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
      if (!fConfig) return { success: false, message: "Configuração fiscal não encontrada." };

      // O CNPJ do emitente costuma estar na tabela empresa ou f_config se não estiver na nota
      const { data: empresa } = await db.from("empresa").select("cnpj").eq("empresa_id", empresaId).single();
      const cnpjEmitente = cab.cnpj_emitente || empresa?.cnpj || "";

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const tipo: "NFE" | "NFCE" = Number(cab.modelo) === 65 ? "NFCE" : "NFE";

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: tipo === "NFE" ? "CANCELAR_NFE" : "CANCELAR_NFCE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          nfe_cabecalho_id: nfeCabecalhoId,
          chave: cab.chave_nfe,
          justificativa: justificativa,
          cnpj: cnpjEmitente,
          config: {
            uf: fConfig.uf,
            modelo: cab.modelo,
            ambiente: fConfig.ambiente_nfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado,
            tipo_certificado: fConfig.tipo_certificado,
            pasta_arquivos: (fConfig as any).pasta_arquivos_fiscais || ""
          }
        }
      }).select("id").single();

      if (evErr) return { success: false, message: evErr.message };

      const res = await this.aguardarEvento(evento.id, { empresaId });

      if (res.success && res.pdf_base64) {
        try {
          const binaryString = atob(res.pdf_base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
          const blob = new Blob([bytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
        } catch (e) {
          console.error("[FiscalService] Erro ao abrir PDF do comprovante:", e);
        }
      }

      return { success: res.success, message: res.mensagem };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
};
