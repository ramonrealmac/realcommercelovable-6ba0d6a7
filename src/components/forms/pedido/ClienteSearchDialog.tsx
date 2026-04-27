import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X } from "lucide-react";

const db = supabase as any;

export interface IClienteRow {
  cadastro_id: number;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cliente: IClienteRow) => void;
  empresaId: number;
}

const ClienteSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IClienteRow[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    let q = db.from("cadastro")
      .select("cadastro_id, cnpj, razao_social, nome_fantasia")
      .eq("excluido", false)
      .eq("st_cliente", "S")
      .eq("empresa_id", empresaId)
      .order("razao_social")
      .limit(100);
    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`cadastro_id.eq.${t},cnpj.ilike.%${t}%`);
      } else {
        q = q.or(`razao_social.ilike.%${t}%,nome_fantasia.ilike.%${t}%,cnpj.ilike.%${t}%`);
      }
    }
    const { data, error } = await q;
    setXLoading(false);
    if (!error) setXRows((data || []) as IClienteRow[]);
  }, [empresaId]);

  useEffect(() => {
    if (open) { setXTermo(""); buscar(""); }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Pesquisar Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              placeholder="Digite código, CPF/CNPJ, razão social ou fantasia..."
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
              <div className="col-span-1 text-right">Código</div>
              <div className="col-span-3">CPF/CNPJ</div>
              <div className="col-span-5">Razão Social</div>
              <div className="col-span-3">Fantasia</div>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {XLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
              {!XLoading && XRows.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
              )}
              {!XLoading && XRows.map(r => (
                <button
                  key={r.cadastro_id}
                  onDoubleClick={() => { onSelect(r); onClose(); }}
                  onClick={() => { onSelect(r); onClose(); }}
                  className="w-full grid grid-cols-12 gap-2 px-3 py-2 text-sm text-left border-t border-border hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="col-span-1 text-right font-mono">{r.cadastro_id}</div>
                  <div className="col-span-3 font-mono text-xs">{r.cnpj || ""}</div>
                  <div className="col-span-5 truncate">{r.razao_social || ""}</div>
                  <div className="col-span-3 truncate text-muted-foreground">{r.nome_fantasia || ""}</div>
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Clique (ou duplo-clique) para selecionar. Resultados limitados a 100.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteSearchDialog;
