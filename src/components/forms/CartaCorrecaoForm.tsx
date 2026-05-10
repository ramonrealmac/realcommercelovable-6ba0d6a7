import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { Search, Send, FileText, CheckCircle2, Clock, AlertCircle, Printer, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import NfeSearchDialog, { buscarNfePorNumero, INfeRow } from "./nfe/NfeSearchDialog";

const db = supabase as any;

const CartaCorrecaoForm: React.FC<{ initialNfeId?: number }> = ({ initialNfeId }) => {
  const { XEmpresaId } = useAppContext();
  const [XNfeInfo, setXNfeInfo] = useState<Record<number, { nr: string | number; serie: string | number }>>({});
  const [XLoading, setXLoading] = useState(false);
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XOpenNfeSearch, setXOpenNfeSearch] = useState(false);
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const nfeSearchRef = useRef<HTMLInputElement>(null);

  const XGridCols: IGridColumn[] = [
    { key: "nfe_cce_id", label: "Cód.", width: "80px", align: "right" },
    { 
      key: "nfe_cabecalho_id", 
      label: "NF-e", 
      width: "150px", 
      render: r => XNfeInfo[r.nfe_cabecalho_id] ? `Nota ${XNfeInfo[r.nfe_cabecalho_id].nr} (Série ${XNfeInfo[r.nfe_cabecalho_id].serie})` : `#${r.nfe_cabecalho_id}`
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
          "E": { label: "Enviado", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
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
    const { data } = await db.from("fiscal_nfe_cabecalho").select("nfe_cabecalho_id, nr_nota, serie").in("nfe_cabecalho_id", missing);
    if (data) {
      setXNfeInfo(prev => {
        const next = { ...prev };
        data.forEach((d: any) => next[d.nfe_cabecalho_id] = { nr: d.nr_nota, serie: d.serie });
        return next;
      });
    }
  }, [XNfeInfo]);

  const handleTransmitir = async (row: any) => {
    if (row.st_evento === "E") {
      toast.warning("Esta CC-e já foi enviada.");
      return;
    }
    
    setXLoading(true);
    try {
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
      
      const { error } = await db.from("fiscal_evento").insert(event);
      if (error) throw error;
      
      toast.success("Solicitação de envio enviada ao Fiscal Worker.");
      if (XRefreshRef.current) await XRefreshRef.current();
    } catch (e: any) {
      toast.error("Erro ao solicitar envio: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const handleImprimir = (row: any) => {
    toast.info("Imprimindo Carta de Correção " + row.nfe_cce_id + "...");
    // Aqui viria a chamada para gerar o PDF ou abrir o link do worker
  };

  return (
    <StandardCrudForm
      config={{
        XTableName: "fiscal_nfe_cce",
        XPrimaryKey: "nfe_cce_id",
        XTitle: "Cartas de Correção (CC-e)",
        XEmpresaId,
        XSoftDelete: false,
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
      renderCadastro={({ record, setField, isEditing }) => {
        const handleBuscarNfe = async () => {
          const t = XSearchTerm.trim();
          if (!t) { setXOpenNfeSearch(true); return; }
          const nfe = await buscarNfePorNumero(t, XEmpresaId);
          if (nfe) {
            setXNfeInfo(prev => ({ ...prev, [nfe.nfe_cabecalho_id]: { nr: nfe.nr_nota, serie: nfe.serie } }));
            setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
            setXSearchTerm("");
          } else {
            toast.info("Nota não localizada por número. Abrindo pesquisa avançada...");
            setXOpenNfeSearch(true);
          }
        };

        const onSelectNfe = (nfe: INfeRow) => {
          setXNfeInfo(prev => ({ ...prev, [nfe.nfe_cabecalho_id]: { nr: nfe.nr_nota, serie: nfe.serie } }));
          setField("nfe_cabecalho_id", nfe.nfe_cabecalho_id);
          setXSearchTerm("");
        };

        useEffect(() => {
          if (record.nfe_cabecalho_id) {
            ensureNfeInfo([record.nfe_cabecalho_id]);
          }
        }, [record.nfe_cabecalho_id]);

        return (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-8">
                <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">NF-e Vinculada</label>
                <div className="flex flex-col gap-2">
                  {record.nfe_cabecalho_id ? (
                    <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                      <FileText className="w-4 h-4 text-primary" />
                      <div className="flex-1 text-sm font-medium">
                        {XNfeInfo[record.nfe_cabecalho_id] 
                          ? `Nota ${XNfeInfo[record.nfe_cabecalho_id].nr} (Série ${XNfeInfo[record.nfe_cabecalho_id].serie})` 
                          : `Carregando nota #${record.nfe_cabecalho_id}...`}
                      </div>
                      {isEditing && (
                        <button 
                          type="button"
                          onClick={() => { setField("nfe_cabecalho_id", null); setXSearchTerm(""); }}
                          className="p-1 hover:bg-destructive/10 text-destructive rounded-full"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          ref={nfeSearchRef}
                          readOnly={!isEditing}
                          value={XSearchTerm} 
                          onChange={e => setXSearchTerm(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") handleBuscarNfe(); }}
                          className="w-full pl-8 pr-3 py-1.5 border border-border rounded text-sm bg-background focus:ring-1 focus:ring-primary outline-none transition-all"
                          placeholder={isEditing ? "Bipe ou digite o nº da nota... (Enter)" : "Nenhuma nota vinculada"}
                        />
                      </div>
                      {isEditing && (
                        <button 
                          type="button"
                          onClick={() => setXOpenNfeSearch(true)}
                          className="p-2 border border-border rounded bg-card hover:bg-accent transition-colors shadow-sm"
                          title="Pesquisa Avançada"
                        >
                          <Search className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Seq. Evento</label>
              <input 
                type="number"
                readOnly={!isEditing} 
                value={record.nr_sequencial ?? 1} 
                onChange={e => setField("nr_sequencial", parseInt(e.target.value))}
                className="w-full border border-border rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Status</label>
              <div className="py-1.5 px-3 bg-secondary rounded border border-border text-xs font-bold uppercase flex items-center gap-2">
                 <Clock size={12} className={record.st_evento === "A" ? "text-orange-500" : ""} />
                 {record.st_evento === "E" ? "Enviado" : (record.st_evento === "F" ? "Falha" : "Pendente")}
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-bold mb-1 block">Texto da Correção (Min. 15 caracteres)</label>
            <textarea 
              readOnly={!isEditing}
              value={record.x_correcao ?? ""} 
              onChange={e => setField("x_correcao", e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm min-h-[120px] focus:ring-1 focus:ring-primary outline-none transition-all"
              placeholder="Descreva as correções de forma clara (ex: Alteração da Natureza da Operação para...)"
            />
          </div>

          {!isEditing && record.nfe_cce_id && (
            <div className="flex justify-end gap-2 pt-4">
              {record.st_evento === "E" && (
                <button 
                  onClick={() => handleImprimir(record)}
                  className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-bold hover:bg-secondary/80 transition-all shadow-md active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  IMPRIMIR CC-E
                </button>
              )}
              <button 
                onClick={() => handleTransmitir(record)}
                disabled={XLoading || record.st_evento === "E"}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-md active:scale-95"
              >
                {XLoading ? <Clock className="animate-spin w-4 h-4" /> : <Send className="w-4 h-4" />}
                TRANSMITIR CC-E
              </button>
            </div>
          )}

          {record.x_motivo && (
            <div className="p-4 bg-muted/50 rounded-xl border border-border shadow-inner">
              <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Retorno da SEFAZ</p>
              <p className="text-sm font-medium">{record.x_motivo}</p>
              {record.nr_protocolo && <p className="text-[10px] mt-2 font-mono bg-background p-1 inline-block rounded">Protocolo: {record.nr_protocolo}</p>}
            </div>
          )}
          
          <NfeSearchDialog 
            open={XOpenNfeSearch} 
            onClose={() => setXOpenNfeSearch(false)} 
            onSelect={onSelectNfe} 
          />
        </div>
        );
      }}
    />
  );
};

export default CartaCorrecaoForm;
