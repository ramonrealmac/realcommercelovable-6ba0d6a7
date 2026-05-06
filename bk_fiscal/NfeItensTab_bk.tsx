import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Plus, Pencil, Trash2, Link } from "lucide-react";
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
  const [XCurrentIdx, setXCurrentIdx] = useState(-1);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<Partial<INfeItem>>(emptyItem());
  const [XProdutos, setXProdutos] = useState<{ produto_id: number; nome: string; referencia: string }[]>([]);

  const loadItens = useCallback(async () => {
    if (!nfeCabecalhoId) { setXItens([]); return; }
    const { data, error } = await db
      .from("nfe_item")
      .select("*")
      .eq("nfe_cabecalho_id", nfeCabecalhoId)
      .eq("excluido", false)
      .order("nr_item");
    if (error) { toast.error("Erro ao carregar itens: " + error.message); return; }

    // Enriche com nome do produto
    const rows = data || [];
    const prodIds = [...new Set(rows.map((r: any) => r.produto_id).filter(Boolean))];
    let prodMap: Record<number, string> = {};
    if (prodIds.length > 0) {
      const { data: prods } = await db
        .from("produto")
        .select("produto_id, nome")
        .in("produto_id", prodIds);
      (prods || []).forEach((p: any) => { prodMap[p.produto_id] = p.nome; });
    }

    const enriched = rows.map((r: any) => ({
      ...r,
      _produto_nome: r.produto_id ? (prodMap[r.produto_id] || `#${r.produto_id}`) : null,
    }));

    setXItens(enriched);

    if (onTotaisChanged) {
      const vl_total   = enriched.reduce((a: number, i: any) => a + Number(i.vl_total || 0), 0);
      const vl_ipi     = enriched.reduce((a: number, i: any) => a + Number(i.vl_ipi || 0), 0);
      const vl_icms_st = enriched.reduce((a: number, i: any) => a + Number(i.vl_icms_st || 0), 0);
      onTotaisChanged({ vl_total, vl_ipi, vl_icms_st });
    }
  }, [nfeCabecalhoId, onTotaisChanged]);

  useEffect(() => {
    // Load produtos lookup
    const loadProdutos = async () => {
      const { data } = await db
        .from("produto")
        .select("produto_id, nome, referencia")
        .eq("excluido", false)
        .order("nome")
        .limit(2000);
      setXProdutos(data || []);
    };
    loadProdutos();
  }, []);

  useEffect(() => { loadItens(); }, [loadItens]);

  const set = (key: string, val: any) => setXF(prev => ({ ...prev, [key]: val }));

  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const recalcTotal = (f: Partial<INfeItem>) => {
    const qt  = parseNum(f.qt_entrada);
    const vlu = parseNum(f.vl_unit);
    const desc= parseNum(f.vl_desconto);
    return Math.round((qt * vlu - desc + Number.EPSILON) * 100) / 100;
  };

  const handlePcChange = (pcKey: string, vlKey: string, rawVal: string) => {
    const val = parseNum(rawVal);
    const base = parseNum(XF.vl_bc_st) || recalcTotal(XF);
    const vl = Math.round((val / 100 * base + Number.EPSILON) * 100) / 100;
    setXF(prev => ({ ...prev, [pcKey]: rawVal.replace(".", ","), [vlKey]: vl.toFixed(2).replace(".", ",") }));
  };

  const handleVlChange = (vlKey: string, pcKey: string, rawVal: string) => {
    const val = parseNum(rawVal);
    const base = parseNum(XF.vl_bc_st) || recalcTotal(XF);
    const pc = base > 0 ? Math.round((val / base * 100 + Number.EPSILON) * 100) / 100 : 0;
    setXF(prev => ({ ...prev, [vlKey]: rawVal.replace(".", ","), [pcKey]: pc.toFixed(2).replace(".", ",") }));
  };

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
    if (parseNum(XF.qt_entrada) <= 0) { toast.error("Quantidade deve ser maior que zero."); return; }

    const payload: any = {
      nfe_cabecalho_id: nfeCabecalhoId,
      empresa_id: empresaId,
      produto_id: XF.produto_id || null,
      nr_item: XF.nr_item || XItens.length + 1,
      cd_prod_fornec: XF.cd_prod_fornec || "",
      nm_produto: (XF.nm_produto || "").toUpperCase(),
      ncm: XF.ncm || "", cfop: XF.cfop || "",
      unidade: (XF.unidade || "").toUpperCase(),
      gtin: XF.gtin || "",
      qt_entrada: parseNum(XF.qt_entrada),
      vl_unit: parseNum(XF.vl_unit),
      vl_desconto: parseNum(XF.vl_desconto),
      vl_total: recalcTotal(XF),
      vl_ipi: parseNum(XF.vl_ipi), pc_ipi: parseNum(XF.pc_ipi),
      vl_icms_st: parseNum(XF.vl_icms_st), pc_icms_st: parseNum(XF.pc_icms_st),
      vl_pis: parseNum(XF.vl_pis), pc_pis: parseNum(XF.pc_pis),
      vl_cofins: parseNum(XF.vl_cofins), pc_cofins: parseNum(XF.pc_cofins),
      vl_fcp_st: parseNum(XF.vl_fcp_st), pc_fcp_st: parseNum(XF.pc_fcp_st),
      pc_icms: parseNum(XF.pc_icms),
      cst_icms: XF.cst_icms || "", cst_ipi: XF.cst_ipi || "",
      cst_pis: XF.cst_pis || "", cst_cofins: XF.cst_cofins || "",
      pc_mva: parseNum(XF.pc_mva),
      vl_bc_st: parseNum(XF.vl_bc_st),
    };

    if (XMode === "edit" && XCurrentIdx >= 0) {
      const { error } = await db.from("nfe_item")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Item atualizado.");
    } else {
      const { error } = await db.from("nfe_item").insert(payload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Item incluído.");
    }
    setXMode("view");
    setXCurrentIdx(-1);
    await loadItens();
  };

  const handleExcluir = async () => {
    if (XCurrentIdx < 0) return;
    if (!confirm("Excluir este item?")) return;
    await db.from("nfe_item")
      .update({ excluido: true, updated_at: new Date().toISOString() })
      .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
    toast.success("Item excluído.");
    setXCurrentIdx(-1);
    await loadItens();
  };

  const isEditing = XMode === "edit" || XMode === "insert";
  const fmtInput = (v: any) => {
    if (v === 0 || v === "0") return "";
    return String(v).replace(".", ",");
  };

  const inputCls = "w-full border border-border rounded px-2 py-1 text-sm bg-card focus:ring-1 focus:ring-ring outline-none";
  const readCls  = "w-full border border-border rounded px-2 py-1 text-sm bg-secondary";

  return (
    <div className="space-y-3">
      {/* Toolbar itens */}
      {podeEditar && (
        <div className="flex gap-2 flex-wrap">
          {!isEditing && (
            <>
              <button
                type="button"
                onClick={() => { setXMode("insert"); setXF(emptyItem()); setXCurrentIdx(-1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" /> Incluir
              </button>
              <button
                type="button"
                disabled={XCurrentIdx < 0}
                onClick={() => {
                  const r = XItens[XCurrentIdx];
                  setXMode("edit");
                  setXF({ ...r, produto_id: r.produto_id || undefined });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-accent disabled:opacity-40"
              >
                <Pencil className="w-4 h-4" /> Editar
              </button>
              <button
                type="button"
                disabled={XCurrentIdx < 0}
                onClick={handleExcluir}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-destructive text-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleSalvar}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Salvar Item
              </button>
              <button
                type="button"
                onClick={() => { setXMode("view"); setXCurrentIdx(-1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-accent"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {/* Formulário de item (quando em edição) */}
      {isEditing && (
        <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-1">
              <label className="text-xs text-muted-foreground">Item</label>
              <input type="number" value={XF.nr_item || ""} onChange={e => set("nr_item", parseInt(e.target.value) || 0)} className={inputCls + " text-right"} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Cód. Fornecedor</label>
              <input value={XF.cd_prod_fornec || ""} onChange={e => set("cd_prod_fornec", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="col-span-5">
              <label className="text-xs text-muted-foreground">Descrição NF</label>
              <input value={XF.nm_produto || ""} onChange={e => set("nm_produto", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Link className="w-3 h-3" /> Produto Cadastrado
              </label>
              <select
                value={XF.produto_id ?? ""}
                onChange={e => set("produto_id", e.target.value ? parseInt(e.target.value) : undefined)}
                className={inputCls}
              >
                <option value="">— Não vinculado —</option>
                {XProdutos.map(p => (
                  <option key={p.produto_id} value={p.produto_id}>{p.produto_id} — {p.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">NCM</label>
              <input value={XF.ncm || ""} onChange={e => set("ncm", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-muted-foreground">CFOP</label>
              <input value={XF.cfop || ""} onChange={e => set("cfop", e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-muted-foreground">Un.</label>
              <input value={XF.unidade || ""} onChange={e => set("unidade", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Quantidade</label>
              <input type="text" value={fmtInput(XF.qt_entrada || 0)} onBlur={() => handleBlur("qt_entrada")} onChange={e => set("qt_entrada", e.target.value)} className={inputCls + " text-right"} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Unit.</label>
              <input type="text" value={fmtInput(XF.vl_unit || 0)} onBlur={() => handleBlur("vl_unit")} onChange={e => set("vl_unit", e.target.value)} className={inputCls + " text-right"} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Desconto</label>
              <input type="text" value={fmtInput(XF.vl_desconto || 0)} onBlur={() => handleBlur("vl_desconto")} onChange={e => set("vl_desconto", e.target.value)} className={inputCls + " text-right"} />
            </div>


            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Total</label>
              <input readOnly value={fmt2(recalcTotal(XF))} className={readCls + " text-right"} />
            </div>
          </div>

          {/* Impostos */}
          <div className="border-t border-border pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Tributações</p>
            <div className="grid grid-cols-12 gap-2">
              {[
                { label: "CST ICMS", key: "cst_icms", span: 2, type: "text" },
                { label: "% ICMS", key: "pc_icms", span: 1, type: "number" },
                { label: "% ICMS-ST", key: "pc_icms_st", span: 1, type: "number", linked: "vl_icms_st" },
                { label: "Vlr. ICMS-ST", key: "vl_icms_st", span: 2, type: "number", linked: "pc_icms_st" },
                { label: "CST IPI", key: "cst_ipi", span: 2, type: "text" },
                { label: "% IPI", key: "pc_ipi", span: 1, type: "number", linked: "vl_ipi" },
                { label: "Vlr. IPI", key: "vl_ipi", span: 2, type: "number", linked: "pc_ipi" },
                { label: "% MVA", key: "pc_mva", span: 1, type: "number" },
              ].map(f => (
                <div key={f.key} className={`col-span-${f.span}`}>
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <input
                    type="text"
                    value={f.type === "number" ? fmtInput((XF as any)[f.key] || 0) : ((XF as any)[f.key] || "")}
                    onBlur={() => f.type === "number" && handleBlur(f.key)}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                      if (f.linked) {
                        if (f.key.startsWith("pc_")) handlePcChange(f.key, f.linked, raw);
                        else handleVlChange(f.key, f.linked, raw);
                      } else {
                        set(f.key, f.type === "number" ? raw : e.target.value);
                      }
                    }}
                    className={inputCls + (f.type === "number" ? " text-right" : "")}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-2 mt-2">
              {[
                { label: "CST PIS", key: "cst_pis", span: 2, type: "text" },
                { label: "% PIS", key: "pc_pis", span: 1, type: "number", linked: "vl_pis" },
                { label: "Vlr. PIS", key: "vl_pis", span: 2, type: "number", linked: "pc_pis" },
                { label: "CST COFINS", key: "cst_cofins", span: 2, type: "text" },
                { label: "% COFINS", key: "pc_cofins", span: 1, type: "number", linked: "vl_cofins" },
                { label: "Vlr. COFINS", key: "vl_cofins", span: 2, type: "number", linked: "pc_cofins" },
                { label: "% FCP-ST", key: "pc_fcp_st", span: 1, type: "number", linked: "vl_fcp_st" },
                { label: "Vlr. FCP-ST", key: "vl_fcp_st", span: 1, type: "number", linked: "pc_fcp_st" },
              ].map(f => (
                <div key={f.key} className={`col-span-${f.span}`}>
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <input
                    type="text"
                    value={f.type === "number" ? fmtInput((XF as any)[f.key] || 0) : ((XF as any)[f.key] || "")}
                    onBlur={() => f.type === "number" && handleBlur(f.key)}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, "").replace(",", ".");
                      if (f.linked) {
                        if (f.key.startsWith("pc_")) handlePcChange(f.key, f.linked, raw);
                        else handleVlChange(f.key, f.linked, raw);
                      } else {
                        set(f.key, f.type === "number" ? raw : e.target.value);
                      }
                    }}
                    className={inputCls + (f.type === "number" ? " text-right" : "")}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid de itens */}
      <DataGrid
        columns={COLS}
        data={XItens}
        maxHeight="340px"
        exportTitle="Itens da NF-e"
        showRecordCount
        onRowClick={(_, idx) => setXCurrentIdx(idx)}
      />

      {/* Totais */}
      {XItens.length > 0 && (
        <div className="border border-border rounded p-3 bg-card">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Subtotal Produtos", value: XItens.reduce((a, i) => a + Number(i.vl_total || 0), 0) },
              { label: "Total IPI",         value: XItens.reduce((a, i) => a + Number(i.vl_ipi || 0), 0) },
              { label: "Total ICMS-ST",     value: XItens.reduce((a, i) => a + Number(i.vl_icms_st || 0), 0) },
              { label: "Total PIS+COFINS",  value: XItens.reduce((a, i) => a + Number((i.vl_pis || 0) + (i.vl_cofins || 0)), 0) },
            ].map(c => (
              <div key={c.label} className="flex flex-col border border-border rounded px-3 py-2 bg-secondary/40">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</span>
                <span className="text-base font-semibold text-right tabular-nums">{fmt2(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NfeItensTab;
