import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface FiltroRegra {
  tp_operacao_id: number | null;
  regime_trib: string; // 'S' | 'L' | 'N'
  empresa_id: number;
}

export interface FiltroItem {
  ncm: string;
  cest: string;
  fiscal_grupo_produto_id: number | null;
  origem: string;   // '0' | '1' | ... | '8'
  uf_destino: string; // 'SP' | 'RJ' | '*' etc
  is_contribuinte: boolean;
  is_consumidor_final: boolean;
}

export interface ResultadoTributos {
  // ICMS
  cfop: string;
  cst_icms: string;
  csosn: string;
  pc_icms: number;
  base_reducao_icms: number;
  mod_bc: number;
  // ICMS-ST
  pc_icms_st: number;
  mva_st: number;
  base_reducao_st: number;
  mod_bc_st: number;
  // IPI
  cst_ipi: string;
  pc_ipi: number;
  c_enq: string;
  // PIS / COFINS
  cst_pis: string;
  cst_cofins: string;
  pc_pis: number;
  pc_cofins: number;
  // Reforma Tributária
  pc_ibs: number;
  pc_cbs: number;
  pc_is: number;
}

/**
 * Score de especificidade de um filtro.
 * Quanto mais campos específicos (não wildcard), maior a prioridade.
 */
function calcularScore(row: any): number {
  let score = 0;
  if (row.uf_destino && row.uf_destino !== '*') score += 8;
  if (row.fiscal_grupo_produto_id || row.grupo_icms_id) score += 4;
  if (row.ncm_filtro && row.ncm_filtro !== '99999999') score += 2;
  if (row.cest_filtro && row.cest_filtro !== '9999999') score += 2;
  if (row.origem_produto && row.origem_produto !== '*') score += 1;
  score += (row.prioridade || 0);
  return score;
}

/**
 * Verifica se um item de regra bate com os filtros do produto.
 */
function bateComFiltro(regra: any, filtro: FiltroItem): boolean {
  const ufOk = !regra.uf_destino || regra.uf_destino === '*' || regra.uf_destino === filtro.uf_destino;
  const grupoOk = !regra.fiscal_grupo_produto_id || regra.fiscal_grupo_produto_id === filtro.fiscal_grupo_produto_id;
  const ncmOk = !regra.ncm_filtro || regra.ncm_filtro === '99999999' || regra.ncm_filtro === filtro.ncm;
  const cestOk = !regra.cest_filtro || regra.cest_filtro === '9999999' || regra.cest_filtro === filtro.cest;
  const origemOk = !regra.origem_produto || regra.origem_produto === '*' || regra.origem_produto === filtro.origem;
  return ufOk && grupoOk && ncmOk && cestOk && origemOk;
}

/**
 * Motor principal: busca regras fiscais + itens de tributos para uma combinação.
 */
export async function buscarTributosParaItem(
  filtroRegra: FiltroRegra,
  filtroItem: FiltroItem
): Promise<ResultadoTributos> {

  // 1. Busca as regras fiscais aplicáveis (por tp_operacao_id + regime_trib + empresa)
  const { data: regras, error: erroRegras } = await db
    .from('fiscal_regra')
    .select('fiscal_regra_id, prioridade, regime_trib, tp_operacao_id')
    .eq('empresa_id', filtroRegra.empresa_id)
    .eq('excluido', false)
    .or(`tp_operacao_id.is.null,tp_operacao_id.eq.${filtroRegra.tp_operacao_id}`)
    .or(`regime_trib.eq.*,regime_trib.eq.${filtroRegra.regime_trib}`);

  if (erroRegras || !regras?.length) {
    console.warn('[RegraFiscal] Nenhuma regra fiscal encontrada para a operação.');
    return tributosZerados();
  }

  const regraIds = regras.map((r: any) => r.fiscal_regra_id);
  const regraMap = Object.fromEntries(regras.map((r: any) => [r.fiscal_regra_id, r]));

  // 2. Busca CFOP (fiscal_regra_cfop)
  const { data: cfopRows } = await db
    .from('fiscal_regra_cfop')
    .select('*')
    .in('fiscal_regra_id', regraIds);

  // 3. Busca itens de tributos (fiscal_regra_item)
  const { data: itemRows } = await db
    .from('fiscal_regra_item')
    .select('*')
    .in('fiscal_regra_id', regraIds);

  // 4. Seleciona o melhor CFOP
  let melhorCfop: any = null;
  let melhorScoreCfop = -1;
  for (const row of (cfopRows || [])) {
    if (!bateComFiltro(row, filtroItem)) continue;
    const score = calcularScore({ ...row, prioridade: regraMap[row.fiscal_regra_id]?.prioridade || 0 });
    if (score > melhorScoreCfop) { melhorScoreCfop = score; melhorCfop = row; }
  }

  // 5. Seleciona o melhor item por tipo de tributo
  const selecionarMelhor = (tipo: string) => {
    let melhor: any = null;
    let melhorScore = -1;
    for (const row of (itemRows || [])) {
      if (row.tipo_imposto?.toUpperCase() !== tipo) continue;
      if (!bateComFiltro(row, filtroItem)) continue;
      const score = calcularScore({ ...row, prioridade: regraMap[row.fiscal_regra_id]?.prioridade || 0 });
      if (score > melhorScore) { melhorScore = score; melhor = row; }
    }
    return melhor;
  };

  const icms    = selecionarMelhor('ICMS');
  const ipi     = selecionarMelhor('IPI');
  const pis     = selecionarMelhor('PIS');
  const cofins  = selecionarMelhor('COFINS');
  const ibscbs  = selecionarMelhor('CBSIBS');

  // 6. Determina CST vs CSOSN conforme regime
  const isSimples = filtroRegra.regime_trib === 'S';

  return {
    cfop:               melhorCfop?.cfop?.cd_cfop || melhorCfop?.cfop_id?.toString() || '5102',
    cst_icms:           isSimples ? '' : (icms?.cst_csosn || '00'),
    csosn:              isSimples ? (icms?.cst_csosn || '400') : '',
    pc_icms:            Number(icms?.aliquota || 0),
    base_reducao_icms:  Number(icms?.base_reducao || 0),
    mod_bc:             Number(icms?.mod_bc ?? 3),
    pc_icms_st:         Number(icms?.icms_st_aliquota || 0),
    mva_st:             Number(icms?.icms_st_mva || 0),
    base_reducao_st:    Number(icms?.icms_st_base_reducao || 0),
    mod_bc_st:          Number(icms?.mod_bc_st ?? 4),
    cst_ipi:            ipi?.cst_csosn || '99',
    pc_ipi:             Number(ipi?.aliquota || 0),
    c_enq:              ipi?.ipi_c_enq || '999',
    cst_pis:            pis?.cst_csosn || pis?.cst_pis_cofins || '07',
    cst_cofins:         cofins?.cst_csosn || cofins?.cst_pis_cofins || '07',
    pc_pis:             Number(pis?.aliquota || 0),
    pc_cofins:          Number(cofins?.aliquota || 0),
    pc_ibs:             Number(ibscbs?.ibs_aliquota || 0),
    pc_cbs:             Number(ibscbs?.cbs_aliquota || 0),
    pc_is:              Number(ibscbs?.is_aliquota || 0),
  };
}

function tributosZerados(): ResultadoTributos {
  return {
    cfop: '5102', cst_icms: '00', csosn: '400',
    pc_icms: 0, base_reducao_icms: 0, mod_bc: 3,
    pc_icms_st: 0, mva_st: 0, base_reducao_st: 0, mod_bc_st: 4,
    cst_ipi: '99', pc_ipi: 0, c_enq: '999',
    cst_pis: '07', cst_cofins: '07', pc_pis: 0, pc_cofins: 0,
    pc_ibs: 0, pc_cbs: 0, pc_is: 0,
  };
}
