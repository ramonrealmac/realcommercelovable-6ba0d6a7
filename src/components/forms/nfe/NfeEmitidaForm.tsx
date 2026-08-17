import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import NfeItensTab from "./NfeItensTab";
import NfePagamentoTab from "./NfePagamentoTab";
import { NfeDocumentosReferenciadosTab } from "./NfeDocumentosReferenciadosTab";
import type { INfeCabecalho, TNfeSt } from "./types";
import { NFE_ST_LABELS } from "./types";
import { Search, Send, Printer, Clock, FileText, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatCPFCNPJ } from "@/lib/validators";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import ClienteSearchDialog, { IClienteRow } from "../pedido/ClienteSearchDialog";

const db = supabase as any;

interface IClienteInfo { id: number; cnpj: string; razao: string; cd_cadastro?: number | null; }

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "ID",      width: "60px",  align: "right" },
  { key: "pedido_id",        label: "Pedido",  width: "80px",  align: "right", render: r => r.pedido_id || r.movimento_id || "" },
  { key: "tp_nf",            label: "Tipo",    width: "70px",  render: r => r.tp_nf === 0 ? "Entrada" : "Saída" },
  { key: "nr_nota",          label: "Nota",    width: "90px" },
  { key: "serie",            label: "Série",   width: "50px",  align: "center" },
  { key: "modelo",           label: "Mod.",    width: "50px",  align: "center" },
  { key: "dt_emissao",       label: "Emissão", width: "100px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "_dest",            label: "Destinatário", width: "2fr", getValue: (r: any) => r._dest_razao || "", render: (r: any) => r._dest_razao || (r.cadastro_id ? `#${r.cadastro_id}` : "") },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "100px", 
    render: r => {
      const label = NFE_ST_LABELS[r.st_nf as TNfeSt] || r.st_nf;
      const colors: any = {
        "A": "bg-green-100 text-green-700",
        "E": "bg-blue-100 text-blue-700",
        "P": "bg-gray-100 text-gray-600",
        "C": "bg-red-100 text-red-700",
        "D": "bg-orange-100 text-orange-700",
        "R": "bg-red-100 text-red-700",
        "1": "bg-green-100 text-green-700",
        "2": "bg-orange-100 text-orange-700",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[r.st_nf] || "bg-gray-100 text-gray-600"}`}>
          {label}
        </span>
      );
    }
  },
  { key: "vl_total_nf",      label: "Total",   width: "110px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "chave_nfe",        label: "Chave de Acesso", width: "300px", render: r => <span className="font-mono text-[10px]">{r.chave_nfe}</span> },
];

const XDefault: Partial<INfeCabecalho> = {
  origem_inclusao: "M",
  st_nf: "P",
  tp_nf: 1, // 1 = saída
  fin_nfe: 1,
  tp_emis: 1,
  modelo: "55",
  nat_op: "Venda de Mercadoria",
  nr_nota: "",
  serie: "1",
  chave_nfe: "",
  nr_protocolo: "",
  vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_seguro: 0, vl_despesa: 0,
  vl_ipi: 0, vl_icms_st: 0, vl_pis: 0, vl_cofins: 0,
  vl_ibs: 0, vl_cbs: 0, vl_is: 0, vl_total_nf: 0,
  obs_nf: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_saida: new Date().toISOString().substring(0, 10),
};



const NfeEmitidaForm: React.FC<{ initialId?: number }> = ({ initialId }) => {
  const { XEmpresaId, XEmpresaMatrizId } = useAppContext();

  const [XClienteCache, setXClienteCache] = useState<Record<number, IClienteInfo>>({});
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);
  const XClienteCacheRef = useRef<Record<number, IClienteInfo>>(XClienteCache);
  useEffect(() => { XClienteCacheRef.current = XClienteCache; }, [XClienteCache]);

  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTipo, setXSearchTipo] = useState<"cliente" | "fornecedor">("cliente");
  const [XSearchTarget, setXSearchTarget] = useState<((c: IClienteRow) => void) | null>(null);

  const [XConsultaModal, setXConsultaModal] = useState<{
    open: boolean;
    loading: boolean;
    nfeId?: number;
    nrNota?: string;
    stNf?: string;
    cStat?: string | number;
    xMotivo?: string;
    nrProtocolo?: string;
    chaveNfe?: string;
    sucesso?: boolean;
  }>({ open: false, loading: false });

  const destinatarioInputRef = useRef<HTMLInputElement>(null);
  const naturezaOperacaoInputRef = useRef<HTMLInputElement>(null);

  const { handleKeyDown } = useEnterTraversal();

  const handleSearchDestinatario = (rec: any, setF: (k: string, v: any) => void) => {
    const isDevolucao = rec.fin_nfe === 4;
    setXSearchTipo(isDevolucao ? "fornecedor" : "cliente");
    setXSearchTarget(() => (c: IClienteRow) => {
      setXClienteCache(prev => ({
        ...prev,
        [c.cadastro_id]: {
          id: c.cadastro_id,
          cd_cadastro: c.cd_cadastro,
          cnpj: c.cnpj || "",
          razao: c.razao_social || "",
          fantasia: c.nome_fantasia || ""
        }
      }));
      setF("cadastro_id", c.cadastro_id as any);
      setTimeout(() => {
        naturezaOperacaoInputRef.current?.focus();
      }, 150);
    });
    setXSearchOpen(true);
  };

  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    db.from("deposito").select("deposito_id,nome").eq("excluido", false).order("nome")
      .then(({ data }: any) => setXDepositos(data || []));
  }, [XEmpresaId]);

  const ensureClienteInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XClienteCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("cadastro")
      .select("cadastro_id,cd_cadastro,cnpj,razao_social")
      .in("cadastro_id", faltando);
    if (data) {
      setXClienteCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cd_cadastro: c.cd_cadastro, cnpj: c.cnpj || "", razao: c.razao_social || "" };
        }
        return next;
      });
    }
  }, []);

  const gridCols = useMemo(() => XGridCols.map(c =>
    c.key === "_dest" ? { 
      ...c, 
      getValue: (r: any) => XClienteCache[r.cadastro_id]?.razao || "",
      render: (r: any) => r._dest_razao || (r.cadastro_id ? (XClienteCache[r.cadastro_id]?.razao || `#${XClienteCache[r.cadastro_id]?.cd_cadastro ?? r.cadastro_id}`) : "")
    } : c
  ), [XClienteCache]);

  const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const fmtInput = (v: any) => (v === 0 || v === "0" || v === "" || v === undefined || v === null) ? "" : String(v).replace(".", ",");
  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const handleBlur = (key: string, record: any, setField: any) => {
    const current = record[key];
    if (current === undefined || current === null || current === "") return;
    setField(key, parseNum(current).toFixed(2).replace(".", ","));
  };

  return (
    <>
      <StandardCrudForm<INfeCabecalho>
      config={{
        XTableName: "fiscal_nfe_cabecalho",
        XPrimaryKey: "nfe_cabecalho_id",
        XTitle: "NF-e Emitidas",
        XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
        XEmpresaId,
        XSelectCols: "*",
        XOrderBy: "nfe_cabecalho_id",
        XSoftDelete: false,
        XApplyFilter: (q) => q, // Remove filter to show both Entry/Exit or allow user to filter
        XCanEdit: (rec: any) => !["A", "C", "D", "1", "2"].includes(String(rec.st_nf)),
        XOnAfterLoad: (rows: any[]) => {
          const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
          if (ids.length) ensureClienteInfo(ids);
        },
        XOnBeforeSave: (rec: any) => {
          if (rec.tp_nf === undefined || rec.tp_nf === null) rec.tp_nf = 1;
          delete rec.chaves_ref;
          delete rec.chave_ref;
          return { ...rec, empresa_id: rec.empresa_id || XEmpresaId };
        },
        XOnAfterSave: async (rec: any, mode: any) => {
          // As chaves referenciadas e itens são gerenciados e salvos dinamicamente na aba de itens
        },
      }}
      XGridCols={gridCols}
      XExportTitle="NF-e Emitidas"
      XAfterInsertTab="itens"
      XRefreshRef={XRefreshRef}
      XInitialId={initialId}
      XToolbarExtras={({ currentRecord, isEditing, refresh }) => {
        if (!currentRecord || isEditing) return null;
        const st = String(currentRecord.st_nf || "");
        const foiAutorizada = ["A", "1"].includes(st);
        const foiEnviada = st === "E";
        const podeEnviar = ["P", "R"].includes(st);

        if (foiAutorizada) {
          return (
            <button
              type="button"
              onClick={async () => {
                const tid = toast.loading("Gerando DANFE...");
                try {
                  const res = await fiscalEmissaoService.imprimirDocumento(
                    currentRecord.nfe_cabecalho_id,
                    currentRecord.empresa_id || XEmpresaId
                  );
                  toast.dismiss(tid);
                  if (res.success && res.pdf_base64) {
                    const binaryString = atob(res.pdf_base64);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/pdf" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                    toast.success("DANFE gerado com sucesso.");
                  } else {
                    toast.error(res.message || "Falha ao gerar PDF do DANFE.");
                  }
                } catch (e: any) {
                  toast.dismiss(tid);
                  toast.error("Erro ao emitir DANFE: " + e.message);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm"
              title="Visualizar e Imprimir DANFE em PDF"
            >
              <Printer className="w-3.5 h-3.5" /> EMITIR DANFE
            </button>
          );
        }

        if (podeEnviar) {
          return (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Enviar NF-e #${currentRecord.nfe_cabecalho_id} para a SEFAZ via fiscal-worker?`)) return;
                const tid = toast.loading("Enviando para fila do fiscal-worker...");
                try {
                  const res = await fiscalEmissaoService.retransmitirDocumento(
                    currentRecord.nfe_cabecalho_id,
                    XEmpresaId
                  );
                  toast.dismiss(tid);
                  if (res.success) {
                    toast.success(`Evento #${res.fiscal_evento_id} enfileirado. Aguarde o fiscal-worker processar.`);
                    await refresh();
                  } else {
                    toast.error("Falha: " + (res.message || "Erro desconhecido"));
                  }
                } catch (e: any) {
                  toast.dismiss(tid);
                  toast.error("Erro: " + e.message);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 shadow-sm"
              title="Cria evento PENDENTE no fiscal_evento para que o fiscal-worker transmita a NF-e à SEFAZ"
            >
              <Send className="w-3.5 h-3.5" /> ENVIAR SEFAZ
            </button>
          );
        }

        if (foiEnviada) {
          return (
            <button
              type="button"
              onClick={async () => {
                setXConsultaModal({
                  open: true,
                  loading: true,
                  nfeId: currentRecord.nfe_cabecalho_id,
                  nrNota: currentRecord.nr_nota || String(currentRecord.nfe_cabecalho_id),
                });

                try {
                  const { data: evs } = await db.from("fiscal_evento")
                    .select("id, status, resposta, mensagem_erro")
                    .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id)
                    .order("id", { ascending: false })
                    .limit(1);

                  let lastEv = evs?.[0];
                  if (lastEv && lastEv.status === "PENDENTE") {
                    for (let i = 0; i < 30; i++) {
                      await new Promise(r => setTimeout(r, 500));
                      const { data: evCheck } = await db.from("fiscal_evento").select("status, resposta, mensagem_erro").eq("id", lastEv.id).maybeSingle();
                      if (evCheck && evCheck.status !== "PENDENTE") {
                        lastEv = evCheck;
                        break;
                      }
                    }
                  }

                  const { data: cabUpdated } = await db.from("fiscal_nfe_cabecalho")
                    .select("nfe_cabecalho_id, nr_nota, st_nf, c_stat, x_motivo, nr_protocolo, chave_nfe")
                    .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id)
                    .maybeSingle();

                  await refresh();

                  let respObj: any = null;
                  if (lastEv?.resposta) {
                    try {
                      respObj = typeof lastEv.resposta === "string" ? JSON.parse(lastEv.resposta) : lastEv.resposta;
                    } catch {}
                  }

                  const stFinal = cabUpdated?.st_nf || currentRecord.st_nf;
                  const cStatFinal = cabUpdated?.c_stat || respObj?.c_stat || respObj?.cStat;
                  const xMotivoFinal = cabUpdated?.x_motivo || respObj?.x_motivo || respObj?.xMotivo || lastEv?.mensagem_erro || "Consulta finalizada.";
                  const nrProtFinal = cabUpdated?.nr_protocolo || respObj?.nr_protocolo || respObj?.nProt;
                  const chaveFinal = cabUpdated?.chave_nfe || respObj?.chave_nfe;
                  const sucessoFinal = ["A", "1"].includes(String(stFinal)) || ["100", "150"].includes(String(cStatFinal));

                  setXConsultaModal({
                    open: true,
                    loading: false,
                    nfeId: currentRecord.nfe_cabecalho_id,
                    nrNota: cabUpdated?.nr_nota || currentRecord.nr_nota || String(currentRecord.nfe_cabecalho_id),
                    stNf: stFinal,
                    cStat: cStatFinal || (sucessoFinal ? 100 : undefined),
                    xMotivo: xMotivoFinal,
                    nrProtocolo: nrProtFinal,
                    chaveNfe: chaveFinal,
                    sucesso: sucessoFinal,
                  });
                } catch (e: any) {
                  setXConsultaModal(prev => ({
                    ...prev,
                    loading: false,
                    xMotivo: "Erro ao consultar status: " + e.message,
                    sucesso: false,
                  }));
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-md hover:opacity-90 shadow-sm"
              title="Consultar imediatamente o retorno da SEFAZ para esta nota"
            >
              <Send className="w-3.5 h-3.5" /> CONSULTAR SEFAZ
            </button>
          );
        }

        return null;
      }}
      XExtraTabs={[
        {
          key: "itens", label: "Itens da NF-e",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const podeEditar = !["A", "E", "C", "D", "1", "2"].includes(String(st));
            return (
              <NfeItensTab 
                nfeCabecalhoId={id} 
                empresaId={XEmpresaId} 
                podeEditar={podeEditar} 
                hideVinculo={true} 
                onRefreshCabecalho={() => XRefreshRef.current?.()}
              />
            );
          },
        },
        {
          key: "pagamentos", label: "Pagamentos",
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const podeEditar = !["A", "E", "C", "D", "1", "2"].includes(String(st));
            return <NfePagamentoTab nfeCabecalhoId={id} podeEditar={podeEditar} />;
          },
        },
        {
          key: "referenciadas", label: "Documentos Referenciados",
          hide: ({ record, currentRecord }) => {
            const fin = Number((currentRecord || record)?.fin_nfe ?? 1);
            return fin === 1; // Oculta para Vendas Normais de Saída
          },
          render: ({ record, currentRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const podeEditar = !["A", "E", "C", "D", "1", "2"].includes(String(st));
            return (
              <NfeDocumentosReferenciadosTab
                nfeCabecalhoId={id}
                podeEditar={podeEditar}
                empresaId={XEmpresaId}
              />
            );
          },
        },
        {
          key: "adicionais", label: "Dados Adicionais",
          render: ({ record, setField, isEditing }) => {
            const ro = !isEditing;
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-6">
                    <label className="text-xs text-muted-foreground">Chave NF-e (44 dígitos)</label>
                    <input readOnly={ro} value={record.chave_nfe ?? ""} onChange={e => setField("chave_nfe" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Nº Protocolo</label>
                    <input readOnly={ro} value={record.nr_protocolo ?? ""} onChange={e => setField("nr_protocolo" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Recibo SEFAZ</label>
                    <input readOnly value={record.recibo_sefaz ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">cStat</label>
                    <input readOnly value={record.c_stat ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                  <div className="col-span-9">
                    <label className="text-xs text-muted-foreground">Motivo SEFAZ</label>
                    <input readOnly value={record.x_motivo ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Observações da NF-e</label>
                  <textarea readOnly={ro} value={record.obs_nf ?? ""} onChange={e => setField("obs_nf" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]" />
                </div>

                {/* Cancelamento */}
                <div className="border border-border rounded p-3 bg-card">
                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Cancelamento</p>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Dt. Cancelamento</label>
                      <input readOnly value={(record as any).dt_cancelamento ? new Date((record as any).dt_cancelamento).toLocaleString("pt-BR") : ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Protocolo Cancel.</label>
                      <input readOnly value={(record as any).protocolo_cancelamento ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary font-mono" />
                    </div>
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">Motivo Cancelamento</label>
                      <input readOnly={ro} value={(record as any).motivo_cancelamento ?? ""} onChange={e => setField("motivo_cancelamento" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                </div>

                {/* XML */}
                <div>
                  <label className="text-xs text-muted-foreground">XML da NF-e</label>
                  <textarea readOnly value={record.xml_nf ?? ""} className="w-full border border-border rounded px-2 py-2 text-[10px] font-mono min-h-[120px] bg-secondary/50" />
                </div>
              </div>
            );
          },
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const ro = !isEditing;
        const stAtual = (record.st_nf || "A") as TNfeSt;

        return (
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            {/* Linha 1 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Pedido</label>
                <input readOnly value={(record as any).pedido_id ?? (record as any).movimento_id ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" title="Nº do pedido (movimento) que originou esta nota" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Tipo de Nota</label>
                <select disabled={ro} value={record.tp_nf ?? 1} onChange={e => setField("tp_nf" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Saída</option>
                  <option value={0}>0 - Entrada</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Origem</label>
                <input readOnly value={record.origem_inclusao === "X" ? "XML" : "Manual"} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-center" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                <select disabled={ro} value={record.modelo ?? 55} onChange={e => setField("modelo" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={55}>55</option>
                  <option value={65}>65</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Nº Nota <span className="text-destructive">*</span></label>
                <input readOnly={ro} type="number" value={record.nr_nota || ""} onChange={e => setField("nr_nota" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly={ro} type="number" value={record.serie || ""} onChange={e => setField("serie" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Dt. Saída</label>
                <input type="date" readOnly={ro} value={(record.dt_saida || "").toString().substring(0, 10)} onChange={e => setField("dt_saida" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Dt. Entrada</label>
                <input type="date" readOnly={ro} value={((record as any).dt_entrada || "").toString().substring(0, 10)} onChange={e => setField("dt_entrada" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly value={(NFE_ST_LABELS[stAtual] || stAtual).toUpperCase()} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary uppercase font-bold" />
              </div>
            </div>

            {/* Linha 2: Natureza Operação + Finalidade + Tipo Emissão */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">Natureza da Operação <span className="text-destructive">*</span></label>
                <input ref={naturezaOperacaoInputRef} readOnly={ro} value={record.nat_op ?? ""} onChange={e => setField("nat_op" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Finalidade NF-e</label>
                <select disabled={ro} value={record.fin_nfe ?? 1} onChange={e => setField("fin_nfe" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Complementar</option>
                  <option value={3}>3 - Ajuste</option>
                  <option value={4}>4 - Devolução</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo Emissão</label>
                <select disabled={ro} value={record.tp_emis ?? 1} onChange={e => setField("tp_emis" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Contingência FS-IA</option>
                  <option value={4}>4 - Contingência EPEC</option>
                  <option value={9}>9 - Contingência off-line NFC-e</option>
                </select>
              </div>
            </div>

            {/* Linha 3: Destinatário */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <label className="text-xs text-muted-foreground">Destinatário <span className="text-destructive">*</span></label>
                <div className="flex gap-1">
                  <input
                    ref={destinatarioInputRef}
                    readOnly={!isEditing}
                    value={record.cadastro_id ? (XClienteCache[record.cadastro_id]?.razao || `#${XClienteCache[record.cadastro_id]?.cd_cadastro ?? record.cadastro_id}`) : ""}
                    placeholder="Pressione Enter para pesquisar..."
                    className="flex-1 border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none cursor-pointer"
                    data-lookup="true"
                    data-required="true"
                    data-lookup-key="destinatario"
                    onKeyDown={(e) => {
                      if (!isEditing) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!record.cadastro_id) {
                          handleSearchDestinatario(record, setField);
                        }
                      }
                    }}
                  />
                  {isEditing && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleSearchDestinatario(record, setField)}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent"
                      title="Pesquisar destinatário"
                      data-lookup-trigger="true"
                      data-lookup-key="destinatario"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                  {record.cadastro_id && isEditing && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setField("cadastro_id", null as any)}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                      title="Limpar"
                    >×</button>
                  )}
                </div>
              </div>
            </div>

            {/* Chaves Referenciadas migradas para a aba de itens */}

            {/* Totais */}
            <div className="border border-border rounded p-3 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide font-bold">Totais da Nota Fiscal</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {[
                  { label: "Produtos", key: "vl_produto" },
                  { label: "Desconto", key: "vl_desconto" },
                  { label: "Frete",    key: "vl_frete"    },
                  { label: "Seguro",   key: "vl_seguro"   },
                  { label: "Despesa",  key: "vl_despesa"  },
                  { label: "Outros",   key: "vl_outro"    },
                  { label: "Base Cálc.", key: "vl_bc"     },
                  { label: "ICMS",     key: "vl_icms"     },
                  { label: "ICMS Deson.", key: "vl_icms_deson" },
                  { label: "ICMS-ST",  key: "vl_icms_st"  },
                  { label: "FCP",      key: "vl_fcp"      },
                  { label: "FCP-ST",   key: "vl_fcp_st"   },
                  { label: "FCP-ST Ret.", key: "vl_fcp_st_ret" },
                  { label: "IPI",      key: "vl_ipi"      },
                  { label: "IPI Devol.", key: "vl_ipi_devol" },
                  { label: "II",       key: "vl_ii"       },
                  { label: "PIS",      key: "vl_pis"      },
                  { label: "COFINS",   key: "vl_cofins"   },
                  { label: "IBS",      key: "vl_ibs"      },
                  { label: "CBS",      key: "vl_cbs"      },
                  { label: "IS",       key: "vl_is"       },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">{f.label}</label>
                    <input
                      type="text"
                      readOnly={ro}
                      value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                      onBlur={() => handleBlur(f.key, record, setField)}
                      onChange={e => {
                        const val = e.target.value.replace(/\./g, "").replace(",", ".");
                        setField(f.key as any, val as any);
                      }}
                      className={`w-full border border-border rounded px-2 py-1.5 text-xs text-right font-mono ${ro ? "bg-secondary/50" : "bg-card"}`}
                    />
                  </div>
                ))}
                <div className="col-span-2 lg:col-span-1 flex flex-col justify-end">
                  <label className="text-xs font-black text-primary uppercase">TOTAL NOTA</label>
                  <input
                    readOnly
                    value={fmt2(Number(record.vl_total_nf || 0))}
                    className="w-full border-2 border-primary/40 rounded px-2 py-1.5 text-sm font-black text-right bg-primary/10 text-primary font-mono shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
      <ClienteSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        empresaId={XEmpresaId}
        tipo={XSearchTipo}
        onSelect={(c) => XSearchTarget?.(c)}
      />

      <Dialog open={XConsultaModal.open} onOpenChange={(o) => !o && setXConsultaModal(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              Resultado SEFAZ — NF-e #{XConsultaModal.nrNota}
            </DialogTitle>
          </DialogHeader>

          {XConsultaModal.loading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <Clock className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Consultando status na SEFAZ...</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-bold uppercase">Status Atual</span>
                <Badge className={`font-bold text-xs uppercase ${
                  XConsultaModal.sucesso || ["A", "1"].includes(String(XConsultaModal.stNf))
                    ? "bg-green-100 text-green-700 border-none"
                    : XConsultaModal.stNf === "E"
                    ? "bg-blue-100 text-blue-700 border-none"
                    : "bg-red-100 text-red-700 border-none"
                }`}>
                  {["A", "1"].includes(String(XConsultaModal.stNf)) ? "AUTORIZADA" : (XConsultaModal.stNf === "E" ? "ENVIADA / AGUARDANDO" : "FALHA / REJEITADA")}
                </Badge>
              </div>

              {XConsultaModal.cStat && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-bold uppercase">Código cStat</span>
                  <Badge className="bg-secondary text-secondary-foreground font-mono text-xs">
                    {XConsultaModal.cStat}
                  </Badge>
                </div>
              )}

              <div className="p-3 bg-muted rounded-lg border border-border space-y-1">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Retorno / Motivo SEFAZ</p>
                <p className="text-sm font-medium text-foreground leading-relaxed">{XConsultaModal.xMotivo}</p>
              </div>

              {XConsultaModal.nrProtocolo && (
                <div className="p-2 bg-background rounded border border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-bold uppercase text-[10px]">Protocolo</span>
                  <span className="font-mono font-bold">{XConsultaModal.nrProtocolo}</span>
                </div>
              )}

              {XConsultaModal.chaveNfe && (
                <div className="p-2 bg-background rounded border border-border space-y-1">
                  <span className="text-muted-foreground font-bold uppercase text-[10px] block">Chave de Acesso</span>
                  <span className="font-mono text-[11px] block break-all">{XConsultaModal.chaveNfe}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setXConsultaModal(prev => ({ ...prev, open: false }))}
              className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NfeEmitidaForm;
