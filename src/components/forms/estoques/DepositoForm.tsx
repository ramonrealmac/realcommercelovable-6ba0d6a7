import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { InicializarDepositoDialog } from "./InicializarDepositoDialog";
interface IDeposito {
  deposito_id: number;
  nome: string;
  endereco: string;
  empresa_id: number;
  st_privado: boolean;
}

const XGridCols: IGridColumn[] = [
  { key: "deposito_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "endereco", label: "Endereço", width: "1fr" },
];

const DepositoForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [isInitOpen, setIsInitOpen] = useState(false);

  // IDs de empresas "irmãs" (mesma matriz, exceto a atual)
  const XSisterIds = XEmpresas
    .filter(e => (e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId) && e.empresa_id !== XEmpresaId)
    .map(e => e.empresa_id);

  return (
    <StandardCrudForm<IDeposito>
      config={{
        XTableName: "deposito",
        XPrimaryKey: "deposito_id",
        XTitle: "Depósitos",
        XDefaultRecord: { nome: "", endereco: "", st_privado: true, empresa_id: XEmpresaId },
        // Mostra: todos da empresa atual + apenas públicos das irmãs
        XApplyFilter: (q) => {
          if (XSisterIds.length === 0) return q.eq("empresa_id", XEmpresaId);
          const XSisterList = XSisterIds.join(",");
          return q.or(`empresa_id.eq.${XEmpresaId},and(empresa_id.in.(${XSisterList}),st_privado.eq.false)`);
        },
        XOnBeforeSave: (rec) => {
          if (!rec.nome?.toString().trim()) throw new Error("O nome do depósito é obrigatório.");
          return {
            ...rec,
            nome: rec.nome.toString().trim(),
            endereco: (rec.endereco || "").toString().trim(),
            empresa_id: rec.empresa_id || XEmpresaId,
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Depósitos"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const XReadOnlyForeign = !isEditing && !!record.empresa_id && record.empresa_id !== XEmpresaId;
        const XEmpName = XEmpresas.find(e => e.empresa_id === record.empresa_id);
        const depositCompany = XEmpresas.find(e => e.empresa_id === record.empresa_id);
        const targetMatrixId = depositCompany?.empresa_matriz_id || record.empresa_id || XEmpresaMatrizId;

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={mode === "insert" ? "(Novo)" : record.deposito_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                <input type="text" value={XEmpName ? `${XEmpName.empresa_id} - ${XEmpName.identificacao}` : String(record.empresa_id ?? XEmpresaId)} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={record.nome ?? ""}
                  onChange={e => setField("nome", e.target.value)}
                  readOnly={!isEditing || XReadOnlyForeign}
                  autoFocus={isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing && !XReadOnlyForeign ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Endereço</label>
              <input
                type="text"
                value={record.endereco ?? ""}
                onChange={e => setField("endereco", e.target.value)}
                readOnly={!isEditing || XReadOnlyForeign}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing && !XReadOnlyForeign ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={record.st_privado ?? true}
                  onChange={e => setField("st_privado", e.target.checked as any)}
                  disabled={!isEditing || XReadOnlyForeign}
                  className="rounded border-border"
                />
                Depósito privado (visível apenas para esta empresa)
              </label>

              {mode === "view" && record.deposito_id && (
                <button
                  type="button"
                  onClick={() => setIsInitOpen(true)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded shadow transition duration-150 active:scale-95"
                >
                  Inicializar Depósito
                </button>
              )}
            </div>
            {XReadOnlyForeign && (
              <div className="text-xs text-muted-foreground italic">
                Depósito de empresa irmã (somente leitura).
              </div>
            )}

            <InicializarDepositoDialog
              open={isInitOpen}
              onClose={() => setIsInitOpen(false)}
              depositoId={record.deposito_id}
              depositoNome={record.nome}
              empresaId={record.empresa_id}
              empresaMatrizId={targetMatrixId}
            />
          </div>
        );
      }}
    />
  );
};

export default DepositoForm;
