import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface IFiscalInput {
  produto_id: number;
  empresa_id: number;
  cliente_id?: number;
  tp_operacao_id: number;
  quantidade: number;
  vl_unitario: number;
  vl_frete?: number;
  vl_desconto?: number;
  vl_outras_desp?: number;
}

export interface IFiscalResult {
  cfop: string;
  cfop_id: number | null;
  regra_id: number | null;
  // ICMS
  cst_csosn: string;
  bc_icms: number;
  vl_icms: number;
  pc_icms: number;
  // ICMS-ST
  bc_icms_st: number;
  vl_icms_st: number;
  pc_icms_st: number;
  // DIFAL
  vl_difal: number;
  vl_fcp_difal: number;
  // FCP
  vl_fcp: number;
  vl_fcp_st: number;
  // IPI
  cst_ipi: string;
  vl_ipi: number;
  pc_ipi: number;
  // PIS
  cst_pis: string;
  vl_pis: number;
  pc_pis: number;
  // COFINS
  cst_cofins: string;
  vl_cofins: number;
  pc_cofins: number;
  // Reforma Tributária 2026+
  vl_ibs: number;
  vl_cbs: number;
  vl_is: number;
  // Totais
  vl_total_impostos: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Verifica se um valor é wildcard (preenchido com 9s ou vazio) */
function isWildcard(value: string | null | undefined): boolean {
  if (!value) return true;
  const clean = value.replace(/[.\-/]/g, "");
  return /^9+$/.test(clean) || clean === "" || clean === "*";
}

/** Calcula score de especificidade para filtros de item/cfop */
function calculateScore(item: any): number {
  let score = 0;
  if (!isWildcard(item.ncm_filtro)) score += 40;
  if (!isWildcard(item.cest_filtro)) score += 20;
  if (item.uf_destino && item.uf_destino !== "*") score += 10;
  if (item.cliente_contribuinte !== null) score += 5;
  if (item.cliente_consumidor_final !== null) score += 5;
  if (item.origem_produto !== null && item.origem_produto !== undefined) score += 2;
  return score;
}

/** Arredonda para 2 casas decimais */
const r2 = (v: number) => Math.round(v * 100) / 100;

// ─── Motor de Busca ──────────────────────────────────────────────────────────

async function getBestMatch(table: string, regraId: number, produto: any, uf_destino: string, contribuinte: boolean, consumidorFinal: boolean, tipoImposto?: string) {
  let query = db.from(table).select(table === "fiscal_regra_cfop" ? "*, cfop(cd_cfop)" : "*")
    .eq("fiscal_regra_id", regraId)
    .eq("excluido", false);

  if (tipoImposto) {
    query = query.eq("tipo_imposto", tipoImposto);
  }

  const { data: items } = await query;
  if (!items || items.length === 0) return null;

  // Filtro manual para garantir match exato ou wildcard
  const eligible = items.filter((it: any) => {
    // UF match
    if (it.uf_destino !== "*" && it.uf_destino !== uf_destino) return false;
    // NCM match (se não for wildcard)
    if (!isWildcard(it.ncm_filtro) && it.ncm_filtro !== produto.ncm) return false;
    // CEST match
    if (!isWildcard(it.cest_filtro) && it.cest_filtro !== produto.cest) return false;
    // Contribuinte match
    if (it.cliente_contribuinte !== null && it.cliente_contribuinte !== contribuinte) return false;
    // Consumidor Final match
    if (it.cliente_consumidor_final !== null && it.cliente_consumidor_final !== consumidorFinal) return false;
    // Origem Produto match
    if (it.origem_produto !== null && it.origem_produto !== produto.tb_a_origem) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  // Retorna o de maior score
  return eligible.sort((a: any, b: any) => calculateScore(b) - calculateScore(a))[0];
}

// ─── Serviço Principal ───────────────────────────────────────────────────────

export const fiscalService = {
  async calcular(input: IFiscalInput): Promise<IFiscalResult> {
    const res: IFiscalResult = {
      cfop: "", cfop_id: null, regra_id: null,
      cst_csosn: "400", bc_icms: 0, vl_icms: 0, pc_icms: 0,
      bc_icms_st: 0, vl_icms_st: 0, pc_icms_st: 0,
      vl_difal: 0, vl_fcp_difal: 0,
      vl_fcp: 0, vl_fcp_st: 0,
      cst_ipi: "99", vl_ipi: 0, pc_ipi: 0,
      cst_pis: "07", vl_pis: 0, pc_pis: 0,
      cst_cofins: "07", vl_cofins: 0, pc_cofins: 0,
      vl_ibs: 0, vl_cbs: 0, vl_is: 0,
      vl_total_impostos: 0
    };

    // 1. Carregar dados básicos
    const [prodRes, empRes, cliRes] = await Promise.all([
      db.from("produto").select("*").eq("produto_id", input.produto_id).maybeSingle(),
      db.from("empresa").select("*").eq("empresa_id", input.empresa_id).maybeSingle(),
      input.cliente_id 
        ? db.from("cadastro").select("*, cidade(estado_id)").eq("cadastro_id", input.cliente_id).maybeSingle()
        : Promise.resolve({ data: null })
    ]);

    const produto = prodRes.data;
    const empresa = empRes.data;
    const cliente = cliRes.data;

    if (!produto || !empresa) return res;

    // Localização
    const uf_destino = cliente?.cidade?.estado_id || empresa.endereco_cidade_id ? (await db.from("cidade").select("estado_id").eq("cidade_id", empresa.endereco_cidade_id).maybeSingle()).data?.estado_id : "";
    const uf_origem = empresa.endereco_cidade_id ? (await db.from("cidade").select("estado_id").eq("cidade_id", empresa.endereco_cidade_id).maybeSingle()).data?.estado_id : "";
    
    const interestadual = uf_origem && uf_destino && uf_origem !== uf_destino;
    const contribuinte = cliente?.tp_contribuinte === "S";
    const consumidorFinal = !contribuinte; // Simplificação padrão

    // 2. Localizar a Regra Fiscal (Header)
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: regras } = await db.from("fiscal_regra")
      .select("*")
      .eq("tp_operacao_id", input.tp_operacao_id)
      .eq("excluido", false)
      .or(`regime_trib.eq.${empresa.regime_trib},regime_trib.is.null`);

    const regrasValidas = (regras || []).filter((r: any) => {
      if (r.vigencia_inicio && r.vigencia_inicio > hoje) return false;
      if (r.vigencia_fim && r.vigencia_fim < hoje) return false;
      return true;
    }).sort((a: any, b: any) => (b.prioridade || 0) - (a.prioridade || 0));

    if (regrasValidas.length === 0) return res;
    const regra = regrasValidas[0];
    res.regra_id = regra.fiscal_regra_id;

    // 3. Localizar CFOP e Impostos específicos
    const [matchCfop, matchIcms, matchIpi, matchPis, matchCofins, matchCbsIbs] = await Promise.all([
      getBestMatch("fiscal_regra_cfop", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal),
      getBestMatch("fiscal_regra_item", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal, "ICMS"),
      getBestMatch("fiscal_regra_item", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal, "IPI"),
      getBestMatch("fiscal_regra_item", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal, "PIS"),
      getBestMatch("fiscal_regra_item", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal, "COFINS"),
      getBestMatch("fiscal_regra_item", regra.fiscal_regra_id, produto, uf_destino, contribuinte, consumidorFinal, "CBSIBS")
    ]);

    res.cfop_id = matchCfop?.cfop_id || regra.cfop_id;
    res.cfop = matchCfop?.cfop?.cd_cfop || "";

    // 4. Cálculos de Valores Base
    const vl_bruto = input.quantidade * input.vl_unitario;
    const vl_desconto = input.vl_desconto || 0;
    const vl_frete = input.vl_frete || 0;
    const vl_outras = input.vl_outras_desp || 0;
    const baseCalculo = vl_bruto - vl_desconto;

    const estadoDestRes = uf_destino ? await db.from("estado").select("*").eq("estado_id", uf_destino).maybeSingle() : { data: null };
    const estDest = estadoDestRes.data;

    // ── ICMS ────────────────────────────────────────────────────────────────
    if (matchIcms) {
      res.cst_csosn = matchIcms.cst_csosn || "400";
      const aliq = Number(matchIcms.aliquota) || (estDest ? Number(estDest.icms_interno) : 0);
      const red = Number(matchIcms.base_reducao) || 0;
      
      const temDebito = !["40","41","50","60","400","500"].includes(res.cst_csosn);
      if (temDebito) {
        res.bc_icms = r2(baseCalculo * (1 - red / 100));
        res.pc_icms = aliq;
        res.vl_icms = r2(res.bc_icms * aliq / 100);
      }

      // ST
      const temST = ["10","30","70","201","202","203"].includes(res.cst_csosn);
      if (temST) {
        const mva = Number(matchIcms.icms_st_mva) || Number(produto.mva) || 0;
        const aliqST = Number(matchIcms.icms_st_aliquota) || (estDest ? Number(estDest.icms_interno) : 0);
        const redST = Number(matchIcms.icms_st_base_reducao) || 0;
        
        res.bc_icms_st = r2((baseCalculo + vl_frete + vl_outras) * (1 + mva / 100) * (1 - redST / 100));
        res.pc_icms_st = aliqST;
        res.vl_icms_st = r2(Math.max(0, (res.bc_icms_st * aliqST / 100) - res.vl_icms));
      }

      // DIFAL
      if (interestadual && consumidorFinal && estDest) {
        const aliqInter = Number(empresa.pc_icms_interestadual) || 12;
        const aliqIntra = Number(estDest.icms_interno) || 0;
        res.vl_difal = r2(res.bc_icms * Math.max(0, aliqIntra - aliqInter) / 100);
        res.vl_fcp_difal = r2(res.bc_icms * (Number(estDest.pc_fcp) || 0) / 100);
      }
    }

    // ── IPI ─────────────────────────────────────────────────────────────────
    if (matchIpi) {
      res.cst_ipi = matchIpi.cst_csosn || "99";
      res.pc_ipi = Number(matchIpi.aliquota) || Number(produto.pc_ipi) || 0;
      res.vl_ipi = r2(baseCalculo * res.pc_ipi / 100);
    }

    // ── PIS/COFINS ──────────────────────────────────────────────────────────
    if (matchPis) {
      res.cst_pis = matchPis.cst_csosn || "07";
      res.pc_pis = Number(matchPis.aliquota) || Number(produto.pc_pis) || 0;
      res.vl_pis = r2(baseCalculo * res.pc_pis / 100);
    }
    if (matchCofins) {
      res.cst_cofins = matchCofins.cst_csosn || "07";
      res.pc_cofins = Number(matchCofins.aliquota) || Number(produto.pc_cofins) || 0;
      res.vl_cofins = r2(baseCalculo * res.pc_cofins / 100);
    }

    // ── Reforma Tributária 2026+ ────────────────────────────────────────────
    if (matchCbsIbs) {
      res.vl_ibs = r2(baseCalculo * (Number(matchCbsIbs.ibs_aliquota) || 0) / 100);
      res.vl_cbs = r2(baseCalculo * (Number(matchCbsIbs.cbs_aliquota) || 0) / 100);
      res.vl_is = r2(baseCalculo * (Number(matchCbsIbs.is_aliquota) || 0) / 100);
    }

    // ── Totais ──────────────────────────────────────────────────────────────
    res.vl_total_impostos = r2(
      res.vl_icms + res.vl_icms_st + res.vl_difal + res.vl_fcp_difal + 
      res.vl_ipi + res.vl_pis + res.vl_cofins + 
      res.vl_ibs + res.vl_cbs + res.vl_is
    );

    return res;
  }
};
