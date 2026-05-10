// ============================================================
// Types para o módulo NF-e (Entrada de Notas Fiscais)
// ============================================================

export type TNfeSt = "A" | "C" | "E" | "D"; // Aberto | Cancelado | Emitido | Denegado
export type TNfeOrigemInclusao = "M" | "X"; // Manual | XML

export const NFE_ST_LABELS: Record<TNfeSt, string> = {
  A: "Aberto",
  C: "Cancelado",
  E: "Emitido",
  D: "Denegado",
};

export interface INfeCabecalho {
  nfe_cabecalho_id: number;
  empresa_id: number;
  cadastro_id: number | null;
  deposito_id: number | null;
  origem_inclusao: TNfeOrigemInclusao;
  modelo: string;
  tp_nf: number;
  fin_nfe: number;
  nat_op: string;
  tp_emis: number;
  st_nf: TNfeSt;
  c_stat: number | null;
  x_motivo: string | null;
  recibo_sefaz: string | null;
  nr_nota: string;
  serie: string;
  dt_emissao: string | null;
  dt_entrada: string | null;
  dt_saida: string | null;
  chave_nfe: string;
  nr_protocolo: string;
  vl_produto: number;
  vl_desconto: number;
  vl_frete: number;
  vl_seguro: number;
  vl_despesa: number;
  vl_ipi: number;
  vl_icms: number;
  vl_bc: number;
  vl_icms_st: number;
  vl_pis: number;
  vl_cofins: number;
  vl_ibs: number;
  vl_cbs: number;
  vl_is: number;
  vl_total_nf: number;
  obs_nf: string;
  xml_nf: string | null;
  excluido: boolean;
}

export interface INfeItem {
  nfe_item_id: number;
  nfe_cabecalho_id: number;
  empresa_id: number;
  produto_id: number | null;
  nr_item: number;
  cd_prod_fornec: string;
  nm_produto: string;
  ncm: string;
  cfop: string;
  unidade: string;
  gtin: string;
  origem: number;
  csosn: string;
  cest: string;
  c_enq: string;
  qt_entrada: number;
  vl_unit: number;
  vl_desconto: number;
  vl_total: number;
  // Valores impostos
  vl_ipi: number;
  vl_icms_st: number;
  vl_pis: number;
  vl_cofins: number;
  vl_fcp_st: number;
  vl_ibs: number;
  vl_cbs: number;
  vl_is: number;
  // Alíquotas
  pc_ipi: number;
  pc_icms: number;
  pc_icms_st: number;
  pc_pis: number;
  pc_cofins: number;
  pc_fcp_st: number;
  pc_ibs: number;
  pc_cbs: number;
  pc_is: number;
  // CSTs
  cst_icms: string;
  cst_ipi: string;
  cst_pis: string;
  cst_cofins: string;
  cst_ibs: string;
  cst_cbs: string;
  cst_is: string;
  // MVA/ST
  pc_mva: number;
  vl_bc_st: number;
  excluido: boolean;
}

// ── Dados extraídos do XML ──────────────────────────────────

export interface INfeXmlEmitente {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cep: string;
  endereco_cidade: string;
  endereco_uf: string;
  fone: string;
  email: string;
}

export interface INfeXmlItem {
  nr_item: number;
  cd_prod_fornec: string;
  nm_produto: string;
  ncm: string;
  cfop: string;
  unidade: string;
  gtin: string;
  origem?: number;
  csosn?: string;
  cest?: string;
  c_enq?: string;
  qt_entrada: number;
  vl_unit: number;
  vl_desconto: number;
  vl_total: number;
  vl_ipi: number;
  vl_icms_st: number;
  vl_pis: number;
  vl_cofins: number;
  vl_fcp_st: number;
  vl_ibs?: number;
  vl_cbs?: number;
  vl_is?: number;
  pc_ipi: number;
  pc_icms: number;
  pc_icms_st: number;
  pc_pis: number;
  pc_cofins: number;
  pc_fcp_st: number;
  pc_ibs?: number;
  pc_cbs?: number;
  pc_is?: number;
  cst_icms: string;
  cst_ipi: string;
  cst_pis: string;
  cst_cofins: string;
  cst_ibs?: string;
  cst_cbs?: string;
  cst_is?: string;
  pc_mva: number;
  vl_bc_st: number;
}

export interface INfeDadosXml {
  emitente: INfeXmlEmitente;
  nr_nota: string;
  serie: string;
  dt_emissao: string;
  dt_saida: string;
  chave_nfe: string;
  nr_protocolo: string;
  vl_produto: number;
  vl_desconto: number;
  vl_frete: number;
  vl_seguro: number;
  vl_despesa: number;
  vl_ipi: number;
  vl_icms_st: number;
  vl_pis?: number;
  vl_cofins?: number;
  vl_ibs?: number;
  vl_cbs?: number;
  vl_is?: number;
  vl_total_nf: number;
  obs_nf: string;
  itens: INfeXmlItem[];
  xmlRaw: string;
}

