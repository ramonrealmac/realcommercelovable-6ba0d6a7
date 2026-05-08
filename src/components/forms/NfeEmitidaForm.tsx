import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { 
  FileText, 
  Send, 
  XCircle, 
  Printer, 
  RefreshCw, 
  Eye, 
  Download,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;

const NfeEmitidaForm: React.FC<{ initialFilterId?: number }> = ({ initialFilterId }) => {
  const { XEmpresaId } = useAppContext();
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));

  const XGridCols: IGridColumn[] = [
    { key: "nr_nota", label: "Número", width: "100px" },
    { key: "serie", label: "Série", width: "60px", align: "center" },
    { key: "dt_emissao", label: "Emissão", width: "110px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
    { key: "nat_op", label: "Natureza Operação", width: "1.5fr" },
    { key: "vl_total_nf", label: "Valor Total", width: "120px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
    { 
      key: "st_nf", 
      label: "Status", 
      width: "150px", 
      render: r => {
        const statusMap: any = {
          "0": { label: "Pendente", color: "bg-gray-100 text-gray-600", icon: Clock },
          "1": { label: "Transmitida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
          "2": { label: "Cancelada", color: "bg-red-100 text-red-700", icon: XCircle },
          "3": { label: "Erro SEFAZ", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
        };
        const s = statusMap[r.st_nf] || { label: r.st_nf, color: "bg-gray-100 text-gray-600", icon: Clock };
        const Icon = s.icon;
        return (
          <Badge className={`${s.color} border-none flex items-center gap-1 font-bold uppercase text-[10px]`}>
            <Icon size={12} />
            {s.label}
          </Badge>
        );
      }
    },
  ];

  const loadData = async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      let query = db.from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("empresa_id", XEmpresaId);

      if (initialFilterId) {
        query = query.eq("nfe_cabecalho_id", initialFilterId);
      } else {
        if (XDtIni) query = query.gte("dt_emissao", XDtIni);
        if (XDtFim) query = query.lte("dt_emissao", XDtFim);
      }

      const { data, error } = await query.order("nfe_cabecalho_id", { ascending: false });

      if (error) throw error;
      setXData(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar NFes: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [XEmpresaId, initialFilterId]);

  const handleTransmitir = async (row: any) => {
    toast.info("A transmissão será realizada pelo Fiscal Worker...");
    // Apenas um exemplo, aqui você poderia disparar um evento ou atualizar um status para o worker pegar
    // const { error } = await db.from("fiscal_nfe_cabecalho").update({ st_nf: "0" }).eq("nfe_cabecalho_id", row.nfe_cabecalho_id);
  };

  const handleImprimir = (row: any) => {
    toast.info("Imprimindo DANFE...");
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">NF-e / NFC-e Emitidas</h2>
            <p className="text-xs text-muted-foreground">Gestão de documentos fiscais próprios</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadData}
            disabled={XLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${XLoading ? "animate-spin" : ""}`} />
            ATUALIZAR
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
              width: "180px",
              render: r => (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] bg-primary text-primary-foreground px-2 py-1 rounded border border-border hover:opacity-90 transition-opacity font-bold uppercase shadow-sm">
                        Opções
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleTransmitir(r)}>
                        <Send className="w-4 h-4 mr-2 text-blue-500" /> Transmitir SEFAZ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(r)}>
                        <Printer className="w-4 h-4 mr-2 text-gray-500" /> Imprimir DANFE
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {}}>
                        <Eye className="w-4 h-4 mr-2 text-primary" /> Visualizar Dados
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Nota
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {r.st_nf === "1" && (
                    <button 
                      onClick={() => {}}
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                      title="Download XML"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            }
          ]}
          data={XData}
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
            </div>
          }
        />
      </div>
    </div>
  );
};

export default NfeEmitidaForm;
