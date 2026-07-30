import React, { useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

interface ICfop {
  cfop_id: number;
  cd_cfop: string;
  descricao: string;
  aplicacao: string | null;
  empresa_id: number;
  cfop_correspondente: string | null;
  descricao_correspondente: string | null;
}

const XGridCols: IGridColumn[] = [
  { key: "cfop_id", label: "ID", width: "80px", align: "right" },
  { key: "cd_cfop", label: "Código", width: "100px" },
  { key: "descricao", label: "Descrição", width: "1fr" },
  { key: "aplicacao", label: "Aplicação", width: "2fr" },
];

const CfopForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  const XGroupEmpresaIds = useMemo(() => {
    return (XEmpresas || [])
      .filter(e => e && (e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId))
      .map(e => e.empresa_id);
  }, [XEmpresaMatrizId, XEmpresas]);

  const config = useMemo<ICrudConfig<ICfop>>(() => ({
    XTableName: "cfop",
    XPrimaryKey: "cfop_id",
    XTitle: "CFOP",
    XOrderBy: "cd_cfop",
    XDefaultRecord: { 
      cd_cfop: "", 
      descricao: "", 
      aplicacao: "", 
      empresa_id: XEmpresaMatrizId || 1,
      cfop_correspondente: "",
      descricao_correspondente: ""
    },
    XOnBeforeSave: (rec) => {
      const cd_cfop = (rec.cd_cfop || "").trim();
      const descricao = (rec.descricao || "").trim();
      const cfop_correspondente = (rec.cfop_correspondente || "").trim();
      const descricao_correspondente = (rec.descricao_correspondente || "").trim();
      
      if (!cd_cfop) throw new Error("O código CFOP é obrigatório.");
      if (!descricao) throw new Error("A descrição é obrigatória.");
      
      if (cfop_correspondente && cfop_correspondente === cd_cfop) {
        throw new Error("O CFOP correspondente não pode ser igual ao CFOP principal.");
      }
      
      return { 
        ...rec, 
        cd_cfop, 
        descricao, 
        cfop_correspondente: cfop_correspondente || null,
        descricao_correspondente: descricao_correspondente || null,
        empresa_id: XEmpresaMatrizId || 1 
      };
    },
    XApplyFilter: (q) => {
      if (XGroupEmpresaIds.length > 0) {
        return q.in("empresa_id", XGroupEmpresaIds);
      }
      return q.eq("empresa_id", XEmpresaMatrizId || 1);
    }
  }), [XEmpresaMatrizId, XGroupEmpresaIds]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;

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
    <StandardCrudForm<ICfop>
      config={config}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, isEditing, mode, currentRecord }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input type="text" readOnly
                value={mode === "insert" ? "(Novo)" : currentRecord?.cfop_id ?? ""}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
            </div>
            <div className="w-full md:w-[13.5rem]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
              <input type="text" readOnly value={XEmpLabel}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
            </div>
            <div className="w-full md:w-44">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cód. CFOP <span className="text-destructive">*</span></label>
              <input type="text" readOnly={!isEditing}
                required maxLength={10}
                placeholder="Ex: 5102"
                value={record.cd_cfop ?? ""}
                onChange={e => setField("cd_cfop", e.target.value.replace(/\D/g, ""))}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="text-destructive">*</span></label>
              <input type="text" readOnly={!isEditing}
                required
                placeholder="Descrição da operação..."
                value={record.descricao ?? ""}
                onChange={e => setField("descricao", e.target.value.toUpperCase())}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="hidden md:block md:w-32" />
            <div className="hidden md:block md:w-[13.5rem]" />
            <div className="w-full md:w-44">
              <label className="block text-xs font-medium text-muted-foreground mb-1">CFOP Correspondente</label>
              <input type="text" readOnly={!isEditing}
                maxLength={10}
                placeholder="Ex: 1102"
                value={record.cfop_correspondente ?? ""}
                onChange={e => setField("cfop_correspondente", e.target.value.replace(/\D/g, ""))}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição Correspondente</label>
              <input type="text" readOnly={!isEditing}
                placeholder="Descrição do correspondente..."
                value={record.descricao_correspondente ?? ""}
                onChange={e => setField("descricao_correspondente", e.target.value.toUpperCase())}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Aplicação / Detalhes</label>
            <textarea readOnly={!isEditing}
              value={record.aplicacao ?? ""}
              onChange={e => setField("aplicacao", e.target.value)}
              rows={3}
              placeholder="Informações complementares sobre o uso deste CFOP..."
              className={`w-full border border-border rounded px-3 py-1.5 text-sm resize-none ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
          </div>
        </div>
      )}
    />
  );
};

export default CfopForm;
