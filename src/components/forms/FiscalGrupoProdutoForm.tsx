import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface IFiscalGrupoProduto {
  fiscal_grupo_produto_id: number;
  nome: string;
  tp_imposto: string;
  empresa_id: number;
}

const XTpImpostoOpcoes = ["ICMS", "PIS/COFINS", "IPI", "IBS/CBS"];

const XGridCols: IGridColumn[] = [
  { key: "fiscal_grupo_produto_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "tp_imposto", label: "Tipo de Imposto", width: "180px" },
];

const FiscalGrupoProdutoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<IFiscalGrupoProduto>
      config={{
        XTableName: "fiscal_grupo_produto",
        XPrimaryKey: "fiscal_grupo_produto_id",
        XTitle: "Grupos Tributários de Produtos",
        XEmpresaId: XEmpresaMatrizId,
        XDefaultRecord: { nome: "", tp_imposto: "ICMS" },
        XOnBeforeSave: (rec) => {
          if (!rec.nome?.trim()) throw new Error("O nome do grupo é obrigatório.");
          if (!rec.tp_imposto?.trim()) throw new Error("O tipo de imposto é obrigatório.");
          return { ...rec, nome: rec.nome.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Grupos Tributários de Produtos"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" value={mode === "insert" ? "(Novo)" : record.fiscal_grupo_produto_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
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
            <div className="w-full md:w-56">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Imposto <span className="text-destructive">*</span></label>
              <select
                value={record.tp_imposto ?? "ICMS"}
                onChange={e => setField("tp_imposto", e.target.value)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
              >
                {XTpImpostoOpcoes.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default FiscalGrupoProdutoForm;
