import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const db = supabase as any;

export interface FiscalEmissaoResult {
  success: boolean;
  nfe_cabecalho_id?: number;
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
        .select("*, movimento_item(*, produto(*)), movimento_pagamento(*)")
        .eq("movimento_id", movimentoId)
        .single();

      if (movErr || !movimento) {
        throw new Error("Movimento não localizado: " + movErr?.message);
      }

      // 2. Obter dados da empresa e parceiro
      const { data: empresa } = await db.from("empresa").select("*").eq("empresa_id", empresaId).single();
      const { data: parceiro } = movimento.cadastro_id 
        ? await db.from("cadastro").select("*").eq("cadastro_id", movimento.cadastro_id).single()
        : { data: null };

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

      // 5. Preparar Cabeçalho
      const nfeCabecalho = {
        empresa_id: empresaId,
        cadastro_id: movimento.cadastro_id,
        movimento_id: movimentoId,
        deposito_id: movimento.deposito_id,
        modelo: fConfigItem.modelo || (tipo === "NFE" ? "55" : "65"),
        serie: fConfigItem.serie || "1",
        tp_nf: 1, // Saída
        tp_emis: 1, // Normal
        fin_nfe: 1, // Normal
        nat_op: regra.descricao,
        dt_emissao: new Date().toISOString(),
        dt_saida: new Date().toISOString(),
        st_nf: "0", // Pendente
        origem_inclusao: "EMISSAO_PROPRIA",
        vl_produtos: movimento.vl_total_itens || 0,
        vl_desconto: movimento.vl_desconto || 0,
        vl_frete: movimento.vl_frete || 0,
        vl_seguro: movimento.vl_seguro || 0,
        vl_despesa: movimento.vl_outras_despesas || 0,
        vl_total_nf: movimento.vl_total_movimento || 0,
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

      for (let i = 0; i < movimento.movimento_item.length; i++) {
        const mItem = movimento.movimento_item[i];
        const prod = mItem.produto;
        
        // Buscar regra para cada imposto do item
        const { data: regrasItem } = await db
          .from("fiscal_regra_item")
          .select("*")
          .eq("fiscal_regra_id", regra.fiscal_regra_id)
          .eq("empresa_id", empresaId);

        // Função auxiliar para filtrar regra específica do item
        const findMelhorRegraItem = (tipoImp: string) => {
          return regrasItem?.filter(r => r.tipo_imposto === tipoImp).sort((a, b) => {
            // Priorização simples: quem tem mais filtros preenchidos ganha
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

        const bc = (mItem.vl_total || 0) - (mItem.vl_desconto || 0);
        
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
          qt_entrada: mItem.quantidade, // Na tabela de item chama qt_entrada mas serve pra saida tb
          vl_unit: mItem.vl_unitario,
          vl_total: mItem.vl_total,
          vl_desconto: mItem.vl_desconto,
          cfop: regra.cfop_id ? (await db.from("cfop").select("cd_cfop").eq("cfop_id", regra.cfop_id).single()).data?.cd_cfop : "5102",
          ncm: prod?.ncm || "",
          cest: prod?.cest || "",
          origem: prod?.origem || 0,
          cst_icms: rIcms?.cst_csosn || "000",
          pc_icms: rIcms?.aliquota || 0,
          vl_icms_st: 0, // Implementar ST se necessário
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

        await db.from("fiscal_nfe_item").insert(nfeItem);
      }

      // 7. Atualizar totais no cabeçalho
      await db.from("fiscal_nfe_cabecalho")
        .update({
          vl_pis: totalPis,
          vl_cofins: totalCofins,
          vl_ipi: totalIpi,
          vl_ibs: totalIbs,
          vl_cbs: totalCbs,
          vl_is: totalIs,
          // ICMS Próprio não tem campo direto no cabeçalho pelo schema fornecido, 
          // mas geralmente soma-se no total se não for Simples Nacional.
        })
        .eq("nfe_cabecalho_id", cabId);

      // 8. Inserir Pagamentos
      for (const p of movimento.movimento_pagamento) {
        const nfePag = {
          nfe_cabecalho_id: cabId,
          t_pag: p.tipo_pagamento_id || "01", // Mapear conforme SEFAZ se necessário
          v_pag: p.vl_pagamento,
          tp_integra: p.tp_integra || 2, // 2 = Não Integrado
          c_aut: p.nr_autorizacao,
          cnpj_credenciadora: p.cnpj_credenciadora
        };
        await db.from("fiscal_nfe_pagamento").insert(nfePag);
      }

      console.log(`[FiscalService] Documento ${cabId} gerado com sucesso.`);
      return { success: true, nfe_cabecalho_id: cabId };

    } catch (e: any) {
      console.error("[FiscalService] Erro:", e);
      return { success: false, message: e.message };
    }
  }
};
