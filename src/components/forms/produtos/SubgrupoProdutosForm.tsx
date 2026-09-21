import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import { handleSelectKeyDown } from "@/utils/formNavigation";

interface ISubgrupo {
  produto_subgrupo_id: number;
  cd_produto_subgrupo?: number | null;
  produto_grupo_id: number | null;
  nome: string;
  empresa_id: number;
  excluido: boolean;
  grupo_nome?: string;
  pc_desc_maximo_av?: number | null;
  pc_desc_maximo_prz?: number | null;
  produto_grupo?: {
    nome: string;
  } | null;
}

interface IGrupoOption {
  produto_grupo_id: number;
  nome: string;
}

const fmt2 = (v: number | null | undefined) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const XGridCols: IGridColumn[] = [
  { key: "cd_produto_subgrupo", label: "Código", width: "100px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "grupo_nome", label: "Grupo de Produtos", width: "1fr" },
  { key: "pc_desc_maximo_av", label: "Desc. Máx. À Vista (%)", width: "160px", align: "right", render: (r: ISubgrupo) => fmt2(r.pc_desc_maximo_av) },
  { key: "pc_desc_maximo_prz", label: "Desc. Máx. À Prazo (%)", width: "160px", align: "right", render: (r: ISubgrupo) => fmt2(r.pc_desc_maximo_prz) },
];

const SubgrupoProdutosForm: React.FC = () => {
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XGrupos, setXGrupos] = useState<IGrupoOption[]>([]);
  const [XLoadingGroups, setXLoadingGroups] = useState(true);

  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  // Carrega os grupos de produtos para o select dropdown
  useEffect(() => {
    let active = true;
    setXLoadingGroups(true);
    supabase
      .from("produto_grupo")
      .select("produto_grupo_id,nome")
      .eq("empresa_id", XEmpresaMatrizId)
      .eq("excluido", false)
      .order("nome")
      .then(({ data }) => {
        if (active) {
          setXLoadingGroups(false);
          if (data) {
            setXGrupos(data as IGrupoOption[]);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [XEmpresaMatrizId]);

  const XConfig = React.useMemo(() => ({
    XTableName: "produto_subgrupo",
    XPrimaryKey: "produto_subgrupo_id" as const,
    XTitle: "Subgrupos de Produtos",
    XEmpresaId: XEmpresaMatrizId,
    XDefaultRecord: { nome: "", produto_grupo_id: null, pc_desc_maximo_av: 0, pc_desc_maximo_prz: 0 },
    XSelectCols: "produto_subgrupo_id,cd_produto_subgrupo,nome,produto_grupo_id,empresa_id,excluido,pc_desc_maximo_av,pc_desc_maximo_prz",
    XOnBeforeSave: (rec: Partial<ISubgrupo>) => {
      if (!rec.nome?.trim()) throw new Error("O nome do subgrupo é obrigatório.");
      if (!rec.produto_grupo_id) throw new Error("O grupo de produtos é obrigatório.");
      const pc_desc_maximo_av = typeof rec.pc_desc_maximo_av === "number" ? rec.pc_desc_maximo_av : parseFloat(String(rec.pc_desc_maximo_av || 0).replace(",", ".")) || 0;
      const pc_desc_maximo_prz = typeof rec.pc_desc_maximo_prz === "number" ? rec.pc_desc_maximo_prz : parseFloat(String(rec.pc_desc_maximo_prz || 0).replace(",", ".")) || 0;
      const cleanRec = { ...rec };
      delete (cleanRec as any).grupo_nome;
      delete (cleanRec as any).produto_grupo;
      return { 
        ...cleanRec, 
        nome: rec.nome.trim(),
        produto_grupo_id: Number(rec.produto_grupo_id),
        pc_desc_maximo_av,
        pc_desc_maximo_prz,
      };
    },
    XOnAfterLoad: (data: ISubgrupo[]) => {
      data.forEach(item => {
        const g = XGrupos.find(x => x.produto_grupo_id === item.produto_grupo_id);
        item.grupo_nome = g ? g.nome : "";
      });
    }
  }), [XEmpresaMatrizId, XGrupos]);

  return (
    <StandardCrudForm<ISubgrupo>
      config={XConfig}
      XGridCols={XGridCols}
      XExportTitle="Subgrupos de Produtos"
      renderCadastro={({ record, setField, mode, isEditing }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
              <input 
                type="text" 
                value={mode === "insert" ? "(Novo)" : record.cd_produto_subgrupo ?? ""} 
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

            <div className="w-full md:w-80">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Grupo de Produtos <span className="text-destructive">*</span>
              </label>
              {isEditing ? (
                <select 
                  value={record.produto_grupo_id ? String(record.produto_grupo_id) : ""} 
                  onChange={e => {
                    const v = e.target.value;
                    const groupVal = v ? Number(v) : null;
                    setField("produto_grupo_id", groupVal);
                    const grp = XGrupos.find(g => g.produto_grupo_id === groupVal);
                    setField("grupo_nome", grp ? grp.nome : "");
                  }}
                  onKeyDown={(e) => handleSelectKeyDown(e)}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]"
                >
                  <option value="">{XLoadingGroups ? "Carregando grupos..." : "Selecione o grupo..."}</option>
                  {XGrupos.map(g => (
                    <option key={g.produto_grupo_id} value={String(g.produto_grupo_id)}>
                      {g.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  readOnly 
                  value={record.grupo_nome ?? ""} 
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" 
                />
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nome <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.nome ?? ""}
                onChange={e => setField("nome", e.target.value)}
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
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desc. Máximo À Vista (%)</label>
              <CurrencyInput
                value={record.pc_desc_maximo_av ?? 0}
                onChange={v => setField("pc_desc_maximo_av", v)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                }`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Desc. Máximo À Prazo (%)</label>
              <CurrencyInput
                value={record.pc_desc_maximo_prz ?? 0}
                onChange={v => setField("pc_desc_maximo_prz", v)}
                disabled={!isEditing}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right h-[34px] ${
                  isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    />
  );
};

export default SubgrupoProdutosForm;
