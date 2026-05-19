import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface IBanco {
  banco_id: number;
  empresa_id: number;
  cd_banco: string;
  nome: string;
  excluido?: boolean;
  dt_cadastro?: string;
  dt_alteracao?: string;
}

const XGridCols: IGridColumn[] = [
  { key: "banco_id", label: "Id", width: "80px", align: "right" },
  { key: "cd_banco", label: "Cód. Bacen", width: "100px" },
  { key: "nome", label: "Nome do Banco", width: "1fr" },
];

const BancoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<IBanco>
      config={{
        XTableName: "banco",
        XPrimaryKey: "banco_id",
        XTitle: "Cadastro de Bancos",
        XEmpresaId: XEmpresaMatrizId,
        XDefaultRecord: { cd_banco: "", nome: "" },
        XOnBeforeSave: (rec) => {
          if (!rec.cd_banco?.trim()) throw new Error("O Código do Banco (Bacen) é obrigatório.");
          if (!rec.nome?.trim()) throw new Error("O Nome do Banco é obrigatório.");
          return { 
            ...rec, 
            cd_banco: rec.cd_banco.trim(),
            nome: rec.nome.trim().toUpperCase()
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Bancos"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="w-full">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ID Banco</label>
              <input 
                type="text" 
                value={mode === "insert" ? "(Novo)" : record.banco_id ?? ""} 
                readOnly 
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" 
              />
            </div>
            <div className="w-full md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
              <input 
                type="text" 
                value={XEmpLabel} 
                readOnly 
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="w-full">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Cód. Bacen <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.cd_banco ?? ""}
                onChange={(e) => setField("cd_banco", e.target.value)}
                readOnly={!isEditing}
                autoFocus={isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              />
            </div>
            <div className="w-full md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nome do Banco <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.nome ?? ""}
                onChange={(e) => setField("nome", e.target.value.toUpperCase())}
                readOnly={!isEditing}
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

export default BancoForm;
