import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, X, FileX } from "lucide-react";
import type { IFiscalValidacaoErro } from "@/services/fiscalPreValidacao";

interface IProps {
  open: boolean;
  onClose: () => void;
  tipo: "NFE" | "NFCE";
  erros: IFiscalValidacaoErro[];
}

const FiscalPreValidacaoDialog: React.FC<IProps> = ({ open, onClose, tipo, erros }) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl w-full p-0 overflow-hidden rounded-xl border border-amber-300 shadow-2xl">
        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 shrink-0">
            <FileX className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-bold leading-tight">
              Dados Incompletos — {tipo === "NFE" ? "NF-e" : "NFC-e"}
            </DialogTitle>
            <p className="text-amber-50 text-xs mt-0.5">
              Corrija os campos abaixo antes de emitir o documento fiscal.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de erros */}
        <div className="bg-background px-4 py-3 max-h-96 overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground font-semibold uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            {erros.length} {erros.length === 1 ? "problema encontrado" : "problemas encontrados"}
          </div>
          <ul className="space-y-1.5">
            {erros.map((er, idx) => (
              <li
                key={idx}
                className="flex gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300 leading-tight">
                    {er.campo}
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {er.mensagem}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 px-4 py-3 flex justify-end border-t border-border">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-md transition-colors"
          >
            Entendido — Vou corrigir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FiscalPreValidacaoDialog;
