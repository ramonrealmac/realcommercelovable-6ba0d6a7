import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Search, Send, FileText, CheckCircle2, Clock, AlertCircle, Printer, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import NfeSearchDialog, { buscarNfePorNumero, INfeRow } from "./NfeSearchDialog";

const db = supabase as any;

export interface INfeFullInfo {
  nr: string | number;
  serie: string | number;
  chave_nfe?: string;
  dt_emissao?: string;
  vl_total_nf?: number;
  modelo?: string;
  razao_social?: string;
}

interface ICartaCorrecaoContentProps {
  record: any;
  setField: (k: string, v: any) => void;
  isEditing: boolean;
  handleIncluir?: () => void;
  XEmpresaId: number;
  XLoading: boolean;
  XNfeInfo: Record<number, INfeFullInfo>;
  setXNfeInfo: React.Dispatch<React.SetStateAction<Record<number, INfeFullInfo>>>;
  ensureNfeInfo: (ids: number[]) => Promise<void>;
  handleImprimir: (r: any) => void;
  handleTransmitir: (r: any) => void;
}

const CartaCorrecaoContent: React.FC<ICartaCorrecaoContentProps> = ({
  record,
  setField,
  isEditing,
  handleIncluir,
  XEmpresaId,
  XLoading,
  XNfeInfo,
  setXNfeInfo,
  ensureNfeInfo,
  handleImprimir,
  handleTransmitir
}) => {
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XOpenNfeSearch, setXOpenNfeSearch] = useState(false);
  const nfeSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (record?.nfe_cabecalho_id) {
      ensureNfeInfo([record.nfe_cabecalho_id]);
    }
  }, [record?.nfe_cabecalho_id, ensureNfeInfo]);

  const handleBuscarNfe = async () => {
    const t = XSearchTerm.trim();
    if (!t) { setXOpenNfeSearch(true); return; }
    const nfe = await buscarNfePorNumero(t, XEmpresaId);
    if (nfe) {
      setXNfeInfo(prev => ({
        ...prev,
        [nfe.nfe_cabecalho_id]: {
          nr: nfe.nr_nota,
          serie: nfe.serie,
          chave_nfe: nfe.chave_nfe,
          dt_emissao: nfe.dt_emissao,
          vl_total_nf: nfe.vl_total_nf,
          modelo: nfe.modelo,
          razao_social: nfe.razao_social,
        }
      }));
      if (!isEditing && handleIncluir) {
        handleIncluir();
      }
      setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
      setXSearchTerm("");
    } else {
      toast.info("Nota emitida e autorizada não localizada por este número/chave. Abrindo pesquisa avançada...");
      setXOpenNfeSearch(true);
    }
  };

  const onSelectNfe = (nfe: INfeRow) => {
    setXNfeInfo(prev => ({
      ...prev,
      [nfe.nfe_cabecalho_id]: {
        nr: nfe.nr_nota,
        serie: nfe.serie,
        chave_nfe: nfe.chave_nfe,
        dt_emissao: nfe.dt_emissao,
        vl_total_nf: nfe.vl_total_nf,
        modelo: nfe.modelo,
        razao_social: nfe.razao_social,
      }
    }));
    if (!isEditing && handleIncluir) {
      handleIncluir();
    }
    setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
    setXSearchTerm("");
  };

  const info = record?.nfe_cabecalho_id ? XNfeInfo[record.nfe_cabecalho_id] : null;
  const fmtMoney = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-12 gap-4 items-end">
        <div className="col-span-12 md:col-span-8">
          <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">NF-e / NFC-e Vinculada</label>
          <div className="flex flex-col gap-2">
            {record.nfe_cabecalho_id ? (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm text-foreground">
                      {info ? `${info.modelo === "65" ? "NFC-e" : "NF-e"} nº ${info.nr ?? ""} (Série ${info.serie ?? ""})` : `Nota #${record.nfe_cabecalho_id}`}
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] uppercase font-bold">
                      Autorizada
                    </Badge>
                  </div>
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={() => { setField("nfe_cabecalho_id", null); setXSearchTerm(""); }}
                      className="p-1.5 hover:bg-destructive/10 text-destructive rounded-full transition-colors"
                      title="Remover vínculo com a nota"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {info ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground pt-1 border-t border-primary/10">
                    <div>
                      <span className="font-semibold text-foreground">Destinatário: </span>
                      {info.razao_social || "Não informado"}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Emissão: </span>
                      {info.dt_emissao ? new Date(info.dt_emissao).toLocaleDateString("pt-BR") : "-"}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Valor Total: </span>
                      <span className="font-bold text-primary">{fmtMoney(info.vl_total_nf)}</span>
                    </div>
                    {info.chave_nfe && (
                      <div className="col-span-1 md:col-span-3 font-mono text-[11px] truncate text-muted-foreground/80">
                        <span className="font-sans font-semibold text-foreground">Chave: </span>
                        {info.chave_nfe}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Carregando dados da nota fiscal vinculada...</p>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    ref={nfeSearchRef}
                    readOnly={!isEditing}
                    value={XSearchTerm} 
                    onChange={e => setXSearchTerm(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBuscarNfe(); }}
                    className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder={isEditing ? "Bipe ou digite o nº da nota ou chave... (Enter)" : "Pesquisar ou bipe o nº da nota..."}
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => setXOpenNfeSearch(true)}
                  className="p-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                  title="Pesquisa Avançada"
                >
                  <Search className="w-4 h-4 text-primary" />
                  Pesquisar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-6 md:col-span-2">
          <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Seq. Evento</label>
          <input 
            type="number"
            readOnly={!isEditing} 
            value={record.nr_sequencial ?? 1} 
            onChange={e => setField("nr_sequencial", parseInt(e.target.value))}
            className="w-full border border-border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="col-span-6 md:col-span-2">
          <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Status</label>
          <div className="py-2 px-3 bg-secondary rounded-lg border border-border text-xs font-bold uppercase flex items-center gap-2">
            <Clock size={12} className={record.st_evento === "A" ? "text-orange-500" : ""} />
            {record.st_evento === "E" ? "Autorizada" : (record.st_evento === "F" ? "Falha" : "Pendente")}
          </div>
        </div>
      </div>
      
      <div>
        <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Texto da Correção (Min. 15 caracteres)</label>
        <textarea 
          readOnly={!isEditing}
          value={record.x_correcao ?? ""} 
          onChange={e => setField("x_correcao", e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm min-h-[120px] focus:ring-1 focus:ring-primary outline-none transition-all"
          placeholder="Descreva as correções de forma clara (ex: Alteração da Natureza da Operação para...)"
        />
      </div>

      {!isEditing && record.nfe_cce_id && (
        <div className="flex justify-end gap-2 pt-4">
          {record.st_evento === "E" && (
            <button 
              onClick={() => handleImprimir(record)}
              className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-bold hover:bg-secondary/80 transition-all shadow-md active:scale-95 text-xs"
            >
              <Printer className="w-4 h-4" />
              IMPRIMIR CC-E
            </button>
          )}
          <button 
            onClick={() => handleTransmitir(record)}
            disabled={XLoading || record.st_evento === "E"}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-md active:scale-95 text-xs"
          >
            {XLoading ? <Clock className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
            TRANSMITIR CC-E
          </button>
        </div>
      )}

      {record.x_motivo && (
        <div className={`p-4 rounded-xl border shadow-inner ${record.st_evento === "F" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted/50 border-border"}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase font-bold tracking-wider">Retorno da SEFAZ</p>
            {record.st_evento === "F" && (
              <Badge className="bg-destructive text-destructive-foreground font-bold text-[10px] uppercase">Rejeitada / Falha</Badge>
            )}
          </div>
          <p className="text-sm font-medium">{record.x_motivo}</p>
          {record.nr_protocolo && <p className="text-[10px] mt-2 font-mono bg-background px-2 py-0.5 inline-block rounded border border-border">Protocolo: {record.nr_protocolo}</p>}
        </div>
      )}
      
      <NfeSearchDialog 
        open={XOpenNfeSearch} 
        onClose={() => setXOpenNfeSearch(false)} 
        onSelect={onSelectNfe} 
      />
    </div>
  );
};

const CartaCorrecaoForm: React.FC<{ initialNfeId?: number }> = ({ initialNfeId }) => {
  const { XEmpresaId } = useAppContext();
  const [XNfeInfo, setXNfeInfo] = useState<Record<number, INfeFullInfo>>({});
  const [XLoading, setXLoading] = useState(false);
  const [XErrorModal, setXErrorModal] = useState<{ open: boolean; title: string; code?: string; message: string; row?: any }>({ open: false, title: "", message: "" });
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const XGridCols: IGridColumn[] = [
    { key: "nfe_cce_id", label: "Cód.", width: "80px", align: "right" },
    { 
      key: "nfe_cabecalho_id", 
      label: "NF-e", 
      width: "180px", 
      render: r => XNfeInfo[r.nfe_cabecalho_id] 
        ? `Nota ${XNfeInfo[r.nfe_cabecalho_id].nr} (Série ${XNfeInfo[r.nfe_cabecalho_id].serie})` 
        : `#${r.nfe_cabecalho_id}`
    },
    { key: "nr_sequencial", label: "Seq.", width: "60px", align: "center" },
    { key: "x_correcao", label: "Correção", width: "1fr" },
    { 
      key: "st_evento", 
      label: "Status", 
      width: "120px",
      render: r => {
        const map: any = {
          "A": { label: "Pendente", color: "bg-gray-100 text-gray-600", icon: Clock },
          "E": { label: "Autorizada", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
          "F": { label: "Falha", color: "bg-red-100 text-red-700", icon: AlertCircle },
        };
        const s = map[r.st_evento] || { label: r.st_evento, color: "bg-gray-100", icon: Clock };
        const Icon = s.icon;
        return (
          <Badge className={`${s.color} border-none flex items-center gap-1 font-bold uppercase text-[10px]`}>
            <Icon size={12} />
            {s.label}
          </Badge>
        );
      }
    },
    {
      key: "acoes",
      label: "Ações",
      width: "100px",
      align: "center",
      render: r => (
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleTransmitir(r); }}
            disabled={r.st_evento === "E"}
            className="p-1.5 hover:bg-primary/10 rounded-full text-primary disabled:opacity-30 transition-colors"
            title="Transmitir CC-e"
          >
            <Send className="w-4 h-4" />
          </button>
          {r.st_evento === "E" && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleImprimir(r); }}
              className="p-1.5 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
              title="Imprimir CC-e"
            >
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ];

  const ensureNfeInfo = useCallback(async (ids: number[]) => {
    const missing = ids.filter(id => id && !XNfeInfo[id]);
    if (missing.length === 0) return;
    const { data } = await db
      .from("fiscal_nfe_cabecalho")
      .select("nfe_cabecalho_id, nr_nota, serie, chave_nfe, dt_emissao, vl_total_nf, modelo, cadastro_id, cadastro:cadastro_id(razao_social)")
      .in("nfe_cabecalho_id", missing);

    if (data) {
      setXNfeInfo(prev => {
        const next = { ...prev };
        data.forEach((d: any) => {
          next[d.nfe_cabecalho_id] = {
            nr: d.nr_nota,
            serie: d.serie,
            chave_nfe: d.chave_nfe,
            dt_emissao: d.dt_emissao,
            vl_total_nf: d.vl_total_nf,
            modelo: d.modelo,
            razao_social: d.cadastro?.razao_social,
          };
        });
        return next;
      });
    }
  }, [XNfeInfo]);

  const handleTransmitir = async (row: any) => {
    if (row.st_evento === "E") {
      toast.warning("Esta CC-e já foi enviada e autorizada pela SEFAZ.");
      return;
    }
    
    setXLoading(true);
    const tid = toast.loading("Transmitindo Carta de Correção para a SEFAZ...");
    try {
      if (row.st_evento === "F") {
        await db.from("fiscal_nfe_cce").update({ st_evento: "A", x_motivo: null, c_stat: null }).eq("nfe_cce_id", row.nfe_cce_id);
      }

      const event = {
        empresa_id: XEmpresaId,
        tipo: "NFE",
        comando: "CCE",
        nfe_cabecalho_id: row.nfe_cabecalho_id,
        payload: {
          nfe_cce_id: row.nfe_cce_id,
          x_correcao: row.x_correcao,
          nr_sequencial: row.nr_sequencial
        },
        status: "PENDENTE"
      };
      
      const { data: insertedEv, error } = await db.from("fiscal_evento").insert(event).select("id").single();
      if (error) throw error;

      let finalEv: any = null;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 500));
        const { data: checkEv } = await db.from("fiscal_evento").select("status, resposta, mensagem_erro").eq("id", insertedEv.id).maybeSingle();
        if (checkEv && checkEv.status !== "PENDENTE") {
          finalEv = checkEv;
          break;
        }
      }

      if (XRefreshRef.current) await XRefreshRef.current();

      if (finalEv) {
        let resp: any = null;
        try {
          resp = typeof finalEv.resposta === "string" ? JSON.parse(finalEv.resposta) : finalEv.resposta;
        } catch {}

        const cStat = resp?.c_stat || resp?.cStat || resp?.c_stat_evento;
        const xMotivo = resp?.x_motivo || resp?.xMotivo || finalEv.mensagem_erro;
        const eSucesso = resp?.sucesso === true || ["135", "136"].includes(String(cStat));

        if (eSucesso) {
          toast.success(xMotivo || "Carta de Correção autorizada com sucesso!", { id: tid });
        } else {
          toast.dismiss(tid);
          await db.from("fiscal_nfe_cce").update({ st_evento: "F", x_motivo: xMotivo || "Rejeição SEFAZ", c_stat: cStat ? parseInt(String(cStat)) : null }).eq("nfe_cce_id", row.nfe_cce_id);
          if (XRefreshRef.current) await XRefreshRef.current();

          setXErrorModal({
            open: true,
            title: "Rejeição / Falha no Envio da CC-e",
            code: cStat ? `Código SEFAZ: ${cStat}` : undefined,
            message: xMotivo || finalEv.mensagem_erro || "Falha ou rejeição ao transmitir a Carta de Correção.",
            row
          });
        }
      } else {
        toast.info("Solicitação enviada ao Worker. O status será atualizado assim que concluído.", { id: tid });
      }
    } catch (e: any) {
      toast.error("Erro ao solicitar envio: " + e.message, { id: tid });
    } finally {
      setXLoading(false);
    }
  };

  const handleImprimir = (row: any) => {
    toast.info("Imprimindo Carta de Correção " + row.nfe_cce_id + "...");
  };

  return (
    <>
      <StandardCrudForm
        config={{
          XTableName: "fiscal_nfe_cce",
          XPrimaryKey: "nfe_cce_id",
          XTitle: "Cartas de Correção (CC-e)",
          XEmpresaId,
          XSoftDelete: false,
          XCanEdit: (rec: any) => rec.st_evento !== "E",
          XDefaultRecord: { 
            empresa_id: XEmpresaId, 
            st_evento: "A", 
            nr_sequencial: 1,
            nfe_cabecalho_id: initialNfeId || null
          },
          XOnAfterLoad: (rows) => {
            const ids = [...new Set(rows.map(r => r.nfe_cabecalho_id).filter(Boolean))] as number[];
            if (ids.length > 0) ensureNfeInfo(ids);
          },
          XOnBeforeSave: (rec) => {
            if (!rec.nfe_cabecalho_id) throw new Error("Vincule uma NF-e.");
            if (!rec.x_correcao || rec.x_correcao.length < 15) throw new Error("A correção deve ter no mínimo 15 caracteres.");
            return rec;
          }
        }}
        XGridCols={XGridCols}
        XRefreshRef={XRefreshRef}
        renderCadastro={({ record, setField, isEditing, handleIncluir }) => (
          <CartaCorrecaoContent 
            record={record}
            setField={setField}
            isEditing={isEditing}
            handleIncluir={handleIncluir}
            XEmpresaId={XEmpresaId}
            XLoading={XLoading}
            XNfeInfo={XNfeInfo}
            setXNfeInfo={setXNfeInfo}
            ensureNfeInfo={ensureNfeInfo}
            handleImprimir={handleImprimir}
            handleTransmitir={handleTransmitir}
          />
        )}
      />

      <Dialog open={XErrorModal.open} onOpenChange={(o) => !o && setXErrorModal(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="w-5 h-5" />
              {XErrorModal.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {XErrorModal.code && (
              <Badge className="bg-destructive/10 text-destructive border-none font-bold text-xs">
                {XErrorModal.code}
              </Badge>
            )}
            <div className="p-3 bg-muted rounded-lg text-sm text-foreground leading-relaxed border border-border">
              {XErrorModal.message}
            </div>
            <p className="text-xs text-muted-foreground italic">
              A Carta de Correção foi liberada para ajuste. Você pode alterar a correção e transmitir novamente.
            </p>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={async () => {
                if (XErrorModal.row?.nfe_cce_id) {
                  await db.from("fiscal_nfe_cce").update({ st_evento: "A" }).eq("nfe_cce_id", XErrorModal.row.nfe_cce_id);
                  if (XRefreshRef.current) await XRefreshRef.current();
                }
                setXErrorModal(prev => ({ ...prev, open: false }));
              }}
              className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Ajustar Carta de Correção
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CartaCorrecaoForm;
