import React, { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { useGridFilter } from "@/hooks/useGridFilter";
import RpbFormReportsButton from "@/report-builder/components/executor/RpbFormReportsButton";

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
  CheckSquare,
  ArrowUpFromLine,
  Filter,
  RotateCcw
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
import MonitorFiscalLogDialog from "@/components/forms/fiscal/MonitorFiscalLogDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";

interface IProps {
  initialFilterId?: string | number;
}


const db = supabase as any;

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatarDataEmissao = (dt: any) => {
  if (!dt) return "";
  const s = String(dt);
  if (s.includes("T")) {
    const datePart = s.split("T")[0];
    const [y, m, d] = datePart.split("-");
    if (y && m && d) return `${d}/${m}/${y}`;
  }
  if (s.includes("-")) {
    const [y, m, d] = s.split("-");
    if (y && m && d) return `${d}/${m}/${y.substring(0, 4)}`;
  }
  return new Date(dt).toLocaleDateString("pt-BR", { timeZone: "UTC" });
};

const ListaNfeEmitidaForm: React.FC<IProps> = ({ initialFilterId }) => {
  const { XEmpresaId, XEmpresas, openTab } = useAppContext();

  const dtIniRef = useRef<HTMLInputElement>(null);
  const dtFimRef = useRef<HTMLInputElement>(null);
  const filtrarBtnRef = useRef<HTMLButtonElement>(null);

  const XGridCols: IGridColumn[] = [
    { 
      key: "empresa_id", 
      label: "Emitente", 
      width: "150px", 
      render: r => {
        const empIdStr = String(r.empresa_id).padStart(2, '0');
        const emp = XEmpresas?.find(e => e.empresa_id === Number(r.empresa_id));
        const nomeEmp = emp?.identificacao || emp?.razao_social || '';
        return nomeEmp ? `${empIdStr} - ${nomeEmp}` : empIdStr;
      }
    },
    { key: "nr_pedido", label: "Pedido", width: "70px", align: "center", render: r => r.nr_pedido || r.pedido_id || r.movimento_id || "" },
    { key: "nr_nota", label: "Nota", width: "80px" },
    { key: "serie", label: "Série", width: "65px", align: "center" },
    { 
      key: "tp_amb", 
      label: "Ambiente", 
      width: "90px", 
      render: r => (
        <span className={String(r.tp_amb) === "1" ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
          {String(r.tp_amb) === "1" ? "Produção" : "Homologação"}
        </span>
      )
    },
    { key: "modelo", label: "Mod.", width: "45px", align: "center" },
    { 
      key: "tp_nf", 
      label: "Tipo", 
      width: "60px", 
      render: r => (
        <span className={String(r.tp_nf) === "0" ? "text-blue-600 font-medium" : "text-emerald-600 font-medium"}>
          {String(r.tp_nf) === "0" ? "Entrada" : "Saída"}
        </span>
      )
    },
    { 
      key: "fin_nfe", 
      label: "Finalidade", 
      width: "90px", 
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
    { key: "dt_emissao", label: "Emissão", width: "85px", render: r => formatarDataEmissao(r.dt_emissao) },
    { key: "nm_destinatario", label: "Destinatário", width: "240px" },
    { key: "cnpj_destinatario", label: "CNPJ/CPF", width: "130px", render: r => formatCPFCNPJ(r.cnpj_destinatario) },
    { key: "vl_total_nf", label: "Valor", width: "100px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
    { 
      key: "st_nf", 
      label: "Status", 
      width: "105px", 
      render: r => {
        const labels: any = {
          "A": "Autorizada",
          "E": "Enviada",
          "P": "Pendente",
          "C": "Cancelada",
          "D": "Denegada",
          "R": "Rejeitada",
          "1": "Autorizada",
          "2": "Denegada"
        };
        const label = labels[r.st_nf] || r.st_nf || "Pendente";
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            r.st_nf === "A" || r.st_nf === "1" ? "bg-green-100 text-green-700" :
            r.st_nf === "E" ? "bg-blue-100 text-blue-700" :
            r.st_nf === "C" ? "bg-red-100 text-red-700" :
            r.st_nf === "D" || r.st_nf === "2" ? "bg-orange-100 text-orange-700" : 
            r.st_nf === "R" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
          }`}>
            {label}
          </span>
        );
      }
    },
  ];

  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XDtIni, setXDtIni] = useState(getTodayString());
  const [XDtFim, setXDtFim] = useState(getTodayString());
  const [XFilterAmbiente, setXFilterAmbiente] = useState("");
  const [XFilterTipo, setXFilterTipo] = useState("");
  const [XFilterFinalidade, setXFilterFinalidade] = useState("");
  const [XFilterStatus, setXFilterStatus] = useState("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XHasFiltered, setXHasFiltered] = useState(false);
  
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

  useEffect(() => {
    if (XEmpresaId) {
      setXHasFiltered(true);
      loadData();
    }
  }, [XEmpresaId]);


  const loadData = async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      // Busca dados da empresa logada para identificar se é Matriz ou Filial
      const { data: empData } = await db
        .from("empresa")
        .select("empresa_id, empresa_matriz_id")
        .eq("empresa_id", XEmpresaId)
        .single();

      let empresaIds = [XEmpresaId];

      const isMatriz = !empData?.empresa_matriz_id || empData.empresa_matriz_id === XEmpresaId;
      if (isMatriz) {
        // Se for Matriz, carrega todas as filiais
        const { data: filiais } = await db
          .from("empresa")
          .select("empresa_id")
          .eq("empresa_matriz_id", XEmpresaId);
        if (filiais) {
          empresaIds = filiais.map((f: any) => f.empresa_id);
          if (!empresaIds.includes(XEmpresaId)) {
            empresaIds.push(XEmpresaId);
          }
        }
      }

      let query = db.from("fiscal_nfe_cabecalho")
        .select("*, cadastro(razao_social, cnpj)")
        .in("empresa_id", empresaIds);

      if (XDtIni && String(XDtIni).trim() !== "") {
        query = query.gte("dt_emissao", `${XDtIni}T00:00:00`);
      }
      if (XDtFim && String(XDtFim).trim() !== "") {
        query = query.lte("dt_emissao", `${XDtFim}T23:59:59`);
      }
      if (XFilterTipo && String(XFilterTipo).trim() !== "") {
        query = query.eq("tp_nf", Number(XFilterTipo));
      }
      if (XFilterFinalidade && String(XFilterFinalidade).trim() !== "") {
        query = query.eq("fin_nfe", Number(XFilterFinalidade));
      }
      if (XFilterStatus && String(XFilterStatus).trim() !== "") {
        if (XFilterStatus === "A") {
          query = query.in("st_nf", ["A", "1"]);
        } else if (XFilterStatus === "D") {
          query = query.in("st_nf", ["D", "2"]);
        } else {
          query = query.eq("st_nf", XFilterStatus);
        }
      }

      const { data, error } = await query.order("nr_nota", { ascending: false, nullsFirst: false });

      if (error) throw error;
      
      const movIds = Array.from(
        new Set(
          (data || [])
            .map((r: any) => r.movimento_id || r.pedido_id)
            .filter(Boolean)
        )
      ) as number[];

      let movMap: Record<number, number> = {};
      if (movIds.length > 0) {
        const { data: movs } = await db
          .from("movimento")
          .select("movimento_id, nr_movimento")
          .in("movimento_id", movIds);

        if (movs) {
          movs.forEach((m: any) => {
            movMap[m.movimento_id] = m.nr_movimento;
          });
        }
      }

      // Busca configurações fiscais para associar o ambiente (Produção/Homologação)
      const { data: fConfigs } = await db
        .from("fiscal_config")
        .select("empresa_id, ambiente_nfe, ambiente_nfce")
        .in("empresa_id", empresaIds);

      const fConfigMap: Record<number, any> = {};
      if (fConfigs) {
        fConfigs.forEach((c: any) => {
          fConfigMap[c.empresa_id] = c;
        });
      }

      let mappedData = (data || []).map((r: any) => {
        const mId = r.movimento_id || r.pedido_id;
        const nrMov = mId ? movMap[mId] : null;
        const cfg = fConfigMap[r.empresa_id];
        const tpAmb = String(r.modelo) === "65" ? (cfg?.ambiente_nfce || "2") : (cfg?.ambiente_nfe || "2");
        return {
          ...r,
          tp_amb: tpAmb,
          nr_pedido: nrMov ? String(nrMov) : (mId ? String(mId) : ""),
          nm_destinatario: r.cadastro?.razao_social || "NÃO INFORMADO",
          cnpj_destinatario: r.cadastro?.cnpj || ""
        };
      });

      // Filtra por Ambiente em memória (pois tp_amb fica no fiscal_config)
      if (XFilterAmbiente && String(XFilterAmbiente).trim() !== "") {
        mappedData = mappedData.filter((r: any) => String(r.tp_amb) === String(XFilterAmbiente));
      }

      // Ordenar estritamente decrescente pela coluna Nota (nr_nota)
      mappedData.sort((a: any, b: any) => {
        const numA = Number(a.nr_nota) || Number(a.nfe_cabecalho_id) || 0;
        const numB = Number(b.nr_nota) || Number(b.nfe_cabecalho_id) || 0;
        return numB - numA;
      });

      setXData(mappedData);
    } catch (e: any) {
      toast.error("Erro ao carregar notas: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleFiltrar = async () => {
    if (XDtIni && XDtFim && XDtIni > XDtFim) {
      toast.error("A data de início não pode ser maior que a data de fim.");
      return;
    }
    setXHasFiltered(true);
    await loadData();
  };

  const handleLimparFiltros = () => {
    const today = getTodayString();
    setXDtIni(today);
    setXDtFim(today);
    setXFilterAmbiente("");
    setXFilterTipo("");
    setXFilterFinalidade("");
    setXFilterStatus("");
    setXSearchFilters({});
    setXSelectedIds(new Set());
    setXHasFiltered(true);
  };

  useEffect(() => {
    if (!XHasFiltered) return;
    // Realtime subscription para atualizar status automaticamente após filtrar
    const ch = (supabase as any).channel('nfe_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_nfe_cabecalho' }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'fiscal_evento' }, () => loadData())
      .subscribe();
    return () => { try { (supabase as any).removeChannel(ch); } catch {} };
  }, [XEmpresaId, XHasFiltered]);

  const XFilteredData = useGridFilter(XData, XSearchFilters, XGridCols);


  const handleTransmitir = async (row: any) => {
    if (!XEmpresaId) return;
    const statusConclusivos = ["A", "C", "D", "1", "2"];
    if (statusConclusivos.includes(String(row.st_nf))) {
      toast.error(`Esta nota está em status "${row.st_nf}" e não pode ser retransmitida.`);
      return;
    }
    const targetEmpresaId = row.empresa_id || XEmpresaId;
    toast.info("Enfileirando transmissão...");
    try {
      const res = await fiscalEmissaoService.retransmitirDocumento(row.nfe_cabecalho_id, targetEmpresaId);
      if (!res.success || !res.fiscal_evento_id) {
        toast.error("Falha: " + (res.message || "erro desconhecido"));
        return;
      }

      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId);
      setXProg({ open: true, titulo: "Transmitindo NF-e à SEFAZ...", total: totalSeg });

      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
        empresaId: targetEmpresaId,
        timeoutMs: totalSeg * 1000
      });

      setXProg(p => ({ ...p, open: false }));

      // Atualiza a grade para refletir o novo estado no banco de dados
      await loadData();

      // Consulta o cabeçalho atualizado no banco de dados para confirmar o status
      const { data: updatedCab } = await db
        .from("fiscal_nfe_cabecalho")
        .select("*")
        .eq("nfe_cabecalho_id", row.nfe_cabecalho_id)
        .maybeSingle();

      const itemAtualizado = updatedCab ? { ...row, ...updatedCab } : { ...row, st_nf: ret.success ? "A" : row.st_nf };
      const stNf = String(itemAtualizado.st_nf);

      if (["A", "1"].includes(stNf)) {
        toast.success("Nota Fiscal autorizada com sucesso!");
        await handleImprimir(itemAtualizado);
      } else {
        const msg = ret.mensagem || ret.resposta?.x_motivo || "Nota não foi autorizada pela SEFAZ.";
        toast.error("Retorno SEFAZ: " + msg);
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error("Erro na transmissão: " + e.message);
      await loadData();
    }
  };

  const handleValidar = async (row: any) => {
    if (!XEmpresaId) return;
    const tid = toast.loading("Validando XML contra Schemas (XSD)...");
    try {
      const res = await (fiscalEmissaoService as any).validarDocumento(row.nfe_cabecalho_id, row.empresa_id || XEmpresaId);
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
    if (!["A", "1"].includes(String(row.st_nf))) {
      toast.error("Somente notas autorizadas podem ser impressas.");
      return;
    }
    const tid = toast.loading("Gerando DANFE...");
    try {
      const res = await fiscalEmissaoService.imprimirDocumento(row.nfe_cabecalho_id, row.empresa_id || XEmpresaId);
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
      const targetEmpresaId = XEmailTarget.empresa_id || XEmpresaId;
      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId);
      setXProg({ open: true, titulo: "Enviando e-mail...", total: totalSeg });
      const res = await fiscalEmissaoService.enviarEmail(XEmailTarget.nfe_cabecalho_id, targetEmpresaId, XEmailDestino);
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
    if (!["A", "1"].includes(String(row.st_nf))) {
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
      const targetEmpresaId = XCancelTarget.empresa_id || XEmpresaId;
      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId);
      setXProg({ open: true, titulo: "Cancelando documento...", total: totalSeg });
      const res = await fiscalEmissaoService.cancelarDocumento(XCancelTarget.nfe_cabecalho_id, targetEmpresaId, XCancelJustificativa);
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
              width: "70px",
              render: r => (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 text-[11px] bg-primary text-primary-foreground px-2 py-1 rounded border border-border hover:opacity-90 transition-opacity font-bold uppercase shadow-sm">
                        Opções
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleTransmitir(r)} disabled={["A", "C", "D", "1", "2"].includes(String(r.st_nf))}>
                        <Send className="w-4 h-4 mr-2 text-blue-500" /> Transmitir SEFAZ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleValidar(r)} disabled={["A", "C", "D", "1", "2"].includes(String(r.st_nf))}>
                        <CheckSquare className="w-4 h-4 mr-2 text-emerald-500" /> Validar XML (Schema)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleImprimir(r)} disabled={!["A", "1"].includes(String(r.st_nf))}>
                        <Printer className="w-4 h-4 mr-2 text-gray-500" /> Imprimir DANFE
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownloadXml(r)} disabled={!r.xml_nf}>
                        <Download className="w-4 h-4 mr-2 text-blue-400" /> Baixar XML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenEmailDialog(r)} disabled={!["A", "1"].includes(String(r.st_nf))}>
                        <Mail className="w-4 h-4 mr-2 text-indigo-400" /> Enviar por E-mail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setXLogNfeId(r.nfe_cabecalho_id); setXLogDialogOpen(true); }}>
                        <Terminal className="w-4 h-4 mr-2 text-indigo-500" /> Log
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openTab({ title: `CCe NF-e ${r.nr_nota || r.nfe_cabecalho_id}`, component: "cce", params: { nfe_cabecalho_id: r.nfe_cabecalho_id } })}>
                        <FileText className="w-4 h-4 mr-2 text-amber-500" /> Carta de Correção
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openTab({
                          title: `Devolução NF-e ${r.nr_nota || r.nfe_cabecalho_id}`,
                          component: "devolucao-nfe-saida",
                          params: { nfe_cabecalho_id: r.nfe_cabecalho_id },
                        })}
                        disabled={String(r.tp_nf) !== "1" || !["A", "1"].includes(String(r.st_nf))}
                      >
                        <ArrowUpFromLine className="w-4 h-4 mr-2 text-orange-500" /> Devolver Nota
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
          onRowDoubleClick={(row) => {
            openTab({ 
              title: `NF-e #${row.nr_nota || row.nfe_cabecalho_id}`, 
              component: "nfe-form", 
              params: { nfe_cabecalho_id: row.nfe_cabecalho_id } 
            });
          }}
          toolbarLeft={
            <>
            <div className="flex flex-wrap items-center gap-2 bg-secondary/30 p-1 rounded-lg border border-border mr-4">
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Início</span>
                <input 
                  ref={dtIniRef}
                  type="date" 
                  max="2099-12-31" 
                  value={XDtIni} 
                  onChange={e => setXDtIni(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dtFimRef.current?.focus();
                    }
                  }}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-32 font-medium" 
                />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Fim</span>
                <input 
                  ref={dtFimRef}
                  type="date" 
                  max="2099-12-31" 
                  value={XDtFim} 
                  onChange={e => setXDtFim(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      filtrarBtnRef.current?.focus();
                    }
                  }}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-32 font-medium" 
                />
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Ambiente</span>
                <select
                  value={XFilterAmbiente}
                  onChange={e => setXFilterAmbiente(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-24 cursor-pointer font-medium"
                >
                  <option value="">(Todos)</option>
                  <option value="1">Produção</option>
                  <option value="2">Homologação</option>
                </select>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Tipo</span>
                <select
                  value={XFilterTipo}
                  onChange={e => setXFilterTipo(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-20 cursor-pointer font-medium"
                >
                  <option value="">(Todos)</option>
                  <option value="1">1 - Saída</option>
                  <option value="0">0 - Entrada</option>
                </select>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Finalidade</span>
                <select
                  value={XFilterFinalidade}
                  onChange={e => setXFilterFinalidade(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-28 cursor-pointer font-medium"
                >
                  <option value="">(Todas)</option>
                  <option value="1">1 - Normal</option>
                  <option value="2">2 - Complementar</option>
                  <option value="3">3 - Ajuste</option>
                  <option value="4">4 - Devolução</option>
                </select>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex flex-col px-2">
                <span className="text-[9px] text-muted-foreground uppercase font-bold">Status</span>
                <select
                  value={XFilterStatus}
                  onChange={e => setXFilterStatus(e.target.value)}
                  className="bg-transparent border-none text-xs p-0 focus:ring-0 w-28 cursor-pointer font-medium"
                >
                  <option value="">(Todos)</option>
                  <option value="A">Autorizada</option>
                  <option value="P">Pendente</option>
                  <option value="E">Enviada</option>
                  <option value="C">Cancelada</option>
                  <option value="R">Rejeitada</option>
                  <option value="D">Denegada</option>
                </select>
              </div>
            </div>
            
            <button 
              ref={filtrarBtnRef}
              onClick={handleFiltrar}
              disabled={XLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mr-2 shadow-sm"
              title="Filtrar dados"
            >
              <Filter className={`w-3.5 h-3.5 ${XLoading ? "animate-spin" : ""}`} />
              FILTRAR
            </button>

            <button 
              onClick={handleLimparFiltros}
              disabled={XLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-secondary/80 text-secondary-foreground rounded-md hover:bg-secondary transition-colors mr-4"
              title="Limpar filtros e grid"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              LIMPAR FILTROS
            </button>

            <RpbFormReportsButton nmForm="nfe-emitidas" />

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
