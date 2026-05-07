import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { baseService } from "@/utils/baseService";
import { useGridFilter } from "@/hooks/useGridFilter";

const db = supabase as any;

type TFormMode = "view" | "edit" | "insert";

interface IFuncionario {
  funcionario_id: number;
  empresa_id: number | null;
  nome: string | null;
  usr_id: number | null;
  gerente: string | null;
  vendedor: string | null;
  motorista: string | null;
  entregador: string | null;
  caixa: string | null;
  caixa_cnc_venda: string | null;
  caixa_edit_venda: string;
  caixa_inf_vend: string | null;
  pc_comissao_av: number | null;
  pc_comissao_prz: number | null;
  tp_comissao: string | null;
  corretora_id: number | null;
  tamanho_fonte_pedidos: number;
  tamanho_fonte_produtos: number;
  tempo_refresh_pdv: number;
  nfe_config_item: number | null;
  nfce_config_item: number | null;
}

const XLocalizarColumns: IGridColumn[] = [
  { key: "funcionario_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "2fr" },
  { key: "vendedor", label: "Vend.", width: "60px", align: "center" },
  { key: "caixa", label: "Caixa", width: "60px", align: "center" },
];

const emptyForm = (): Record<string, string> => ({
  nome: "",
  usr_id: "",
  gerente: "N",
  vendedor: "N",
  motorista: "N",
  entregador: "N",
  caixa: "N",
  caixa_cnc_venda: "N",
  caixa_edit_venda: "N",
  caixa_inf_vend: "N",
  pc_comissao_av: "0",
  pc_comissao_prz: "0",
  tp_comissao: "1",
  corretora_id: "",
  tamanho_fonte_pedidos: "12",
  tamanho_fonte_produtos: "12",
  tempo_refresh_pdv: "30",
  nfe_config_item: "",
  nfce_config_item: "",
});

const FuncionarioForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, closeTab, XActiveTabId, XTabs } = useAppContext();

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("cadastro");
  const [XCadastroInnerTab, setXCadastroInnerTab] = useState<string>("geral");
  const [XData, setXData] = useState<IFuncionario[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XF, setXF] = useState(emptyForm());
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XLoading, setXLoading] = useState(false);

  // Lookups
  const [XUsuarios, setXUsuarios] = useState<any[]>([]);
  const [XFiscalConfigs, setXFiscalConfigs] = useState<any[]>([]);

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const set = useCallback((key: string, val: string) => {
    setXF(prev => ({ ...prev, [key]: val }));
  }, []);

  const loadLookups = useCallback(async () => {
    console.log("[FuncionarioForm] Carregando Lookups para Empresa:", XEmpresaId);
    const [r1, r2] = await Promise.all([
      db.from("empresa_usuario").select("user_id").eq("empresa_id", XEmpresaId),
      db.from("fiscal_config_item").select("fiscal_config_item_id, nome, modelo").eq("empresa_id", XEmpresaId).order("nome"),
    ]);
    console.log("[FuncionarioForm] Resultado fiscal_config_item:", r2.data);
    setXUsuarios(r1.data || []);
    setXFiscalConfigs(r2.data || []);
  }, [XEmpresaId]);

  const loadData = useCallback(async () => {
    setXLoading(true);
    const { data: XRows } = await db
      .from("funcionario")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .order("funcionario_id");
    setXData(XRows || []);
    setXLoading(false);
  }, [XEmpresaId]);

  useEffect(() => {
    loadData();
    loadLookups();
  }, [XEmpresaId]);

  // Filtered Fiscal Configs
  const XFiscalNFe = useMemo(() => {
    const filtered = XFiscalConfigs.filter(f => String(f.modelo) === "55");
    console.log("[FuncionarioForm] XFiscalNFe filtrado:", filtered);
    return filtered;
  }, [XFiscalConfigs]);

  const XFiscalNFCe = useMemo(() => {
    const filtered = XFiscalConfigs.filter(f => String(f.modelo) === "65");
    console.log("[FuncionarioForm] XFiscalNFCe filtrado:", filtered);
    return filtered;
  }, [XFiscalConfigs]);

  // Populate form when record or mode changes
  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      const XNf: Record<string, string> = {};
      for (const key of Object.keys(emptyForm())) {
        const XVal = (XCurrentRecord as any)[key];
        XNf[key] = XVal != null ? String(XVal) : "";
      }
      setXF(XNf);
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => {
    setXF(emptyForm());
    setXFormMode("insert");
    setXInnerTab("cadastro");
    setXCadastroInnerTab("geral");
  };

  const handleEditar = () => {
    if (!XCurrentRecord) return;
    setXFormMode("edit");
    setXInnerTab("cadastro");
  };

  const handleSalvar = async () => {
    if (!XF.nome?.trim()) {
      toast.error("O nome do funcionário é obrigatório.");
      return;
    }

    const toNull = (v: string) => v.trim() || null;
    const toInt = (v: string) => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const toFloat = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    const XPayload: any = {
      empresa_id: XEmpresaId,
      nome: XF.nome.trim().toUpperCase(),
      usr_id: toInt(XF.usr_id),
      gerente: XF.gerente || "N",
      vendedor: XF.vendedor || "N",
      motorista: XF.motorista || "N",
      entregador: XF.entregador || "N",
      caixa: XF.caixa || "N",
      caixa_cnc_venda: XF.caixa_cnc_venda || "N",
      caixa_edit_venda: XF.caixa_edit_venda || "N",
      caixa_inf_vend: XF.caixa_inf_vend || "N",
      pc_comissao_av: toFloat(XF.pc_comissao_av) || 0,
      pc_comissao_prz: toFloat(XF.pc_comissao_prz) || 0,
      tp_comissao: XF.tp_comissao || "1",
      corretora_id: toInt(XF.corretora_id),
      tamanho_fonte_pedidos: toInt(XF.tamanho_fonte_pedidos) || 12,
      tamanho_fonte_produtos: toInt(XF.tamanho_fonte_produtos) || 12,
      tempo_refresh_pdv: toInt(XF.tempo_refresh_pdv) || 30,
      nfe_config_item: toInt(XF.nfe_config_item),
      nfce_config_item: toInt(XF.nfce_config_item),
    };

    if (XFormMode === "edit" && XCurrentRecord) {
      const { error } = await db.from("funcionario").update(XPayload).eq("funcionario_id", XCurrentRecord.funcionario_id);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    } else {
      const { error } = await db.from("funcionario").insert(XPayload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    }

    toast.success("Funcionário salvo com sucesso!");
    setXFormMode("view");
    await loadData();
  };

  const handleCancelar = () => setXFormMode("view");

  const handleExcluir = async () => {
    if (!XCurrentRecord) return;
    if (!confirm(`Deseja realmente excluir o funcionário "${XCurrentRecord.nome}"?`)) return;
    
    const { error } = await db.from("funcionario").delete().eq("funcionario_id", XCurrentRecord.funcionario_id);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
      return;
    }
    
    toast.success("Funcionário excluído com sucesso.");
    await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleRefresh = async () => {
    await loadData();
    toast.info("Dados recarregados.");
  };

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  // Localizar filter
  const XFilteredData = useGridFilter(XData, XSearchFilters);

  const handleSelectFromSearch = (XRow: any) => {
    const XIdx = XData.findIndex(r => r.funcionario_id === XRow.funcionario_id);
    if (XIdx >= 0) {
      setXCurrentIdx(XIdx);
      setXInnerTab("cadastro");
      setXFormMode("view");
    }
  };

  // Rendering Helpers
  const XFieldBgEdit = "bg-card";
  const XFieldBgRead = "bg-secondary";

  const renderField = (label: string, key: string, options?: { required?: boolean; className?: string }) => {
    const XVal = XIsEditing ? (XF[key] || "") : (XCurrentRecord ? (XCurrentRecord as any)[key] : "");
    return (
      <div className={options?.className}>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {label} {options?.required && <span className="text-destructive">*</span>}
        </label>
        <input
          type="text"
          value={XVal ?? ""}
          onChange={(e) => set(key, e.target.value.toUpperCase())}
          readOnly={!XIsEditing}
          className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XIsEditing ? XFieldBgEdit : XFieldBgRead} focus:ring-2 focus:ring-ring outline-none`}
        />
      </div>
    );
  };

  const renderSelect = (label: string, key: string, items: { v: string; l: string }[]) => {
    const XVal = XIsEditing ? (XF[key] || "") : (XCurrentRecord ? (XCurrentRecord as any)[key] : "");
    if (!XIsEditing) {
      const XDisplay = items.find(i => i.v === String(XVal))?.l || String(XVal) || "";
      return (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
          <input type="text" value={XDisplay} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`} />
        </div>
      );
    }
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <Select value={XF[key] || ""} onValueChange={(v) => set(key, v)}>
          <SelectTrigger className={`h-[34px] text-sm ${XFieldBgEdit}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLookup = (label: string, key: string, items: any[], valueKey: string, labelKey: string) => {
    const XVal = XIsEditing ? (XF[key] || "") : (XCurrentRecord ? (XCurrentRecord as any)[key] : "");
    if (!XIsEditing) {
      const XItem = items.find((i: any) => String(i[valueKey]) === String(XVal));
      return (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
          <input type="text" value={XItem ? XItem[labelKey] : ""} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`} />
        </div>
      );
    }
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <Select value={XF[key] || "__none__"} onValueChange={(v) => set(key, v === "__none__" ? "" : v)}>
          <SelectTrigger className={`h-[34px] text-sm ${XFieldBgEdit}`}><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Nenhum —</SelectItem>
            {items.map((i: any) => <SelectItem key={i[valueKey]} value={String(i[valueKey])}>{i[labelKey]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const XTabsList = ["geral", "comissoes", "pdv", "fiscal"];
  const XTabLabels: Record<string, string> = {
    geral: "Dados Gerais",
    comissoes: "Comissões",
    pdv: "Config. PDV",
    fiscal: "Config. Fiscal",
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <FormToolbar
        XIsEditing={XIsEditing}
        XHasRecord={!!XCurrentRecord}
        XIsFirst={XCurrentIdx === 0}
        XIsLast={XCurrentIdx >= XData.length - 1}
        onIncluir={handleIncluir}
        onEditar={handleEditar}
        onSalvar={handleSalvar}
        onCancelar={handleCancelar}
        onExcluir={handleExcluir}
        onFirst={() => setXCurrentIdx(0)}
        onPrev={() => setXCurrentIdx(Math.max(0, XCurrentIdx - 1))}
        onNext={() => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1))}
        onLast={() => setXCurrentIdx(XData.length - 1)}
        onRefresh={handleRefresh}
        onLocalizar={() => setXInnerTab("localizar")}
        onSair={handleSair}
      />

      <div className="flex border-b border-border bg-card">
        {(["cadastro", "localizar"] as const).map(t => (
          <button
            key={t}
            className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setXInnerTab(t)}
          >
            {t === "cadastro" ? "Funcionário" : "Localizar"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={XFormMode === "insert" ? "(Novo)" : XCurrentRecord?.funcionario_id ?? ""} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead} text-right`} />
              </div>
              <div className="md:col-span-10">
                {renderField("Nome do Funcionário", "nome", { required: true })}
              </div>
            </div>

            <div className="flex border-b border-border">
              {XTabsList.map(t => (
                <button
                  key={t}
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 ${XCadastroInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setXCadastroInnerTab(t)}
                >
                  {XTabLabels[t]}
                </button>
              ))}
            </div>

            {XCadastroInnerTab === "geral" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-left-1 duration-200">
                {renderLookup("Usuário Vinculado", "usr_id", XUsuarios, "user_id", "user_id")}
                <div className="grid grid-cols-2 gap-3 md:col-span-2">
                  {renderSelect("Gerente", "gerente", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Vendedor", "vendedor", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Motorista", "motorista", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Entregador", "entregador", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Pode Operar Caixa", "caixa", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                </div>
              </div>
            )}

            {XCadastroInnerTab === "comissoes" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-left-1 duration-200">
                {renderSelect("Tipo de Comissão", "tp_comissao", [{ v: "1", l: "Percentual sobre Venda" }, { v: "2", l: "Valor Fixo por Item" }])}
                {renderField("% Comissão À Vista", "pc_comissao_av")}
                {renderField("% Comissão À Prazo", "pc_comissao_prz")}
              </div>
            )}

            {XCadastroInnerTab === "pdv" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-left-1 duration-200">
                {renderField("Tamanho Fonte Pedidos", "tamanho_fonte_pedidos")}
                {renderField("Tamanho Fonte Produtos", "tamanho_fonte_produtos")}
                {renderField("Tempo Refresh PDV (seg)", "tempo_refresh_pdv")}
                {renderSelect("Cancela Venda", "caixa_cnc_venda", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                {renderSelect("Edita Venda", "caixa_edit_venda", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                {renderSelect("Informa Vendedor", "caixa_inf_vend", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
              </div>
            )}

            {XCadastroInnerTab === "fiscal" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-1 duration-200">
                <div className="p-4 border border-dashed rounded-lg bg-muted/20">
                  <h3 className="text-sm font-semibold mb-3">Configurações de Emissão</h3>
                  <div className="space-y-4">
                    {renderLookup("Configuração NF-e (Modelo 55)", "nfe_config_item", XFiscalNFe, "fiscal_config_item_id", "nome")}
                    {renderLookup("Configuração NFC-e (Modelo 65)", "nfce_config_item", XFiscalNFCe, "fiscal_config_item_id", "nome")}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full">
            <DataGrid
              columns={XLocalizarColumns}
              data={XFilteredData}
              onRowClick={handleSelectFromSearch}
              onFilterChange={setXSearchFilters}
              isLoading={XLoading}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FuncionarioForm;
