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
    XDefaultRecord: { cd_cfop: "", descricao: "", aplicacao: "", empresa_id: XEmpresaMatrizId || 1 },
    XOnBeforeSave: (rec) => {
      const cd_cfop = (rec.cd_cfop || "").trim();
      const descricao = (rec.descricao || "").trim();
      if (!cd_cfop) throw new Error("O código CFOP é obrigatório.");
      if (!descricao) throw new Error("A descrição é obrigatória.");
      return { 
        ...rec, 
        cd_cfop, 
        descricao, 
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

  return (
    <StandardCrudForm<ICfop>
      config={config}
      XGridCols={XGridCols}
      renderCadastro={({ record, setField, isEditing, mode, currentRecord }) => (
        <div className="space-y-4">
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
