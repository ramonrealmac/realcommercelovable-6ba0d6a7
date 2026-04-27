import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface IProps {
  open: boolean;
  subtotal: number;
  /** Atual desconto em valor */
  descontoAtual?: number;
  /** Atual desconto em percentual */
  percAtual?: number;
  onClose: () => void;
  onAplicar: (desconto: { vl_desconto: number; pc_desconto: number }) => void;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const DescontoDialog: React.FC<IProps> = ({ open, subtotal, descontoAtual, percAtual, onClose, onAplicar }) => {
  const [XTipo, setXTipo] = useState<"P" | "V">("P");
  const [XValor, setXValor] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    if (percAtual && percAtual > 0) { setXTipo("P"); setXValor(percAtual); }
    else if (descontoAtual && descontoAtual > 0) { setXTipo("V"); setXValor(descontoAtual); }
    else { setXTipo("P"); setXValor(0); }
  }, [open, percAtual, descontoAtual]);

  const calcDesconto = (): { vl: number; pc: number } => {
    if (XTipo === "P") {
      const pc = Math.max(0, Math.min(100, XValor));
      return { vl: +(subtotal * pc / 100).toFixed(2), pc };
    }
    const vl = Math.max(0, Math.min(subtotal, XValor));
    const pc = subtotal > 0 ? +(vl * 100 / subtotal).toFixed(2) : 0;
    return { vl, pc };
  };

  const { vl: vlCalc, pc: pcCalc } = calcDesconto();
  const totalFinal = Math.max(0, subtotal - vlCalc);

  const aplicar = () => {
    if (vlCalc > subtotal) { toast.error("Desconto não pode ultrapassar o subtotal."); return; }
    onAplicar({ vl_desconto: vlCalc, pc_desconto: pcCalc });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Aplicar Desconto</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setXTipo("P")}
                className={`flex-1 py-2 rounded border text-sm font-semibold ${
                  XTipo === "P" ? "bg-amber-500 text-white border-amber-600" : "bg-card border-border hover:bg-accent"
                }`}>% Percentual</button>
              <button
                onClick={() => setXTipo("V")}
                className={`flex-1 py-2 rounded border text-sm font-semibold ${
                  XTipo === "V" ? "bg-amber-500 text-white border-amber-600" : "bg-card border-border hover:bg-accent"
                }`}>R$ Valor</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Valor do Desconto ({XTipo === "P" ? "%" : "R$"})
            </label>
            <input
              type="number"
              autoFocus
              value={XValor}
              onChange={e => setXValor(Number(e.target.value) || 0)}
              onKeyDown={e => { if (e.key === "Enter") aplicar(); }}
              className={`w-full border border-border rounded px-3 py-2 text-right text-lg font-bold bg-white text-black ${NO_SPIN}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1.5 text-center">
              <div className="text-[10px] text-blue-900 dark:text-blue-200">Subtotal</div>
              <div className="font-bold text-blue-900 dark:text-blue-200">R$ {fmt(subtotal)}</div>
            </div>
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5 text-center">
              <div className="text-[10px] text-amber-900 dark:text-amber-200">Desc. {pcCalc.toFixed(1)}%</div>
              <div className="font-bold text-amber-900 dark:text-amber-200">R$ {fmt(vlCalc)}</div>
            </div>
            <div className="border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1.5 text-center">
              <div className="text-[10px] text-emerald-900 dark:text-emerald-200">Total</div>
              <div className="font-bold text-emerald-900 dark:text-emerald-200">R$ {fmt(totalFinal)}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button onClick={() => { onAplicar({ vl_desconto: 0, pc_desconto: 0 }); onClose(); }}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">
            Remover
          </button>
          <button onClick={onClose}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">
            Cancelar
          </button>
          <button onClick={aplicar}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 text-white font-semibold hover:bg-amber-600">
            Aplicar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DescontoDialog;
