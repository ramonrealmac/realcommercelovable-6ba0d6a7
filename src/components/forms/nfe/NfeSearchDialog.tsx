import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X, FileText, Calendar, User, DollarSign } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

const db = supabase as any;

export interface INfeRow {
  nfe_cabecalho_id: number;
  nr_nota: number | string;
  serie: number | string;
  dt_emissao: string;
  vl_total_nf: number;
  cadastro_id: number;
  st_nf: string;
  razao_social?: string;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (nfe: INfeRow) => void;
}

export async function buscarNfePorNumero(
  termo: string,
  empresaId: number
): Promise<INfeRow | null> {
  const t = (termo || "").trim();
  if (!t) return null;

  let query = db.from("fiscal_nfe_cabecalho")
    .select("nfe_cabecalho_id, nr_nota, serie, dt_emissao, vl_total_nf, cadastro_id, st_nf")
    .eq("empresa_id", empresaId)
    .limit(5);

  if (/^\d+$/.test(t)) {
    query = query.eq("nr_nota", t);
  } else {
    // Busca por chave ou outro campo se necessário
    return null;
  }

  const { data } = await query;
  if (!data || data.length === 0) return null;

  const nfe = data[0];
  
  // Buscar nome do destinatário
  if (nfe.cadastro_id) {
    const { data: cad } = await db.from("cadastro").select("razao_social").eq("cadastro_id", nfe.cadastro_id).maybeSingle();
    if (cad) nfe.razao_social = cad.razao_social;
  }

  return nfe as INfeRow;
}

const NfeSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect }) => {
  const { XEmpresaId } = useAppContext();
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<INfeRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XClienteCache, setXClienteCache] = useState<Record<number, string>>({});

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    let query = db.from("fiscal_nfe_cabecalho")
      .select("nfe_cabecalho_id, nr_nota, serie, dt_emissao, vl_total_nf, cadastro_id, st_nf")
      .eq("empresa_id", XEmpresaId)
      .order("nfe_cabecalho_id", { ascending: false })
      .limit(50);

    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        query = query.eq("nr_nota", t);
      }
    }

    const { data, error } = await query;
    if (error || !data) { setXLoading(false); setXRows([]); return; }

    const rows = data as INfeRow[];
    setXRows(rows);

    // Carregar nomes dos destinatários em lote
    const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
    if (ids.length > 0) {
      const { data: parceiros } = await db.from("cadastro")
        .select("cadastro_id, razao_social")
        .in("cadastro_id", ids);
      if (parceiros) {
        const cache: Record<number, string> = {};
        parceiros.forEach((p: any) => cache[p.cadastro_id] = p.razao_social);
        setXClienteCache(prev => ({ ...prev, ...cache }));
      }
    }
    
    setXLoading(false);
  }, [XEmpresaId]);

  useEffect(() => {
    if (open) {
      setXTermo("");
      buscar("");
    }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  const fmtNum = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Pesquisar NF-e / NFC-e
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              placeholder="Digite o número da nota fiscal..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded-lg text-sm bg-card focus:ring-1 focus:ring-primary outline-none"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-wider border-b border-border">
              <div className="col-span-2">Número</div>
              <div className="col-span-1 text-center">Série</div>
              <div className="col-span-2 text-center">Emissão</div>
              <div className="col-span-5">Destinatário</div>
              <div className="col-span-2 text-right">Valor</div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {XLoading && <div className="p-10 text-center text-sm text-muted-foreground animate-pulse">Carregando documentos...</div>}
              {!XLoading && XRows.length === 0 && (
                <div className="p-10 text-center text-sm text-muted-foreground italic">Nenhuma nota fiscal localizada.</div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const zebra = idx % 2 === 1 ? "bg-muted/20" : "bg-card";
                return (
                  <div
                    key={r.nfe_cabecalho_id}
                    onClick={() => { onSelect({ ...r, razao_social: XClienteCache[r.cadastro_id] }); onClose(); }}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-primary/5 ${zebra}`}
                  >
                    <div className="col-span-2 font-bold flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                      {r.nr_nota}
                    </div>
                    <div className="col-span-1 text-center font-mono text-xs">{r.serie}</div>
                    <div className="col-span-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.dt_emissao).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="col-span-5 truncate text-xs flex items-center gap-1">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {XClienteCache[r.cadastro_id] || `#${r.cadastro_id}`}
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold text-primary flex items-center justify-end gap-1">
                      <DollarSign className="w-3 h-3" />
                      {fmtNum(r.vl_total_nf)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic px-1">
            * Clique em uma linha para selecionar o documento fiscal.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NfeSearchDialog;
