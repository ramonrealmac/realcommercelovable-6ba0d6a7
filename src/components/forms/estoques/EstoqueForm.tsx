import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Plus, Save, Pencil, Trash2, RefreshCw, Search, Filter,
  HelpCircle, LogOut, List, X
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { baseService } from "@/utils/baseService";
import ProdutoSearchDialog from "@/components/forms/pedido/ProdutoSearchDialog";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

const db = supabase as any;

interface IEstoque {
  estoque_id: number;
  produto_id: number;
  deposito_id: number;
  endereco: string;
  estoque_fisico: number;
  estoque_reservado: number;
  estoque_disponivel: number;
  estoque_minimo: number;
  estoque_padrao: number;
  estoque_inventario: number;
  empresa_id: number;
}

interface IProduto {
  produto_id: number;
  nome: string;
  cd_produto?: number | null;
  descricao?: string;
}

interface IDeposito {
  deposito_id: number;
  nome: string;
  empresa_id: number;
  st_privado: boolean;
  endereco: string;
}

const EstoqueForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XEstoques, setXEstoques] = useState<IEstoque[]>([]);
  const [XProdutos, setXProdutos] = useState<IProduto[]>([]);
  const [XDepositos, setXDepositos] = useState<IDeposito[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSelectedEstoque, setXSelectedEstoque] = useState<IEstoque | null>(null);
  const [XEditingEstoque, setXEditingEstoque] = useState<IEstoque | null>(null);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XShowFilters, setXShowFilters] = useState(true);
  const [XEditMode, setXEditMode] = useState<"none" | "insert" | "edit">("none");

  const [XEditProdutoId, setXEditProdutoId] = useState<number | "">("");
  const [XEditProdutoCd, setXEditProdutoCd] = useState<string>("");
  const [XEditProdutoNome, setXEditProdutoNome] = useState("");
  const [XOpenProduto, setXOpenProduto] = useState(false);
  const [XEditDepositoId, setXEditDepositoId] = useState<number | "">("");
  const [XEditEndereco, setXEditEndereco] = useState("");
  const [XEditEstoqueMinimo, setXEditEstoqueMinimo] = useState(0);
  const [XEditEstoquePadrao, setXEditEstoquePadrao] = useState(0);
  const [XEditEstoqueInventario, setXEditEstoqueInventario] = useState(0);

  const depositoRef = useRef<HTMLSelectElement>(null);
  const enderecoRef = useRef<HTMLInputElement>(null);
  const minimoRef = useRef<HTMLInputElement>(null);
  const padraoRef = useRef<HTMLInputElement>(null);
  const inventarioRef = useRef<HTMLInputElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);

  const [XQtDecimais, setXQtDecimais] = useState<number>(2);

  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      try {
        const { data } = await db.from("empresa")
          .select("qt_venda_qt_decimais")
          .eq("empresa_id", XEmpresaId)
          .maybeSingle();
        if (data && data.qt_venda_qt_decimais != null) {
          setXQtDecimais(Number(data.qt_venda_qt_decimais));
        }
      } catch (e) {
        console.warn("Falha ao obter casas decimais da empresa:", e);
      }
    })();
  }, [XEmpresaId]);

  /* ─── Group empresa IDs (same empresa_matriz_id) ─── */
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

  const loadData = useCallback(async () => {
    const XIds = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
    
    // 1. Fetch stock and deposit records first
    const XEstData: IEstoque[] = [];
    let from = 0;
    const step = 1000;
    try {
      while (true) {
        const { data, error } = await db
          .from("estoque")
          .select("*")
          .in("empresa_id", XIds)
          .eq("excluido", false)
          .order("estoque_id")
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        XEstData.push(...data);
        if (data.length < step) break;
        from += step;
      }
    } catch (err) {
      console.error("Erro ao carregar registros de estoque:", err);
    }

    let XDepData: IDeposito[] = [];
    try {
      const { data } = await db
        .from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado, endereco")
        .in("empresa_id", XIds)
        .eq("excluido", false)
        .order("nome");
      if (data) XDepData = data;
    } catch (err) {
      console.error("Erro ao carregar depósitos:", err);
    }

    // Filter deposits: include all deposits (remove private filter)
    const XFilteredDeps = XDepData;
    // Filter estoques to only show those in visible deposits
    const XVisibleDepIds = new Set(XFilteredDeps.map((d: IDeposito) => d.deposito_id));
    const XFilteredEst = (XEstData || []).filter((e: IEstoque) => XVisibleDepIds.has(e.deposito_id));

    // 2. Extract unique product IDs from stock records to ensure they are loaded regardless of query limits
    const XEstProdIds = [...new Set(XFilteredEst.map((e: IEstoque) => e.produto_id).filter(Boolean))];

    // 3. Fetch referenced products in chunks of 150 (avoids URL size limit errors) AND the first 1000 products by name
    const XProdEstDataList: IProduto[] = [];
    const chunkSize = 150;
    for (let i = 0; i < XEstProdIds.length; i += chunkSize) {
      const chunk = XEstProdIds.slice(i, i + chunkSize);
      try {
        const { data } = await db
          .from("produto")
          .select("produto_id, nome, cd_produto, descricao")
          .in("produto_id", chunk);
        if (data) XProdEstDataList.push(...data);
      } catch (err) {
        console.error("Erro ao carregar lote de produtos do estoque:", err);
      }
    }

    let XProdRecentData: IProduto[] = [];
    try {
      const { data } = await db
        .from("produto")
        .select("produto_id, nome, cd_produto, descricao")
        .eq("empresa_id", XEmpresaMatrizId)
        .eq("excluido", false)
        .order("nome")
        .limit(1000);
      if (data) XProdRecentData = data;
    } catch (err) {
      console.error("Erro ao carregar produtos recentes:", err);
    }

    // 4. Merge products to remove duplicates
    const XMergedProdsMap = new Map<number, IProduto>();
    (XProdRecentData || []).forEach((p: IProduto) => XMergedProdsMap.set(p.produto_id, p));
    XProdEstDataList.forEach((p: IProduto) => XMergedProdsMap.set(p.produto_id, p));
    const XMergedProds = Array.from(XMergedProdsMap.values());

    setXEstoques(XFilteredEst);
    setXProdutos(XMergedProds);
    setXDepositos(XFilteredDeps);
    console.log('Debug: Loaded Depositos', XFilteredDeps);
    console.log('Debug: Loaded Estoques count', XFilteredEst.length);
  }, [XEmpresaId, XEmpresaMatrizId, XGroupEmpresaIds]);

  useEffect(() => {
    loadData();
    setXSelectedIdx(null);
    setXSelectedEstoque(null);
    setXEditingEstoque(null);
    setXEditMode("none");
  }, [XEmpresaId, loadData]);

  const XProdutoCdMap = useMemo(() => {
    const m: Record<number, string | number> = {};
    XProdutos.forEach(p => { m[p.produto_id] = p.cd_produto ?? p.produto_id; });
    return m;
  }, [XProdutos]);

  const XProdutoDescMap = useMemo(() => {
    const m: Record<number, string> = {};
    XProdutos.forEach(p => { m[p.produto_id] = p.descricao || p.nome || ""; });
    return m;
  }, [XProdutos]);

  const XDepositoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XDepositos.forEach(d => { m[d.deposito_id] = d.nome; });
    return m;
  }, [XDepositos]);

  const XDepositoEnderecoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XDepositos.forEach(d => { m[d.deposito_id] = d.endereco || ""; });
    return m;
  }, [XDepositos]);

  const fmtQty = useCallback((v: number) => {
    return Number(v || 0).toLocaleString("pt-BR", { 
      minimumFractionDigits: XQtDecimais, 
      maximumFractionDigits: XQtDecimais 
    });
  }, [XQtDecimais]);

  const XColumns: IGridColumn[] = useMemo(() => [
    {
      key: "cd_codigo", label: "Código", width: "120px",
      render: (r: IEstoque) => XProdutoCdMap[r.produto_id] ?? "",
      getValue: (r: IEstoque) => XProdutoCdMap[r.produto_id] ?? "",
    },
    {
      key: "descricao", label: "Descrição", width: "1.5fr",
      render: (r: IEstoque) => XProdutoDescMap[r.produto_id] ?? "",
      getValue: (r: IEstoque) => XProdutoDescMap[r.produto_id] ?? "",
    },
    {
      key: "empresa_nome", label: "Empresa", width: "160px",
      render: (r: IEstoque) => XEmpresaMap[r.empresa_id] || String(r.empresa_id),
      getValue: (r: IEstoque) => XEmpresaMap[r.empresa_id] || "",
    },
    {
      key: "deposito_nome", label: "Depósito", width: "160px",
      render: (r: IEstoque) => XDepositoMap[r.deposito_id] || "",
      getValue: (r: IEstoque) => XDepositoMap[r.deposito_id] || "",
    },
    {
      key: "endereco", label: "Endereço", width: "120px",
      render: (r: IEstoque) => XDepositoEnderecoMap[r.deposito_id] || r.endereco || "",
      getValue: (r: IEstoque) => XDepositoEnderecoMap[r.deposito_id] || r.endereco || "",
    },
    { 
      key: "estoque_fisico", label: "Físico", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_fisico),
      getValue: (r: IEstoque) => fmtQty(r.estoque_fisico)
    },
    { 
      key: "estoque_reservado", label: "Reservado", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_reservado),
      getValue: (r: IEstoque) => fmtQty(r.estoque_reservado)
    },
    { 
      key: "estoque_disponivel", label: "Disponível", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_disponivel),
      getValue: (r: IEstoque) => fmtQty(r.estoque_disponivel)
    },
    { 
      key: "estoque_minimo", label: "Mínimo", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_minimo),
      getValue: (r: IEstoque) => fmtQty(r.estoque_minimo)
    },
    { 
      key: "estoque_padrao", label: "Padrão", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_padrao),
      getValue: (r: IEstoque) => fmtQty(r.estoque_padrao)
    },
    { 
      key: "estoque_inventario", label: "Inventário", width: "95px", align: "right" as const,
      render: (r: IEstoque) => fmtQty(r.estoque_inventario),
      getValue: (r: IEstoque) => fmtQty(r.estoque_inventario)
    },
  ], [XProdutoCdMap, XProdutoDescMap, XDepositoMap, XEmpresaMap, XDepositoEnderecoMap, fmtQty]);

  // Determine if there is any active filter value
  const hasActiveFilters = useMemo(() => {
    return Object.values(XFilterValues).some(v => v !== undefined && v !== null && v.trim().length > 0);
  }, [XFilterValues]);

  // Keep custom filter for estoque since it uses getValue/render
  const XFiltered = useMemo(() => {
    if (!hasActiveFilters) return [];

    // Check if any active alphabetical filter has less than 3 characters
    for (const col of XColumns) {
      const fv = (XFilterValues[col.key] || "").trim();
      if (!fv) continue;

      const k = col.key.toLowerCase();
      const l = typeof col.label === "string" ? col.label.toLowerCase() : "";
      const isNumericCode =
        k === "codigo" ||
        k === "cd_codigo" ||
        k === "cd_produto" ||
        k === "cd_cadastro" ||
        k === "produto_id" ||
        k === "cadastro_id" ||
        k === "deposito_id" ||
        k.startsWith("cd_") ||
        (k.endsWith("_id") && k !== "unidade_id") ||
        l.includes("código") ||
        l.includes("cód.");

      const isNumericValue = [
        "estoque_fisico",
        "estoque_reservado",
        "estoque_disponivel",
        "estoque_minimo",
        "estoque_padrao",
        "estoque_inventario"
      ].includes(col.key);

      const isAlphabetical = !isNumericCode && !isNumericValue;

      if (isAlphabetical && fv.length < 3) {
        return [];
      }
    }

    return XEstoques.filter(e => {
      for (const col of XColumns) {
        const fv = XFilterValues[col.key] || "";
        if (!fv) continue;
        let val = "";
        if (col.getValue) val = String(col.getValue(e));
        else if (col.render) val = String(col.render(e));
        else val = String((e as any)[col.key] ?? "");

        const normalizedVal = val.toLowerCase().trim();
        const normalizedFv = fv.toLowerCase().trim();

        const k = col.key.toLowerCase();
        const l = typeof col.label === "string" ? col.label.toLowerCase() : "";
        const isNumericCode =
          k === "codigo" ||
          k === "cd_codigo" ||
          k === "cd_produto" ||
          k === "cd_cadastro" ||
          k === "produto_id" ||
          k === "cadastro_id" ||
          k === "deposito_id" ||
          k.startsWith("cd_") ||
          (k.endsWith("_id") && k !== "unidade_id") ||
          l.includes("código") ||
          l.includes("cód.");

        if (isNumericCode) {
          if (normalizedVal !== normalizedFv) return false;
        } else {
          if (!normalizedVal.startsWith(normalizedFv)) return false;
        }
      }
      return true;
    });
  }, [XEstoques, XFilterValues, XColumns, hasActiveFilters]);

  const handleIncluir = () => {
    setXEditMode("insert");
    setXEditProdutoId("");
    setXEditProdutoCd("");
    setXEditProdutoNome("");
    setXEditDepositoId("");
    setXEditEndereco("");
    setXEditEstoqueMinimo(0);
    setXEditEstoquePadrao(0);
    setXEditEstoqueInventario(0);
  };

  const startEditing = useCallback(async (row: IEstoque) => {
    if (!row) return;

    // Try to get cd_produto from XProdutos first
    const product = XProdutos.find(p => p.produto_id === row.produto_id);
    let cd_produto = product?.cd_produto;

    // Fallback: fetch product details from database if not cached
    if (cd_produto === undefined || cd_produto === null) {
      try {
        const { data: fallbackProd } = await db
          .from("produto")
          .select("cd_produto")
          .eq("produto_id", row.produto_id)
          .maybeSingle();
        cd_produto = fallbackProd?.cd_produto;
      } catch (e) {
        console.error("Error fetching fallback product:", e);
      }
    }

    if (cd_produto === undefined || cd_produto === null) {
      toast.error("Produto nao cadastrado no estoque!");
      return;
    }

    try {
      // 1. Fetch the product ID for the active company and product code
      const { data: prodData, error: prodError } = await db
        .from("produto")
        .select("produto_id")
        .eq("empresa_id", XEmpresaId)
        .eq("cd_produto", cd_produto)
        .eq("excluido", false)
        .maybeSingle();

      if (prodError) throw prodError;
      if (!prodData) {
        toast.error("Produto nao cadastrado no estoque!");
        return;
      }

      // 2. Fetch the estoque record for that product_id, selected deposit, and active company
      const { data: estData, error: estError } = await db
        .from("estoque")
        .select("*")
        .eq("produto_id", prodData.produto_id)
        .eq("deposito_id", row.deposito_id)
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .maybeSingle();

      if (estError) throw estError;
      if (!estData) {
        toast.error("Produto nao cadastrado no estoque!");
        return;
      }

      // 3. Set state to enter edit mode with the retrieved record
      setXEditMode("edit");
      setXEditingEstoque(estData);
      setXEditProdutoId(estData.produto_id);
      
      const product = XProdutos.find(p => p.produto_id === estData.produto_id);
      setXEditProdutoCd(product ? String(product.cd_produto || "") : "");
      setXEditProdutoNome(product ? product.nome || "" : "");

      setXEditDepositoId(estData.deposito_id);
      setXEditEndereco(estData.endereco || "");
      setXEditEstoqueMinimo(estData.estoque_minimo ?? 0);
      setXEditEstoquePadrao(estData.estoque_padrao ?? 0);
      setXEditEstoqueInventario(estData.estoque_inventario ?? 0);

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      toast.error("Erro ao carregar dados para edição: " + errMsg);
    }
  }, [XEmpresaId, XProdutos]);

  const handleEditar = () => {
    if (!XSelectedEstoque) return;
    startEditing(XSelectedEstoque);
  };

  const handleSalvar = async () => {
    if (!XEditProdutoId) { toast.error("Selecione um produto."); return; }
    if (!XEditDepositoId) { toast.error("Selecione um depósito."); return; }

    if (XEditMode === "insert") {
      const { error } = await baseService.inserir("estoque", {
        produto_id: XEditProdutoId,
        deposito_id: XEditDepositoId,
        endereco: XEditEndereco.trim(),
        estoque_fisico: 0,
        estoque_reservado: 0,
        estoque_minimo: XEditEstoqueMinimo,
        estoque_padrao: XEditEstoquePadrao,
        estoque_inventario: XEditEstoqueInventario,
        empresa_id: XEmpresaId,
      });
      if (error) { toast.error("Erro ao incluir estoque: " + error.message); return; }
      toast.success("Estoque incluído com sucesso.");
    } else if (XEditMode === "edit" && XEditingEstoque) {
      const { error } = await baseService.atualizar("estoque", "estoque_id", XEditingEstoque.estoque_id, {
        endereco: XEditEndereco.trim(),
        estoque_minimo: XEditEstoqueMinimo,
        estoque_padrao: XEditEstoquePadrao,
        estoque_inventario: XEditEstoqueInventario,
      });
      if (error) { toast.error("Erro ao alterar estoque: " + error.message); return; }
      toast.success("Estoque alterado com sucesso.");
    }
    setXEditMode("none");
    setXSelectedIdx(null);
    setXSelectedEstoque(null);
    setXEditingEstoque(null);
    loadData();
  };

  const handleExcluir = async () => {
    if (!XSelectedEstoque) return;
    if (confirm("Deseja realmente excluir este registro de estoque?")) {
      await baseService.excluirLogico("estoque", "estoque_id", XSelectedEstoque.estoque_id);
      toast.success("Estoque excluído.");
      setXSelectedIdx(null);
      setXSelectedEstoque(null);
      loadData();
    }
  };

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  const XIsEditing = XEditMode !== "none";

  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        {!XIsEditing ? (
          <>
            <ToolbarBtn icon={<Plus size={16} />} label="Incluir" onClick={handleIncluir} color="success" />
            <ToolbarBtn icon={<Pencil size={16} />} label="Editar" onClick={handleEditar} disabled={!XSelectedEstoque} />
            <ToolbarSep />
            <ToolbarBtn icon={<Trash2 size={16} />} label="Excluir" onClick={handleExcluir} disabled={!XSelectedEstoque} color="destructive" />
            <ToolbarBtn icon={<RefreshCw size={16} />} label="Recarregar" onClick={() => { loadData(); toast.info("Dados recarregados."); }} />
            <ToolbarBtn icon={<Filter size={16} />} label="Filtrar" onClick={() => setXShowFilters(!XShowFilters)} />
            <ToolbarBtn icon={<List size={16} />} label="Log" onClick={() => toast.info("Log de operações")} />
            <ToolbarBtn icon={<HelpCircle size={16} />} label="Ajuda" onClick={() => toast.info("Ajuda do formulário")} />
            <ToolbarBtn icon={<LogOut size={16} />} label="Sair" onClick={handleSair} />
          </>
        ) : (
          <>
            <ToolbarBtn icon={<Save size={16} />} label="Salvar" onClick={handleSalvar} color="success" />
            <ToolbarBtn icon={<LogOut size={16} />} label="Cancelar" onClick={() => setXEditMode("none")} color="destructive" />
          </>
        )}
      </div>

      {/* Edit row (inline) */}
      {XIsEditing && (
        <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/60">
          <span className="text-xs font-medium text-muted-foreground w-16 self-center">
            {XEditMode === "insert" ? "Novo:" : "Editar:"}
          </span>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Produto *</label>
            <div className="flex items-center gap-1">
              <div 
                onClick={() => XEditMode === "insert" && setXOpenProduto(true)}
                className={`bg-card border border-border rounded px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-ring w-[320px] flex justify-between items-center overflow-hidden h-[34px] ${XEditMode === "insert" ? "cursor-pointer" : "opacity-60 bg-secondary cursor-not-allowed"}`}
              >
                <span className={`truncate flex-1 text-left mr-2 ${XEditProdutoId ? "text-foreground" : "text-muted-foreground"}`}>
                  {XEditProdutoId ? `${XEditProdutoCd || XEditProdutoId} - ${XEditProdutoNome}` : "Selecione..."}
                </span>
                {XEditProdutoId && XEditMode === "insert" && (
                  <X 
                    className="w-3.5 h-3.5 hover:text-rose-500 shrink-0" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setXEditProdutoId("");
                      setXEditProdutoCd("");
                      setXEditProdutoNome("");
                    }}
                  />
                )}
              </div>
              <button 
                type="button"
                onClick={() => XEditMode === "insert" && setXOpenProduto(true)}
                disabled={XEditMode === "edit"}
                className="p-1.5 border border-border rounded hover:bg-accent shrink-0 disabled:opacity-50 h-[34px] flex items-center justify-center"
              >
                <Search className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Depósito *</label>
            <select ref={depositoRef} value={XEditDepositoId} onChange={(e) => setXEditDepositoId(e.target.value ? Number(e.target.value) : "")} disabled={XEditMode === "edit"} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-44 disabled:opacity-50 disabled:bg-secondary" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); enderecoRef.current?.focus(); } }}>
              <option value="">Selecione...</option>
              {XDepositos.map(d => (<option key={d.deposito_id} value={d.deposito_id}>{d.deposito_id} - {d.nome}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Endereço</label>
            <input ref={enderecoRef} type="text" value={XEditEndereco} onChange={(e) => setXEditEndereco(e.target.value)} maxLength={20} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-32" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); minimoRef.current?.focus(); } if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Mínimo</label>
            <CurrencyInput ref={minimoRef} value={XEditEstoqueMinimo} onChange={setXEditEstoqueMinimo} decimals={XQtDecimais} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); padraoRef.current?.focus(); } if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Padrão</label>
            <CurrencyInput ref={padraoRef} value={XEditEstoquePadrao} onChange={setXEditEstoquePadrao} decimals={XQtDecimais} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inventarioRef.current?.focus(); } if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Inventário</label>
            <CurrencyInput ref={inventarioRef} value={XEditEstoqueInventario} onChange={setXEditEstoqueInventario} decimals={XQtDecimais} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmarRef.current?.focus(); } if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <button
            ref={confirmarRef}
            onClick={handleSalvar}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-emerald-600 hover:bg-accent transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Salvar
          </button>
          <button
            onClick={() => setXEditMode("none")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-rose-600 hover:bg-accent transition-all hover:scale-105"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Cancelar
          </button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <DataGrid
          columns={XColumns}
          data={XFiltered}
          selectedIdx={XSelectedIdx}
          onRowClick={(_row, idx) => {
            setXSelectedIdx(idx);
            setXSelectedEstoque(_row);
          }}
          onRowDoubleClick={(_row, idx) => {
            if (XIsEditing) return;
            setXSelectedIdx(idx);
            setXSelectedEstoque(_row);
            startEditing(_row);
          }}
          showFilters={XShowFilters}
          filterValues={XFilterValues}
          onFilterChange={(key, value) => setXFilterValues(prev => ({ ...prev, [key]: value }))}
          maxHeight="calc(100vh - 200px)"
          exportTitle="Estoque"
          toolbarRight={
            <button
              onClick={() => {
                setXFilterValues({});
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-slate-600 dark:text-slate-400 hover:bg-accent hover:text-rose-600 hover:border-rose-200 transition-all"
              title="Limpar Filtros"
            >
              <X size={14} className="text-rose-500" /> Limpar Filtros
            </button>
          }
        />
      </div>

      <ProdutoSearchDialog
        open={XOpenProduto}
        onClose={() => setXOpenProduto(false)}
        onSelect={(p) => {
          setXEditProdutoId(p.produto_id);
          setXEditProdutoCd(String(p.cd_produto || ""));
          setXEditProdutoNome(p.nome);
          setTimeout(() => {
            depositoRef.current?.focus();
          }, 100);
        }}
        hideStockPromoFilters={true}
        hideDepositGrid={true}
        customFields={["codigo", "nome"]}
      />
    </div>
  );
};

const ToolbarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "success" | "destructive" | "default";
}> = ({ icon, label, onClick, disabled, color = "default" }) => {
  const XColorClass =
    color === "success" ? "text-emerald-600 dark:text-emerald-500" :
    color === "destructive" ? "text-rose-600 dark:text-rose-500" :
    "text-slate-600 dark:text-slate-400";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded-md transition-all duration-200 hover:bg-accent flex items-center justify-center ${XColorClass} ${
        disabled ? "opacity-30 grayscale cursor-not-allowed" : "hover:scale-110 active:scale-95"
      }`}
    >
      {icon}
    </button>
  );
};

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

export default EstoqueForm;
