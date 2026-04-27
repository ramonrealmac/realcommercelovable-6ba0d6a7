import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus, Save, Pencil, Trash2, RefreshCw, Search, Filter,
  HelpCircle, LogOut, List
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { baseService } from "@/utils/baseService";

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
}

interface IDeposito {
  deposito_id: number;
  nome: string;
  empresa_id: number;
  st_privado: boolean;
}

const EstoqueForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XEstoques, setXEstoques] = useState<IEstoque[]>([]);
  const [XProdutos, setXProdutos] = useState<IProduto[]>([]);
  const [XDepositos, setXDepositos] = useState<IDeposito[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XShowFilters, setXShowFilters] = useState(true);
  const [XEditMode, setXEditMode] = useState<"none" | "insert" | "edit">("none");

  const [XEditProdutoId, setXEditProdutoId] = useState<number | "">("");
  const [XEditDepositoId, setXEditDepositoId] = useState<number | "">("");
  const [XEditEndereco, setXEditEndereco] = useState("");
  const [XEditEstoqueMinimo, setXEditEstoqueMinimo] = useState(0);
  const [XEditEstoquePadrao, setXEditEstoquePadrao] = useState(0);
  const [XEditEstoqueInventario, setXEditEstoqueInventario] = useState(0);

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
    const [{ data: XEstData }, { data: XProdData }, { data: XDepData }] = await Promise.all([
      db.from("estoque").select("*").in("empresa_id", XIds).eq("excluido", false).order("estoque_id"),
      db.from("produto").select("produto_id, nome").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("nome"),
      db.from("deposito").select("deposito_id, nome, empresa_id, st_privado").in("empresa_id", XIds).eq("excluido", false).order("nome"),
    ]);
    // Filter deposits: own company = all, sister companies = only public (st_privado=false)
    const XFilteredDeps = (XDepData || []).filter((d: IDeposito) =>
      d.empresa_id === XEmpresaId || d.st_privado === false
    );
    // Filter estoques to only show those in visible deposits
    const XVisibleDepIds = new Set(XFilteredDeps.map((d: IDeposito) => d.deposito_id));
    const XFilteredEst = (XEstData || []).filter((e: IEstoque) => XVisibleDepIds.has(e.deposito_id));
    setXEstoques(XFilteredEst);
    setXProdutos(XProdData || []);
    setXDepositos(XFilteredDeps);
  }, [XEmpresaId, XEmpresaMatrizId, XGroupEmpresaIds]);

  useEffect(() => {
    loadData();
    setXSelectedIdx(null);
    setXEditMode("none");
  }, [XEmpresaId, loadData]);

  const XProdutoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XProdutos.forEach(p => { m[p.produto_id] = p.nome; });
    return m;
  }, [XProdutos]);

  const XDepositoMap = useMemo(() => {
    const m: Record<number, string> = {};
    XDepositos.forEach(d => { m[d.deposito_id] = d.nome; });
    return m;
  }, [XDepositos]);

  const XDepositoEmpresaMap = useMemo(() => {
    const m: Record<number, number> = {};
    XDepositos.forEach(d => { m[d.deposito_id] = d.empresa_id; });
    return m;
  }, [XDepositos]);

  const XColumns: IGridColumn[] = useMemo(() => [
    {
      key: "produto_id", label: "Produto", width: "1fr",
      render: (r: IEstoque) => `${r.produto_id} - ${XProdutoMap[r.produto_id] || ""}`,
      getValue: (r: IEstoque) => `${r.produto_id} - ${XProdutoMap[r.produto_id] || ""}`,
    },
    {
      key: "empresa_nome", label: "Empresa", width: "160px",
      render: (r: IEstoque) => XEmpresaMap[r.empresa_id] || String(r.empresa_id),
      getValue: (r: IEstoque) => XEmpresaMap[r.empresa_id] || "",
    },
    {
      key: "deposito_id", label: "Depósito", width: "160px",
      render: (r: IEstoque) => `${r.deposito_id} - ${XDepositoMap[r.deposito_id] || ""}`,
      getValue: (r: IEstoque) => XDepositoMap[r.deposito_id] || "",
    },
    { key: "endereco", label: "Endereço", width: "120px" },
    { key: "estoque_fisico", label: "Físico", width: "90px", align: "right" as const },
    { key: "estoque_reservado", label: "Reservado", width: "90px", align: "right" as const },
    { key: "estoque_disponivel", label: "Disponível", width: "90px", align: "right" as const },
    { key: "estoque_minimo", label: "Mínimo", width: "90px", align: "right" as const },
    { key: "estoque_padrao", label: "Padrão", width: "90px", align: "right" as const },
    { key: "estoque_inventario", label: "Inventário", width: "90px", align: "right" as const },
  ], [XProdutoMap, XDepositoMap, XEmpresaMap]);

  // Keep custom filter for estoque since it uses getValue/render
  const XFiltered = XEstoques.filter(e => {
    for (const col of XColumns) {
      const fv = XFilterValues[col.key] || "";
      if (!fv) continue;
      let val = "";
      if (col.getValue) val = String(col.getValue(e));
      else if (col.render) val = String(col.render(e));
      else val = String((e as any)[col.key] ?? "");
      if (!val.toLowerCase().includes(fv.toLowerCase())) return false;
    }
    return true;
  });

  const XSelectedEstoque = XSelectedIdx !== null ? XFiltered[XSelectedIdx] : null;

  const handleIncluir = () => {
    setXEditMode("insert");
    setXEditProdutoId("");
    setXEditDepositoId("");
    setXEditEndereco("");
    setXEditEstoqueMinimo(0);
    setXEditEstoquePadrao(0);
    setXEditEstoqueInventario(0);
  };

  const handleEditar = () => {
    if (!XSelectedEstoque) return;
    setXEditMode("edit");
    setXEditProdutoId(XSelectedEstoque.produto_id);
    setXEditDepositoId(XSelectedEstoque.deposito_id);
    setXEditEndereco(XSelectedEstoque.endereco || "");
    setXEditEstoqueMinimo(XSelectedEstoque.estoque_minimo ?? 0);
    setXEditEstoquePadrao(XSelectedEstoque.estoque_padrao ?? 0);
    setXEditEstoqueInventario(XSelectedEstoque.estoque_inventario ?? 0);
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
        estoque_disponivel: 0,
        estoque_minimo: XEditEstoqueMinimo,
        estoque_padrao: XEditEstoquePadrao,
        estoque_inventario: XEditEstoqueInventario,
        empresa_id: XEmpresaId,
      });
      if (error) { toast.error("Erro ao incluir estoque: " + error.message); return; }
      toast.success("Estoque incluído com sucesso.");
    } else if (XEditMode === "edit" && XSelectedEstoque) {
      const { error } = await baseService.atualizar("estoque", "estoque_id", XSelectedEstoque.estoque_id, {
        endereco: XEditEndereco.trim(),
        estoque_minimo: XEditEstoqueMinimo,
        estoque_padrao: XEditEstoquePadrao,
        estoque_inventario: XEditEstoqueInventario,
      });
      if (error) { toast.error("Erro ao alterar estoque: " + error.message); return; }
      toast.success("Estoque alterado com sucesso.");
    }
    setXEditMode("none");
    loadData();
  };

  const handleExcluir = async () => {
    if (!XSelectedEstoque) return;
    if (confirm("Deseja realmente excluir este registro de estoque?")) {
      await baseService.excluirLogico("estoque", "estoque_id", XSelectedEstoque.estoque_id);
      toast.success("Estoque excluído.");
      setXSelectedIdx(null);
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
        <div className="flex flex-wrap items-end gap-2 p-3 bg-accent border-b border-border">
          <span className="text-xs font-medium text-muted-foreground w-16 self-center">
            {XEditMode === "insert" ? "Novo:" : "Editar:"}
          </span>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Produto *</label>
            <select value={XEditProdutoId} onChange={(e) => setXEditProdutoId(e.target.value ? Number(e.target.value) : "")} disabled={XEditMode === "edit"} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-56 disabled:opacity-50 disabled:bg-secondary">
              <option value="">Selecione...</option>
              {XProdutos.map(p => (<option key={p.produto_id} value={p.produto_id}>{p.produto_id} - {p.nome}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Depósito *</label>
            <select value={XEditDepositoId} onChange={(e) => setXEditDepositoId(e.target.value ? Number(e.target.value) : "")} disabled={XEditMode === "edit"} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-44 disabled:opacity-50 disabled:bg-secondary">
              <option value="">Selecione...</option>
              {XDepositos.map(d => (<option key={d.deposito_id} value={d.deposito_id}>{d.deposito_id} - {d.nome}</option>))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Endereço</label>
            <input type="text" value={XEditEndereco} onChange={(e) => setXEditEndereco(e.target.value)} maxLength={20} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-32" onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Mínimo</label>
            <input type="number" value={XEditEstoqueMinimo} onChange={(e) => setXEditEstoqueMinimo(Number(e.target.value))} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Padrão</label>
            <input type="number" value={XEditEstoquePadrao} onChange={(e) => setXEditEstoquePadrao(Number(e.target.value))} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground">Inventário</label>
            <input type="number" value={XEditEstoqueInventario} onChange={(e) => setXEditEstoqueInventario(Number(e.target.value))} className="border border-border rounded px-2 py-1 text-sm bg-card outline-none focus:ring-2 focus:ring-ring w-20 text-right" onKeyDown={(e) => { if (e.key === "Enter") handleSalvar(); if (e.key === "Escape") setXEditMode("none"); }} />
          </div>
          <button onClick={handleSalvar} className="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:opacity-90">Salvar</button>
          <button onClick={() => setXEditMode("none")} className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:opacity-90">Cancelar</button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <DataGrid
          columns={XColumns}
          data={XFiltered}
          selectedIdx={XSelectedIdx}
          onRowClick={(_row, idx) => setXSelectedIdx(idx)}
          onRowDoubleClick={(_row, idx) => {
            setXSelectedIdx(idx);
            const e = XFiltered[idx];
            if (e) {
              setXEditMode("edit");
              setXEditProdutoId(e.produto_id);
              setXEditDepositoId(e.deposito_id);
              setXEditEndereco(e.endereco || "");
              setXEditEstoqueMinimo(e.estoque_minimo ?? 0);
              setXEditEstoquePadrao(e.estoque_padrao ?? 0);
              setXEditEstoqueInventario(e.estoque_inventario ?? 0);
            }
          }}
          showFilters={XShowFilters}
          filterValues={XFilterValues}
          onFilterChange={(key, value) => setXFilterValues(prev => ({ ...prev, [key]: value }))}
          maxHeight="calc(100vh - 200px)"
          exportTitle="Estoque"
        />
      </div>
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
    color === "success" ? "text-success hover:bg-success/10" :
    color === "destructive" ? "text-destructive hover:bg-destructive/10" :
    "text-foreground hover:bg-accent";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors ${XColorClass} ${
        disabled ? "opacity-30 cursor-not-allowed" : ""
      }`}
    >
      {icon}
    </button>
  );
};

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

export default EstoqueForm;
