import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

interface ILinhaProduto {
  linha_id: number;
  cd_linha?: number | null;
  nome: string;
  empresa_id: number;
  pc_desc_maximo_av?: number | null;
  pc_desc_maximo_prz?: number | null;
}

const fmt2 = (v: number | null | undefined) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const XGridCols: IGridColumn[] = [
  { key: "cd_linha", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "pc_desc_maximo_av", label: "Desc. Máx. À Vista (%)", width: "160px", align: "right", render: (r: ILinhaProduto) => fmt2(r.pc_desc_maximo_av) },
  { key: "pc_desc_maximo_prz", label: "Desc. Máx. À Prazo (%)", width: "160px", align: "right", render: (r: ILinhaProduto) => fmt2(r.pc_desc_maximo_prz) },
];

const LinhaProdutoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpMatrizLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  const XConfig: ICrudConfig<ILinhaProduto> = {
    XTableName: "linha_produto",
    XPrimaryKey: "linha_id",
    XTitle: "Linhas de Produtos",
    XOrderBy: "cd_linha",
    XSelectCols: "linha_id,cd_linha,nome,empresa_id,pc_desc_maximo_av,pc_desc_maximo_prz",
    XEmpresaId: XEmpresaMatrizId,
    XDefaultRecord: { nome: "", empresa_id: XEmpresaMatrizId, pc_desc_maximo_av: 0, pc_desc_maximo_prz: 0 },
    XOnBeforeSave: (rec) => {
      const nome = (rec.nome || "").trim();
      if (!nome) throw new Error("O nome da linha é obrigatório.");
      const pc_desc_maximo_av = typeof rec.pc_desc_maximo_av === "number" ? rec.pc_desc_maximo_av : parseFloat(String(rec.pc_desc_maximo_av || 0).replace(",", ".")) || 0;
      const pc_desc_maximo_prz = typeof rec.pc_desc_maximo_prz === "number" ? rec.pc_desc_maximo_prz : parseFloat(String(rec.pc_desc_maximo_prz || 0).replace(",", ".")) || 0;
      return { ...rec, nome, empresa_id: XEmpresaMatrizId, pc_desc_maximo_av, pc_desc_maximo_prz };
    },
  };

  return (
    <StandardCrudForm<ILinhaProduto>
      config={XConfig}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-[13.5rem]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
              <input type="text" readOnly value={XEmpMatrizLabel}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" readOnly
                value={mode === "insert" ? "(Novo)" : record.cd_linha ?? ""}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desc. Máximo À Vista (%)</label>
              <CurrencyInput
                value={record.pc_desc_maximo_av ?? 0}
                onChange={v => setField("pc_desc_maximo_av", v)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desc. Máximo À Prazo (%)</label>
              <CurrencyInput
                value={record.pc_desc_maximo_prz ?? 0}
                onChange={v => setField("pc_desc_maximo_prz", v)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default LinhaProdutoForm;
