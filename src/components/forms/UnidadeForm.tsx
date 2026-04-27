import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface IUnidade {
  unidade_id: string;
  descricao: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "unidade_id", label: "Sigla", width: "100px" },
  { key: "descricao", label: "Descrição", width: "1fr" },
];

const UnidadeForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<IUnidade>
      config={{
        XTableName: "unidade",
        XPrimaryKey: "unidade_id",
        XTitle: "Unidades",
        XEmpresaId: XEmpresaMatrizId,
        XDefaultRecord: { unidade_id: "", descricao: "" },
        XOnBeforeSave: (rec) => {
          if (!rec.unidade_id?.toString().trim()) throw new Error("A sigla da unidade é obrigatória.");
          if (!rec.descricao?.trim()) throw new Error("A descrição é obrigatória.");
          return { ...rec, unidade_id: rec.unidade_id.toString().trim().toUpperCase(), descricao: rec.descricao.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Unidades"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-[13.5rem]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
              <input type="text" value={XEmpLabel} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Sigla <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={record.unidade_id ?? ""}
                onChange={e => setField("unidade_id", e.target.value.toUpperCase() as any)}
                maxLength={10}
                readOnly={!isEditing || mode === "edit"}
                autoFocus={mode === "insert"}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing && mode === "insert" ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={record.descricao ?? ""}
                onChange={e => setField("descricao", e.target.value)}
                readOnly={!isEditing}
                autoFocus={mode === "edit"}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default UnidadeForm;
