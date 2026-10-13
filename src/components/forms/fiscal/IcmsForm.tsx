import React, { useMemo } from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

interface IIcms {
  icms_id: number;
  icms_cst_csosn: string;
  icms_descricao: string;
  icms_tipo?: string | null;
}

const XGridCols: IGridColumn[] = [
  { key: "icms_id", label: "ID", width: "80px", align: "right" },
  { 
    key: "icms_cst_csosn", 
    label: "CST / CSOSN", 
    width: "120px", 
    align: "center", 
    render: (r: IIcms) => <span className="font-mono font-bold text-primary">{r.icms_cst_csosn}</span> 
  },
  { 
    key: "icms_tipo", 
    label: "Tipo", 
    width: "100px", 
    align: "center",
    render: (r: IIcms) => (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
        (r.icms_tipo || "").toUpperCase() === "CSOSN" 
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" 
          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      }`}>
        {r.icms_tipo || "CST"}
      </span>
    )
  },
  { key: "icms_descricao", label: "Descrição", width: "1fr", render: (r: IIcms) => (r.icms_descricao || "").toUpperCase() },
];

const IcmsForm: React.FC = () => {
  const config = useMemo<ICrudConfig<IIcms>>(() => ({
    XTableName: "icms",
    XPrimaryKey: "icms_id",
    XTitle: "Tabela ICMS (CST / CSOSN)",
    XOrderBy: "icms_cst_csosn",
    XSoftDelete: false,
    XDefaultRecord: { 
      icms_cst_csosn: "", 
      icms_descricao: "",
      icms_tipo: "CST"
    },
    XOnBeforeSave: (rec) => {
      const icms_cst_csosn = (rec.icms_cst_csosn || "").trim().toUpperCase();
      const icms_descricao = (rec.icms_descricao || "").trim().toUpperCase();
      const icms_tipo = (rec.icms_tipo || "CST").trim().toUpperCase();
      
      if (!icms_cst_csosn) throw new Error("O código CST/CSOSN de ICMS é obrigatório.");
      if (!icms_descricao) throw new Error("A descrição do ICMS é obrigatória.");
      
      return { 
        ...rec, 
        icms_cst_csosn, 
        icms_descricao,
        icms_tipo
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
    <StandardCrudForm<IIcms>
      config={config}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, isEditing, mode, currentRecord }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-28">
              <label className="block text-xs font-medium text-muted-foreground mb-1">ID</label>
              <input 
                type="text" 
                readOnly
                value={mode === "insert" ? "(Novo)" : currentRecord?.icms_id ?? ""}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" 
              />
            </div>
            <div className="w-full md:w-36">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                CST / CSOSN <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing}
                required 
                maxLength={4}
                placeholder="Ex: 00"
                value={record.icms_cst_csosn ?? ""}
                onChange={e => setField("icms_cst_csosn", e.target.value.trim().toUpperCase().slice(0, 4))}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono text-center font-bold uppercase ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`} 
              />
            </div>
            <div className="w-full md:w-36">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select
                disabled={!isEditing}
                value={record.icms_tipo ?? "CST"}
                onChange={e => setField("icms_tipo", e.target.value)}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              >
                <option value="CST">CST</option>
                <option value="CSOSN">CSOSN</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descrição do ICMS <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing}
                required
                maxLength={255}
                placeholder="Ex: TRIBUTADA INTEGRALMENTE"
                value={(record.icms_descricao ?? "").toUpperCase()}
                onChange={e => setField("icms_descricao", e.target.value.toUpperCase())}
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

export default IcmsForm;
