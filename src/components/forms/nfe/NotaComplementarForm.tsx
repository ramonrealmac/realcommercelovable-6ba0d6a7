import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { useCrudController } from "@/hooks/useCrudController";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import DataGrid from "@/components/grid/DataGrid";
import { 
  Search, Send, Printer, FileCode, Check, AlertCircle, Copy, 
  ExternalLink, FilePlus, ChevronDown, ChevronUp, Package, DollarSign,
  Receipt, Plus, Trash2, X, RotateCcw, Calendar, User, FileText
} from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as any;

export type TTipoComplemento = 1 | 2 | 3 | 4;

export const TIPO_COMPLEMENTO_LABELS: Record<TTipoComplemento, string> = {
  1: "1 — Complemento de Valor",
  2: "2 — Complemento de Impostos",
  3: "3 — Complemento de Quantidade",
  4: "4 — Complemento de Valor e Quantidade",
};

interface IItemComplementar {
  temp_id: string;
  nfe_item_id?: number;
  nfe_item_origem_id?: number | null;
  nr_item: number;
  produto_id?: number | null;
  deposito_id?: number | null;
  cd_prod_fornec: string;
  nm_produto: string;
  ncm: string;
  unidade: string;
  cfop: string;
  origem: number;
  csosn: string;
  cst_icms: string;
  c_enq: string;
  gtin: string;
  selecionado: boolean;
  expandido: boolean;

  // Originais
  qt_origem: number;
  vl_unit_origem: number;
  vl_total_origem: number;

  // Complementares
  qt_entrada: number; // Quantidade complementar
  vl_unit: number;    // Valor unitário complementar
  vl_total: number;   // Valor total complementar

  // Impostos complementares
  vl_bc: number;
  pc_icms: number;
  vl_icms: number;
  vl_bc_st: number;
  vl_icms_st: number;
  vl_fcp_st: number;
  vl_ipi: number;
  pc_ipi: number;
  vl_pis: number;
  pc_pis: number;
  vl_cofins: number;
  pc_cofins: number;
  // Alíquotas e dados fiscais de origem para cálculo automático
  pc_icms_origem?: number;
  pc_ipi_origem?: number;
  pc_pis_origem?: number;
  pc_cofins_origem?: number;
  pc_ibs_origem?: number;
  pc_cbs_origem?: number;
  cst_icms_origem?: string;
  csosn_origem?: string;
  cst_pis_origem?: string;
  cst_cofins_origem?: string;
  cst_ipi_origem?: string;
}

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "ID", width: "70px", align: "right" },
  { 
    key: "nr_nota", 
    label: "Nota", 
    width: "115px", 
    render: (r: any) => r.nr_nota ? <span className="font-extrabold text-base font-mono text-primary">{r.nr_nota}</span> : <span className="text-muted-foreground text-sm italic font-medium">(Pendente)</span> 
  },
  { key: "serie", label: "Série", width: "65px", align: "center", render: (r: any) => <span className="text-base font-bold font-mono">{r.serie || "1"}</span> },
  { key: "dt_emissao", label: "Emissão", width: "120px", render: r => <span className="text-base font-mono font-medium">{r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : ""}</span> },
  { 
    key: "_dest", 
    label: "Cliente / Destinatário", 
    width: "2.2fr", 
    getValue: (r: any) => r.cadastro?.razao_social || "", 
    render: (r: any) => <span className="text-base font-bold text-foreground">{r.cadastro?.razao_social || (r.cadastro_id ? `#${r.cadastro_id}` : "")}</span> 
  },
  { 
    key: "_comp", 
    label: "Tipo de Complemento", 
    width: "1.8fr", 
    render: (r: any) => {
      const tp = (r.tp_complemento || 1) as TTipoComplemento;
      const cores: Record<number, string> = {
        1: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        2: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        3: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
        4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
      };
      return (
        <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wide ${cores[tp] || "bg-muted"}`}>
          {TIPO_COMPLEMENTO_LABELS[tp] || `Tipo ${tp}`}
        </span>
      );
    } 
  },
  { 
    key: "vl_total_nf", 
    label: "Total Comp.", 
    width: "140px", 
    align: "right", 
    render: r => <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">R$ {Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> 
  },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "120px", 
    render: r => {
      const labels: Record<string, string> = { A: "Autorizada", E: "Enviada", P: "Pendente", C: "Cancelada", D: "Denegada", R: "Rejeitada" };
      const colors: Record<string, string> = {
        A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
        E: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        P: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-gray-300",
        C: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
        D: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
        R: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
      };
      return (
        <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wide ${colors[r.st_nf] || "bg-gray-100 text-gray-600"}`}>
          {labels[r.st_nf] || r.st_nf}
        </span>
      );
    }
  },
  { key: "chave_nfe", label: "Chave NF-e", width: "240px", render: r => <span className="font-mono text-xs sm:text-sm font-medium">{r.chave_nfe || "-"}</span> },
];

const XDefaultRecord: any = {
  origem_inclusao: "M",
  st_nf: "P",
  tp_nf: 1, // Saída
  fin_nfe: 2, // Complementar
  tp_emis: 1,
  modelo: "55",
  tp_complemento: 1, // 1 - Valor
  nat_op: "COMPLEMENTO DE VALOR",
  serie: "1",
  nr_nota: "",
  chave_nfe: "",
  chave_nfe_origem: "",
  nfe_origem_id: null,
  gera_financeiro_comp: false,
  movimenta_estoque_comp: false,
  vl_produto: 0,
  vl_desconto: 0,
  vl_frete: 0,
  vl_seguro: 0,
  vl_despesa: 0,
  vl_ipi: 0,
  vl_icms: 0,
  vl_icms_st: 0,
  vl_pis: 0,
  vl_cofins: 0,
  vl_ibs: 0,
  vl_cbs: 0,
  vl_is: 0,
  vl_bc: 0,
  vl_total_nf: 0,
  obs_nf: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_saida: new Date().toISOString().substring(0, 10),
};

// Formatação e máscara de valores monetários (2 decimais: 0,01 -> 0,10 -> 1,00)
export const formatMoney = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", ".")) || 0;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Alias para compatibilidade com código existente
export const maskMoney = formatMoney;

// Parser da digitação de valores (padrão 0,01 -> 0,10 -> 1,00)
export const parseMoneyRaw = (raw: string | number | null | undefined): number => {
  const clean = String(raw ?? "").replace(/\D/g, "");
  if (!clean) return 0;
  return parseInt(clean, 10) / 100;
};

// Formatação de quantidade com 3 casas decimais
export const formatQty3 = (val: number | string | null | undefined): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", ".")) || 0;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

// Parser da digitação de quantidade (padrão 0,001 -> 0,010 -> 0,100 -> 1,000)
export const parseQty3Raw = (raw: string | number | null | undefined): number => {
  const clean = String(raw ?? "").replace(/\D/g, "");
  if (!clean) return 0;
  return parseInt(clean, 10) / 1000;
};

interface NotaComplementarFormProps {
  initialNfeId?: number;
}

const NotaComplementarForm: React.FC<NotaComplementarFormProps> = ({ initialNfeId }) => {
  const { XEmpresaId, openTab } = useAppContext();

  // Estados dos Itens Complementares
  const [XItens, setXItens] = useState<IItemComplementar[]>([]);
  const [XNotaOrigem, setXNotaOrigem] = useState<any | null>(null);

  // Modais
  const [XSearchNfeOpen, setXSearchNfeOpen] = useState(false);
  const [XXmlModalOpen, setXXmlModalOpen] = useState(false);
  const [XConteudoXml, setXConteudoXml] = useState<string>("");
  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number; restante: number }>({
    open: false,
    titulo: "",
    total: 60,
    restante: 60,
  });

  // Busca de NF-e Original Modal
  const [XBuscaNr, setXBuscaNr] = useState("");
  const [XBuscaSerie, setXBuscaSerie] = useState("");
  const [XBuscaCliente, setXBuscaCliente] = useState("");
  const [XBuscaChave, setXBuscaChave] = useState("");
  const [XBuscaDtIni, setXBuscaDtIni] = useState("");
  const [XBuscaDtFim, setXBuscaDtFim] = useState("");
  const [XBuscaResultados, setXBuscaResultados] = useState<any[]>([]);
  const [XBuscaLoading, setXBuscaLoading] = useState(false);
  const [XBuscaSelectedIdx, setXBuscaSelectedIdx] = useState<number | null>(null);

  // Refs de navegação da busca
  const buscaNrInputRef = useRef<HTMLInputElement>(null);
  const buscaSerieInputRef = useRef<HTMLInputElement>(null);
  const buscaClienteInputRef = useRef<HTMLInputElement>(null);
  const buscaDtIniInputRef = useRef<HTMLInputElement>(null);
  const buscaDtFimInputRef = useRef<HTMLInputElement>(null);
  const buscaChaveInputRef = useRef<HTMLInputElement>(null);
  const buscaBtnPesquisarRef = useRef<HTMLButtonElement>(null);
  const buscaGridContainerRef = useRef<HTMLDivElement>(null);
  const buscaRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Ref estável para refresh do StandardCrudForm e setField
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const XActiveSetFieldRef = useRef<((k: string, v: any) => void) | null>(null);

  // Calcula totais baseados nos itens selecionados
  const totaisCalculados = useMemo(() => {
    const selecionados = XItens.filter(it => it.selecionado);
    const vl_produto = selecionados.reduce((s, it) => s + (Number(it.vl_total) || 0), 0);
    const vl_bc = selecionados.reduce((s, it) => s + (Number(it.vl_bc) || 0), 0);
    const vl_icms = selecionados.reduce((s, it) => s + (Number(it.vl_icms) || 0), 0);
    const vl_bc_st = selecionados.reduce((s, it) => s + (Number(it.vl_bc_st) || 0), 0);
    const vl_icms_st = selecionados.reduce((s, it) => s + (Number(it.vl_icms_st) || 0), 0);
    const vl_ipi = selecionados.reduce((s, it) => s + (Number(it.vl_ipi) || 0), 0);
    const vl_pis = selecionados.reduce((s, it) => s + (Number(it.vl_pis) || 0), 0);
    const vl_cofins = selecionados.reduce((s, it) => s + (Number(it.vl_cofins) || 0), 0);
    const vl_ibs = selecionados.reduce((s, it) => s + (Number(it.vl_ibs) || 0), 0);
    const vl_cbs = selecionados.reduce((s, it) => s + (Number(it.vl_cbs) || 0), 0);

    // Na NF-e complementar, o valor total é a soma dos produtos + ST + IPI (se houver)
    const vl_total_nf = vl_produto + vl_icms_st + vl_ipi;

    return {
      vl_produto,
      vl_bc,
      vl_icms,
      vl_bc_st,
      vl_icms_st,
      vl_ipi,
      vl_pis,
      vl_cofins,
      vl_ibs,
      vl_cbs,
      vl_total_nf,
    };
  }, [XItens]);

  // Função para recalcular os tributos proporcionais de um item com base no valor complementar e alíquotas originais
  const recalcularTributosItemPorValor = (item: IItemComplementar, novoVlTotal: number): IItemComplementar => {
    const val = Number(novoVlTotal) || 0;
    const vUnit = item.qt_origem > 0 ? Math.round((val / item.qt_origem) * 10000) / 10000 : val;

    if (val <= 0) {
      return {
        ...item,
        vl_total: 0,
        vl_unit: 0,
        vl_bc: 0,
        vl_icms: 0,
        vl_ipi: 0,
        vl_pis: 0,
        vl_cofins: 0,
        vl_ibs: 0,
        vl_cbs: 0,
      };
    }

    // ICMS: proporcional à alíquota destacada na nota original
    const pcIcms = Number(item.pc_icms_origem ?? item.pc_icms ?? 0);
    const vlBcIcms = pcIcms > 0 ? val : 0;
    const vlIcms = pcIcms > 0 ? Math.round((val * (pcIcms / 100)) * 100) / 100 : 0;

    // IPI
    const pcIpi = Number(item.pc_ipi_origem ?? item.pc_ipi ?? 0);
    const vlIpi = pcIpi > 0 ? Math.round((val * (pcIpi / 100)) * 100) / 100 : 0;

    // PIS
    const pcPis = Number(item.pc_pis_origem ?? item.pc_pis ?? 0);
    const vlPis = pcPis > 0 ? Math.round((val * (pcPis / 100)) * 100) / 100 : 0;

    // COFINS
    const pcCofins = Number(item.pc_cofins_origem ?? item.pc_cofins ?? 0);
    const vlCofins = pcCofins > 0 ? Math.round((val * (pcCofins / 100)) * 100) / 100 : 0;

    // IBS e CBS (Reforma Tributária)
    const pcIbs = Number(item.pc_ibs_origem ?? item.pc_ibs ?? 0);
    const vlIbs = pcIbs > 0 ? Math.round((val * (pcIbs / 100)) * 100) / 100 : 0;

    const pcCbs = Number(item.pc_cbs_origem ?? item.pc_cbs ?? 0);
    const vlCbs = pcCbs > 0 ? Math.round((val * (pcCbs / 100)) * 100) / 100 : 0;

    return {
      ...item,
      vl_total: val,
      vl_unit: vUnit,
      vl_bc: vlBcIcms,
      pc_icms: pcIcms,
      vl_icms: vlIcms,
      pc_ipi: pcIpi,
      vl_ipi: vlIpi,
      pc_pis: pcPis,
      vl_pis: vlPis,
      pc_cofins: pcCofins,
      vl_cofins: vlCofins,
      pc_ibs: pcIbs,
      vl_ibs: vlIbs,
      pc_cbs: pcCbs,
      vl_cbs: vlCbs,
    };
  };

  // Carrega itens da nota selecionada para a tela
  const carregarItensDaNota = async (nfeCabecalhoId: number) => {
    try {
      const { data: itens, error } = await db
        .from("fiscal_nfe_item")
        .select("*")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .eq("excluido", false)
        .order("nr_item");
      if (error) throw error;

      const formatados: IItemComplementar[] = (itens || []).map((it: any) => {
        const vlTotalOrig = Number(it.vl_total || 0);

        // Alíquota de ICMS original (ou deduzida caso a nota guarde valor e base)
        const vlBcOrig = Number(it.vl_bc || 0);
        const vlIcmsOrig = Number(it.vl_icms || 0);
        const pc_icms_orig = Number(it.pc_icms || 0) || (vlBcOrig > 0 && vlIcmsOrig > 0 ? Math.round(((vlIcmsOrig / vlBcOrig) * 100) * 100) / 100 : 0);

        // IPI original
        const vlBcIpiOrig = Number(it.vl_bc_ipi || it.vl_total || 0);
        const vlIpiOrig = Number(it.vl_ipi || 0);
        const pc_ipi_orig = Number(it.pc_ipi || 0) || (vlBcIpiOrig > 0 && vlIpiOrig > 0 ? Math.round(((vlIpiOrig / vlBcIpiOrig) * 100) * 100) / 100 : 0);

        // PIS original
        const vlBcPisOrig = Number(it.vl_bc_pis || it.vl_total || 0);
        const vlPisOrig = Number(it.vl_pis || 0);
        const pc_pis_orig = Number(it.pc_pis || 0) || (vlBcPisOrig > 0 && vlPisOrig > 0 ? Math.round(((vlPisOrig / vlBcPisOrig) * 100) * 100) / 100 : 0);

        // COFINS original
        const vlBcCofinsOrig = Number(it.vl_bc_cofins || it.vl_total || 0);
        const vlCofinsOrig = Number(it.vl_cofins || 0);
        const pc_cofins_orig = Number(it.pc_cofins || 0) || (vlBcCofinsOrig > 0 && vlCofinsOrig > 0 ? Math.round(((vlCofinsOrig / vlBcCofinsOrig) * 100) * 100) / 100 : 0);

        // IBS e CBS (Reforma Tributária)
        const pc_ibs_orig = Number(it.pc_ibs || 0) || (vlTotalOrig > 0 && Number(it.vl_ibs) > 0 ? Math.round(((Number(it.vl_ibs) / vlTotalOrig) * 100) * 100) / 100 : 0);
        const pc_cbs_orig = Number(it.pc_cbs || 0) || (vlTotalOrig > 0 && Number(it.vl_cbs) > 0 ? Math.round(((Number(it.vl_cbs) / vlTotalOrig) * 100) * 100) / 100 : 0);

        return {
          temp_id: `item_${it.nfe_item_id || Math.random()}`,
          nfe_item_id: it.nfe_item_id,
          nfe_item_origem_id: it.nfe_item_id,
          nr_item: it.nr_item || 1,
          produto_id: it.produto_id,
          deposito_id: it.deposito_id || null,
          cd_prod_fornec: it.cd_prod_fornec || "",
          nm_produto: it.nm_produto || "",
          ncm: it.ncm || "",
          unidade: it.unidade || "UN",
          cfop: it.cfop || "5102",
          origem: it.origem ?? 0,
          csosn: it.csosn || "",
          cst_icms: it.cst_icms || "",
          c_enq: it.c_enq || "999",
          gtin: it.gtin || "SEM GTIN",
          selecionado: true,
          expandido: false,

          qt_origem: Number(it.qt_entrada || it.qt_tributavel || 1),
          vl_unit_origem: Number(it.vl_unit || 0),
          vl_total_origem: vlTotalOrig,

          qt_entrada: 0,
          vl_unit: 0,
          vl_total: 0,

          // Guardadas para cálculo automático
          pc_icms_origem: pc_icms_orig,
          pc_ipi_origem: pc_ipi_orig,
          pc_pis_origem: pc_pis_orig,
          pc_cofins_origem: pc_cofins_orig,
          pc_ibs_origem: pc_ibs_orig,
          pc_cbs_origem: pc_cbs_orig,
          cst_icms_origem: it.cst_icms || "",
          csosn_origem: it.csosn || "",
          cst_pis_origem: it.cst_pis || "",
          cst_cofins_origem: it.cst_cofins || "",
          cst_ipi_origem: it.cst_ipi || "",

          // Inicia as alíquotas com as originais
          pc_icms: pc_icms_orig,
          pc_ipi: pc_ipi_orig,
          pc_pis: pc_pis_orig,
          pc_cofins: pc_cofins_orig,
          pc_ibs: pc_ibs_orig,
          pc_cbs: pc_cbs_orig,

          vl_bc: 0,
          vl_icms: 0,
          vl_bc_st: 0,
          vl_icms_st: 0,
          vl_fcp_st: 0,
          vl_ipi: 0,
          vl_pis: 0,
          vl_cofins: 0,
          vl_ibs: 0,
          vl_cbs: 0,
        };
      });

      setXItens(formatados);
    } catch (e: any) {
      toast.error("Erro ao carregar itens: " + e.message);
    }
  };

  // Abertura do modal de busca com campos e grade limpos
  const abrirModalBuscaNfeOriginal = () => {
    setXBuscaNr("");
    setXBuscaSerie("");
    setXBuscaCliente("");
    setXBuscaDtIni("");
    setXBuscaDtFim("");
    setXBuscaChave("");
    setXBuscaResultados([]);
    setXBuscaSelectedIdx(null);
    setXSearchNfeOpen(true);
    setTimeout(() => {
      buscaNrInputRef.current?.focus();
    }, 100);
  };

  // Limpeza dos filtros e da grade
  const limparFiltrosBusca = () => {
    setXBuscaNr("");
    setXBuscaSerie("");
    setXBuscaCliente("");
    setXBuscaDtIni("");
    setXBuscaDtFim("");
    setXBuscaChave("");
    setXBuscaResultados([]);
    setXBuscaSelectedIdx(null);
    setTimeout(() => {
      buscaNrInputRef.current?.focus();
    }, 50);
  };

  // Busca de NF-e original ao clicar em Pesquisar
  const executarBuscaNfeOriginal = async (filtrosCustom?: {
    nr?: string;
    serie?: string;
    cliente?: string;
    chave?: string;
    dtIni?: string;
    dtFim?: string;
  }) => {
    setXBuscaLoading(true);
    setXBuscaResultados([]);
    setXBuscaSelectedIdx(null);
    try {
      const nr = filtrosCustom ? (filtrosCustom.nr ?? "") : XBuscaNr;
      const serie = filtrosCustom ? (filtrosCustom.serie ?? "") : XBuscaSerie;
      const cliente = filtrosCustom ? (filtrosCustom.cliente ?? "") : XBuscaCliente;
      const chave = filtrosCustom ? (filtrosCustom.chave ?? "") : XBuscaChave;
      const dtIni = filtrosCustom ? (filtrosCustom.dtIni ?? "") : XBuscaDtIni;
      const dtFim = filtrosCustom ? (filtrosCustom.dtFim ?? "") : XBuscaDtFim;

      let q = db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id, nr_nota, serie, dt_emissao, dt_saida, vl_total_nf, chave_nfe, cadastro_id, st_nf, modelo, tp_nf, fin_nfe, nat_op, cadastro:cadastro_id(razao_social, cnpj)");

      if (XEmpresaId) {
        q = q.eq("empresa_id", XEmpresaId);
      }

      q = q
        .in("st_nf", ["A", "1", "E"]) // Apenas autorizadas
        .neq("fin_nfe", 2) // Não permitir referenciar outra nota complementar
        .eq("excluido", false)
        .order("nfe_cabecalho_id", { ascending: false })
        .limit(50);

      if (nr.trim()) q = q.eq("nr_nota", nr.trim());
      if (serie.trim()) q = q.eq("serie", serie.trim());
      if (chave.trim()) q = q.ilike("chave_nfe", `%${chave.trim()}%`);
      if (dtIni.trim()) q = q.gte("dt_emissao", dtIni.trim());
      if (dtFim.trim()) q = q.lte("dt_emissao", dtFim.trim());

      const { data, error } = await q;
      if (error) throw error;

      let res = data || [];
      if (cliente.trim() && res.length > 0) {
        const termo = cliente.trim().toLowerCase();
        res = res.filter((n: any) => {
          const rz = (n.cadastro?.razao_social || "").toLowerCase();
          const doc = (n.cadastro?.cnpj || "").replace(/\D/g, "");
          return rz.includes(termo) || doc.includes(termo);
        });
      }

      setXBuscaResultados(res);
      if (res.length > 0) {
        setXBuscaSelectedIdx(0);
      }
    } catch (e: any) {
      toast.error("Erro na busca: " + e.message);
    } finally {
      setXBuscaLoading(false);
    }
  };

  // Navegação no Grid pelo teclado
  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (XBuscaResultados.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setXBuscaSelectedIdx((prev) => {
        const next = prev === null ? 0 : Math.min(prev + 1, XBuscaResultados.length - 1);
        buscaRowRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setXBuscaSelectedIdx((prev) => {
        if (prev === null || prev === 0) {
          buscaNrInputRef.current?.focus();
          return 0;
        }
        const next = Math.max(prev - 1, 0);
        buscaRowRefs.current[next]?.scrollIntoView({ block: "nearest" });
        return next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = XBuscaSelectedIdx !== null ? XBuscaSelectedIdx : 0;
      if (XBuscaResultados[idx] && XActiveSetFieldRef.current) {
        selecionarNfeOriginal(XBuscaResultados[idx], XActiveSetFieldRef.current);
      }
    }
  };

  // Ao selecionar a NF-e original
  const selecionarNfeOriginal = async (nfe: any, setField: (k: string, v: any) => void) => {
    if (!nfe.chave_nfe || nfe.chave_nfe.replace(/\D/g, "").length !== 44) {
      toast.error("A nota selecionada não possui chave de acesso de 44 dígitos autorizada.");
      return;
    }

    setXNotaOrigem(nfe);
    setField("nfe_origem_id", nfe.nfe_cabecalho_id);
    setField("chave_nfe_origem", nfe.chave_nfe);
    setField("cadastro_id", nfe.cadastro_id);
    setField("deposito_id", nfe.deposito_id || null);
    setField("tp_nf", nfe.tp_nf ?? 1);
    setField("modelo", "55");
    
    // Sugestão de observação
    const obsSugerida = `Nota Fiscal Complementar emitida referente à NF-e nº ${nfe.nr_nota || ""}/${nfe.serie || "1"}, Chave: ${nfe.chave_nfe}.`;
    setField("obs_nf", obsSugerida);

    // Carrega itens da nota original
    await carregarItensDaNota(nfe.nfe_cabecalho_id);
    setXSearchNfeOpen(false);
    toast.success(`NF-e nº ${nfe.nr_nota} selecionada com sucesso! Itens importados.`);
  };

  // Transmissão à SEFAZ
  const handleTransmitirSefaz = async (currentRecord: any, refresh?: () => Promise<void>) => {
    if (!currentRecord?.nfe_cabecalho_id) {
      toast.error("Salve a Nota Complementar antes de transmitir à SEFAZ.");
      return;
    }

    const chaveOrigem = String(currentRecord.chave_nfe_origem || XNotaOrigem?.chave_nfe || "").replace(/\D/g, "");
    if (chaveOrigem.length !== 44) {
      toast.error("Chave de acesso da NF-e original referenciada é obrigatória e deve ter 44 dígitos.");
      return;
    }

    const targetEmpresaId = currentRecord.empresa_id || XEmpresaId;
    const targetMod = String(currentRecord.modelo || "55");
    const targetSer = String(currentRecord.serie || "1");

    // Gera número oficial caso ainda não possua
    let nrNotaTransmitir = currentRecord.nr_nota ? String(currentRecord.nr_nota).trim() : "";
    if (!nrNotaTransmitir || nrNotaTransmitir === "0") {
      try {
        const { data: ci, error: errCi } = await db
          .from("fiscal_config_item")
          .select("fiscal_config_item_id, sequencia")
          .eq("empresa_id", targetEmpresaId)
          .eq("modelo", targetMod)
          .eq("serie", targetSer)
          .maybeSingle();

        if (errCi || !ci) {
          toast.error(`Configuração fiscal não encontrada para Modelo ${targetMod}, Série ${targetSer}.`);
          return;
        }

        const proximoSequencial = Number(ci.sequencia || 1);
        nrNotaTransmitir = String(proximoSequencial);

        await db.from("fiscal_nfe_cabecalho")
          .update({ nr_nota: nrNotaTransmitir })
          .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id);

        await db.from("fiscal_config_item")
          .update({ sequencia: proximoSequencial + 1 })
          .eq("fiscal_config_item_id", ci.fiscal_config_item_id);

        currentRecord.nr_nota = nrNotaTransmitir;
        toast.info(`Número fiscal nº ${nrNotaTransmitir} gerado da Série ${targetSer}.`);
      } catch (eSeq: any) {
        toast.error("Erro ao gerar sequencial fiscal: " + eSeq.message);
        return;
      }
    }

    // Garante vínculo em fiscal_nfe_referenciada
    try {
      const { data: refExiste } = await db.from("fiscal_nfe_referenciada")
        .select("nfe_referenciada_id")
        .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id)
        .eq("chave_ref", chaveOrigem)
        .maybeSingle();
      if (!refExiste) {
        await db.from("fiscal_nfe_referenciada").insert({
          nfe_cabecalho_id: currentRecord.nfe_cabecalho_id,
          chave_ref: chaveOrigem,
        });
      }
    } catch (eRef) {
      console.warn("Aviso ao vincular fiscal_nfe_referenciada:", eRef);
    }

    const totalSeg = (await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId)) || 60;
    setXProg({
      open: true,
      titulo: `Transmitindo NF-e Complementar #${nrNotaTransmitir} à SEFAZ...`,
      total: totalSeg,
      restante: totalSeg,
    });

    try {
      const res = await fiscalEmissaoService.retransmitirDocumento(
        currentRecord.nfe_cabecalho_id,
        targetEmpresaId
      );

      if (!res.success || !res.fiscal_evento_id) {
        setXProg(p => ({ ...p, open: false }));
        toast.error("Falha ao enfileirar: " + (res.message || "Erro desconhecido"));
        return;
      }

      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
        empresaId: targetEmpresaId,
        timeoutMs: totalSeg * 1000,
        onTick: (s) => setXProg(p => ({ ...p, restante: s })),
      });

      setXProg(p => ({ ...p, open: false }));
      if (refresh) await refresh();

      if (ret.success) {
        toast.success(`NF-e Complementar nº ${nrNotaTransmitir} AUTORIZADA com sucesso!`);
        // Dispara impressão do DANFE
        try {
          const impRes = await fiscalEmissaoService.imprimirDocumento(currentRecord.nfe_cabecalho_id, targetEmpresaId);
          if (impRes.success && impRes.pdf_base64) {
            const binaryString = atob(impRes.pdf_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
          }
        } catch {}
      } else {
        toast.error("Retorno SEFAZ: " + (ret.mensagem || ret.resposta?.x_motivo || "Não autorizada"));
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error("Erro na transmissão: " + e.message);
    }
  };

  // Impressão de DANFE
  const handleImprimirDanfe = async (currentRecord: any) => {
    if (!currentRecord?.nfe_cabecalho_id) return;
    const tid = toast.loading("Gerando DANFE da Nota Complementar...");
    try {
      const res = await fiscalEmissaoService.imprimirDocumento(currentRecord.nfe_cabecalho_id, currentRecord.empresa_id || XEmpresaId);
      toast.dismiss(tid);
      if (res.success && res.pdf_base64) {
        const binaryString = atob(res.pdf_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        toast.error(res.message || "Falha ao gerar DANFE.");
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error("Erro ao emitir DANFE: " + e.message);
    }
  };

  // Visualizar XML
  const handleVisualizarXml = async (currentRecord: any) => {
    if (!currentRecord?.nfe_cabecalho_id) return;
    try {
      const { data } = await db.from("fiscal_nfe_cabecalho")
        .select("xml_autorizado, xml_nfe, nfe_cabecalho_id")
        .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id)
        .single();
      const xml = data?.xml_autorizado || data?.xml_nfe || "";
      if (!xml) {
        toast.info("XML ainda não gerado para esta nota fiscal.");
        return;
      }
      setXConteudoXml(xml);
      setXXmlModalOpen(true);
    } catch (e: any) {
      toast.error("Erro ao carregar XML: " + e.message);
    }
  };

  // Refs atualizadas para evitar recriação desnecessária de callbacks
  const XItensRef = useRef<IItemComplementar[]>(XItens);
  useEffect(() => { XItensRef.current = XItens; }, [XItens]);

  const XNotaOrigemRef = useRef<any>(XNotaOrigem);
  useEffect(() => { XNotaOrigemRef.current = XNotaOrigem; }, [XNotaOrigem]);

  const totaisCalculadosRef = useRef(totaisCalculados);
  useEffect(() => { totaisCalculadosRef.current = totaisCalculados; }, [totaisCalculados]);

  // Carrega a NF-e original e os itens gravados de uma nota complementar existente
  const carregarDadosNotaExistente = useCallback(async (cab: any) => {
    if (!cab) return;
    if (cab.nfe_origem_id) {
      const { data: orig } = await db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id, nr_nota, serie, dt_emissao, chave_nfe, vl_total_nf, cadastro:cadastro_id(razao_social, cnpj)")
        .eq("nfe_cabecalho_id", cab.nfe_origem_id)
        .maybeSingle();
      if (orig) setXNotaOrigem(orig);
      else setXNotaOrigem(null);
    } else {
      setXNotaOrigem(null);
    }

    if (cab.nfe_cabecalho_id) {
      const { data: itensComp } = await db.from("fiscal_nfe_item")
        .select("*")
        .eq("nfe_cabecalho_id", cab.nfe_cabecalho_id)
        .eq("excluido", false)
        .order("nr_item");
      if (itensComp && itensComp.length > 0) {
        const formatados: IItemComplementar[] = itensComp.map((it: any) => ({
          temp_id: `item_${it.nfe_item_id || Math.random()}`,
          nfe_item_id: it.nfe_item_id,
          nfe_item_origem_id: it.nfe_item_origem_id,
          nr_item: it.nr_item || 1,
          produto_id: it.produto_id,
          deposito_id: it.deposito_id || null,
          cd_prod_fornec: it.cd_prod_fornec || "",
          nm_produto: it.nm_produto || "",
          ncm: it.ncm || "",
          unidade: it.unidade || "UN",
          cfop: it.cfop || "5102",
          origem: it.origem ?? 0,
          csosn: it.csosn || "",
          cst_icms: it.cst_icms || "",
          c_enq: it.c_enq || "999",
          gtin: it.gtin || "SEM GTIN",
          selecionado: true,
          expandido: false,
          qt_origem: Number(it.qt_origem || 0),
          vl_unit_origem: Number(it.vl_unit_origem || 0),
          vl_total_origem: Number(it.vl_total_origem || 0),
          qt_entrada: Number(it.qt_entrada || 0),
          vl_unit: Number(it.vl_unit || 0),
          vl_total: Number(it.vl_total || 0),
          vl_bc: Number(it.vl_bc || 0),
          pc_icms: Number(it.pc_icms || 0),
          vl_icms: Number(it.vl_icms || 0),
          vl_bc_st: Number(it.vl_bc_st || 0),
          vl_icms_st: Number(it.vl_icms_st || 0),
          vl_fcp_st: Number(it.vl_fcp_st || 0),
          vl_ipi: Number(it.vl_ipi || 0),
          pc_ipi: Number(it.pc_ipi || 0),
          vl_pis: Number(it.vl_pis || 0),
          pc_pis: Number(it.pc_pis || 0),
          vl_cofins: Number(it.vl_cofins || 0),
          pc_cofins: Number(it.pc_cofins || 0),
          vl_ibs: Number(it.vl_ibs || 0),
          pc_ibs: Number(it.pc_ibs || 0),
          vl_cbs: Number(it.vl_cbs || 0),
          pc_cbs: Number(it.pc_cbs || 0),
        }));
        setXItens(formatados);
      } else {
        setXItens([]);
      }
    } else {
      setXItens([]);
    }
  }, []);

  const crudConfig = useMemo(() => ({
    XTableName: "fiscal_nfe_cabecalho",
    XPrimaryKey: "nfe_cabecalho_id" as const,
    XTitle: "Nota Complementar",
    XDefaultRecord: { ...XDefaultRecord, empresa_id: XEmpresaId },
    XEmpresaId,
    XSelectCols: "*, cadastro:cadastro_id(razao_social, cnpj)",
    XOrderBy: "nfe_cabecalho_id",
    XOrderAsc: false,
    XSoftDelete: false,
    XApplyFilter: (q: any) => q.eq("fin_nfe", 2).eq("modelo", "55"),
    XCanEdit: (rec: any) => !rec || ["P", "R"].includes(String(rec.st_nf)),
    XCanDelete: (rec: any) => !rec || rec.st_nf === "P",
    XOnBeforeSave: async (rec: any) => {
      const currentItens = XItensRef.current;
      const currentOrigem = XNotaOrigemRef.current;
      const currentTotais = totaisCalculadosRef.current;

      if (!rec.chave_nfe_origem && !currentOrigem?.chave_nfe) {
        throw new Error("Selecione a NF-e Original autorizada para complementar.");
      }
      if (!rec.cadastro_id) {
        throw new Error("Destinatário/Cliente da NF-e original não identificado.");
      }
      const selecionados = currentItens.filter(it => it.selecionado);
      if (!selecionados.length) {
        throw new Error("Selecione ao menos um produto para compor a Nota Complementar.");
      }

      // Atualiza totais calculados no cabeçalho
      rec.vl_produto = currentTotais.vl_produto;
      rec.vl_bc = currentTotais.vl_bc;
      rec.vl_icms = currentTotais.vl_icms;
      rec.vl_icms_st = currentTotais.vl_icms_st;
      rec.vl_ipi = currentTotais.vl_ipi;
      rec.vl_pis = currentTotais.vl_pis;
      rec.vl_cofins = currentTotais.vl_cofins;
      rec.vl_ibs = currentTotais.vl_ibs;
      rec.vl_cbs = currentTotais.vl_cbs;
      rec.vl_total_nf = currentTotais.vl_total_nf;
      rec.fin_nfe = 2;
      rec.modelo = "55";
      rec.tp_complemento = Number(rec.tp_complemento) || 1;
      if ([3, 4].includes(rec.tp_complemento)) {
        if (rec.movimenta_estoque_comp === undefined || rec.movimenta_estoque_comp === null) {
          rec.movimenta_estoque_comp = true;
        }
      }

      // Remove campos que não pertencem à tabela fiscal_nfe_cabecalho (evita erro de schema cache)
      delete rec.vl_bc_st;
      delete rec.cadastro;
      delete rec._dest;
      delete rec._comp;

      return { ...rec, empresa_id: rec.empresa_id || XEmpresaId };
    },
    XOnAfterSave: async (rec: any) => {
      if (!rec?.nfe_cabecalho_id) return;

      // Salva itens complementares
      const currentItens = XItensRef.current;
      const selecionados = currentItens.filter(it => it.selecionado);
      const { error: errDel } = await db.from("fiscal_nfe_item").delete().eq("nfe_cabecalho_id", rec.nfe_cabecalho_id);
      if (errDel) {
        console.error("Erro ao deletar itens anteriores:", errDel);
      }

      const payloadItens = selecionados.map((it, idx) => ({
        nfe_cabecalho_id: rec.nfe_cabecalho_id,
        empresa_id: XEmpresaId,
        produto_id: it.produto_id,
        deposito_id: it.deposito_id || rec.deposito_id || null,
        nr_item: idx + 1,
        nfe_item_origem_id: it.nfe_item_origem_id || null,
        chave_ref_item: String(rec.chave_nfe_origem || "").replace(/\D/g, ""),
        cd_prod_fornec: it.cd_prod_fornec,
        nm_produto: it.nm_produto,
        ncm: it.ncm,
        cfop: it.cfop,
        unidade: it.unidade,
        gtin: it.gtin,
        origem: it.origem,
        csosn: it.csosn,
        cst_icms: it.cst_icms,
        c_enq: it.c_enq,
        qt_entrada: it.qt_entrada,
        qt_tributavel: it.qt_entrada,
        vl_unit: it.vl_unit,
        vl_unit_tributavel: it.vl_unit,
        vl_total: it.vl_total,
        qt_origem: it.qt_origem,
        vl_unit_origem: it.vl_unit_origem,
        vl_bc: it.vl_bc,
        pc_icms: it.pc_icms,
        vl_icms: it.vl_icms,
        vl_bc_st: it.vl_bc_st,
        vl_icms_st: it.vl_icms_st,
        vl_fcp_st: it.vl_fcp_st,
        vl_ipi: it.vl_ipi,
        pc_ipi: it.pc_ipi,
        vl_pis: it.vl_pis,
        pc_pis: it.pc_pis,
        vl_cofins: it.vl_cofins,
        pc_cofins: it.pc_cofins,
        vl_ibs: it.vl_ibs,
        pc_ibs: it.pc_ibs,
        vl_cbs: it.vl_cbs,
        pc_cbs: it.pc_cbs,
        excluido: false,
      }));

      if (payloadItens.length > 0) {
        const { error: errIt } = await db.from("fiscal_nfe_item").insert(payloadItens);
        if (errIt) throw errIt;
      }

      await carregarDadosNotaExistente(rec);

      // Vincula chave referenciada
      if (rec.chave_nfe_origem) {
        const limpa = String(rec.chave_nfe_origem).replace(/\D/g, "");
        const { data: refJaExiste } = await db.from("fiscal_nfe_referenciada")
          .select("nfe_referenciada_id")
          .eq("nfe_cabecalho_id", rec.nfe_cabecalho_id)
          .eq("chave_ref", limpa)
          .maybeSingle();
        if (!refJaExiste) {
          await db.from("fiscal_nfe_referenciada").insert({
            nfe_cabecalho_id: rec.nfe_cabecalho_id,
            chave_ref: limpa,
          });
        }
      }

      toast.success("Nota Fiscal Complementar salva com sucesso!");
    },
  }), [XEmpresaId]);

  const ctrl = useCrudController<any>(crudConfig);

  // Sincronização do modo e do registro atual: no "+" (insert) LIMPA TODOS OS CAMPOS
  useEffect(() => {
    if (ctrl.XFormMode === "insert") {
      setXItens([]);
      setXNotaOrigem(null);
    } else if (ctrl.XFormMode === "view" && ctrl.XCurrentRecord?.nfe_cabecalho_id) {
      carregarDadosNotaExistente(ctrl.XCurrentRecord);
    }
  }, [ctrl.XFormMode, ctrl.XCurrentRecord?.nfe_cabecalho_id, carregarDadosNotaExistente]);

  return (
    <div className="flex flex-col h-full space-y-2">
      <StandardCrudForm
        XRefreshRef={XRefreshRef}
        XInitialId={initialNfeId}
        XGridCols={XGridCols}
        XCtrl={ctrl}
        config={crudConfig}
        XToolbarExtras={({ currentRecord, isEditing, refresh }) => {
          const isAutorizada = currentRecord?.st_nf === "A";
          const podeTransmitir = !isEditing && currentRecord?.nfe_cabecalho_id && ["P", "R"].includes(currentRecord?.st_nf);

          return (
            <div className="flex items-center gap-2.5">
              {podeTransmitir && (
                <button
                  type="button"
                  onClick={() => handleTransmitirSefaz(currentRecord, refresh)}
                  className="flex items-center gap-2 h-11 px-5 py-2 text-base font-black rounded-lg bg-primary text-zinc-950 hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                  title="Transmitir NF-e Complementar à SEFAZ"
                >
                  <Send className="w-5 h-5" /> TRANSMITIR NF-e
                </button>
              )}

              {isAutorizada && (
                <button
                  type="button"
                  onClick={() => handleImprimirDanfe(currentRecord)}
                  className="flex items-center gap-2 h-11 px-5 py-2 text-base font-black rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95"
                  title="Imprimir DANFE da Nota Complementar"
                >
                  <Printer className="w-5 h-5" /> IMPRIMIR DANFE
                </button>
              )}
            </div>
          );
        }}
        renderCadastro={({ record, setField, isEditing, currentRecord }) => {
          XActiveSetFieldRef.current = setField;
          const isBloqueado = !isEditing || currentRecord?.st_nf === "A";
          const tpCompAtual = (record.tp_complemento || 1) as TTipoComplemento;

          return (
            <div className="space-y-6 p-4 w-full max-w-[1750px] mx-auto text-base">
              {/* Header com Status e Chave se já gravada */}
              {currentRecord?.nfe_cabecalho_id && (
                <div className="flex flex-wrap items-center justify-between p-5 rounded-xl border border-border bg-card shadow-xs gap-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">Nota Fiscal</span>
                      <div className="text-3xl font-black text-primary font-mono">
                        {currentRecord.nr_nota ? `#${currentRecord.nr_nota} / Série ${currentRecord.serie}` : "(Pendente de Transmissão)"}
                      </div>
                    </div>
                    <div className="border-l-2 border-border pl-6">
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">Finalidade</span>
                      <div className="text-lg font-bold text-foreground">NF-e Complementar (finNFe = 2)</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentRecord.chave_nfe && (
                      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-secondary font-mono text-base border border-border">
                        <span className="text-muted-foreground font-bold">Chave SEFAZ:</span>
                        <span className="font-extrabold">{currentRecord.chave_nfe}</span>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(currentRecord.chave_nfe); toast.success("Chave copiada!"); }}
                          className="hover:text-primary p-1 ml-1"
                          title="Copiar Chave da NF-e"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CARD: SELEÇÃO DA NF-e ORIGINAL REFERENCIADA */}
              <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-7 h-7 text-primary" />
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-wider text-foreground">
                        NF-e Original Referenciada (Obrigatória)
                      </h3>
                      <p className="text-base text-muted-foreground">
                        A NF-e original autorizada servirá de base para vincular os dados cadastrais e produtos
                      </p>
                    </div>
                  </div>

                  {!isBloqueado && (
                    <button
                      type="button"
                      onClick={abrirModalBuscaNfeOriginal}
                      className="flex items-center gap-2.5 px-5 py-3 rounded-lg text-base font-black uppercase bg-primary text-zinc-950 hover:bg-primary/90 shadow-sm transition-all active:scale-95"
                    >
                      <Search className="w-5 h-5" />
                      <span>{record.nfe_origem_id || XNotaOrigem ? "Trocar NF-e Original" : "Localizar NF-e Original"}</span>
                    </button>
                  )}
                </div>

                {record.nfe_origem_id || XNotaOrigem ? (
                  <div className="p-5 rounded-xl border border-primary/30 bg-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div>
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">NF-e Original:</span>
                      <div className="font-black text-xl text-foreground font-mono">
                        Nº {XNotaOrigem?.nr_nota || record.nfe_origem_id} / Série {XNotaOrigem?.serie || "1"}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">Destinatário:</span>
                      <div className="font-bold text-lg text-foreground truncate" title={XNotaOrigem?.cadastro?.razao_social || record.cadastro?.razao_social}>
                        {XNotaOrigem?.cadastro?.razao_social || record.cadastro?.razao_social || `#${record.cadastro_id}`}
                      </div>
                      <div className="text-base text-muted-foreground font-mono font-semibold mt-0.5">
                        {formatCPFCNPJ(XNotaOrigem?.cadastro?.cnpj || record.cadastro?.cnpj || "")}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">Valor Total Original:</span>
                      <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400">
                        R$ {formatMoney(XNotaOrigem?.vl_total_nf || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-1">Chave de Acesso Original:</span>
                      <div className="font-mono text-base text-muted-foreground break-all truncate mt-0.5 font-medium" title={record.chave_nfe_origem || XNotaOrigem?.chave_nfe}>
                        {record.chave_nfe_origem || XNotaOrigem?.chave_nfe || "-"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-7 rounded-xl border-2 border-dashed border-border bg-muted/20 text-center flex flex-col items-center justify-center gap-2.5">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/60" />
                    <p className="font-black text-lg text-foreground">Nenhuma NF-e original vinculada</p>
                    <p className="text-base text-muted-foreground max-w-lg">
                      Clique no botão <strong>Localizar NF-e Original</strong> acima para selecionar a nota fiscal autorizada que receberá o complemento.
                    </p>
                  </div>
                )}
              </div>

              {/* DADOS GERAIS DA OPERAÇÃO COMPLEMENTAR */}
              <div className="p-6 rounded-xl border border-border bg-card shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-8">
                  <label className="text-base font-extrabold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Natureza da Operação (SEFAZ)
                  </label>
                  <input
                    type="text"
                    disabled={isBloqueado}
                    value={record.nat_op || ""}
                    onChange={(e) => setField("nat_op", e.target.value.toUpperCase())}
                    className="w-full h-12 px-4 rounded-lg border border-border bg-background text-lg font-bold uppercase focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Ex: COMPLEMENTO DE VALOR"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-base font-extrabold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Série
                  </label>
                  <input
                    type="text"
                    disabled={isBloqueado}
                    value={record.serie || "1"}
                    onChange={(e) => setField("serie", e.target.value)}
                    className="w-full h-12 px-3 rounded-lg border border-border bg-background text-lg font-mono font-black text-center focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-base font-extrabold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Data Emissão
                  </label>
                  <input
                    type="date"
                    disabled={isBloqueado}
                    value={record.dt_emissao ? String(record.dt_emissao).substring(0, 10) : new Date().toISOString().substring(0, 10)}
                    onChange={(e) => setField("dt_emissao", e.target.value)}
                    className="w-full h-12 px-3 rounded-lg border border-border bg-background text-base font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* ABAS POR TIPO DE NOTA COMPLEMENTAR */}
              <Tabs
                value={String(tpCompAtual)}
                onValueChange={(val) => {
                  const tp = parseInt(val, 10) as TTipoComplemento;
                  setField("tp_complemento", tp);
                  if (tp === 1) setField("nat_op", "COMPLEMENTO DE VALOR");
                  else if (tp === 2) setField("nat_op", "COMPLEMENTO DE IMPOSTO");
                  else if (tp === 3) {
                    setField("nat_op", "COMPLEMENTO DE QUANTIDADE");
                    setField("movimenta_estoque_comp", true);
                  }
                  else if (tp === 4) {
                    setField("nat_op", "COMPLEMENTO DE VALOR E QUANTIDADE");
                    setField("movimenta_estoque_comp", true);
                  }
                }}
                className="w-full space-y-4"
              >
                {/* Cabeçalho das 4 Abas */}
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-16 p-2 bg-muted/60 rounded-xl gap-2">
                  <TabsTrigger
                    value="1"
                    disabled={isBloqueado}
                    className="h-12 text-base md:text-lg font-black flex items-center justify-center gap-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <span>1. Complemento de Valor</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="2"
                    disabled={isBloqueado}
                    className="h-12 text-base md:text-lg font-black flex items-center justify-center gap-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    <Receipt className="w-5 h-5 text-blue-500" />
                    <span>2. Complemento de Impostos</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="3"
                    disabled={isBloqueado}
                    className="h-12 text-base md:text-lg font-black flex items-center justify-center gap-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    <Package className="w-5 h-5 text-amber-500" />
                    <span>3. Complemento de Quantidade</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="4"
                    disabled={isBloqueado}
                    className="h-12 text-base md:text-lg font-black flex items-center justify-center gap-2.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all"
                  >
                    <FilePlus className="w-5 h-5 text-indigo-500" />
                    <span>4. Valor e Quantidade</span>
                  </TabsTrigger>
                </TabsList>

                {/* ============================================================== */}
                {/* ABA 1: COMPLEMENTO DE VALOR                                    */}
                {/* ============================================================== */}
                <TabsContent value="1" className="space-y-4 outline-none">
                  {/* Banner Explicativo */}
                  <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                        <DollarSign className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-foreground">Complemento de Valor dos Produtos (Preço)</h4>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer bg-card px-4 py-3 rounded-lg border border-border shadow-xs hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        disabled={isBloqueado}
                        checked={Boolean(record.gera_financeiro_comp)}
                        onChange={(e) => setField("gera_financeiro_comp", e.target.checked)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="font-bold text-base">Gerar lançamento no Contas a Receber</span>
                    </label>
                  </div>

                  {/* Grade de Produtos para Complemento de Valor */}
                  <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
                    <div className="grid grid-cols-12 gap-3 px-5 py-4 bg-muted/70 text-base font-black uppercase text-muted-foreground tracking-wider border-b border-border select-none">
                      <div className="col-span-1 text-center whitespace-nowrap">Sel.</div>
                      <div className="col-span-4 whitespace-nowrap">Produto / Descrição</div>
                      <div className="col-span-1 text-center whitespace-nowrap">CFOP</div>
                      <div className="col-span-2 text-right whitespace-nowrap">Qtde Orig.</div>
                      <div className="col-span-2 text-right whitespace-nowrap">Total Orig. (R$)</div>
                      <div className="col-span-2 text-right text-foreground font-black whitespace-nowrap">(+) Valor Complementar (R$)</div>
                    </div>

                    <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                      {XItens.map((it, idx) => {
                        const codProd = it.cd_prod_fornec || it.produto_id;
                        return (
                          <div
                            key={it.temp_id}
                            className={`grid grid-cols-12 gap-3 px-5 py-4 text-base items-center transition-colors ${
                              it.selecionado ? "bg-primary/5 font-semibold" : "opacity-60 bg-muted/10"
                            }`}
                          >
                            <div className="col-span-1 flex items-center justify-center">
                              <input
                                type="checkbox"
                                disabled={isBloqueado}
                                checked={it.selecionado}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setXItens(prev => prev.map((p, i) => i === idx ? { ...p, selecionado: checked } : p));
                                }}
                                className="w-6 h-6 rounded border-border text-primary focus:ring-primary cursor-pointer"
                              />
                            </div>

                            <div className="col-span-4 truncate">
                              <div className="font-extrabold text-lg text-foreground truncate" title={it.nm_produto}>
                                {codProd ? `${codProd} - ` : ""}{it.nm_produto}
                              </div>
                            </div>

                            <div className="col-span-1">
                              <input
                                type="text"
                                disabled={isBloqueado || !it.selecionado}
                                value={it.cfop || ""}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").substring(0, 4);
                                  setXItens(prev => prev.map((p, i) => i === idx ? { ...p, cfop: val } : p));
                                }}
                                className="w-full h-12 px-2 text-center font-mono text-base font-black rounded-md border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                              />
                            </div>

                            <div className="col-span-2 text-right font-mono text-xl font-black text-foreground whitespace-nowrap">
                              {it.qt_origem} {it.unidade}
                            </div>

                            <div className="col-span-2 text-right font-mono text-xl font-black text-foreground whitespace-nowrap">
                              R$ {formatMoney(it.vl_total_origem)}
                            </div>

                            <div className="col-span-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={isBloqueado || !it.selecionado}
                                value={it.vl_total ? formatMoney(it.vl_total) : ""}
                                placeholder="0,00"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = parseMoneyRaw(e.target.value);
                                  setXItens(prev => prev.map((p, i) => {
                                    if (i !== idx) return p;
                                    return recalcularTributosItemPorValor(p, val);
                                  }));
                                }}
                                className="w-full h-14 px-4 text-right font-mono font-black text-2xl rounded-lg border-2 border-emerald-500/60 bg-background text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                              />
                            </div>
                          </div>
                        );
                      })}

                      {XItens.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-base">
                          Nenhum produto carregado. Selecione a NF-e original primeiro.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ============================================================== */}
                {/* ABA 2: COMPLEMENTO DE IMPOSTOS                                 */}
                {/* ============================================================== */}
                <TabsContent value="2" className="space-y-4 outline-none">
                  {/* Banner Explicativo */}
                  <div className="p-5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center gap-3.5">
                    <div className="p-2.5 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-foreground">Complemento de Impostos e Tributos</h4>
                    </div>
                  </div>

                  {/* Lista com Painéis Claros de Tributos por Item */}
                  <div className="space-y-5 max-h-[580px] overflow-y-auto pr-1">
                    {XItens.map((it, idx) => (
                      <div
                        key={it.temp_id}
                        className={`p-5 rounded-xl border-2 transition-all ${
                          it.selecionado ? "border-blue-500/40 bg-card shadow-xs" : "border-border bg-muted/20 opacity-60"
                        }`}
                      >
                        {/* Header do Item */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-border/70">
                          <div className="flex items-center gap-3.5">
                            <input
                              type="checkbox"
                              disabled={isBloqueado}
                              checked={it.selecionado}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setXItens(prev => prev.map((p, i) => i === idx ? { ...p, selecionado: checked } : p));
                              }}
                              className="w-6 h-6 rounded border-border text-primary focus:ring-primary cursor-pointer"
                            />
                            <div>
                              <div className="font-black text-xl text-foreground">
                                Item #{it.nr_item} — {it.cd_prod_fornec || it.produto_id ? `${it.cd_prod_fornec || it.produto_id} - ` : ""}{it.nm_produto}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <label className="text-base font-bold text-muted-foreground uppercase">CFOP:</label>
                            <input
                              type="text"
                              disabled={isBloqueado || !it.selecionado}
                              value={it.cfop || ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").substring(0, 4);
                                setXItens(prev => prev.map((p, i) => i === idx ? { ...p, cfop: val } : p));
                              }}
                              className="w-28 h-11 px-2.5 text-center font-mono text-base font-black rounded border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>
                        </div>

                        {/* Campos de Tributos se o item estiver selecionado */}
                        {it.selecionado ? (
                          <div className="pt-4 space-y-4">
                            {/* Bloco 1: ICMS Normal e ICMS-ST */}
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3.5 p-4 rounded-xl bg-secondary/30 border border-border text-base">
                              <div className="md:col-span-2">
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">BC ICMS Comp. (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_bc ? formatMoney(it.vl_bc) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => {
                                      if (i !== idx) return p;
                                      const vIcms = p.pc_icms > 0 ? (val * p.pc_icms) / 100 : p.vl_icms;
                                      return { ...p, vl_bc: val, vl_icms: Math.round(vIcms * 100) / 100 };
                                    }));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Alíq. ICMS %</label>
                                <input
                                  type="number"
                                  step="any"
                                  disabled={isBloqueado}
                                  value={it.pc_icms || ""}
                                  placeholder="0.00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const aliq = parseFloat(e.target.value) || 0;
                                    setXItens(prev => prev.map((p, i) => {
                                      if (i !== idx) return p;
                                      const vIcms = (p.vl_bc * aliq) / 100;
                                      return { ...p, pc_icms: aliq, vl_icms: Math.round(vIcms * 100) / 100 };
                                    }));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-blue-600 dark:text-blue-400 tracking-wider block mb-1.5">Vlr. ICMS Comp. (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_icms ? formatMoney(it.vl_icms) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_icms: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-xl font-black text-blue-600 dark:text-blue-400 rounded-lg border-2 border-blue-400/60 bg-background focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">BC ICMS-ST (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_bc_st ? formatMoney(it.vl_bc_st) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_bc_st: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Vlr. ICMS-ST (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_icms_st ? formatMoney(it.vl_icms_st) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_icms_st: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>
                            </div>

                            {/* Bloco 2: IPI, PIS e COFINS */}
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3.5 p-4 rounded-xl bg-secondary/30 border border-border text-base">
                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">BC IPI (R$)</label>
                                <input
                                  type="text"
                                  disabled={isBloqueado}
                                  value={it.vl_ipi ? formatMoney(it.vl_total || it.vl_bc || 0) : ""}
                                  placeholder="0,00"
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background"
                                  readOnly
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Vlr. IPI (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_ipi ? formatMoney(it.vl_ipi) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_ipi: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Alíq. PIS %</label>
                                <input
                                  type="number"
                                  step="any"
                                  disabled={isBloqueado}
                                  value={it.pc_pis || ""}
                                  placeholder="0.00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const aliq = parseFloat(e.target.value) || 0;
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, pc_pis: aliq } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Vlr. PIS (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_pis ? formatMoney(it.vl_pis) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_pis: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Alíq. COFINS %</label>
                                <input
                                  type="number"
                                  step="any"
                                  disabled={isBloqueado}
                                  value={it.pc_cofins || ""}
                                  placeholder="0.00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const aliq = parseFloat(e.target.value) || 0;
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, pc_cofins: aliq } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-extrabold text-sm uppercase text-muted-foreground tracking-wider block mb-1.5">Vlr. COFINS (R$)</label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isBloqueado}
                                  value={it.vl_cofins ? formatMoney(it.vl_cofins) : ""}
                                  placeholder="0,00"
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = parseMoneyRaw(e.target.value);
                                    setXItens(prev => prev.map((p, i) => i === idx ? { ...p, vl_cofins: val } : p));
                                  }}
                                  className="w-full h-12 px-3 text-right font-mono text-lg font-bold rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2 text-base text-muted-foreground italic">
                            Marque a caixa de seleção deste item para habilitar a edição dos seus tributos.
                          </div>
                        )}
                      </div>
                    ))}

                    {XItens.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-base border border-dashed border-border rounded-xl">
                        Nenhum produto carregado. Selecione a NF-e original primeiro.
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* ============================================================== */}
                {/* ABA 3: COMPLEMENTO DE QUANTIDADE                               */}
                {/* ============================================================== */}
                <TabsContent value="3" className="space-y-4 outline-none">
                  {/* Banner Explicativo */}
                  <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-foreground">Complemento de Quantidade Física de Mercadoria</h4>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer bg-card px-4 py-3 rounded-lg border border-border shadow-xs hover:bg-secondary/40">
                      <input
                        type="checkbox"
                        disabled={isBloqueado}
                        checked={Boolean(record.movimenta_estoque_comp)}
                        onChange={(e) => setField("movimenta_estoque_comp", e.target.checked)}
                        className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="font-bold text-base">Movimentar estoque complementar na autorização</span>
                    </label>
                  </div>

                  {/* Grade de Produtos para Complemento de Quantidade */}
                  <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
                    <div className="grid grid-cols-12 gap-3 px-5 py-4 bg-muted/70 text-base font-black uppercase text-muted-foreground tracking-wider border-b border-border select-none">
                      <div className="col-span-1 text-center whitespace-nowrap">Sel.</div>
                      <div className="col-span-5 whitespace-nowrap">Produto / Descrição</div>
                      <div className="col-span-1 text-center whitespace-nowrap">Unidade</div>
                      <div className="col-span-1 text-center whitespace-nowrap">CFOP</div>
                      <div className="col-span-2 text-right whitespace-nowrap">Quantidade Original</div>
                      <div className="col-span-2 text-right text-foreground font-black whitespace-nowrap">(+) Qtde Complementar</div>
                    </div>

                    <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                      {XItens.map((it, idx) => {
                        const codProd = it.cd_prod_fornec || it.produto_id;
                        return (
                          <div
                            key={it.temp_id}
                            className={`grid grid-cols-12 gap-3 px-5 py-4 text-base items-center transition-colors ${
                              it.selecionado ? "bg-primary/5 font-semibold" : "opacity-60 bg-muted/10"
                            }`}
                          >
                            <div className="col-span-1 flex items-center justify-center">
                              <input
                                type="checkbox"
                                disabled={isBloqueado}
                                checked={it.selecionado}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setXItens(prev => prev.map((p, i) => i === idx ? { ...p, selecionado: checked } : p));
                                }}
                                className="w-6 h-6 rounded border-border text-primary focus:ring-primary cursor-pointer"
                              />
                            </div>

                            <div className="col-span-5 truncate">
                              <div className="font-extrabold text-lg text-foreground truncate" title={it.nm_produto}>
                                {codProd ? `${codProd} - ` : ""}{it.nm_produto}
                              </div>
                            </div>

                            <div className="col-span-1 text-center font-mono text-xl font-black text-foreground">
                              {it.unidade}
                            </div>

                            <div className="col-span-1">
                              <input
                                type="text"
                                disabled={isBloqueado || !it.selecionado}
                                value={it.cfop || ""}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").substring(0, 4);
                                  setXItens(prev => prev.map((p, i) => i === idx ? { ...p, cfop: val } : p));
                                }}
                                className="w-full h-12 px-2 text-center font-mono text-base font-black rounded-md border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                              />
                            </div>

                            <div className="col-span-2 text-right font-mono text-xl font-black text-foreground whitespace-nowrap">
                              {formatQty3(it.qt_origem)} {it.unidade}
                            </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isBloqueado || !it.selecionado}
                              value={it.qt_entrada ? formatQty3(it.qt_entrada) : ""}
                              placeholder="0,000"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseQty3Raw(e.target.value);
                                setXItens(prev => prev.map((p, i) => {
                                  if (i !== idx) return p;
                                  return { ...p, qt_entrada: val, vl_total: 0 };
                                }));
                              }}
                              className="w-full h-14 px-4 text-right font-mono font-black text-2xl rounded-lg border-2 border-amber-500/60 bg-background text-amber-700 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                            />
                          </div>
                        </div>
                      );
                    })}

                      {XItens.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-base">
                          Nenhum produto carregado. Selecione a NF-e original primeiro.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* ============================================================== */}
                {/* ABA 4: VALOR E QUANTIDADE                                      */}
                {/* ============================================================== */}
                <TabsContent value="4" className="space-y-4 outline-none">
                  {/* Banner Explicativo */}
                  <div className="p-5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                        <FilePlus className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-foreground">Complemento Misto: Valor e Quantidade</h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2.5 cursor-pointer bg-card px-4 py-3 rounded-lg border border-border shadow-xs hover:bg-secondary/40 text-base">
                        <input
                          type="checkbox"
                          disabled={isBloqueado}
                          checked={Boolean(record.gera_financeiro_comp)}
                          onChange={(e) => setField("gera_financeiro_comp", e.target.checked)}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="font-bold">Contas a Receber</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer bg-card px-4 py-3 rounded-lg border border-border shadow-xs hover:bg-secondary/40 text-base">
                        <input
                          type="checkbox"
                          disabled={isBloqueado}
                          checked={Boolean(record.movimenta_estoque_comp)}
                          onChange={(e) => setField("movimenta_estoque_comp", e.target.checked)}
                          className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="font-bold">Movimentar Estoque</span>
                      </label>
                    </div>
                  </div>

                  {/* Grade de Produtos */}
                  <div className="border border-border rounded-xl bg-card shadow-xs overflow-hidden">
                    <div className="grid grid-cols-12 gap-3 px-5 py-4 bg-muted/70 text-base font-black uppercase text-muted-foreground tracking-wider border-b border-border select-none">
                      <div className="col-span-1 text-center whitespace-nowrap">Sel.</div>
                      <div className="col-span-4 whitespace-nowrap">Produto / Descrição</div>
                      <div className="col-span-1 text-center whitespace-nowrap">CFOP</div>
                      <div className="col-span-2 text-right whitespace-nowrap">Qtde Comp.</div>
                      <div className="col-span-2 text-right whitespace-nowrap">Vlr. Unit. Comp.</div>
                      <div className="col-span-2 text-right text-foreground font-black whitespace-nowrap">Total Comp. (R$)</div>
                    </div>

                    <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                      {XItens.map((it, idx) => {
                        const codProd = it.cd_prod_fornec || it.produto_id;
                        return (
                          <div
                            key={it.temp_id}
                            className={`grid grid-cols-12 gap-3 px-5 py-4 text-base items-center transition-colors ${
                              it.selecionado ? "bg-primary/5 font-semibold" : "opacity-60 bg-muted/10"
                            }`}
                          >
                            <div className="col-span-1 flex items-center justify-center">
                              <input
                                type="checkbox"
                                disabled={isBloqueado}
                                checked={it.selecionado}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setXItens(prev => prev.map((p, i) => i === idx ? { ...p, selecionado: checked } : p));
                                }}
                                className="w-6 h-6 rounded border-border text-primary focus:ring-primary cursor-pointer"
                              />
                            </div>

                            <div className="col-span-4 truncate">
                              <div className="font-extrabold text-lg text-foreground truncate" title={it.nm_produto}>
                                {codProd ? `${codProd} - ` : ""}{it.nm_produto}
                              </div>
                              <div className="text-sm text-muted-foreground font-mono font-semibold">
                                Origem: {formatQty3(it.qt_origem)} {it.unidade} a R$ {formatMoney(it.vl_unit_origem)}
                              </div>
                            </div>

                          <div className="col-span-1">
                            <input
                              type="text"
                              disabled={isBloqueado || !it.selecionado}
                              value={it.cfop || ""}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").substring(0, 4);
                                setXItens(prev => prev.map((p, i) => i === idx ? { ...p, cfop: val } : p));
                              }}
                              className="w-full h-12 px-2 text-center font-mono text-base font-black rounded-md border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isBloqueado || !it.selecionado}
                              value={it.qt_entrada ? formatQty3(it.qt_entrada) : ""}
                              placeholder="0,000"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseQty3Raw(e.target.value);
                                setXItens(prev => prev.map((p, i) => {
                                  if (i !== idx) return p;
                                  const total = Math.round((val * (p.vl_unit || p.vl_unit_origem || 0)) * 100) / 100;
                                  return recalcularTributosItemPorValor({ ...p, qt_entrada: val }, total);
                                }));
                              }}
                              className="w-full h-14 px-3 text-right font-mono text-xl font-black rounded-lg border-2 border-indigo-400/50 bg-background focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isBloqueado || !it.selecionado}
                              value={it.vl_unit ? formatMoney(it.vl_unit) : ""}
                              placeholder="0,00"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = parseMoneyRaw(e.target.value);
                                setXItens(prev => prev.map((p, i) => {
                                  if (i !== idx) return p;
                                  const total = Math.round(((p.qt_entrada || 1) * val) * 100) / 100;
                                  return recalcularTributosItemPorValor({ ...p, vl_unit: val }, total);
                                }));
                              }}
                              className="w-full h-14 px-3 text-right font-mono text-xl font-black rounded-lg border-2 border-indigo-400/50 bg-background focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                          </div>

                          <div className="col-span-2 text-right font-mono font-black text-xl text-foreground">
                            R$ {formatMoney(it.vl_total || 0)}
                          </div>
                        </div>
                      );
                    })}

                      {XItens.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-base">
                          Nenhum produto carregado. Selecione a NF-e original primeiro.
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* CARD RESUMO DE TOTAIS DA NF-E COMPLEMENTAR */}
              <div className="p-6 rounded-xl border border-border bg-card shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-primary" />
                  <h3 className="text-lg font-black uppercase tracking-wider text-foreground">
                    Totais da Nota Fiscal Complementar
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">Valor Produtos</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_produto)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">BC ICMS</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_bc)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex flex-col justify-between">
                    <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-black tracking-wider">ICMS Normal</span>
                    <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">R$ {formatMoney(totaisCalculados.vl_icms)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">ICMS-ST</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_icms_st)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">IPI</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_ipi)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">PIS</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_pis)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border flex flex-col justify-between">
                    <span className="text-xs text-muted-foreground uppercase font-black tracking-wider">COFINS</span>
                    <span className="text-xl font-black font-mono text-foreground mt-1">R$ {formatMoney(totaisCalculados.vl_cofins)}</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-primary/15 border-2 border-primary/60 flex flex-col justify-between shadow-xs">
                    <span className="text-xs text-primary uppercase font-black tracking-wider">Total NF-e</span>
                    <span className="text-2xl font-black font-mono text-primary mt-1">R$ {formatMoney(totaisCalculados.vl_total_nf)}</span>
                  </div>
                </div>

                {(totaisCalculados.vl_ibs > 0 || totaisCalculados.vl_cbs > 0) && (
                  <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-sm font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    <span>Reforma Tributária (IBS / CBS Complementar):</span>
                    <div className="flex gap-4">
                      <span>IBS: R$ {formatMoney(totaisCalculados.vl_ibs)}</span>
                      <span>CBS: R$ {formatMoney(totaisCalculados.vl_cbs)}</span>
                    </div>
                  </div>
                )}

                {/* Informações Complementares / Observações */}
                <div className="pt-3">
                  <label className="text-base font-black uppercase tracking-wider text-muted-foreground block mb-2">
                    Informações Adicionais / Observações da NF-e Complementar (infCpl)
                  </label>
                  <textarea
                    rows={3}
                    disabled={isBloqueado}
                    value={record.obs_nf || ""}
                    onChange={(e) => setField("obs_nf", e.target.value)}
                    className="w-full p-4 rounded-lg border border-border bg-background text-base font-medium focus:ring-2 focus:ring-primary outline-none"
                    placeholder="Informações adicionais que constarão no XML e no DANFE da Nota Complementar..."
                  />
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* MODAL DE BUSCA DA NF-E ORIGINAL */}
      <Dialog open={XSearchNfeOpen} onOpenChange={setXSearchNfeOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-6 gap-3.5">
          <DialogHeader className="pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-3 text-lg font-black text-foreground">
              <div className="p-2.5 rounded-xl bg-primary/15 text-primary">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <span>Localizar NF-e Original Emitida</span>
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  Selecione a NF-e autorizada que receberá o complemento fiscal
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Filtros em 2 linhas organizadas, limpas e perfeitamente balanceadas */}
          <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
            {/* Linha 1: 12 colunas bem distribuídas (2 + 1 + 5 + 2 + 2 = 12) */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 sm:col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Número da NF-e
                </label>
                <input
                  ref={buscaNrInputRef}
                  type="text"
                  value={XBuscaNr}
                  onChange={(e) => setXBuscaNr(e.target.value)}
                  placeholder="Ex: 1234"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaSerieInputRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-12 sm:col-span-1">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Série
                </label>
                <input
                  ref={buscaSerieInputRef}
                  type="text"
                  value={XBuscaSerie}
                  onChange={(e) => setXBuscaSerie(e.target.value)}
                  placeholder="1"
                  className="w-full h-10 px-2 rounded-lg border border-border bg-background text-sm font-mono font-black text-center focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaClienteInputRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-12 sm:col-span-5">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Cliente / Destinatário
                </label>
                <input
                  ref={buscaClienteInputRef}
                  type="text"
                  value={XBuscaCliente}
                  onChange={(e) => setXBuscaCliente(e.target.value)}
                  placeholder="Razão social, nome fantasia ou CNPJ/CPF..."
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-semibold focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaDtIniInputRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-12 sm:col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Data Inicial
                </label>
                <input
                  ref={buscaDtIniInputRef}
                  type="date"
                  value={XBuscaDtIni}
                  onChange={(e) => setXBuscaDtIni(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaDtFimInputRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-12 sm:col-span-2">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Data Final
                </label>
                <input
                  ref={buscaDtFimInputRef}
                  type="date"
                  value={XBuscaDtFim}
                  onChange={(e) => setXBuscaDtFim(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaChaveInputRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            {/* Linha 2: Chave de Acesso (8 cols) + Botões Pesquisar e Limpar (4 cols) */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 sm:col-span-8">
                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                  Chave de Acesso (44 Dígitos)
                </label>
                <input
                  ref={buscaChaveInputRef}
                  type="text"
                  value={XBuscaChave}
                  onChange={(e) => setXBuscaChave(e.target.value)}
                  placeholder="Informe os 44 dígitos da chave de acesso da NF-e..."
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-primary outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscaBtnPesquisarRef.current?.focus();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-12 sm:col-span-4 flex items-center gap-2">
                <button
                  ref={buscaBtnPesquisarRef}
                  type="button"
                  disabled={XBuscaLoading}
                  onClick={() => executarBuscaNfeOriginal()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      executarBuscaNfeOriginal();
                    } else if (e.key === "ArrowDown" && XBuscaResultados.length > 0) {
                      e.preventDefault();
                      setXBuscaSelectedIdx(0);
                      buscaGridContainerRef.current?.focus();
                    }
                  }}
                  className="flex-1 h-10 px-4 rounded-lg font-black text-sm uppercase bg-primary text-zinc-950 hover:bg-primary/90 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  title="Pesquisar NF-e (Enter)"
                >
                  <Search className="w-4 h-4 text-zinc-950" />
                  <span>{XBuscaLoading ? "Buscando..." : "Pesquisar"}</span>
                </button>
                <button
                  type="button"
                  disabled={XBuscaLoading}
                  onClick={limparFiltrosBusca}
                  className="h-10 px-4 rounded-lg font-bold text-sm uppercase bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  title="Limpar filtros"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Limpar</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grid de Resultados alinhado e padronizado */}
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col flex-1 min-h-[300px]">
            {/* Header da Grid com larguras consistentes */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-muted/80 text-xs font-black uppercase text-muted-foreground tracking-wider border-b border-border select-none shrink-0">
              <div className="col-span-2">Número</div>
              <div className="col-span-1 text-center">Série</div>
              <div className="col-span-2 text-center">Emissão</div>
              <div className="col-span-4">Cliente / Destinatário</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-2 text-right">Valor Total</div>
            </div>

            {/* Lista com scroll e navegação */}
            <div
              ref={buscaGridContainerRef}
              tabIndex={0}
              onKeyDown={handleGridKeyDown}
              className="max-h-[380px] overflow-y-auto flex-1 outline-none focus:ring-1 focus:ring-primary/40 divide-y divide-border/60"
            >
              {XBuscaLoading && (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm font-bold text-foreground">Buscando notas fiscais autorizadas...</span>
                </div>
              )}

              {!XBuscaLoading && XBuscaResultados.length === 0 && (
                <div className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2.5">
                  <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-muted-foreground/60" />
                  </div>
                  <p className="font-black text-base text-foreground">Nenhuma NF-e na listagem</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Informe os filtros acima (Número, Cliente, Período ou Chave) e clique em <strong>Pesquisar</strong> para consultar as notas fiscais autorizadas.
                  </p>
                </div>
              )}

              {!XBuscaLoading && XBuscaResultados.map((nfe, idx) => {
                const isSelected = XBuscaSelectedIdx === idx;
                const zebra = isSelected
                  ? "bg-primary/20 text-foreground font-semibold border-l-4 border-l-primary"
                  : idx % 2 === 1
                  ? "bg-muted/15"
                  : "bg-card";

                return (
                  <div
                    key={nfe.nfe_cabecalho_id}
                    ref={(el) => (buscaRowRefs.current[idx] = el)}
                    onClick={() => setXBuscaSelectedIdx(idx)}
                    onDoubleClick={() => {
                      if (XActiveSetFieldRef.current) {
                        selecionarNfeOriginal(nfe, XActiveSetFieldRef.current);
                      }
                    }}
                    className={`grid grid-cols-12 gap-3 px-4 py-3 text-sm cursor-pointer items-center transition-colors hover:bg-primary/10 select-none ${zebra}`}
                  >
                    <div className="col-span-2 font-black font-mono text-base text-foreground flex items-center gap-2">
                      <FileText className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <span>{nfe.nr_nota}</span>
                    </div>

                    <div className="col-span-1 text-center font-mono text-sm text-muted-foreground font-bold">
                      {nfe.serie || "1"}
                    </div>

                    <div className="col-span-2 text-center text-muted-foreground flex items-center justify-center gap-1.5 font-mono text-sm font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
                      <span>{nfe.dt_emissao ? new Date(nfe.dt_emissao).toLocaleDateString("pt-BR") : "-"}</span>
                    </div>

                    <div className="col-span-4 truncate">
                      <div className="font-bold text-sm text-foreground truncate" title={nfe.cadastro?.razao_social}>
                        {nfe.cadastro?.razao_social || `#${nfe.cadastro_id}`}
                      </div>
                      {nfe.cadastro?.cnpj && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatCPFCNPJ(nfe.cadastro.cnpj)}
                        </div>
                      )}
                    </div>

                    <div className="col-span-1 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {nfe.st_nf === "A" ? "Autorizada" : nfe.st_nf === "E" ? "Enviada" : nfe.st_nf}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
                      R$ {formatMoney(nfe.vl_total_nf)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-4 pt-3 border-t border-border mt-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <span>Dica: Use</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded font-bold">↑ / ↓</kbd>
              <span>para navegar,</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded font-bold">Enter</kbd>
              <span>ou</span>
              <strong className="text-foreground">duplo clique</strong>
              <span>para selecionar.</span>
            </div>
            <button
              type="button"
              onClick={() => setXSearchNfeOpen(false)}
              className="h-10 px-5 rounded-lg text-sm font-black uppercase bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VISUALIZAÇÃO DO XML */}
      <Dialog open={XXmlModalOpen} onOpenChange={setXXmlModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileCode className="w-4 h-4 text-primary" /> Visualização do XML da NF-e Complementar
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto p-3 bg-muted/40 rounded-lg border border-border font-mono text-[11px] max-h-[480px]">
            <pre className="whitespace-pre-wrap break-all">{XConteudoXml}</pre>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 mt-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(XConteudoXml);
                toast.success("XML copiado para a área de transferência!");
              }}
              className="px-3 py-1.5 rounded text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar XML
            </button>
            <button
              type="button"
              onClick={() => setXXmlModalOpen(false)}
              className="px-4 py-1.5 rounded text-xs font-bold bg-secondary hover:bg-secondary/80 border border-border"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO DE PROGRESSO DA TRANSMISSÃO FISCAL */}
      <FiscalProgressDialog
        open={XProg.open}
        titulo={XProg.titulo}
        descricao="Aguardando retorno do Fiscal Worker e autorização da SEFAZ..."
        segundosTotais={XProg.total}
        segundosRestantes={XProg.restante}
      />
    </div>
  );
};

export default NotaComplementarForm;
