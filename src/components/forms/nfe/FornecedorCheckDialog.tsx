import React from "react";
import { AlertTriangle, UserPlus, X } from "lucide-react";
import type { INfeXmlEmitente } from "./types";
import { formatCPFCNPJ } from "@/lib/validators";

interface FornecedorCheckDialogProps {
  open: boolean;
  emitente: INfeXmlEmitente | null;
  onCadastrar: () => void;
  onCancelar: () => void;
}

const FornecedorCheckDialog: React.FC<FornecedorCheckDialogProps> = ({
  open,
  emitente,
  onCadastrar,
  onCancelar,
}) => {
  if (!open || !emitente) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-destructive/10">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <h2 className="text-base font-semibold text-destructive">Fornecedor não cadastrado</h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            O emitente da NF-e não foi encontrado no cadastro pelo CNPJ:
          </p>

          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">CNPJ:</span>
              <span className="font-medium">{formatCPFCNPJ(emitente.cnpj)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-20 shrink-0">Razão:</span>
              <span className="font-medium">{emitente.razao_social}</span>
            </div>
            {emitente.nome_fantasia && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Fantasia:</span>
                <span>{emitente.nome_fantasia}</span>
              </div>
            )}
            {emitente.fone && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Telefone:</span>
                <span>{emitente.fone}</span>
              </div>
            )}
            {emitente.endereco_cidade && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-20 shrink-0">Cidade:</span>
                <span>{emitente.endereco_cidade} - {emitente.endereco_uf}</span>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Deseja cadastrar este fornecedor agora? O formulário de cadastro será aberto em uma nova aba com os dados pré-preenchidos.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-secondary/20">
          <button
            type="button"
            onClick={onCancelar}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={onCadastrar}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar Fornecedor
          </button>
        </div>
      </div>
    </div>
  );
};

export default FornecedorCheckDialog;
