// ============================================================
// Types para o módulo NF-e (Entrada de Notas Fiscais)
// ============================================================

export type TNfeSt = "A" | "C" | "E"; // Aberto | Cancelado | Escriturado
export type TNfeTpEntrada = "M" | "X"; // Manual | XML

export const NFE_ST_LABELS: Record<TNfeSt, string> = {
  A: "Aberto",
  C: "Cancelado",
  E: "Escriturado",
};

export interface INfeCabecalho {
  nfe_cabecalho_id: number;
  empresa_id: number;
  cadastro_id: number | null;
  deposito_id: number | null;
  tp_entrada: TNfeTpEntrada;
  st_nf: TNfeSt;
  nr_nota: string;
  serie: string;
  dt_emissao: string | null;
  dt_entrada: string | null;
  dt_saida: string | null;
  chave_nfe: string;
  nr_protocolo: string;
  vl_produtos: number;
  vl_desconto: number;
  vl_frete: number;
  vl_seguro: number;
  vl_despesa: number;
  vl_ipi: number;
  vl_icms_st: number;
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
  // Alíquotas
  pc_ipi: number;
  pc_icms: number;
  pc_icms_st: number;
  pc_pis: number;
  pc_cofins: number;
  pc_fcp_st: number;
  // CSTs
  cst_icms: string;
  cst_ipi: string;
  cst_pis: string;
  cst_cofins: string;
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
  qt_entrada: number;
  vl_unit: number;
  vl_desconto: number;
  vl_total: number;
  vl_ipi: number;
  vl_icms_st: number;
  vl_pis: number;
  vl_cofins: number;
  vl_fcp_st: number;
  pc_ipi: number;
  pc_icms: number;
  pc_icms_st: number;
  pc_pis: number;
  pc_cofins: number;
  pc_fcp_st: number;
  cst_icms: string;
  cst_ipi: string;
  cst_pis: string;
  cst_cofins: string;
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
  vl_produtos: number;
  vl_desconto: number;
  vl_frete: number;
  vl_seguro: number;
  vl_despesa: number;
  vl_ipi: number;
  vl_icms_st: number;
  vl_total_nf: number;
  obs_nf: string;
  itens: INfeXmlItem[];
  xmlRaw: string;
}
