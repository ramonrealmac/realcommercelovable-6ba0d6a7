import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { RotateCcw, X } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface IProps {
  open: boolean;
  caixaNome: string;
  onClose: () => void;
  onEstornado: () => void;
}

interface IPedidoEstornoRow {
  movimento_id: number;
  nr_movimento: number | null;
  cliente_nome: string;
  vl_movimento: number;
  st_pedido: string;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EstornoDialog: React.FC<IProps> = ({ open, onClose, onEstornado }) => {
  const { XEmpresaId } = useAppContext();
  const [XPedidos, setXPedidos] = useState<IPedidoEstornoRow[]>([]);
  const [XSelId, setXSelId] = useState<number>(0);
  const [XSalvando, setXSalvando] = useState(false);

  useEffect(() => {
    if (!open || !XEmpresaId) return;
    setXSelId(0);
    (async () => {
      const { data } = await db.from("movimento")
        .select("movimento_id, nr_movimento, cadastro_id, vl_movimento, st_pedido")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("st_pedido", "R")
        .order("movimento_id", { ascending: false })
        .limit(100);
        
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lista = (data || []) as any[];
      const cadIds = Array.from(new Set(lista.map(m => m.cadastro_id).filter(Boolean)));
      const cadRes = cadIds.length
        ? await db.from("cadastro").select("cadastro_id, razao_social, nome_fantasia").in("cadastro_id", cadIds)
        : { data: [] };
      const cadMap: Record<number, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const c of (cadRes.data || []) as any[]) {
        cadMap[c.cadastro_id] = c.nome_fantasia || c.razao_social;
      }
      setXPedidos(lista.map(m => ({
        movimento_id: m.movimento_id,
        nr_movimento: m.nr_movimento,
        cliente_nome: cadMap[m.cadastro_id] || "(Consumidor)",
        vl_movimento: Number(m.vl_movimento || 0),
        st_pedido: m.st_pedido,
      })));
    })();
  }, [open, XEmpresaId]);

  const estornar = async () => {
    if (!XSelId) { toast.error("Selecione um pedido."); return; }
    if (!confirm("Confirma o estorno desta venda? O pedido voltará para o caixa no estado de pré-venda (digitação).")) return;
    setXSalvando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await db.rpc("fu_pdv_estornar_venda", {
        _movimento_id: XSelId,
        _usuario_id: userId,
      });

      if (error) { toast.error(error.message); return; }
      if (data?.error) { toast.error(data.error); return; }

      toast.success("Venda estornada com sucesso.");
      onEstornado();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao estornar: " + msg);
    } finally { 
      setXSalvando(false); 
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="bg-topbar p-4 rounded-t-lg -mx-6 -mt-6 mb-4">
          <DialogTitle className="text-topbar-foreground opacity-70 uppercase tracking-wider text-center flex items-center justify-center gap-2">
            <RotateCcw size={20} /> Estorno de Venda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Selecione o pedido recebido para estornar</label>
          <div className="max-h-60 overflow-y-auto border border-border rounded">
            {XPedidos.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">Nenhum pedido finalizado disponível para estorno.</div>
            )}
            {XPedidos.map((p, i) => (
              <button key={p.movimento_id}
                onClick={() => setXSelId(p.movimento_id)}
                className={`w-full text-left px-3 py-2 border-b border-border text-sm
                  ${i % 2 ? "bg-muted/40" : ""}
                  ${XSelId === p.movimento_id ? "!bg-amber-100 dark:!bg-amber-950/40" : "hover:bg-accent/50"}`}>
                <div className="flex justify-between">
                  <span><strong>Nº {p.nr_movimento || p.movimento_id}</strong> · <span className="text-blue-600 dark:text-blue-400">{p.cliente_nome}</span></span>
                  <span className="font-mono">R$ {fmt(p.vl_movimento)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Status: Recebido</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} disabled={XSalvando}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent flex items-center gap-1.5">
            <X size={16} className="text-rose-500" /> Cancelar
          </button>
          <button onClick={estornar} disabled={XSalvando || !XSelId}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5">
            <RotateCcw size={16} /> {XSalvando ? "Estornando..." : "Estornar Venda"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EstornoDialog;
