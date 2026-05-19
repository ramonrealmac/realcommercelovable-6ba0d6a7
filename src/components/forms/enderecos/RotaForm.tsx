import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface IRota {
  rota_id: number;
  nome: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "rota_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
];

const RotaForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  return (
    <StandardCrudForm<IRota>
      config={{
        XTableName: "rota",
        XPrimaryKey: "rota_id",
        XTitle: "Rotas",
        XEmpresaId,
        XDefaultRecord: { nome: "" },
        XOnBeforeSave: (rec) => {
          if (!rec.nome?.trim()) throw new Error("O nome é obrigatório.");
          return { ...rec, nome: rec.nome.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Rotas"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" value={mode === "insert" ? "(Novo)" : record.rota_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={record.nome ?? ""}
                onChange={e => setField("nome", e.target.value.toUpperCase())}
                readOnly={!isEditing}
                autoFocus={isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default RotaForm;
