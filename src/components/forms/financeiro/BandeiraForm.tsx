import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { supabase } from "@/integrations/supabase/client";

interface IBandeira {
  bandeira_id: number;
  empresa_id: number;
  descricao: string;
  cd_bandeira: number | null;
  excluido?: boolean | null;
  dt_cadastro?: string | null;
  dt_alteracao?: string | null;
}

const XDefault: Partial<IBandeira> = {
  descricao: "",
  cd_bandeira: null,
  excluido: false,
};

const XGridCols: IGridColumn[] = [
  { key: "cd_bandeira", label: "Código", width: "80px", align: "right" },
  { key: "descricao", label: "Descrição", width: "1fr" },
];

const BandeiraForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const XEmp = XEmpresas.find(e => e.empresa_id === XEmpresaId);
  const XEmpLabel = XEmp ? `${XEmp.empresa_id} - ${XEmp.identificacao}` : String(XEmpresaId);

  return (
    <StandardCrudForm<IBandeira>
      config={{
        XTableName: "bandeira",
        XPrimaryKey: "bandeira_id",
        XTitle: "Cadastro de Bandeiras de Cartões",
        XEmpresaId,
        XSelectCols: "bandeira_id,empresa_id,descricao,cd_bandeira,excluido,dt_cadastro,dt_alteracao",
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.descricao?.trim()) throw new Error("A descrição é obrigatória.");

          let nextCd = rec.cd_bandeira;
          if (mode === "insert") {
            const { data, error } = await supabase
              .from("bandeira")
              .select("cd_bandeira")
              .eq("empresa_id", XEmpresaId)
              .order("cd_bandeira", { ascending: false })
              .limit(1);
            if (error) console.error("Erro ao buscar último cd_bandeira:", error);
            const lastCd = data && data[0] ? data[0].cd_bandeira : 0;
            nextCd = (lastCd || 0) + 1;
          }

          return {
            ...rec,
            descricao: rec.descricao.trim().toUpperCase(),
            cd_bandeira: nextCd,
            empresa_id: XEmpresaId,
            excluido: false,
            dt_cadastro: mode === "insert" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_cadastro,
            dt_alteracao: mode === "edit" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_alteracao,
          } as IBandeira;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Bandeiras de Cartões"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input
                type="text"
                value={mode === "insert" ? "" : record.cd_bandeira ?? ""}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right"
              />
            </div>
            <div className="w-full md:w-64">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
              <input
                type="text"
                value={XEmpLabel}
                readOnly
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Descrição <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.descricao ?? ""}
                onChange={e => setField("descricao", e.target.value.toUpperCase())}
                readOnly={!isEditing}
                autoFocus={isEditing}
                maxLength={50}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
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

export default BandeiraForm;
