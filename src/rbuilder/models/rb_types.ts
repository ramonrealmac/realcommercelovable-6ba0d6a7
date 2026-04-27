// RBuilder Types - Isolated module

export interface IRbConexao {
  rb_conexao_id: number;
  empresa_id: number;
  nome: string;
  url: string;
  api_key: string;
  descricao: string;
  excluido: boolean;
  dt_cadastro: string | null;
  dt_alteracao: string | null;
}

export interface IRbTemplatePesquisa {
  rb_templatepesquisa_id: number;
  empresa_id: number;
  nome: string;
  label: string;
  tipo: "text" | "integer" | "date" | "boolean" | "select" | "query_select";
  obrigatorio: boolean;
  valor_padrao: string;
  opcoes_fixas: string;
  query: string;
  rb_conexao_id: number | null;
  excluido: boolean;
  dt_cadastro: string | null;
  dt_alteracao: string | null;
}

export interface IRbRelatorio {
  rb_relatorio_id: number;
  empresa_id: number;
  nome: string;
  rb_conexao_id: number | null;
  menu: string;
  submenu: string;
  ordem: number;
  query_sql: string;
  report_json: IRbReportLayout | null;
  excluido: boolean;
  dt_cadastro: string | null;
  dt_alteracao: string | null;
}

export interface IRbRelatorioVariavel {
  rb_relatorio_variavel_id: number;
  rb_relatorio_id: number;
  rb_templatepesquisa_id: number;
  operador: string;
  excluido: boolean;
}

export interface IRbColumnLayout {
  key: string;
  label: string;
  width: number;
  align: "left" | "center" | "right";
  format: "text" | "number" | "date" | "currency";
  visible: boolean;
  totalType?: "sum" | "avg" | "count" | "none";
}

export interface IRbReportLayout {
  title: string;
  subtitle: string;
  columns: IRbColumnLayout[];
  groupByField: string;
  showHeader: boolean;
  showFooter: boolean;
}

export const RB_TIPO_OPTIONS = [
  { value: "text", label: "Texto" },
  { value: "integer", label: "Inteiro" },
  { value: "date", label: "Data" },
  { value: "boolean", label: "Lógico" },
  { value: "select", label: "Lista Fixa" },
  { value: "query_select", label: "Lista Dinâmica" },
];

export const RB_OPERADOR_OPTIONS = [
  { value: "=", label: "= (Igual)" },
  { value: "<", label: "< (Menor)" },
  { value: ">", label: "> (Maior)" },
  { value: "<=", label: "<= (Menor ou Igual)" },
  { value: ">=", label: ">= (Maior ou Igual)" },
  { value: "IN", label: "IN (Contém)" },
  { value: "LIKE", label: "LIKE (Similar)" },
];
