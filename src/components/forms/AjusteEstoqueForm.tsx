import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import type { IMovimento } from "./pedido/types";
import { ToolbarBtn, ToolbarSeparator } from "@/components/shared/FormToolbar";
import { Send, CheckCircle2, Lock, Trash2, Calendar, ClipboardList } from "lucide-react";
import AjusteEstoqueItensTab from "./ajuste/AjusteEstoqueItensTab";

const db = supabase as any;

interface IDepositoLookup { id: number; label: string; }

const buildGridCols = (
  depositos: IDepositoLookup[]
): IGridColumn[] => [
  { key: "nr_movimento", label: "Nº Ajuste", width: "100px", align: "right" },
  { 
    key: "dt_emissao", 
    label: "Data Ajuste", 
    width: "120px", 
    render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" 
  },
  { 
    key: "deposito_id", 
    label: "Depósito Padrão", 
    width: "2fr", 
    render: r => depositos.find(d => d.id === r.deposito_id)?.label || (r.deposito_id ? `#${r.deposito_id}` : "--") 
  },
  { 
    key: "status", 
    label: "Status", 
    width: "120px", 
    align: "center", 
    render: r => r.status === "F" ? "🔒 Finalizado" : "🔓 Aberto" 
  },
  { key: "observacao", label: "Observação Geral", width: "3fr" },
];

const XDefaultRecord: Partial<IMovimento> = {
  tp_movimento: "AE",
  tp_origem: "AJS",
  status: "A", // 'A' Aberto, 'F' Fechado
  faturado: "N",
  tp_desconto: "N",
  pc_desconto: 0,
  vl_produto: 0,
  vl_desconto: 0,
  vl_movimento: 0,
  vl_frete: 0,
  vl_despesa: 0,
  vl_seguro: 0,
  vl_outro: 0,
  dt_emissao: new Date().toISOString().substring(0, 10),
  observacao: "",
  obs_pedido: "",
};

export default function AjusteEstoqueForm() {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XDepositos, setXDepositos] = useState<IDepositoLookup[]>([]);
  const [XAutoNovoItem, setXAutoNovoItem] = useState(0);
  const XCrudRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const XCurrentRecordRef = useRef<IMovimento | null>(null);

  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  // Carregar depósitos para lookups
  useEffect(() => {
    (async () => {
      const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
      const { data, error } = await db.from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado")
        .in("empresa_id", ids)
        .eq("excluido", false)
        .order("nome");

      if (error) {
        console.warn("[AjusteEstoqueForm] Erro ao carregar depósitos:", error.message);
        return;
      }

      const filtered = (data || []).filter((d: any) =>
        d.empresa_id === XEmpresaId || d.st_privado === false
      );

      setXDepositos(filtered.map((d: any) => ({ id: d.deposito_id, label: `${d.deposito_id} - ${d.nome}` })));
    })();
  }, [XEmpresaId, XGroupEmpresaIds]);

  // Função transacional RPC de fechamento/processamento do ajuste
  const finalizarAjuste = useCallback(async (movimento_id: number) => {
    if (!movimento_id) { toast.error("Salve o cabeçalho do ajuste primeiro."); return; }
    
    if (!confirm("Deseja realmente finalizar este Ajuste de Estoque?\n\nEsta ação efetuará a validação de saldos e lançará a movimentação física de estoque permanentemente. Não poderá ser alterado ou desfeito!")) {
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    toast.loading("Processando e validando estoque...", { id: "finalizar-ajuste" });

    try {
      const { data, error } = await db.rpc("fu_finalizar_ajuste_estoque", {
        _movimento_id: movimento_id,
        _usuario_id: userId
      });

      if (error) {
        toast.error("Erro interno do banco: " + error.message, { id: "finalizar-ajuste" });
        return;
      }

      if (data?.error) {
        toast.error(data.error, { id: "finalizar-ajuste", duration: 8000 });
        return;
      }

      toast.success("Ajuste de estoque finalizado e estoque atualizado com sucesso!", { id: "finalizar-ajuste" });
      
      if (XCrudRefreshRef.current) {
        await XCrudRefreshRef.current();
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message, { id: "finalizar-ajuste" });
    }
  }, []);

  const gridCols = useMemo(() => buildGridCols(XDepositos), [XDepositos]);

  return (
    <StandardCrudForm<IMovimento>
      XToolbarExtras={({ currentRecord, isEditing }) => {
        XCurrentRecordRef.current = currentRecord;
        if (!currentRecord?.movimento_id || isEditing) return null;
        
        const isAberto = currentRecord.status === "A";
        
        return (
          <>
            {isAberto && (
              <ToolbarBtn 
                icon={<Lock size={18} />} 
                label="Finalizar Ajuste" 
                onClick={() => finalizarAjuste(currentRecord.movimento_id)} 
                color="success" 
              />
            )}
          </>
        );
      }}
      XHiddenTabs={[]}
      config={{
        XTableName: "movimento",
        XPrimaryKey: "movimento_id",
        XTitle: "Ajuste de Estoque",
        XDefaultRecord: { ...XDefaultRecord, empresa_id: XEmpresaId } as any,
        XEmpresaId,
        XSelectCols: "*",
        XOrderBy: "movimento_id",
        XApplyFilter: (q) => q.eq("tp_movimento", "AE"),
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.dt_emissao) throw new Error("Informe a Data do Ajuste.");
          if (!rec.deposito_id) throw new Error("Selecione o Depósito Padrão.");
          
          if (mode === "edit" && rec.status && rec.status === "F") {
            throw new Error("Este ajuste de estoque já foi finalizado e está em modo somente leitura.");
          }

          const cleanRec = { ...rec };
          
          // Sincronizar campos de observação para compatibilidade
          cleanRec.observacao = cleanRec.observacao || cleanRec.obs_pedido || "";
          cleanRec.obs_pedido = cleanRec.observacao;

          // Gerar sequencial de número de ajuste se for insert novo
          if (mode === "insert" && !cleanRec.nr_movimento) {
            const { data: maxNr } = await db.from("movimento")
              .select("nr_movimento")
              .eq("empresa_id", XEmpresaId)
              .eq("tp_movimento", "AE")
              .order("nr_movimento", { ascending: false })
              .limit(1);
            
            cleanRec.nr_movimento = ((maxNr && maxNr[0]?.nr_movimento) || 0) + 1;
          }

          return { ...cleanRec, empresa_id: cleanRec.empresa_id || XEmpresaId };
        },
        XOnAfterSave: async (rec, mode) => {
          if (mode === "insert") {
            setXAutoNovoItem(n => n + 1);
          }
        },
        XSoftDelete: false,
      }}
      XGridCols={gridCols}
      XExportTitle="Ajustes de Estoque"
      XAfterInsertTab="itens"
      XRefreshRef={XCrudRefreshRef}
      XExtraTabs={[
        {
          key: "itens",
          label: "Itens do Ajuste",
          render: ({ record, currentRecord, mode }) => {
            const ped = (mode === "insert" ? record : (currentRecord || record)) as IMovimento;
            return (
              <AjusteEstoqueItensTab
                pedido={ped?.movimento_id ? ped : null}
                podeEditar={ped?.status === "A"}
                autoNovoTrigger={XAutoNovoItem}
              />
            );
          },
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const isAberto = (record.status || "A") === "A";
        const ro = !isEditing || (mode === "edit" && !isAberto);

        return (
          <div className="space-y-4 max-w-4xl">
            <div className="bg-gradient-to-br from-card to-card/90 border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                <ClipboardList className="w-4.5 h-4.5 text-primary" />
                Dados Básicos do Ajuste
              </h2>

              <div className="grid grid-cols-12 gap-4">
                {/* Número do Ajuste */}
                <div className="col-span-12 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground/80">Nº Ajuste</label>
                  <input 
                    readOnly 
                    tabIndex={-1}
                    value={record.nr_movimento ?? (mode === "insert" ? "(Novo)" : "")} 
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-secondary/30 text-right font-semibold outline-none" 
                  />
                </div>

                {/* Data do Ajuste */}
                <div className="col-span-12 sm:col-span-3">
                  <label className="text-xs font-medium text-foreground/80">Data do Ajuste <span className="text-destructive">*</span></label>
                  <div className="relative mt-1">
                    <input 
                      type="date"
                      disabled={ro} 
                      value={record.dt_emissao ? record.dt_emissao.substring(0, 10) : ""} 
                      onChange={e => setField("dt_emissao" as any, e.target.value as any)} 
                      className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background/50 focus:bg-background outline-none focus:ring-1 focus:ring-primary/20" 
                    />
                  </div>
                </div>

                {/* Depósito Padrão */}
                <div className="col-span-12 sm:col-span-4">
                  <label className="text-xs font-medium text-foreground/80">Depósito Padrão <span className="text-destructive">*</span></label>
                  <select 
                    disabled={ro} 
                    value={record.deposito_id ?? ""} 
                    onChange={e => setField("deposito_id" as any, e.target.value ? Number(e.target.value) : null as any)} 
                    className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background/50 focus:bg-background outline-none font-medium"
                  >
                    <option value="">-- Selecione o Depósito Padrão --</option>
                    {XDepositos.map(d => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div className="col-span-12 sm:col-span-3">
                  <label className="text-xs font-medium text-foreground/80">Status</label>
                  <input 
                    readOnly 
                    tabIndex={-1}
                    value={record.status === "F" ? "🔒 Finalizado / Somente Leitura" : "🔓 Aberto / Em Edição"} 
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm mt-1 outline-none font-bold text-center border-border/80 ${
                      record.status === "F" ? "bg-emerald-500/10 text-emerald-600" : "bg-cyan-500/10 text-cyan-600"
                    }`} 
                  />
                </div>
              </div>

              {/* Observação Geral */}
              <div>
                <label className="text-xs font-semibold text-foreground/90">Observação Geral / Motivo do Ajuste</label>
                <textarea 
                  disabled={ro} 
                  value={record.observacao ?? ""} 
                  onChange={e => setField("observacao" as any, e.target.value as any)} 
                  placeholder="Descreva o motivo geral do ajuste físico (ex: inventário rotativo mensal de produtos acabados)..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm mt-1 min-h-[100px] bg-background/50 focus:bg-background outline-none focus:ring-1 focus:ring-primary/20" 
                />
              </div>
            </div>

            {/* Informative Banner */}
            {!isAberto && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 p-4 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">Ajuste de Estoque Finalizado</p>
                  <p className="mt-1">Este documento foi processado de forma transacional e o saldo físico no depósito foi atualizado. O formulário está em modo somente leitura (Read-Only).</p>
                </div>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
