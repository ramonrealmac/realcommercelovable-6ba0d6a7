// ============================================================
// Types para o módulo MDF-e
// ============================================================

export type TMdfSt = "A" | "X" | "C" | "E";
// A = Aberto/Pendente   X = Autorizado   C = Cancelado   E = Encerrado

export const MDF_ST_LABELS: Record<TMdfSt, string> = {
  A: "Pendente",
  X: "Autorizado",
  C: "Cancelado",
  E: "Encerrado",
};

export const MDF_ST_COLORS: Record<TMdfSt, string> = {
  A: "text-yellow-600",
  X: "text-green-600",
  C: "text-red-600",
  E: "text-blue-600",
};

export type TMdfTpDoc = "NFE" | "NFCE" | "CTE";

export interface IMdfCabecalho {
  mdf_cabecalho_id: number;
  empresa_id: number;
  nr_mdf: string;
  serie: string;
  dt_emissao: string;
  dt_ini_viagem: string;
  dt_fim_viagem: string | null;
  cnpj_emit: string;
  ie_emit: string;
  uf_ini: string;
  uf_fim: string;
  cidades_percurso: string;
  // Veículo tração
  placa_veiculo: string;
  rntrc_veiculo: string;
  uf_veiculo: string;
  tara_veiculo: number;
  cap_kg_veiculo: number;
  cap_m3_veiculo: number;
  tp_rodado: string;
  tp_carroceria: string;
  // Condutor
  condutor_nome: string;
  condutor_cpf: string;
  // Totais
  qt_nf: number;
  vl_carga: number;
  kg_carga: number;
  unid_medida_carga: string;
  // CIOT
  ciot: string | null;
  cnpj_ciot: string | null;
  // Seguro
  seguradora_nome: string | null;
  seguradora_cnpj: string | null;
  nr_apolice: string | null;
  nr_averbacao: string | null;
  // Status / autorização
  st_mdf: TMdfSt;
  chave_mdf: string;
  nr_protocolo: string;
  dt_autorizacao: string | null;
  xml_autorizado: string | null;
  xml_encerramento: string | null;
  obs_mdf: string;
  excluido: boolean;
}

export interface IMdfNf {
  mdf_nf_id: number;
  mdf_cabecalho_id: number;
  empresa_id: number;
  tp_doc: TMdfTpDoc;
  chave_doc: string;
  nr_nota: string;
  serie: string;
  cnpj_emit_doc: string;
  vl_doc: number;
  kg_doc: number;
  cidade_descarreg: string;
  estado_descarreg: string;
  excluido: boolean;
}

export interface IMdfVeiculoReboque {
  mdf_reboque_id: number;
  mdf_cabecalho_id: number;
  empresa_id: number;
  placa: string;
  uf: string;
  tara: number;
  cap_kg: number;
  cap_m3: number;
  tp_carroceria: string;
  excluido: boolean;
}

export interface IMdfLog {
  mdf_log_id: number;
  mdf_cabecalho_id: number;
  empresa_id: number;
  tp_acao: string;
  dt_log: string;
  retorno_acbr: string | null;
  sucesso: boolean;
  obs: string | null;
}

// ── Tabelas de referência de domínio ──

export const TP_RODADO_OPTIONS = [
  { value: "01", label: "01 - Truck" },
  { value: "02", label: "02 - Toco" },
  { value: "03", label: "03 - Cavalo Mecânico" },
  { value: "04", label: "04 - Van" },
  { value: "05", label: "05 - Utilitário" },
  { value: "06", label: "06 - Outros" },
];

export const TP_CARROCERIA_OPTIONS = [
  { value: "00", label: "00 - Não aplicável" },
  { value: "01", label: "01 - Aberta" },
  { value: "02", label: "02 - Fechada/Baú" },
  { value: "03", label: "03 - Graneleira" },
  { value: "04", label: "04 - Porta Container" },
  { value: "05", label: "05 - Sider" },
];

export const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

