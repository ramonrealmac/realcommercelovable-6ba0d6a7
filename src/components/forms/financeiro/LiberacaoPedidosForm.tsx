/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  RefreshCw, 
  Unlock, 
  Lock, 
  Ban, 
  CheckSquare, 
  Square, 
  Filter, 
  User, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";
import { formatCPFCNPJ } from "@/lib/validators";

const db = supabase as any;

interface IClientInfo {
  cadastro_id: number;
  cd_cadastro: number | null;
  cnpj: string | null;
  razao_social: string;
  nome_fantasia: string | null;
  fone_geral: string | null;
  vl_lim_credito: number;
  bloqueia_cliente: number;
  qt_tit_aberto: number;
  qt_tit_vencido: number;
  vl_utilizado?: number;
  vl_disponivel?: number;
  qt_tit_aberto_real?: number;
  qt_tit_vencido_real?: number;
}

interface IOrderRow {
  movimento_id: number;
  nr_movimento: number;
  dt_emissao: string | null;
  dt_entrega: string | null;
  cadastro_id: number | null;
  vl_movimento: number | null;
  st_bloqueado: string;
  st_pedido: string;
  empresa_id: number;
  clientInfo?: IClientInfo;
}

interface ITitleRow {
  financeiro_id: number;
  documento: string | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  vl_titulo: number | null;
  vl_pago: number | null;
  status: string | null;
  tp_conta: string | null;
}

const fmtMoney = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const getDiasAtraso = (dtVenctoStr: string | null | undefined) => {
  if (!dtVenctoStr) return 0;
  const vencto = new Date(dtVenctoStr);
  const hoje = new Date();
  vencto.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  if (vencto >= hoje) return 0;
  const diffTime = Math.abs(hoje.getTime() - vencto.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const LiberacaoPedidosForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Filters State
  const [XDtInicio, setXDtInicio] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10)
  );
  const [XDtFim, setXDtFim] = useState<string>(new Date().toISOString().substring(0, 10));
  const [XTpData, setXTpData] = useState<"dt_emissao" | "dt_entrega">("dt_emissao");
  const [XSituacao, setXSituacao] = useState<string>("S"); // 'S' = Bloqueado, 'N' = Liberado, 'T' = Todos
  const [XFiltroCliente, setXFiltroCliente] = useState<string>("");

  // Grid Data & Loading
  const [XRows, setXRows] = useState<IOrderRow[]>([]);
  const [XSelectedIds, setXSelectedIds] = useState<number[]>([]);
  const [XLoading, setXLoading] = useState<boolean>(false);
  const [XActiveIdx, setXActiveIdx] = useState<number | null>(null);

  // Client Credit Panel Info
  const [XActiveClientInfo, setXActiveClientInfo] = useState<IClientInfo | null>(null);
  const [XActiveClientTitles, setXActiveClientTitles] = useState<ITitleRow[]>([]);
  const [XLoadingClient, setXLoadingClient] = useState<boolean>(false);

  // Load client credit info & titles when selecting an order row
  const loadClientCreditDetails = useCallback(async (clientId: number) => {
    setXLoadingClient(true);
    try {
      // Get latest client data
      const { data: clientData, error: clientErr } = await db.from("cadastro")
        .select("cadastro_id, cd_cadastro, cnpj, razao_social, nome_fantasia, fone_geral, vl_lim_credito, bloqueia_cliente, qt_tit_aberto, qt_tit_vencido")
        .eq("cadastro_id", clientId)
        .maybeSingle();

      if (clientErr) throw clientErr;

      // Get open titles (tp_conta = 'R' and status = 'A')
      const { data: titlesData, error: titlesErr } = await db.from("financeiro")
        .select("financeiro_id, documento, dt_emissao, dt_vencto, vl_titulo, vl_pago, status, tp_conta")
        .eq("cadastro_id", clientId)
        .eq("tp_conta", "R")
        .eq("status", "A")
        .eq("excluido", false)
        .order("dt_vencto", { ascending: true });

      if (titlesErr) throw titlesErr;

      const titles = (titlesData || []) as ITitleRow[];
      const utilized = titles.reduce((acc, t) => acc + (Number(t.vl_titulo || 0) - Number(t.vl_pago || 0)), 0);

      // Count overdue titles
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const overdueCount = titles.filter(t => {
        if (!t.dt_vencto) return false;
        const vencto = new Date(t.dt_vencto);
        vencto.setHours(0, 0, 0, 0);
        return vencto < today;
      }).length;

      setXActiveClientInfo({
        ...clientData,
        vl_utilizado: utilized,
        vl_disponivel: Number(clientData.vl_lim_credito || 0) - utilized,
        qt_tit_aberto_real: titles.length,
        qt_tit_vencido_real: overdueCount
      });
      setXActiveClientTitles(titles);
    } catch (e: any) {
      console.error("Erro ao carregar detalhes de crédito:", e);
      toast.error("Erro ao carregar análise de crédito: " + e.message);
    } finally {
      setXLoadingClient(false);
    }
  }, []);

  const loadGrid = useCallback(async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    setXActiveIdx(null);
    setXActiveClientInfo(null);
    setXActiveClientTitles([]);
    
    try {
      let q = db.from("movimento")
        .select("movimento_id, nr_movimento, dt_emissao, dt_entrega, cadastro_id, vl_movimento, st_bloqueado, st_pedido, empresa_id")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .in("tp_movimento", ["PD", "SV", "OR"])
        .eq("st_pedido", "F") // Somente faturado/caixa aguardando liberação
        .order("nr_movimento", { ascending: false });

      if (XDtInicio) q = q.gte(XTpData, XDtInicio);
      if (XDtFim) q = q.lte(XTpData, XDtFim);
      if (XSituacao === "S") q = q.eq("st_bloqueado", "S");
      if (XSituacao === "N") q = q.eq("st_bloqueado", "N");

      const { data, error } = await q;
      if (error) throw error;

      const rows: IOrderRow[] = data || [];

      // Fetch client names/codes for displaying in the grid
      const cadIds = Array.from(new Set(rows.map(r => r.cadastro_id).filter(Boolean)));
      if (cadIds.length > 0) {
        const { data: cadRes } = await db.from("cadastro")
          .select("cadastro_id, cd_cadastro, cnpj, razao_social, nome_fantasia, vl_lim_credito, bloqueia_cliente, qt_tit_aberto, qt_tit_vencido")
          .in("cadastro_id", cadIds);
        
        const cadMap = new Map<number, any>((cadRes || []).map((c: any) => [c.cadastro_id, c]));
        
        rows.forEach(r => {
          if (r.cadastro_id && cadMap.has(r.cadastro_id)) {
            const c = cadMap.get(r.cadastro_id);
            r.clientInfo = {
              cadastro_id: c.cadastro_id,
              cd_cadastro: c.cd_cadastro,
              cnpj: c.cnpj,
              razao_social: c.razao_social,
              nome_fantasia: c.nome_fantasia,
              vl_lim_credito: Number(c.vl_lim_credito || 0),
              bloqueia_cliente: Number(c.bloqueia_cliente || 3),
              qt_tit_aberto: Number(c.qt_tit_aberto || 0),
              qt_tit_vencido: Number(c.qt_tit_vencido || 0)
            };
          }
        });
      }

      // Filter locally by client filter if present
      let filteredRows = rows;
      if (XFiltroCliente.trim()) {
        const filterStr = XFiltroCliente.toUpperCase();
        filteredRows = rows.filter(r => 
          r.cadastro_id?.toString().includes(filterStr) ||
          r.clientInfo?.cd_cadastro?.toString().includes(filterStr) ||
          r.clientInfo?.razao_social.toUpperCase().includes(filterStr) ||
          r.clientInfo?.nome_fantasia?.toUpperCase().includes(filterStr) ||
          r.clientInfo?.cnpj?.includes(filterStr)
        );
      }

      setXRows(filteredRows);
    } catch (e: any) {
      console.error("Erro ao carregar grade de pedidos:", e);
      toast.error("Erro ao carregar grade de pedidos: " + e.message);
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId, XDtInicio, XDtFim, XTpData, XSituacao, XFiltroCliente]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const handleRowClick = (row: any, index: number) => {
    setXActiveIdx(index);
    if (row.cadastro_id) {
      loadClientCreditDetails(row.cadastro_id);
    } else {
      setXActiveClientInfo(null);
      setXActiveClientTitles([]);
    }
  };

  // Batch actions
  const handleDesbloquear = async () => {
    if (XSelectedIds.length === 0) {
      toast.warning("Selecione pelo menos um pedido.");
      return;
    }
    setXLoading(true);
    try {
      const { error } = await supabase.from("movimento")
        .update({ st_bloqueado: "N", dt_alteracao: new Date().toISOString() })
        .in("movimento_id", XSelectedIds);
      if (error) throw error;
      toast.success(`${XSelectedIds.length} pedido(s) liberado(s) com sucesso.`);
      setXSelectedIds([]);
      await loadGrid();
    } catch (e: any) {
      toast.error("Erro ao liberar pedidos: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleCancelar = async () => {
    if (XSelectedIds.length === 0) {
      toast.warning("Selecione pelo menos um pedido.");
      return;
    }
    if (!confirm(`Deseja realmente CANCELAR ${XSelectedIds.length} pedido(s) selecionado(s)? A reserva de estoque será liberada.`)) {
      return;
    }
    setXLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      let successCount = 0;
      let failCount = 0;
      
      for (const id of XSelectedIds) {
        const { data, error } = await db.rpc("fu_mudar_status_pedido_pdv", {
          _movimento_id: id,
          _novo_status: "C",
          _usuario_id: userId
        });
        if (error || data?.error) {
          failCount++;
        } else {
          successCount++;
        }
      }
      
      if (failCount > 0) {
        toast.info(`${successCount} pedido(s) cancelado(s) com sucesso. ${failCount} falhou(aram).`);
      } else {
        toast.success(`${successCount} pedido(s) cancelado(s) com sucesso.`);
      }
      setXSelectedIds([]);
      await loadGrid();
    } catch (e: any) {
      toast.error("Erro ao cancelar pedidos: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleReabrir = async () => {
    if (XSelectedIds.length === 0) {
      toast.warning("Selecione pelo menos um pedido.");
      return;
    }
    if (!confirm(`Deseja realmente REABRIR ${XSelectedIds.length} pedido(s) selecionado(s)? Eles voltarão para o status Orçamento e a reserva de estoque será liberada.`)) {
      return;
    }
    setXLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      let successCount = 0;
      let failCount = 0;
      
      for (const id of XSelectedIds) {
        const { data, error } = await db.rpc("fu_mudar_status_pedido_pdv", {
          _movimento_id: id,
          _novo_status: "O",
          _usuario_id: userId
        });
        if (error || data?.error) {
          failCount++;
        } else {
          successCount++;
        }
      }
      
      if (failCount > 0) {
        toast.info(`${successCount} pedido(s) reaberto(s) com sucesso. ${failCount} falhou(aram).`);
      } else {
        toast.success(`${successCount} pedido(s) reaberto(s) com sucesso.`);
      }
      setXSelectedIds([]);
      await loadGrid();
    } catch (e: any) {
      toast.error("Erro ao reabrir pedidos: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (XSelectedIds.length === XRows.length) {
      setXSelectedIds([]);
    } else {
      setXSelectedIds(XRows.map(r => r.movimento_id));
    }
  };

  // Grid Columns Configuration
  const XCols: IGridColumn[] = useMemo(() => [
    {
      key: "_select", label: "", width: "40px", align: "center",
      render: (r: any) => (
        <input
          type="checkbox"
          checked={XSelectedIds.includes(r.movimento_id)}
          onChange={(e) => {
            e.stopPropagation();
            if (e.target.checked) {
              setXSelectedIds(prev => [...prev, r.movimento_id]);
            } else {
              setXSelectedIds(prev => prev.filter(id => id !== r.movimento_id));
            }
          }}
          className="w-4 h-4 cursor-pointer accent-primary border-border rounded"
        />
      ),
    },
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "dt_emissao", label: "Emissão", width: "100px", align: "center", render: (r: any) => fmtDate(r.dt_emissao) },
    { key: "dt_entrega", label: "Entrega", width: "100px", align: "center", render: (r: any) => fmtDate(r.dt_entrega) },
    { key: "cd_cadastro", label: "Cód. Cliente", width: "95px", align: "right", render: (r: any) => r.clientInfo?.cd_cadastro ?? "" },
    { key: "cnpj", label: "CPF/CNPJ", width: "135px", render: (r: any) => r.clientInfo?.cnpj ? formatCPFCNPJ(r.clientInfo.cnpj) : "" },
    { key: "razao_social", label: "Razão Social", width: "2fr", render: (r: any) => r.clientInfo?.razao_social ?? "" },
    { key: "vl_movimento", label: "Valor Total", width: "110px", align: "right", render: (r: any) => fmtMoney(r.vl_movimento) },
    { 
      key: "st_bloqueado", label: "Situação", width: "110px", align: "center",
      render: (r: any) => (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold select-none ${
          r.st_bloqueado === "S" 
            ? "bg-destructive/10 text-destructive border border-destructive/20" 
            : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30"
        }`}>
          {r.st_bloqueado === "S" ? "Bloqueado" : "Liberado"}
        </span>
      )
    },
  ], [XSelectedIds]);

  const XTitleCols: IGridColumn[] = useMemo(() => [
    { key: "documento", label: "Documento", width: "100px" },
    { key: "dt_emissao", label: "Emissão", width: "100px", align: "center", render: (r: any) => fmtDate(r.dt_emissao) },
    { key: "dt_vencto", label: "Vencimento", width: "100px", align: "center", render: (r: any) => fmtDate(r.dt_vencto) },
    { key: "vl_titulo", label: "Valor Título", width: "110px", align: "right", render: (r: any) => fmtMoney(r.vl_titulo) },
    { key: "vl_saldo", label: "Saldo a Pagar", width: "110px", align: "right", render: (r: any) => fmtMoney(Number(r.vl_titulo || 0) - Number(r.vl_pago || 0)) },
    { 
      key: "dias_atraso", label: "Atraso", width: "90px", align: "right", 
      render: (r: any) => {
        const dias = getDiasAtraso(r.dt_vencto);
        return dias > 0 ? (
          <span className="text-destructive font-bold">{dias} dias</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        );
      }
    },
  ], []);

  // Credit Panel calculations
  const limitValue = XActiveClientInfo?.vl_lim_credito ?? 0;
  const utilizedValue = XActiveClientInfo?.vl_utilizado ?? 0;
  const availableValue = XActiveClientInfo?.vl_disponivel ?? 0;
  const limitUsagePct = limitValue > 0 ? Math.min(100, Math.round((utilizedValue / limitValue) * 100)) : 0;

  return (
    <div className="p-4 h-full overflow-auto space-y-4 bg-background">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Liberação de Pedidos</h2>
          <p className="text-xs text-muted-foreground">Análise de limite de crédito e liberação de pedidos bloqueados.</p>
        </div>
        <button
          onClick={loadGrid}
          disabled={XLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-all"
        >
          <RefreshCw size={13} className={XLoading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* FILTERS PANEL */}
      <div className="border border-border rounded-lg p-4 bg-card shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Filter size={13} /> Filtros de Pesquisa
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Filtrar Data por</label>
            <select
              value={XTpData}
              onChange={(e) => setXTpData(e.target.value as any)}
              className="border border-border rounded px-2.5 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="dt_emissao">Data de Emissão</option>
              <option value="dt_entrega">Data de Entrega</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Data Inicial</label>
            <input
              type="date"
              value={XDtInicio}
              onChange={(e) => setXDtInicio(e.target.value)}
              className="border border-border rounded px-2.5 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Data Final</label>
            <input
              type="date"
              value={XDtFim}
              onChange={(e) => setXDtFim(e.target.value)}
              className="border border-border rounded px-2.5 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Situação Crédito</label>
            <select
              value={XSituacao}
              onChange={(e) => setXSituacao(e.target.value)}
              className="border border-border rounded px-2.5 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="S">Bloqueado</option>
              <option value="N">Liberado</option>
              <option value="T">Todos</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">Cliente (Pesquisa)</label>
            <input
              type="text"
              placeholder="Cód, Nome, CNPJ..."
              value={XFiltroCliente}
              onChange={(e) => setXFiltroCliente(e.target.value)}
              className="border border-border rounded px-2.5 py-1.5 text-sm bg-card outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT GRID (Orders Grid + Details Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Side: Orders List (span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card p-3 border border-border rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded bg-card hover:bg-accent text-card-foreground select-none"
              >
                {XSelectedIds.length === XRows.length && XRows.length > 0 ? (
                  <>
                    <CheckSquare size={13} className="text-primary" />
                    Desmarcar Todos
                  </>
                ) : (
                  <>
                    <Square size={13} />
                    Selecionar Todos
                  </>
                )}
              </button>
              <span className="text-xs text-muted-foreground font-medium">
                {XSelectedIds.length} selecionado(s) de {XRows.length} pedido(s)
              </span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDesbloquear}
                disabled={XSelectedIds.length === 0 || XLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
              >
                <Unlock size={13} /> Liberar Pedidos
              </button>
              <button
                onClick={handleReabrir}
                disabled={XSelectedIds.length === 0 || XLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-amber-600 text-amber-700 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw size={13} /> Reabrir
              </button>
              <button
                onClick={handleCancelar}
                disabled={XSelectedIds.length === 0 || XLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Ban size={13} /> Cancelar
              </button>
            </div>
          </div>

          <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            <DataGrid
              columns={XCols}
              data={XRows}
              selectedIdx={XActiveIdx}
              onRowClick={(row, idx) => handleRowClick(row, idx)}
              maxHeight="calc(100vh - 380px)"
              exportTitle="Fila de Liberacao de Pedidos"
            />
          </div>
        </div>

        {/* Right Side: Credit & Titles Details Panel */}
        <div className="flex flex-col gap-4">
          {XActiveClientInfo ? (
            <>
              {/* Credit Analysis Card */}
              <div className="border border-border rounded-lg bg-card shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <User size={16} className="text-primary" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">{XActiveClientInfo.razao_social}</h3>
                    {XActiveClientInfo.nome_fantasia && (
                      <p className="text-xs text-muted-foreground">{XActiveClientInfo.nome_fantasia}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 border border-border/60 rounded bg-secondary/20">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Cód. Cadastro</span>
                    <span className="text-sm font-semibold text-foreground">#{XActiveClientInfo.cd_cadastro ?? XActiveClientInfo.cadastro_id}</span>
                  </div>
                  <div className="p-2 border border-border/60 rounded bg-secondary/20">
                    <span className="text-[10px] text-muted-foreground font-semibold block uppercase">Regra Bloqueio</span>
                    <span className={`text-xs font-bold ${
                      XActiveClientInfo.bloqueia_cliente === 1 ? "text-destructive" :
                      XActiveClientInfo.bloqueia_cliente === 2 ? "text-amber-500" : "text-emerald-500"
                    }`}>
                      {XActiveClientInfo.bloqueia_cliente === 1 ? "Sempre Bloquear" :
                       XActiveClientInfo.bloqueia_cliente === 2 ? "Regra Financeira" : "Nunca Bloquear"}
                    </span>
                  </div>
                </div>

                {/* Limit Visual Meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Uso do Limite de Crédito</span>
                    <span className={`font-bold ${limitUsagePct > 80 ? "text-destructive" : "text-primary"}`}>{limitUsagePct}%</span>
                  </div>
                  <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        limitUsagePct > 90 ? "bg-destructive" : 
                        limitUsagePct > 65 ? "bg-amber-500" : "bg-emerald-500"
                      }`}
                      style={{ width: `${limitUsagePct}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign size={13} className="text-emerald-500" /> Limite de Crédito
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(limitValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign size={13} className="text-destructive" /> Limite Utilizado
                    </span>
                    <span className="font-semibold text-destructive">{fmtMoney(utilizedValue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <DollarSign size={13} className="text-primary" /> Saldo Disponível
                    </span>
                    <span className={`font-bold ${availableValue < 0 ? "text-destructive" : "text-primary"}`}>
                      {fmtMoney(availableValue)}
                    </span>
                  </div>
                </div>

                {/* Credit Limits/Rules indicators */}
                <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
                  <div className="flex items-center gap-2 p-2 border border-border/40 rounded bg-card">
                    <FileText size={16} className="text-muted-foreground" />
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">Títulos em Aberto</span>
                      <span className="text-sm font-bold">
                        {XActiveClientInfo.qt_tit_aberto_real ?? 0}
                        <span className="text-xs text-muted-foreground font-normal"> / máx {XActiveClientInfo.qt_tit_aberto}</span>
                      </span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 p-2 border rounded ${
                    (XActiveClientInfo.qt_tit_vencido_real ?? 0) > 0 ? "border-destructive/30 bg-destructive/5" : "border-border/40 bg-card"
                  }`}>
                    <AlertTriangle size={16} className={(XActiveClientInfo.qt_tit_vencido_real ?? 0) > 0 ? "text-destructive" : "text-muted-foreground"} />
                    <div>
                      <span className="text-[10px] text-muted-foreground block font-medium">Títulos Vencidos</span>
                      <span className={`text-sm font-bold ${(XActiveClientInfo.qt_tit_vencido_real ?? 0) > 0 ? "text-destructive" : ""}`}>
                        {XActiveClientInfo.qt_tit_vencido_real ?? 0}
                        <span className="text-xs text-muted-foreground font-normal"> / máx {XActiveClientInfo.qt_tit_vencido}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-grid: Open Titles List */}
              <div className="flex-1 border border-border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 border-b border-border bg-secondary/20 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <FileText size={13} /> Títulos em Aberto (Contas a Receber)
                </div>
                <div className="flex-1 min-h-[200px]">
                  <DataGrid
                    columns={XTitleCols}
                    data={XActiveClientTitles}
                    maxHeight="250px"
                    exportTitle={`Titulos Abertos - ${XActiveClientInfo.razao_social}`}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-card h-80 text-center text-muted-foreground">
              <User size={32} className="opacity-30 mb-3" />
              <p className="text-sm font-semibold">Nenhum Pedido Selecionado</p>
              <p className="text-xs max-w-[200px] mt-1">Clique em uma linha da listagem de pedidos para ver os detalhes da análise de crédito do cliente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiberacaoPedidosForm;
