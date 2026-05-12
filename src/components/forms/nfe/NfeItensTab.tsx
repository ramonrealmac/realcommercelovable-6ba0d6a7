import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Link } from "lucide-react";
import type { INfeItem } from "./types";

const db = supabase;
type XFieldValue = string | number | null | undefined;
type XFormItem = Partial<INfeItem> & Record<string, XFieldValue>;
type XItemRow = XFormItem & { nfe_item_id?: number; produto_id?: number | null; _produto_nome?: string | null };
type XPayload = Record<string, string | number | null>;
type XProdutoOption = { produto_id: number; nome: string; referencia?: string };

const parseNum = (XValue: unknown) => {
  if (XValue === undefined || XValue === null || XValue === "") return 0;
  if (typeof XValue === "number") return XValue;
  const XNormalized = String(XValue).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const XParsed = parseFloat(XNormalized);
  return isNaN(XParsed) ? 0 : XParsed;
};

const fmt = (XValue: unknown, XDecimals: number) => Number(parseNum(XValue) || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: XDecimals,
  maximumFractionDigits: XDecimals,
});
const fmt2 = (XValue: unknown) => fmt(XValue, 2);
const fmt4 = (XValue: unknown) => fmt(XValue, 4);

interface NfeItensTabProps {
  nfeCabecalhoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  onTotaisChanged?: (totais: { vl_total: number; vl_ipi: number; vl_icms_st: number }) => void;
}

const COLS: IGridColumn[] = [
  { key: "nr_item",       label: "Item",        width: "60px",   align: "right" },
  { key: "cd_prod_fornec",label: "Cód. Forn.",  width: "100px" },
  { key: "_produto",      label: "Produto",     width: "2fr",    render: (r) => r._produto_nome || <span className="text-destructive italic text-xs">sem vínculo</span> },
  { key: "nm_produto",    label: "Desc. NF",    width: "2fr" },
  { key: "ncm",           label: "NCM",         width: "90px" },
  { key: "cest",          label: "CEST",        width: "90px" },
  { key: "cfop",          label: "CFOP",        width: "70px" },
  { key: "unidade",       label: "Un.",         width: "60px",   align: "center" },
  { key: "qt_entrada",    label: "Qtd.",        width: "100px",  align: "right", render: (r) => fmt4(r.qt_entrada) },
  { key: "vl_unit",       label: "Vlr. Unit.",  width: "110px",  align: "right", render: (r) => fmt2(r.vl_unit) },
  { key: "vl_desconto",   label: "Desc.",       width: "90px",   align: "right", render: (r) => fmt2(r.vl_desconto) },
  { key: "vl_ipi",        label: "IPI",         width: "90px",   align: "right", render: (r) => fmt2(r.vl_ipi) },
  { key: "vl_icms_st",    label: "ICMS-ST",     width: "90px",   align: "right", render: (r) => fmt2(r.vl_icms_st) },
  { key: "vl_total",      label: "Total",       width: "110px",  align: "right", render: (r) => fmt2(r.vl_total) },
];

const XPercentKeys = new Set([
  "pc_ipi", "pc_icms", "pc_icms_st", "pc_pis", "pc_cofins", "pc_fcp_st", "pc_ibs", "pc_cbs", "pc_is",
  "pc_mva", "pc_cred_sn", "pc_fcp", "pc_red_bc", "pc_red_bc_st",
]);
const XQuantityKeys = new Set(["qt_entrada", "qt_tributavel"]);
const XIntKeys = new Set(["nr_item", "origem", "mod_bc", "mod_bc_st"]);
const XValueKeys = new Set([
  "vl_unit", "vl_unit_tributavel", "vl_desconto", "vl_total", "vl_ipi", "vl_icms_st", "vl_pis", "vl_cofins",
  "vl_fcp_st", "vl_ibs", "vl_cbs", "vl_is", "vl_bc", "vl_bc_st", "vl_bc_ipi", "vl_bc_pis", "vl_bc_cofins",
  "vl_cred_sn", "vl_fcp", "vl_frete", "vl_icms", "vl_icms_deson", "vl_outro", "vl_seguro",
]);
const XNumericKeys = new Set([...XPercentKeys, ...XQuantityKeys, ...XValueKeys]);

const XTextKeys = [
  "cd_prod_fornec", "nm_produto", "ncm", "cfop", "unidade", "gtin", "csosn", "cest", "c_enq",
  "cst_icms", "cst_ipi", "cst_pis", "cst_cofins", "cst_ibs", "cst_cbs", "cst_is",
];

const decimalsFor = (XKey: string) => {
  if (XPercentKeys.has(XKey)) return 4;
  if (XQuantityKeys.has(XKey)) return 4;
  if (XIntKeys.has(XKey)) return 0;
  return 2;
};

const fmtInput = (XValue: any, XKey: string) => {
  if (XValue === undefined || XValue === null || XValue === "") return "";
  if (XIntKeys.has(XKey)) return String(parseInt(String(XValue), 10) || 0);
  return parseNum(XValue).toFixed(decimalsFor(XKey)).replace(".", ",");
};

const onlyDigits = (XValue: string, XMax?: number) => {
  const XDigits = XValue.replace(/\D/g, "");
  return XMax ? XDigits.slice(0, XMax) : XDigits;
};

const emptyItem = (): Partial<INfeItem> => ({
  nr_item: 0,
  cd_prod_fornec: "",
  nm_produto: "",
  ncm: "",
  cfop: "",
  unidade: "",
  gtin: "",
  origem: 0,
  csosn: "",
  cest: "",
  c_enq: "",
  qt_entrada: 0,
  qt_tributavel: 0,
  vl_unit: 0,
  vl_unit_tributavel: 0,
  vl_desconto: 0,
  vl_frete: 0,
  vl_seguro: 0,
  vl_outro: 0,
  vl_total: 0,
  mod_bc: 0,
  vl_bc: 0,
  pc_red_bc: 0,
  vl_icms: 0,
  pc_fcp: 0,
  vl_fcp: 0,
  vl_icms_deson: 0,
  mod_bc_st: 0,
  vl_ipi: 0,
  vl_icms_st: 0,
  vl_pis: 0,
  vl_cofins: 0,
  vl_fcp_st: 0,
  vl_ibs: 0,
  vl_cbs: 0,
  vl_is: 0,
  vl_cred_sn: 0,
  pc_ipi: 0,
  pc_icms: 0,
  pc_icms_st: 0,
  pc_pis: 0,
  pc_cofins: 0,
  pc_fcp_st: 0,
  pc_ibs: 0,
  pc_cbs: 0,
  pc_is: 0,
  pc_mva: 0,
  pc_cred_sn: 0,
  pc_red_bc_st: 0,
  cst_icms: "",
  cst_ipi: "",
  cst_pis: "",
  cst_cofins: "",
  cst_ibs: "",
  cst_cbs: "",
  cst_is: "",
  vl_bc_st: 0,
  vl_bc_ipi: 0,
  vl_bc_pis: 0,
  vl_bc_cofins: 0,
  produto_id: undefined,
});

const formatItemForEdit = (XItem: Partial<INfeItem>) => {
  const XFormatted: any = { ...XItem };
  [...XNumericKeys, ...XIntKeys].forEach((XKey) => {
    if (XFormatted[XKey] !== undefined && XFormatted[XKey] !== null) XFormatted[XKey] = fmtInput(XFormatted[XKey], XKey);
  });
  return XFormatted as Partial<INfeItem>;
};

const NfeItensTab: React.FC<NfeItensTabProps> = ({
  nfeCabecalhoId,
  empresaId,
  podeEditar,
  onTotaisChanged,
}) => {
  const [XItens, setXItens] = useState<any[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<Partial<INfeItem>>(formatItemForEdit(emptyItem()));
  const [XProdutos, setXProdutos] = useState<{ produto_id: number; nome: string; referencia?: string }[]>([]);

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
      const { data } = await db.from("produto").select("produto_id, nome, referencia").eq("excluido", false).order("nome").limit(500);
      setXProdutos(data || []);
    };
    loadProdutos();
  }, []);

  useEffect(() => { loadItens(); }, [loadItens]);

  const set = (key: string, val: any) => setXF(prev => ({ ...prev, [key]: val }));
  const recalcTotal = (f: Partial<INfeItem>) => {
    const qt = parseNum(f.qt_entrada);
    const vlu = parseNum(f.vl_unit);
    const desc = parseNum(f.vl_desconto);
    return Math.round((qt * vlu - desc + Number.EPSILON) * 100) / 100;
  };

  const handleBlur = (key: string) => {
    const current = (XF as any)[key];
    if (current === undefined || current === null || current === "") return;
    set(key, fmtInput(current, key));
  };

  const handleNovo = () => {
    setXMode("insert");
    setXF(formatItemForEdit({ ...emptyItem(), nr_item: XItens.length + 1 }));
    setXCurrentIdx(null);
  };

  const handleEditar = () => {
    if (XCurrentIdx === null) return;
    setXMode("edit");
    setXF(formatItemForEdit({ ...XItens[XCurrentIdx], produto_id: XItens[XCurrentIdx].produto_id || undefined }));
  };

  const buildPayload = () => {
    const XPayload: any = {
      nfe_cabecalho_id: nfeCabecalhoId,
      empresa_id: empresaId,
      produto_id: XF.produto_id ? Number(XF.produto_id) : null,
      nr_item: parseInt(String(XF.nr_item || XItens.length + 1), 10) || XItens.length + 1,
    };

    XTextKeys.forEach((XKey) => {
      const XRaw = String((XF as any)[XKey] ?? "").trim();
      if (["ncm", "cfop", "cest", "gtin", "csosn", "c_enq"].includes(XKey)) {
        XPayload[XKey] = onlyDigits(XRaw, XKey === "ncm" ? 8 : XKey === "cfop" ? 4 : XKey === "cest" ? 7 : undefined);
      } else {
        XPayload[XKey] = XRaw.toUpperCase();
      }
    });

    XIntKeys.forEach((XKey) => {
      if (XKey !== "nr_item") XPayload[XKey] = parseInt(String((XF as any)[XKey] || "0"), 10) || 0;
    });

    XNumericKeys.forEach((XKey) => {
      XPayload[XKey] = parseNum((XF as any)[XKey]);
    });

    if (!String(XF.vl_total ?? "").trim() || parseNum(XF.vl_total) === 0) XPayload.vl_total = recalcTotal(XF);
    return XPayload;
  };

  const handleSalvar = async () => {
    if (!nfeCabecalhoId) return;
    if (!XF.nm_produto?.trim()) { toast.error("Informe a descrição do produto."); return; }

    const payload = buildPayload();
    if (XMode === "edit" && XCurrentIdx !== null) {
      const { error } = await db.from("fiscal_nfe_item")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
      if (error) { toast.error("Erro ao atualizar item: " + error.message); return; }
      toast.success("Item atualizado.");
    } else {
      const { error } = await db.from("fiscal_nfe_item").insert(payload);
      if (error) { toast.error("Erro ao incluir item: " + error.message); return; }
      toast.success("Item incluído.");
    }
    setXMode("view");
    setXCurrentIdx(null);
    await loadItens();
  };

  const handleExcluir = async () => {
    if (XCurrentIdx === null) return;
    if (!confirm("Excluir este item?")) return;
    const { error } = await db.from("fiscal_nfe_item")
      .update({ excluido: true, updated_at: new Date().toISOString() })
      .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
    if (error) { toast.error("Erro ao excluir item: " + error.message); return; }
    toast.success("Item excluído.");
    setXCurrentIdx(null);
    await loadItens();
  };

  const isEditing = XMode === "edit" || XMode === "insert";
  const inputCls = "w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:opacity-70";
  const readCls = "w-full border border-border rounded px-2 py-1.5 text-sm bg-secondary text-right";

  const Txt = ({ k, label, span = 2, digits, max, upper = true, right = false }: any) => (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={(XF as any)[k] ?? ""}
        onChange={e => {
          const XVal = digits ? onlyDigits(e.target.value, max) : (upper ? e.target.value.toUpperCase() : e.target.value);
          set(k, XVal);
        }}
        onFocus={e => e.target.select()}
        className={`${inputCls} ${right ? "text-right" : ""}`}
        inputMode={digits ? "numeric" : "text"}
        maxLength={max}
      />
    </div>
  );

  const Num = ({ k, label, span = 2, readOnly = false }: any) => (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={(XF as any)[k] ?? ""}
        onBlur={() => handleBlur(k)}
        onFocus={e => e.target.select()}
        onChange={e => !readOnly && set(k, e.target.value)}
        readOnly={readOnly}
        className={`${readOnly ? readCls : inputCls} text-right`}
        inputMode="decimal"
      />
    </div>
  );

  const Section = ({ title, children }: any) => (
    <fieldset className="border border-border rounded p-3">
      <legend className="text-xs font-medium text-muted-foreground px-2">{title}</legend>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </fieldset>
  );

  return (
    <div className="space-y-4">
      {isEditing && (
        <div className="p-3 bg-card rounded border border-border space-y-3 max-h-[70vh] overflow-y-auto">
          <Section title="Identificação">
            <Num k="nr_item" label="Item" span={1} />
            <Txt k="cd_prod_fornec" label="Cód. Forn." span={2} />
            <Txt k="gtin" label="GTIN" span={2} digits max={14} />
            <Txt k="ncm" label="NCM" span={2} digits max={8} />
            <Txt k="cest" label="CEST" span={1} digits max={7} />
            <Txt k="cfop" label="CFOP" span={1} digits max={4} />
            <Txt k="unidade" label="Un." span={1} />
            <Txt k="c_enq" label="cEnq" span={2} digits max={3} />
            <div className="col-span-8">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição NF</label>
              <input value={XF.nm_produto || ""} onChange={e => set("nm_produto", e.target.value.toUpperCase())} onFocus={e => e.target.select()} className={inputCls} />
            </div>
            <div className="col-span-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1"><Link size={12}/> Produto Vinculado</label>
              <select value={XF.produto_id ?? ""} onChange={e => set("produto_id", e.target.value ? parseInt(e.target.value) : undefined)} className={inputCls}>
                <option value="">— Selecione —</option>
                {XProdutos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.produto_id} — {p.nome}</option>)}
              </select>
            </div>
          </Section>

          <Section title="Quantidades e Valores">
            <Num k="qt_entrada" label="Quantidade" span={2} />
            <Num k="qt_tributavel" label="Qtd. Tributável" span={2} />
            <Num k="vl_unit" label="Vlr. Unitário" span={2} />
            <Num k="vl_unit_tributavel" label="Vlr. Unit. Trib." span={2} />
            <Num k="vl_desconto" label="Desconto" span={2} />
            <Num k="vl_frete" label="Frete" span={2} />
            <Num k="vl_seguro" label="Seguro" span={2} />
            <Num k="vl_outro" label="Outras Desp." span={2} />
            <Num k="vl_total" label="Total" span={2} />
          </Section>

          <Section title="ICMS">
            <Num k="origem" label="Origem" span={1} />
            <Txt k="cst_icms" label="CST" span={1} digits max={3} />
            <Txt k="csosn" label="CSOSN" span={1} digits max={4} />
            <Num k="mod_bc" label="Mod. BC" span={1} />
            <Num k="vl_bc" label="BC ICMS" span={2} />
            <Num k="pc_red_bc" label="Red. BC %" span={2} />
            <Num k="pc_icms" label="ICMS %" span={2} />
            <Num k="vl_icms" label="Vlr. ICMS" span={2} />
            <Num k="pc_fcp" label="FCP %" span={2} />
            <Num k="vl_fcp" label="Vlr. FCP" span={2} />
            <Num k="vl_icms_deson" label="ICMS Deson." span={2} />
          </Section>

          <Section title="ICMS-ST / FCP-ST / Crédito SN">
            <Num k="mod_bc_st" label="Mod. BC ST" span={1} />
            <Num k="pc_mva" label="MVA %" span={2} />
            <Num k="vl_bc_st" label="BC ST" span={2} />
            <Num k="pc_red_bc_st" label="Red. BC ST %" span={2} />
            <Num k="pc_icms_st" label="ICMS-ST %" span={2} />
            <Num k="vl_icms_st" label="Vlr. ICMS-ST" span={2} />
            <Num k="pc_fcp_st" label="FCP-ST %" span={2} />
            <Num k="vl_fcp_st" label="Vlr. FCP-ST" span={2} />
            <Num k="pc_cred_sn" label="Créd. SN %" span={2} />
            <Num k="vl_cred_sn" label="Vlr. Créd. SN" span={2} />
          </Section>

          <Section title="IPI">
            <Txt k="cst_ipi" label="CST IPI" span={2} digits max={2} />
            <Num k="vl_bc_ipi" label="BC IPI" span={2} />
            <Num k="pc_ipi" label="IPI %" span={2} />
            <Num k="vl_ipi" label="Vlr. IPI" span={2} />
          </Section>

          <Section title="PIS / COFINS">
            <Txt k="cst_pis" label="CST PIS" span={2} digits max={2} />
            <Num k="vl_bc_pis" label="BC PIS" span={2} />
            <Num k="pc_pis" label="PIS %" span={2} />
            <Num k="vl_pis" label="Vlr. PIS" span={2} />
            <Txt k="cst_cofins" label="CST COFINS" span={2} digits max={2} />
            <Num k="vl_bc_cofins" label="BC COFINS" span={2} />
            <Num k="pc_cofins" label="COFINS %" span={2} />
            <Num k="vl_cofins" label="Vlr. COFINS" span={2} />
          </Section>

          <Section title="IBS / CBS / IS (Reforma)">
            <Txt k="cst_ibs" label="CST IBS" span={2} digits max={3} />
            <Num k="pc_ibs" label="IBS %" span={2} />
            <Num k="vl_ibs" label="Vlr. IBS" span={2} />
            <Txt k="cst_cbs" label="CST CBS" span={2} digits max={3} />
            <Num k="pc_cbs" label="CBS %" span={2} />
            <Num k="vl_cbs" label="Vlr. CBS" span={2} />
            <Txt k="cst_is" label="CST IS" span={2} digits max={3} />
            <Num k="pc_is" label="IS %" span={2} />
            <Num k="vl_is" label="Vlr. IS" span={2} />
          </Section>

          <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-card border-t border-border">
            <button onClick={handleSalvar} className="px-4 py-2 text-xs font-bold rounded border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
              Salvar
            </button>
            <button onClick={() => { setXMode("view"); setXCurrentIdx(null); }} className="px-4 py-2 text-xs font-bold rounded border border-border bg-card text-destructive hover:bg-accent transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <DataGrid
        columns={COLS}
        data={XItens}
        maxHeight="340px"
        exportTitle="Itens da NF-e"
        showRecordCount={false}
        selectedIdx={XCurrentIdx}
        onRowClick={(_, idx) => setXCurrentIdx(idx)}
        onRowDoubleClick={(_, idx) => { setXCurrentIdx(idx); if (podeEditar && !isEditing) { setXMode("edit"); setXF(formatItemForEdit({ ...XItens[idx], produto_id: XItens[idx].produto_id || undefined })); } }}
        toolbarLeft={podeEditar ? (
          <GridActionToolbar
            actions={[
              gridActions.incluir(handleNovo, isEditing),
              gridActions.alterar(handleEditar, XCurrentIdx === null || isEditing),
              null,
              gridActions.excluir(handleExcluir, XCurrentIdx === null || isEditing),
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
