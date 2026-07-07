import React from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import { supabase } from "@/integrations/supabase/client";

interface ICondicao {
  condicao_id: number;
  descricao: string;
  tipo_prazo: string | null;
  meio_pagamento_id: number | null;
  cd_condicao_pagamento: number | null;
  qtd_parcelas: number | null;
  intervalo: number | null;
  prazo_1: number; prazo_2: number; prazo_3: number; prazo_4: number;
  prazo_5: number; prazo_6: number; prazo_7: number; prazo_8: number;
  prazo_9: number; prazo_10: number; prazo_11: number; prazo_12: number;
  empresa_id: number;
}

const TIPO_PRAZO_OPTIONS = [
  { v: "F", l: "Fixo" },
  { v: "V", l: "Variável" },
];

const PRAZO_KEYS = ["prazo_1","prazo_2","prazo_3","prazo_4","prazo_5","prazo_6","prazo_7","prazo_8","prazo_9","prazo_10","prazo_11","prazo_12"] as const;

const XDefault: Partial<ICondicao> = {
  descricao: "", tipo_prazo: "F", meio_pagamento_id: null, cd_condicao_pagamento: null, qtd_parcelas: null, intervalo: null,
  prazo_1: 0, prazo_2: 0, prazo_3: 0, prazo_4: 0, prazo_5: 0, prazo_6: 0,
  prazo_7: 0, prazo_8: 0, prazo_9: 0, prazo_10: 0, prazo_11: 0, prazo_12: 0,
};

const CondicaoPagamentoForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const [XMeiosPagamento, setXMeiosPagamento] = React.useState<{ meio_pagamento_id: number; descricao: string }[]>([]);

  React.useEffect(() => {
    async function loadMeios() {
      const { data, error } = await supabase
        .from("meio_pagamento")
        .select("meio_pagamento_id, descricao")
        .order("meio_pagamento_id", { ascending: true });
      if (error) {
        console.error("Erro ao carregar meios de pagamento:", error);
      } else if (data) {
        setXMeiosPagamento(data);
      }
    }
    loadMeios();
  }, []);

  const XGridCols = React.useMemo<IGridColumn[]>(() => [
    { key: "cd_condicao_pagamento", label: "Código", width: "80px", align: "right" },
    { key: "descricao", label: "Descrição", width: "200px" },
    { 
      key: "meio_pagamento_id", 
      label: "Meio de Pagamento", 
      width: "200px",
      render: (row) => {
        const found = XMeiosPagamento.find(m => m.meio_pagamento_id === row.meio_pagamento_id);
        return found ? found.descricao : (row.meio_pagamento_id ?? "");
      }
    },
    { 
      key: "tipo_prazo", 
      label: "Tipo Prazo", 
      width: "120px",
      render: (row) => row.tipo_prazo === "F" ? "Fixo" : row.tipo_prazo === "V" ? "Variável" : ""
    },
    { 
      key: "qtd_parcelas", 
      label: "Parcelas", 
      width: "80px", 
      align: "center",
      render: (row: ICondicao) => row.qtd_parcelas && row.qtd_parcelas !== 0 ? String(row.qtd_parcelas) : ""
    },
    { 
      key: "intervalo", 
      label: "Intervalo", 
      width: "80px", 
      align: "center",
      render: (row: ICondicao) => row.intervalo && row.intervalo !== 0 ? String(row.intervalo) : ""
    },
    ...PRAZO_KEYS.map((k, i) => ({
      key: k,
      label: `Pz ${i + 1}`,
      width: "80px",
      align: "center" as const,
      render: (row: ICondicao) => {
        if (row.tipo_prazo !== "V") return "";
        const val = row[k as keyof ICondicao];
        return val && val !== 0 ? String(val) : "";
      }
    }))
  ], [XMeiosPagamento]);

  return (
    <StandardCrudForm<ICondicao>
      config={{
        XTableName: "condicao_pagamento",
        XPrimaryKey: "condicao_id",
        XTitle: "Condições de Pagamento",
        XEmpresaId,
        XSelectCols: "condicao_id,descricao,tipo_prazo,meio_pagamento_id,cd_condicao_pagamento,qtd_parcelas,intervalo,prazo_1,prazo_2,prazo_3,prazo_4,prazo_5,prazo_6,prazo_7,prazo_8,prazo_9,prazo_10,prazo_11,prazo_12,empresa_id",
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.descricao?.trim()) throw new Error("A descrição é obrigatória.");
          
          let nextCd = rec.cd_condicao_pagamento;
          if (mode === "insert") {
            const { data, error } = await supabase
              .from("condicao_pagamento")
              .select("cd_condicao_pagamento")
              .eq("empresa_id", XEmpresaId)
              .order("cd_condicao_pagamento", { ascending: false })
              .limit(1);
            if (error) {
              console.error("Erro ao buscar último código:", error);
            }
            const lastCd = data && data[0] ? data[0].cd_condicao_pagamento : 0;
            nextCd = (lastCd || 0) + 1;
          }

          const out: Partial<ICondicao> = {
            ...rec,
            descricao: rec.descricao.trim(),
            cd_condicao_pagamento: nextCd,
            empresa_id: XEmpresaId,
            meio_pagamento_id: rec.meio_pagamento_id || null,
            tipo_prazo: rec.tipo_prazo || null,
            qtd_parcelas: rec.tipo_prazo === "F" ? (parseInt(String(rec.qtd_parcelas)) || null) : null,
            intervalo: rec.tipo_prazo === "F" ? (parseInt(String(rec.intervalo)) || null) : null,
          };
          PRAZO_KEYS.forEach(k => {
            (out as Record<string, unknown>)[k] = rec.tipo_prazo === "V" ? (parseInt(String(rec[k] ?? 0)) || 0) : 0;
          });
          return out as ICondicao;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Condições de Pagamento"
      renderCadastro={({ record, setField, setRecord, mode, isEditing }) => {
        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLElement;
            if (target.tagName !== "INPUT" && target.tagName !== "SELECT") return;
            
            e.preventDefault();
            
            const container = e.currentTarget;
            const selector = 'input:not([readonly]):not([disabled]), select:not([disabled])';
            const focusable = Array.from(container.querySelectorAll(selector)) as HTMLElement[];
            
            const index = focusable.indexOf(target);
            if (index > -1 && index < focusable.length - 1) {
              focusable[index + 1].focus();
            }
          }
        };

        return (
          <div className="space-y-4 pt-3 md:pt-0" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input 
                  type="text" 
                  value={mode === "insert" ? "" : record.cd_condicao_pagamento ?? ""} 
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
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={record.descricao ?? ""}
                  onChange={e => setField("descricao", e.target.value.toUpperCase())}
                  readOnly={!isEditing}
                  autoFocus={isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
                />
              </div>

              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Meio de Pagamento</label>
                <select
                  value={record.meio_pagamento_id ?? ""}
                  onChange={e => setField("meio_pagamento_id", parseInt(e.target.value) || null)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                  }`}
                >
                  <option value="">— Selecione —</option>
                  {XMeiosPagamento.map(m => (
                    <option key={m.meio_pagamento_id} value={m.meio_pagamento_id}>
                      {m.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-40">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Prazo</label>
                <select
                  value={record.tipo_prazo ?? ""}
                  onChange={e => {
                    const val = e.target.value || null;
                    if (val === "F") {
                      setRecord({
                        ...record,
                        tipo_prazo: "F",
                        prazo_1: 0, prazo_2: 0, prazo_3: 0, prazo_4: 0,
                        prazo_5: 0, prazo_6: 0, prazo_7: 0, prazo_8: 0,
                        prazo_9: 0, prazo_10: 0, prazo_11: 0, prazo_12: 0
                      });
                    } else if (val === "V") {
                      setRecord({
                        ...record,
                        tipo_prazo: "V",
                        qtd_parcelas: null,
                        intervalo: null
                      });
                    } else {
                      setField("tipo_prazo", val);
                    }
                  }}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm h-[34px] ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none cursor-pointer" : "bg-secondary text-muted-foreground appearance-none disabled:opacity-100"
                  }`}
                >
                  {TIPO_PRAZO_OPTIONS.map(o => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-24">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Parcelas</label>
                <input
                  type="number"
                  value={String(record.qtd_parcelas ?? "")}
                  onChange={e => setField("qtd_parcelas", parseInt(e.target.value) || null)}
                  readOnly={!isEditing || record.tipo_prazo !== "F"}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
                    isEditing && record.tipo_prazo === "F" ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary text-muted-foreground"
                  }`}
                />
              </div>

              <div className="w-full md:w-24">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Intervalo (dias)</label>
                <input
                  type="number"
                  value={String(record.intervalo ?? "")}
                  onChange={e => setField("intervalo", parseInt(e.target.value) || null)}
                  readOnly={!isEditing || record.tipo_prazo !== "F"}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
                    isEditing && record.tipo_prazo === "F" ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary text-muted-foreground"
                  }`}
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Prazos em dias (por parcela)</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-5">
                {PRAZO_KEYS.map((k, i) => {
                  const isFieldDisabled = !isEditing || record.tipo_prazo === "F";
                  return (
                    <div key={k}>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{i + 1}ª Parcela</label>
                      <input
                        type="number"
                        value={String(record[k as keyof ICondicao] ?? 0)}
                        onChange={e => setField(k, parseInt(e.target.value) || 0)}
                        readOnly={isFieldDisabled}
                        className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${
                          !isFieldDisabled ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary text-muted-foreground"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
};

export default CondicaoPagamentoForm;
