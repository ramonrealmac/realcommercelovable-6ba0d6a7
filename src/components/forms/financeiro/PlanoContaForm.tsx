import React, { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { formatMask } from "@/lib/validators";
import { supabase } from "@/integrations/supabase/client";

interface IPlanoConta {
  plano_conta_id: number;
  conta: string;
  nome: string;
  tp_conta: string;
  tp_natureza: string;
  empresa_id: number;
}

const XGridCols: IGridColumn[] = [
  { key: "plano_conta_id", label: "Cód", width: "60px", align: "right" },
  { key: "conta", label: "Conta", width: "150px" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "tp_conta", label: "Tipo", width: "100px", render: (r) => r.tp_conta === "S" ? "Sintética" : "Analítica" },
  { key: "tp_natureza", label: "Natureza", width: "100px", render: (r) => r.tp_natureza === "D" ? "Devedora" : "Credora" },
];

const PlanoContaForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);
  
  const [XMascara, setXMascara] = useState("9.99.999.999");

  useEffect(() => {
    // Buscar mascara_plano da empresa atual, com fallback para 9.99.999.999
    const fetchMascara = async () => {
      const { data, error } = await supabase
        .from("empresa")
        .select("mascara_plano")
        .eq("empresa_id", XEmpresaMatrizId)
        .single();
      
      if (!error && data && data.mascara_plano) {
        setXMascara(data.mascara_plano);
      }
    };
    fetchMascara();
  }, [XEmpresaMatrizId]);

  return (
    <StandardCrudForm<IPlanoConta>
      config={{
        XTableName: "plano_conta",
        XPrimaryKey: "plano_conta_id",
        XTitle: "Plano de Contas",
        XEmpresaId: XEmpresaMatrizId,
        XDefaultRecord: { conta: "", nome: "", tp_conta: "A", tp_natureza: "D" },
        XOnBeforeSave: (rec) => {
          if (!rec.conta?.trim()) throw new Error("A Conta é obrigatória.");
          if (!rec.nome?.trim()) throw new Error("O Nome é obrigatório.");
          return { ...rec, conta: rec.conta.trim(), nome: rec.nome.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Plano de Contas"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const handleContaChange = (val: string) => {
          const formatted = formatMask(val, XMascara);
          setField("conta", formatted);
        };

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={mode === "insert" ? "(Novo)" : record.plano_conta_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div className="w-full md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input type="text" value={XEmpLabel} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-48">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Conta <span className="text-destructive">*</span>
                  <span className="text-[10px] text-muted-foreground ml-2">(Masc: {XMascara})</span>
                </label>
                <input
                  type="text"
                  value={record.conta ?? ""}
                  onChange={e => handleContaChange(e.target.value)}
                  readOnly={!isEditing}
                  autoFocus={isEditing}
                  placeholder={XMascara.replace(/9/g, "_")}
                  maxLength={XMascara.length}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={record.nome ?? ""}
                  onChange={e => setField("nome", e.target.value.toUpperCase())}
                  readOnly={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Conta</label>
                <select
                  value={record.tp_conta || "A"}
                  onChange={(e) => setField("tp_conta", e.target.value)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                >
                  <option value="A">Analítica</option>
                  <option value="S">Sintética</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Natureza</label>
                <select
                  value={record.tp_natureza || "D"}
                  onChange={(e) => setField("tp_natureza", e.target.value)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                >
                  <option value="D">Devedora</option>
                  <option value="C">Credora</option>
                </select>
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default PlanoContaForm;
