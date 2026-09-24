import React, { useEffect, useState, useRef } from "react";
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
  const [XValor, setXValor] = useState<string>("");
  const [XApplying, setXApplying] = useState(false);

  const btnPercentRef = useRef<HTMLButtonElement>(null);
  const btnValorRef = useRef<HTMLButtonElement>(null);
  const inputValRef = useRef<HTMLInputElement>(null);
  const btnAplicarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      setXApplying(false);
      return;
    }
    let tipoInicial: "P" | "V" = "P";
    if (percAtual && percAtual > 0) {
      tipoInicial = "P";
      setXValor(String(percAtual).replace(".", ","));
    } else if (descontoAtual && descontoAtual > 0) {
      tipoInicial = "V";
      setXValor(String(descontoAtual).replace(".", ","));
    } else {
      tipoInicial = "P";
      setXValor("");
    }
    setXTipo(tipoInicial);
    setXApplying(false);

    setTimeout(() => {
      if (tipoInicial === "P") {
        btnPercentRef.current?.focus();
      } else {
        btnValorRef.current?.focus();
      }
    }, 50);
  }, [open, percAtual, descontoAtual]);

  const parseNum = (v: string) => {
    if (!v) return 0;
    const n = parseFloat(v.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const calcDesconto = (): { vl: number; pc: number } => {
    const val = parseNum(XValor);
    if (XTipo === "P") {
      const pc = Math.max(0, Math.min(100, val));
      return { vl: +(subtotal * pc / 100).toFixed(2), pc };
    }
    const vl = Math.max(0, Math.min(subtotal, val));
    const pc = subtotal > 0 ? +(vl * 100 / subtotal).toFixed(2) : 0;
    return { vl, pc };
  };

  const { vl: vlCalc, pc: pcCalc } = calcDesconto();
  const totalFinal = Math.max(0, subtotal - vlCalc);

  const aplicar = () => {
    if (XApplying) return;
    if (vlCalc > subtotal) {
      toast.error("Desconto não pode ultrapassar o subtotal.");
      return;
    }
    setXApplying(true);
    onAplicar({ vl_desconto: vlCalc, pc_desconto: pcCalc });

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Pequeno delay para garantir consumo completo dos eventos Enter/Click no modal
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleTypeKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setXTipo("P");
      btnPercentRef.current?.focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setXTipo("V");
      btnValorRef.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      inputValRef.current?.focus();
      inputValRef.current?.select();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const val = parseNum(XValor);
      if (val > 0) {
        setXValor(val.toFixed(2).replace(".", ","));
      }
      btnAplicarRef.current?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (XTipo === "P") btnPercentRef.current?.focus();
      else btnValorRef.current?.focus();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (XTipo === "P") btnPercentRef.current?.focus();
          else btnValorRef.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Aplicar Desconto</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo (Use ← → e Enter para selecionar)</label>
            <div className="flex gap-2 mt-1">
              <button
                ref={btnPercentRef}
                type="button"
                onClick={() => { setXTipo("P"); inputValRef.current?.focus(); }}
                onKeyDown={handleTypeKeyDown}
                className={`flex-1 py-2 rounded border text-sm font-semibold transition-all focus:ring-2 focus:ring-amber-400 focus:outline-none ${
                  XTipo === "P" ? "bg-amber-500 text-white border-amber-600 shadow-sm" : "bg-card border-border hover:bg-accent"
                }`}
              >
                % Percentual
              </button>
              <button
                ref={btnValorRef}
                type="button"
                onClick={() => { setXTipo("V"); inputValRef.current?.focus(); }}
                onKeyDown={handleTypeKeyDown}
                className={`flex-1 py-2 rounded border text-sm font-semibold transition-all focus:ring-2 focus:ring-amber-400 focus:outline-none ${
                  XTipo === "V" ? "bg-amber-500 text-white border-amber-600 shadow-sm" : "bg-card border-border hover:bg-accent"
                }`}
              >
                R$ Valor
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Valor do Desconto ({XTipo === "P" ? "%" : "R$"})
            </label>
            <input
              ref={inputValRef}
              type="text"
              value={XValor}
              onChange={e => setXValor(e.target.value)}
              onBlur={() => {
                const val = parseNum(XValor);
                if (val > 0) setXValor(val.toFixed(2).replace(".", ","));
                else setXValor("");
              }}
              onKeyDown={handleInputKeyDown}
              className={`w-full border border-border rounded px-3 py-2 text-right text-lg font-bold bg-white text-black focus:ring-2 focus:ring-amber-400 focus:outline-none ${NO_SPIN}`}
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
          <button
            type="button"
            onClick={() => { onAplicar({ vl_desconto: 0, pc_desconto: 0 }); onClose(); }}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent"
          >
            Remover
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            ref={btnAplicarRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              aplicar();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                aplicar();
              }
            }}
            className="text-sm px-4 py-1.5 rounded bg-amber-500 text-white font-semibold hover:bg-amber-600 focus:ring-2 focus:ring-amber-400 focus:outline-none"
          >
            Aplicar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DescontoDialog;
