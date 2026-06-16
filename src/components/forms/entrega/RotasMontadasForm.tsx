/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  RefreshCw, 
  Route, 
  Truck, 
  User, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  ClipboardList,
  AlertTriangle,
  FileText,
  MapPin,
  Play,
  Check,
  Ban
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";
import { formatCPFCNPJ } from "@/lib/validators";

const db = supabase as any;

interface IRouteRow {
  entrega_id: number;
  cd_entrega: number;
  dt_inicio: string;
  dt_fim: string | null;
  rota: string;
  observacoes: string | null;
  status: string;
  veiculo_id: number | null;
  motorista_id: number | null;
  placa?: string | null;
  veiculoDesc?: string | null;
  motoristaNome?: string | null;
}

interface IRouteStopRow {
  entrega_item_id: number;
  entrega_id: number;
  movimento_id: number;
  status_entrega: string;
  ordem_sequencia: number;
  nr_movimento?: number;
  dt_emissao?: string | null;
  vl_movimento?: number | null;
  clienteNome?: string;
  clienteCpfCnpj?: string | null;
}

const fmtMoney = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const RotasMontadasForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Filters State
  const [XStatusFiltro, setXStatusFiltro] = useState<string>("T"); // 'T' = Todos, 'P' = Pendente, 'R' = Em Rota, 'C' = Concluida

  // Master Grid State
  const [XRoutes, setXRoutes] = useState<IRouteRow[]>([]);
  const [XActiveIdx, setXActiveIdx] = useState<number | null>(null);
  const [XLoadingMaster, setXLoadingMaster] = useState<boolean>(false);

  // Detail Grid State
  const [XStops, setXStops] = useState<IRouteStopRow[]>([]);
  const [XLoadingDetail, setXLoadingDetail] = useState<boolean>(false);

  // Selected Route Record
  const XSelectedRoute = useMemo(() => {
    if (XActiveIdx !== null && XActiveIdx < XRoutes.length) {
      return XRoutes[XActiveIdx];
    }
    return null;
  }, [XActiveIdx, XRoutes]);

  // Load stops / items for a selected route
  const loadRouteDetails = useCallback(async (entregaId: number) => {
    setXLoadingDetail(true);
    try {
      const { data: stopData, error: stopErr } = await db.from("entrega_item")
        .select("entrega_item_id, entrega_id, movimento_id, status_entrega, ordem_sequencia")
        .eq("entrega_id", entregaId)
        .eq("excluido", false)
        .order("ordem_sequencia", { ascending: true });

      if (stopErr) throw stopErr;

      const stops: IRouteStopRow[] = stopData || [];

      // Fetch order details for the stops
      const movIds = stops.map(s => s.movimento_id);
      if (movIds.length > 0) {
        const { data: movRes, error: movErr } = await db.from("movimento")
          .select("movimento_id, nr_movimento, dt_emissao, vl_movimento, cadastro_id")
          .in("movimento_id", movIds);

        if (movErr) throw movErr;

        const movMap = new Map<number, any>((movRes || []).map((m: any) => [m.movimento_id, m]));

        // Fetch client details
        const cadIds = Array.from(new Set((movRes || []).map((m: any) => m.cadastro_id).filter(Boolean)));
        let cadMap = new Map<number, any>();
        if (cadIds.length > 0) {
          const { data: cadRes } = await db.from("cadastro")
            .select("cadastro_id, cnpj, razao_social")
            .in("cadastro_id", cadIds);
          cadMap = new Map<number, any>((cadRes || []).map((c: any) => [c.cadastro_id, c]));
        }

        stops.forEach(s => {
          if (movMap.has(s.movimento_id)) {
            const m = movMap.get(s.movimento_id);
            s.nr_movimento = m.nr_movimento;
            s.dt_emissao = m.dt_emissao;
            s.vl_movimento = m.vl_movimento;
            if (m.cadastro_id && cadMap.has(m.cadastro_id)) {
              const c = cadMap.get(m.cadastro_id);
              s.clienteNome = c.razao_social;
              s.clienteCpfCnpj = c.cnpj;
            }
          }
        });
      }

      setXStops(stops);
    } catch (e: any) {
      console.error("Erro ao carregar detalhes da rota:", e);
      toast.error("Erro ao carregar detalhes da rota: " + e.message);
    } finally {
      setXLoadingDetail(false);
    }
  }, []);

  // Load active routes
  const loadRoutes = useCallback(async () => {
    if (!XEmpresaId) return;
    setXLoadingMaster(true);
    setXActiveIdx(null);
    setXStops([]);
    try {
      let q = db.from("entrega")
        .select("entrega_id, cd_entrega, dt_inicio, dt_fim, rota, observacoes, status, veiculo_id, motorista_id")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .order("cd_entrega", { ascending: false });

      if (XStatusFiltro !== "T") {
        if (XStatusFiltro === "P") q = q.eq("status", "Pendente");
        if (XStatusFiltro === "R") q = q.eq("status", "Em Rota");
        if (XStatusFiltro === "C") q = q.eq("status", "Concluída");
      }

      const { data, error } = await q;
      if (error) throw error;

      const routes: IRouteRow[] = data || [];

      // Fetch driver and vehicle names
      const motIds = Array.from(new Set(routes.map(r => r.motorista_id).filter(Boolean)));
      const veicIds = Array.from(new Set(routes.map(r => r.veiculo_id).filter(Boolean)));

      let motMap = new Map<number, any>();
      if (motIds.length > 0) {
        const { data: motRes } = await db.from("cadastro_motorista")
          .select("motorista_id, nome")
          .in("motorista_id", motIds);
        motMap = new Map<number, any>((motRes || []).map((m: any) => [m.motorista_id, m]));
      }

      let veicMap = new Map<number, any>();
      if (veicIds.length > 0) {
        const { data: veicRes } = await db.from("cadastro_veiculo")
          .select("veiculo_id, placa, descricao")
          .in("veiculo_id", veicIds);
        veicMap = new Map<number, any>((veicRes || []).map((v: any) => [v.veiculo_id, v]));
      }

      routes.forEach(r => {
        if (r.motorista_id && motMap.has(r.motorista_id)) {
          r.motoristaNome = motMap.get(r.motorista_id).nome;
        }
        if (r.veiculo_id && veicMap.has(r.veiculo_id)) {
          const v = veicMap.get(r.veiculo_id);
          r.placa = v.placa;
          r.veiculoDesc = v.descricao;
        }
      });

      setXRoutes(routes);
    } catch (e: any) {
      console.error("Erro ao carregar minutas de entrega:", e);
      toast.error("Erro ao carregar minutas: " + e.message);
    } finally {
      setXLoadingMaster(false);
    }
  }, [XEmpresaId, XStatusFiltro]);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes]);

  const handleRowClick = (row: any, idx: number) => {
    setXActiveIdx(idx);
    loadRouteDetails(row.entrega_id);
  };

  // Route status update actions
  const handleStartRoute = async () => {
    if (!XSelectedRoute) return;
    try {
      const { error } = await db.from("entrega")
        .update({ status: "Em Rota", dt_alteracao: new Date().toISOString() })
        .eq("entrega_id", XSelectedRoute.entrega_id);
      
      if (error) throw error;
      toast.success(`Minuta de Entrega #${XSelectedRoute.cd_entrega} agora está Em Rota.`);
      
      // Update local state status
      setXRoutes(prev => prev.map(r => r.entrega_id === XSelectedRoute.entrega_id ? { ...r, status: "Em Rota" } : r));
    } catch (e: any) {
      toast.error("Erro ao iniciar rota: " + e.message);
    }
  };

  const handleCancelRoute = async () => {
    if (!XSelectedRoute) return;
    if (!confirm(`Deseja realmente CANCELAR a Minuta de Entrega #${XSelectedRoute.cd_entrega}? Isso excluirá a rota e resetará o status de entrega dos pedidos.`)) {
      return;
    }
    try {
      // 1. Soft-delete the route
      const { error: entErr } = await db.from("entrega")
        .update({ status: "Cancelada", excluido: true, dt_alteracao: new Date().toISOString() })
        .eq("entrega_id", XSelectedRoute.entrega_id);
      if (entErr) throw entErr;

      // 2. Soft-delete all items of the route
      const { error: itemsErr } = await db.from("entrega_item")
        .update({ status_entrega: "Cancelado", excluido: true, dt_alteracao: new Date().toISOString() })
        .eq("entrega_id", XSelectedRoute.entrega_id);
      if (itemsErr) throw itemsErr;

      // 3. Reset st_entregue in movimento to 'N' for the orders in this route
      const movIds = XStops.map(s => s.movimento_id);
      if (movIds.length > 0) {
        const { error: movErr } = await db.from("movimento")
          .update({ st_entregue: "N", dt_alteracao: new Date().toISOString() })
          .in("movimento_id", movIds);
        if (movErr) throw movErr;
      }

      toast.success(`Minuta de Entrega #${XSelectedRoute.cd_entrega} cancelada e excluída.`);
      await loadRoutes();
    } catch (e: any) {
      toast.error("Erro ao cancelar rota: " + e.message);
    }
  };

  const handleConcludeRoute = async () => {
    if (!XSelectedRoute) return;
    
    // Check if there are still pending stops
    const pendingStops = XStops.filter(s => s.status_entrega === "Pendente");
    if (pendingStops.length > 0) {
      if (!confirm(`Existem ${pendingStops.length} paradas com situação Pendente. Deseja marcar TODAS como Entregues e finalizar a rota?`)) {
        return;
      }
      
      // Auto-deliver all pending stops
      try {
        const pendingMovIds = pendingStops.map(s => s.movimento_id);
        const pendingItemIds = pendingStops.map(s => s.entrega_item_id);

        // Update items
        const { error: updateItemsErr } = await db.from("entrega_item")
          .update({ status_entrega: "Entregue", dt_alteracao: new Date().toISOString() })
          .in("entrega_item_id", pendingItemIds);
        if (updateItemsErr) throw updateItemsErr;

        // Update orders
        const { error: updateMovsErr } = await db.from("movimento")
          .update({ st_entregue: "S", dt_alteracao: new Date().toISOString() })
          .in("movimento_id", pendingMovIds);
        if (updateMovsErr) throw updateMovsErr;

      } catch (e: any) {
        toast.error("Erro ao liquidar paradas pendentes: " + e.message);
        return;
      }
    }

    try {
      const { error } = await db.from("entrega")
        .update({ 
          status: "Concluída", 
          dt_fim: new Date().toISOString(),
          dt_alteracao: new Date().toISOString() 
        })
        .eq("entrega_id", XSelectedRoute.entrega_id);
      
      if (error) throw error;
      toast.success(`Minuta de Entrega #${XSelectedRoute.cd_entrega} concluída e encerrada com sucesso.`);
      await loadRoutes();
    } catch (e: any) {
      toast.error("Erro ao concluir rota: " + e.message);
    }
  };

  // Individual stop action confirmation (Baixa individual)
  const handleConfirmStop = async (stopRow: IRouteStopRow, status: "Entregue" | "Devolvido") => {
    try {
      // 1. Update status in entrega_item
      const { error: itemErr } = await db.from("entrega_item")
        .update({ status_entrega: status, dt_alteracao: new Date().toISOString() })
        .eq("entrega_item_id", stopRow.entrega_item_id);
      if (itemErr) throw itemErr;

      // 2. Update st_entregue in movimento ('S' for delivered, 'N' for returned)
      const stEntregueVal = status === "Entregue" ? "S" : "N";
      const { error: movErr } = await db.from("movimento")
        .update({ st_entregue: stEntregueVal, dt_alteracao: new Date().toISOString() })
        .eq("movimento_id", stopRow.movimento_id);
      if (movErr) throw movErr;

      toast.success(`Pedido #${stopRow.nr_movimento} baixado como ${status}.`);
      
      // Reload details locally
      if (XSelectedRoute) {
        await loadRouteDetails(XSelectedRoute.entrega_id);
      }
    } catch (e: any) {
      console.error("Erro ao dar baixa na entrega do item:", e);
      toast.error("Erro ao dar baixa: " + e.message);
    }
  };

  // Master Grid Columns
  const XCols: IGridColumn[] = useMemo(() => [
    { key: "cd_entrega", label: "Minuta", width: "90px", align: "right" },
    { key: "status", label: "Status", width: "115px", align: "center",
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          r.status === "Pendente" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" :
          r.status === "Em Rota" ? "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400 animate-pulse" :
          r.status === "Concluída" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" :
          "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          {r.status}
        </span>
      )
    },
    { key: "dt_inicio", label: "Saída/Cadastro", width: "135px", align: "center", render: (r: any) => fmtDate(r.dt_inicio) },
    { key: "dt_fim", label: "Conclusão", width: "135px", align: "center", render: (r: any) => r.dt_fim ? fmtDate(r.dt_fim) : "-" },
    { key: "rota", label: "Rota", width: "1fr" },
    { key: "motoristaNome", label: "Motorista", width: "1.2fr", render: (r: any) => r.motoristaNome ?? "Não informado" },
    { key: "placa", label: "Veículo (Placa)", width: "110px", align: "center", render: (r: any) => r.placa ? `${r.placa}` : "N/D" },
  ], []);

  // Stops Subgrid Columns
  const XStopCols: IGridColumn[] = useMemo(() => [
    { key: "ordem_sequencia", label: "Parada", width: "70px", align: "center", render: (r: any) => `#${r.ordem_sequencia}` },
    { key: "nr_movimento", label: "Pedido", width: "80px", align: "right" },
    { key: "clienteNome", label: "Cliente", width: "2fr" },
    { key: "vl_movimento", label: "Valor Total", width: "105px", align: "right", render: (r: any) => fmtMoney(r.vl_movimento) },
    { 
      key: "status_entrega", label: "Entrega Stop", width: "110px", align: "center",
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          r.status_entrega === "Pendente" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400" :
          r.status_entrega === "Entregue" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" :
          "bg-destructive/15 text-destructive dark:bg-destructive/10"
        }`}>
          {r.status_entrega}
        </span>
      )
    },
    {
      key: "_actions", label: "Ações / Baixa", width: "155px", align: "center",
      render: (r: any) => {
        const isRouteActive = XSelectedRoute?.status === "Em Rota";
        const isPending = r.status_entrega === "Pendente";
        
        if (!isRouteActive || !isPending) return <span className="text-muted-foreground text-[10px]">-</span>;

        return (
          <div className="flex gap-1 justify-center">
            <button
              onClick={() => handleConfirmStop(r, "Entregue")}
              className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm"
            >
              <Check size={10} /> Entregar
            </button>
            <button
              onClick={() => handleConfirmStop(r, "Devolvido")}
              className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold border border-destructive text-destructive hover:bg-destructive/5 rounded"
            >
              <Ban size={10} /> Devolver
            </button>
          </div>
        );
      }
    }
  ], [XSelectedRoute]);

  return (
    <div className="p-4 h-full overflow-auto space-y-4 bg-background">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Rotas Montadas & Baixas de Entrega</h2>
          <p className="text-xs text-muted-foreground">Monitore o andamento das minutas de entrega, inicie rotas e dê baixa nos pedidos entregues.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={XStatusFiltro}
            onChange={(e) => setXStatusFiltro(e.target.value)}
            className="border border-border rounded px-2.5 py-1.5 text-xs bg-card outline-none focus:ring-2 focus:ring-ring font-semibold"
          >
            <option value="T">Todos Status</option>
            <option value="P">Pendente</option>
            <option value="R">Em Rota</option>
            <option value="C">Concluída</option>
          </select>
          <button
            onClick={loadRoutes}
            disabled={XLoadingMaster}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-all"
          >
            <RefreshCw size={13} className={XLoadingMaster ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* MASTER-DETAIL LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left Side: Master Route List (span 2) */}
        <div className="xl:col-span-2 flex flex-col gap-3">
          <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-[350px]">
            <DataGrid
              columns={XCols}
              data={XRoutes}
              selectedIdx={XActiveIdx}
              onRowClick={(row, idx) => handleRowClick(row, idx)}
              maxHeight="calc(100vh - 220px)"
              exportTitle="Relatorio de Minutas de Entregas"
            />
          </div>
        </div>

        {/* Right Side: Route Stop Details & Controls */}
        <div className="flex flex-col gap-4">
          {XSelectedRoute ? (
            <>
              {/* Route Control Panel */}
              <div className="border border-border rounded-lg bg-card shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                    <Route size={16} />
                    <span>Minuta de Entrega #{XSelectedRoute.cd_entrega}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    XSelectedRoute.status === "Pendente" ? "bg-amber-100 text-amber-800" :
                    XSelectedRoute.status === "Em Rota" ? "bg-blue-100 text-blue-800" :
                    "bg-emerald-100 text-emerald-800"
                  }`}>
                    {XSelectedRoute.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Rota / Região:</span>
                    <span className="font-semibold text-foreground">{XSelectedRoute.rota}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1"><User size={11} /> Motorista:</span>
                    <span className="font-semibold text-foreground">{XSelectedRoute.motoristaNome ?? "Não informado"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground flex items-center gap-1"><Truck size={11} /> Veículo (Placa):</span>
                    <span className="font-semibold text-foreground">{XSelectedRoute.placa ? `${XSelectedRoute.placa} ${XSelectedRoute.veiculoDesc ? `(${XSelectedRoute.veiculoDesc})` : ""}` : "Não informado"}</span>
                  </div>
                  {XSelectedRoute.observacoes && (
                    <div className="pt-1.5">
                      <span className="text-muted-foreground block mb-0.5">Observações:</span>
                      <p className="p-2 bg-secondary/35 rounded border border-border/50 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">{XSelectedRoute.observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Control Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-border/50">
                  {XSelectedRoute.status === "Pendente" && (
                    <button
                      onClick={handleStartRoute}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                    >
                      <Play size={13} /> Iniciar Viagem
                    </button>
                  )}
                  {XSelectedRoute.status === "Em Rota" && (
                    <button
                      onClick={handleConcludeRoute}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                    >
                      <CheckCircle size={13} /> Concluir Rota
                    </button>
                  )}
                  {XSelectedRoute.status !== "Concluída" && (
                    <button
                      onClick={handleCancelRoute}
                      className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded border border-destructive text-destructive hover:bg-destructive/5 transition-all"
                    >
                      <XCircle size={13} /> Cancelar Rota
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Grid: Paradas/Stops */}
              <div className="flex-1 border border-border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col min-h-[300px]">
                <div className="p-3 border-b border-border bg-secondary/20 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <ClipboardList size={13} /> Sequência de Paradas ({XStops.length})
                </div>
                <div className="flex-1 overflow-auto">
                  <DataGrid
                    columns={XStopCols}
                    data={XStops}
                    maxHeight="calc(100vh - 430px)"
                    exportTitle={`Paradas da Minuta ${XSelectedRoute.cd_entrega}`}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-card h-80 text-center text-muted-foreground">
              <Route size={32} className="opacity-30 mb-3" />
              <p className="text-sm font-semibold">Nenhuma Minuta Selecionada</p>
              <p className="text-xs max-w-[200px] mt-1">Selecione uma minuta de entrega na listagem ao lado para gerenciar as paradas e dar baixas.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RotasMontadasForm;
