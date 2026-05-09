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
  Clock,
  Terminal
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import MonitorFiscalLogDialog from "@/components/forms/MonitorFiscalLogDialog";
const db = supabase as any;

interface IClienteInfo { id: number; razao: string; }

const LiestaNfeEmitidaForm: React.FC<{ initialFilterId?: number }> = ({ initialFilterId }) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XClienteCache, setXClienteCache] = useState<Record<number, string>>({});
  const [XLogDialogOpen, setXLogDialogOpen] = useState(false);
  const [XLogNfeId, setXLogNfeId] = useState<number | undefined>(undefined);

  const XGridCols: IGridColumn[] = [
    { key: "nfe_cabecalho_id", label: "ID", width: "60px", align: "right" },
    { key: "tp_nf", label: "Tipo", width: "80px", render: r => r.tp_nf === 0 ? <span className="text-blue-600 font-bold">ENTRADA</span> : <span className="text-emerald-600 font-bold">SAÍDA</span> },
    { key: "nr_nota", label: "Número", width: "90px" },
    { key: "modelo", label: "Modelo", width: "60px", align: "center" },
    { key: "serie", label: "Série", width: "50px", align: "center" },
    { key: "dt_emissao", label: "Emissão", width: "100px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
    { key: "dt_saida", label: "Saída", width: "100px", render: r => r.dt_saida ? new Date(r.dt_saida).toLocaleDateString("pt-BR") : "" },
    { key: "cfop", label: "CFOP", width: "70px", align: "center" },
    { 
      key: "cadastro_id", 
      label: "Destinatário", 
      width: "2fr", 
      render: r => XClienteCache[r.cadastro_id] || (r.cadastro_id ? `#${r.cadastro_id}` : "") 
    },
      { 
        key: "vl_total_nf", 
        label: "Valor Total", 
        width: "110px", 
        align: "right", 
        render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) 
      },
      { 
        key: "st_nf", 
        label: "Status", 
        width: "140px", 
        render: r => {
          const statusMap: any = {
            "A": { label: "Pendente", color: "bg-gray-100 text-gray-600", icon: Clock },
            "E": { label: "Transmitida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
            "C": { label: "Cancelada", color: "bg-red-100 text-red-700", icon: XCircle },
            "0": { label: "Pendente", color: "bg-gray-100 text-gray-600", icon: Clock },
            "1": { label: "Transmitida", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
            "2": { label: "Cancelada", color: "bg-red-100 text-red-700", icon: XCircle },
            "3": { label: "Erro SEFAZ", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
          };
          const s = statusMap[r.st_nf] || { label: r.st_nf, color: "bg-gray-100 text-gray-600", icon: Clock };
          const Icon = s.icon;
          return (
            <div className={`px-2 py-1 rounded-full ${s.color} border-none flex items-center gap-1 font-bold uppercase text-[9px] w-fit`}>
              <Icon size={10} />
              {s.label}
            </div>
          );
        }
      },
      { key: "chave_nfe", label: "Chave de Acesso", width: "300px", render: r => <span className="font-mono text-[10px] text-muted-foreground">{r.chave_nfe}</span> },
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
      const rows = data || [];
      setXData(rows);

      // Carregar nomes dos destinatários
      const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
      if (ids.length > 0) {
        const { data: parceiros } = await db.from("cadastro")
          .select("cadastro_id,razao_social")
          .in("cadastro_id", ids);
        if (parceiros) {
          const cache: Record<number, string> = {};
          parceiros.forEach((p: any) => cache[p.cadastro_id] = p.razao_social);
          setXClienteCache(prev => ({ ...prev, ...cache }));
        }
      }
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

  const handleDownloadXml = (row: any) => {
    toast.info("Baixando XML da nota " + row.nr_nota + "...");
    // Aqui seria a lógica de download do storage ou API
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
                      <DropdownMenuItem onClick={() => handleDownloadXml(r)}>
                        <Download className="w-4 h-4 mr-2 text-blue-400" /> Baixar XML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTab({ title: `NF-e #${r.nr_nota || r.nfe_cabecalho_id}`, component: "nfe-form", params: { nfe_cabecalho_id: r.nfe_cabecalho_id } })}>
                        <Eye className="w-4 h-4 mr-2 text-primary" /> Visualizar Documento
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setXLogNfeId(r.nfe_cabecalho_id); setXLogDialogOpen(true); }}>
                        <Terminal className="w-4 h-4 mr-2 text-indigo-500" /> Log
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTab({ title: `CCe NF-e ${r.nr_nota || r.nfe_cabecalho_id}`, component: "cce", params: { nfe_cabecalho_id: r.nfe_cabecalho_id } })}>
                        <FileText className="w-4 h-4 mr-2 text-amber-500" /> Carta de Correção
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Nota
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {r.st_nf === "1" && (
                    <button 
                      onClick={() => handleDownloadXml(r)}
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

export default LiestaNfeEmitidaForm;
