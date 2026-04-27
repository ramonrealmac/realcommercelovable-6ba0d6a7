import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search } from "lucide-react";

const db = supabase as any;

export interface IVendedorRow {
  cadastro_id: number;
  razao_social: string | null;
  nome_fantasia: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (v: IVendedorRow) => void;
  empresaId: number;
}

const VendedorSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IVendedorRow[]>([]);

  const buscar = useCallback(async (t: string) => {
    let q = db.from("cadastro")
      .select("cadastro_id, razao_social, nome_fantasia")
      .eq("excluido", false)
      .eq("st_vendedor", "S")
      .eq("empresa_id", empresaId)
      .order("razao_social")
      .limit(100);
    const term = t.trim();
    if (term) q = q.or(`razao_social.ilike.%${term}%,nome_fantasia.ilike.%${term}%`);
    const { data } = await q;
    setXRows((data || []) as IVendedorRow[]);
  }, [empresaId]);

  useEffect(() => { if (open) { setXTermo(""); buscar(""); } }, [open, buscar]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Selecionar Vendedor</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input autoFocus value={XTermo} onChange={e => setXTermo(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-8 pr-2 py-2 border border-border rounded text-sm bg-card" />
        </div>
        <div className="max-h-80 overflow-y-auto border border-border rounded">
          {XRows.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground text-center">Nenhum vendedor encontrado.</div>
          )}
          {XRows.map(r => (
            <button key={r.cadastro_id}
              onClick={() => { onSelect(r); onClose(); }}
              className="w-full text-left px-3 py-2 border-b border-border hover:bg-accent text-sm">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {r.nome_fantasia || r.razao_social}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VendedorSearchDialog;
