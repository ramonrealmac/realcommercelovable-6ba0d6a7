import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import SubgrupoGrid from "./SubgrupoGrid";

interface IGrupo {
  produto_grupo_id: number;
  nome: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "produto_grupo_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
];

const GrupoProdutosForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<IGrupo>
      config={{
        XTableName: "produto_grupo",
        XPrimaryKey: "produto_grupo_id",
        XTitle: "Grupos de Produtos",
        XEmpresaId: XEmpresaMatrizId,
        XDefaultRecord: { nome: "" },
        XOnBeforeSave: (rec) => {
          if (!rec.nome?.trim()) throw new Error("O nome do grupo é obrigatório.");
          return { ...rec, nome: rec.nome.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Grupos de Produtos"
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" value={mode === "insert" ? "(Novo)" : record.produto_grupo_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
            </div>
            <div className="w-full md:w-[13.5rem]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
              <input type="text" value={XEmpLabel} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
              <input
                type="text"
                value={record.nome ?? ""}
                onChange={e => setField("nome", e.target.value)}
                readOnly={!isEditing}
                autoFocus={isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              />
            </div>
          </div>

          {currentRecord && !isEditing && (
            <SubgrupoGrid XEmpresaId={XEmpresaMatrizId} XGrupoId={currentRecord.produto_grupo_id} />
          )}
        </div>
      )}
    />
  );
};

export default GrupoProdutosForm;
