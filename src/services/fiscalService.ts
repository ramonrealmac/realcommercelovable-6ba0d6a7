import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

// ─── Tipos ─────────────────────────────────────────────────────────────────

export interface IFiscalInput {
  produto_id: number;
  empresa_id: number;
  cliente_id?: number;
  tipo_operacao_id: number;
  quantidade: number;
  vl_unitario: number;
  vl_frete?: number;
  vl_desconto?: number;
  vl_outras_desp?: number;
}

export interface IFiscalResult {
  cfop: string;
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
  // Reforma Tributária (zerado por ora)
  vl_ibs: number;
  vl_cbs: number;
  vl_is: number;
  // Totais
  vl_total_impostos: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Todos os dígitos iguais a 9 → wildcard (regra geral) */
function isWildcard(value: string | null | undefined): boolean {
  if (!value) return true;
  return /^9+$/.test(value.replace(/[.\-/]/g, ""));
}

/** Mapeia regime_trib → CRT numérico NF-e */
function toCRT(regime_trib: string): number {
  return regime_trib === "S" ? 1 : 3;
}

/** Score de especificidade de uma configuração fiscal */
function scoreConfig(cfg: any): number {
  let score = 0;
  if (!isWildcard(cfg.ncm_filtro))   score += 4;
  if (!isWildcard(cfg.cest_filtro))  score += 2;
  if (cfg.uf_destino && cfg.uf_destino !== "*") score += 1;
  if (cfg.crt_empresa !== null && cfg.crt_empresa !== undefined) score += 1;
  if (cfg.cliente_contribuinte !== null) score += 1;
  return score + (cfg.prioridade || 0);
}

/** Arredonda para 2 casas */
const r2 = (v: number) => Math.round(v * 100) / 100;

// ─── Motor de Busca de Regra ─────────────────────────────────────────────────

async function buscarRegra(
  produto: any,
  empresa: any,
  cliente: any,
  tipo_operacao_id: number
): Promise<{ config: any; regra: any; impostos: any[] } | null> {
  const crt = toCRT(empresa.regime_trib || "N");
  const uf_destino = cliente?.uf || "*";
  const contribuinte = cliente?.tp_contribuinte === "S";

  // Busca todas as configurações elegíveis para esta combinação
  const { data: configs } = await db
    .from("fiscal_configuracao")
    .select("*")
    .eq("empresa_id", empresa.empresa_id)
    .eq("excluido", false)
    .or(`tipo_operacao_id.eq.${tipo_operacao_id},tipo_operacao_id.is.null`)
    .or(`crt_empresa.eq.${crt},crt_empresa.is.null`)
    .or(`uf_destino.eq.${uf_destino},uf_destino.eq.*,uf_destino.is.null`);

  if (!configs || configs.length === 0) return null;

  // Filtra por NCM, CEST, vigência e contribuinte
  const hoje = new Date().toISOString().slice(0, 10);
  const elegíveis = configs.filter((cfg: any) => {
    // NCM: wildcard ou match
    if (!isWildcard(cfg.ncm_filtro) && cfg.ncm_filtro !== produto.ncm) return false;
    // CEST: wildcard ou match
    if (!isWildcard(cfg.cest_filtro) && cfg.cest_filtro !== produto.cest) return false;
    // Vigência
    if (cfg.vigencia_inicio && cfg.vigencia_inicio > hoje) return false;
    if (cfg.vigencia_fim   && cfg.vigencia_fim   < hoje) return false;
    // Contribuinte
    if (cfg.cliente_contribuinte !== null && cfg.cliente_contribuinte !== contribuinte) return false;
    // Consumidor final
    if (cfg.cliente_consumidor_final !== null && cfg.cliente_consumidor_final === contribuinte) return false;
    // Origem produto
    if (cfg.origem_produto && cfg.origem_produto !== produto.tb_a_origem) return false;
    return true;
  });

  if (elegíveis.length === 0) return null;

  // Ordena por score de especificidade decrescente → primeira regra vence
  elegíveis.sort((a: any, b: any) => scoreConfig(b) - scoreConfig(a));
  const config = elegíveis[0];

  // Busca a regra e seus impostos
  const { data: regra } = await db
    .from("fiscal_regra")
    .select("*")
    .eq("fiscal_regra_id", config.fiscal_regra_id)
    .maybeSingle();

  const { data: impostos } = await db
    .from("fiscal_regra_imposto")
    .select("*")
    .eq("fiscal_regra_id", config.fiscal_regra_id)
    .eq("empresa_id", empresa.empresa_id);

  return { config, regra, impostos: impostos || [] };
}

// ─── Cálculo ────────────────────────────────────────────────────────────────

export async function calcularFiscal(input: IFiscalInput): Promise<IFiscalResult> {
  const resultado: IFiscalResult = {
    cfop: "", regra_id: null,
    cst_csosn: "400", bc_icms: 0, vl_icms: 0, pc_icms: 0,
    bc_icms_st: 0, vl_icms_st: 0, pc_icms_st: 0,
    vl_difal: 0, vl_fcp_difal: 0,
    vl_fcp: 0, vl_fcp_st: 0,
    cst_ipi: "99", vl_ipi: 0, pc_ipi: 0,
    cst_pis: "07", vl_pis: 0, pc_pis: 0,
    cst_cofins: "07", vl_cofins: 0, pc_cofins: 0,
    vl_ibs: 0, vl_cbs: 0, vl_is: 0,
    vl_total_impostos: 0,
  };

  // ── Dados base ────────────────────────────────────────────────────────────
  const [prodRes, empRes, cliRes] = await Promise.all([
    db.from("produto").select("*").eq("produto_id", input.produto_id).maybeSingle(),
    db.from("empresa").select("*").eq("empresa_id", input.empresa_id).maybeSingle(),
    input.cliente_id
      ? db.from("cadastro").select("*, cidade(estado_id)").eq("cadastro_id", input.cliente_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const produto = prodRes.data;
  const empresa = empRes.data;
  const cliente = cliRes.data;

  if (!produto || !empresa) return resultado;

  // UF do cliente (destino)
  const uf_destino: string = cliente?.cidade?.estado_id || "";
  const uf_origem: string  = empresa.endereco_cidade_id
    ? (await db.from("cidade").select("estado_id").eq("cidade_id", empresa.endereco_cidade_id).maybeSingle()).data?.estado_id || ""
    : "";

  // Estado destino (alíquotas)
  const estadoDestRes = uf_destino
    ? await db.from("estado").select("*").eq("estado_id", uf_destino).maybeSingle()
    : { data: null };
  const estadoDest = estadoDestRes.data;

  // Busca regra mais específica
  const match = await buscarRegra(produto, empresa, { ...cliente, uf: uf_destino }, input.tipo_operacao_id);
  if (!match) return resultado;

  const { config, regra, impostos } = match;
  resultado.regra_id = regra?.fiscal_regra_id || null;
  resultado.cfop     = regra?.cfop_id ? String(regra.cfop_id) : "";

  // ── Valores base ──────────────────────────────────────────────────────────
  const vl_bruto     = input.quantidade * input.vl_unitario;
  const vl_desconto  = input.vl_desconto || 0;
  const vl_frete     = input.vl_frete || 0;
  const vl_outras    = input.vl_outras_desp || 0;
  const vl_mercadoria = vl_bruto - vl_desconto;

  const interestadual = uf_origem && uf_destino && uf_origem !== uf_destino;
  const contribuinte  = cliente?.tp_contribuinte === "S";
  const consumidor_final = !contribuinte;

  // ── ICMS ──────────────────────────────────────────────────────────────────
  const icmsImposto = impostos.find((i: any) => i.tipo_imposto === "ICMS");
  if (icmsImposto) {
    resultado.cst_csosn = icmsImposto.cst_csosn || "400";
    const cst = icmsImposto.cst_csosn || "";

    // Alíquota: usa da regra se preenchida, senão usa do estado
    const pc_icms = Number(icmsImposto.aliquota) > 0
      ? Number(icmsImposto.aliquota)
      : (estadoDest ? Number(estadoDest.icms_interno) : 0);

    const reducao = Number(icmsImposto.base_reducao) || 0;

    // CSTs que têm crédito/débito de ICMS: 00, 10, 20, 51, 70, 90 / CSOSN: 101, 102, 201, 202, 500, 900
    const temICMS = !["40","41","50","60","400","500"].includes(cst);

    if (temICMS) {
      resultado.bc_icms = r2(vl_mercadoria * (1 - reducao / 100));
      resultado.pc_icms = pc_icms;
      resultado.vl_icms = r2(resultado.bc_icms * pc_icms / 100);
    }

    // ── ICMS-ST ────────────────────────────────────────────────────────────
    const temST = ["10","30","70","201","202","203"].includes(cst);
    if (temST) {
      const pc_mva   = Number(icmsImposto.icms_st_mva) > 0
        ? Number(icmsImposto.icms_st_mva)
        : Number(produto.mva) || 0;
      const pc_st    = Number(icmsImposto.icms_st_aliquota) > 0
        ? Number(icmsImposto.icms_st_aliquota)
        : (estadoDest ? Number(estadoDest.icms_interno) : 0);
      const red_st   = Number(icmsImposto.icms_st_base_reducao) || 0;

      resultado.bc_icms_st = r2(
        (vl_mercadoria + resultado.vl_ipi + vl_frete + vl_outras)
        * (1 + pc_mva / 100)
        * (1 - red_st / 100)
      );
      resultado.pc_icms_st = pc_st;
      resultado.vl_icms_st = r2(
        Math.max(0, resultado.bc_icms_st * pc_st / 100 - resultado.vl_icms)
      );
    }

    // ── DIFAL (interestadual + consumidor final) ───────────────────────────
    if (interestadual && consumidor_final && estadoDest) {
      const aliq_origem  = Number(empresa.pc_icms_interestadual) || 12;
      const aliq_destino = Number(estadoDest.icms_interno) || 0;
      const bc_difal     = r2(vl_mercadoria * (1 - reducao / 100));
      resultado.vl_difal     = r2(bc_difal * Math.max(0, aliq_destino - aliq_origem) / 100);
      resultado.vl_fcp_difal = r2(bc_difal * (Number(estadoDest.pc_fcp) || 0) / 100);
    }

    // ── FCP ────────────────────────────────────────────────────────────────
    if (estadoDest?.pc_fcp && !interestadual) {
      resultado.vl_fcp = r2(resultado.bc_icms * Number(estadoDest.pc_fcp) / 100);
    }
    if (estadoDest?.pc_fcp_st && temST) {
      resultado.vl_fcp_st = r2(resultado.bc_icms_st * Number(estadoDest.pc_fcp_st) / 100);
    }
  }

  // ── IPI ───────────────────────────────────────────────────────────────────
  const ipiImposto = impostos.find((i: any) => i.tipo_imposto === "IPI");
  if (ipiImposto) {
    resultado.cst_ipi = ipiImposto.cst_csosn || "99";
    const pc_ipi = Number(ipiImposto.aliquota) > 0
      ? Number(ipiImposto.aliquota)
      : Number(produto.pc_ipi) || 0;
    resultado.pc_ipi = pc_ipi;
    resultado.vl_ipi = r2(vl_mercadoria * pc_ipi / 100);
  }

  // ── PIS ───────────────────────────────────────────────────────────────────
  const pisImposto = impostos.find((i: any) => i.tipo_imposto === "PIS");
  if (pisImposto) {
    resultado.cst_pis = pisImposto.cst_csosn || "07";
    const pc = Number(pisImposto.aliquota) > 0 ? Number(pisImposto.aliquota) : Number(produto.pc_pis) || 0;
    resultado.pc_pis = pc;
    resultado.vl_pis = r2(vl_mercadoria * pc / 100);
  }

  // ── COFINS ────────────────────────────────────────────────────────────────
  const cofinsImposto = impostos.find((i: any) => i.tipo_imposto === "COFINS");
  if (cofinsImposto) {
    resultado.cst_cofins = cofinsImposto.cst_csosn || "07";
    const pc = Number(cofinsImposto.aliquota) > 0 ? Number(cofinsImposto.aliquota) : Number(produto.pc_cofins) || 0;
    resultado.pc_cofins = pc;
    resultado.vl_cofins = r2(vl_mercadoria * pc / 100);
  }

  // ── Reforma Tributária (calculado = 0 por ora) ────────────────────────────
  // IBS, CBS, IS — campos preparados para implementação futura
  resultado.vl_ibs = 0;
  resultado.vl_cbs = 0;
  resultado.vl_is  = 0;

  // ── Total de impostos ─────────────────────────────────────────────────────
  resultado.vl_total_impostos = r2(
    resultado.vl_icms +
    resultado.vl_icms_st +
    resultado.vl_difal +
    resultado.vl_fcp_difal +
    resultado.vl_fcp +
    resultado.vl_fcp_st +
    resultado.vl_ipi +
    resultado.vl_pis +
    resultado.vl_cofins
  );

  return resultado;
}

export const fiscalService = { calcular: calcularFiscal };
