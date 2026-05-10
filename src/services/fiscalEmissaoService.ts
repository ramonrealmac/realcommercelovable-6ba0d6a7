import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { gerarIniNfe } from "./gerarIniNfe";

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

      // 4. Buscar Regra Fiscal Cabeçalho
      const { data: regras } = await db
        .from("fiscal_regra")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("tp_operacao_id", movimento.tp_operacao_id)
        .eq("regime_trib", empresa.regime_trib)
        .eq("excluido", false)
        .order("prioridade", { ascending: false });

      const regra = regras?.[0];
      if (!regra) {
        throw new Error("Nenhuma regra fiscal ativa encontrada para esta operação e regime tributário.");
      }

      // 4.1 Incrementar Sequência na Configuração
      const nrNota = Number(fConfigItem.sequencia || 0);
      console.log(`[FiscalService] Utilizando nr_nota: ${nrNota} para ${tipo}`);
      
      const { error: updateSeqErr } = await db
        .from("fiscal_config_item")
        .update({ sequencia: nrNota + 1 })
        .eq("fiscal_config_item_id", fConfigItem.fiscal_config_item_id);
      
      if (updateSeqErr) {
        console.error("[FiscalService] Erro ao incrementar sequência:", updateSeqErr);
      }

      // 5. Preparar Cabeçalho
      const nfeCabecalho = {
        empresa_id: empresaId,
        cadastro_id: movimento.cadastro_id,
        movimento_id: movimentoId,
        deposito_id: movimento.deposito_id,
        modelo: Number(fConfigItem.modelo || (tipo === "NFE" ? 55 : 65)),
        serie: Number(fConfigItem.serie || 1),
        nr_nota: nrNota || 1,
        tp_nf: 1, // Saída
        tp_emis: 1, // Normal
        fin_nfe: 1, // Normal
        nat_op: regra.descricao?.substring(0, 60),
        dt_emissao: new Date().toISOString(),
        dt_saida: new Date().toISOString(),
        st_nf: "A", // Aberta/Pendente
        origem_inclusao: "M", // Manual/Interna
        vl_produto: (movimento as any).vl_produto ?? (movimento as any).vl_produtos ?? 0,
        vl_desconto: movimento.vl_desconto || 0,
        vl_frete: movimento.vl_frete || 0,
        vl_seguro: movimento.vl_seguro || 0,
        vl_despesa: movimento.vl_despesa || 0,
        vl_total_nf: movimento.vl_movimento || (movimento as any).vl_total || 0,
        updated_at: new Date().toISOString()
      };

      const { data: cabData, error: cabErr } = await db
        .from("fiscal_nfe_cabecalho")
        .insert(nfeCabecalho)
        .select()
        .single();

      if (cabErr) throw cabErr;
      const cabId = cabData.nfe_cabecalho_id;

      // 6. Processar Itens e Impostos
      let totalIcms = 0, totalIpi = 0, totalPis = 0, totalCofins = 0;
      let totalIbs = 0, totalCbs = 0, totalIs = 0;

      console.log("[fiscalEmissaoService] Iniciando loop de itens.");
      const itensM = (movimento.movimento_item || []).filter((it: any) => !it.excluido);
      console.log("[fiscalEmissaoService] Qtd itens ativos:", itensM.length);

      for (let i = 0; i < itensM.length; i++) {
        const mItem = itensM[i];
        console.log(`[fiscalEmissaoService] Item ${i+1}:`, mItem.nm_produto || (mItem as any).cd_produto);
        const prod = mItem.produto;
        
        // Buscar regra para cada imposto do item
        const { data: regrasItem } = await db
          .from("fiscal_regra_item")
          .select("*")
          .eq("fiscal_regra_id", regra.fiscal_regra_id)
          .eq("empresa_id", empresaId);

        // Função auxiliar para filtrar regra específica do item
        const findMelhorRegraItem = (tipoImp: string) => {
          return (regrasItem || []).filter(r => r.tipo_imposto === tipoImp).sort((a, b) => {
            let scoreA = 0, scoreB = 0;
            if (a.uf_destino === parceiro?.endereco_estado_id) scoreA += 10;
            if (b.uf_destino === parceiro?.endereco_estado_id) scoreB += 10;
            if (a.ncm_filtro === prod?.ncm) scoreA += 5;
            if (b.ncm_filtro === prod?.ncm) scoreB += 5;
            return scoreB - scoreA;
          })[0];
        };

        const rIcms = findMelhorRegraItem("ICMS");
        const rPis = findMelhorRegraItem("PIS");
        const rCofins = findMelhorRegraItem("COFINS");
        const rIpi = findMelhorRegraItem("IPI");
        const rIbsCbs = findMelhorRegraItem("IBSCBS");

        const bc = (mItem.vl_produto || 0) - (mItem.vl_desconto || 0);
        
        const calcTax = (bc: number, aliq: number | null, red: number | null) => {
          const base = bc * (1 - (red || 0) / 100);
          return (base * (aliq || 0)) / 100;
        };

        const vIcms = calcTax(bc, rIcms?.aliquota, rIcms?.base_reducao);
        const vPis = calcTax(bc, rPis?.aliquota, rPis?.base_reducao);
        const vCofins = calcTax(bc, rCofins?.aliquota, rCofins?.base_reducao);
        const vIpi = calcTax(bc, rIpi?.aliquota, rIpi?.base_reducao);
        const vIbs = calcTax(bc, rIbsCbs?.ibs_aliquota, null);
        const vCbs = calcTax(bc, rIbsCbs?.cbs_aliquota, null);
        const vIs = calcTax(bc, rIbsCbs?.is_aliquota, null);

        totalIcms += vIcms; totalPis += vPis; totalCofins += vCofins; totalIpi += vIpi;
        totalIbs += vIbs; totalCbs += vCbs; totalIs += vIs;

        const nfeItem = {
          nfe_cabecalho_id: cabId,
          empresa_id: empresaId,
          nr_item: i + 1,
          produto_id: mItem.produto_id,
          nm_produto: prod?.nome || "PRODUTO SEM NOME",
          unidade: prod?.unidade_id || "UN",
          qt_entrada: mItem.qt_movimento, // Na tabela de item chama qt_entrada mas serve pra saida tb
          vl_unit: mItem.vl_und_produto,
          vl_total: mItem.vl_produto,
          vl_desconto: mItem.vl_desconto,
          cfop: regra.cfop_id ? (await db.from("cfop").select("cd_cfop").eq("cfop_id", regra.cfop_id).single()).data?.cd_cfop : "5102",
          ncm: prod?.ncm || "",
          cest: prod?.cest || "",
          origem: prod?.origem || 0,
          cst_icms: rIcms?.cst_csosn || "000",
          pc_icms: rIcms?.aliquota || 0,
          vl_bc: mItem.vl_produto,
          vl_icms: vIcms,
          vl_icms_st: 0,
          cst_pis: rPis?.cst_pis_cofins || "01",
          pc_pis: rPis?.aliquota || 0,
          vl_pis: vPis,
          cst_cofins: rCofins?.cst_pis_cofins || "01",
          pc_cofins: rCofins?.aliquota || 0,
          vl_cofins: vCofins,
          cst_ipi: rIpi?.cst_pis_cofins || "53",
          pc_ipi: rIpi?.aliquota || 0,
          vl_ipi: vIpi,
          c_enq: rIpi?.ipi_c_enq || "999",
          cst_ibs: rIbsCbs?.cst_csosn || "",
          pc_ibs: rIbsCbs?.ibs_aliquota || 0,
          vl_ibs: vIbs,
          cst_cbs: rIbsCbs?.cst_csosn || "",
          pc_cbs: rIbsCbs?.cbs_aliquota || 0,
          vl_cbs: vCbs,
          cst_is: rIbsCbs?.cst_csosn || "",
          pc_is: rIbsCbs?.is_aliquota || 0,
          vl_is: vIs,
          updated_at: new Date().toISOString()
        };

        console.log(`[fiscalEmissaoService] Inserindo fiscal_nfe_item para item ${i+1}...`);
        const { error: eItem } = await db.from("fiscal_nfe_item").insert(nfeItem);
        if (eItem) {
          console.error(`[fiscalEmissaoService] Erro ao inserir item ${i+1}:`, eItem);
          throw new Error(`Erro no item ${i+1}: ${eItem.message}`);
        }
      }

      // 7. Atualizar totais no cabeçalho
      await db.from("fiscal_nfe_cabecalho")
        .update({
          vl_bc: (movimento as any).vl_produto || (movimento as any).vl_produtos || 0,
          vl_icms: totalIcms,
          vl_pis: totalPis,
          vl_cofins: totalCofins,
          vl_ipi: totalIpi,
          vl_ibs: totalIbs,
          vl_cbs: totalCbs,
          vl_is: totalIs,
        })
        .eq("nfe_cabecalho_id", cabId);

      // 8. Inserir Pagamentos
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

      // 9. Gerar INI e Despachar Evento para o Worker
      console.log(`[FiscalService] Gerando INI para ${tipo}...`);
      
      // Busca dados dos itens inseridos para garantir integridade no INI
      const { data: nfeItens } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", cabId);
      const { data: nfePagtos } = await db.from("fiscal_nfe_pagamento").select("*").eq("nfe_cabecalho_id", cabId);

      const iniContent = gerarIniNfe({
        cabecalho: { ...nfeCabecalho, nfe_cabecalho_id: cabId },
        itens: nfeItens || [],
        pagamentos: nfePagtos || [],
        empresa: empresa,
        cadastro: parceiro,
        fiscalConfig: fConfig,
        configItem: fConfigItem
      });

      const ambienteNfe = Number(fConfig?.ambiente_nfe || 2);
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: cabId,
        tipo: tipo,
        comando: tipo === "NFE" ? "EMITIR_NFE" : "EMITIR_NFCE",
        status: "PENDENTE",
        ambiente: ambienteNfe,
        user_id: authUser?.id || null,
        payload: {
          dados: iniContent,
          config: {
            uf: empresa.endereco_uf || empresa.cidade?.uf || "SP",
            modelo: nfeCabecalho.modelo,
            ambiente: ambienteNfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            csc: fConfigItem.csc || "",
            id_csc: fConfigItem.id_csc || ""
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

      const iniContent = gerarIniNfe({
        cabecalho: cab,
        itens: nfeItens || [],
        pagamentos: nfePagtos || [],
        empresa: empresa,
        cadastro: parceiro,
        fiscalConfig: fConfig,
        configItem: fConfigItem
      });

      const ambienteNfe = Number(fConfig?.ambiente_nfe || 2);
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        nfe_cabecalho_id: nfeCabecalhoId,
        tipo: tipo,
        comando: tipo === "NFE" ? "EMITIR_NFE" : "EMITIR_NFCE",
        status: "PENDENTE",
        ambiente: ambienteNfe,
        user_id: authUser?.id || null,
        payload: {
          dados: iniContent,
          config: {
            uf: empresa.endereco_uf || empresa.cidade?.uf || "SP",
            modelo: cab.modelo,
            ambiente: ambienteNfe,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO",
            csc: fConfigItem.csc || "",
            id_csc: fConfigItem.id_csc || ""
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
   * Aguarda um fiscal_evento finalizar (CONCLUIDO/ERRO) consultando por polling.
   * Retorna a resposta parseada do worker.
   */
  async aguardarEvento(eventoId: number, timeoutMs: number = 60000): Promise<{ success: boolean; resposta?: any; status?: string; mensagem?: string }> {
    const intervalo = 1000;
    const tentativas = Math.ceil(timeoutMs / intervalo);
    for (let i = 0; i < tentativas; i++) {
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
        return {
          success: ok,
          status: ev.status,
          resposta,
          mensagem: ev.mensagem_erro || resposta?.x_motivo || resposta?.erro || null,
        };
      }
    }
    return { success: false, status: "TIMEOUT", mensagem: "Tempo esgotado aguardando o Fiscal Worker." };
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
        if (ev?.status === "CONCLUIDO" || ev?.status === "ERRO") {
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
  }
};
