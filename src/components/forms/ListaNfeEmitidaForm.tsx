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
  Mail, 
  Send, 
  XCircle, 
  Eye, 
  Terminal,
  MoreHorizontal,
  FileX,
  CheckSquare
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { formatCPFCNPJ } from "@/lib/validators";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import MonitorFiscalLogDialog from "@/components/forms/MonitorFiscalLogDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";

interface IProps {
  initialFilterId?: string | number;
}


const db = supabase as any;

const XGridCols: IGridColumn[] = [
  { key: "movimento_id", label: "ID Mov", width: "80px", align: "center" },
  { key: "nr_nota", label: "Nota", width: "100px" },
  { key: "serie", label: "Série", width: "60px", align: "center" },
  { 
    key: "tp_amb", 
    label: "Ambiente", 
    width: "100px", 
    render: r => (
      <span className={String(r.tp_amb) === "1" ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
        {String(r.tp_amb) === "1" ? "Produção" : "Homologação"}
      </span>
    )
  },
  { key: "modelo", label: "Mod.", width: "50px", align: "center" },
  { 
    key: "tp_nf", 
    label: "Tipo", 
    width: "70px", 
    render: r => (
      <span className={String(r.tp_nf) === "0" ? "text-blue-600 font-medium" : "text-emerald-600 font-medium"}>
        {String(r.tp_nf) === "0" ? "Entrada" : "Saída"}
      </span>
    )
  },
  { 
    key: "fin_nfe", 
    label: "Finalidade", 
    width: "110px", 
    render: r => {
      const labels: any = { "1": "Normal", "2": "Complementar", "3": "Ajuste", "4": "Devolução" };
      const colors: any = { 
        "1": "text-slate-600", 
        "2": "text-blue-600", 
        "3": "text-amber-600", 
        "4": "text-purple-600" 
      };
      const label = labels[String(r.fin_nfe)] || r.fin_nfe;
      return (
        <span className={`font-bold ${colors[String(r.fin_nfe)] || "text-gray-600"}`}>
          {label}
        </span>
      );
    }
  },
  { key: "dt_emissao", label: "Emissão", width: "110px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "nm_destinatario", label: "Destinatário", width: "250px" },
  { key: "cnpj_destinatario", label: "CNPJ/CPF", width: "150px", render: r => formatCPFCNPJ(r.cnpj_destinatario) },
  { key: "vl_total_nf", label: "Valor", width: "120px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "140px", 
    render: r => {
      const labels: any = {
        "E": "Autorizada",
        "C": "Cancelada",
        "D": "Denegada",
        "P": "Pendente",
        "A": "Aguardando",
        "R": "Rejeitada",
        "1": "Autorizada",
        "2": "Denegada"
      };
      const label = labels[r.st_nf] || r.st_nf || "Pendente";
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
          r.st_nf === "E" || r.st_nf === "1" ? "bg-green-100 text-green-700" :
          r.st_nf === "C" ? "bg-red-100 text-red-700" :
          r.st_nf === "D" || r.st_nf === "2" ? "bg-orange-100 text-orange-700" : 
          r.st_nf === "R" ? "bg-red-100 text-red-700" :
          r.st_nf === "A" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
        }`}>
          {label}
        </span>
      );
    }
  },
];

const ListaNfeEmitidaForm: React.FC<IProps> = ({ initialFilterId }) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  
  // Log Dialog State
  const [XLogDialogOpen, setXLogDialogOpen] = useState(false);
  const [XLogNfeId, setXLogNfeId] = useState<number | undefined>(undefined);

  // Email Dialog State
  const [XEmailDialogOpen, setXEmailDialogOpen] = useState(false);
  const [XEmailTarget, setXEmailTarget] = useState<any>(null);
  const [XEmailDestino, setXEmailDestino] = useState("");
  const [XEmailEnviando, setXEmailEnviando] = useState(false);

  // Cancel Dialog State
  const [XCancelDialogOpen, setXCancelDialogOpen] = useState(false);
  const [XCancelTarget, setXCancelTarget] = useState<any>(null);
  const [XCancelJustificativa, setXCancelJustificativa] = useState("");
  const [XCancelando, setXCancelando] = useState(false);
  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number }>({ open: false, titulo: "", total: 60 });

  // Multi-selection
  const [XSelectedIds, setXSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setXSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (filteredData: any[]) => {
    if (XSelectedIds.size === filteredData.length && filteredData.length > 0) {
      setXSelectedIds(new Set());
    } else {
      setXSelectedIds(new Set(filteredData.map(r => r.nfe_cabecalho_id)));
    }
  };

  useEffect(() => {
    if (initialFilterId) {
      setXSearchFilters(prev => ({ ...prev, nr_nota: String(initialFilterId) }));
    }
  }, [initialFilterId]);


  const loadData = async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      const { data, error } = await db.from("fiscal_nfe_cabecalho")
        .select("*, cadastro(razao_social, cnpj)")
        .eq("empresa_id", XEmpresaId)
        .gte("dt_emissao", XDtIni)
        .lte("dt_emissao", XDtFim)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const mappedData = (data || []).map((r: any) => ({
        ...r,
        nm_destinatario: r.cadastro?.razao_social || "NÃO INFORMADO",
        cnpj_destinatario: r.cadastro?.cnpj || ""
      }));

      setXData(mappedData);
    } catch (e: any) {
      toast.error("Erro ao carregar notas: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Realtime subscription para atualizar status automaticamente
    const ch = (supabase as any).channel('nfe_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_nfe_cabecalho', filter: `empresa_id=eq.${XEmpresaId}` }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_evento', filter: `empresa_id=eq.${XEmpresaId}` }, () => loadData())
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [XEmpresaId, XDtIni, XDtFim]);

  const XFilteredData = useGridFilter(XData, XSearchFilters);


  const handleTransmitir = async (row: any) => {
    if (!XEmpresaId) return;
    const statusConclusivos = ["E", "C", "D", "1", "2"];
    if (statusConclusivos.includes(String(row.st_nf))) {
      toast.error(`Esta nota está em status "${row.st_nf}" e não pode ser retransmitida.`);
      return;
    }
    toast.info("Enfileirando transmissão...");
    const res = await fiscalEmissaoService.retransmitirDocumento(row.nfe_cabecalho_id, XEmpresaId);
    if (res.success) {
      toast.success("Evento de transmissão criado.");
      loadData();
    } else {
      toast.error("Falha: " + (res.message || "erro desconhecido"));
    }
  };

  const handleValidar = async (row: any) => {
    if (!XEmpresaId) return;
    const tid = toast.loading("Validando XML contra Schemas (XSD)...");
    try {
      const res = await (fiscalEmissaoService as any).validarDocumento(row.nfe_cabecalho_id, XEmpresaId);
      if (res.success) {
        toast.success(res.message || "XML Validado com sucesso!", { id: tid });
      } else {
        toast.error(res.message || "Erro na validação do XML.", { id: tid, duration: 10000 });
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message, { id: tid });
    }
  };

  const handleImprimir = async (row: any) => {
    if (!["E", "1"].includes(String(row.st_nf))) {
      toast.error("Somente notas autorizadas podem ser impressas.");
      return;
    }
    const tid = toast.loading("Gerando DANFE...");
    try {
      const res = await fiscalEmissaoService.imprimirDocumento(row.nfe_cabecalho_id, XEmpresaId);
      if (res.success && res.pdf_base64) {
        const binaryString = atob(res.pdf_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("DANFE gerado.", { id: tid });
      } else {
        toast.error(res.message || "Erro ao gerar PDF.", { id: tid });
      }
    } catch (e: any) {
      toast.error("Erro: " + e.message, { id: tid });
    }
  };

  const handleDownloadXml = (row: any) => {
    if (!row.xml_nf) {
      toast.error("XML não localizado.");
      return;
    }
    const blob = new Blob([row.xml_nf], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NFe_${row.chave_nfe || row.nr_nota}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadXmlsSelecionados = () => {
    const selecionados = XFilteredData.filter(r => XSelectedIds.has(r.nfe_cabecalho_id));
    if (selecionados.length === 0) {
      toast.error("Nenhuma nota selecionada.");
      return;
    }
    
    const comXml = selecionados.filter(r => r.xml_nf);
    if (comXml.length === 0) {
      toast.error("Nenhum XML disponível para as notas selecionadas.");
      return;
    }

    if (comXml.length < selecionados.length) {
      toast.warning(`${selecionados.length - comXml.length} nota(s) sem XML foram ignoradas.`);
    }

    toast.info(`Iniciando download de ${comXml.length} XML(s)...`);

    comXml.forEach((row, index) => {
      setTimeout(() => {
        const blob = new Blob([row.xml_nf], { type: "text/xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `NFe_${row.chave_nfe || row.nr_nota}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, index * 300);
    });
  };

  const handleOpenEmailDialog = async (row: any) => {
    setXEmailTarget(row);
    setXEmailDestino("");
    setXEmailDialogOpen(true);
    if (row.cadastro_id) {
      const { data } = await db.from("cadastro").select("email").eq("cadastro_id", row.cadastro_id).single();
      if (data?.email) setXEmailDestino(data.email);
    }
  };

  const handleEnviarEmail = async () => {
    if (!XEmailDestino) {
      toast.error("Informe o e-mail.");
      return;
    }
    setXEmailEnviando(true);
    const tid = toast.loading("Enviando e-mail...");
    try {
      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(XEmpresaId);
      setXProg({ open: true, titulo: "Enviando e-mail...", total: totalSeg });
      const res = await fiscalEmissaoService.enviarEmail(XEmailTarget.nfe_cabecalho_id, XEmpresaId, XEmailDestino);
      setXProg(p => ({ ...p, open: false }));
      if (res.success) {
        toast.success("E-mail enfileirado.", { id: tid });
        setXEmailDialogOpen(false);
      } else {
        toast.error(res.message || "Falha no envio.", { id: tid });
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error(e.message, { id: tid });
    } finally {
      setXEmailEnviando(false);
    }
  };

  const handleOpenCancelDialog = (row: any) => {
    if (String(row.st_nf) === "C") {
      toast.error("Esta nota já está cancelada.");
      return;
    }
    if (!["E", "1"].includes(String(row.st_nf))) {
      toast.error("Apenas notas autorizadas podem ser canceladas.");
      return;
    }
    setXCancelTarget(row);
    setXCancelJustificativa("");
    setXCancelDialogOpen(true);
  };

  const handleCancelar = async () => {
    if (XCancelJustificativa.length < 15) {
      toast.error("A justificativa deve ter no mínimo 15 caracteres.");
      return;
    }
    setXCancelando(true);
    const tid = toast.loading("Enviando cancelamento para SEFAZ...");
    console.log("[ListaNfeEmitidaForm] Cancelando nota:", XCancelTarget);
    try {
      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(XEmpresaId);
      setXProg({ open: true, titulo: "Cancelando documento...", total: totalSeg });
      const res = await fiscalEmissaoService.cancelarDocumento(XCancelTarget.nfe_cabecalho_id, XEmpresaId, XCancelJustificativa);
      setXProg(p => ({ ...p, open: false }));
      if (res.success) {
        toast.success("Nota cancelada com sucesso!", { id: tid });
        setXCancelDialogOpen(false);
        loadData();
      } else {
        toast.error(res.message || "Falha ao cancelar nota.", { id: tid });
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error(e.message, { id: tid });
    } finally {
      setXCancelando(false);
    }
  };

  return (
    <>
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
          {/* O botão de atualizar foi movido para o toolbar do grid conforme solicitado */}
        </div>
      </div>

      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        <DataGrid 
          columns={[
            {
              key: "selecao",
              label: (
                <input 
                  type="checkbox" 
                  className="w-4 h-4 cursor-pointer"
                  checked={XSelectedIds.size === XFilteredData.length && XFilteredData.length > 0}
                  onChange={() => toggleSelectAll(XFilteredData)}
                />
              ),
              exportLabel: "Sel",
              width: "40px",
              align: "center",
              render: r => (
                <input 
                  type="checkbox" 
                  className="w-4 h-4 cursor-pointer"
                  checked={XSelectedIds.has(r.nfe_cabecalho_id)}
                  onChange={() => toggleSelect(r.nfe_cabecalho_id)}
                />
              )
            },
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
                      <DropdownMenuItem onClick={() => handleTransmitir(r)} disabled={["E", "C", "D", "1", "2"].includes(String(r.st_nf))}>
                        <Send className="w-4 h-4 mr-2 text-blue-500" /> Transmitir SEFAZ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleValidar(r)} disabled={["E", "C", "D", "1", "2"].includes(String(r.st_nf))}>
                        <CheckSquare className="w-4 h-4 mr-2 text-emerald-500" /> Validar XML (Schema)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(r)} disabled={!["E", "1"].includes(String(r.st_nf))}>
                        <Printer className="w-4 h-4 mr-2 text-gray-500" /> Imprimir DANFE
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadXml(r)} disabled={!r.xml_nf}>
                        <Download className="w-4 h-4 mr-2 text-blue-400" /> Baixar XML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEmailDialog(r)} disabled={!["E", "1"].includes(String(r.st_nf))}>
                        <Mail className="w-4 h-4 mr-2 text-indigo-400" /> Enviar por E-mail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setXLogNfeId(r.nfe_cabecalho_id); setXLogDialogOpen(true); }}>
                        <Terminal className="w-4 h-4 mr-2 text-indigo-500" /> Log
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openTab({ title: `CCe NF-e ${r.nr_nota || r.nfe_cabecalho_id}`, component: "cce", params: { nfe_cabecalho_id: r.nfe_cabecalho_id } })}>
                        <FileText className="w-4 h-4 mr-2 text-amber-500" /> Carta de Correção
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTab({ 
                        title: `Inutilizar ${r.nr_nota || r.nfe_cabecalho_id}`, 
                        component: "nfe-inutilizacao", 
                        params: { 
                          modelo: String(r.modelo || "55"), 
                          serie: r.serie, 
                          nr_ini: r.nr_nota, 
                          nr_fin: r.nr_nota 
                        } 
                      })}>
                        <FileX className="w-4 h-4 mr-2 text-rose-500" /> Inutilizar Numeração
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleOpenCancelDialog(r)}
                        disabled={String(r.st_nf) === "C"}
                      >
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar Nota
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openTab({ title: `NF-e #${r.nr_nota || r.nfe_cabecalho_id}`, component: "nfe-form", params: { nfe_cabecalho_id: r.nfe_cabecalho_id } })}>
                        <Eye className="w-4 h-4 mr-2 text-primary" /> Ver Detalhes
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
          onRowDoubleClick={(row) => { setXLogNfeId(row.nfe_cabecalho_id); setXLogDialogOpen(true); }}
          toolbarLeft={
            <>
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
            
            <button 
              onClick={loadData}
              disabled={XLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-secondary/50 rounded-md hover:bg-secondary transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${XLoading ? "animate-spin" : ""}`} />
              ATUALIZAR
            </button>

            {XSelectedIds.size > 0 && (
              <button 
                onClick={handleDownloadXmlsSelecionados}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm animate-in fade-in slide-in-from-left-2 duration-300"
              >
                <Download className="w-3.5 h-3.5" />
                BAIXAR XMLS ({XSelectedIds.size})
              </button>
            )}
            </>
          }
        />
      </div>
    </div>

    <MonitorFiscalLogDialog 
      isOpen={XLogDialogOpen} 
      onClose={() => setXLogDialogOpen(false)}
      empresaId={XEmpresaId || 0}
      nfeCabecalhoId={XLogNfeId}
    />

    <Dialog open={XEmailDialogOpen} onOpenChange={setXEmailDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Enviar por E-mail
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail do Destinatário</Label>
            <Input id="email" value={XEmailDestino} onChange={e => setXEmailDestino(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">O XML e o PDF serão anexados automaticamente.</p>
        </div>
        <DialogFooter>
          <button onClick={() => setXEmailDialogOpen(false)} className="px-4 py-2 text-xs font-bold bg-secondary rounded">CANCELAR</button>
          <button onClick={handleEnviarEmail} disabled={XEmailEnviando} className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded flex items-center gap-2">
            {XEmailEnviando && <RefreshCw className="w-3 h-3 animate-spin" />} ENVIAR
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={XCancelDialogOpen} onOpenChange={setXCancelDialogOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" /> Cancelar Nota Fiscal
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa de Cancelamento (Mínimo 15 caracteres)</Label>
            <textarea 
              id="justificativa" 
              className="w-full min-h-[100px] bg-background border border-input rounded-md p-2 text-sm focus:ring-1 focus:ring-primary outline-none"
              placeholder="Descreva o motivo do cancelamento..."
              value={XCancelJustificativa} 
              onChange={e => setXCancelJustificativa(e.target.value)} 
            />
          </div>
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-[11px] text-red-600 font-medium">
              Atenção: O cancelamento é irreversível e deve ser homologado pela SEFAZ dentro do prazo legal.
            </p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => setXCancelDialogOpen(false)} className="px-4 py-2 text-xs font-bold bg-secondary rounded">VOLTAR</button>
          <button 
            onClick={handleCancelar} 
            disabled={XCancelJustificativa.length < 15 || XCancelando} 
            className="px-4 py-2 text-xs font-bold bg-destructive text-white rounded flex items-center gap-2 hover:bg-destructive/90 transition-colors"
          >
            {XCancelando && <RefreshCw className="w-3 h-3 animate-spin" />} CONFIRMAR CANCELAMENTO
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <FiscalProgressDialog
      open={XProg.open}
      titulo={XProg.titulo}
      descricao="Aguardando resposta do Fiscal Worker / SEFAZ."
      segundosTotais={XProg.total}
      selfTick
    />
    </>
  );
};

export default ListaNfeEmitidaForm;
