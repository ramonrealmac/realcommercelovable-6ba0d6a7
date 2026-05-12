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
  { key: "CBSIBS", label: "CBS/IBS" },
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
  { key: "cfop_desc",          label: "Descrição",   width: "2fr",   render: r => s(r.cfop?.descricao) },
  { key: "uf_destino",         label: "UF Dest.",    width: "80px",  align: "center", render: r => s(r.uf_destino) },
  { key: "ncm_filtro",         label: "NCM",         width: "110px", align: "center", render: r => s(r.ncm_filtro) },
  { key: "grupo_nome",         label: "Gr. Trib.",   width: "130px", render: r => s(r.fiscal_grupo_produto?.nome) },
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

const CRUD_CONFIG: ICrudConfig<IFiscalRegra> = {
  XTableName: "fiscal_regra",
  XPrimaryKey: "fiscal_regra_id",
  XTitle: "Regras Fiscais",
  XOrderBy: "descricao",
  XDefaultRecord: { descricao: "", observacao: null, tp_operacao_id: null, cfop_id: null, regime_trib: "*", empresa_id: 1, excluido: false },
};

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

function SubGrid({ regraId, tipo, isEditing, cfopList, empresaId, fiscalGrupoList }: {
  regraId: number | null; tipo: string; isEditing: boolean; cfopList: any[]; empresaId: number; fiscalGrupoList: any[];
}) {
  const isCfop = tipo === "CFOP";
  const table = isCfop ? "fiscal_regra_cfop" : "fiscal_regra_item";
  const pk = isCfop ? "fiscal_regra_cfop_id" : "fiscal_regra_item_id";

  const [rows, setRows] = useState<any[]>([]);
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3 border border-border rounded-md bg-secondary/20 items-end">
              <Field label="CST/CSOSN"><TextInput value={editing.cst_csosn} onChange={v => set("cst_csosn", v)} /></Field>
              <Field label="Alíquota %"><TextInput type="number" value={editing.aliquota} onChange={v => set("aliquota", Number(v))} /></Field>
              <Field label="Redução BC %"><TextInput type="number" value={editing.base_reducao} onChange={v => set("base_reducao", Number(v))} /></Field>

              {tipo === "ICMS" && <>
                <Field label="Mod. BC">
                  <NatSel
                    value={String(editing.mod_bc ?? 3)}
                    onChange={v => set("mod_bc", Number(v))}
                    options={Object.entries(MOD_BC).map(([k, l]) => ({ value: k, label: l }))}
                  />
                </Field>
                <Field label="MVA %"><TextInput type="number" value={editing.icms_st_mva} onChange={v => set("icms_st_mva", Number(v))} /></Field>
                <Field label="Alíq. ST %"><TextInput type="number" value={editing.icms_st_aliquota} onChange={v => set("icms_st_aliquota", Number(v))} /></Field>
                <Field label="Mod. BC ST">
                  <NatSel
                    value={String(editing.mod_bc_st ?? 4)}
                    onChange={v => set("mod_bc_st", Number(v))}
                    options={Object.entries(MOD_BC_ST).map(([k, l]) => ({ value: k, label: l }))}
                  />
                </Field>
                <Field label="Red. BC ST %"><TextInput type="number" value={editing.icms_st_base_reducao} onChange={v => set("icms_st_base_reducao", Number(v))} /></Field>
                <Field label="Motivo Deson."><TextInput type="number" value={editing.motivo_desoneracao ?? ""} onChange={v => set("motivo_desoneracao", v ? Number(v) : null)} /></Field>
                <Field label="Crédito SN %"><TextInput type="number" value={editing.p_cre_sn} onChange={v => set("p_cre_sn", Number(v))} /></Field>
              </>}

              {(tipo === "PIS" || tipo === "COFINS") && <>
                <Field label="CST PIS/COF."><TextInput value={editing.cst_pis_cofins ?? ""} onChange={v => set("cst_pis_cofins", v)} /></Field>
                <Field label="Nat. Receita"><TextInput value={editing.nat_receita_pis_cofins ?? ""} onChange={v => set("nat_receita_pis_cofins", v)} /></Field>
              </>}

              {tipo === "IPI" && (
                <Field label="C. Enquadramento"><TextInput value={editing.ipi_c_enq ?? "999"} onChange={v => set("ipi_c_enq", v)} /></Field>
              )}

              {tipo === "CBSIBS" && <>
                <Field label="IBS %"><TextInput type="number" value={editing.ibs_aliquota} onChange={v => set("ibs_aliquota", Number(v))} /></Field>
                <Field label="CBS %"><TextInput type="number" value={editing.cbs_aliquota} onChange={v => set("cbs_aliquota", Number(v))} /></Field>
                <Field label="IS %"><TextInput type="number" value={editing.is_aliquota} onChange={v => set("is_aliquota", Number(v))} /></Field>
              </>}

              <div className="col-span-2 lg:col-span-1 flex gap-2 pt-1">
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
          columns={isCfop ? COLS_CFOP : COLS_ITEM}
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
  const { XEmpresaId } = useAppContext();
  const [cfopList, setCfopList] = useState<any[]>([]);
  const [tpOpList, setTpOpList] = useState<any[]>([]);
  const [fiscalGrupoList, setFiscalGrupoList] = useState<any[]>([]);
  const [subTab, setSubTab] = useState("principal");

  useEffect(() => {
    db.from("cfop").select("cfop_id, cd_cfop, descricao").order("cd_cfop")
      .then(({ data }: any) => setCfopList(data || []));
    db.from("tp_operacao").select("tp_operacao_id, descricao").order("descricao")
      .then(({ data }: any) => setTpOpList(data || []));
    db.from("fiscal_grupo_produto").select("fiscal_grupo_produto_id, nome, tp_imposto").order("nome")
      .then(({ data }: any) => setFiscalGrupoList(data || []));
  }, []);

  const REGIME_OPTIONS = Object.entries(REGIME_MAP).map(([value, label]) => ({ value, label }));

  return (
    <StandardCrudForm<IFiscalRegra>
      config={CRUD_CONFIG}
      XGridCols={GRID_COLS}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4">
          {/* Topo: Código e Descrição */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-secondary/10 p-4 rounded-lg border border-border shadow-sm">
            <div className="md:col-span-2">
              <Field label="Código">
                <TextInput value={mode === "insert" ? "(Novo)" : s(currentRecord?.fiscal_regra_id)} readOnly />
              </Field>
            </div>
            <div className="md:col-span-10">
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
                  empresaId={XEmpresaId || 1}
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
