import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";

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
}

const NfePagamentoTab: React.FC<Props> = ({ nfeCabecalhoId, podeEditar }) => {
  const [XList, setXList] = useState<any[]>([]);
  const [XIdx, setXIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<any>({ t_pag: "01", v_pag: "", tp_integra: 2, cnpj_credenciadora: "", c_aut: "" });

  const load = useCallback(async () => {
    if (!nfeCabecalhoId) { setXList([]); return; }
    const { data, error } = await db.from("fiscal_nfe_pagamento")
      .select("*").eq("nfe_cabecalho_id", nfeCabecalhoId).order("nfe_pagamento_id");
    if (error) { toast.error("Erro ao carregar pagamentos: " + error.message); return; }
    setXList(data || []);
  }, [nfeCabecalhoId]);

  useEffect(() => { load(); }, [load]);

  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };

  const handleSalvar = async () => {
    if (!nfeCabecalhoId) { toast.error("Salve a NF-e antes."); return; }
    if (!XF.t_pag) { toast.error("Informe a Forma de Pagamento."); return; }
    const valor = parseNum(XF.v_pag);
    if (valor <= 0) { toast.error("Valor deve ser maior que zero."); return; }

    const payload: any = {
      nfe_cabecalho_id: nfeCabecalhoId,
      t_pag: XF.t_pag,
      v_pag: valor,
      tp_integra: XF.tp_integra ? Number(XF.tp_integra) : 2,
      cnpj_credenciadora: XF.cnpj_credenciadora || null,
      c_aut: XF.c_aut || null,
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
    setXF({ t_pag: "01", v_pag: "", tp_integra: 2, cnpj_credenciadora: "", c_aut: "" });
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
  const total = XList.reduce((a, p) => a + Number(p.v_pag || 0), 0);

  return (
    <div className="space-y-4">
      {isEditing && (
        <div className="p-4 bg-card border border-border rounded-xl space-y-3">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Forma de Pagamento</label>
              <select value={XF.t_pag} onChange={e => setXF((p: any) => ({ ...p, t_pag: e.target.value }))} className={inputCls}>
                {Object.entries(T_PAG_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{k} - {v}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Valor</label>
              <input value={XF.v_pag} onChange={e => setXF((p: any) => ({ ...p, v_pag: e.target.value }))} className={inputCls + " text-right"} />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Tipo Integ.</label>
              <select value={XF.tp_integra} onChange={e => setXF((p: any) => ({ ...p, tp_integra: e.target.value }))} className={inputCls}>
                <option value={1}>1-Integrado</option>
                <option value={2}>2-Não integrado</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">CNPJ Credenciadora</label>
              <input value={XF.cnpj_credenciadora || ""} onChange={e => setXF((p: any) => ({ ...p, cnpj_credenciadora: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-4">
              <label className="block text-[10px] font-bold uppercase mb-1 text-muted-foreground">Autorização</label>
              <input value={XF.c_aut || ""} onChange={e => setXF((p: any) => ({ ...p, c_aut: e.target.value }))} className={inputCls} />
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
                setXF({ t_pag: "01", v_pag: "", tp_integra: 2, cnpj_credenciadora: "", c_aut: "" });
                setXIdx(null);
              }),
              gridActions.alterar(() => {
                if (XIdx !== null) {
                  setXMode("edit");
                  const r = XList[XIdx];
                  setXF({
                    t_pag: r.t_pag,
                    v_pag: String(r.v_pag).replace(".", ","),
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
