import React from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

interface IEstado {
  estado_id: string;
  nm_estado: string | null;
  icms_interno: number | null;
  icms_externo: number | null;
  pc_fcp: number | null;
}

const XGridCols: IGridColumn[] = [
  { key: "estado_id", label: "UF", width: "80px" },
  { key: "nm_estado", label: "Nome", width: "1fr" },
  { key: "icms_interno", label: "ICMS Int.", width: "110px", align: "right" },
  { key: "icms_externo", label: "ICMS Ext.", width: "110px", align: "right" },
  { key: "pc_fcp", label: "FCP %", width: "100px", align: "right" },
];

const XConfig: ICrudConfig<IEstado> = {
  XTableName: "estado",
  XPrimaryKey: "estado_id",
  XTitle: "Estados",
  XOrderBy: "estado_id",
  XDefaultRecord: { estado_id: "", nm_estado: "", icms_interno: 0, icms_externo: 0, pc_fcp: 0 },
  XOnBeforeSave: (rec) => ({
    ...rec,
    estado_id: (rec.estado_id || "").trim().toUpperCase().slice(0, 2),
    nm_estado: (rec.nm_estado || "").trim().toUpperCase(),
    icms_interno: Number(rec.icms_interno) || 0,
    icms_externo: Number(rec.icms_externo) || 0,
    pc_fcp: Number(rec.pc_fcp) || 0,
  }),
};

const EstadoForm: React.FC = () => (
  <StandardCrudForm<IEstado>
    config={XConfig}
    XGridCols={XGridCols}
    renderCadastro={({ record, setField, mode, isEditing }) => (
      <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
        <div className="w-full md:w-24">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            UF <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            maxLength={2}
            readOnly={!isEditing || mode === "update"}
            autoFocus={isEditing && mode === "insert"}
            value={record.estado_id ?? ""}
            onChange={(e) => setField("estado_id", e.target.value.toUpperCase())}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm uppercase ${
              isEditing && mode === "insert" ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
            }`}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Nome <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            readOnly={!isEditing}
            value={record.nm_estado ?? ""}
            onChange={(e) => setField("nm_estado", e.target.value.toUpperCase())}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
              isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
            }`}
          />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-xs font-medium text-muted-foreground mb-1">ICMS Interno %</label>
          <input
            type="number"
            step="0.01"
            readOnly={!isEditing}
            value={record.icms_interno ?? 0}
            onChange={(e) => setField("icms_interno", parseFloat(e.target.value) || 0)}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
              isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
            }`}
          />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-xs font-medium text-muted-foreground mb-1">ICMS Externo %</label>
          <input
            type="number"
            step="0.01"
            readOnly={!isEditing}
            value={record.icms_externo ?? 0}
            onChange={(e) => setField("icms_externo", parseFloat(e.target.value) || 0)}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
              isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
            }`}
          />
        </div>
        <div className="w-full md:w-28">
          <label className="block text-xs font-medium text-muted-foreground mb-1">FCP %</label>
          <input
            type="number"
            step="0.01"
            readOnly={!isEditing}
            value={record.pc_fcp ?? 0}
            onChange={(e) => setField("pc_fcp", parseFloat(e.target.value) || 0)}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
              isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
            }`}
          />
        </div>
      </div>
    )}
  />
);

export default EstadoForm;
