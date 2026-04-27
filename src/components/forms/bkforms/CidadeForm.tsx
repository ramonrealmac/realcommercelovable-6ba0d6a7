import React from "react";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ICidade {
  cidade_id: number;
  descricao: string;
  uf: string | null;
  cd_ibge: string | null;
}

const XGridCols: IGridColumn[] = [
  { key: "cidade_id", label: "Código", width: "80px", align: "right" },
  { key: "descricao", label: "Descrição", width: "1fr" },
  { key: "uf", label: "UF", width: "80px" },
  { key: "cd_ibge", label: "Cód. IBGE", width: "120px" },
];

const UF_OPTIONS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const XConfig: ICrudConfig<ICidade> = {
  XTableName: "cidade",
  XPrimaryKey: "cidade_id",
  XTitle: "Cidades",
  XOrderBy: "cidade_id",
  XDefaultRecord: { descricao: "", uf: "PR", cd_ibge: "" },
  XOnBeforeSave: (rec) => ({
    ...rec,
    descricao: (rec.descricao || "").trim().toUpperCase(),
    uf: rec.uf || "PR",
    cd_ibge: (rec.cd_ibge || "").trim() || null,
  }),
};

const CidadeForm: React.FC = () => (
  <StandardCrudForm<ICidade>
    config={XConfig}
    XGridCols={XGridCols}
    renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
      <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
        <div className="w-full md:w-32">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
          <input type="text" readOnly
            value={mode === "insert" ? "(Novo)" : currentRecord?.cidade_id ?? ""}
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Descrição <span className="text-destructive">*</span>
          </label>
          <input type="text" readOnly={!isEditing} autoFocus={isEditing}
            value={record.descricao ?? ""}
            onChange={e => setField("descricao", e.target.value.toUpperCase())}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
        </div>
        <div className="w-full md:w-32">
          <label className="block text-xs font-medium text-muted-foreground mb-1">UF</label>
          {isEditing ? (
            <Select value={record.uf || "PR"} onValueChange={v => setField("uf", v)}>
              <SelectTrigger className="h-[34px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <input type="text" readOnly value={record.uf ?? ""}
              className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
          )}
        </div>
        <div className="w-full md:w-40">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Cód. IBGE</label>
          <input type="text" readOnly={!isEditing} value={record.cd_ibge ?? ""}
            onChange={e => setField("cd_ibge", e.target.value)}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`} />
        </div>
      </div>
    )}
  />
);

export default CidadeForm;
