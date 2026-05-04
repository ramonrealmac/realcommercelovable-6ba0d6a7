import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { ICrudConfig, TFormMode } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";
import DataGrid from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const db = supabase as any;

const UF_OPTIONS = ["*","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const REGIME_OPTIONS = [
  { value: "*", label: "Todos" }, 
  { value: "S", label: "Simples Nacional" }, 
  { value: "L", label: "Lucro Presumido" }, 
  { value: "N", label: "Lucro Real" }
];
const ORIGEM_OPTIONS = [
  { value: "", label: "Todos" }, 
  { value: "0", label: "0 - Nacional" }, 
  { value: "1", label: "1 - Estrangeira (import. direta)" }, 
  { value: "2", label: "2 - Estrangeira (mercado interno)" }
];

const TIPO_IMPOSTO_TABS = [
  { key: "CFOP",    label: "CFOP" },
  { key: "ICMS",    label: "ICMS" },
  { key: "IPI",     label: "IPI" },
  { key: "PIS",     label: "PIS" },
  { key: "COFINS",  label: "COFINS" },
  { key: "CBSIBS",  label: "CBS/IBS" },
];

// ── Colunas do grid principal ─────────────────────────────────────────────────
const XGridCols: IGridColumn[] = [
  { key: "fiscal_regra_id", label: "Cód.", width: "70px", align: "right" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "regime_trib", label: "Regime", width: "140px", render: r => {
    const map: any = { S: "Simples", L: "Lucro Presumido", N: "Lucro Real" };
    return map[r.regime_trib] || "Todos";
  }},
  { key: "tipo_operacao_id", label: "Tipo Op.", width: "100px" },
  { key: "prioridade", label: "Prior.", width: "80px", align: "center" },
];

// ── Colunas das subtelas ───────────────────────────────────────────────────────
const COLS_CFOP: IGridColumn[] = [
  { key: "cfop_id", label: "CFOP", width: "90px", render: r => r.cfop?.cd_cfop || r.cfop_id },
  { key: "cfop_desc", label: "Descrição CFOP", width: "2fr", render: r => r.cfop?.descricao || "" },
  { key: "uf_destino", label: "UF Dest.", width: "80px", align: "center" },
  { key: "ncm_filtro", label: "NCM", width: "110px" },
  { key: "cest_filtro", label: "CEST", width: "110px" },
  { key: "cliente_contribuinte", label: "Contribuinte", width: "110px", render: r => 
      r.cliente_contribuinte === true ? "Sim" : r.cliente_contribuinte === false ? "Não" : "Todos" 
  },
];

const COLS_ITEM: IGridColumn[] = [
  { key: "tipo_imposto", label: "Tributo", width: "90px" },
  { key: "cst_csosn", label: "CST/CSOSN", width: "100px" },
  { key: "aliquota", label: "Alíq. %", width: "90px", align: "right", render: r => Number(r.aliquota || 0).toFixed(2) },
  { key: "base_reducao", label: "Red. BC %", width: "90px", align: "right", render: r => Number(r.base_reducao || 0).toFixed(2) },
  { key: "uf_destino", label: "UF Dest.", width: "80px", align: "center" },
  { key: "ncm_filtro", label: "NCM", width: "110px" },
  { key: "cest_filtro", label: "CEST", width: "110px" },
];

// ── Config CRUD ───────────────────────────────────────────────────────────────
interface IFiscalRegra { 
  fiscal_regra_id: number; 
  descricao: string; 
  observacao: string; 
  tipo_operacao_id: number | null; 
  cfop_id: number | null; 
  regime_trib: string; 
  prioridade: number; 
  vigencia_inicio: string | null; 
  vigencia_fim: string | null; 
  empresa_id: number; 
  excluido: boolean; 
}

const XConfig: ICrudConfig<IFiscalRegra> = {
  XTableName: "fiscal_regra", 
  XPrimaryKey: "fiscal_regra_id", 
  XTitle: "Regras Fiscais", 
  XOrderBy: "descricao",
  XDefaultRecord: { 
    descricao: "", observacao: "", tipo_operacao_id: null, cfop_id: null, 
    regime_trib: "*", prioridade: 0, vigencia_inicio: null, vigencia_fim: null, 
    empresa_id: 1, excluido: false 
  },
};

// ── Componentes auxiliares ────────────────────────────────────────────────────
const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

const XI = ({ value, onChange, readOnly, type = "text", className = "" }: any) => (
  <input 
    type={type} 
    readOnly={readOnly} 
    value={value ?? ""} 
    onChange={e => onChange?.(e.target.value)}
    className={`border border-border rounded px-3 py-1.5 text-sm ${readOnly ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-ring outline-none"} ${className}`} 
  />
);

function FiltroItemRow({ item, isEditing, onChange }: { item: any; isEditing: boolean; onChange: (k: string, v: any) => void }) {
  const sel = (label: string, field: string, options: { value: string; label: string }[]) => (
    <F label={label}>
      {isEditing ? (
        <Select value={String(item?.[field] ?? "")} onValueChange={v => onChange(field, v === "" ? null : v)}>
          <SelectTrigger className="h-[34px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <XI value={options.find(o => o.value === String(item?.[field] ?? ""))?.label || item?.[field] || ""} readOnly />
      )}
    </F>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border border-border rounded-md bg-secondary/30">
      {sel("UF Destino", "uf_destino", UF_OPTIONS.map(u => ({ value: u, label: u === "*" ? "* (Todos)" : u })))}
      <F label="NCM Filtro">
        <XI value={item?.ncm_filtro ?? "99999999"} readOnly={!isEditing} onChange={(v: string) => onChange("ncm_filtro", v)} className="font-mono" />
      </F>
      <F label="CEST Filtro">
        <XI value={item?.cest_filtro ?? "9999999"} readOnly={!isEditing} onChange={(v: string) => onChange("cest_filtro", v)} className="font-mono" />
      </F>
      {sel("Contribuinte", "cliente_contribuinte", [{ value: "", label: "Todos" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }])}
      {sel("Consumidor Final", "cliente_consumidor_final", [{ value: "", label: "Todos" }, { value: "true", label: "Sim" }, { value: "false", label: "Não" }])}
      {sel("Origem Produto", "origem_produto", ORIGEM_OPTIONS)}
    </div>
  );
}

function SubGrid({ regraId, tipo, isEditing, cfopList }: { regraId: number | null; tipo: string; isEditing: boolean; cfopList: any[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);

  const isCfop = tipo === "CFOP";
  const table = isCfop ? "fiscal_regra_cfop" : "fiscal_regra_item";
  const pk = isCfop ? "fiscal_regra_cfop_id" : "fiscal_regra_item_id";

  const load = useCallback(async () => {
    if (!regraId) { setData([]); return; }
    setLoading(true);
    try {
      let q = db.from(table).select(isCfop ? "*, cfop(cd_cfop, descricao)" : "*");
      q = q.eq("fiscal_regra_id", regraId);
      if (!isCfop) q = q.eq("tipo_imposto", tipo);
      
      const { data: rows, error } = await q.order(pk, { ascending: true });
      if (error) throw error;
      setData(rows || []);
    } catch (err: any) {
      console.error("Erro ao carregar itens:", err);
    } finally {
      setLoading(false);
    }
  }, [regraId, tipo, table, isCfop, pk]);

  useEffect(() => { load(); }, [load]);

  const empty = useCallback(() => isCfop
    ? { fiscal_regra_id: regraId, cfop_id: null, uf_destino: "*", cliente_contribuinte: null, cliente_consumidor_final: null, ncm_filtro: "99999999", cest_filtro: "9999999", grupo_icms_id: null, origem_produto: null, empresa_id: 1 }
    : { fiscal_regra_id: regraId, tipo_imposto: tipo, cst_csosn: "", aliquota: 0, base_reducao: 0, motivo_desoneracao: null, p_cre_sn: 0, icms_st_aliquota: 0, icms_st_mva: 0, icms_st_base_reducao: 0, mod_bc: 3, mod_bc_st: 4, ipi_c_enq: "999", cst_pis_cofins: null, nat_receita_pis_cofins: null, ibs_aliquota: 0, cbs_aliquota: 0, is_aliquota: 0, uf_destino: "*", cliente_contribuinte: null, cliente_consumidor_final: null, ncm_filtro: "99999999", cest_filtro: "9999999", grupo_icms_id: null, origem_produto: null, empresa_id: 1 }
  , [regraId, tipo, isCfop]);

  const handleSave = async () => {
    if (!editItem) return;
    const isNew = !editItem[pk];
    const payload = { ...editItem };
    delete payload[pk];
    if (isCfop) delete payload.cfop;

    // Converte strings de booleano
    if (payload.cliente_contribuinte === "true") payload.cliente_contribuinte = true;
    else if (payload.cliente_contribuinte === "false") payload.cliente_contribuinte = false;
    else if (payload.cliente_contribuinte === "") payload.cliente_contribuinte = null;

    if (payload.cliente_consumidor_final === "true") payload.cliente_consumidor_final = true;
    else if (payload.cliente_consumidor_final === "false") payload.cliente_consumidor_final = false;
    else if (payload.cliente_consumidor_final === "") payload.cliente_consumidor_final = null;

    const q = isNew ? db.from(table).insert(payload) : db.from(table).update(payload).eq(pk, editItem[pk]);
    const { error } = await q;
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    
    toast.success("Salvo!");
    setEditItem(null); setSelectedIdx(null); load();
  };

  const handleDelete = async () => {
    const selected = selectedIdx !== null ? data[selectedIdx] : null;
    if (!selected || !confirm("Excluir este item?")) return;
    const { error } = await db.from(table).delete().eq(pk, selected[pk]);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído!"); setSelectedIdx(null); setEditItem(null); load();
  };

  return (
    <div className="space-y-3">
      {isEditing && (
        <div className="flex gap-2">
          <button onClick={() => { if(!regraId) toast.warning("Salve primeiro"); else setEditItem(empty()); }} className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90">
            <Plus className="w-3 h-3" /> Novo
          </button>
          {editItem && <button onClick={handleSave} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:opacity-90">Salvar Item</button>}
          {selectedIdx !== null && <button onClick={handleDelete} className="flex items-center gap-1 bg-destructive text-destructive-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90"><Trash2 className="w-3 h-3" /> Excluir</button>}
          {editItem && <button onClick={() => { setEditItem(null); setSelectedIdx(null); }} className="px-3 py-1.5 rounded text-xs font-bold border border-border hover:bg-secondary">Cancelar</button>}
        </div>
      )}

      {editItem && isEditing && (
        <div className="border border-primary/40 rounded-lg p-4 bg-card space-y-3">
          <FiltroItemRow item={editItem} isEditing={true} onChange={(k, v) => setEditItem((p: any) => ({ ...p, [k]: v }))} />
          {isCfop ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <F label="CFOP *">
                <Select value={editItem.cfop_id ? String(editItem.cfop_id) : ""} onValueChange={v => setEditItem((p: any) => ({ ...p, cfop_id: v ? Number(v) : null }))}>
                  <SelectTrigger className="h-[34px] text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {cfopList.map(c => (
                      <SelectItem key={c.cfop_id} value={String(c.cfop_id)}>
                        {c.cd_cfop} — {c.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <F label="CST/CSOSN"><XI value={editItem.cst_csosn} onChange={(v: string) => setEditItem((p: any) => ({ ...p, cst_csosn: v }))} /></F>
              <F label="Alíquota %"><XI type="number" value={editItem.aliquota} onChange={(v: string) => setEditItem((p: any) => ({ ...p, aliquota: Number(v) }))} /></F>
              <F label="Redução BC %"><XI type="number" value={editItem.base_reducao} onChange={(v: string) => setEditItem((p: any) => ({ ...p, base_reducao: Number(v) }))} /></F>
              {tipo === "ICMS" && <>
                <F label="MVA %"><XI type="number" value={editItem.icms_st_mva} onChange={(v: string) => setEditItem((p: any) => ({ ...p, icms_st_mva: Number(v) }))} /></F>
                <F label="Alíq. ST %"><XI type="number" value={editItem.icms_st_aliquota} onChange={(v: string) => setEditItem((p: any) => ({ ...p, icms_st_aliquota: Number(v) }))} /></F>
              </>}
            </div>
          )}
        </div>
      )}

      <DataGrid
        columns={isCfop ? COLS_CFOP : COLS_ITEM}
        data={data}
        maxHeight="320px"
        selectedIdx={selectedIdx}
        onRowClick={(row, idx) => { if (isEditing) { setSelectedIdx(idx); setEditItem({ ...row }); } }}
      />
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
const FiscalRegraForm: React.FC = () => {
  const [cfopList, setCfopList] = useState<any[]>([]);
  const [tipoOpList, setTipoOpList] = useState<any[]>([]);

  useEffect(() => {
    db.from("cfop").select("cfop_id, cd_cfop, descricao").order("cd_cfop").then(({ data }: any) => setCfopList(data || []));
    db.from("tipo_operacao").select("tipo_operacao_id, descricao").order("descricao").then(({ data }: any) => setTipoOpList(data || []));
  }, []);

  const extraTabs = useMemo(() => {
    if (!cfopList || cfopList.length === 0) return [];
    return TIPO_IMPOSTO_TABS.map(t => ({
      key: t.key,
      label: t.label,
      render: ({ currentRecord, isEditing }: any) => (
        <SubGrid
          regraId={currentRecord?.fiscal_regra_id || null}
          tipo={t.key}
          isEditing={isEditing}
          cfopList={cfopList}
        />
      ),
    }));
  }, [cfopList]);

  return (
    <StandardCrudForm<IFiscalRegra>
      config={XConfig}
      XGridCols={XGridCols}
      XExtraTabs={extraTabs}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-1">
              <F label="Código">
                <XI value={mode === "insert" ? "(Novo)" : currentRecord?.fiscal_regra_id ?? ""} readOnly />
              </F>
            </div>
            <div className="md:col-span-5">
              <F label="Descrição *">
                <XI value={record.descricao} readOnly={!isEditing} onChange={(v: string) => setField("descricao", v.toUpperCase())} />
              </F>
            </div>
            <div className="md:col-span-3">
              <F label="Tipo de Operação">
                {isEditing ? (
                  <Select value={record.tipo_operacao_id ? String(record.tipo_operacao_id) : ""} onValueChange={v => setField("tipo_operacao_id", v ? Number(v) : null)}>
                    <SelectTrigger className="h-[34px] text-sm"><SelectValue placeholder="Todos..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null">Todos</SelectItem>
                      {tipoOpList.map(t => <SelectItem key={t.tipo_operacao_id} value={String(t.tipo_operacao_id)}>{t.descricao}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <XI value={tipoOpList.find(t => t.tipo_operacao_id === record.tipo_operacao_id)?.descricao || "Todos"} readOnly />
                )}
              </F>
            </div>
            <div className="md:col-span-2">
              <F label="Regime">
                {isEditing ? (
                  <Select value={record.regime_trib ?? "*"} onValueChange={v => setField("regime_trib", v)}>
                    <SelectTrigger className="h-[34px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REGIME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <XI value={REGIME_OPTIONS.find(o => o.value === record.regime_trib)?.label || "Todos"} readOnly />
                )}
              </F>
            </div>
            <div className="md:col-span-1">
              <F label="Prioridade">
                <XI type="number" value={record.prioridade} readOnly={!isEditing} onChange={(v: string) => setField("prioridade", Number(v))} />
              </F>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Observação</label>
            <textarea
              readOnly={!isEditing}
              value={record.observacao ?? ""}
              onChange={e => setField("observacao", e.target.value)}
              rows={2}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm resize-none ${isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"}`}
            />
          </div>
        </div>
      )}
    />
  );
};

export default FiscalRegraForm;
