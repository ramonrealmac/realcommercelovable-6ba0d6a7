import React, { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { useGridFilter } from "@/hooks/useGridFilter";

import { 
  FileText, 
  RefreshCw, 
  Printer, 
  Download, 
  Send, 
  XCircle, 
  Eye, 
  Terminal,
  Lock,
  Plus
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";

import { mdfeEmissaoService } from "../services/mdfeEmissaoService";
import MdfeCloseDialog from "./dialogs/MdfeCloseDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";
import MonitorFiscalLogDialog from "@/components/forms/fiscal/MonitorFiscalLogDialog";

const db = supabase as any;

const XGridCols: IGridColumn[] = [
  { key: "mdf_manifesto_id", label: "ID", width: "70px", align: "right" },
  { key: "numero", label: "Número", width: "90px" },
  { key: "serie", label: "Série", width: "60px", align: "center" },
  { 
    key: "tp_amb", 
    label: "Ambiente", 
    width: "100px", 
    render: r => (
      <span className={String(r.tp_amb || '2') === "1" ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
        {String(r.tp_amb || '2') === "1" ? "Produção" : "Homologação"}
      </span>
    )
  },
  { key: "dt_emissao", label: "Emissão", width: "110px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "ufini", label: "UF Ini", width: "70px", align: "center" },
  { key: "uffim", label: "UF Fim", width: "70px", align: "center" },
  { key: "peso_total", label: "Peso", width: "100px", align: "right", render: r => Number(r.peso_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 }) },
  { key: "valor_total", label: "Valor", width: "110px", align: "right", render: r => Number(r.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { 
    key: "status", 
    label: "Status", 
    width: "140px", 
    render: r => {
      const labels: any = {
        "A": "Autorizado",
        "C": "Cancelado",
        "E": "Encerrado",
        "D": "Digitação",
        "R": "Rejeitado"
      };
      const label = labels[r.status] || r.status || "Digitação";
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          r.status === "A" ? "bg-green-100 text-green-700" :
          r.status === "C" ? "bg-red-100 text-red-700" :
          r.status === "E" ? "bg-purple-100 text-purple-700" : 
          r.status === "R" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"
        }`}>
          {label}
        </span>
      );
    }
  },
];

const ListaMdfeForm: React.FC = () => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  
  const [XLogDialogOpen, setXLogDialogOpen] = useState(false);
  const [XLogMdfId, setXLogMdfId] = useState<number | undefined>(undefined);

  const [XCloseDialogOpen, setXCloseDialogOpen] = useState(false);
  const [XCloseTarget, setXCloseTarget] = useState<any>(null);
  const [XClosing, setXClosing] = useState(false);

  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number }>({ open: false, titulo: "", total: 60 });

  const loadData = async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      const { data, error } = await db.from("fiscal_mdf_manifesto")
        .select("*")
        .eq("empresa_id", XEmpresaId)
        .gte("dt_emissao", XDtIni)
        .lte("dt_emissao", XDtFim)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setXData(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar manifestos: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const ch = (supabase as any).channel('mdfe_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_mdf_manifesto', filter: `empresa_id=eq.${XEmpresaId}` }, () => loadData())
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [XEmpresaId, XDtIni, XDtFim]);

  const XFilteredData = useGridFilter(XData, XSearchFilters);

  const handleTransmitir = async (row: any) => {
    if (!XEmpresaId) return;
    if (["A", "C", "E"].includes(String(row.status))) {
      toast.error("Documento já finalizado.");
      return;
    }
    toast.info("Enfileirando transmissão...");
    const res = await mdfeEmissaoService.emitirMdfe(row.mdf_manifesto_id, XEmpresaId);
    if (res.success) {
      toast.success("Evento de transmissão criado.");
      loadData();
    } else {
      toast.error("Falha: " + (res.message || "erro desconhecido"));
    }
  };

  const handleOpenCloseDialog = (row: any) => {
    if (row.status !== "A") {
      toast.error("Apenas manifestos autorizados podem ser encerrados.");
      return;
    }
    setXCloseTarget(row);
    setXCloseDialogOpen(true);
  };

  const handleConfirmClose = async (params: any) => {
    setXClosing(true);
    try {
      setXProg({ open: true, titulo: "Encerrando MDF-e...", total: 45 });
      const res = await mdfeEmissaoService.encerrarMdfe(XCloseTarget.mdf_manifesto_id, XEmpresaId, params);
      setXProg(p => ({ ...p, open: false }));
      if (res.success) {
        toast.success("MDF-e encerrado com sucesso!");
        setXCloseDialogOpen(false);
        loadData();
      } else {
        toast.error("Falha ao encerrar: " + res.mensagem);
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error(e.message);
    } finally {
      setXClosing(false);
    }
  };

  return (
    <>
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-600/10 rounded-lg text-purple-600">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Gerenciador Fiscal de MDF-e</h2>
            <p className="text-xs text-muted-foreground">Manifesto Eletrônico de Documentos Fiscais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => openTab({ title: "Novo MDF-e", component: "mdfe-form" })}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> NOVO MANIFESTO
          </button>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        <DataGrid 
          columns={[
            ...XGridCols,
            {
              key: "acoes",
              label: "Ações",
              width: "150px",
              render: r => (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] bg-secondary text-secondary-foreground px-2 py-1 rounded border border-border hover:bg-secondary/80 transition-colors font-bold uppercase shadow-sm">
                        Opções
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleTransmitir(r)} disabled={["A", "C", "E"].includes(r.status)}>
                        <Send className="w-4 h-4 mr-2 text-blue-500" /> Transmitir SEFAZ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenCloseDialog(r)} disabled={r.status !== "A"}>
                        <Lock className="w-4 h-4 mr-2 text-purple-500" /> Encerrar MDF-e
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setXLogMdfId(r.mdf_manifesto_id); setXLogDialogOpen(true); }}>
                        <Terminal className="w-4 h-4 mr-2 text-indigo-500" /> Log de Transmissão
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openTab({ title: `MDF-e #${r.numero || r.mdf_manifesto_id}`, component: "mdfe-form", params: { mdf_manifesto_id: r.mdf_manifesto_id } })}>
                        <Eye className="w-4 h-4 mr-2 text-primary" /> Editar / Ver
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            }
          ]}
          data={XFilteredData}
          maxHeight="calc(100vh - 240px)"
          showFilters
          filterValues={XSearchFilters}
          onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
          toolbarLeft={
            <div className="flex items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-border mr-4">
               <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Início</span>
                <input type="date" value={XDtIni} onChange={e => setXDtIni(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-24" />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Fim</span>
                <input type="date" value={XDtFim} onChange={e => setXDtFim(e.target.value)} className="bg-transparent border-none text-xs p-0 focus:ring-0 w-24" />
              </div>
              <button onClick={loadData} className="ml-2 p-1.5 hover:bg-secondary rounded-md"><RefreshCw className={`w-4 h-4 ${XLoading ? 'animate-spin' : ''}`} /></button>
            </div>
          }
        />
      </div>
    </div>

    <MdfeCloseDialog 
      isOpen={XCloseDialogOpen}
      onClose={() => setXCloseDialogOpen(false)}
      onConfirm={handleConfirmClose}
      loading={XClosing}
      empresaId={XEmpresaId || 0}
    />

    <MonitorFiscalLogDialog 
      isOpen={XLogDialogOpen} 
      onClose={() => setXLogDialogOpen(false)}
      empresaId={XEmpresaId || 0}
      mdfManifestoId={XLogMdfId}
    />

    <FiscalProgressDialog
      open={XProg.open}
      titulo={XProg.titulo}
      segundosTotais={XProg.total}
      selfTick
    />
    </>
  );
};

export default ListaMdfeForm;
