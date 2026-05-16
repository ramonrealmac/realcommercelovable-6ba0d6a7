import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import FormToolbar from "@/components/shared/FormToolbar";
import type { TFormMode } from "@/hooks/useCrudController";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RotateCcw, Copy, Eye, Palette, Clock, Link2, Upload, Plus, Download, Search, Bot
} from "lucide-react";
import CidadeSearchDialog from "@/components/shared/CidadeSearchDialog";
import { useRef } from "react";

const db = supabase as any;

/* ── helpers ── */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const REGIME_OPTIONS = [
  { value: "S", label: "Simples Nacional" },
  { value: "N", label: "Normal" },
  { value: "L", label: "Lucro Presumido" },
];

const COLOR_FIELDS = [
  { key: "cor_primaria", label: "Cor Primária" },
  { key: "cor_secundaria", label: "Cor Secundária" },
  { key: "cor_destaque", label: "Cor Destaque" },
  { key: "cor_fundo", label: "Cor de Fundo" },
  { key: "cor_fundo_card", label: "Fundo dos Cards" },
  { key: "cor_texto_principal", label: "Texto Principal" },
  { key: "cor_texto_secundario", label: "Texto Secundário" },
  { key: "cor_botao", label: "Botões" },
  { key: "cor_botao_negativo", label: "Botão Negativo" },
  { key: "cor_header", label: "Header" },
  { key: "cor_menu", label: "Menu" },
  { key: "cor_link", label: "Links" },
  // Textbox
  { key: "cor_input_fundo", label: "Campo Editável (fundo)" },
  { key: "cor_input_readonly", label: "Campo Somente Leitura (fundo)" },
  { key: "cor_input_borda", label: "Campo Moldura/Borda" },
  { key: "cor_input_label", label: "Label dos Campos" },
];

const DEFAULT_COLORS: Record<string, string> = {
  cor_primaria: "#8B5CF6", cor_secundaria: "#6D28D9", cor_destaque: "#F59E0B",
  cor_fundo: "#FFFFFF", cor_fundo_card: "#F8FAFC", cor_texto_principal: "#1E293B",
  cor_texto_secundario: "#64748B", cor_botao: "#8B5CF6", cor_botao_negativo: "#EF4444",
  cor_header: "#7C3AED", cor_menu: "#4C1D95", cor_link: "#8B5CF6",
  // Textbox
  cor_input_fundo: "#FFFFFF",
  cor_input_readonly: "#F1F5F9",
  cor_input_borda: "#CBD5E1",
  cor_input_label: "#64748B",
};

const XLocalizarColumns: IGridColumn[] = [
  { key: "empresa_id", label: "Código", width: "80px", align: "right" },
  { key: "razao_social", label: "Razão Social", width: "1fr" },
  { key: "nome_fantasia", label: "Nome Fantasia", width: "1fr" },
  { key: "cnpj", label: "CNPJ", width: "160px" },
];

interface Horario {
  id: number;
  dia_semana: number;
  hr_inicio_matutino: string | null;
  hr_fim_matutino: string | null;
  hr_inicio_vespertino: string | null;
  hr_fim_vespertino: string | null;
  hr_inicio_noturno: string | null;
  hr_fim_noturno: string | null;
  lg_dia_ativo: boolean;
}

const emptyEmpresa = () => ({
  empresa_id: 0,
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  ie: "",
  identificacao: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_bairro: "",
  endereco_cep: "",
  endereco_cidade_id: 0,
  empresa_matriz_id: null as number | null,
  
  fone_geral: "",
  fone_comercial: "",
  fone_financeiro: "",
  fone_faturamento: "",
  regime_trib: "S",
  vl_venda_qt_decimais: 2,
  qt_venda_qt_decimais: 2,
  vl_saida_qt_decimais: 2,
  qt_saida_qt_decimais: 2,
  excluido: false,
  // Color / theme fields
  cor_primaria: "#8B5CF6",
  cor_secundaria: "#6D28D9",
  cor_destaque: "#F59E0B",
  cor_fundo: "#FFFFFF",
  cor_fundo_card: "#F8FAFC",
  cor_texto_principal: "#1E293B",
  cor_texto_secundario: "#64748B",
  cor_botao: "#8B5CF6",
  cor_botao_negativo: "#EF4444",
  cor_header: "#7C3AED",
  cor_link: "#8B5CF6",
  cor_menu: "#4C1D95",
  nm_escola: "Escola",
  url_logo: "",
  url_favicon: "",
  url_banner_vendas: "",
  url_link_vendas: "",
  msg_pos_pagamento: "",
  lg_valida_estoque_link: true,
  lg_valida_estoque_pdv: false,
  email_remetente: "",
  css_customizado: "",
  logomarca: "",
  // Textbox
  cor_input_label: "#64748B",
  // New fields
  abacatepay_api_key: "",
  abacatepay_webhook_secret: "",
  abacatepay_webhook_url: "",
  centro_custo_caixa: 0,
  conta_gerencial_caixa: null as number | null,
  deposito_estoque_caixa: 0,
  empresa_deposito_caixa: null as number | null,
  tp_operacao_caixa: 0,
  imagem_caixa: "",
  valida_estoque: "",
  ia_ativa: false,
  ia_instrucoes: "",
  ia_modelo: "gpt-4o",
});

type TEmpresa = ReturnType<typeof emptyEmpresa>;

const EmpresaForm: React.FC = () => {
  const { XEmpresaId, XTabs, XActiveTabId, closeTab } = useAppContext();

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<string>("cadastro");
  const [XData, setXData] = useState<TEmpresa[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XEdit, setXEdit] = useState<TEmpresa>(emptyEmpresa());
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  // Empresas lookup (for empresa_matriz)
  const [XEmpresasLookup, setXEmpresasLookup] = useState<{ empresa_id: number; razao_social: string }[]>([]);

  // Cidades lookup (dialog)
  const [XCidadeSearchOpen, setXCidadeSearchOpen] = useState(false);
  const [XCidadeDescricao, setXCidadeDescricao] = useState("");

  // Depositos lookup
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);

  // Horários
  const [XHorarios, setXHorarios] = useState<Horario[]>([]);

  /* ── Load ── */
  const loadData = useCallback(async () => {
    const { data } = await db.from("empresa").select("*").eq("excluido", false).order("empresa_id");
    if (data) setXData(data);
  }, []);

  const loadLookups = useCallback(async () => {
    const [empRes, depRes] = await Promise.all([
      db.from("empresa").select("empresa_id, razao_social").eq("excluido", false).order("razao_social"),
      db.from("deposito").select("deposito_id, nome").eq("excluido", false).order("nome"),
    ]);
    if (empRes.data) setXEmpresasLookup(empRes.data);
    if (depRes.data) setXDepositos(depRes.data);
  }, []);

  const loadHorarios = useCallback(async (empresaId: number) => {
    const { data: h } = await db.from("empresa_hs_lojavirtual").select("*").eq("empresa_id", empresaId).order("dia_semana");
    if (h) setXHorarios(h);
    else setXHorarios([]);
  }, []);

  const handleGerarHorarios = async () => {
    const empresaId = XFormMode === "insert" ? null : XCurrent?.empresa_id;
    if (!empresaId) { toast.error("Salve a empresa antes de gerar horários."); return; }
    const rows = Array.from({ length: 7 }, (_, i) => ({
      empresa_id: empresaId,
      dia_semana: i,
      hr_inicio_matutino: "00:00",
      hr_fim_matutino: "00:00",
      hr_inicio_vespertino: "00:00",
      hr_fim_vespertino: "00:00",
      hr_inicio_noturno: "00:00",
      hr_fim_noturno: "00:00",
      lg_dia_ativo: false,
    }));
    const { error } = await db.from("empresa_hs_lojavirtual").insert(rows);
    if (error) { toast.error("Erro ao gerar horários: " + error.message); return; }
    toast.success("Horários gerados com sucesso!");
    await loadHorarios(empresaId);
  };

  useEffect(() => {
    loadData();
    loadLookups();
  }, [loadData, loadLookups]);

  const XCurrent = XData[XCurrentIdx] || null;

  // Load horarios when current record changes
  useEffect(() => {
    if (XCurrent) {
      loadHorarios(XCurrent.empresa_id);
    }
  }, [XCurrent?.empresa_id, loadHorarios]);

  useEffect(() => {
    if (XCurrent && XFormMode === "edit") {
      setXEdit({ ...emptyEmpresa(), ...XCurrent });
    }
  }, [XCurrent, XFormMode]);

  // Load city name when city ID changes
  useEffect(() => {
    const cityId = XIsEditing ? XEdit.endereco_cidade_id : XCurrent?.endereco_cidade_id;
    if (cityId) {
      db.from("cidade").select("descricao").eq("cidade_id", cityId).maybeSingle().then(({ data }: any) => {
        if (data) setXCidadeDescricao(data.descricao);
        else setXCidadeDescricao("");
      });
    } else {
      setXCidadeDescricao("");
    }
  }, [XIsEditing, XEdit.endereco_cidade_id, XCurrent?.endereco_cidade_id]);

  /* ── hexToHsl helper ── */
  const hexToHsl = (hex: string) => {
    const r2 = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!r2) return "";
    let r = parseInt(r2[1], 16) / 255, g = parseInt(r2[2], 16) / 255, b = parseInt(r2[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) { const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  /* ── CRUD ── */
  const handleIncluir = () => {
    setXFormMode("insert");
    setXEdit(emptyEmpresa());
    setXInnerTab("cadastro");
  };

  const handleEditar = () => {
    if (!XCurrent) return;
    setXFormMode("edit");
    setXEdit({ ...emptyEmpresa(), ...XCurrent });
    setXInnerTab("cadastro");
  };

  const handleSalvar = async () => {
    console.log("[EmpresaForm] 🚀 Botão Salvar clicado!");
    
    if (!XEdit.razao_social || !XEdit.razao_social.trim()) {
      console.warn("[EmpresaForm] ⚠️ Validação falhou: Razão Social vazia.");
      toast.error("Razão Social é obrigatória.");
      return;
    }

    const payload: any = { ...XEdit };
    // Prioriza o ID do XEdit para garantir que estamos salvando o registro correto que está na tela
    const empresaIdToSave = XFormMode === "insert" ? null : XEdit.empresa_id;
    
    delete payload.empresa_id;
    delete payload.dt_cadastro;
    delete payload.dt_alteracao; // Deletamos para não mandar o valor antigo
    payload.dt_alteracao = new Date().toISOString();

    console.log(`[EmpresaForm] 💾 Tentando salvar Empresa ID: ${empresaIdToSave}`, payload);

    try {
      if (XFormMode === "insert") {
        const { error, data } = await db.from("empresa").insert([payload]).select();
        if (error) {
          console.error("[EmpresaForm] Erro no INSERT:", error);
          throw error;
        }
        toast.success("Empresa incluída com sucesso.");
      } else if (XFormMode === "edit" && empresaIdToSave) {
        const { error } = await db.from("empresa").update(payload).eq("empresa_id", empresaIdToSave);
        if (error) {
          console.error("[EmpresaForm] Erro no UPDATE:", error);
          throw error;
        }
        toast.success("Empresa alterada com sucesso.");
      }

      // Save horarios if exists
      if (empresaIdToSave && XHorarios.length > 0) {
        console.log("[EmpresaForm] Salvando horários...");
        for (const h of XHorarios) {
          const { id: hid, ...hrest } = h;
          if (hid) {
            const { error: hErr } = await db.from("empresa_hs_lojavirtual").update(hrest).eq("id", hid);
            if (hErr) console.error("[EmpresaForm] Erro ao salvar horário ID:", hid, hErr);
          }
        }
      }

      // Re-apply theme colors after save
      const root = document.documentElement;
      const map: Record<string, string> = {
        cor_primaria: "--primary",
        cor_header: "--topbar",
        cor_fundo: "--background",
        cor_fundo_card: "--card",
        cor_texto_principal: "--foreground",
        cor_texto_secundario: "--muted-foreground",
        cor_botao_negativo: "--destructive",
        cor_destaque: "--warning",
        cor_menu: "--sidebar-primary",
        cor_input_fundo: "--input-bg",
        cor_input_readonly: "--input-readonly-bg",
        cor_input_borda: "--input-border-color",
        cor_input_label: "--label-color",
      };
      
      for (const [k, v] of Object.entries(map)) { 
        const hex = (XEdit as any)[k]; 
        if (hex) { 
          const hsl = hexToHsl(hex); 
          if (hsl) root.style.setProperty(v, hsl); 
        } 
      }
      
      if (XEdit.cor_primaria) { 
        const hsl = hexToHsl(XEdit.cor_primaria); 
        if (hsl) { 
          root.style.setProperty("--grid-header", hsl); 
          root.style.setProperty("--grid-selected", hsl); 
        } 
      }

      setXFormMode("view");
      await loadData();
      
      // Se era um update, tenta manter o foco na mesma empresa
      if (empresaIdToSave) {
        const newData = (await db.from("empresa").select("*").eq("excluido", false).order("empresa_id")).data;
        if (newData) {
          const newIdx = newData.findIndex((e: any) => e.empresa_id === empresaIdToSave);
          if (newIdx >= 0) setXCurrentIdx(newIdx);
        }
      }
    } catch (e: any) {
      console.error("[EmpresaForm] Exceção no handleSalvar:", e);
      toast.error("Erro ao salvar: " + (e.message || "Erro desconhecido no banco de dados."));
    }
  };

  const handleCancelar = () => setXFormMode("view");

  const handleExcluir = async () => {
    if (!XCurrent) return;
    if (!confirm(`Deseja realmente excluir "${XCurrent.razao_social}"?`)) return;
    const { error } = await db.from("empresa").update({ excluido: true }).eq("empresa_id", XCurrent.empresa_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Empresa excluída.");
    await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XData.length - 1);
  const handleRefresh = async () => { await loadData(); toast.info("Dados recarregados."); };
  const handleSair = () => { const t = XTabs.find(t => t.id === XActiveTabId); if (t) closeTab(t.id); };

  const handleSelectFromSearch = (row: any) => {
    const idx = XData.findIndex(e => e.empresa_id === row.empresa_id);
    if (idx >= 0) { setXCurrentIdx(idx); setXInnerTab("cadastro"); setXFormMode("view"); }
  };


  const updateEdit = (key: string, value: any) => setXEdit(prev => ({ ...prev, [key]: value }));
  const updateHorario = (idx: number, key: string, value: any) => {
    setXHorarios(prev => prev.map((h, i) => i === idx ? { ...h, [key]: value } : h));
  };

  const resetColors = () => {
    Object.entries(DEFAULT_COLORS).forEach(([k, v]) => updateEdit(k, v));
    updateEdit("css_customizado", "");
  };

  const themeInputRef = useRef<HTMLInputElement>(null);

  // All color keys in COLOR_FIELDS
  const THEME_KEYS = COLOR_FIELDS.map(cf => cf.key);

  const handleExportTheme = () => {
    const source = XIsEditing ? XEdit : XCurrent;
    if (!source) { toast.error("Nenhuma empresa selecionada."); return; }
    const payload: Record<string, string> = { __version: "1.0", __empresa: (source as any).razao_social || "" };
    THEME_KEYS.forEach(k => { payload[k] = (source as any)[k] || DEFAULT_COLORS[k] || ""; });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `tema_${((source as any).razao_social || "empresa").replace(/\s+/g, "_").toLowerCase()}.rctheme`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Tema exportado com sucesso!");
  };

  const handleImportTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.__version) throw new Error("Arquivo de tema inválido.");
        let applied = 0;
        THEME_KEYS.forEach(k => {
          if (data[k] && /^#[0-9A-Fa-f]{6}$/.test(data[k])) {
            updateEdit(k, data[k]);
            applied++;
          }
        });
        if (data.css_customizado !== undefined) updateEdit("css_customizado", data.css_customizado);
        toast.success(`Tema importado! ${applied} cores aplicadas. Salve para confirmar.`);
      } catch (err: any) {
        toast.error("Erro ao importar tema: " + err.message);
      } finally {
        if (themeInputRef.current) themeInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const copyLink = () => {
    const url = XEdit?.url_link_vendas || XCurrent?.url_link_vendas || `${window.location.origin}/loja`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  /* ── Upload logomarca ── */
  const handleUploadLogomarca = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XFileName = `logomarca_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("logos").upload(XFileName, file, { upsert: true });
    if (error) { toast.error("Erro ao fazer upload: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(data.path);
    updateEdit("logomarca", urlData.publicUrl);
    toast.success("Logomarca enviada com sucesso!");
  };

  const handleUploadImagemCaixa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XFileName = `imgcaixa_${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from("logos").upload(XFileName, file, { upsert: true });
    if (error) { toast.error("Erro ao fazer upload: " + error.message); return; }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(data.path);
    updateEdit("imagem_caixa", urlData.publicUrl);
    toast.success("Imagem do caixa enviada com sucesso!");
  };

  /* ── field helper ── */
  const XDisplayVal = (key: keyof TEmpresa | string) =>
    XIsEditing ? (XEdit as any)[key] ?? "" : (XCurrent as any)?.[key] ?? "";

  const field = (key: keyof TEmpresa, label: string, opts?: { type?: string; readOnly?: boolean; className?: string; required?: boolean }) => {
    const readOnly = opts?.readOnly || !XIsEditing;
    return (
      <div className={opts?.className || ""}>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {label} {opts?.required && <span className="text-destructive">*</span>}
        </label>
        <input
          type={opts?.type || "text"}
          value={XDisplayVal(key)}
          readOnly={readOnly}
          onChange={e => !readOnly && updateEdit(key, e.target.value)}
          className={`w-full border border-border rounded px-3 py-1.5 text-sm ${readOnly ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-ring outline-none"}`}
        />
      </div>
    );
  };

  /* ── Filtered data for search ── */
  const XFiltered = XData.filter(e => {
    const fc = XSearchFilters["empresa_id"] || "";
    const fn = XSearchFilters["razao_social"] || "";
    const ff = XSearchFilters["nome_fantasia"] || "";
    const fj = XSearchFilters["cnpj"] || "";
    if (fc && !String(e.empresa_id).includes(fc)) return false;
    if (fn && !e.razao_social.toLowerCase().includes(fn.toLowerCase())) return false;
    if (ff && !e.nome_fantasia.toLowerCase().includes(ff.toLowerCase())) return false;
    if (fj && !e.cnpj.includes(fj)) return false;
    return true;
  });

  const TABS = [
    { id: "cadastro", label: "Cadastro" },
    { id: "financeiro", label: "Financeiro / Caixa" },
    { id: "integracoes", label: "Integrações" },
    { id: "ia", label: "IA & Automação" },
    { id: "horario", label: "Horário Loja Virtual" },
    { id: "link", label: "Link de Vendas" },
    { id: "tema", label: "Tema" },
    { id: "localizar", label: "Localizar" },
  ];

  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
      <FormToolbar
        XIsEditing={XIsEditing}
        XHasRecord={!!XCurrent}
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

      {/* Inner tabs */}
      <div className="flex border-b border-border bg-card overflow-x-auto no-scrollbar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`px-6 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
              XInnerTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
            onClick={() => setXInnerTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>


      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* ── Cadastro ── */}
        {XInnerTab === "cadastro" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-24">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={XFormMode === "insert" ? "(Novo)" : XCurrent?.empresa_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa Matriz</label>
                <select
                  value={XDisplayVal("empresa_matriz_id") || ""}
                  disabled={!XIsEditing}
                  onChange={e => updateEdit("empresa_matriz_id", e.target.value ? Number(e.target.value) : null)}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${!XIsEditing ? "bg-secondary" : "bg-card"}`}
                >
                  <option value="">(Nenhuma)</option>
                  {XEmpresasLookup.map(e => (
                    <option key={e.empresa_id} value={e.empresa_id}>{e.empresa_id} - {e.razao_social}</option>
                  ))}
                </select>
              </div>
              {field("razao_social", "Razão Social", { className: "flex-1", required: true })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {field("nome_fantasia", "Nome Fantasia")}
              {field("cnpj", "CNPJ")}
              {field("ie", "Inscrição Estadual")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {field("identificacao", "Identificação")}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Regime Tributário</label>
                <select
                  value={XDisplayVal("regime_trib")}
                  disabled={!XIsEditing}
                  onChange={e => updateEdit("regime_trib", e.target.value)}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${!XIsEditing ? "bg-secondary" : "bg-card"}`}
                >
                  {REGIME_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {field("nm_escola", "Nome Escola/Estabelecimento")}
            </div>

            {/* Endereço */}
            <h3 className="text-sm font-semibold text-foreground pt-2">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {field("endereco_logradouro", "Logradouro", { className: "md:col-span-2" })}
              {field("endereco_numero", "Número")}
              {field("endereco_bairro", "Bairro")}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {field("endereco_cep", "CEP")}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Cidade</label>
                <div className="flex gap-2">
                  <div className={`flex-1 border border-border rounded px-3 py-1.5 text-sm ${!XIsEditing ? "bg-secondary" : "bg-card"}`}>
                    {XCidadeDescricao || (XIsEditing ? "(Selecione)" : "")}
                  </div>
                  {XIsEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="px-2"
                      onClick={() => setXCidadeSearchOpen(true)}
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Telefones */}
            <h3 className="text-sm font-semibold text-foreground pt-2">Telefones</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {field("fone_geral", "Geral")}
              {field("fone_comercial", "Comercial")}
              {field("fone_financeiro", "Financeiro")}
              {field("fone_faturamento", "Faturamento")}
            </div>

            {/* Logomarca */}
            <h3 className="text-sm font-semibold text-foreground pt-2">Logomarca</h3>
            <div className="flex items-center gap-4">
              {XDisplayVal("logomarca") && (
                <img
                  src={XDisplayVal("logomarca") as string}
                  alt="Logomarca"
                  className="w-24 h-24 object-contain border rounded bg-background"
                />
              )}
              {XIsEditing && (
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
                    <Upload className="w-4 h-4" />
                    Upload Logomarca
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogomarca} />
                  </label>
                  {XEdit.logomarca && (
                    <Button variant="ghost" size="sm" className="ml-2" onClick={() => updateEdit("logomarca", "")}>Remover</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Financeiro / Caixa ── */}
        {XInnerTab === "financeiro" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 border-b pb-2">Configurações de Caixa / PDV</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {field("centro_custo_caixa", "ID Centro de Custo", { type: "number" })}
                {field("conta_gerencial_caixa", "ID Conta Gerencial", { type: "number" })}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Depósito Padrão (Estoque)</label>
                  <select
                    value={XDisplayVal("deposito_estoque_caixa") || ""}
                    disabled={!XIsEditing}
                    onChange={e => updateEdit("deposito_estoque_caixa", e.target.value ? Number(e.target.value) : 0)}
                    className={`w-full border border-border rounded px-3 py-1.5 text-sm ${!XIsEditing ? "bg-secondary" : "bg-card"}`}
                  >
                    <option value="0">(Selecione)</option>
                    {XDepositos.map(d => (
                      <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field("tp_operacao_caixa", "Tipo Operação Caixa", { type: "number" })}
              {field("valida_estoque", "Lógica Validação Estoque")}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 border-b pb-2">Imagem do Caixa</h3>
              <div className="flex items-center gap-4">
                {XDisplayVal("imagem_caixa") && (
                  <img
                    src={XDisplayVal("imagem_caixa") as string}
                    alt="Imagem Caixa"
                    className="w-24 h-24 object-contain border rounded bg-background"
                  />
                )}
                {XIsEditing && (
                  <div>
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:opacity-90">
                      <Upload className="w-4 h-4" />
                      Upload Imagem Caixa
                      <input type="file" accept="image/*" className="hidden" onChange={handleUploadImagemCaixa} />
                    </label>
                    {XEdit.imagem_caixa && (
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => updateEdit("imagem_caixa", "")}>Remover</Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa Depósito Caixa</label>
                <select
                  value={XDisplayVal("empresa_deposito_caixa") || ""}
                  disabled={!XIsEditing}
                  onChange={e => updateEdit("empresa_deposito_caixa", e.target.value ? Number(e.target.value) : null)}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${!XIsEditing ? "bg-secondary" : "bg-card"}`}
                >
                  <option value="">(Nenhuma)</option>
                  {XEmpresasLookup.map(e => (
                    <option key={e.empresa_id} value={e.empresa_id}>{e.empresa_id} - {e.razao_social}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 border-b pb-2">Casas Decimais</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {field("vl_venda_qt_decimais", "Valor Venda", { type: "number" })}
                {field("qt_venda_qt_decimais", "Qtde Venda", { type: "number" })}
                {field("vl_saida_qt_decimais", "Valor Saída", { type: "number" })}
                {field("qt_saida_qt_decimais", "Qtde Saída", { type: "number" })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 border-b pb-2">Validação de Estoque</h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!XDisplayVal("lg_valida_estoque_link")}
                    onCheckedChange={v => updateEdit("lg_valida_estoque_link", v)}
                    disabled={!XIsEditing}
                  />
                  <Label className="text-xs">Validar Estoque no Link de Vendas</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!!XDisplayVal("lg_valida_estoque_pdv")}
                    onCheckedChange={v => updateEdit("lg_valida_estoque_pdv", v)}
                    disabled={!XIsEditing}
                  />
                  <Label className="text-xs">Validar Estoque no PDV</Label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Integrações ── */}
        {XInnerTab === "integracoes" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4 border-b pb-2">AbacatePay</h3>
              <div className="space-y-4">
                {field("abacatepay_api_key", "API Key", { type: "password" })}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {field("abacatepay_webhook_secret", "Webhook Secret", { type: "password" })}
                  {field("abacatepay_webhook_url", "Webhook URL")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── IA & Automação ── */}
        {XInnerTab === "ia" && (
          <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${XDisplayVal("ia_ativa") ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Status do Agente IA</h3>
                  <p className="text-xs text-muted-foreground">Habilita ou desabilita as funções autônomas do Realsys para esta empresa.</p>
                </div>
              </div>
              <Switch
                checked={!!XDisplayVal("ia_ativa")}
                onCheckedChange={v => updateEdit("ia_ativa", v)}
                disabled={!XIsEditing}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Modelo de Inteligência</Label>
                <select
                  value={XDisplayVal("ia_modelo") || "gpt-4o"}
                  disabled={!XIsEditing}
                  onChange={e => updateEdit("ia_modelo", e.target.value)}
                  className={`w-full border border-border rounded px-3 py-2 text-sm shadow-sm transition-all ${!XIsEditing ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-primary/20"}`}
                >
                  <option value="gpt-4o">GPT-4o (Recomendado)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais rápido)</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                </select>
                <p className="text-[10px] text-muted-foreground">Modelos mais avançados oferecem melhor compreensão de regras de negócio complexas.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nível de Autonomia</Label>
                <div className="p-3 border rounded bg-secondary/30 text-xs text-muted-foreground italic">
                  O Realsys opera via MCP Server dedicado, com acesso direto a cadastros, pedidos e emissão fiscal.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Instruções do Sistema (System Prompt)</Label>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">Markdown Suportado</span>
              </div>
              <Textarea
                value={XDisplayVal("ia_instrucoes")}
                onChange={e => updateEdit("ia_instrucoes", e.target.value)}
                rows={12}
                placeholder="Ex: Você é o Realsys, o assistente virtual da RealCommerce. Sua função é ajudar o cliente a realizar pedidos, consultar estoque e emitir notas fiscais. Seja cordial e direto. Se o cliente informar um CNPJ, use a ferramenta de consulta para obter os dados automaticamente..."
                className={`font-mono text-sm leading-relaxed shadow-sm transition-all ${!XIsEditing ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-primary/20"}`}
                disabled={!XIsEditing}
              />
              <div className="p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700 flex gap-3">
                <div className="shrink-0 pt-0.5">💡</div>
                <p>
                  <strong>Dica:</strong> Explique detalhadamente como a IA deve se comportar. Defina o tom de voz, regras de desconto permitidas, e como lidar com exceções. 
                  O prompt de sistema é a "alma" do seu robô.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Horário Loja Virtual ── */}
        {XInnerTab === "horario" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Horários de Funcionamento — Loja Virtual</h3>
              {XHorarios.length === 0 && (
                <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={handleGerarHorarios}>
                  <Plus className="w-3.5 h-3.5" /> Gerar Horários
                </Button>
              )}
            </div>
            {XHorarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum horário cadastrado para esta empresa. Clique em "Gerar Horários" para criar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-2">Dia</th>
                      <th className="p-2">Ativo</th>
                      <th className="p-2">Mat. Início</th>
                      <th className="p-2">Mat. Fim</th>
                      <th className="p-2">Vesp. Início</th>
                      <th className="p-2">Vesp. Fim</th>
                      <th className="p-2">Not. Início</th>
                      <th className="p-2">Not. Fim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {XHorarios.map((h, idx) => (
                      <tr key={h.id} className="border-b">
                        <td className="p-2 font-medium">{DIAS[h.dia_semana]}</td>
                        <td className="p-2">
                          <Switch checked={h.lg_dia_ativo} onCheckedChange={v => updateHorario(idx, "lg_dia_ativo", v)} disabled={!XIsEditing} />
                        </td>
                        <td className="p-2"><Input type="time" value={h.hr_inicio_matutino || ""} onChange={e => updateHorario(idx, "hr_inicio_matutino", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                        <td className="p-2"><Input type="time" value={h.hr_fim_matutino || ""} onChange={e => updateHorario(idx, "hr_fim_matutino", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                        <td className="p-2"><Input type="time" value={h.hr_inicio_vespertino || ""} onChange={e => updateHorario(idx, "hr_inicio_vespertino", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                        <td className="p-2"><Input type="time" value={h.hr_fim_vespertino || ""} onChange={e => updateHorario(idx, "hr_fim_vespertino", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                        <td className="p-2"><Input type="time" value={h.hr_inicio_noturno || ""} onChange={e => updateHorario(idx, "hr_inicio_noturno", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                        <td className="p-2"><Input type="time" value={h.hr_fim_noturno || ""} onChange={e => updateHorario(idx, "hr_fim_noturno", e.target.value)} className="w-28" disabled={!h.lg_dia_ativo || !XIsEditing} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Link de Vendas ── */}
        {XInnerTab === "link" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold">Link de Vendas</h3>
            </div>
            <div className="border rounded-lg p-4 space-y-4 bg-card">
              <p className="text-xs text-muted-foreground">URL pública para autoatendimento.</p>
              <div className="flex items-center gap-2">
                <Input value={XDisplayVal("url_link_vendas") || `${window.location.origin}/loja`} readOnly className="flex-1 font-mono text-sm" />
                <Button variant="outline" size="icon" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={XDisplayVal("url_link_vendas") as string || "/loja"} target="_blank" rel="noopener noreferrer"><Eye className="w-4 h-4" /></a>
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">URL personalizada (opcional)</Label>
                <Input
                  value={XDisplayVal("url_link_vendas")}
                  onChange={e => updateEdit("url_link_vendas", e.target.value)}
                  placeholder="Deixe vazio para usar /loja"
                  disabled={!XIsEditing}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Tema ── */}
        {XInnerTab === "tema" && (
          <div className="space-y-4">
            {/* Hidden file input for import */}
            <input ref={themeInputRef} type="file" accept=".rctheme,.json" className="hidden" onChange={handleImportTheme} />

            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold">Aparência / Tema</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1" onClick={handleExportTheme}>
                  <Download className="w-3.5 h-3.5" /> Exportar Tema
                </Button>
                {XIsEditing && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => themeInputRef.current?.click()}>
                      <Upload className="w-3.5 h-3.5" /> Importar Tema
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={resetColors}>
                      <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrão
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Personalize as cores do sistema para esta empresa.</p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {COLOR_FIELDS.map(cf => (
                <div key={cf.key} className="space-y-1.5">
                  <Label className="text-xs">{cf.label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={XDisplayVal(cf.key as keyof TEmpresa) as string || DEFAULT_COLORS[cf.key]}
                      onChange={e => updateEdit(cf.key, e.target.value)}
                      className="w-10 h-10 rounded border cursor-pointer"
                      disabled={!XIsEditing}
                    />
                    <Input
                      value={XDisplayVal(cf.key as keyof TEmpresa) as string || DEFAULT_COLORS[cf.key]}
                      onChange={e => updateEdit(cf.key, e.target.value)}
                      className="flex-1 font-mono text-xs"
                      placeholder="#000000"
                      disabled={!XIsEditing}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
              <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: (XDisplayVal("cor_fundo") as string) || "#fff" }}>
                <div className="p-3" style={{ backgroundColor: (XDisplayVal("cor_header") as string) || "#7C3AED" }}>
                  <span className="text-sm font-bold" style={{ color: "#fff" }}>{XDisplayVal("nm_escola") || "Loja"}</span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-sm font-semibold" style={{ color: (XDisplayVal("cor_texto_principal") as string) || "#1E293B" }}>Produto Exemplo</p>
                  <p className="text-xs" style={{ color: (XDisplayVal("cor_texto_secundario") as string) || "#64748B" }}>Descrição do produto</p>
                  {/* Textbox preview */}
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: (XDisplayVal("cor_input_label") as string) || DEFAULT_COLORS.cor_input_label }}>Campo Editável</label>
                      <input
                        readOnly
                        defaultValue="Exemplo de texto editável"
                        className="w-full rounded px-3 py-1.5 text-sm"
                        style={{
                          backgroundColor: (XDisplayVal("cor_input_fundo") as string) || DEFAULT_COLORS.cor_input_fundo,
                          border: `1px solid ${(XDisplayVal("cor_input_borda") as string) || DEFAULT_COLORS.cor_input_borda}`,
                          color: (XDisplayVal("cor_texto_principal") as string) || "#1E293B",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: (XDisplayVal("cor_input_label") as string) || DEFAULT_COLORS.cor_input_label }}>Campo Somente Leitura</label>
                      <input
                        readOnly
                        defaultValue="Não editável"
                        className="w-full rounded px-3 py-1.5 text-sm"
                        style={{
                          backgroundColor: (XDisplayVal("cor_input_readonly") as string) || DEFAULT_COLORS.cor_input_readonly,
                          border: `1px solid ${(XDisplayVal("cor_input_borda") as string) || DEFAULT_COLORS.cor_input_borda}`,
                          color: (XDisplayVal("cor_texto_secundario") as string) || "#64748B",
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: (XDisplayVal("cor_botao") as string) || "#8B5CF6" }}>Comprar</button>
                    <button className="px-3 py-1 text-xs text-white rounded" style={{ backgroundColor: (XDisplayVal("cor_botao_negativo") as string) || "#EF4444" }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">CSS Customizado</Label>
              <Textarea
                value={XDisplayVal("css_customizado")}
                onChange={e => updateEdit("css_customizado", e.target.value)}
                rows={6}
                placeholder="/* CSS adicional */"
                className="font-mono text-xs"
                disabled={!XIsEditing}
              />
            </div>
          </div>
        )}

        {/* ── Localizar ── */}
        {XInnerTab === "localizar" && (
          <DataGrid
            columns={XLocalizarColumns}
            data={XFiltered}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={handleSelectFromSearch}
            maxHeight="400px"
            exportTitle="Empresas"
          />
        )}
      </div>
      <CidadeSearchDialog
        open={XCidadeSearchOpen}
        onClose={() => setXCidadeSearchOpen(false)}
        onSelect={(c) => {
          updateEdit("endereco_cidade_id", c.cidade_id);
          setXCidadeDescricao(c.descricao);
        }}
      />
    </div>
  );
};

export default EmpresaForm;
