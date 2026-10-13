import React, { useMemo } from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

interface IPisCofins {
  piscofins_id: number;
  piscofins_cst: string;
  piscofins_descricao: string;
}

const XGridCols: IGridColumn[] = [
  { key: "piscofins_id", label: "ID", width: "80px", align: "right" },
  { key: "piscofins_cst", label: "CST", width: "100px", align: "center", render: (r) => <span className="font-mono font-bold text-primary">{r.piscofins_cst}</span> },
  { key: "piscofins_descricao", label: "Descrição", width: "1fr", render: (r) => (r.piscofins_descricao || "").toUpperCase() },
];

const PisCofinsForm: React.FC = () => {
  const config = useMemo<ICrudConfig<IPisCofins>>(() => ({
    XTableName: "piscofins",
    XPrimaryKey: "piscofins_id",
    XTitle: "CST PIS / COFINS",
    XOrderBy: "piscofins_cst",
    XSoftDelete: false,
    XDefaultRecord: { 
      piscofins_cst: "", 
      piscofins_descricao: "" 
    },
    XOnBeforeSave: (rec) => {
      let piscofins_cst = (rec.piscofins_cst || "").trim().replace(/\D/g, "");
      const piscofins_descricao = (rec.piscofins_descricao || "").trim().toUpperCase();
      
      if (!piscofins_cst) throw new Error("O código CST de PIS/COFINS é obrigatório.");
      if (piscofins_cst.length === 1) piscofins_cst = piscofins_cst.padStart(2, "0");
      if (!piscofins_descricao) throw new Error("A descrição do CST é obrigatória.");
      
      return { 
        ...rec, 
        piscofins_cst, 
        piscofins_descricao 
      };
    },
  }), []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "SELECT" && target.tagName !== "TEXTAREA") return;

      e.preventDefault();

      const container = target.closest("[data-form-container]") || target.closest(".space-y-4");
      if (!container) return;

      const selector = 'input:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])';
      const focusable = Array.from(container.querySelectorAll(selector)) as HTMLElement[];

      const index = focusable.indexOf(target);
      if (index > -1) {
        if (index < focusable.length - 1) {
          focusable[index + 1].focus();
        } else {
          const saveBtn = document.querySelector('button[title*="Salvar"], button.text-emerald-600, button.text-emerald-500') as HTMLElement;
          if (saveBtn) {
            saveBtn.focus();
          }
        }
      }
    }
  };

  return (
    <StandardCrudForm<IPisCofins>
      config={config}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, isEditing, mode, currentRecord }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ID</label>
              <input 
                type="text" 
                readOnly
                value={mode === "insert" ? "(Novo)" : currentRecord?.piscofins_id ?? ""}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" 
              />
            </div>
            <div className="w-full md:w-36">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                CST <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing}
                required 
                maxLength={2}
                placeholder="Ex: 01"
                value={record.piscofins_cst ?? ""}
                onChange={e => setField("piscofins_cst", e.target.value.replace(/\D/g, "").slice(0, 2))}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono text-center font-bold ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`} 
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descrição do CST <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing}
                required
                placeholder="Ex: OPERAÇÃO TRIBUTÁVEL COM ALÍQUOTA BÁSICA"
                value={(record.piscofins_descricao ?? "").toUpperCase()}
                onChange={e => setField("piscofins_descricao", e.target.value.toUpperCase())}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm uppercase ${
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

export default PisCofinsForm;
