import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface IPortador {
  portador_id: number;
  empresa_id: number;
  nome: string;
  banco_id: number | null;
  conta_id: string | null;
  ativo?: string | null;
  excluido?: boolean | null;
  dt_cadastro?: string | null;
  dt_alteracao?: string | null;
  cd_portador: number | null;
}

const XDefault: Partial<IPortador> = {
  nome: "",
  banco_id: null,
  conta_id: "",
  ativo: "S",
  excluido: false,
  dt_cadastro: null,
  dt_alteracao: null,
  cd_portador: null
};

const XTabLabels: Record<string, string> = {
  dados_principais: "Dados Principais"
};

const PortadorForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const [XBancos, setXBancos] = React.useState<{ banco_id: number; cd_banco: string; nome: string }[]>([]);
  const [XContas, setXContas] = React.useState<{ conta_id: string; cd_conta: number; nome_conta: string }[]>([]);
  const [activeTab, setActiveTab] = React.useState<string>("dados_principais");

  React.useEffect(() => {
    async function loadData() {
      const { data: dbBancos } = await supabase
        .from("banco")
        .select("banco_id, cd_banco, nome")
        .eq("excluido", false)
        .order("nome");
      if (dbBancos) setXBancos(dbBancos);

      const { data: dbContas } = await supabase
        .from("conta")
        .select("conta_id, cd_conta, nome_conta")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .order("nome_conta");
      if (dbContas) setXContas(dbContas);
    }
    loadData();
  }, [XEmpresaId]);

  const XGridCols = React.useMemo<IGridColumn[]>(() => [
    { key: "cd_portador", label: "Código", width: "80px", align: "right" },
    { key: "nome", label: "Nome do Portador", width: "250px" },
    { 
      key: "banco_id", 
      label: "Banco", 
      width: "200px",
      render: (row: IPortador) => {
        const b = XBancos.find(x => x.banco_id === row.banco_id);
        return b ? `${b.cd_banco} - ${b.nome}` : "";
      }
    },
    { 
      key: "conta_id", 
      label: "Conta Corrente", 
      width: "200px",
      render: (row: IPortador) => {
        const c = XContas.find(x => x.conta_id === row.conta_id);
        return c ? `${c.cd_conta} - ${c.nome_conta}` : "";
      }
    },
    { 
      key: "ativo", 
      label: "Ativo", 
      width: "80px", 
      align: "center",
      render: (row: IPortador) => row.ativo === "S" ? "Sim" : "Não"
    }
  ], [XBancos, XContas]);

  return (
    <StandardCrudForm<IPortador>
      config={{
        XTableName: "portador",
        XPrimaryKey: "portador_id",
        XTitle: "Cadastro de Portadores",
        XEmpresaId,
        XSelectCols: "portador_id,empresa_id,nome,banco_id,conta_id,ativo,excluido,dt_cadastro,dt_alteracao,cd_portador",
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.nome?.trim()) throw new Error("O nome do portador é obrigatório.");

          let nextCd = rec.cd_portador;
          if (mode === "insert") {
            const { data, error } = await supabase
              .from("portador")
              .select("cd_portador")
              .eq("empresa_id", XEmpresaId)
              .order("cd_portador", { ascending: false })
              .limit(1);
            if (error) {
              console.error("Erro ao buscar último cd_portador:", error);
            }
            const lastCd = data && data[0] ? data[0].cd_portador : 0;
            nextCd = (lastCd || 0) + 1;
          }

          return {
            ...rec,
            nome: rec.nome.trim().toUpperCase(),
            cd_portador: nextCd,
            empresa_id: XEmpresaId,
            excluido: false,
            dt_cadastro: mode === "insert" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_cadastro,
            dt_alteracao: mode === "edit" ? new Date().toLocaleString("sv-SE").replace(" ", "T") : rec.dt_alteracao,
            banco_id: rec.banco_id ? parseInt(String(rec.banco_id)) : null,
            conta_id: rec.conta_id || null,
            ativo: rec.ativo || "S"
          } as IPortador;
        }
      }}
      XGridCols={XGridCols}
      XExportTitle="Portadores"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLElement;
            if (target.tagName !== "INPUT" && target.tagName !== "SELECT" && target.getAttribute("role") !== "checkbox") return;

            e.preventDefault();

            const tabContent = document.getElementById(`tab-content-${activeTab}`);
            if (!tabContent) return;

            const selector = 'input:not([readonly]):not([disabled]), select:not([disabled]), button[role="checkbox"]:not([disabled])';
            const focusableInTab = Array.from(tabContent.querySelectorAll(selector)) as HTMLElement[];

            const index = focusableInTab.indexOf(target);
            if (index > -1) {
              if (index < focusableInTab.length - 1) {
                focusableInTab[index + 1].focus();
              } else {
                const saveBtn = document.querySelector("button.text-emerald-600, button.text-emerald-500") as HTMLElement;
                if (saveBtn) {
                  saveBtn.focus();
                }
              }
            }
          }
        };

        return (
          <div className="space-y-4 pt-3 md:pt-0" onKeyDown={handleKeyDown}>
            {/* Abas no mesmo padrão da tela de contas */}
            <div className="flex border-b border-border flex-wrap mb-4 bg-card">
              {Object.entries(XTabLabels).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-all ${
                    activeTab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(t)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "dados_principais" && (
              <div id="tab-content-dados_principais" className="space-y-4 outline-none">
                <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
                  <div className="w-full md:w-32">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                    <input 
                      type="text" 
                      value={mode === "insert" ? "" : record.cd_portador ?? ""} 
                      readOnly 
                      className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" 
                    />
                  </div>

                  <div className="w-full md:w-48">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                    <input 
                      type="text" 
                      value={(() => {
                        const em = XEmpresas.find(e => e.empresa_id === record.empresa_id || e.empresa_id === XEmpresaId);
                        return em ? `${em.empresa_id} - ${em.identificacao}` : String(record.empresa_id || XEmpresaId || "");
                      })()} 
                      readOnly 
                      className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" 
                    />
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Nome do Portador <span className="text-destructive">*</span></label>
                    <input
                      type="text"
                      value={record.nome ?? ""}
                      onChange={e => setField("nome", e.target.value.toUpperCase())}
                      readOnly={!isEditing}
                      autoFocus={isEditing}
                      maxLength={50}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:flex md:gap-4 gap-5">
                  <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Banco Vinculado</label>
                    <select
                      value={record.banco_id ?? ""}
                      onChange={e => setField("banco_id", e.target.value ? parseInt(e.target.value) : null)}
                      disabled={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                        isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {XBancos.map(b => (
                        <option key={b.banco_id} value={b.banco_id}>
                          {b.cd_banco} - {b.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-64">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Conta Bancária Vinculada</label>
                    <select
                      value={record.conta_id ?? ""}
                      onChange={e => setField("conta_id", e.target.value || null)}
                      disabled={!isEditing}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                        isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                      }`}
                    >
                      <option value="">— Selecione —</option>
                      {XContas.map(c => (
                        <option key={c.conta_id} value={c.conta_id}>
                          {c.cd_conta} - {c.nome_conta}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full md:w-32 flex items-end pb-2">
                    {isEditing ? (
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <Checkbox
                          checked={record.ativo === "S"}
                          onCheckedChange={(checked) => setField("ativo", checked ? "S" : "N")}
                        />
                        ATIVO
                      </label>
                    ) : (
                      <span className={`text-sm font-medium ${record.ativo === "S" ? "text-success" : "text-destructive"}`}>
                        {record.ativo === "S" ? "✓ ATIVO" : "✗ INATIVO"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

export default PortadorForm;
