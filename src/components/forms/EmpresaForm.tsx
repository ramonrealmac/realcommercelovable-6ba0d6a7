import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { IGridColumn } from "@/components/grid/DataGrid";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCcw, Copy, Eye, Palette, Clock, Link2, Upload, Plus, Building, MapPin, Palette as PaletteIcon, Settings } from "lucide-react";
import { useCrudController } from "@/hooks/useCrudController";

const db = supabase as any;

/* ── helpers ── */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const COLOR_FIELDS = [
  { key: "cor_primaria", label: "Cor Primária" },
  { key: "cor_header", label: "Header" },
  { key: "cor_fundo", label: "Fundo Geral" },
  { key: "cor_fundo_card", label: "Fundo dos Cards" },
  { key: "cor_texto_principal", label: "Texto Principal" },
  { key: "cor_botao", label: "Botões" },
  { key: "cor_botao_negativo", label: "Botão Negativo" },
  { key: "cor_destaque", label: "Destaque" },
];

const DEFAULT_COLORS: Record<string, string> = {
  cor_primaria: "#8B5CF6", cor_header: "#7C3AED", cor_fundo: "#FFFFFF",
  cor_fundo_card: "#F8FAFC", cor_texto_principal: "#1E293B",
  cor_botao: "#8B5CF6", cor_botao_negativo: "#EF4444", cor_destaque: "#F59E0B",
};

const XLocalizarColumns: IGridColumn[] = [
  { key: "empresa_id", label: "Código", width: "80px", align: "right" },
  { key: "razao_social", label: "Razão Social", width: "1fr" },
  { key: "nome_fantasia", label: "Nome Fantasia", width: "1fr" },
  { key: "cnpj", label: "CNPJ", width: "160px" },
];

const EmpresaForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  
  const ctrl = useCrudController<any>({
    tableName: "empresa",
    empresaFieldName: "empresa_id",
  });

  const [XF, setXF] = useState<any>({});
  const [XHorarios, setXHorarios] = useState<any[]>([]);
  const [XSubTab, setXSubTab] = useState("geral");

  // Lookups
  const [XEmpresasLookup, setXEmpresasLookup] = useState<any[]>([]);
  const [XCidades, setXCidades] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    const { data } = await db.from("empresa").select("*").eq("excluido", false).order("empresa_id");
    ctrl.setXData(data || []);
  }, [ctrl.setXData]);

  const loadLookups = useCallback(async () => {
    const [empRes, cidRes] = await Promise.all([
      db.from("empresa").select("empresa_id, razao_social").eq("excluido", false).order("razao_social"),
      db.from("cidade").select("cidade_id, descricao").eq("excluido", false).order("descricao"),
    ]);
    setXEmpresasLookup(empRes.data || []);
    setXCidades(cidRes.data || []);
  }, []);

  const loadHorarios = useCallback(async (empId: number) => {
    const { data } = await db.from("empresa_hs_lojavirtual").select("*").eq("empresa_id", empId).order("dia_semana");
    setXHorarios(data || []);
  }, []);

  useEffect(() => { loadData(); loadLookups(); }, [loadData, loadLookups]);

  useEffect(() => {
    if (ctrl.XCurrentRecord && ctrl.XFormMode === "view") {
      setXF({ ...ctrl.XCurrentRecord });
      loadHorarios(ctrl.XCurrentRecord.empresa_id);
    } else if (ctrl.XFormMode === "insert") {
      setXF({ regime_trib: "S", vl_venda_qt_decimais: 2, ...DEFAULT_COLORS });
      setXHorarios([]);
    }
  }, [ctrl.XCurrentRecord, ctrl.XFormMode, loadHorarios]);

  const handleSalvar = async () => {
    if (!XF.razao_social?.trim()) { toast.error("Razão Social é obrigatória."); return; }
    const payload = { ...XF, dt_alteracao: new Date().toISOString() };
    delete payload.empresa_id;

    if (ctrl.XFormMode === "edit" && ctrl.XCurrentRecord) {
      const { error } = await db.from("empresa").update(payload).eq("empresa_id", ctrl.XCurrentRecord.empresa_id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("empresa").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Empresa salva com sucesso.");
    ctrl.setXFormMode("view");
    loadData();
  };

  const renderCadastro = () => (
    <div className="space-y-6">
      {/* Sub-tabs Minimalistas no Padrão RealCommerce */}
      <div className="flex gap-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg w-fit border border-border/40">
        {[
          {id: "geral", icon: <Building size={14}/>, label: "Geral"},
          {id: "horario", icon: <Clock size={14}/>, label: "Horários"},
          {id: "tema", icon: <PaletteIcon size={14}/>, label: "Aparência"},
          {id: "config", icon: <Settings size={14}/>, label: "Configurações"}
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
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Razão Social</label>
              <input type="text" value={XF.razao_social || ""} onChange={e => setXF({...XF, razao_social: e.target.value.toUpperCase()})} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">CNPJ</label>
              <input type="text" value={XF.cnpj || ""} onChange={e => setXF({...XF, cnpj: e.target.value})} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Logradouro</label>
              <input type="text" value={XF.endereco_logradouro || ""} onChange={e => setXF({...XF, endereco_logradouro: e.target.value.toUpperCase()})} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Bairro</label>
              <input type="text" value={XF.endereco_bairro || ""} onChange={e => setXF({...XF, endereco_bairro: e.target.value.toUpperCase()})} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent px-1 py-2 text-sm focus:border-primary outline-none transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cidade</label>
              <select value={XF.endereco_cidade_id || ""} onChange={e => setXF({...XF, endereco_cidade_id: e.target.value})} disabled={!ctrl.XIsEditing} className="w-full border-b border-border bg-transparent py-2 text-sm outline-none focus:border-primary">
                <option value="">Selecione...</option>
                {XCidades.map(c => <option key={c.cidade_id} value={c.cidade_id}>{c.descricao}</option>)}
              </select>
            </div>
          </div>
        )}

        {XSubTab === "horario" && (
           <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Horários Loja Virtual</h4>
                {ctrl.XIsEditing && XHorarios.length === 0 && <Button variant="outline" size="sm" onClick={() => toast.info("Geração de horários automática")} className="text-[10px] h-7 px-3">GERAR HORÁRIOS</Button>}
             </div>
             <div className="grid grid-cols-1 gap-2">
                {XHorarios.map((h, i) => (
                  <div key={i} className="flex items-center gap-4 p-2 bg-slate-50/50 rounded-lg border border-border/40">
                    <div className="w-24 text-[11px] font-bold text-slate-600">{DIAS[h.dia_semana]}</div>
                    <Switch checked={h.lg_dia_ativo} disabled={!ctrl.XIsEditing} />
                    <div className="flex-1 grid grid-cols-6 gap-2">
                      <input type="time" value={h.hr_inicio_matutino || "00:00"} disabled={!h.lg_dia_ativo || !ctrl.XIsEditing} className="border-b border-border bg-transparent text-[11px] outline-none" />
                      <input type="time" value={h.hr_fim_matutino || "00:00"} disabled={!h.lg_dia_ativo || !ctrl.XIsEditing} className="border-b border-border bg-transparent text-[11px] outline-none" />
                    </div>
                  </div>
                ))}
             </div>
           </div>
        )}

        {XSubTab === "tema" && (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Identidade Visual</h4>
                {ctrl.XIsEditing && <Button variant="outline" size="sm" onClick={() => setXF({...XF, ...DEFAULT_COLORS})} className="text-[10px] h-7 px-3 gap-1"><RotateCcw size={12}/> RESTAURAR PADRÃO</Button>}
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {COLOR_FIELDS.map(cf => (
                  <div key={cf.key} className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">{cf.label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={XF[cf.key] || DEFAULT_COLORS[cf.key]} onChange={e => setXF({...XF, [cf.key]: e.target.value})} disabled={!ctrl.XIsEditing} className="w-8 h-8 rounded-lg cursor-pointer border border-border" />
                      <input type="text" value={XF[cf.key] || DEFAULT_COLORS[cf.key]} onChange={e => setXF({...XF, [cf.key]: e.target.value})} disabled={!ctrl.XIsEditing} className="flex-1 border-b border-border bg-transparent text-xs font-mono outline-none" />
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <StandardCrudForm
      ctrl={ctrl}
      title="Configuração da Empresa"
      onSalvar={handleSalvar}
      onExcluir={() => toast.info("Não é permitido excluir a empresa principal")}
      onRefresh={loadData}
      renderCadastro={renderCadastro}
      localizarColumns={XLocalizarColumns}
    />
  );
};

export default EmpresaForm;
