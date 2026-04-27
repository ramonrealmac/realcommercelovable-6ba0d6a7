import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

interface ILinhaProduto {
  linha_id: number;
  nome: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "linha_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
];

const LinhaProdutoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpMatrizLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  const XConfig: ICrudConfig<ILinhaProduto> = {
    XTableName: "linha_produto",
    XPrimaryKey: "linha_id",
    XTitle: "Linhas de Produtos",
    XOrderBy: "linha_id",
    XEmpresaId: XEmpresaMatrizId,
    XDefaultRecord: { nome: "", empresa_id: XEmpresaMatrizId },
    XOnBeforeSave: (rec) => {
      const nome = (rec.nome || "").trim();
      if (!nome) throw new Error("O nome da linha é obrigatório.");
      return { ...rec, nome, empresa_id: XEmpresaMatrizId };
    },
  };

  return (
    <StandardCrudForm<ILinhaProduto>
      config={XConfig}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
          <div className="w-full md:w-[13.5rem]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
            <input type="text" readOnly value={XEmpMatrizLabel}
              className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
            <input type="text" readOnly
              value={mode === "insert" ? "(Novo)" : currentRecord?.linha_id ?? ""}
              className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Nome <span className="text-destructive">*</span>
            </label>
            <input type="text" readOnly={!isEditing} autoFocus={isEditing}
              value={record.nome ?? ""}
              onChange={e => setField("nome", e.target.value)}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
          </div>
        </div>
      )}
    />
  );
};

export default LinhaProdutoForm;
