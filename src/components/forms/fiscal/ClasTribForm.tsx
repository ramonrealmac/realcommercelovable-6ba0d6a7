import React, { useMemo, useState, useEffect } from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";

interface IIbsCbsRef {
  ibscbs_id: number;
  ibscbs_cst: string;
  ibscbs_descricao: string;
}

interface IClasTrib {
  clas_trib_id: string;
  descricao: string;
  bc_legal?: string;
  grupo_ibscbs_id?: number | null;
  ativo: boolean;
  ibscbs?: IIbsCbsRef;
}

const ClasTribForm: React.FC = () => {
  const [ibsCbsList, setIbsCbsList] = useState<IIbsCbsRef[]>([]);

  useEffect(() => {
    supabase
      .from("ibscbs")
      .select("ibscbs_id, ibscbs_cst, ibscbs_descricao")
      .order("ibscbs_cst")
      .then(({ data }) => {
        if (data) setIbsCbsList(data as IIbsCbsRef[]);
      });
  }, []);

  const XGridCols = useMemo<IGridColumn[]>(() => [
    { 
      key: "clas_trib_id", 
      label: "Código (cClassTrib)", 
      width: "140px", 
      align: "center", 
      render: (r: IClasTrib) => <span className="font-mono font-bold text-primary">{r.clas_trib_id}</span> 
    },
    { 
      key: "grupo_ibscbs_id", 
      label: "CST IBS/CBS", 
      width: "180px", 
      align: "center",
      render: (r: IClasTrib) => {
        const item = r.ibscbs || ibsCbsList.find(i => i.ibscbs_id === r.grupo_ibscbs_id);
        if (!item) return <span className="text-muted-foreground text-xs">-</span>;
        return <span className="font-mono text-xs font-semibold text-foreground">CST {item.ibscbs_cst}</span>;
      }
    },
    { key: "descricao", label: "Descrição", width: "1fr", render: (r: IClasTrib) => (r.descricao || "").toUpperCase() },
    { key: "bc_legal", label: "Base Legal", width: "180px" },
    { 
      key: "ativo", 
      label: "Ativo", 
      width: "90px", 
      align: "center",
      render: (r: IClasTrib) => (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${r.ativo !== false ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
          {r.ativo !== false ? "Sim" : "Não"}
        </span>
      )
    },
  ], [ibsCbsList]);

  const config = useMemo<ICrudConfig<IClasTrib>>(() => ({
    XTableName: "clas_trib",
    XPrimaryKey: "clas_trib_id",
    XTitle: "Classificação Tributária (cClassTrib)",
    XOrderBy: "clas_trib_id",
    XSelectCols: "*, ibscbs:grupo_ibscbs_id(ibscbs_id, ibscbs_cst, ibscbs_descricao)",
    XSoftDelete: false,
    XDefaultRecord: { 
      clas_trib_id: "", 
      grupo_ibscbs_id: null,
      descricao: "",
      bc_legal: "",
      ativo: true
    },
    XOnBeforeSave: (rec) => {
      let clas_trib_id = (rec.clas_trib_id || "").trim().replace(/\D/g, "");
      const descricao = (rec.descricao || "").trim().toUpperCase();
      
      if (!clas_trib_id) throw new Error("O código da Classificação Tributária (6 dígitos) é obrigatório.");
      if (clas_trib_id.length < 6) clas_trib_id = clas_trib_id.padStart(6, "0");
      if (!descricao) throw new Error("A descrição é obrigatória.");
      
      return { 
        ...rec, 
        clas_trib_id, 
        grupo_ibscbs_id: rec.grupo_ibscbs_id ? Number(rec.grupo_ibscbs_id) : null,
        descricao,
        bc_legal: (rec.bc_legal || "").trim(),
        ativo: rec.ativo !== false
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
    <StandardCrudForm<IClasTrib>
      config={config}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, isEditing, mode }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Código (cClassTrib) <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing || mode === "update"}
                required 
                maxLength={6}
                placeholder="Ex: 000001"
                value={record.clas_trib_id ?? ""}
                onChange={e => setField("clas_trib_id", e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono text-center font-bold ${
                  isEditing && mode === "insert" ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                CST IBS / CBS (Grupo)
              </label>
              <select
                disabled={!isEditing}
                value={record.grupo_ibscbs_id ?? ""}
                onChange={e => setField("grupo_ibscbs_id", e.target.value ? Number(e.target.value) : null)}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`}
              >
                <option value="">-- Selecione o CST IBS/CBS --</option>
                {ibsCbsList.map(item => (
                  <option key={item.ibscbs_id} value={item.ibscbs_id}>
                    CST {item.ibscbs_cst} - {item.ibscbs_descricao}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descrição <span className="text-destructive">*</span>
              </label>
              <input 
                type="text" 
                readOnly={!isEditing}
                required
                maxLength={255}
                placeholder="Ex: OPERAÇÃO TRIBUTÁVEL INTEGRAL"
                value={(record.descricao ?? "").toUpperCase()}
                onChange={e => setField("descricao", e.target.value.toUpperCase())}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm uppercase ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                }`} 
              />
            </div>

            <div className="md:col-span-2 flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <Checkbox 
                  checked={record.ativo !== false}
                  onCheckedChange={(checked) => setField("ativo", !!checked)}
                  disabled={!isEditing}
                />
                <span className="text-sm font-medium">Ativo</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Base Legal
            </label>
            <textarea
              readOnly={!isEditing}
              rows={2}
              placeholder="Ex: Lei Complementar nº 204/2024 Art. 5º"
              value={record.bc_legal ?? ""}
              onChange={e => setField("bc_legal", e.target.value)}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
              }`}
            />
          </div>
        </div>
      )}
    />
  );
};

export default ClasTribForm;
