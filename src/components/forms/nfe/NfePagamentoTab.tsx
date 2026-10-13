import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { formatNumericInput } from "@/utils/formNavigation";

const db = supabase as any;

const T_PAG_LABELS: Record<string, string> = {
  "01": "Dinheiro",
  "02": "Cheque",
  "03": "Cartão de Crédito",
  "04": "Cartão de Débito",
  "05": "Crédito Loja",
  "10": "Vale Alimentação",
  "11": "Vale Refeição",
  "12": "Vale Presente",
  "13": "Vale Combustível",
  "15": "Boleto Bancário",
  "16": "Depósito Bancário",
  "17": "PIX",
  "18": "Transferência bancária",
  "19": "Cashback",
  "90": "Sem pagamento",
  "99": "Outros",
};

// Card-related fields (tpIntegra/CNPJ/cAut) only apply to credit, debit and PIX
const CARTAO_TPAG = ["03", "04", "17"];

const fmt2 = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLS: IGridColumn[] = [
  { key: "nfe_pagamento_id", label: "ID", width: "70px", align: "right" },
  { key: "t_pag", label: "Forma", width: "1fr", render: (r) => `${r.t_pag} - ${T_PAG_LABELS[r.t_pag] || ""}` },
  { key: "v_pag", label: "Valor", width: "140px", align: "right", render: (r) => fmt2(r.v_pag) },
  { key: "cnpj_credenciadora", label: "CNPJ Credenciadora", width: "180px" },
  { key: "c_aut", label: "Autorização", width: "150px" },
];

interface Props {
  nfeCabecalhoId: number | null;
  podeEditar: boolean;
  finNfe?: number;
}

const NfePagamentoTab: React.FC<Props> = ({ nfeCabecalhoId, podeEditar, finNfe }) => {
  const isDevolucao = Number(finNfe) === 4;

  const getInitialForm = useCallback(() => ({
    t_pag: isDevolucao ? "90" : "01",
    v_pag: isDevolucao ? "0,00" : "",
    tp_integra: 2,
    cnpj_credenciadora: "",
    c_aut: ""
  }), [isDevolucao]);

  const [XList, setXList] = useState<any[]>([]);
  const [XIdx, setXIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<any>(getInitialForm);

  // Sincroniza estado inicial se finNfe mudar
  useEffect(() => {
    setXF(getInitialForm());
  }, [getInitialForm]);

  const load = useCallback(async () => {
    if (!nfeCabecalhoId) { setXList([]); return; }
    const { data, error } = await db.from("fiscal_nfe_pagamento")
      .select("*").eq("nfe_cabecalho_id", nfeCabecalhoId).order("nfe_pagamento_id");
    if (error) { toast.error("Erro ao carregar pagamentos: " + error.message); return; }

    const pagamentos = data || [];

    // Se for NF-e de devolução/retorno (finalidade 4), garante pagamento 90 (Sem pagamento) zerado
    if (isDevolucao) {
      if (pagamentos.length === 0 && podeEditar) {
        const { data: newPag, error: errInsert } = await db.from("fiscal_nfe_pagamento")
          .insert({
            nfe_cabecalho_id: nfeCabecalhoId,
            t_pag: "90",
            v_pag: 0,
            tp_integra: 2,
          })
          .select()
          .single();
        if (!errInsert && newPag) {
          setXList([newPag]);
          return;
        }
      } else if (pagamentos.length === 1 && (pagamentos[0].t_pag !== "90" || Number(pagamentos[0].v_pag) !== 0) && podeEditar) {
        await db.from("fiscal_nfe_pagamento").update({
          t_pag: "90",
          v_pag: 0,
          tp_integra: 2,
          cnpj_credenciadora: null,
          c_aut: null,
        }).eq("nfe_pagamento_id", pagamentos[0].nfe_pagamento_id);
        pagamentos[0].t_pag = "90";
        pagamentos[0].v_pag = 0;
      }
    }

    setXList(pagamentos);
  }, [nfeCabecalhoId, isDevolucao, podeEditar]);

  useEffect(() => { load(); }, [load]);

  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const handleSalvar = async () => {
    if (!nfeCabecalhoId) { toast.error("Salve a NF-e antes."); return; }
    const finalTPag = isDevolucao ? "90" : XF.t_pag;
    if (!finalTPag) { toast.error("Informe a Forma de Pagamento."); return; }

    const isSemPag = finalTPag === "90";
    const valor = isSemPag ? 0 : parseNum(XF.v_pag);
    if (!isSemPag && valor <= 0) {
      toast.error("Valor deve ser maior que zero.");
      return;
    }

    const cartao = !isSemPag && CARTAO_TPAG.includes(finalTPag);
    const payload: any = {
      nfe_cabecalho_id: nfeCabecalhoId,
      t_pag: finalTPag,
      v_pag: valor,
      tp_integra: cartao && XF.tp_integra ? Number(XF.tp_integra) : 2,
      cnpj_credenciadora: cartao ? XF.cnpj_credenciadora || null : null,
      c_aut: cartao ? XF.c_aut || null : null,
    };

    if (XMode === "edit" && XIdx !== null) {
      const { error } = await db.from("fiscal_nfe_pagamento").update(payload)
        .eq("nfe_pagamento_id", XList[XIdx].nfe_pagamento_id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("fiscal_nfe_pagamento").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    setXMode("view"); setXIdx(null);
    setXF(getInitialForm());
    await load();
  };

  const handleExcluir = async () => {
    if (XIdx === null) return;
    if (!confirm("Excluir este pagamento?")) return;
    const id = XList[XIdx].nfe_pagamento_id;
    const { error } = await db.from("fiscal_nfe_pagamento").delete().eq("nfe_pagamento_id", id);
    if (error) { toast.error(error.message); return; }
    setXIdx(null);
    await load();
  };

  const isEditing = XMode === "edit" || XMode === "insert";
  const inputCls = "w-full border border-border bg-card rounded px-2 py-1 text-sm focus:border-primary outline-none";
  const currentTPag = isDevolucao ? "90" : XF.t_pag;
  const isSemPagamento = isDevolucao || currentTPag === "90";
  const usaCartao = !isSemPagamento && CARTAO_TPAG.includes(currentTPag);
  const disCls = usaCartao ? "" : " opacity-50 cursor-not-allowed bg-secondary";
  const total = XList.reduce((a, p) => a + Number(p.v_pag || 0), 0);

  return (
    <div className="space-y-4">
      {isEditing && (
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">
                Forma de Pagamento {isDevolucao && <span className="text-primary font-normal">(Fixado para Devolução)</span>}
              </label>
              <select 
                disabled={isDevolucao} 
                value={currentTPag} 
                onChange={e => {
                  const t = e.target.value;
                  if (t === "90") {
                    setXF((p: any) => ({ ...p, t_pag: "90", v_pag: "0,00", tp_integra: 2, cnpj_credenciadora: "", c_aut: "" }));
                  } else {
                    setXF((p: any) => CARTAO_TPAG.includes(t) ? { ...p, t_pag: t } : { ...p, t_pag: t, tp_integra: 2, cnpj_credenciadora: "", c_aut: "" });
                  }
                }} 
                className={inputCls + (isDevolucao ? " opacity-75 cursor-not-allowed bg-secondary" : "")}
                title={isDevolucao ? "NF-e de Devolução ou Retorno (Finalidade 4) exige código 90 - Sem pagamento" : ""}
              >
                {Object.entries(T_PAG_LABELS).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                  <option key={k} value={k}>{k} - {v}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">
                Valor {isSemPagamento && <span className="text-muted-foreground font-normal">(Bloqueado)</span>}
              </label>
              <input
                disabled={isSemPagamento}
                readOnly={isSemPagamento}
                value={isSemPagamento ? "0,00" : XF.v_pag}
                onChange={e => !isSemPagamento && setXF((p: any) => ({ ...p, v_pag: formatNumericInput(e.target.value, 2) }))}
                onBlur={() => !isSemPagamento && setXF((p: any) => p.v_pag === "" ? p : ({ ...p, v_pag: fmt2(parseNum(p.v_pag)) }))}
                className={inputCls + " text-right font-mono" + (isSemPagamento ? " opacity-75 cursor-not-allowed bg-secondary font-bold text-muted-foreground" : "")}
                title={isSemPagamento ? "Forma '90 - Sem pagamento' possui valor fixo em 0,00 na SEFAZ" : ""}
              />
            </div>
            <div className="col-span-2">
              <label title="Indica se o pagamento com cartão foi integrado ao sistema de automação (TEF/POS integrado). Usado apenas para cartão/PIX." className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Integrado TEF</label>
              <select disabled={!usaCartao} value={XF.tp_integra} onChange={e => setXF((p: any) => ({ ...p, tp_integra: e.target.value }))} className={inputCls + disCls}>
                <option value={1}>1-Integrado</option>
                <option value={2}>2-Não integrado</option>
              </select>
            </div>
            <div className="col-span-3">
              <label title="CNPJ da credenciadora/adquirente do cartão (Cielo, Rede, Stone etc.)." className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">CNPJ Credenciadora</label>
              <input disabled={!usaCartao} value={XF.cnpj_credenciadora || ""} onChange={e => setXF((p: any) => ({ ...p, cnpj_credenciadora: e.target.value }))} className={inputCls + disCls} />
            </div>
            <div className="col-span-4">
              <label title="Código de autorização da transação retornado pela operadora do cartão." className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Autorização</label>
              <input disabled={!usaCartao} value={XF.c_aut || ""} onChange={e => setXF((p: any) => ({ ...p, c_aut: e.target.value }))} className={inputCls + disCls} />
            </div>
            <div className="col-span-8 flex gap-2 justify-end items-end">
              <button onClick={handleSalvar} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-emerald-600 hover:bg-emerald-50">Salvar</button>
              <button onClick={() => { setXMode("view"); setXIdx(null); }} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-rose-600 hover:bg-rose-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <DataGrid
        columns={COLS}
        data={XList}
        maxHeight="340px"
        exportTitle="Pagamentos da NF-e"
        showRecordCount={false}
        selectedIdx={XIdx}
        onRowClick={(_, idx) => setXIdx(idx)}
        toolbarLeft={podeEditar ? (
          <GridActionToolbar
            actions={[
              gridActions.incluir(() => {
                setXMode("insert");
                setXF(getInitialForm());
                setXIdx(null);
              }),
              gridActions.alterar(() => {
                if (XIdx !== null) {
                  setXMode("edit");
                  const r = XList[XIdx];
                  const isR90 = isDevolucao || r.t_pag === "90";
                  setXF({
                    t_pag: isDevolucao ? "90" : r.t_pag,
                    v_pag: isR90 ? "0,00" : fmt2(Number(r.v_pag || 0)),
                    tp_integra: r.tp_integra ?? 2,
                    cnpj_credenciadora: r.cnpj_credenciadora || "",
                    c_aut: r.c_aut || "",
                  });
                }
              }, XIdx === null || isEditing),
              null,
              gridActions.excluir(handleExcluir, XIdx === null || isEditing),
              gridActions.atualizar(load),
            ]}
            count={`${XList.length} pagamento(s) — Total: ${fmt2(total)}`}
          />
        ) : undefined}
      />
    </div>
  );
};

export default NfePagamentoTab;
