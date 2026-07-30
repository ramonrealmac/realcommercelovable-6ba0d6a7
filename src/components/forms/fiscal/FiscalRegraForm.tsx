import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";
import DataGrid from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const db = supabase as any;

// ── Constantes ────────────────────────────────────────────────────────────────
const UF_LIST = ["ZZ","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const REGIME_MAP: Record<string, string> = { "*": "Todos", S: "Simples Nacional", L: "Lucro Presumido", N: "Lucro Real" };
const MOD_BC: Record<number, string> = { 0: "0-MVA", 1: "1-Pauta", 2: "2-Preço Max", 3: "3-Valor Op." };
const MOD_BC_ST: Record<number, string> = { 0: "0-Preço Tab", 1: "1-Pauta", 2: "2-Preço Max", 3: "3-Valor Op.", 4: "4-MVA" };

const TABS_IMPOSTO = [
  { key: "CFOP", label: "CFOP" },
  { key: "ICMS", label: "ICMS" },
  { key: "IPI",  label: "IPI" },
  { key: "PIS",  label: "PIS" },
  { key: "COFINS", label: "COFINS" },
  { key: "CBSIBS", label: "IBS/CBS" },
];

// ── Helpers de renderização segura ───────────────────────────────────────────
const s = (v: any) => (v === null || v === undefined ? "" : String(v));
const toNum = (v: any, dec = 2) => Number(v || 0).toFixed(dec);
const boolLabel = (v: any) => (v === true ? "Sim" : v === false ? "Não" : "Todos");

// ── Colunas grid principal ────────────────────────────────────────────────────
const GRID_COLS: IGridColumn[] = [
  { key: "fiscal_regra_id", label: "Cód.", width: "80px", align: "right", render: r => s(r.fiscal_regra_id) },
  { key: "descricao", label: "Descrição", width: "2fr", render: r => s(r.descricao) },
  { key: "regime_trib", label: "Regime", width: "160px", render: r => REGIME_MAP[r.regime_trib] || s(r.regime_trib) || "Todos" },
  { key: "tp_operacao_id", label: "Tipo Op.", width: "120px", align: "right", render: r => s(r.tp_operacao_id) },
];

// ── Colunas sub-grids ────────────────────────────────────────────────────────
const COLS_CFOP: IGridColumn[] = [
  { key: "cfop_id",            label: "CFOP",        width: "100px", align: "right", render: r => s(r.cfop?.cd_cfop ?? r.cfop_id) },
  { key: "cfop_desc",          label: "Descrição",   width: "1.2fr", render: r => s(r.cfop?.descricao) },
  { key: "uf_destino",         label: "UF Dest.",    width: "80px",  align: "center", render: r => s(r.uf_destino) },
  { key: "ncm_filtro",         label: "NCM",         width: "110px", align: "center", render: r => s(r.ncm_filtro) },
  { key: "grupo_nome",         label: "Gr. Trib.",   width: "200px", render: r => s(r.fiscal_grupo_produto?.nome) },
  { key: "cliente_contribuinte", label: "Contribuinte", width: "110px", align: "center", render: r => boolLabel(r.cliente_contribuinte) },
];

const COLS_ITEM: IGridColumn[] = [
  { key: "cst_csosn",   label: "CST/CSOSN", width: "100px", align: "center", render: r => s(r.cst_csosn) },
  { key: "aliquota",    label: "Alíq. %",   width: "90px",  align: "right", render: r => toNum(r.aliquota) },
  { key: "base_reducao",label: "Red. BC %", width: "90px",  align: "right", render: r => toNum(r.base_reducao) },
  { key: "uf_destino",  label: "UF Dest.",  width: "80px",  align: "center", render: r => s(r.uf_destino) },
  { key: "ncm_filtro",  label: "NCM",       width: "110px", align: "center", render: r => s(r.ncm_filtro) },
  { key: "grupo_nome",  label: "Gr. Trib.", width: "130px", render: r => s(r.fiscal_grupo_produto?.nome) },
];

const COLS_IPI: IGridColumn[] = [
  { key: "cst_csosn",   label: "CST IPI",   width: "100px", align: "center", render: r => s(r.cst_csosn) },
  { key: "ipi_c_enq",   label: "cEnq",      width: "90px",  align: "center", render: r => s(r.ipi_c_enq) },
  { key: "aliquota",    label: "Alíq. %",   width: "90px",  align: "right", render: r => toNum(r.aliquota) },
  { key: "uf_destino",  label: "UF Dest.",  width: "80px",  align: "center", render: r => s(r.uf_destino) },
  { key: "ncm_filtro",  label: "NCM",       width: "110px", align: "center", render: r => s(r.ncm_filtro) },
  { key: "grupo_nome",  label: "Gr. Trib.", width: "130px", render: r => s(r.fiscal_grupo_produto?.nome) },
];

const COLS_CBSIBS: IGridColumn[] = [
  { key: "cst_csosn",    label: "CST/CSOSN", width: "100px", align: "center", render: r => s(r.cst_csosn) },
  { key: "ibs_aliquota", label: "IBS %",     width: "90px",  align: "right", render: r => toNum(r.ibs_aliquota) },
  { key: "cbs_aliquota", label: "CBS %",     width: "90px",  align: "right", render: r => toNum(r.cbs_aliquota) },
  { key: "is_aliquota",  label: "IS %",      width: "90px",  align: "right", render: r => toNum(r.is_aliquota) },
  { key: "uf_destino",   label: "UF Dest",   width: "80px",  align: "center", render: r => s(r.uf_destino) },
  { key: "ncm_filtro",   label: "NCM",       width: "110px", align: "center", render: r => s(r.ncm_filtro) },
  { key: "grupo_nome",   label: "Grupo Tributário", width: "160px", render: r => s(r.fiscal_grupo_produto?.nome) },
];


// ── Interface e Config ────────────────────────────────────────────────────────
interface IFiscalRegra {
  fiscal_regra_id: number;
  descricao: string;
  observacao: string | null;
  tp_operacao_id: number | null;
  cfop_id: number | null;
  regime_trib: string | null;
  empresa_id: number;
  excluido: boolean;
}

// ── Componentes de UI internos ────────────────────────────────────────────────
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs font-medium text-muted-foreground">{children}</label>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {children}
  </div>
);

const TextInput = ({ value, onChange, readOnly = false, type = "text", placeholder = "" }: {
  value: any; onChange?: (v: string) => void; readOnly?: boolean; type?: string; placeholder?: string;
}) => (
  <input
    type={type}
    readOnly={readOnly}
    value={value ?? ""}
    placeholder={placeholder}
    onChange={e => onChange?.(e.target.value)}
    className={`border border-border rounded px-3 py-1.5 text-sm w-full ${readOnly ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-ring outline-none"}`}
  />
);

const DecimalInput = ({ value, onChange, readOnly = false, placeholder = "0,00" }: {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  placeholder?: string;
}) => {
  const formatValue = (val: number) => {
    return Number(val || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [displayValue, setDisplayValue] = useState(formatValue(value));

  useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    const num = parseInt(digits, 10) / 100;
    onChange(num);
  };

  return (
    <input
      type="text"
      readOnly={readOnly}
      value={displayValue}
      placeholder={placeholder}
      onChange={handleChange}
      className={`border border-border rounded px-3 py-1.5 text-sm w-full text-right ${
        readOnly ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-ring outline-none"
      }`}
    />
  );
};

// Select nativo — sem portals Radix, sem crash em contextos dinâmicos
const NatSel = ({ value, onChange, options, disabled = false }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) => disabled ? (
  <TextInput value={options.find(o => o.value === value)?.label ?? value} readOnly />
) : (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="border border-border rounded px-3 py-1.5 text-sm w-full bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]"
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

const Sel = ({ value, onValueChange, options, readOnly = false, placeholder = "Selecione..." }: {
  value: string; onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  readOnly?: boolean; placeholder?: string;
}) => readOnly ? (
  <TextInput value={options.find(o => o.value === value)?.label ?? value} readOnly />
) : (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger className="h-[34px] text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent>
      {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

// ── SubGrid: CFOP e Itens de Tributo ─────────────────────────────────────────
const EMPTY_CFOP = (regraId: number, empresaId: number) => ({
  fiscal_regra_id: regraId,
  cfop_id: null,
  uf_destino: "ZZ",
  cliente_contribuinte: null,
  cliente_consumidor_final: null,
  ncm_filtro: "99999999",
  cest_filtro: "9999999",
  fiscal_grupo_produto_id: null,
  origem_produto: null,
  empresa_id: empresaId,
});

const EMPTY_ITEM = (regraId: number, tipo: string, empresaId: number) => ({
  fiscal_regra_id: regraId,
  tipo_imposto: tipo,
  uf_destino: "ZZ",
  cliente_contribuinte: null,
  cliente_consumidor_final: null,
  ncm_filtro: "99999999",
  cest_filtro: "9999999",
  fiscal_grupo_produto_id: null,
  origem_produto: null,
  cst_csosn: "",
  aliquota: 0,
  base_reducao: 0,
  motivo_desoneracao: null,
  p_cre_sn: 0,
  icms_st_aliquota: 0,
  icms_st_mva: 0,
  icms_st_base_reducao: 0,
  mod_bc: 3,
  mod_bc_st: 4,
  ipi_c_enq: "999",
  cst_pis_cofins: null,
  nat_receita_pis_cofins: null,
  ibs_aliquota: 0,
  cbs_aliquota: 0,
  is_aliquota: 0,
  empresa_id: empresaId,
});

const UF_OPTIONS = UF_LIST.map(u => ({ value: u, label: u === "ZZ" ? "ZZ (Todos)" : u }));
const BOOL_OPTIONS = [{ value: "", label: "(Todos)" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }];
const ORIGEM_OPTIONS = [{ value: "", label: "Todos" }, { value: "0", label: "0-Nacional" }, { value: "1", label: "1-Estrangeira Direta" }, { value: "2", label: "2-Estrangeira Mercado" }];

function FiltroRow({ item, isEditing, set, fiscalGrupoList }: { 
  item: any; isEditing: boolean; set: (k: string, v: any) => void; fiscalGrupoList: any[];
}) {
  const boolVal = (v: any) => (v === null || v === undefined) ? "" : String(v);
  const setBool = (k: string, v: string) => set(k, v === "" ? null : v === "true");

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 border border-border rounded-md bg-secondary/30">
      <Field label="UF Destino">
        <NatSel
          value={s(item?.uf_destino === "*" ? "ZZ" : (item?.uf_destino || "ZZ"))}
          onChange={v => set("uf_destino", v)}
          options={UF_OPTIONS}
          disabled={!isEditing}
        />
      </Field>
      <Field label="Grupo Tributário">
        <NatSel
          value={s(item?.fiscal_grupo_produto_id ?? "")}
          onChange={v => set("fiscal_grupo_produto_id", v ? Number(v) : null)}
          options={[{ value: "", label: "(Todos)" }, ...fiscalGrupoList.map(g => ({ value: String(g.fiscal_grupo_produto_id), label: s(g.nome) }))]}
          disabled={!isEditing}
        />
      </Field>
      <Field label="NCM Filtro">
        <TextInput value={item?.ncm_filtro ?? ""} placeholder="99999999" readOnly={!isEditing} onChange={v => set("ncm_filtro", v)} />
      </Field>
      <Field label="CEST Filtro">
        <TextInput value={item?.cest_filtro ?? ""} placeholder="9999999" readOnly={!isEditing} onChange={v => set("cest_filtro", v)} />
      </Field>
      <Field label="Origem">
        <NatSel
          value={s(item?.origem_produto ?? "")}
          onChange={v => set("origem_produto", v || null)}
          options={ORIGEM_OPTIONS}
          disabled={!isEditing}
        />
      </Field>
      <Field label="Contribuinte">
        <NatSel
          value={boolVal(item?.cliente_contribuinte)}
          onChange={v => setBool("cliente_contribuinte", v)}
          options={BOOL_OPTIONS}
          disabled={!isEditing}
        />
      </Field>
      <Field label="Consumidor Final">
        <NatSel
          value={boolVal(item?.cliente_consumidor_final)}
          onChange={v => setBool("cliente_consumidor_final", v)}
          options={BOOL_OPTIONS}
          disabled={!isEditing}
        />
      </Field>
    </div>
  );
}

function SubGrid({ regraId, tipo, isEditing, cfopList, empresaId, fiscalGrupoList, regimeRegra }: {
  regraId: number | null; tipo: string; isEditing: boolean; cfopList: any[]; empresaId: number; fiscalGrupoList: any[]; regimeRegra?: string | null;
}) {
  const isCfop = tipo === "CFOP";
  const table = isCfop ? "fiscal_regra_cfop" : "fiscal_regra_item";
  const pk = isCfop ? "fiscal_regra_cfop_id" : "fiscal_regra_item_id";

  const [rows, setRows] = useState<any[]>([]);
  const [icmsList, setIcmsList] = useState<any[]>([]);
  const [ipiList, setIpiList] = useState<any[]>([]);
  const [ipiEnqList, setIpiEnqList] = useState<any[]>([]);
  const [pisCofinsList, setPisCofinsList] = useState<any[]>([]);
  const [ibsCbsList, setIbsCbsList] = useState<any[]>([]);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!regraId) { 
      console.log(`[SubGrid] ${tipo} aguardando regraId...`);
      setRows([]); 
      return; 
    }
    setLoading(true);
    console.log(`[SubGrid] ${tipo} carregando para regraId: ${regraId}`);

    if (tipo === "ICMS") {
      db.from("icms").select("icms_cst_csosn, icms_descricao, icms_tipo").order("icms_cst_csosn")
        .then(({ data }: any) => setIcmsList(data || []));
    }
    if (tipo === "IPI") {
      db.from("ipi").select("ipi_cst, ipi_descricao").order("ipi_cst")
        .then(({ data }: any) => setIpiList(data || []));
      db.from("ipi_enquadramento").select("ipi_enquadramento_codigo, ipi_enquadramento_descricao").order("ipi_enquadramento_codigo")
        .then(({ data }: any) => setIpiEnqList(data || []));
    }
    if (tipo === "PIS" || tipo === "COFINS") {
      db.from("piscofins").select("piscofins_cst, piscofins_descricao").order("piscofins_cst")
        .then(({ data }: any) => setPisCofinsList(data || []));
    }
    if (tipo === "CBSIBS") {
      db.from("ibscbs").select("ibscbs_cst, ibscbs_descricao").order("ibscbs_cst")
        .then(({ data }: any) => setIbsCbsList(data || []));
    }
    const sel = isCfop ? "*, cfop(cd_cfop, descricao), fiscal_grupo_produto(nome)" : "*, fiscal_grupo_produto(nome)";
    let q = db.from(table).select(sel).eq("fiscal_regra_id", regraId);
    if (!isCfop) q = q.eq("tipo_imposto", tipo);
    const { data, error } = await q.order(pk, { ascending: true });
    setLoading(false);
    if (error) { 
      console.error(`[SubGrid] Erro ao carregar ${tipo}:`, error);
      toast.error("Erro ao carregar: " + error.message); 
      return; 
    }
    setRows(data || []);
  }, [regraId, tipo, table, isCfop, pk]);

  useEffect(() => { load(); }, [load]);

  const handleNew = () => {
    if (!regraId) { toast.warning("Salve a regra principal antes de adicionar itens."); return; }
    setEditing(isCfop ? EMPTY_CFOP(regraId, empresaId) : EMPTY_ITEM(regraId, tipo, empresaId));
    setSelIdx(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const isNew = !editing[pk];
    const payload: any = { ...editing };
    delete payload[pk];
    if (isCfop) delete payload.cfop;
    delete payload.fiscal_grupo_produto;

    // Normaliza booleanos
    for (const k of ["cliente_contribuinte", "cliente_consumidor_final"]) {
      if (payload[k] === "true") payload[k] = true;
      else if (payload[k] === "false") payload[k] = false;
      else if (payload[k] === "" || payload[k] === undefined) payload[k] = null;
    }

    const q = isNew
      ? db.from(table).insert(payload)
      : db.from(table).update(payload).eq(pk, editing[pk]);
    const { error } = await q;
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Salvo!");
    setEditing(null);
    setSelIdx(null);
    load();
  };

  const handleDelete = async () => {
    if (selIdx === null || !rows[selIdx]) return;
    if (!confirm("Excluir este item?")) return;
    const { error } = await db.from(table).delete().eq(pk, rows[selIdx][pk]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído!");
    setSelIdx(null);
    setEditing(null);
    load();
  };

  const set = (k: string, v: any) => setEditing((p: any) => ({ ...p, [k]: v }));

  const toolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(handleNew, !isEditing),
        gridActions.alterar(() => { if (selIdx !== null) setEditing({ ...rows[selIdx] }); }, !isEditing || selIdx === null || editing !== null),
        null,
        gridActions.excluir(handleDelete, !isEditing || selIdx === null || editing !== null),
        gridActions.atualizar(load),
      ]}
      count={`${rows.length} registro(s)`}
    />
  );

  return (
    <div className="space-y-3">
      {editing && isEditing && (
        <div className="border border-primary/30 rounded-lg p-4 bg-card/50 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <FiltroRow item={editing} isEditing={true} set={set} fiscalGrupoList={fiscalGrupoList} />


          {isCfop ? (
            <div className="p-3 border border-border rounded-md bg-secondary/20 flex items-end gap-3">
              <div className="flex-1">
                <Field label="CFOP *">
                  <NatSel
                    value={editing.cfop_id === null || editing.cfop_id === undefined ? "" : String(editing.cfop_id)}
                    onChange={v => set("cfop_id", v ? Number(v) : null)}
                    options={[{ value: "", label: "Selecione..." }, ...cfopList.map(c => ({ value: String(c.cfop_id), label: `${s(c.cd_cfop)} — ${s(c.descricao)}` }))]}
                  />
                </Field>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-primary text-primary-foreground px-4 py-1.5 rounded text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 h-[34px]">
                  Confirmar
                </button>
                <button onClick={() => { setEditing(null); setSelIdx(null); }} className="px-4 py-1.5 rounded text-xs font-bold border border-border bg-background hover:bg-secondary transition-all active:scale-95 h-[34px]">
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-2 md:grid-cols-4 ${tipo === "CBSIBS" ? "lg:grid-cols-8" : "lg:grid-cols-6"} gap-3 p-3 border border-border rounded-md bg-secondary/20 items-end`}>
              {tipo === "ICMS" ? (
                <Field label="CST/CSOSN *">
                  <NatSel
                    value={editing.cst_csosn ?? ""}
                    onChange={v => set("cst_csosn", v)}
                    options={[
                      { value: "", label: "Selecione..." },
                      ...(icmsList || [])
                        .filter((item: any) => {
                          if (regimeRegra === "*") return true;
                          if (regimeRegra === "S") return item.icms_tipo === "CSOSN";
                          return item.icms_tipo === "CST";
                        })
                        .map((item: any) => ({
                          value: item.icms_cst_csosn,
                          label: `${item.icms_cst_csosn} — ${item.icms_descricao}`
                        }))
                    ]}
                  />
                </Field>
              ) : tipo === "IPI" ? (
                <Field label="CST/CSOSN *">
                  <NatSel
                    value={editing.cst_csosn ?? ""}
                    onChange={v => set("cst_csosn", v)}
                    options={[
                      { value: "", label: "Selecione..." },
                      ...(ipiList || []).map((item: any) => ({
                        value: item.ipi_cst,
                        label: `${item.ipi_cst} — ${item.ipi_descricao}`
                      }))
                    ]}
                  />
                </Field>
              ) : (tipo === "PIS" || tipo === "COFINS") ? (
                <Field label="CST/CSOSN *">
                  <NatSel
                    value={editing.cst_csosn ?? ""}
                    onChange={v => set("cst_csosn", v)}
                    options={[
                      { value: "", label: "Selecione..." },
                      ...(pisCofinsList || []).map((item: any) => ({
                        value: item.piscofins_cst,
                        label: `${item.piscofins_cst} — ${item.piscofins_descricao}`
                      }))
                    ]}
                  />
                </Field>
              ) : tipo === "CBSIBS" ? (
                <Field label="CST/CSOSN *">
                  <NatSel
                    value={editing.cst_csosn ?? ""}
                    onChange={v => set("cst_csosn", v)}
                    options={[
                      { value: "", label: "Selecione..." },
                      ...(ibsCbsList || []).map((item: any) => ({
                        value: item.ibscbs_cst,
                        label: `${item.ibscbs_cst} — ${item.ibscbs_descricao}`
                      }))
                    ]}
                  />
                </Field>
              ) : (
                <Field label="CST/CSOSN"><TextInput value={editing.cst_csosn} onChange={v => set("cst_csosn", v)} /></Field>
              )}
              <Field label="Alíquota %"><DecimalInput value={editing.aliquota} onChange={v => set("aliquota", v)} /></Field>
              <Field label="Redução BC %"><DecimalInput value={editing.base_reducao} onChange={v => set("base_reducao", v)} /></Field>

              {tipo === "ICMS" && <>
                <Field label="Mod. BC">
                  <NatSel
                    value={String(editing.mod_bc ?? 3)}
                    onChange={v => set("mod_bc", Number(v))}
                    options={Object.entries(MOD_BC).map(([k, l]) => ({ value: k, label: l }))}
                  />
                </Field>
                <Field label="MVA %"><DecimalInput value={editing.icms_st_mva} onChange={v => set("icms_st_mva", v)} /></Field>
                <Field label="Alíq. ST %"><DecimalInput value={editing.icms_st_aliquota} onChange={v => set("icms_st_aliquota", v)} /></Field>
                <Field label="Mod. BC ST">
                  <NatSel
                    value={String(editing.mod_bc_st ?? 4)}
                    onChange={v => set("mod_bc_st", Number(v))}
                    options={Object.entries(MOD_BC_ST).map(([k, l]) => ({ value: k, label: l }))}
                  />
                </Field>
                <Field label="Red. BC ST %"><DecimalInput value={editing.icms_st_base_reducao} onChange={v => set("icms_st_base_reducao", v)} /></Field>
                <Field label="Motivo Deson."><TextInput type="number" value={editing.motivo_desoneracao ?? ""} onChange={v => set("motivo_desoneracao", v ? Number(v) : null)} /></Field>
                <Field label="Crédito SN %"><DecimalInput value={editing.p_cre_sn} onChange={v => set("p_cre_sn", v)} /></Field>
              </>}

              {(tipo === "PIS" || tipo === "COFINS") && <>
                <Field label="Nat. Receita"><TextInput value={editing.nat_receita_pis_cofins ?? ""} onChange={v => set("nat_receita_pis_cofins", v)} /></Field>
              </>}

              {tipo === "IPI" && (
                <Field label="C. Enquadramento *">
                  <NatSel
                    value={editing.ipi_c_enq ?? "999"}
                    onChange={v => set("ipi_c_enq", v)}
                    options={[
                      { value: "", label: "Selecione..." },
                      ...(ipiEnqList || []).map((item: any) => ({
                        value: item.ipi_enquadramento_codigo,
                        label: `${item.ipi_enquadramento_codigo} — ${item.ipi_enquadramento_descricao}`
                      }))
                    ]}
                  />
                </Field>
              )}

              {tipo === "CBSIBS" && <>
                <Field label="IBS %"><DecimalInput value={editing.ibs_aliquota} onChange={v => set("ibs_aliquota", v)} /></Field>
                <Field label="CBS %"><DecimalInput value={editing.cbs_aliquota} onChange={v => set("cbs_aliquota", v)} /></Field>
                <Field label="IS %"><DecimalInput value={editing.is_aliquota} onChange={v => set("is_aliquota", v)} /></Field>
              </>}

              <div className={`col-span-2 ${tipo === "CBSIBS" ? "lg:col-span-2" : "lg:col-span-1"} flex gap-2 pt-1`}>
                <button onClick={handleSave} className="flex-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 h-[34px]">
                  Confirmar
                </button>
                <button onClick={() => { setEditing(null); setSelIdx(null); }} className="flex-1 px-3 py-1.5 rounded text-xs font-bold border border-border bg-background hover:bg-secondary transition-all active:scale-95 h-[34px]">
                  Sair
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-3 text-xs italic text-muted-foreground animate-pulse">Carregando dados...</div>
      ) : (
        <DataGrid
          columns={isCfop ? COLS_CFOP : tipo === "IPI" ? COLS_IPI : tipo === "CBSIBS" ? COLS_CBSIBS : COLS_ITEM}
          data={rows}
          maxHeight="320px"
          selectedIdx={selIdx}
          toolbarLeft={toolbar}
          onRowClick={(row, idx) => {
            if (!isEditing) return;
            setSelIdx(idx);
          }}
          onRowDoubleClick={(row, idx) => {
            if (!isEditing) return;
            setSelIdx(idx);
            setEditing({ ...row });
          }}
        />
      )}
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
const FiscalRegraForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}` : String(XEmpresaMatrizId);

  const currentEmpresa = useMemo(() => {
    return (XEmpresas || []).find(e => e.empresa_id === XEmpresaId) || null;
  }, [XEmpresaId, XEmpresas]);

  const [cfopList, setCfopList] = useState<any[]>([]);
  const [tpOpList, setTpOpList] = useState<any[]>([]);
  const [fiscalGrupoList, setFiscalGrupoList] = useState<any[]>([]);
  const [subTab, setSubTab] = useState("principal");

  const config = useMemo<ICrudConfig<IFiscalRegra>>(() => ({
    XTableName: "fiscal_regra",
    XPrimaryKey: "fiscal_regra_id",
    XTitle: "Regras Fiscais",
    XOrderBy: "descricao",
    XEmpresaId: XEmpresaMatrizId,
    XDefaultRecord: { 
      descricao: "", 
      observacao: null, 
      tp_operacao_id: null, 
      cfop_id: null, 
      regime_trib: "*", 
      empresa_id: XEmpresaMatrizId || 1, 
      excluido: false 
    },
  }), [XEmpresaMatrizId]);

  const XGroupEmpresaIds = useMemo(() => {
    return (XEmpresas || [])
      .filter(e => e && (e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId))
      .map(e => e.empresa_id);
  }, [XEmpresaMatrizId, XEmpresas]);

  useEffect(() => {
    if (XGroupEmpresaIds.length > 0) {
      db.from("cfop").select("cfop_id, cd_cfop, descricao").in("empresa_id", XGroupEmpresaIds).order("cd_cfop")
        .then(({ data }: any) => setCfopList(data || []));
      db.from("tp_operacao").select("tp_operacao_id, descricao").in("empresa_id", XGroupEmpresaIds).order("descricao")
        .then(({ data }: any) => setTpOpList(data || []));
      db.from("fiscal_grupo_produto").select("fiscal_grupo_produto_id, nome, tp_imposto").in("empresa_id", XGroupEmpresaIds).order("nome")
        .then(({ data }: any) => setFiscalGrupoList(data || []));
    } else {
      db.from("cfop").select("cfop_id, cd_cfop, descricao").order("cd_cfop")
        .then(({ data }: any) => setCfopList(data || []));
      db.from("tp_operacao").select("tp_operacao_id, descricao").order("descricao")
        .then(({ data }: any) => setTpOpList(data || []));
      db.from("fiscal_grupo_produto").select("fiscal_grupo_produto_id, nome, tp_imposto").order("nome")
        .then(({ data }: any) => setFiscalGrupoList(data || []));
    }
  }, [XGroupEmpresaIds]);

  const REGIME_OPTIONS = Object.entries(REGIME_MAP).map(([value, label]) => ({ value, label }));

  return (
    <StandardCrudForm<IFiscalRegra>
      config={config}
      XGridCols={GRID_COLS}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4">
          {/* Topo: Código, Empresa Matriz e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-secondary/10 p-4 rounded-lg border border-border shadow-sm">
            <div className="md:col-span-2">
              <Field label="Código">
                <TextInput value={mode === "insert" ? "(Novo)" : s(currentRecord?.fiscal_regra_id)} readOnly />
              </Field>
            </div>
            <div className="md:col-span-3">
              <Field label="Emp. Matriz">
                <TextInput value={XEmpLabel} readOnly />
              </Field>
            </div>
            <div className="md:col-span-7">
              <Field label="Descrição da Regra Fiscal *">
                <TextInput 
                  value={record.descricao} 
                  readOnly={!isEditing}
                  onChange={v => setField("descricao", v.toUpperCase() as any)}
                  placeholder="Ex: VENDA DE MERCADORIA DENTRO DO ESTADO" 
                />
              </Field>
            </div>
          </div>

          {/* Abas Internas (Estilo ProdutoForm) */}
          <div className="flex border-b border-border flex-wrap bg-card rounded-t-lg">
            <button
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                subTab === "principal" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSubTab("principal")}
            >
              Principal
            </button>
            {TABS_IMPOSTO.map(t => (
              <button
                key={t.key}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  subTab === t.key.toLowerCase() ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSubTab(t.key.toLowerCase())}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Conteúdo das Abas */}
          <div className="p-4 bg-card border-x border-b border-border rounded-b-lg min-h-[400px]">
            {subTab === "principal" && (
              <div className="space-y-5 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Tipo de Operação">
                    <NatSel
                      value={record.tp_operacao_id === null || record.tp_operacao_id === undefined ? "null" : String(record.tp_operacao_id)}
                      onChange={v => setField("tp_operacao_id", (v === "null" ? null : Number(v)) as any)}
                      options={[{ value: "null", label: "Todos os Tipos" }, ...tpOpList.map(t => ({ value: String(t.tp_operacao_id), label: s(t.descricao) }))]}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Regime Tributário">
                    <NatSel
                      value={record.regime_trib ?? "*"}
                      onChange={v => setField("regime_trib", v as any)}
                      options={REGIME_OPTIONS}
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="CFOP Padrão">
                    <NatSel
                      value={record.cfop_id === null || record.cfop_id === undefined ? "null" : String(record.cfop_id)}
                      onChange={v => setField("cfop_id", (v === "null" ? null : Number(v)) as any)}
                      options={[{ value: "null", label: "Nenhum" }, ...cfopList.map(c => ({ value: String(c.cfop_id), label: `${s(c.cd_cfop)} — ${s(c.descricao)}` }))]}
                      disabled={!isEditing}
                    />
                  </Field>
                </div>
                
                <Field label="Observações / Informações Complementares">
                  <textarea
                    value={record.observacao ?? ""}
                    onChange={e => setField("observacao", e.target.value as any)}
                    disabled={!isEditing}
                    className="w-full min-h-[150px] border border-border rounded-md p-3 text-sm bg-card focus:ring-2 focus:ring-ring outline-none resize-none shadow-inner"
                    placeholder="Digite aqui as observações que devem constar nos documentos fiscais..."
                  />
                </Field>
              </div>
            )}

            {TABS_IMPOSTO.map(t => subTab === t.key.toLowerCase() && (
              <div key={t.key} className="animate-in fade-in duration-300">
                <SubGrid
                  regraId={currentRecord?.fiscal_regra_id || (record as any)?.fiscal_regra_id || null}
                  tipo={t.key}
                  isEditing={true} // Permite editar sempre que houver regraId
                  cfopList={cfopList}
                  empresaId={XEmpresaMatrizId || 1}
                  regimeRegra={record.regime_trib}
                  fiscalGrupoList={fiscalGrupoList.filter(g => {
                    if (t.key === "CFOP") return true;
                    if (t.key === "ICMS") return g.tp_imposto === "ICMS";
                    if (t.key === "IPI") return g.tp_imposto === "IPI";
                    if (t.key === "PIS" || t.key === "COFINS") return g.tp_imposto === "PIS/COFINS";
                    if (t.key === "CBSIBS") return g.tp_imposto === "IBS/CBS";
                    return true;
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    />
  );
};

export default FiscalRegraForm;
