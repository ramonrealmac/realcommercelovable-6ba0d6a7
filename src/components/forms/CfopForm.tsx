import React from "react";
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

const XConfig: ICrudConfig<ICfop> = {
  XTableName: "cfop",
  XPrimaryKey: "cfop_id",
  XTitle: "CFOP",
  XOrderBy: "cd_cfop",
  XDefaultRecord: { cd_cfop: "", descricao: "", aplicacao: "", empresa_id: 1 },
};

const CfopForm: React.FC = () => (
  <StandardCrudForm<ICfop>
    config={XConfig}
    XGridCols={XGridCols}
    renderCadastro={({ record, setField, isEditing, mode, currentRecord }) => (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
            <input type="text" readOnly
              value={mode === "insert" ? "(Novo)" : currentRecord?.cfop_id ?? ""}
              className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
          </div>
          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cód. CFOP *</label>
            <input type="text" readOnly={!isEditing}
              required maxLength={10}
              placeholder="Ex: 5102"
              value={record.cd_cfop ?? ""}
              onChange={e => setField("cd_cfop", e.target.value.replace(/\D/g, ""))}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm font-mono ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição *</label>
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

export default CfopForm;
