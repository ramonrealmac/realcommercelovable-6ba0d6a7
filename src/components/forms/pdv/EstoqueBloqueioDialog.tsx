import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, PackageX, X } from "lucide-react";

export interface IEstoqueBloqueioItem {
  produto_id: number;
  nm_produto: string;
  qt_pedido: number;
  qt_disponivel: number;
  unidade_id: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  itens: IEstoqueBloqueioItem[];
}

const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const EstoqueBloqueioDialog: React.FC<IProps> = ({ open, onClose, itens }) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden rounded-xl border border-rose-300 shadow-2xl">
        {/* Header vermelho */}
        <div className="bg-rose-600 px-5 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base font-bold leading-tight">
              Estoque Insuficiente
            </DialogTitle>
            <p className="text-rose-100 text-xs mt-0.5">
              Os produtos abaixo não possuem saldo disponível suficiente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabela de produtos com problema */}
        <div className="bg-background px-4 py-3 max-h-80 overflow-y-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 pr-2 text-muted-foreground font-semibold uppercase tracking-wide">Produto</th>
                <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">Qtde. Pedida</th>
                <th className="text-right py-1.5 pl-2 text-muted-foreground font-semibold uppercase tracking-wide whitespace-nowrap">Saldo Disp.</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr
                  key={it.produto_id}
                  className={`border-b border-border/50 ${idx % 2 ? "bg-rose-50/50 dark:bg-rose-950/10" : ""}`}
                >
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      <PackageX className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="font-medium text-foreground leading-tight">{it.nm_produto}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground pl-5">ID {it.produto_id}</div>
                  </td>
                  <td className="text-right py-2 px-2 font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                    {fmt(it.qt_pedido)} {it.unidade_id || ""}
                  </td>
                  <td className={`text-right py-2 pl-2 font-mono font-bold whitespace-nowrap ${
                    it.qt_disponivel <= 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-orange-600 dark:text-orange-400"
                  }`}>
                    {fmt(it.qt_disponivel)} {it.unidade_id || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 px-4 py-3 flex items-center justify-between gap-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Regularize o estoque ou remova os itens do pedido para prosseguir.
          </p>
          <button
            onClick={onClose}
            className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md transition-colors"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EstoqueBloqueioDialog;
