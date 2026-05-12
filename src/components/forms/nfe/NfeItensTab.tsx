import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Link } from "lucide-react";
import type { INfeItem } from "./types";

const db = supabase as any;

const fmt6 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface NfeItensTabProps {
  nfeCabecalhoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  onTotaisChanged?: (totais: { vl_total: number; vl_ipi: number; vl_icms_st: number }) => void;
}

const COLS: IGridColumn[] = [
  { key: "nr_item",       label: "Item",        width: "60px",   align: "right" },
  { key: "cd_prod_fornec",label: "Cód. Forn.",  width: "100px" },
  { key: "_produto",      label: "Produto",     width: "2fr",    render: (r) => r._produto_nome || <span className="text-amber-500 italic text-xs">⚠ sem vínculo</span> },
  { key: "nm_produto",    label: "Desc. NF",    width: "2fr" },
  { key: "ncm",           label: "NCM",         width: "90px" },
  { key: "cfop",          label: "CFOP",        width: "70px" },
  { key: "unidade",       label: "Un.",         width: "60px",   align: "center" },
  { key: "qt_entrada",    label: "Qtd.",        width: "100px",  align: "right", render: (r) => fmt6(r.qt_entrada) },
  { key: "vl_unit",       label: "Vlr. Unit.",  width: "110px",  align: "right", render: (r) => fmt6(r.vl_unit) },
  { key: "vl_desconto",   label: "Desc.",       width: "90px",   align: "right", render: (r) => fmt2(r.vl_desconto) },
  { key: "vl_ipi",        label: "IPI",         width: "90px",   align: "right", render: (r) => fmt2(r.vl_ipi) },
  { key: "vl_icms_st",    label: "ICMS-ST",     width: "90px",   align: "right", render: (r) => fmt2(r.vl_icms_st) },
  { key: "vl_total",      label: "Total",       width: "110px",  align: "right", render: (r) => fmt2(r.vl_total) },
];

const emptyItem = (): Partial<INfeItem> => ({
  nr_item: 0, cd_prod_fornec: "", nm_produto: "", ncm: "", cfop: "", unidade: "",
  gtin: "", qt_entrada: 0, vl_unit: 0, vl_desconto: 0, vl_total: 0,
  vl_ipi: 0, vl_icms_st: 0, vl_pis: 0, vl_cofins: 0, vl_fcp_st: 0,
  pc_ipi: 0, pc_icms: 0, pc_icms_st: 0, pc_pis: 0, pc_cofins: 0, pc_fcp_st: 0,
  cst_icms: "", cst_ipi: "", cst_pis: "", cst_cofins: "", pc_mva: 0, vl_bc_st: 0,
  produto_id: undefined,
});

const NfeItensTab: React.FC<NfeItensTabProps> = ({
  nfeCabecalhoId,
  empresaId,
  podeEditar,
  onTotaisChanged,
}) => {
  const [XItens, setXItens] = useState<any[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<Partial<INfeItem>>(emptyItem());
  const [XProdutos, setXProdutos] = useState<{ produto_id: number; nome: string; referencia: string }[]>([]);

  const loadItens = useCallback(async () => {
    if (!nfeCabecalhoId) { setXItens([]); return; }
    const { data, error } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId).eq("excluido", false).order("nr_item");
    if (error) { toast.error("Erro ao carregar itens: " + error.message); return; }

    const rows = data || [];
    const prodIds = [...new Set(rows.map((r: any) => r.produto_id).filter(Boolean))];
    let prodMap: Record<number, string> = {};
    if (prodIds.length > 0) {
      const { data: prods } = await db.from("produto").select("produto_id, nome").in("produto_id", prodIds);
      (prods || []).forEach((p: any) => { prodMap[p.produto_id] = p.nome; });
    }
    const enriched = rows.map((r: any) => ({ ...r, _produto_nome: r.produto_id ? (prodMap[r.produto_id] || `#${r.produto_id}`) : null }));
    setXItens(enriched);

    if (onTotaisChanged) {
      const vl_total = enriched.reduce((a: number, i: any) => a + Number(i.vl_total || 0), 0);
      const vl_ipi = enriched.reduce((a: number, i: any) => a + Number(i.vl_ipi || 0), 0);
      const vl_icms_st = enriched.reduce((a: number, i: any) => a + Number(i.vl_icms_st || 0), 0);
      onTotaisChanged({ vl_total, vl_ipi, vl_icms_st });
    }
  }, [nfeCabecalhoId, onTotaisChanged]);

  useEffect(() => {
    const loadProdutos = async () => {
      const { data } = await db.from("produto").select("produto_id, nome").eq("excluido", false).order("nome").limit(500);
      setXProdutos(data || []);
    };
    loadProdutos();
  }, []);

  useEffect(() => { loadItens(); }, [loadItens]);

  const set = (key: string, val: any) => setXF(prev => ({ ...prev, [key]: val }));
  const parseNum = (v: any) => { if (!v && v !== 0) return 0; if (typeof v === "number") return v; const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", "."); const n = parseFloat(s); return isNaN(n) ? 0 : n; };
  const recalcTotal = (f: Partial<INfeItem>) => { const qt = parseNum(f.qt_entrada); const vlu = parseNum(f.vl_unit); const desc = parseNum(f.vl_desconto); return Math.round((qt * vlu - desc + Number.EPSILON) * 100) / 100; };

  const handleBlur = (key: string) => {
    const current = XF[key as keyof INfeItem];
    if (current === undefined || current === null || current === "") return;
    const val = parseNum(current);
    const decimals = (key === "qt_entrada" || key === "vl_unit") ? 6 : 2;
    set(key, val.toFixed(decimals).replace(".", ","));
  };

  const handleSalvar = async () => {
    if (!nfeCabecalhoId) return;
    if (!XF.nm_produto?.trim()) { toast.error("Informe a descrição do produto."); return; }
    const payload: any = { ...XF, nfe_cabecalho_id: nfeCabecalhoId, empresa_id: empresaId, nm_produto: XF.nm_produto!.toUpperCase(), qt_entrada: parseNum(XF.qt_entrada), vl_unit: parseNum(XF.vl_unit), vl_desconto: parseNum(XF.vl_desconto), vl_total: recalcTotal(XF) };
    if (XMode === "edit" && XCurrentIdx !== null) {
      await db.from("fiscal_nfe_item").update({ ...payload, updated_at: new Date().toISOString() }).eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
    } else {
      await db.from("fiscal_nfe_item").insert(payload);
    }
    setXMode("view"); setXCurrentIdx(null); await loadItens();
  };

  const isEditing = XMode === "edit" || XMode === "insert";
  const inputCls = "w-full border-b border-border bg-transparent px-1 py-1 text-sm focus:border-primary outline-none transition-all";

  // Helpers para inputs reutilizáveis
  const Txt = ({ k, label, span = 2, right = false, bold = false, accent = "" }: any) => (
    <div className={`col-span-${span}`}>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="text"
        value={(XF as any)[k] ?? ""}
        onChange={e => set(k, e.target.value)}
        className={`${inputCls} ${right ? "text-right" : ""} ${bold ? "font-bold" : ""} ${accent}`}
      />
    </div>
  );
  const Num = ({ k, label, span = 2, accent = "" }: any) => (
    <div className={`col-span-${span}`}>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="text"
        value={(XF as any)[k] ?? ""}
        onBlur={() => handleBlur(k)}
        onChange={e => set(k, e.target.value)}
        className={`${inputCls} text-right ${accent}`}
      />
    </div>
  );
  const Section = ({ title, children }: any) => (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary/80 border-b border-border/60 pb-1">{title}</div>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Formulário completo do item */}
      {isEditing && (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-border/60 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 max-h-[70vh] overflow-y-auto">
          {/* Identificação */}
          <Section title="Identificação">
            <div className="col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Item</label>
              <input type="number" value={XF.nr_item || ""} onChange={e => set("nr_item", parseInt(e.target.value) || 0)} className={inputCls + " text-right"} />
            </div>
            <Txt k="cd_prod_fornec" label="Cód. Forn." span={2} />
            <Txt k="gtin" label="GTIN" span={2} />
            <Txt k="ncm" label="NCM" span={2} />
            <Txt k="cest" label="CEST" span={1} />
            <Txt k="cfop" label="CFOP" span={1} />
            <Txt k="unidade" label="Un." span={1} />
            <Txt k="c_enq" label="cEnq" span={2} />
            <div className="col-span-8">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Descrição NF</label>
              <input value={XF.nm_produto || ""} onChange={e => set("nm_produto", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="col-span-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Link size={12}/> Produto Vinculado</label>
              <select value={XF.produto_id ?? ""} onChange={e => set("produto_id", e.target.value ? parseInt(e.target.value) : undefined)} className="w-full border-b border-border bg-transparent py-1 text-sm outline-none focus:border-primary">
                <option value="">— Selecione —</option>
                {XProdutos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.nome}</option>)}
              </select>
            </div>
          </Section>

          {/* Quantidades e Valores */}
          <Section title="Quantidades e Valores">
            <Num k="qt_entrada" label="Quantidade" span={2} />
            <Num k="vl_unit" label="Vlr. Unitário" span={2} accent="text-emerald-600 font-bold" />
            <Num k="vl_desconto" label="Desconto" span={2} />
            <Num k="vl_total" label="Total" span={2} accent="font-bold" />
          </Section>

          {/* ICMS */}
          <Section title="ICMS">
            <Txt k="cst_icms" label="CST" span={1} />
            <Txt k="csosn" label="CSOSN" span={1} />
            <Num k="pc_icms" label="Alíq. ICMS %" span={2} />
            <Txt k="origem" label="Origem" span={1} />
          </Section>

          {/* ICMS-ST */}
          <Section title="ICMS-ST / FCP-ST">
            <Num k="pc_mva" label="MVA %" span={2} />
            <Num k="vl_bc_st" label="BC ST" span={2} />
            <Num k="pc_icms_st" label="Alíq. ST %" span={2} />
            <Num k="vl_icms_st" label="Vlr. ICMS-ST" span={2} />
            <Num k="pc_fcp_st" label="FCP-ST %" span={2} />
            <Num k="vl_fcp_st" label="Vlr. FCP-ST" span={2} />
          </Section>

          {/* IPI */}
          <Section title="IPI">
            <Txt k="cst_ipi" label="CST IPI" span={2} />
            <Num k="pc_ipi" label="Alíq. IPI %" span={2} />
            <Num k="vl_ipi" label="Vlr. IPI" span={2} />
          </Section>

          {/* PIS / COFINS */}
          <Section title="PIS / COFINS">
            <Txt k="cst_pis" label="CST PIS" span={2} />
            <Num k="pc_pis" label="Alíq. PIS %" span={2} />
            <Num k="vl_pis" label="Vlr. PIS" span={2} />
            <Txt k="cst_cofins" label="CST COFINS" span={2} />
            <Num k="pc_cofins" label="Alíq. COFINS %" span={2} />
            <Num k="vl_cofins" label="Vlr. COFINS" span={2} />
          </Section>

          {/* IBS / CBS / IS (Reforma) */}
          <Section title="IBS / CBS / IS (Reforma)">
            <Txt k="cst_ibs" label="CST IBS" span={2} />
            <Num k="pc_ibs" label="Alíq. IBS %" span={2} />
            <Num k="vl_ibs" label="Vlr. IBS" span={2} />
            <Txt k="cst_cbs" label="CST CBS" span={2} />
            <Num k="pc_cbs" label="Alíq. CBS %" span={2} />
            <Num k="vl_cbs" label="Vlr. CBS" span={2} />
            <Txt k="cst_is" label="CST IS" span={2} />
            <Num k="pc_is" label="Alíq. IS %" span={2} />
            <Num k="vl_is" label="Vlr. IS" span={2} />
          </Section>

          <div className="flex gap-2 justify-end pt-2 border-t border-border/60 sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 -mx-4 -mb-4 px-4 py-3 rounded-b-xl">
            <button onClick={handleSalvar} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-border bg-transparent text-emerald-600 hover:bg-emerald-50 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Salvar
            </button>
            <button onClick={() => { setXMode("view"); setXCurrentIdx(null); }} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border border-border bg-transparent text-rose-600 hover:bg-rose-50 transition-all">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Grid de itens com botões integrados na mesma linha */}
      <DataGrid
        columns={COLS}
        data={XItens}
        maxHeight="340px"
        exportTitle="Itens da NF-e"
        showRecordCount={false}
        selectedIdx={XCurrentIdx}
        onRowClick={(_, idx) => setXCurrentIdx(idx)}
        toolbarLeft={podeEditar ? (
          <GridActionToolbar
            actions={[
              gridActions.incluir(() => { setXMode("insert"); setXF(emptyItem()); setXCurrentIdx(null); }),
              gridActions.alterar(() => { if (XCurrentIdx !== null) { setXMode("edit"); setXF({ ...XItens[XCurrentIdx] }); } }, XCurrentIdx === null || isEditing),
              null,
              gridActions.excluir(() => { if (confirm("Excluir?")) { /* lógica excluir */ } }, XCurrentIdx === null || isEditing),
              gridActions.atualizar(loadItens),
            ]}
            count={`${XItens.length} item(s)`}
          />
        ) : undefined}
      />
    </div>
  );
};

export default NfeItensTab;

