import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface IOperadora {
  operadora_id: number;
  empresa_id: number;
  razao: string;
  cnpj: string | null;
}

const XDefault: Partial<IOperadora> = {
  razao: "",
  cnpj: "",
};

const XGridCols: IGridColumn[] = [
  { key: "operadora_id", label: "ID", width: "80px", align: "right" },
  { key: "razao", label: "Razão Social", width: "1fr" },
  { key: "cnpj", label: "CNPJ", width: "180px" },
];

const OperadoraForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const XEmp = XEmpresas.find(e => e.empresa_id === XEmpresaId);
  const XEmpLabel = XEmp ? `${XEmp.empresa_id} - ${XEmp.identificacao}` : String(XEmpresaId);

  return (
    <StandardCrudForm<IOperadora>
      config={{
        XTableName: "operadora",
        XPrimaryKey: "operadora_id",
        XTitle: "Cadastro de Operadoras de Cartões",
        XEmpresaId,
        XSelectCols: "operadora_id,empresa_id,razao,cnpj",
        XSoftDelete: false,
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.razao?.trim()) throw new Error("A Razão Social é obrigatória.");

          return {
            ...rec,
            razao: rec.razao.trim().toUpperCase(),
            cnpj: rec.cnpj?.trim() || null,
            empresa_id: XEmpresaId,
          } as IOperadora;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Operadoras de Cartões"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ID</label>
              <input
                type="text"
                value={mode === "insert" ? "(Novo)" : record.operadora_id ?? ""}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right"
              />
            </div>
            <div className="w-full md:w-64">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
              <input
                type="text"
                value={XEmpLabel}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Razão Social <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.razao ?? ""}
                onChange={e => setField("razao", e.target.value.toUpperCase())}
                readOnly={!isEditing}
                autoFocus={isEditing}
                maxLength={100}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              />
            </div>
            <div className="w-full md:w-56">
              <label className="block text-xs font-medium text-muted-foreground mb-1">CNPJ</label>
              <input
                type="text"
                value={record.cnpj ?? ""}
                onChange={e => setField("cnpj", e.target.value)}
                readOnly={!isEditing}
                maxLength={20}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default OperadoraForm;
