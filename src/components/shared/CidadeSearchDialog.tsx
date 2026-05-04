import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

const db = supabase as any;

export interface ICidadeRow {
  cidade_id: number;
  descricao: string;
  estado_id: string | null;
  cd_ibge: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cidade: ICidadeRow) => void;
}

const CidadeSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<ICidadeRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    let q = db.from("cidade")
      .select("cidade_id, descricao, estado_id, cd_ibge")
      .eq("excluido", false)
      .order("descricao")
      .limit(100);

    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`cidade_id.eq.${t},cd_ibge.ilike.%${t}%,descricao.ilike.%${t}%`);
      } else {
        q = q.ilike("descricao", `%${t}%`);
      }
    }

    const { data, error } = await q;
    if (error || !data) {
      setXLoading(false);
      setXRows([]);
      return;
    }

    setXRows(data as ICidadeRow[]);
    setXSelectedIdx(null);
    setXLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setXTermo("");
      setXSelectedIdx(null);
      buscar("");
    }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pesquisar Cidade</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              placeholder="Digite código, nome ou IBGE..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
              <div className="col-span-2 text-right">Código</div>
              <div className="col-span-6">Descrição</div>
              <div className="col-span-1">UF</div>
              <div className="col-span-3 text-right">Cód. IBGE</div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
              {XLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
              {!XLoading && XRows.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma cidade encontrada.</div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const sel = XSelectedIdx === idx;
                const zebra = idx % 2 === 1 ? "bg-muted/30" : "";
                return (
                  <div
                    key={r.cidade_id}
                    onClick={() => setXSelectedIdx(idx)}
                    onDoubleClick={() => { onSelect(r); onClose(); }}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-t border-border cursor-pointer ${
                      sel ? "bg-primary/15" : `${zebra} hover:bg-accent/50`
                    }`}
                  >
                    <div className="col-span-2 text-right font-mono">{r.cidade_id}</div>
                    <div className="col-span-6 truncate uppercase">{r.descricao}</div>
                    <div className="col-span-1 uppercase font-bold">{r.estado_id || ""}</div>
                    <div className="col-span-3 text-right font-mono text-muted-foreground">
                      {r.cd_ibge || "-"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>Duplo clique</strong> para selecionar a cidade.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CidadeSearchDialog;
