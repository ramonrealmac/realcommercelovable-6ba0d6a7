import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateCPF, validateCNPJ, validateCPFOrCNPJ, formatCPFCNPJ, formatPhone, formatDateBR, parseDateBR } from "@/lib/validators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, MapPin, User, Home, FileText, Globe, Truck } from "lucide-react";
import VeiculoGrid from "@/components/forms/VeiculoGrid";
import { baseService } from "@/utils/baseService";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { useCrudController } from "@/hooks/useCrudController";
import { IGridColumn } from "@/components/grid/DataGrid";

const db = supabase as any;

export interface ICadastroFormConfig {
  formTitle: string;
  dataFilter?: { st_cliente?: string; st_fornecedor?: string; st_transportador?: string };
  filterMode?: "and" | "or";
  defaultValues?: Partial<Record<string, string>>;
  lockedFields?: string[];
  extraValidation?: (form: Record<string, string>) => string | null;
  showVeiculoTab?: boolean;
  autoInsert?: boolean;
  skipInitialLoad?: boolean;
}

const XLocalizarColumns: IGridColumn[] = [
  { key: "cadastro_id", label: "Código", width: "80px", align: "right" },
  { key: "razao_social", label: "Razão Social", width: "2fr" },
  { key: "nome_fantasia", label: "Fantasia", width: "1fr" },
  { key: "cnpj", label: "CPF/CNPJ", width: "140px", render: (r) => r.cnpj ? formatCPFCNPJ(r.cnpj) : "" },
  { key: "fone_geral", label: "Telefone", width: "130px", render: (r) => r.fone_geral ? formatPhone(r.fone_geral) : "" },
];

const emptyForm = (): Record<string, string> => ({
  cnpj: "", inscricao_estadual: "", razao_social: "", nome_fantasia: "", nome_curto: "",
  endereco_logradouro: "", endereco_numero: "", endereco_bairro: "", endereco_cep: "", endereco_compl: "", endereco_ptoref: "",
  fone_geral: "", fone_comercial: "", fone_financeiro: "", fone_faturamento: "",
  tp_pessoa: "O", tp_contribuinte: "N", estado_civil: "", rg: "", nacionalidade: "BRASILEIRA",
  st_cadastro: "A", st_cliente: "S", st_fornecedor: "N", st_transportador: "N",
  email: "", dt_nasc: "",
  conj_nome: "", conj_cpf: "", conj_dt_nasc: "", conj_telefone: "",
  dep_nome1: "", dep_cpf1: "", dep_dt_nasc1: "", dep_grau_parent1: "",
  dep_nome2: "", dep_cpf2: "", dep_dt_nasc2: "", dep_grau_parent2: "",
  inscricao_municipal: "", rota_seq: "0",
  endereco_cidade_id: "", grupo_cadastro_id: "", tp_cadastro_id: "",
  condicao_id: "", funcionario_id: "", portador_id: "", rota_id: "", tabela_preco_id: "",
  latitude: "", longitude: "",
});

const CadastroCompletoForm: React.FC<ICadastroFormConfig> = ({
  formTitle,
  dataFilter,
  filterMode = "and",
  defaultValues,
  lockedFields = [],
  extraValidation,
  showVeiculoTab = false,
  autoInsert = false,
  skipInitialLoad = false,
}) => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  
  const ctrl = useCrudController<any>({
    tableName: "cadastro",
    empresaFieldName: "empresa_id",
  });

  const [XF, setXF] = useState(emptyForm());
  const [XSubTab, setXSubTab] = useState<string>("geral");
  const [XBuscandoCnpj, setXBuscandoCnpj] = useState(false);
  const [XBuscandoCep, setXBuscandoCep] = useState(false);
  const [XBuscandoGeo, setXBuscandoGeo] = useState(false);

  // Lookups
  const [XCidades, setXCidades] = useState<any[]>([]);
  const [XGrupos, setXGrupos] = useState<any[]>([]);
  const [XTiposCad, setXTiposCad] = useState<any[]>([]);
  const [XCondicoes, setXCondicoes] = useState<any[]>([]);
  const [XPortadores, setXPortadores] = useState<any[]>([]);
  const [XRotas, setXRotas] = useState<any[]>([]);
  const [XTabelas, setXTabelas] = useState<any[]>([]);
  const [XVendedores, setXVendedores] = useState<any[]>([]);

  const set = useCallback((key: string, val: string) => {
    if (lockedFields.includes(key)) return;
    setXF(prev => ({ ...prev, [key]: val }));
  }, [lockedFields]);

  const loadLookups = useCallback(async () => {
    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
      db.from("cidade").select("cidade_id,descricao,uf").eq("excluido", false).order("descricao"),
      db.from("cadastro_grupo").select("cadastro_grupo_id,nome").eq("excluido", false).order("nome"),
      db.from("tipo_cadastro").select("tp_cadastro_id,nome").eq("excluido", false).order("nome"),
      db.from("condicao_pagamento").select("condicao_id,descricao").eq("excluido", false).order("descricao"),
      db.from("portador").select("portador_id,nome").eq("excluido", false).order("nome"),
      db.from("rota").select("rota_id,descricao").eq("excluido", false).order("descricao"),
      db.from("tabela_preco").select("tabela_id,descricao").eq("excluido", false).order("descricao"),
      db.from("cadastro").select("cadastro_id,razao_social").eq("st_vendedor", "S").eq("excluido", false).order("razao_social"),
    ]);
    setXCidades(r1.data || []); setXGrupos(r2.data || []); setXTiposCad(r3.data || []);
    setXCondicoes(r4.data || []); setXPortadores(r5.data || []); setXRotas(r6.data || []);
    setXTabelas(r7.data || []); setXVendedores(r8.data || []);
  }, []);

  const loadData = useCallback(async () => {
    let XQuery = db.from("cadastro").select("*").eq("empresa_id", XEmpresaMatrizId).eq("excluido", false);
    if (dataFilter) {
      if (filterMode === "or") {
        const XParts: string[] = [];
        if (dataFilter.st_cliente) XParts.push(`st_cliente.eq.${dataFilter.st_cliente}`);
        if (dataFilter.st_fornecedor) XParts.push(`st_fornecedor.eq.${dataFilter.st_fornecedor}`);
        if (dataFilter.st_transportador) XParts.push(`st_transportador.eq.${dataFilter.st_transportador}`);
        if (XParts.length > 0) XQuery = XQuery.or(XParts.join(","));
      } else {
        if (dataFilter.st_cliente) XQuery = XQuery.eq("st_cliente", dataFilter.st_cliente);
        if (dataFilter.st_fornecedor) XQuery = XQuery.eq("st_fornecedor", dataFilter.st_fornecedor);
        if (dataFilter.st_transportador) XQuery = XQuery.eq("st_transportador", dataFilter.st_transportador);
      }
    }
    const { data: XRows } = await XQuery.order("cadastro_id");
    ctrl.setXData(XRows || []);
  }, [XEmpresaMatrizId, dataFilter, filterMode, ctrl.setXData]);

  useEffect(() => { if (!skipInitialLoad) loadData(); loadLookups(); }, [XEmpresaMatrizId]);

  useEffect(() => {
    if (ctrl.XCurrentRecord && ctrl.XFormMode === "view") {
      const nf: any = {};
      Object.keys(emptyForm()).forEach(k => {
        const val = ctrl.XCurrentRecord[k];
        if (k.startsWith("dt_") || k === "conj_dt_nasc") nf[k] = formatDateBR(val);
        else nf[k] = val != null ? String(val) : "";
      });
      setXF(nf);
    } else if (ctrl.XFormMode === "insert") {
      setXF({ ...emptyForm(), ...(defaultValues || {}) });
    }
  }, [ctrl.XCurrentRecord, ctrl.XFormMode]);

  const handleBuscarCnpj = async () => {
    const XDigits = XF.cnpj.replace(/\D/g, "");
    if (XDigits.length !== 14) { toast.error("CNPJ inválido para consulta."); return; }
    setXBuscandoCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", { body: { cnpj: XDigits } });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setXF(prev => ({
        ...prev,
        razao_social: (data.company?.name || prev.razao_social).toUpperCase(),
        nome_fantasia: (data.alias || data.company?.name || prev.nome_fantasia).toUpperCase(),
        endereco_logradouro: (data.address?.street || prev.endereco_logradouro).toUpperCase(),
        endereco_numero: (data.address?.number || prev.endereco_numero).toUpperCase(),
        endereco_bairro: (data.address?.district || prev.endereco_bairro).toUpperCase(),
        endereco_cep: (data.address?.zip || prev.endereco_cep).replace(/\D/g, ""),
        fone_geral: data.phones?.[0] ? `${data.phones[0].area}${data.phones[0].number}` : prev.fone_geral,
        email: data.emails?.[0]?.address || prev.email,
      }));
      toast.success("Dados do CNPJ carregados!");
    } catch (err: any) { toast.error("Erro ao consultar: " + err.message); } finally { setXBuscandoCnpj(false); }
  };

  const handleSalvar = async () => {
    if (!XF.razao_social.trim()) { toast.error("A Razão Social é obrigatória."); return; }
    const XCpfCnpj = XF.cnpj.replace(/\D/g, "");
    const toDate = (v: string) => { if (!v) return null; return parseDateBR(v) || v || null; };
    const XPayload: any = { 
      ...XF, 
      empresa_id: XEmpresaMatrizId, 
      cnpj: XCpfCnpj,
      dt_nasc: toDate(XF.dt_nasc),
      conj_dt_nasc: toDate(XF.conj_dt_nasc),
      dt_alteracao: new Date().toISOString()
    };
    
    if (ctrl.XFormMode === "edit" && ctrl.XCurrentRecord) {
      const { error } = await db.from("cadastro").update(XPayload).eq("cadastro_id", ctrl.XCurrentRecord.cadastro_id);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    } else {
      const { error } = await db.from("cadastro").insert(XPayload);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    }
    toast.success("Cadastro salvo!");
    ctrl.setXFormMode("view");
    loadData();
  };

  const renderCadastro = () => (
    <div className="space-y-6">
      {/* Sub-tabs Minimalistas no Padrão RealCommerce */}
      <div className="flex gap-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg w-fit border border-border/40">
        {[
          {id: "geral", icon: <User size={14}/>, label: "Geral"},
          {id: "endereco", icon: <Home size={14}/>, label: "Endereço"},
          {id: "complemento", icon: <FileText size={14}/>, label: "Complemento"},
          {id: "geo", icon: <Globe size={14}/>, label: "Mapa"},
          ...(showVeiculoTab ? [{id: "veiculos", icon: <Truck size={14}/>, label: "Veículos"}] : [])
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setXSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${XSubTab === t.id ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white/40 dark:bg-slate-900/40 p-5 rounded-xl border border-border/40 shadow-sm animate-in fade-in duration-300">
        {XSubTab === "geral" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razão Social / Nome Completo</label>
              <input type="text" value={XF.razao_social} onChange={e => set("razao_social", e.target.value.toUpperCase())} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fantasia</label>
              <input type="text" value={XF.nome_fantasia} onChange={e => set("nome_fantasia", e.target.value.toUpperCase())} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CPF / CNPJ</label>
              <div className="flex items-center gap-1 border-b border-border focus-within:border-primary transition-all">
                <input type="text" value={formatCPFCNPJ(XF.cnpj)} onChange={e => set("cnpj", e.target.value.replace(/\D/g,""))} disabled={!ctrl.XIsEditing} className="w-full bg-transparent py-2 text-sm outline-none" />
                {ctrl.XIsEditing && (
                  <button onClick={handleBuscarCnpj} disabled={XBuscandoCnpj} className="p-1 hover:text-primary disabled:opacity-30">
                    {XBuscandoCnpj ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail</label>
              <input type="email" value={XF.email} onChange={e => set("email", e.target.value.toLowerCase())} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Telefone Principal</label>
              <input type="text" value={formatPhone(XF.fone_geral)} onChange={e => set("fone_geral", e.target.value.replace(/\D/g,""))} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Cadastro</label>
              <select value={XF.tp_cadastro_id} onChange={e => set("tp_cadastro_id", e.target.value)} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-primary">
                <option value="">Selecione...</option>
                {XTiposCad.map(t => <option key={t.tp_cadastro_id} value={t.tp_cadastro_id}>{t.nome}</option>)}
              </select>
            </div>
          </div>
        )}

        {XSubTab === "endereco" && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
             <div className="md:col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CEP</label>
              <div className="flex items-center gap-1 border-b border-border focus-within:border-primary transition-all">
                <input type="text" value={XF.endereco_cep} onChange={e => set("endereco_cep", e.target.value.replace(/\D/g,""))} disabled={!ctrl.XIsEditing} className="w-full bg-transparent py-2 text-sm outline-none" />
                {ctrl.XIsEditing && <button onClick={() => toast.info("Busca CEP")} className="p-1 hover:text-primary"><Search size={14} /></button>}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Logradouro</label>
              <input type="text" value={XF.endereco_logradouro} onChange={e => set("endereco_logradouro", e.target.value.toUpperCase())} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Número</label>
              <input type="text" value={XF.endereco_numero} onChange={e => set("endereco_numero", e.target.value)} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bairro</label>
              <input type="text" value={XF.endereco_bairro} onChange={e => set("endereco_bairro", e.target.value.toUpperCase())} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cidade</label>
              <select value={XF.endereco_cidade_id} onChange={e => set("endereco_cidade_id", e.target.value)} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-primary">
                <option value="">Selecione...</option>
                {XCidades.map(c => <option key={c.cidade_id} value={c.cidade_id}>{c.descricao} - {c.uf}</option>)}
              </select>
            </div>
          </div>
        )}

        {XSubTab === "geo" && (
          <div className="space-y-4">
             <div className="flex items-center gap-4">
                <button onClick={handleObterGeo} disabled={!ctrl.XIsEditing || XBuscandoGeo} className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-30">
                  <MapPin size={14}/> {XBuscandoGeo ? "Obtendo..." : "Obter Localização Atual (GPS)"}
                </button>
                <div className="text-xs text-muted-foreground italic">Lat: {XF.latitude || "---"} | Lng: {XF.longitude || "---"}</div>
             </div>
             <div className="w-full h-80 rounded-xl border border-border overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                {XF.latitude && XF.longitude ? (
                  <iframe width="100%" height="100%" frameBorder="0" scrolling="no" marginHeight={0} marginWidth={0} src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(XF.longitude)-0.005},${Number(XF.latitude)-0.005},${Number(XF.longitude)+0.005},${Number(XF.latitude)+0.005}&layer=mapnik&marker=${XF.latitude},${XF.longitude}`} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-40">
                    <MapPin size={48} />
                    <span className="text-sm font-bold">Mapa não disponível sem coordenadas</span>
                  </div>
                )}
             </div>
          </div>
        )}

        {XSubTab === "veiculos" && showVeiculoTab && (
          <VeiculoGrid cadastroId={ctrl.XCurrentRecord?.cadastro_id || 0} podeEditar={ctrl.XIsEditing} />
        )}
      </div>
    </div>
  );

  return (
    <StandardCrudForm
      ctrl={ctrl}
      title={formTitle}
      onSalvar={handleSalvar}
      onExcluir={handleExcluir}
      onRefresh={loadData}
      renderCadastro={renderCadastro}
      localizarColumns={XLocalizarColumns}
    />
  );
};

export default CadastroCompletoForm;
