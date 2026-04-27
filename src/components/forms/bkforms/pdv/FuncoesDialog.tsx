import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, ArrowUpFromLine, Receipt, Printer, Ban, Lock } from "lucide-react";
import { toast } from "sonner";

interface IProps {
  open: boolean;
  /** caixa.caixa_cnc_venda === 'S' habilita Cancelamento */
  podeCancelar: boolean;
  onClose: () => void;
  onCancelamento: () => void;
}

const FuncoesDialog: React.FC<IProps> = ({ open, podeCancelar, onClose, onCancelamento }) => {
  const cards = [
    { key: "supr", label: "Suprimento", desc: "Entrada de dinheiro no caixa",
      icon: <ArrowDownToLine size={28} />, color: "text-emerald-600",
      action: () => toast.info("Suprimento será implementado em seguida."), enabled: false },
    { key: "sang", label: "Sangria", desc: "Retirada de dinheiro do caixa",
      icon: <ArrowUpFromLine size={28} />, color: "text-rose-600",
      action: () => toast.info("Sangria será implementada em seguida."), enabled: false },
    { key: "ult", label: "Última Venda", desc: "Reimprime a última venda",
      icon: <Receipt size={28} />, color: "text-blue-600",
      action: () => toast.info("Última Venda será implementada em seguida."), enabled: false },
    { key: "reimp", label: "Reimpressão", desc: "Reimprime cupom/NF",
      icon: <Printer size={28} />, color: "text-indigo-600",
      action: () => toast.info("Reimpressão será implementada em seguida."), enabled: false },
    { key: "canc", label: "Cancelamento", desc: "Cancela uma venda",
      icon: <Ban size={28} />, color: "text-red-600",
      action: () => { onClose(); onCancelamento(); }, enabled: podeCancelar },
    { key: "fech", label: "Fechamento", desc: "Fechamento do caixa",
      icon: <Lock size={28} />, color: "text-amber-600",
      action: () => toast.info("Fechamento será implementado em seguida."), enabled: false },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Funções do Caixa</DialogTitle></DialogHeader>
        <div className="grid grid-cols-3 gap-3 py-2">
          {cards.map(c => (
            <button key={c.key} onClick={c.action} disabled={!c.enabled}
              className={`border border-border rounded p-4 text-left flex flex-col items-center gap-2 transition
                ${c.enabled ? "hover:bg-accent hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
              <div className={c.color}>{c.icon}</div>
              <div className="text-center">
                <div className="font-semibold text-sm">{c.label}</div>
                <div className="text-[11px] text-muted-foreground">{c.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <button onClick={onClose} className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FuncoesDialog;
