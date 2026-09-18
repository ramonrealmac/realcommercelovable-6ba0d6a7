import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";

interface ICargo {
  cargo_id: number;
  cargo_empresa_id: number;
  cargo_descricao: string;
  pc_desc_maximo_av: number;
  pc_desc_maximo_prz: number;
}

const parseNum = (v: any) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmt2 = (v: number | null | undefined) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatNumericInput = (rawString: string, decimals = 2): string => {
  const clean = String(rawString || "").replace(/\D/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  const floatVal = num / Math.pow(10, decimals);
  return floatVal.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const XGridCols: IGridColumn[] = [
  { key: "cargo_id", label: "Código", width: "80px", align: "right" },
  { key: "cargo_descricao", label: "Descrição do Cargo", width: "1fr" },
  { key: "pc_desc_maximo_av", label: "Desc. Máx. À Vista (%)", width: "160px", align: "right", render: (r: any) => fmt2(r.pc_desc_maximo_av) },
  { key: "pc_desc_maximo_prz", label: "Desc. Máx. À Prazo (%)", width: "160px", align: "right", render: (r: any) => fmt2(r.pc_desc_maximo_prz) },
];

const CargoForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<ICargo>
      config={{
        XTableName: "cargo",
        XPrimaryKey: "cargo_id",
        XTitle: "Cargos",
        XDefaultRecord: { cargo_descricao: "", pc_desc_maximo_av: 0, pc_desc_maximo_prz: 0 },
        XApplyFilter: (q) => q.eq("cargo_empresa_id", XEmpresaMatrizId),
        XOnBeforeSave: (rec) => {
          if (!rec.cargo_descricao?.trim()) throw new Error("A descrição do cargo é obrigatória.");
          return {
            ...rec,
            cargo_descricao: rec.cargo_descricao.trim().toUpperCase(),
            cargo_empresa_id: XEmpresaMatrizId,
            pc_desc_maximo_av: parseNum(rec.pc_desc_maximo_av),
            pc_desc_maximo_prz: parseNum(rec.pc_desc_maximo_prz),
          };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Cargos"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const valAvStr = record.pc_desc_maximo_av != null 
          ? (typeof record.pc_desc_maximo_av === "number" ? fmt2(record.pc_desc_maximo_av) : record.pc_desc_maximo_av)
          : "0,00";
        const valPrzStr = record.pc_desc_maximo_prz != null 
          ? (typeof record.pc_desc_maximo_prz === "number" ? fmt2(record.pc_desc_maximo_prz) : record.pc_desc_maximo_prz)
          : "0,00";

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input
                  type="text"
                  value={mode === "insert" ? "(Novo)" : record.cargo_id ?? ""}
                  readOnly
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right"
                />
              </div>
              <div className="w-full md:w-[13.5rem]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input
                  type="text"
                  value={XEmpLabel}
                  readOnly
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Descrição do Cargo <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={record.cargo_descricao ?? ""}
                  onChange={(e) => setField("cargo_descricao", e.target.value.toUpperCase())}
                  readOnly={!isEditing}
                  autoFocus={isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Desc. Máximo À Vista (%)
                </label>
                <input
                  type="text"
                  value={valAvStr}
                  onChange={(e) => setField("pc_desc_maximo_av", formatNumericInput(e.target.value, 2))}
                  onBlur={() => setField("pc_desc_maximo_av", fmt2(parseNum(record.pc_desc_maximo_av)))}
                  onFocus={(e) => e.target.select()}
                  readOnly={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Desc. Máximo À Prazo (%)
                </label>
                <input
                  type="text"
                  value={valPrzStr}
                  onChange={(e) => setField("pc_desc_maximo_prz", formatNumericInput(e.target.value, 2))}
                  onBlur={() => setField("pc_desc_maximo_prz", fmt2(parseNum(record.pc_desc_maximo_prz)))}
                  onFocus={(e) => e.target.select()}
                  readOnly={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default CargoForm;
