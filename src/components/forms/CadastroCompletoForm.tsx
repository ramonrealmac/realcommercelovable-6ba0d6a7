import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import FormDateField from "@/components/shared/FormDateField";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { validateCPF, validateCNPJ, validateCPFOrCNPJ, formatCPFCNPJ, formatPhone, formatDateBR, parseDateBR } from "@/lib/validators";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, MapPin } from "lucide-react";
import VeiculoGrid from "@/components/forms/VeiculoGrid";
import CidadeSearchDialog from "@/components/shared/CidadeSearchDialog";
import { baseService } from "@/utils/baseService";
import { useGridFilter } from "@/hooks/useGridFilter";

const db = supabase as any;

type TFormMode = "view" | "edit" | "insert";

interface ICadastro {
  cadastro_id: number;
  empresa_id: number;
  cnpj: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  nome_curto: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cep: string;
  endereco_compl: string;
  endereco_ptoref: string;
  endereco_cidade_id: number | null;
  fone_geral: string;
  fone_comercial: string;
  fone_financeiro: string;
  fone_faturamento: string;
  condicao_id: number | null;
  funcionario_id: number | null;
  tp_pessoa: string;
  tp_contribuinte: string;
  grupo_cadastro_id: number | null;
  tp_cadastro_id: number | null;
  estado_civil: string;
  conj_nome: string;
  conj_cpf: string;
  conj_dt_nasc: string | null;
  conj_telefone: string;
  rg: string;
  nacionalidade: string;
  portador_id: number | null;
  rota_id: number | null;
  rota_seq: number;
  st_cadastro: string;
  st_cliente: string;
  st_fornecedor: string;
  st_transportador: string;
  dep_nome1: string;
  dep_cpf1: string;
  dep_dt_nasc1: string | null;
  dep_grau_parent1: string;
  dep_nome2: string;
  dep_cpf2: string;
  dep_dt_nasc2: string | null;
  dep_grau_parent2: string;
  dt_nasc: string | null;
  email: string;
  tabela_preco_id: number | null;
  inscricao_municipal: string;
  excluido: boolean;
  latitude: number | null;
  longitude: number | null;
}


export interface ICadastroFormConfig {
  formTitle: string;
  dataFilter?: { st_cliente?: string; st_fornecedor?: string; st_transportador?: string };
  filterMode?: "and" | "or";
  defaultValues?: Partial<Record<string, string>>;
  lockedFields?: string[];
  extraValidation?: (form: Record<string, string>) => string | null;
  showVeiculoTab?: boolean;
  /** Se true, abre automaticamente em modo inserção ao montar o componente */
  autoInsert?: boolean;
  /** Se true, não carrega registros do banco ao inicializar (abre lista vazia) */
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
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("cadastro");
  const [XCadastroInnerTab, setXCadastroInnerTab] = useState<string>("geral");
  const [XData, setXData] = useState<ICadastro[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XF, setXF] = useState(emptyForm());
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XLoading, setXLoading] = useState(false);
  const [XBuscandoCnpj, setXBuscandoCnpj] = useState(false);
  const [XBuscandoCep, setXBuscandoCep] = useState(false);
  const [XBuscandoGeo, setXBuscandoGeo] = useState(false);
  const [XCidadeDlgOpen, setXCidadeDlgOpen] = useState(false);


  // Lookups
  const [XCidades, setXCidades] = useState<any[]>([]);
  const [XGrupos, setXGrupos] = useState<any[]>([]);
  const [XTiposCad, setXTiposCad] = useState<any[]>([]);
  const [XCondicoes, setXCondicoes] = useState<any[]>([]);
  const [XPortadores, setXPortadores] = useState<any[]>([]);
  const [XRotas, setXRotas] = useState<any[]>([]);
  const [XTabelas, setXTabelas] = useState<any[]>([]);
  const [XVendedores, setXVendedores] = useState<any[]>([]);

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const set = useCallback((key: string, val: string) => {
    if (lockedFields.includes(key)) return;
    setXF(prev => ({ ...prev, [key]: val }));
  }, [lockedFields]);

  // Allow free typing of CPF/CNPJ digits without formatting
  const handleCnpjChange = useCallback((XRawValue: string) => {
    const XDigits = XRawValue.replace(/\D/g, "").slice(0, 14);
    setXF(prev => ({ ...prev, cnpj: XDigits }));
  }, []);

  // Format and detect tp_pessoa on blur
  const handleCnpjFormat = useCallback(() => {
    const XDigits = XF.cnpj.replace(/\D/g, "");
    if (!XDigits) return;
    let XTpPessoa = "O";
    if (XDigits.length <= 11) XTpPessoa = "F";
    else XTpPessoa = "J";
    setXF(prev => ({ ...prev, tp_pessoa: XTpPessoa }));
  }, [XF.cnpj]);

  // Check duplicate CPF/CNPJ on blur
  const handleCnpjBlur = useCallback(async () => {
    handleCnpjFormat();
    if (XFormMode !== "insert" && XFormMode !== "edit") return;
    const XDigits = XF.cnpj.replace(/\D/g, "");
    if (XDigits.length < 11) return;

    let XQuery = db
      .from("cadastro")
      .select("cadastro_id, razao_social")
      .eq("empresa_id", XEmpresaMatrizId)
      .eq("cnpj", XDigits)
      .eq("excluido", false);

    // Exclude current record when editing
    if (XFormMode === "edit" && XCurrentRecord) {
      XQuery = XQuery.neq("cadastro_id", XCurrentRecord.cadastro_id);
    }

    const { data: XExisting } = await XQuery.limit(1);

    if (XExisting && XExisting.length > 0) {
      const XWantView = confirm(
        `Já existe um cadastro com este documento:\n"${XExisting[0].razao_social}" (Cód. ${XExisting[0].cadastro_id})\n\nDeseja visualizar o cadastro existente?`
      );
      if (XWantView) {
        const XIdx = XData.findIndex(r => r.cadastro_id === XExisting[0].cadastro_id);
        if (XIdx >= 0) {
          setXCurrentIdx(XIdx);
          setXFormMode("view");
          setXInnerTab("cadastro");
        }
      }
    }
  }, [XF.cnpj, XFormMode, XEmpresaId, XData, XCurrentRecord, handleCnpjFormat]);

  // CNPJ lookup via edge function
  const handleBuscarCnpj = useCallback(async () => {
    const XDigits = XF.cnpj.replace(/\D/g, "");
    if (XF.tp_pessoa === "F" || XDigits.length <= 11) {
      toast.warning("Consulta disponível apenas para pessoa jurídica (CNPJ).");
      return;
    }
    if (XDigits.length !== 14 || !validateCNPJ(XDigits)) {
      toast.error("CNPJ inválido para consulta.");
      return;
    }
    setXBuscandoCnpj(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cnpj", {
        body: { cnpj: XDigits },
      });
      if (error) throw new Error(error.message || "Erro na consulta");
      if (data?.error) throw new Error(data.error);

      setXF(prev => ({
        ...prev,
        razao_social: (data.company?.name || prev.razao_social).toUpperCase(),
        nome_fantasia: (data.alias || data.company?.name || prev.nome_fantasia).toUpperCase(),
        endereco_logradouro: (data.address?.street || prev.endereco_logradouro).toUpperCase(),
        endereco_numero: (data.address?.number || prev.endereco_numero).toUpperCase(),
        endereco_bairro: (data.address?.district || prev.endereco_bairro).toUpperCase(),
        endereco_cep: (data.address?.zip || prev.endereco_cep).replace(/\D/g, ""),
        endereco_compl: (data.address?.details || prev.endereco_compl).toUpperCase(),
        fone_geral: data.phones?.[0] ? `${data.phones[0].area}${data.phones[0].number}` : prev.fone_geral,
        email: data.emails?.[0]?.address || prev.email,
        inscricao_estadual: data.registrations?.[0]?.number || prev.inscricao_estadual,
      }));
      toast.success("Dados do CNPJ carregados com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao consultar CNPJ: " + (err.message || "Falha na consulta"));
    } finally {
      setXBuscandoCnpj(false);
    }
  }, [XF.cnpj, XF.tp_pessoa]);

  // CEP lookup via ViaCEP edge function
  const handleBuscarCep = useCallback(async () => {
    const XDigits = XF.endereco_cep.replace(/\D/g, "");
    if (XDigits.length !== 8) {
      toast.error("CEP deve ter 8 dígitos.");
      return;
    }
    setXBuscandoCep(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cep", {
        body: { cep: XDigits },
      });
      if (error) throw new Error(error.message || "Erro na consulta");
      if (data?.error) throw new Error(data.error);

      setXF(prev => ({
        ...prev,
        endereco_logradouro: (data.logradouro || prev.endereco_logradouro).toUpperCase(),
        endereco_bairro: (data.bairro || prev.endereco_bairro).toUpperCase(),
        endereco_compl: (data.complemento || prev.endereco_compl).toUpperCase(),
      }));

      // Try to match cidade
      if (data.localidade) {
        const XCidadeMatch = XCidades.find((c: any) =>
          c.descricao.toUpperCase() === data.localidade.toUpperCase() &&
          (!data.uf || c.uf?.toUpperCase() === data.uf.toUpperCase())
        );
        if (XCidadeMatch) {
          setXF(prev => ({ ...prev, endereco_cidade_id: String(XCidadeMatch.cidade_id) }));
        }
      }

      toast.success("Endereço carregado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao consultar CEP: " + (err.message || "Falha na consulta"));
    } finally {
      setXBuscandoCep(false);
    }
  }, [XF.endereco_cep, XCidades]);

  // GPS Geolocation
  const handleObterGeo = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste navegador.");
      return;
    }
    setXBuscandoGeo(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setXF(prev => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        toast.success("Coordenadas obtidas com sucesso!");
        setXBuscandoGeo(false);
      },
      (err) => {
        toast.error("Erro ao obter localização: " + err.message);
        setXBuscandoGeo(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

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
    setXCidades(r1.data || []);
    setXGrupos(r2.data || []);
    setXTiposCad(r3.data || []);
    setXCondicoes(r4.data || []);
    setXPortadores(r5.data || []);
    setXRotas(r6.data || []);
    setXTabelas(r7.data || []);
    setXVendedores(r8.data || []);
  }, []);

  const loadData = useCallback(async () => {
    setXLoading(true);
    let XQuery = db
      .from("cadastro")
      .select("*")
      .eq("empresa_id", XEmpresaMatrizId)
      .eq("excluido", false);

    // Apply data filters
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
    setXData(XRows || []);
    setXLoading(false);
  }, [XEmpresaMatrizId, dataFilter, filterMode]);

  useEffect(() => {
    if (!skipInitialLoad) loadData();
    loadLookups();
    setXCurrentIdx(0);
    setXFormMode("view");
  }, [XEmpresaMatrizId]);

  // Auto-insert: dispara DEPOIS do effect acima via setTimeout(0)
  useEffect(() => {
    if (autoInsert) {
      const XDefaults = { ...emptyForm(), ...(defaultValues || {}) };
      // setTimeout garante execução após todos os effects síncronos do mount
      setTimeout(() => {
        setXFormMode("insert");
        setXF(XDefaults);
        setXInnerTab("cadastro");
        setXCadastroInnerTab("geral");
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // executa apenas na montagem

  // Populate form when editing
  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      const XNf: Record<string, string> = {};
      for (const key of Object.keys(emptyForm())) {
        const XVal = (XCurrentRecord as any)[key];
        if (key.startsWith("dt_") || key.startsWith("dep_dt_") || key === "conj_dt_nasc") {
          XNf[key] = formatDateBR(XVal);
        } else {
          XNf[key] = XVal != null ? String(XVal) : "";
        }
      }
      setXF(XNf);
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => {
    const XDefaults = { ...emptyForm(), ...(defaultValues || {}) };
    setXFormMode("insert");
    setXF(XDefaults);
    setXInnerTab("cadastro");
    setXCadastroInnerTab("geral");

  };

  const handleEditar = () => {
    if (!XCurrentRecord) return;
    setXFormMode("edit");
    setXInnerTab("cadastro");
    setXCadastroInnerTab("geral");

  };

  const handleSalvar = async () => {
    if (!XF.razao_social.trim()) {
      toast.error("A Razão Social é obrigatória.");
      return;
    }
    const XCpfCnpj = XF.cnpj.replace(/\D/g, "");
    if (XCpfCnpj && !validateCPFOrCNPJ(XCpfCnpj)) {
      toast.error("CPF/CNPJ inválido.");
      return;
    }

    // Check duplicate CPF/CNPJ before saving
    if (XCpfCnpj) {
      let XDupQuery = db
        .from("cadastro")
        .select("cadastro_id, razao_social")
        .eq("empresa_id", XEmpresaMatrizId)
        .eq("cnpj", XCpfCnpj)
        .eq("excluido", false);
      if (XFormMode === "edit" && XCurrentRecord) {
        XDupQuery = XDupQuery.neq("cadastro_id", XCurrentRecord.cadastro_id);
      }
      const { data: XDup } = await XDupQuery.limit(1);
      if (XDup && XDup.length > 0) {
        toast.error(`CPF/CNPJ já cadastrado para "${XDup[0].razao_social}" (Cód. ${XDup[0].cadastro_id}). Não é permitido duplicidade.`);
        return;
      }
    }

    // Extra validation from config
    if (extraValidation) {
      const XMsg = extraValidation(XF);
      if (XMsg) {
        toast.error(XMsg);
        return;
      }
    }

    const toNull = (v: string) => v.trim() || null;
    const toInt = (v: string) => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const toFloat = (v: string) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const toDate = (v: string) => {
      if (!v) return null;
      const XParsed = parseDateBR(v);
      return XParsed || v || null;
    };

    const XPayload: any = {
      empresa_id: XEmpresaMatrizId,
      cnpj: XCpfCnpj || "",
      inscricao_estadual: toNull(XF.inscricao_estadual) || "",
      razao_social: XF.razao_social.trim(),
      nome_fantasia: toNull(XF.nome_fantasia) || "",
      nome_curto: toNull(XF.nome_curto) || "",
      endereco_logradouro: toNull(XF.endereco_logradouro) || "",
      endereco_numero: toNull(XF.endereco_numero) || "",
      endereco_bairro: toNull(XF.endereco_bairro) || "",
      endereco_cep: toNull(XF.endereco_cep) || "",
      endereco_compl: toNull(XF.endereco_compl) || "",
      endereco_ptoref: toNull(XF.endereco_ptoref) || "",
      endereco_cidade_id: toInt(XF.endereco_cidade_id),
      fone_geral: XF.fone_geral.replace(/\D/g, "") || "",
      fone_comercial: XF.fone_comercial.replace(/\D/g, "") || "",
      fone_financeiro: XF.fone_financeiro.replace(/\D/g, "") || "",
      fone_faturamento: XF.fone_faturamento.replace(/\D/g, "") || "",
      condicao_id: toInt(XF.condicao_id),
      funcionario_id: toInt(XF.funcionario_id),
      tp_pessoa: XF.tp_pessoa || "F",
      tp_contribuinte: XF.tp_contribuinte || "N",
      grupo_cadastro_id: toInt(XF.grupo_cadastro_id),
      tp_cadastro_id: toInt(XF.tp_cadastro_id),
      estado_civil: toNull(XF.estado_civil) || "",
      conj_nome: toNull(XF.conj_nome) || "",
      conj_cpf: XF.conj_cpf.replace(/\D/g, "") || "",
      conj_dt_nasc: toDate(XF.conj_dt_nasc),
      conj_telefone: XF.conj_telefone.replace(/\D/g, "") || "",
      rg: toNull(XF.rg) || "",
      nacionalidade: toNull(XF.nacionalidade) || "BRASILEIRA",
      portador_id: toInt(XF.portador_id),
      rota_id: toInt(XF.rota_id),
      rota_seq: parseInt(XF.rota_seq) || 0,
      st_cadastro: XF.st_cadastro || "A",
      st_cliente: XF.st_cliente || "S",
      st_fornecedor: XF.st_fornecedor || "N",
      st_transportador: XF.st_transportador || "N",
      dep_nome1: toNull(XF.dep_nome1) || "",
      dep_cpf1: XF.dep_cpf1.replace(/\D/g, "") || "",
      dep_dt_nasc1: toDate(XF.dep_dt_nasc1),
      dep_grau_parent1: toNull(XF.dep_grau_parent1) || "",
      dep_nome2: toNull(XF.dep_nome2) || "",
      dep_cpf2: XF.dep_cpf2.replace(/\D/g, "") || "",
      dep_dt_nasc2: toDate(XF.dep_dt_nasc2),
      dep_grau_parent2: toNull(XF.dep_grau_parent2) || "",
      dt_nasc: toDate(XF.dt_nasc),
      email: toNull(XF.email) || "",
      tabela_preco_id: toInt(XF.tabela_preco_id),
      inscricao_municipal: toNull(XF.inscricao_municipal) || "",
      latitude: toFloat(XF.latitude),
      longitude: toFloat(XF.longitude),
    };

    let XSavedCadastroId: number | null = null;

    if (XFormMode === "edit" && XCurrentRecord) {
      const { error } = await db.from("cadastro").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("cadastro_id", XCurrentRecord.cadastro_id);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      XSavedCadastroId = XCurrentRecord.cadastro_id;
    } else {
      const { data: XInserted, error } = await db.from("cadastro").insert(XPayload).select("cadastro_id").single();
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      XSavedCadastroId = XInserted?.cadastro_id || null;
    }

    toast.success(XFormMode === "edit" ? "Cadastro alterado com sucesso." : "Cadastro incluído com sucesso.");
    setXFormMode("view");
    await loadData();
  };


  const handleCancelar = () => setXFormMode("view");

  const handleExcluir = async () => {
    if (!XCurrentRecord) return;
    if (!confirm(`Deseja realmente excluir "${XCurrentRecord.razao_social}"?`)) return;
    await baseService.excluirLogico("cadastro", "cadastro_id", XCurrentRecord.cadastro_id);
    toast.success("Cadastro excluído com sucesso.");
    await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XData.length - 1);

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
    const XIdx = XData.findIndex(r => r.cadastro_id === XRow.cadastro_id);
    if (XIdx >= 0) {
      setXCurrentIdx(XIdx);
      setXInnerTab("cadastro");
      setXFormMode("view");
    }
  };

  // Field rendering helpers
  const XFieldBgEdit = "bg-card";
  const XFieldBgRead = "bg-secondary";

  const renderReadField = (label: string, value: string | number | null | undefined, className?: string) => (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type="text" value={value ?? ""} readOnly className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`} />
    </div>
  );

  const renderEditField = (label: string, key: string, options?: { required?: boolean; placeholder?: string; className?: string; noUppercase?: boolean }) => {
    const XIsLocked = lockedFields.includes(key);
    return (
      <div className={options?.className}>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {label} {options?.required && <span className="text-destructive">*</span>}
        </label>
        <input
          type="text"
          value={XF[key] || ""}
          onChange={(e) => set(key, options?.noUppercase ? e.target.value : e.target.value.toUpperCase())}
          readOnly={XIsLocked}
          placeholder={options?.placeholder}
          className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XIsLocked ? XFieldBgRead : XFieldBgEdit} focus:ring-2 focus:ring-ring outline-none`}
        />
      </div>
    );
  };

  const renderField = (label: string, key: string, options?: { required?: boolean; placeholder?: string; className?: string; noUppercase?: boolean }) => {
    if (XIsEditing) return renderEditField(label, key, options);
    return renderReadField(label, XCurrentRecord ? (XCurrentRecord as any)[key] : "", options?.className);
  };

  const renderSelect = (label: string, key: string, items: { v: string; l: string }[]) => {
    if (!XIsEditing) {
      const XDisplay = items.find(i => i.v === (XCurrentRecord as any)?.[key])?.l || (XCurrentRecord as any)?.[key] || "";
      return renderReadField(label, XDisplay);
    }
    const XIsLocked = lockedFields.includes(key);
    return (
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <Select value={XF[key] || ""} onValueChange={(v) => set(key, v)} disabled={XIsLocked}>
          <SelectTrigger className={`h-[34px] text-sm ${XIsLocked ? XFieldBgRead : XFieldBgEdit}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderLookup = (label: string, key: string, items: any[], valueKey: string, labelKey: string) => {
    if (!XIsEditing) {
      const XId = XCurrentRecord ? (XCurrentRecord as any)[key] : null;
      const XItem = items.find((i: any) => i[valueKey] === XId);
      return renderReadField(label, XItem ? XItem[labelKey] : "");
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

  const renderDateField = (label: string, key: string) => {
    if (!XIsEditing) {
      return renderReadField(label, formatDateBR(XCurrentRecord ? (XCurrentRecord as any)[key] : null));
    }
    return <FormDateField label={label} value={XF[key] || ""} onChange={(v) => set(key, v)} />;
  };

  const XCadTabs = useMemo(() => {
    const XBase = ["geral", "endereco", "complemento", "geo"];
    if (showVeiculoTab) XBase.push("veiculos");
    return XBase;
  }, [showVeiculoTab]);

  const XCadTabLabels: Record<string, string> = {
    geral: "Dados Gerais",
    endereco: "Endereço / Contato",
    complemento: "Complemento",
    geo: "Geolocalização",
    veiculos: "Veículos",
  };

  // Map URL for geolocation
  const XMapLat = XIsEditing ? XF.latitude : (XCurrentRecord?.latitude != null ? String(XCurrentRecord.latitude) : "");
  const XMapLng = XIsEditing ? XF.longitude : (XCurrentRecord?.longitude != null ? String(XCurrentRecord.longitude) : "");
  const XMapUrl = XMapLat && XMapLng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(XMapLng) - 0.005}%2C${Number(XMapLat) - 0.005}%2C${Number(XMapLng) + 0.005}%2C${Number(XMapLat) + 0.005}&layer=mapnik&marker=${XMapLat}%2C${XMapLng}`
    : "";


  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
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
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={handleRefresh}
        onLocalizar={() => setXInnerTab("localizar")}
        onSair={handleSair}
      />

      {/* Inner tabs: Cadastro / Localizar */}
      <div className="flex border-b border-border bg-card">
        {(["cadastro", "localizar"] as const).map(t => (
          <button
            key={t}
            className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            onClick={() => setXInnerTab(t)}
          >
            {t === "cadastro" ? formTitle : "Localizar"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-3">
            {/* Código + CPF/CNPJ + Busca + Razão Social */}
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-28">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input
                  type="text"
                  value={XFormMode === "insert" ? "(Novo)" : XCurrentRecord?.cadastro_id ?? ""}
                  readOnly
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead} text-right`}
                />
              </div>
              <div className="w-full md:w-[13.5rem]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input
                  type="text"
                  value={(() => { const em = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId); return em ? `${em.empresa_id} - ${em.identificacao}` : String(XEmpresaMatrizId); })()}
                  readOnly
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`}
                />
              </div>
              <div className="w-full md:w-52">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {(XIsEditing ? XF.tp_pessoa : XCurrentRecord?.tp_pessoa) === "J" ? "CNPJ" : (XIsEditing ? XF.tp_pessoa : XCurrentRecord?.tp_pessoa) === "F" ? "CPF" : "CPF/CNPJ"}
                </label>
                <div className="flex gap-1">
                  {XIsEditing ? (
                    <input
                      type="text"
                      value={XF.cnpj ? formatCPFCNPJ(XF.cnpj) : ""}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      onBlur={handleCnpjBlur}
                      placeholder="CPF ou CNPJ"
                      maxLength={18}
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgEdit} focus:ring-2 focus:ring-ring outline-none`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={XCurrentRecord?.cnpj ? formatCPFCNPJ(XCurrentRecord.cnpj) : ""}
                      readOnly
                      className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`}
                    />
                  )}
                  {XIsEditing && (
                    <button
                      type="button"
                      onClick={handleBuscarCnpj}
                      disabled={XBuscandoCnpj}
                      className={`flex items-center justify-center w-9 h-[34px] border border-border rounded ${XFieldBgEdit} hover:bg-accent disabled:opacity-50`}
                      title="Consultar CNPJ"
                    >
                      {XBuscandoCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1">
                {renderField("Razão Social", "razao_social", { required: true })}
              </div>
            </div>

            {/* Sub-tabs for form sections */}
            <div className="flex border-b border-border flex-wrap">
              {XCadTabs.map(t => (
                <button
                  key={t}
                  className={`px-4 py-1.5 text-xs font-medium border-b-2 ${XCadastroInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => setXCadastroInnerTab(t)}
                >
                  {XCadTabLabels[t]}
                </button>
              ))}
            </div>

            {/* === ABA DADOS GERAIS === */}
            {XCadastroInnerTab === "geral" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderSelect("Tipo Pessoa", "tp_pessoa", [{ v: "O", l: "Outros" }, { v: "F", l: "Física" }, { v: "J", l: "Jurídica" }])}
                  {renderField("RG", "rg")}
                  {renderField("Insc. Estadual", "inscricao_estadual")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField("Nome Fantasia", "nome_fantasia")}
                  {renderField("Nome Curto", "nome_curto")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField("Insc. Municipal", "inscricao_municipal")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderSelect("Status", "st_cadastro", [{ v: "A", l: "Ativo" }, { v: "I", l: "Inativo" }])}
                  {renderSelect("Cliente?", "st_cliente", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Fornecedor?", "st_fornecedor", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                  {renderSelect("Transportador?", "st_transportador", [{ v: "S", l: "Sim" }, { v: "N", l: "Não" }])}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderSelect("Contribuinte", "tp_contribuinte", [{ v: "N", l: "Não Contribuinte" }, { v: "C", l: "Contribuinte" }, { v: "I", l: "Isento" }])}
                  {renderLookup("Grupo Cadastro", "grupo_cadastro_id", XGrupos, "cadastro_grupo_id", "nome")}
                  {renderLookup("Tipo Cadastro", "tp_cadastro_id", XTiposCad, "tp_cadastro_id", "nome")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderField("E-mail", "email", { placeholder: "email@exemplo.com" })}
                  {renderDateField("Dt. Nascimento", "dt_nasc")}
                  {renderField("Nacionalidade", "nacionalidade")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderSelect("Estado Civil", "estado_civil", [
                    { v: "S", l: "Solteiro(a)" }, { v: "C", l: "Casado(a)" },
                    { v: "D", l: "Divorciado(a)" }, { v: "V", l: "Viúvo(a)" },
                  ])}
                  {renderLookup("Tabela de Preço", "tabela_preco_id", XTabelas, "tabela_id", "descricao")}
                  {renderLookup("Cond. Pagamento", "condicao_id", XCondicoes, "condicao_id", "descricao")}
                </div>
              </div>
            )}

            {/* === ABA ENDEREÇO / CONTATO === */}
            {XCadastroInnerTab === "endereco" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* CEP with search button */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CEP</label>
                    <div className="flex gap-1">
                      {XIsEditing ? (
                        <input
                          type="text"
                          value={XF.endereco_cep || ""}
                          onChange={(e) => set("endereco_cep", e.target.value.replace(/\D/g, ""))}
                          placeholder="00000-000"
                          maxLength={9}
                          className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgEdit} focus:ring-2 focus:ring-ring outline-none`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={XCurrentRecord?.endereco_cep || ""}
                          readOnly
                          className={`w-full border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`}
                        />
                      )}
                      {XIsEditing && (
                        <button
                          type="button"
                          onClick={handleBuscarCep}
                          disabled={XBuscandoCep}
                          className={`flex items-center justify-center w-9 h-[34px] border border-border rounded ${XFieldBgEdit} hover:bg-accent disabled:opacity-50`}
                          title="Consultar CEP"
                        >
                          {XBuscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Cidade — campo com pesquisa */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Cidade</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={XIsEditing ? (XF.endereco_cidade_id || "") : (XCurrentRecord?.endereco_cidade_id ?? "")}
                        readOnly
                        className={`w-20 border border-border rounded px-2 py-1.5 text-sm ${XFieldBgRead} text-right`}
                      />
                      <input
                        type="text"
                        value={(() => {
                          const id = XIsEditing ? parseInt(XF.endereco_cidade_id) : XCurrentRecord?.endereco_cidade_id;
                          if (!id) return "";
                          const c = XCidades.find((x: any) => x.cidade_id === id);
                          return c ? `${c.descricao}${c.uf ? " - " + c.uf : ""}` : "";
                        })()}
                        readOnly
                        className={`flex-1 border border-border rounded px-3 py-1.5 text-sm ${XFieldBgRead}`}
                      />
                      {XIsEditing && (
                        <button
                          type="button"
                          onClick={() => setXCidadeDlgOpen(true)}
                          className={`flex items-center justify-center w-9 h-[34px] border border-border rounded ${XFieldBgEdit} hover:bg-accent`}
                          title="Pesquisar Cidade"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      )}
                      {XIsEditing && XF.endereco_cidade_id && (
                        <button
                          type="button"
                          onClick={() => set("endereco_cidade_id", "")}
                          className={`flex items-center justify-center w-9 h-[34px] border border-border rounded ${XFieldBgEdit} hover:bg-accent`}
                          title="Limpar"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Logradouro", "endereco_logradouro", { className: "md:col-span-2" })}
                  {renderField("Número", "endereco_numero")}
                  {renderField("Bairro", "endereco_bairro")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderField("Complemento", "endereco_compl")}
                  {renderField("Ponto de Referência", "endereco_ptoref")}
                </div>

                <h3 className="text-sm font-semibold text-muted-foreground pt-2">Telefones</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Fone Geral", "fone_geral", { placeholder: "(00) 00000-0000" })}
                  {renderField("Fone Comercial", "fone_comercial")}
                  {renderField("Fone Financeiro", "fone_financeiro")}
                  {renderField("Fone Faturamento", "fone_faturamento")}
                </div>

                <h3 className="text-sm font-semibold text-muted-foreground pt-2">Vínculos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {renderLookup("Vendedor (Funcionário)", "funcionario_id", XVendedores, "cadastro_id", "razao_social")}
                  {renderLookup("Portador", "portador_id", XPortadores, "portador_id", "nome")}
                  {renderLookup("Rota", "rota_id", XRotas, "rota_id", "descricao")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Seq. Rota", "rota_seq")}
                </div>
              </div>
            )}

            {/* === ABA COMPLEMENTO === */}
            {XCadastroInnerTab === "complemento" && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Cônjuge</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Nome Cônjuge", "conj_nome", { className: "md:col-span-2" })}
                  {renderField("CPF Cônjuge", "conj_cpf")}
                  {renderDateField("Dt. Nasc. Cônjuge", "conj_dt_nasc")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Telefone Cônjuge", "conj_telefone")}
                </div>

                <h3 className="text-sm font-semibold text-muted-foreground pt-4">Dependente 1</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Nome", "dep_nome1", { className: "md:col-span-2" })}
                  {renderField("CPF", "dep_cpf1")}
                  {renderDateField("Dt. Nascimento", "dep_dt_nasc1")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Grau Parentesco", "dep_grau_parent1")}
                </div>

                <h3 className="text-sm font-semibold text-muted-foreground pt-4">Dependente 2</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Nome", "dep_nome2", { className: "md:col-span-2" })}
                  {renderField("CPF", "dep_cpf2")}
                  {renderDateField("Dt. Nascimento", "dep_dt_nasc2")}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {renderField("Grau Parentesco", "dep_grau_parent2")}
                </div>
              </div>
            )}

            {/* === ABA GEOLOCALIZAÇÃO === */}
            {XCadastroInnerTab === "geo" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  {renderField("Latitude", "latitude", { noUppercase: true })}
                  {renderField("Longitude", "longitude", { noUppercase: true })}
                  {XIsEditing && (
                    <div>
                      <button
                        type="button"
                        onClick={handleObterGeo}
                        disabled={XBuscandoGeo}
                        className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium border border-border rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        {XBuscandoGeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                        Obter Coordenadas GPS
                      </button>
                    </div>
                  )}
                </div>

                {/* Map display */}
                {XMapUrl ? (
                  <div className="border border-border rounded overflow-hidden">
                    <iframe
                      title="Mapa de Localização"
                      src={XMapUrl}
                      width="100%"
                      height="400"
                      className="border-0"
                      loading="lazy"
                    />
                    <div className="p-2 text-xs text-muted-foreground bg-secondary">
                      📍 Lat: {XMapLat} | Lng: {XMapLng}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded text-muted-foreground">
                    <MapPin className="h-12 w-12 mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma coordenada disponível.</p>
                    {XIsEditing && <p className="text-xs mt-1">Clique em "Obter Coordenadas GPS" para capturar a localização.</p>}
                  </div>
                )}
              </div>
            )}

            {/* === ABA VEÍCULOS === */}
            {XCadastroInnerTab === "veiculos" && showVeiculoTab && XCurrentRecord && (
              <VeiculoGrid XEmpresaId={XEmpresaId} XCadastroId={XCurrentRecord.cadastro_id} />
            )}
          </div>
        ) : (
          <DataGrid
            columns={XLocalizarColumns}
            data={XFilteredData}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={(row) => handleSelectFromSearch(row)}
            maxHeight="400px"
            exportTitle={formTitle}
          />
        )}
      </div>

      <CidadeSearchDialog
        open={XCidadeDlgOpen}
        onClose={() => setXCidadeDlgOpen(false)}
        onSelect={(c) => {
          set("endereco_cidade_id", String(c.cidade_id));
          // garante que a cidade esteja na lista para exibir o nome
          setXCidades(prev => prev.find((x: any) => x.cidade_id === c.cidade_id)
            ? prev
            : [...prev, { cidade_id: c.cidade_id, descricao: c.descricao, uf: c.estado_id }]);
        }}
      />
    </div>
  );
};

export default CadastroCompletoForm;
