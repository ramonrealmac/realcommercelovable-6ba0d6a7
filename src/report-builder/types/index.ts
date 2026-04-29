// ============================================================
// Report Builder Pro — Type System
// ============================================================

// ── Primitivos ───────────────────────────────────────────────
export type RpbPageSize    = 'A4' | 'A3' | 'Letter';
export type RpbOrientation = 'portrait' | 'landscape';
export type RpbAlign       = 'left' | 'center' | 'right';
export type RpbFormat      = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'percent';
export type RpbTotalOp     = 'none' | 'sum' | 'avg' | 'count' | 'min' | 'max';
export type RpbBorder      = 'none' | 'all' | 'bottom' | 'top' | 'left' | 'right';
export type RpbFitMode     = 'contain' | 'cover' | 'fill';
export type RpbBandName    =
  | 'pageHeader' | 'reportHeader'
  | 'group1Header' | 'group2Header'
  | 'detail'
  | 'group2Footer' | 'group1Footer'
  | 'reportFooter' | 'pageFooter';

// ── Estilo de texto ──────────────────────────────────────────
export interface RpbStyle {
  fontSize:    number;       // pt
  bold:        boolean;
  italic:      boolean;
  underline:   boolean;
  color:       string;       // #hex
  bgColor:     string;       // #hex | 'transparent'
  align:       RpbAlign;
  border:      RpbBorder;
  borderColor: string;
  padding:     number;       // px
}

export const DEFAULT_STYLE: RpbStyle = {
  fontSize: 9, bold: false, italic: false, underline: false,
  color: '#1a1a1a', bgColor: 'transparent',
  align: 'left', border: 'none', borderColor: '#cccccc', padding: 2,
};

// ── Componentes ──────────────────────────────────────────────
interface RpbBaseComp {
  id:   string;
  x:    number;  // mm desde esquerda da banda
  y:    number;  // mm desde topo da banda
  w:    number;  // mm
  h:    number;  // mm
}

export interface RpbTextComp extends RpbBaseComp {
  type: 'text';
  content: string;   // suporta {campo}, {pagina}, {paginas}, {data}, {hora}
  style: RpbStyle;
}

export interface RpbTableColumn {
  field:      string;
  label:      string;
  w:          number;    // mm
  align:      RpbAlign;
  format:     RpbFormat;
  totalType:  RpbTotalOp;
  fontSize?:  number;    // pt — sobrescreve fonte da tabela para esta coluna
  color?:     string;    // #hex — sobrescreve cor da tabela para esta coluna
  style?:     Partial<RpbStyle>;
}

export interface RpbTableComp extends RpbBaseComp {
  type:           'table';
  columns:        RpbTableColumn[];
  headerStyle:    RpbStyle;
  rowStyle:       RpbStyle;
  altRowBg:       string;     // cor alternada ('transparent' = sem)
  showHeader:     boolean;
  showColumnTotals: boolean;
}

export interface RpbTotalizerComp extends RpbBaseComp {
  type:       'totalizer';
  field:      string;
  operation:  Exclude<RpbTotalOp, 'none'>;
  format:     RpbFormat;
  labelText:  string;
  scope:      'report' | 'group1' | 'group2';
  style:      RpbStyle;
}

export interface RpbImageComp extends RpbBaseComp {
  type: 'image';
  src:  string;   // URL ou {empresa_logo}
  fit:  RpbFitMode;
}

export interface RpbLineComp extends RpbBaseComp {
  type:        'line';
  orientation: 'horizontal' | 'vertical';
  color:       string;
  thickness:   number;   // px
}

export type RpbComponent =
  | RpbTextComp
  | RpbTableComp
  | RpbTotalizerComp
  | RpbImageComp
  | RpbLineComp;

// ── Banda ────────────────────────────────────────────────────
export interface RpbBand {
  height:     number;   // mm (0 = oculta)
  visible:    boolean;
  bgColor:    string;
  components: RpbComponent[];
}

export function emptyBand(height = 15): RpbBand {
  return { height, visible: true, bgColor: 'transparent', components: [] };
}

// ── Agrupamento ──────────────────────────────────────────────
export interface RpbGroupDef {
  level:           1 | 2;
  field:           string;   // campo do dataset para agrupar
  label:           string;   // nome amigável
  pageBreakBefore: boolean;
  header:          RpbBand;
  footer:          RpbBand;
}

// ── Layout completo ──────────────────────────────────────────
export interface RpbLayout {
  pageSize:    RpbPageSize;
  orientation: RpbOrientation;
  margins:     { top: number; right: number; bottom: number; left: number };
  groups:      RpbGroupDef[];   // máx 2
  bands: {
    pageHeader:    RpbBand;
    reportHeader:  RpbBand;
    group1Header:  RpbBand;
    group2Header:  RpbBand;
    detail:        RpbBand;
    group2Footer:  RpbBand;
    group1Footer:  RpbBand;
    reportFooter:  RpbBand;
    pageFooter:    RpbBand;
  };
}

export const BAND_LABELS: Record<RpbBandName, string> = {
  pageHeader:   'Cabeçalho da Página',
  reportHeader: 'Cabeçalho do Relatório',
  group1Header: 'Cabeçalho Grupo 1',
  group2Header: 'Cabeçalho Grupo 2',
  detail:       'Detalhe',
  group2Footer: 'Rodapé Grupo 2',
  group1Footer: 'Rodapé Grupo 1',
  reportFooter: 'Rodapé do Relatório',
  pageFooter:   'Rodapé da Página',
};

export const BAND_ORDER: RpbBandName[] = [
  'pageHeader','reportHeader','group1Header','group2Header',
  'detail',
  'group2Footer','group1Footer','reportFooter','pageFooter',
];

export function emptyLayout(): RpbLayout {
  return {
    pageSize: 'A4',
    orientation: 'portrait',
    margins: { top: 10, right: 10, bottom: 10, left: 10 },
    groups: [],
    bands: {
      pageHeader:   emptyBand(20),
      reportHeader: { ...emptyBand(0), visible: false },
      group1Header: { ...emptyBand(0), visible: false },
      group2Header: { ...emptyBand(0), visible: false },
      detail:       emptyBand(100),
      group2Footer: { ...emptyBand(0), visible: false },
      group1Footer: { ...emptyBand(0), visible: false },
      reportFooter: { ...emptyBand(10), visible: true },
      pageFooter:   emptyBand(10),
    },
  };
}

// ── DB: Relatório ────────────────────────────────────────────
export interface IRpbRelatorio {
  rpb_relatorio_id: number;
  empresa_id:       number;
  nome:             string;
  descricao:        string;
  categoria:        string;
  nm_form:          string;
  query_sql:        string;
  rpb_conexao_id:   number | null;
  layout_json:      RpbLayout | null;
  excluido:         boolean;
  created_at:       string;
  updated_at:       string;
}

export interface IRpbFiltro {
  rpb_filtro_id:    number;
  rpb_relatorio_id: number;
  empresa_id:       number;
  nome:             string;
  label:            string;
  tipo:             'text' | 'date' | 'date_range' | 'number' | 'select' | 'boolean' | 'query_select';
  obrigatorio:      boolean;
  valor_padrao:     string;
  opcoes_fixas:     string;
  query_opcoes:     string;
  ordem:            number;
  excluido:         boolean;
}

export interface IRpbConexao {
  rpb_conexao_id: number;
  empresa_id:     number;
  nome:           string;
  url:            string;
  api_key:        string;
  descricao:      string;
}

// ── Helpers de formatação ────────────────────────────────────
export const PAGE_SIZES_MM: Record<RpbPageSize, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A3:     { w: 297, h: 420 },
  Letter: { w: 216, h: 279 },
};

export const MM_TO_PX = 3.7795;   // 96dpi

export function mmToPx(mm: number): number { return Math.round(mm * MM_TO_PX); }
export function pxToMm(px: number): number { return Math.round((px / MM_TO_PX) * 10) / 10; }

export function formatValue(val: any, format: RpbFormat): string {
  if (val === null || val === undefined || val === '') return '';
  switch (format) {
    case 'currency':
      return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    case 'number':
      return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    case 'percent':
      return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '%';
    case 'date':
      return val ? new Date(val).toLocaleDateString('pt-BR') : '';
    case 'datetime':
      return val ? new Date(val).toLocaleString('pt-BR') : '';
    default:
      return String(val);
  }
}

export function newId(): string {
  return Math.random().toString(36).substring(2, 10);
}
