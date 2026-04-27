import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, SquarePen, Trash2, RefreshCw, Upload, Filter } from "lucide-react";
import { ToolbarBtn } from "@/components/shared/FormToolbar";
import { baseService } from "@/utils/baseService";
import { useGridFilter } from "@/hooks/useGridFilter";
import { consumePendingProduct } from "@/utils/nfePendingStore";

const db = supabase as any;
type TFormMode = "view" | "edit" | "insert";

/* ─── Helpers pt-BR formatting ─── */
const parseBR = (s: string): number => {
  if (typeof s !== "string") return Number(s) || 0;

  const XRaw = s.trim().replace(/\s/g, "");
  if (!XRaw) return 0;

  let XNormalized = XRaw;
  if (XRaw.includes(",") && XRaw.includes(".")) {
    XNormalized = XRaw.replace(/\./g, "").replace(",", ".");
  } else if (XRaw.includes(",")) {
    XNormalized = XRaw.replace(",", ".");
  }

  const n = Number(XNormalized);
  return Number.isFinite(n) ? n : 0;
};

const fmtBR = (v: number | string, decimals: number): string => {
  const n = typeof v === "string" ? parseBR(v) : v;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};


/* ─── Search columns ─── */
const XLocalizarColumns: IGridColumn[] = [
  { key: "produto_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Descrição", width: "2fr" },
  { key: "grupo_nome", label: "Grupo", width: "1fr" },
  { key: "subgrupo_nome", label: "Subgrupo", width: "1fr" },
  { key: "nome_reduzido", label: "Nome Reduzido", width: "1fr" },
  { key: "gtin", label: "GTIN", width: "140px" },
  { key: "preco_venda", label: "Preço Venda", width: "110px", align: "right" },
];

/* ─── Empty form ─── */
const emptyForm = (): Record<string, string> => ({
  nome: "", nome_reduzido: "", descricao: "", unidade_id: "", gtin: "", referencia: "",
  tp_produto: "PA", ativo: "S", preco_venda: "0", preco_promocional: "0", vl_compra: "0",
  pc_markup: "0", preco_sugerido: "0", url_foto: "", venda_online: "true",
  dias_venda_online: "0,1,2,3,4", controla_estoque: "S",
  produto_grupo_id: "", produto_subgrupo_id: "", linha_id: "",
  nm_ecommerce: "", ds_ecommerce: "",
  ncm: "", cest: "", mva: "0", tb_a_origem: "", grupo_icms_id: "", grupo_ipi_id: "", grupo_pis_cofins_id: "", grupo_ibscbs_id: "",
  pc_ipi: "0", pc_frete: "0", pc_icms_cred: "0", pc_ipi_cred: "0", pc_emb: "0", pc_seguro: "0",
  pc_st_trib: "0", pc_outras_desp: "0", pc_pis: "0", pc_cofins: "0", pc_fcp_st: "0", pc_difal_sn: "0",
  vl_ipi: "0", vl_frete: "0", vl_icms_cred: "0", vl_ipi_cred: "0", vl_emb: "0", vl_seguro: "0",
  vl_st: "0", vl_outras_desp: "0", vl_pis: "0", vl_cofins: "0", vl_fcp_st: "0", vl_difal_sn: "0",
  vl_custo: "0", vl_custo_medio: "0", vl_desconto: "0", vl_outro: "0", pc_desconto: "0",
  pc_multiplicador: "0", vl_multiplicador: "0", st_promo: "N",
  preco_venda_faturado: "0", preco_promocional_fat: "0",
  altura: "0", comprimento: "0", largura: "0", area: "0", peso_bruto: "0", peso_liquido: "0",
});

/* ─── Conversão grid columns ─── */
const XConvGridCols: IGridColumn[] = [
  { key: "unidade_id", label: "Unid.", width: "100px" },
  { key: "tp_movimento", label: "Tipo de Movimento", width: "1fr" },
  { key: "fator_mult", label: "Fator Mult.", width: "120px", align: "right" },
];

/* ─── Estoque grid columns ─── */
const XEstoqueGridCols: IGridColumn[] = [
  { key: "empresa_nome", label: "Empresa", width: "160px" },
  { key: "deposito_nome", label: "Depósito", width: "1fr" },
  { key: "endereco", label: "Endereço", width: "120px" },
  { key: "estoque_fisico", label: "Qt. Física", width: "120px", align: "right" },
  { key: "estoque_reservado", label: "Qt. Reservada", width: "120px", align: "right" },
  { key: "estoque_disponivel", label: "Qt. Disponível", width: "120px", align: "right" },
];

/* ─── Código de Barras grid columns ─── */
const XBarraGridCols: IGridColumn[] = [
  { key: "cod_barra", label: "Código de Barras", width: "1fr" },
];

const ProdutoForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<string>("cadastro");
  const [XSubTab, setXSubTab] = useState<string>("cadastro");
  const [XData, setXData] = useState<any[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XF, setXF] = useState(emptyForm());
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [_XLoading, setXLoading] = useState(false);

  // Lookups
  const [XGrupos, setXGrupos] = useState<any[]>([]);
  const [XSubgrupos, setXSubgrupos] = useState<any[]>([]);
  const [XLinhas, setXLinhas] = useState<any[]>([]);
  const [XUnidades, setXUnidades] = useState<any[]>([]);
  const [XGrupoIcms, setXGrupoIcms] = useState<any[]>([]);
  const [XGrupoIpi, setXGrupoIpi] = useState<any[]>([]);
  const [XGrupoPisCofins, setXGrupoPisCofins] = useState<any[]>([]);
  const [XGrupoIbsCbs, setXGrupoIbsCbs] = useState<any[]>([]);
  const [XDepositos, setXDepositos] = useState<any[]>([]);

  // Sub-grids
  const [XEstoques, setXEstoques] = useState<any[]>([]);
  const [XEstIdx, setXEstIdx] = useState(-1);
  const [XEstShowFilters, setXEstShowFilters] = useState(false);
  const [XEstFilterValues, setXEstFilterValues] = useState<Record<string, string>>({});
  const [XEstMode, setXEstMode] = useState<"view" | "edit" | "insert">("view");
  const [XEstForm, setXEstForm] = useState({ deposito_id: "", endereco: "", estoque_minimo: "0", estoque_padrao: "0" });
  const [XConversoes, setXConversoes] = useState<any[]>([]);
  const [XConvMode, setXConvMode] = useState<"view" | "edit" | "insert">("view");
  const [XConvIdx, setXConvIdx] = useState(-1);
  const [XConvForm, setXConvForm] = useState({ unidade_id: "", tp_movimento: "", fator_mult: "1" });

  // Código de Barras sub-grid
  const [XBarras, setXBarras] = useState<any[]>([]);
  const [XBarraIdx, setXBarraIdx] = useState(-1);
  const [XBarraMode, setXBarraMode] = useState<"view" | "edit" | "insert">("view");
  const [XBarraForm, setXBarraForm] = useState({ cod_barra: "" });
  const [XBarraShowFilters, setXBarraShowFilters] = useState(false);
  const [XBarraFilterValues, setXBarraFilterValues] = useState<Record<string, string>>({});

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const set = useCallback((key: string, val: string) => {
    setXF(prev => ({ ...prev, [key]: val }));
  }, []);

  /* ─── Empresa IDs with same empresa_matriz_id ─── */
  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  const XEmpresaMap = useMemo(() => {
    const m: Record<number, string> = {};
    XEmpresas.forEach(e => { m[e.empresa_id] = e.nome_fantasia || e.razao_social; });
    return m;
  }, [XEmpresas]);

  const loadLookups = useCallback(async () => {
    const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
      db.from("produto_grupo").select("produto_grupo_id,nome").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("nome"),
      db.from("produto_subgrupo").select("produto_subgrupo_id,nome,produto_grupo_id").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("nome"),
      db.from("linha_produto").select("linha_id,nome").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("nome"),
      db.from("unidade").select("unidade_id,descricao").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("descricao"),
      db.from("grupo_icms").select("grupo_icms_id,descricao").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("descricao"),
      db.from("grupo_ipi").select("grupo_ipi_id,descricao").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("descricao"),
      db.from("grupo_pis_cofins").select("grupo_pis_cofins_id,descricao").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("descricao"),
      XGroupEmpresaIds.length > 0
        ? db.from("deposito").select("deposito_id,nome,empresa_id,st_privado").eq("excluido", false)
            .in("empresa_id", XGroupEmpresaIds).order("nome")
        : Promise.resolve({ data: [] }),
      db.from("grupo_ibscbs").select("grupo_ibscbs_id,descricao").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("descricao"),
    ]);
    setXGrupos(r1.data || []);
    setXSubgrupos(r2.data || []);
    setXLinhas(r3.data || []);
    setXUnidades(r4.data || []);
    setXGrupoIcms(r5.data || []);
    setXGrupoIpi(r6.data || []);
    setXGrupoPisCofins(r7.data || []);
    setXDepositos(r8.data || []);
    setXGrupoIbsCbs(r9.data || []);
  }, [XEmpresaMatrizId, XEmpresaId, XGroupEmpresaIds]);

  /* ─── Grupo/Subgrupo maps for grid display ─── */
  const XGrupoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XGrupos.forEach((g: any) => { m[g.produto_grupo_id] = g.nome; });
    return m;
  }, [XGrupos]);

  const XSubgrupoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XSubgrupos.forEach((s: any) => { m[s.produto_subgrupo_id] = s.nome; });
    return m;
  }, [XSubgrupos]);

  /* ─── Load data with grupo/subgrupo names ─── */
  const loadData = useCallback(async () => {
    setXLoading(true);
    const { data: XRows } = await baseService.listar("produto", XEmpresaMatrizId, "produto_id");
    setXData(XRows || []);
    setXLoading(false);
  }, [XEmpresaMatrizId]);

  /* ─── Enriched data with grupo/subgrupo names ─── */
  const XEnrichedData = useMemo(() => {
    return XData.map(r => ({
      ...r,
      grupo_nome: XGrupoMap[r.produto_grupo_id] || "",
      subgrupo_nome: XSubgrupoMap[r.produto_subgrupo_id] || "",
    }));
  }, [XData, XGrupoMap, XSubgrupoMap]);

  /* ─── Load sub-data for current product ─── */
  const loadSubData = useCallback(async (produtoId: number) => {
    // Filter deposits: own company = all, sister companies = only public (st_privado=false)
    const XVisibleDeps = XDepositos.filter((d: any) =>
      d.empresa_id === XEmpresaId || d.st_privado === false
    );
    const XVisibleDepIds = XVisibleDeps.map((d: any) => d.deposito_id);
    const [rEst, rConv, rBarra] = await Promise.all([
      XVisibleDepIds.length > 0
        ? db.from("estoque").select("*").eq("produto_id", produtoId).eq("excluido", false).in("deposito_id", XVisibleDepIds)
        : Promise.resolve({ data: [] }),
      db.from("produto_conversao").select("*").eq("empresa_id", XEmpresaMatrizId).eq("produto_id", produtoId).eq("excluido", false).order("conversao_id"),
      db.from("produto_codbarra").select("*").eq("empresa_id", XEmpresaMatrizId).eq("produto_id", produtoId).eq("excluido", false).order("produto_codbarra_id"),
    ]);
    const XDepMap: Record<number, { nome: string; empresa_id: number }> = {};
    XVisibleDeps.forEach((d: any) => { XDepMap[d.deposito_id] = { nome: d.nome, empresa_id: d.empresa_id }; });
    setXEstoques((rEst.data || []).map((e: any) => ({
      ...e,
      deposito_nome: XDepMap[e.deposito_id]?.nome || String(e.deposito_id),
      empresa_nome: XEmpresaMap[XDepMap[e.deposito_id]?.empresa_id ?? e.empresa_id] || String(e.empresa_id),
    })));
    setXConversoes(rConv.data || []);
    setXBarras(rBarra.data || []);
    setXEstIdx(-1);
    setXBarraIdx(-1);
  }, [XEmpresaId, XEmpresaMatrizId, XDepositos, XEmpresaMap]);

  useEffect(() => {
    // Verifica se existe produto pendente da NF-e
    const pending = consumePendingProduct();
    if (pending) {
      // Abre em inserção com dados do XML - não carrega lista
      loadLookups();
      setXCurrentIdx(0);
      setTimeout(() => {
        const ef = emptyForm();
        setXF({
          ...ef,
          nome:          pending.nm_produto,
          nome_reduzido: pending.nm_produto.substring(0, 30),
          ncm:           pending.ncm,
          gtin:          pending.gtin,
        });
        setXFormMode("insert");
        setXInnerTab("cadastro");
        setXSubTab("cadastro");
      }, 0);
    } else {
      loadData();
      loadLookups();
      setXCurrentIdx(0);
      setXFormMode("view");
    }
  }, [XEmpresaId]);

  useEffect(() => {
    if (XCurrentRecord) loadSubData(XCurrentRecord.produto_id);
  }, [XCurrentRecord?.produto_id, XDepositos]);

  // Populate form when editing
  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      const XNf: Record<string, string> = {};
      for (const key of Object.keys(emptyForm())) {
        const XVal = (XCurrentRecord as any)[key];
        XNf[key] = XVal != null ? String(XVal) : "";
      }
      setXF(XNf);
    }
  }, [XCurrentRecord, XFormMode]);

  // Filtered subgrupos based on selected grupo
  const XFilteredSubgrupos = useMemo(() => {
    if (!XIsEditing) return XSubgrupos;
    const XGrupoId = parseInt(XF.produto_grupo_id);
    if (!XGrupoId) return [];
    return XSubgrupos.filter((s: any) => s.produto_grupo_id === XGrupoId);
  }, [XSubgrupos, XF.produto_grupo_id, XIsEditing]);

  /* ─── Cost pairs mapping ─── */
  const XCostPairs: [string, string][] = [
    ["pc_ipi", "vl_ipi"], ["pc_frete", "vl_frete"], ["pc_icms_cred", "vl_icms_cred"],
    ["pc_ipi_cred", "vl_ipi_cred"], ["pc_emb", "vl_emb"], ["pc_seguro", "vl_seguro"],
    ["pc_st_trib", "vl_st"], ["pc_outras_desp", "vl_outras_desp"],
    ["pc_pis", "vl_pis"], ["pc_cofins", "vl_cofins"],
    ["pc_fcp_st", "vl_fcp_st"], ["pc_difal_sn", "vl_difal_sn"],
  ];

  /* ─── Calculate cost values ─── */
  const recalcFromPercentages = useCallback((form: Record<string, string>, changedPcKey?: string) => {
    const vl = parseBR(form.vl_compra);
    const XUpdates: Record<string, string> = {};
    for (const [pcKey, vlKey] of XCostPairs) {
      if (changedPcKey && pcKey !== changedPcKey) continue;
      const pc = parseBR(form[pcKey]);
      XUpdates[vlKey] = ((pc / 100) * vl).toFixed(2);
    }
    return XUpdates;
  }, []);

  const recalcFromValue = useCallback((form: Record<string, string>, changedVlKey: string) => {
    const vl = parseBR(form.vl_compra);
    const XUpdates: Record<string, string> = {};
    for (const [pcKey, vlKey] of XCostPairs) {
      if (vlKey !== changedVlKey) continue;
      const vlItem = parseBR(form[vlKey]);
      XUpdates[pcKey] = vl > 0 ? ((vlItem / vl) * 100).toFixed(4) : "0";
    }
    return XUpdates;
  }, []);

  const XCreditKeys = new Set(["vl_icms_cred"]);

  const recalcTotals = useCallback((form: Record<string, string>) => {
    const vl = parseBR(form.vl_compra);
    let XSumVl = 0;
    for (const [, vlKey] of XCostPairs) {
      const v = parseBR(form[vlKey]);
      if (XCreditKeys.has(vlKey)) {
        XSumVl -= v;
      } else {
        XSumVl += v;
      }
    }
    const XCusto = parseFloat((vl + XSumVl).toFixed(2));
    const XMark = parseBR(form.pc_multiplicador);
    const XVlMark = parseFloat(((XMark / 100) * XCusto).toFixed(2));
    return {
      vl_custo: XCusto.toFixed(2),
      vl_multiplicador: XVlMark.toFixed(2),
      preco_sugerido: (XCusto + XVlMark).toFixed(2),
    };
  }, []);

  const handleCostFieldChange = useCallback((key: string, rawVal: string) => {
    // Allow raw numeric input directly
    const val = rawVal;
    setXF(prev => {
      const XNext = { ...prev, [key]: val };
      if (key.startsWith("pc_") || key === "vl_compra") {
        if (key === "vl_compra") {
          Object.assign(XNext, recalcFromPercentages(XNext));
        } else {
          Object.assign(XNext, recalcFromPercentages(XNext, key));
        }
      }
      if (key.startsWith("vl_") && XCostPairs.some(([, vlK]) => vlK === key)) {
        Object.assign(XNext, recalcFromValue(XNext, key));
      }
      Object.assign(XNext, recalcTotals(XNext));
      return XNext;
    });
  }, [recalcFromPercentages, recalcFromValue, recalcTotals]);

  /* ─── CRUD handlers ─── */
  const handleIncluir = () => {
    setXFormMode("insert");
    setXF(emptyForm());
    setXInnerTab("cadastro");
    setXSubTab("cadastro");
  };

  const handleEditar = () => {
    if (!XCurrentRecord) return;
    setXFormMode("edit");
    setXInnerTab("cadastro");
    setXSubTab("cadastro");
  };

  const handleSalvar = async () => {
    if (!XF.nome.trim()) { toast.error("A Descrição é obrigatória."); return; }

    const toNum = (v: string) => parseBR(v);
    const toInt = (v: string) => { const n = parseInt(v); return isNaN(n) ? null : n; };

    const XPayload: any = {
      empresa_id: XEmpresaMatrizId,
      nome: XF.nome.trim(),
      nome_reduzido: XF.nome_reduzido.trim(),
      descricao: XF.descricao.trim(),
      unidade_id: XF.unidade_id || null,
      gtin: XF.gtin.trim(),
      referencia: XF.referencia.trim(),
      tp_produto: XF.tp_produto || "PA",
      ativo: XF.ativo || "S",
      produto_grupo_id: toInt(XF.produto_grupo_id),
      produto_subgrupo_id: toInt(XF.produto_subgrupo_id),
      linha_id: toInt(XF.linha_id),
      nm_ecommerce: XF.nm_ecommerce.trim(),
      ds_ecommerce: XF.ds_ecommerce.trim(),
      url_foto: XF.url_foto.trim(),
      ncm: XF.ncm.trim(),
      cest: XF.cest.trim(),
      mva: toNum(XF.mva),
      tb_a_origem: XF.tb_a_origem,
      grupo_icms_id: toInt(XF.grupo_icms_id),
      grupo_ipi_id: toInt(XF.grupo_ipi_id),
      grupo_pis_cofins_id: toInt(XF.grupo_pis_cofins_id),
      grupo_ibscbs_id: toInt(XF.grupo_ibscbs_id),
      vl_compra: toNum(XF.vl_compra),
      pc_ipi: toNum(XF.pc_ipi), pc_frete: toNum(XF.pc_frete),
      pc_icms_cred: toNum(XF.pc_icms_cred), pc_ipi_cred: toNum(XF.pc_ipi_cred),
      pc_emb: toNum(XF.pc_emb), pc_seguro: toNum(XF.pc_seguro),
      pc_st_trib: toNum(XF.pc_st_trib), pc_outras_desp: toNum(XF.pc_outras_desp),
      pc_pis: toNum(XF.pc_pis), pc_cofins: toNum(XF.pc_cofins),
      pc_fcp_st: toNum(XF.pc_fcp_st), pc_difal_sn: toNum(XF.pc_difal_sn),
      vl_ipi: toNum(XF.vl_ipi), vl_frete: toNum(XF.vl_frete),
      vl_icms_cred: toNum(XF.vl_icms_cred), vl_ipi_cred: toNum(XF.vl_ipi_cred),
      vl_emb: toNum(XF.vl_emb), vl_seguro: toNum(XF.vl_seguro),
      vl_st: toNum(XF.vl_st), vl_outras_desp: toNum(XF.vl_outras_desp),
      vl_pis: toNum(XF.vl_pis), vl_cofins: toNum(XF.vl_cofins),
      vl_fcp_st: toNum(XF.vl_fcp_st), vl_difal_sn: toNum(XF.vl_difal_sn),
      vl_custo: toNum(XF.vl_custo), vl_custo_medio: toNum(XF.vl_custo_medio),
      vl_desconto: toNum(XF.vl_desconto), vl_outro: toNum(XF.vl_outro),
      pc_desconto: toNum(XF.pc_desconto),
      pc_multiplicador: toNum(XF.pc_multiplicador), vl_multiplicador: toNum(XF.vl_multiplicador),
      st_promo: XF.st_promo || "N",
      preco_venda: toNum(XF.preco_venda),
      preco_venda_faturado: toNum(XF.preco_venda_faturado),
      preco_promocional: toNum(XF.preco_promocional),
      preco_promocional_fat: toNum(XF.preco_promocional_fat),
      preco_sugerido: toNum(XF.preco_sugerido),
      pc_markup: toNum(XF.pc_markup),
      altura: toNum(XF.altura), comprimento: toNum(XF.comprimento),
      largura: toNum(XF.largura), area: toNum(XF.area),
      peso_bruto: toNum(XF.peso_bruto), peso_liquido: toNum(XF.peso_liquido),
      controla_estoque: XF.controla_estoque || "S",
    };

    if (XFormMode === "edit" && XCurrentRecord) {
      const { error } = await baseService.atualizar("produto", "produto_id", XCurrentRecord.produto_id, XPayload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    } else {
      const { error } = await baseService.inserir("produto", XPayload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    }

    toast.success(XFormMode === "edit" ? "Produto alterado com sucesso." : "Produto incluído com sucesso.");
    setXFormMode("view");
    await loadData();
  };

  const handleCancelar = () => setXFormMode("view");

  const handleExcluir = async () => {
    if (!XCurrentRecord) return;
    if (!confirm(`Deseja realmente excluir "${XCurrentRecord.nome}"?`)) return;
    await baseService.excluirLogico("produto", "produto_id", XCurrentRecord.produto_id);
    toast.success("Produto excluído com sucesso.");
    await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XData.length - 1);
  const handleRefresh = async () => { await loadData(); await loadLookups(); toast.info("Dados recarregados."); };
  const handleSair = () => { const t = XTabs.find(t => t.id === XActiveTabId); if (t) closeTab(t.id); };


  /* ─── Estoque CRUD ─── */
  const handleEstIncluir = () => {
    setXEstMode("insert");
    setXEstIdx(-1);
    setXEstForm({ deposito_id: "", endereco: "", estoque_minimo: "0", estoque_padrao: "0" });
  };
  const handleEstEditar = () => {
    if (XEstIdx < 0) return;
    const r = XEstoques[XEstIdx];
    setXEstMode("edit");
    setXEstForm({ deposito_id: String(r.deposito_id), endereco: r.endereco || "", estoque_minimo: String(r.estoque_minimo || 0), estoque_padrao: String(r.estoque_padrao || 0) });
  };
  const handleEstSalvar = async () => {
    if (!XCurrentRecord) return;
    if (!XEstForm.deposito_id) { toast.error("Selecione o depósito."); return; }
    const XPay = {
      produto_id: XCurrentRecord.produto_id,
      empresa_id: XEmpresaMatrizId,
      deposito_id: parseInt(XEstForm.deposito_id),
      endereco: XEstForm.endereco.trim(),
      estoque_minimo: parseFloat(XEstForm.estoque_minimo) || 0,
      estoque_padrao: parseFloat(XEstForm.estoque_padrao) || 0,
    };
    if (XEstMode === "edit" && XEstIdx >= 0) {
      const { error } = await db.from("estoque").update({ ...XPay, dt_alteracao: new Date().toISOString() }).eq("estoque_id", XEstoques[XEstIdx].estoque_id);
      if (error) { toast.error("Erro: " + error.message); return; }
    } else {
      const { error } = await db.from("estoque").insert(XPay);
      if (error) { toast.error("Erro: " + error.message); return; }
    }
    toast.success("Estoque salvo.");
    setXEstMode("view");
    loadSubData(XCurrentRecord.produto_id);
  };
  const handleEstExcluir = async () => {
    if (XEstIdx < 0 || !XCurrentRecord) return;
    const r = XEstoques[XEstIdx];
    if ((r.estoque_fisico || 0) !== 0 || (r.estoque_reservado || 0) !== 0) {
      toast.error("Não é possível excluir estoque com quantidade física ou reservada diferente de zero.");
      return;
    }
    if (!confirm("Excluir este registro de estoque?")) return;
    await db.from("estoque").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("estoque_id", r.estoque_id);
    toast.success("Estoque excluído.");
    setXEstIdx(-1);
    loadSubData(XCurrentRecord.produto_id);
  };

  /* ─── Conversão CRUD ─── */
  const handleConvIncluir = () => {
    setXConvMode("insert");
    setXConvIdx(-1);
    setXConvForm({ unidade_id: "", tp_movimento: "", fator_mult: "1" });
  };
  const handleConvEditar = () => {
    if (XConvIdx < 0) return;
    const r = XConversoes[XConvIdx];
    setXConvMode("edit");
    setXConvForm({ unidade_id: r.unidade_id, tp_movimento: r.tp_movimento, fator_mult: String(r.fator_mult) });
  };
  const handleConvSalvar = async () => {
    if (!XCurrentRecord) return;
    const XPay = {
      produto_id: XCurrentRecord.produto_id,
      empresa_id: XEmpresaMatrizId,
      unidade_id: XConvForm.unidade_id,
      tp_movimento: XConvForm.tp_movimento,
      fator_mult: parseFloat(XConvForm.fator_mult) || 1,
    };
    if (XConvMode === "edit" && XConvIdx >= 0) {
      await db.from("produto_conversao").update({ ...XPay, dt_alteracao: new Date().toISOString() }).eq("conversao_id", XConversoes[XConvIdx].conversao_id);
    } else {
      await db.from("produto_conversao").insert(XPay);
    }
    toast.success("Conversão salva.");
    setXConvMode("view");
    loadSubData(XCurrentRecord.produto_id);
  };
  const handleConvExcluir = async () => {
    if (XConvIdx < 0 || !XCurrentRecord) return;
    if (!confirm("Excluir esta conversão?")) return;
    await db.from("produto_conversao").update({ excluido: true }).eq("conversao_id", XConversoes[XConvIdx].conversao_id);
    toast.success("Conversão excluída.");
    setXConvIdx(-1);
    loadSubData(XCurrentRecord.produto_id);
  };

  /* ─── Código de Barras CRUD ─── */
  const handleBarraIncluir = () => {
    setXBarraMode("insert");
    setXBarraIdx(-1);
    setXBarraForm({ cod_barra: "" });
  };
  const handleBarraEditar = () => {
    if (XBarraIdx < 0) return;
    const r = XBarras[XBarraIdx];
    setXBarraMode("edit");
    setXBarraForm({ cod_barra: r.cod_barra || "" });
  };
  const handleBarraSalvar = async () => {
    if (!XCurrentRecord) return;
    if (!XBarraForm.cod_barra.trim()) { toast.error("Informe o código de barras."); return; }
    const XPay = {
      produto_id: XCurrentRecord.produto_id,
      empresa_id: XEmpresaMatrizId,
      cod_barra: XBarraForm.cod_barra.trim(),
    };
    if (XBarraMode === "edit" && XBarraIdx >= 0) {
      await db.from("produto_codbarra").update({ ...XPay, dt_alteracao: new Date().toISOString() }).eq("produto_codbarra_id", XBarras[XBarraIdx].produto_codbarra_id);
    } else {
      await db.from("produto_codbarra").insert(XPay);
    }
    toast.success("Código de barras salvo.");
    setXBarraMode("view");
    loadSubData(XCurrentRecord.produto_id);
  };
  const handleBarraExcluir = async () => {
    if (XBarraIdx < 0 || !XCurrentRecord) return;
    if (!confirm("Excluir este código de barras?")) return;
    await db.from("produto_codbarra").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("produto_codbarra_id", XBarras[XBarraIdx].produto_codbarra_id);
    toast.success("Código de barras excluído.");
    setXBarraIdx(-1);
    loadSubData(XCurrentRecord.produto_id);
  };

  /* ─── Upload foto ─── */
  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `produtos/${XEmpresaMatrizId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Erro no upload: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    set("url_foto", urlData.publicUrl);
    toast.success("Imagem enviada.");
  };

  /* ─── Search filter ─── */
  const XFilteredData = useGridFilter(XEnrichedData, XSearchFilters);

  const handleSelectFromSearch = (row: any) => {
    const idx = XData.findIndex(r => r.produto_id === row.produto_id);
    if (idx >= 0) { setXCurrentIdx(idx); setXInnerTab("cadastro"); setXFormMode("view"); }
  };

  /* ─── Field render helpers ─── */
  const XBgEdit = "bg-card";
  const XBgRead = "bg-secondary";

  const renderReadField = (label: string, value: any, className?: string) => (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type="text" value={value ?? ""} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XBgRead}`} />
    </div>
  );

  const renderEditField = (label: string, key: string, opts?: { required?: boolean; className?: string; readOnly?: boolean; onChange?: (key: string, val: string) => void; align?: string }) => (
    <div className={opts?.className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label} {opts?.required && <span className="text-destructive">*</span>}
      </label>
      <input
        type="text"
        value={XF[key] || ""}
        onChange={(e) => opts?.onChange ? opts.onChange(key, e.target.value.toUpperCase()) : set(key, e.target.value.toUpperCase())}
        readOnly={opts?.readOnly}
        className={`w-full border border-border rounded px-3 py-1.5 text-sm ${opts?.readOnly ? XBgRead : XBgEdit} focus:ring-2 focus:ring-ring outline-none ${opts?.align === "right" ? "text-right" : ""}`}
      />
    </div>
  );

  const renderField = (label: string, key: string, opts?: { required?: boolean; className?: string; readOnly?: boolean; onChange?: (key: string, val: string) => void; align?: string }) => {
    if (XIsEditing) return renderEditField(label, key, opts);
    const val = XCurrentRecord ? (XCurrentRecord as any)[key] : "";
    return renderReadField(label, val, opts?.className);
  };

  const renderNumField = (label: string, key: string, opts?: { readOnly?: boolean; className?: string; decimals?: number }) => {
    const dec = opts?.decimals ?? 2;
    if (XIsEditing) {
      return (
        <div className={opts?.className}>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
          <input
            type="text"
            value={XF[key] || "0"}
            onChange={(e) => handleCostFieldChange(key, e.target.value)}
            onFocus={(e) => e.target.select()}
            readOnly={opts?.readOnly}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${opts?.readOnly ? XBgRead : XBgEdit} focus:ring-2 focus:ring-ring outline-none`}
          />
        </div>
      );
    }
    const val = XCurrentRecord ? Number((XCurrentRecord as any)[key] || 0) : 0;
    return renderReadField(label, fmtBR(val, dec), opts?.className);
  };

  const renderSelect = (label: string, key: string, items: { v: string; l: string }[]) => {
    if (!XIsEditing) {
      const d = items.find(i => i.v === (XCurrentRecord as any)?.[key])?.l || (XCurrentRecord as any)?.[key] || "";
      return renderReadField(label, d);
    }
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <Select value={XF[key] || ""} onValueChange={(v) => set(key, v)}>
          <SelectTrigger className={`h-[34px] text-sm ${XBgEdit}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {items.filter(i => i.v !== "").map(i => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLookup = (label: string, key: string, items: any[], valueKey: string, labelKey: string) => {
    if (!XIsEditing) {
      const id = XCurrentRecord ? (XCurrentRecord as any)[key] : null;
      const item = items.find((i: any) => i[valueKey] === id);
      return renderReadField(label, item ? item[labelKey] : "");
    }
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <Select value={XF[key] || "__none__"} onValueChange={(v) => set(key, v === "__none__" ? "" : v)}>
          <SelectTrigger className={`h-[34px] text-sm ${XBgEdit}`}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Nenhum —</SelectItem>
            {items.filter((i: any) => String(i[valueKey] ?? "") !== "").map((i: any) => <SelectItem key={i[valueKey]} value={String(i[valueKey])}>{i[labelKey]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  /* ─── Cost row pair (percentage + R$) — both editable, raw value during edit ─── */
  const renderCostRow = (labelPc: string, pcKey: string, vlKey: string) => (
    <>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{labelPc}</label>
        <input
          type="text"
          value={XIsEditing ? (XF[pcKey] || "0") : fmtBR(XCurrentRecord ? Number((XCurrentRecord as any)[pcKey] || 0) : 0, 4)}
          onChange={(e) => handleCostFieldChange(pcKey, e.target.value)}
          onFocus={(e) => e.target.select()}
          readOnly={!XIsEditing}
          className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${XIsEditing ? XBgEdit : XBgRead} focus:ring-2 focus:ring-ring outline-none`}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">R$</label>
        <input
          type="text"
          value={XIsEditing ? (XF[vlKey] || "0") : fmtBR(XCurrentRecord ? Number((XCurrentRecord as any)[vlKey] || 0) : 0, 2)}
          onChange={(e) => handleCostFieldChange(vlKey, e.target.value)}
          onFocus={(e) => e.target.select()}
          readOnly={!XIsEditing}
          className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${XIsEditing ? XBgEdit : XBgRead} focus:ring-2 focus:ring-ring outline-none`}
        />
      </div>
    </>
  );

  /* ─── Sub-tabs configuration ─── */
  const XSubTabs = ["cadastro", "estoques", "codbarras", "tributacoes", "custo", "adicionais"];
  const XSubTabLabels: Record<string, string> = {
    cadastro: "Cadastro", estoques: "Estoques", codbarras: "Código de Barras",
    tributacoes: "Tributações", custo: "Formação do Custo da Compra", adicionais: "Dados Adicionais",
  };

  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
      <FormToolbar
        XIsEditing={XIsEditing}
        XHasRecord={!!XCurrentRecord}
        XIsFirst={XCurrentIdx === 0}
        XIsLast={XCurrentIdx >= XData.length - 1}
        onIncluir={handleIncluir}
        onEditar={handleEditar}
        onSalvar={handleSalvar}
        onCancelar={handleCancelar}
        onExcluir={handleExcluir}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={handleRefresh}
        onLocalizar={() => setXInnerTab("localizar")}
        onSair={handleSair}
      />

      {/* Main tabs: Produto / Localizar */}
      <div className="flex border-b border-border bg-card">
        {(["cadastro", "localizar"] as const).map(t => (
          <button key={t}
            className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setXInnerTab(t)}
          >
            {t === "cadastro" ? "Produtos" : "Localizar"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-3">
            {/* Header: Código + Descrição + Status */}
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-28">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={XFormMode === "insert" ? "(Novo)" : XCurrentRecord?.produto_id ?? ""} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XBgRead} text-right`} />
              </div>
              <div className="w-full md:w-[13.5rem]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input type="text" value={(() => { const em = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId); return em ? `${em.empresa_id} - ${em.identificacao}` : String(XEmpresaMatrizId); })()} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XBgRead}`} />
              </div>
              <div className="flex-1">{renderField("Descrição", "nome", { required: true })}</div>
              <div className="w-full md:w-40">
                {renderSelect("Tipo do Item", "tp_produto", [
                  { v: "PA", l: "Produto" }, { v: "MP", l: "Matéria Prima" }, { v: "ME", l: "Mercadoria" },
                  { v: "SV", l: "Serviço" }, { v: "EM", l: "Embalagem" },
                ])}
              </div>
              <div className="w-full md:w-28 flex items-end pb-0.5 gap-2">
                {XIsEditing ? (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={XF.ativo === "S"}
                      onCheckedChange={(c) => set("ativo", c ? "S" : "N")}
                    />
                    ATIVO
                  </label>
                ) : (
                  <span className={`text-sm font-medium ${XCurrentRecord?.ativo === "S" ? "text-success" : "text-destructive"}`}>
                    {XCurrentRecord?.ativo === "S" ? "✓ ATIVO" : "✗ INATIVO"}
                  </span>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-border flex-wrap">
              {XSubTabs.map(t => (
                <button key={t}
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 ${XSubTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setXSubTab(t)}
                >
                  {XSubTabLabels[t]}
                </button>
              ))}
            </div>

            {/* ══════ ABA CADASTRO ══════ */}
            {XSubTab === "cadastro" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderLookup("Grupo", "produto_grupo_id", XGrupos, "produto_grupo_id", "nome")}
                  {renderLookup("Subgrupo", "produto_subgrupo_id", XFilteredSubgrupos, "produto_subgrupo_id", "nome")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderLookup("Linha do Produto", "linha_id", XLinhas, "linha_id", "nome")}
                  {renderLookup("Unidade (Padrão)", "unidade_id", XUnidades, "unidade_id", "descricao")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderField("Nome Reduzido", "nome_reduzido")}
                  {renderField("GTIN", "gtin")}
                  {renderField("Referência", "referencia")}
                </div>
                {/* E-commerce fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField("Nome E-commerce", "nm_ecommerce")}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">URL Foto</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={XIsEditing ? (XF.url_foto || "") : (XCurrentRecord?.url_foto || "")}
                        onChange={(e) => set("url_foto", e.target.value)}
                        readOnly={!XIsEditing}
                        className={`flex-1 border border-border rounded px-3 py-1.5 text-sm ${XIsEditing ? XBgEdit : XBgRead} focus:ring-2 focus:ring-ring outline-none`}
                      />
                      {XIsEditing && (
                        <label className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm cursor-pointer hover:opacity-90 flex items-center gap-1">
                          <Upload size={14} />
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={handleUploadFoto} />
                        </label>
                      )}
                    </div>
                    {(XIsEditing ? XF.url_foto : XCurrentRecord?.url_foto) && (
                      <img src={XIsEditing ? XF.url_foto : XCurrentRecord?.url_foto} alt="Foto" className="mt-2 max-h-24 rounded border border-border" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição E-commerce</label>
                  <textarea
                    value={XIsEditing ? (XF.ds_ecommerce || "") : (XCurrentRecord?.ds_ecommerce || "")}
                    onChange={(e) => set("ds_ecommerce", e.target.value)}
                    readOnly={!XIsEditing}
                    rows={3}
                    className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XIsEditing ? XBgEdit : XBgRead} focus:ring-2 focus:ring-ring outline-none`}
                  />
                </div>
              </div>
            )}

            {/* ══════ ABA ESTOQUES ══════ */}
            {XSubTab === "estoques" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 mb-2">
                  <ToolbarBtn icon={<Plus size={14} />} label="Incluir" onClick={handleEstIncluir} color="success" disabled={!XCurrentRecord} />
                  <ToolbarBtn icon={<SquarePen size={14} />} label="Editar" onClick={handleEstEditar} disabled={XEstIdx < 0} />
                  <ToolbarBtn icon={<Trash2 size={14} />} label="Excluir" onClick={handleEstExcluir} disabled={XEstIdx < 0} color="destructive" />
                  <ToolbarBtn icon={<RefreshCw size={14} />} label="Recarregar" onClick={() => XCurrentRecord && loadSubData(XCurrentRecord.produto_id)} />
                  <ToolbarBtn icon={<Filter size={14} />} label="Filtrar" onClick={() => setXEstShowFilters(!XEstShowFilters)} />
                </div>

                {XEstMode !== "view" && (
                  <div className="grid grid-cols-[1fr_120px_100px_100px_auto] gap-2 mb-2 items-end">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Depósito *</label>
                      <Select value={XEstForm.deposito_id || "__none__"} onValueChange={v => setXEstForm(p => ({ ...p, deposito_id: v === "__none__" ? "" : v }))}>
                        <SelectTrigger className="h-[30px] text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {XDepositos.map((d: any) => <SelectItem key={d.deposito_id} value={String(d.deposito_id)}>{d.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Endereço</label>
                      <input type="text" value={XEstForm.endereco} onChange={e => setXEstForm(p => ({ ...p, endereco: e.target.value }))}
                        className={`w-full border border-border rounded px-2 py-1 text-sm ${XBgEdit} focus:ring-2 focus:ring-ring outline-none`} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Est. Mín.</label>
                      <input type="text" value={XEstForm.estoque_minimo} onChange={e => setXEstForm(p => ({ ...p, estoque_minimo: e.target.value }))}
                        className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${XBgEdit} focus:ring-2 focus:ring-ring outline-none`} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Est. Padrão</label>
                      <input type="text" value={XEstForm.estoque_padrao} onChange={e => setXEstForm(p => ({ ...p, estoque_padrao: e.target.value }))}
                        className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${XBgEdit} focus:ring-2 focus:ring-ring outline-none`} />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={handleEstSalvar} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">Salvar</button>
                      <button onClick={() => setXEstMode("view")} className="px-2 py-1 text-xs bg-muted rounded">Cancelar</button>
                    </div>
                  </div>
                )}

                <DataGrid
                  columns={XEstoqueGridCols}
                  data={XEstoques}
                  selectedIdx={XEstIdx}
                  onRowClick={(_, idx) => setXEstIdx(idx)}
                  onRowDoubleClick={(_, idx) => {
                    setXEstIdx(idx);
                    const r = XEstoques[idx];
                    if (r) {
                      setXEstMode("edit");
                      setXEstForm({ deposito_id: String(r.deposito_id), endereco: r.endereco || "", estoque_minimo: String(r.estoque_minimo || 0), estoque_padrao: String(r.estoque_padrao || 0) });
                    }
                  }}
                  maxHeight="300px"
                  showFilters={XEstShowFilters}
                  filterValues={XEstFilterValues}
                  onFilterChange={(key, val) => setXEstFilterValues(prev => ({ ...prev, [key]: val }))}
                  exportTitle="Estoques"
                />
                {XEstoques.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">Não existem dados a serem exibidos</div>
                )}
              </div>
            )}

            {/* ══════ ABA CÓDIGO DE BARRAS ══════ */}
            {XSubTab === "codbarras" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 mb-2">
                  <ToolbarBtn icon={<Plus size={14} />} label="Incluir" onClick={handleBarraIncluir} color="success" disabled={!XCurrentRecord} />
                  <ToolbarBtn icon={<SquarePen size={14} />} label="Editar" onClick={handleBarraEditar} disabled={XBarraIdx < 0} />
                  <ToolbarBtn icon={<Trash2 size={14} />} label="Excluir" onClick={handleBarraExcluir} disabled={XBarraIdx < 0} color="destructive" />
                  <ToolbarBtn icon={<RefreshCw size={14} />} label="Recarregar" onClick={() => XCurrentRecord && loadSubData(XCurrentRecord.produto_id)} />
                  <ToolbarBtn icon={<Filter size={14} />} label="Filtrar" onClick={() => setXBarraShowFilters(!XBarraShowFilters)} />
                </div>

                {XBarraMode !== "view" && (
                  <div className="grid grid-cols-[1fr_auto] gap-2 mb-2 items-end">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Código de Barras *</label>
                      <input
                        type="text"
                        value={XBarraForm.cod_barra}
                        onChange={e => setXBarraForm(p => ({ ...p, cod_barra: e.target.value }))}
                        className={`w-full border border-border rounded px-2 py-1 text-sm ${XBgEdit} focus:ring-2 focus:ring-ring outline-none`}
                        onKeyDown={(e) => { if (e.key === "Enter") handleBarraSalvar(); if (e.key === "Escape") setXBarraMode("view"); }}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={handleBarraSalvar} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">Salvar</button>
                      <button onClick={() => setXBarraMode("view")} className="px-2 py-1 text-xs bg-muted rounded">Cancelar</button>
                    </div>
                  </div>
                )}

                <DataGrid
                  columns={XBarraGridCols}
                  data={XBarras}
                  selectedIdx={XBarraIdx}
                  onRowClick={(_, idx) => setXBarraIdx(idx)}
                  onRowDoubleClick={(_, idx) => {
                    setXBarraIdx(idx);
                    const r = XBarras[idx];
                    if (r) { setXBarraMode("edit"); setXBarraForm({ cod_barra: r.cod_barra || "" }); }
                  }}
                  maxHeight="300px"
                  showFilters={XBarraShowFilters}
                  filterValues={XBarraFilterValues}
                  onFilterChange={(key, val) => setXBarraFilterValues(prev => ({ ...prev, [key]: val }))}
                  exportTitle="Códigos de Barras"
                />
                {XBarras.length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-4">Não existem dados a serem exibidos</div>
                )}
              </div>
            )}

            {/* ══════ ABA TRIBUTAÇÕES ══════ */}
            {XSubTab === "tributacoes" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {renderSelect("Origem", "tb_a_origem", [
                    { v: "", l: "Selecione..." }, { v: "0", l: "Nacional" }, { v: "1", l: "Estrangeira - Importação Direta" },
                    { v: "2", l: "Estrangeira - Adq. Mercado Interno" }, { v: "3", l: "Nacional - Conteúdo >40%" },
                    { v: "4", l: "Nacional - Processos Básicos" }, { v: "5", l: "Nacional - Conteúdo <40%" },
                    { v: "6", l: "Estrangeira - Importação S/Similar" }, { v: "7", l: "Estrangeira - Adq. S/Similar" },
                    { v: "8", l: "Nacional - Conteúdo >70%" },
                  ])}
                  {renderField("GTIN", "gtin")}
                  {renderField("NCM", "ncm")}
                  {renderField("CEST", "cest")}
                  {renderField("MVA (%)", "mva", { align: "right" })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderLookup("Grupo ICMS", "grupo_icms_id", XGrupoIcms, "grupo_icms_id", "descricao")}
                  {renderLookup("Grupo IPI", "grupo_ipi_id", XGrupoIpi, "grupo_ipi_id", "descricao")}
                  {renderLookup("Grupo PIS/COFINS", "grupo_pis_cofins_id", XGrupoPisCofins, "grupo_pis_cofins_id", "descricao")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderLookup("Grupo IBS/CBS", "grupo_ibscbs_id", XGrupoIbsCbs, "grupo_ibscbs_id", "descricao")}
                </div>
              </div>
            )}

            {/* ══════ ABA FORMAÇÃO DO CUSTO DA COMPRA ══════ */}
            {XSubTab === "custo" && (
              <div className="space-y-4">
                <fieldset className="border border-border rounded p-3">
                  <legend className="text-xs font-medium text-muted-foreground px-2">Formação de Custo da Compra</legend>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {renderNumField("Valor de Compra (R$)", "vl_compra")}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-x-3 gap-y-2 items-end">
                    {renderCostRow("IPI (%)", "pc_ipi", "vl_ipi")}
                    {renderCostRow("Subst. Trib. (%)", "pc_st_trib", "vl_st")}
                    {renderCostRow("Frete (%)", "pc_frete", "vl_frete")}
                    {renderCostRow("Outras Desp. (%)", "pc_outras_desp", "vl_outras_desp")}
                    {renderCostRow("ICMS Créd. (%)", "pc_icms_cred", "vl_icms_cred")}
                    {renderCostRow("PIS (%)", "pc_pis", "vl_pis")}
                    {renderCostRow("IPI Crédito (%)", "pc_ipi_cred", "vl_ipi_cred")}
                    {renderCostRow("COFINS (%)", "pc_cofins", "vl_cofins")}
                    {renderCostRow("Embalagem (%)", "pc_emb", "vl_emb")}
                    {renderCostRow("FCP ST (%)", "pc_fcp_st", "vl_fcp_st")}
                    {renderCostRow("Seguro (%)", "pc_seguro", "vl_seguro")}
                    {renderCostRow("Difal Simples (%)", "pc_difal_sn", "vl_difal_sn")}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 mt-4 items-end">
                    {renderNumField("Vl. Custo", "vl_custo", { readOnly: true })}
                    {renderCostRow("Markup (%)", "pc_multiplicador", "vl_multiplicador")}
                    {renderNumField("Vl. Sug. Venda", "preco_sugerido", { readOnly: true })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {renderNumField("Vl. Venda", "preco_venda")}
                  {renderNumField("Vl. Venda Fat.", "preco_venda_faturado")}
                  {renderSelect("Promo", "st_promo", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderNumField("Vl. Promo Av.", "preco_promocional")}
                  {renderNumField("Vl. Promo Prz.", "preco_promocional_fat")}
                </div>
              </div>
            )}

            {/* ══════ ABA DADOS ADICIONAIS ══════ */}
            {XSubTab === "adicionais" && (
              <div className="space-y-4">
                <fieldset className="border border-border rounded p-3">
                  <legend className="text-xs font-medium text-muted-foreground px-2">Detalhes</legend>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {renderNumField("Altura (m)", "altura")}
                    {renderNumField("Comprimento (m)", "comprimento")}
                    {renderNumField("Largura (m)", "largura")}
                    {renderNumField("Área (m²)", "area")}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {renderNumField("Peso Bruto", "peso_bruto")}
                    {renderNumField("Peso Líquido", "peso_liquido")}
                  </div>
                </fieldset>

                {/* Fatores de Conversão */}
                <fieldset className="border border-border rounded p-3">
                  <legend className="text-xs font-medium text-muted-foreground px-2">Fatores de Conversão</legend>
                  <div className="flex items-center gap-1 mb-2">
                    <ToolbarBtn icon={<Plus size={14} />} label="Incluir" onClick={handleConvIncluir} color="success" disabled={!XCurrentRecord} />
                    <ToolbarBtn icon={<SquarePen size={14} />} label="Editar" onClick={handleConvEditar} disabled={XConvIdx < 0} />
                    <ToolbarBtn icon={<Trash2 size={14} />} label="Excluir" onClick={handleConvExcluir} disabled={XConvIdx < 0} color="destructive" />
                    <ToolbarBtn icon={<RefreshCw size={14} />} label="Recarregar" onClick={() => XCurrentRecord && loadSubData(XCurrentRecord.produto_id)} />
                  </div>

                  {XConvMode !== "view" && (
                    <div className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 mb-2 items-end">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Unidade</label>
                        <Select value={XConvForm.unidade_id || "__none__"} onValueChange={v => setXConvForm(p => ({ ...p, unidade_id: v === "__none__" ? "" : v }))}>
                          <SelectTrigger className="h-[30px] text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            {XUnidades.filter((u: any) => u.unidade_id && u.unidade_id !== "").map((u: any) => <SelectItem key={u.unidade_id} value={u.unidade_id}>{u.descricao}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Tipo Movimento</label>
                        <Select value={XConvForm.tp_movimento || "__none__"} onValueChange={v => setXConvForm(p => ({ ...p, tp_movimento: v === "__none__" ? "" : v }))}>
                          <SelectTrigger className="h-[30px] text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">—</SelectItem>
                            <SelectItem value="Saida por Venda">Saída por Venda</SelectItem>
                            <SelectItem value="Entrada por Compra">Entrada por Compra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Fator</label>
                        <input type="text" value={XConvForm.fator_mult} onChange={e => setXConvForm(p => ({ ...p, fator_mult: e.target.value }))}
                          className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${XBgEdit} focus:ring-2 focus:ring-ring outline-none`} />
                      </div>
                      <div className="flex gap-1">
                        <button onClick={handleConvSalvar} className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded">Salvar</button>
                        <button onClick={() => setXConvMode("view")} className="px-2 py-1 text-xs bg-muted rounded">Cancelar</button>
                      </div>
                    </div>
                  )}

                  <DataGrid
                    columns={XConvGridCols}
                    data={XConversoes}
                    selectedIdx={XConvIdx}
                    onRowClick={(_, idx) => setXConvIdx(idx)}
                    maxHeight="200px"
                  />
                </fieldset>
              </div>
            )}
          </div>
        ) : (
          /* ══════ ABA LOCALIZAR ══════ */
          <div className="space-y-2">
            <DataGrid
              columns={XLocalizarColumns}
              data={XFilteredData}
              selectedIdx={-1}
              onRowClick={handleSelectFromSearch}
              maxHeight="calc(100vh - 220px)"
              showFilters
              filterValues={XSearchFilters}
              onFilterChange={(key, val) => setXSearchFilters(prev => ({ ...prev, [key]: val }))}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProdutoForm;
