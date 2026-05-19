import React, { useState, useCallback, useEffect, useMemo } from "react";
import { 
  RefreshCw, Search, Filter, HelpCircle, LogOut, List, 
  Calendar, Package, Warehouse, Download, X
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { format } from "date-fns";
import ProdutoSearchDialog, { IProdutoRow } from "@/components/forms/pedido/ProdutoSearchDialog";

const db = supabase as any;

const ConsultaEstoqueForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, closeTab, XTabs, XActiveTabId } = useAppContext();

  // Filters
  const [XDtIni, setXDtIni] = useState(format(new Date(), 'yyyy-MM-01')); // Primeiro dia do mês corrente
  const [XDtFim, setXDtFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [XSelectedProdutoId, setXSelectedProdutoId] = useState<number | "">("");
  const [XSelectedProdutoNome, setXSelectedProdutoNome] = useState("");
  const [XSelectedDepositoId, setXSelectedDepositoId] = useState<number | "">("");
  const [XOpenProduto, setXOpenProduto] = useState(false);

  // Data
  const [XLogData, setXLogData] = useState<any[]>([]);
  const [XProdutos, setXProdutos] = useState<any[]>([]);
  const [XDepositos, setXDepositos] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XShowFilters, setXShowFilters] = useState(true);
  const [XGridFilters, setXGridFilters] = useState<Record<string, string>>({});

  const loadBaseData = useCallback(async () => {
    const [{ data: XProdData }, { data: XDepData }] = await Promise.all([
      db.from("produto").select("produto_id, nome").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false).order("nome"),
      db.from("deposito").select("deposito_id, nome").eq("empresa_id", XEmpresaId).eq("excluido", false).order("nome"),
    ]);
    setXProdutos(XProdData || []);
    setXDepositos(XDepData || []);
  }, [XEmpresaId, XEmpresaMatrizId]);

  const loadLogData = useCallback(async () => {
    setXLoading(true);
    try {
      let query = db
        .from("estoque_log")
        .select(`
          *,
          produto:produto_id(nome),
          deposito:deposito_id(nome)
        `)
        .eq("empresa_id", XEmpresaId)
        .gte("dt_hs_log", `${XDtIni} 00:00:00`)
        .lte("dt_hs_log", `${XDtFim} 23:59:59`)
        .order("dt_hs_log", { ascending: false });

      if (XSelectedProdutoId !== "") {
        query = query.eq("produto_id", XSelectedProdutoId);
      }
      if (XSelectedDepositoId !== "") {
        query = query.eq("deposito_id", XSelectedDepositoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setXLogData(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar log: " + error.message);
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId, XDtIni, XDtFim, XSelectedProdutoId, XSelectedDepositoId]);

  useEffect(() => {
    loadBaseData();
    loadLogData();
  }, [loadBaseData, loadLogData]);

  const XColumns: IGridColumn[] = useMemo(() => [
    { 
      key: "dt_hs_log", 
      label: "Data/Hora", 
      width: "150px",
      render: (r: any) => r.dt_hs_log ? format(new Date(r.dt_hs_log), 'dd/MM/yyyy HH:mm') : ""
    },
    { key: "operacao", label: "Operação", width: "120px" },
    { key: "origem", label: "Origem", width: "120px" },
    { key: "nr_doc", label: "Nr. Doc", width: "100px" },
    { 
      key: "produto", 
      label: "Cód. Prod.", 
      width: "100px",
      render: (r: any) => r.produto_id,
      getValue: (r: any) => r.produto_id
    },
    { 
      key: "deposito", 
      label: "Local / Depósito", 
      width: "180px",
      render: (r: any) => r.deposito?.nome || String(r.deposito_id),
      getValue: (r: any) => r.deposito?.nome || ""
    },
    { 
      key: "qt_movimento", 
      label: "Movimento", 
      width: "100px", 
      align: "right",
      render: (r: any) => (
        <span className={r.qt_movimento > 0 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
          {Number(r.qt_movimento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    { 
      key: "qt_estoque_deposito", 
      label: "Saldo Local", 
      width: "100px", 
      align: "right",
      render: (r: any) => Number(r.qt_estoque_deposito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    },
    { 
      key: "qt_estoque_geral", 
      label: "Saldo Geral", 
      width: "100px", 
      align: "right",
      render: (r: any) => Number(r.qt_estoque_geral).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    },
    { key: "usuario", label: "Usuário", width: "150px" },
  ], []);

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <List className="w-4 h-4 text-primary" />
            CONSULTA DE MOVIMENTAÇÃO DE ESTOQUE
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadLogData} 
            disabled={XLoading}
            className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${XLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleSair}
            className="p-1.5 hover:bg-rose-100 hover:text-rose-600 rounded-md transition-colors text-muted-foreground"
            title="Fechar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Filters */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Período
            </label>
            <div className="flex items-center gap-2 bg-card border border-border rounded-md px-2 py-1">
              <input 
                type="date" 
                value={XDtIni} 
                onChange={e => setXDtIni(e.target.value)}
                className="bg-transparent border-none text-xs focus:ring-0 w-28" 
              />
              <span className="text-muted-foreground text-xs">até</span>
              <input 
                type="date" 
                value={XDtFim} 
                onChange={e => setXDtFim(e.target.value)}
                className="bg-transparent border-none text-xs focus:ring-0 w-28" 
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Package className="w-3 h-3" /> Produto
            </label>
            <div className="flex items-center gap-1">
              <div 
                onClick={() => setXOpenProduto(true)}
                className="bg-card border border-border rounded-md px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 w-64 cursor-pointer flex justify-between items-center"
              >
                <span className={XSelectedProdutoId ? "text-foreground" : "text-muted-foreground"}>
                  {XSelectedProdutoId ? `${XSelectedProdutoId} - ${XSelectedProdutoNome}` : "Todos os Produtos"}
                </span>
                {XSelectedProdutoId && (
                  <X 
                    className="w-3 h-3 hover:text-rose-500" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setXSelectedProdutoId("");
                      setXSelectedProdutoNome("");
                    }}
                  />
                )}
              </div>
              <button 
                onClick={() => setXOpenProduto(true)}
                className="p-1.5 border border-border rounded-md hover:bg-accent"
              >
                <Search className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Warehouse className="w-3 h-3" /> Local / Depósito
            </label>
            <select 
              value={XSelectedDepositoId} 
              onChange={e => setXSelectedDepositoId(e.target.value ? Number(e.target.value) : "")}
              className="bg-card border border-border rounded-md px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/20 w-48"
            >
              <option value="">Todos os Locais</option>
              {XDepositos.map(d => (
                <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadLogData}
            disabled={XLoading}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity shadow-sm h-[32px]"
          >
            <Search className="w-3.5 h-3.5" />
            PESQUISAR
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden p-4">
        <DataGrid 
          columns={XColumns}
          data={XLogData}
          showFilters={XShowFilters}
          filterValues={XGridFilters}
          onFilterChange={(k, v) => setXGridFilters(prev => ({ ...prev, [k]: v }))}
          toolbarRight={
            <button 
              onClick={() => setXShowFilters(!XShowFilters)}
              className={`p-1.5 rounded border transition-colors ${XShowFilters ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground'}`}
              title="Filtros Rápidos"
            >
              <Filter className="w-4 h-4" />
            </button>
          }
          exportTitle="Consulta_Movimentacao_Estoque"
        />
      </div>

      <ProdutoSearchDialog 
        open={XOpenProduto}
        onClose={() => setXOpenProduto(false)}
        onSelect={(p: IProdutoRow) => {
          setXSelectedProdutoId(p.produto_id);
          setXSelectedProdutoNome(p.nome);
        }}
      />
    </div>
  );
};

export default ConsultaEstoqueForm;
