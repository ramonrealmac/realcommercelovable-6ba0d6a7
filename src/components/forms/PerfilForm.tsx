import React, { useState, useCallback, useEffect } from "react";
import {
  Plus, Save, Pencil, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Trash2, RefreshCw, Search, List, HelpCircle, LogOut
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { usePerfis, IPerfil } from "@/hooks/useAccessControl";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";

const XLocalizarColumns: IGridColumn[] = [
  { key: "perfil_id", label: "Código", width: "80px", align: "right" },
  { key: "nm_perfil", label: "Nome do Perfil", width: "1fr" },
  { key: "fl_administrador", label: "Admin", width: "80px", align: "center", render: (r) => r.fl_administrador ? "Sim" : "Não" },
];

const XDiasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface IHorario {
  perfil_horario_id?: number;
  nr_dia_semana: number;
  fl_matutino: boolean;
  fl_vespertino: boolean;
  fl_noturno: boolean;
  hr_matutino_inicio: string;
  hr_matutino_fim: string;
  hr_vespertino_inicio: string;
  hr_vespertino_fim: string;
  hr_noturno_inicio: string;
  hr_noturno_fim: string;
}

const defaultHorarios = (): IHorario[] =>
  XDiasSemana.map((_, i) => ({
    nr_dia_semana: i,
    fl_matutino: false,
    fl_vespertino: false,
    fl_noturno: false,
    hr_matutino_inicio: "06:00",
    hr_matutino_fim: "12:00",
    hr_vespertino_inicio: "12:00",
    hr_vespertino_fim: "18:00",
    hr_noturno_inicio: "18:00",
    hr_noturno_fim: "23:59",
  }));

type TFormMode = "view" | "edit" | "insert";

const PerfilForm: React.FC = () => {
  const { XEmpresaId, closeTab, XTabs, XActiveTabId } = useAppContext();
  const { XPerfis, reload } = usePerfis(XEmpresaId);

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("localizar");
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XNmPerfil, setXNmPerfil] = useState("");
  const [XFlAdmin, setXFlAdmin] = useState(false);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XSelectedGridIdx, setXSelectedGridIdx] = useState<number | null>(null);
  const [XHorarios, setXHorarios] = useState<IHorario[]>(defaultHorarios());

  const XCurrent = XPerfis[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  /* ── Load horarios for current perfil ── */
  const loadHorarios = useCallback(async (XPerfilId: number) => {
    const { data } = await supabase
      .from("perfil_horario")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("perfil_id", XPerfilId)
      .eq("fl_excluido", false)
      .order("nr_dia_semana");

    const XBase = defaultHorarios();
    if (data) {
      data.forEach((h: any) => {
        const idx = XBase.findIndex(b => b.nr_dia_semana === h.nr_dia_semana);
        if (idx >= 0) {
          XBase[idx] = {
            perfil_horario_id: h.perfil_horario_id,
            nr_dia_semana: h.nr_dia_semana,
            fl_matutino: h.fl_matutino,
            fl_vespertino: h.fl_vespertino,
            fl_noturno: h.fl_noturno,
            hr_matutino_inicio: h.hr_matutino_inicio?.substring(0, 5) || "06:00",
            hr_matutino_fim: h.hr_matutino_fim?.substring(0, 5) || "12:00",
            hr_vespertino_inicio: h.hr_vespertino_inicio?.substring(0, 5) || "12:00",
            hr_vespertino_fim: h.hr_vespertino_fim?.substring(0, 5) || "18:00",
            hr_noturno_inicio: h.hr_noturno_inicio?.substring(0, 5) || "18:00",
            hr_noturno_fim: h.hr_noturno_fim?.substring(0, 5) || "23:59",
          };
        }
      });
    }
    setXHorarios(XBase);
  }, [XEmpresaId]);

  useEffect(() => {
    if (XCurrent && XFormMode === "view") {
      setXNmPerfil(XCurrent.nm_perfil);
      setXFlAdmin(XCurrent.fl_administrador);
      loadHorarios(XCurrent.perfil_id);
    }
  }, [XCurrent, XFormMode, loadHorarios]);

  const ensureAuth = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) { toast.error("Faça login para salvar perfis."); return false; }
    return true;
  }, []);

  const handleSave = useCallback(async () => {
    if (!XNmPerfil.trim()) { toast.error("Nome do perfil é obrigatório"); return; }
    if (!(await ensureAuth())) return;

    let XPerfilId: number;

    if (XFormMode === "insert") {
      const { data, error } = await supabase.from("perfil").insert({
        empresa_id: XEmpresaId,
        nm_perfil: XNmPerfil.trim().toUpperCase(),
        fl_administrador: XFlAdmin,
      }).select("perfil_id").single();
      if (error) { toast.error("Erro ao incluir: " + error.message); return; }
      XPerfilId = data.perfil_id;
      toast.success("Perfil incluído com sucesso");
    } else if (XFormMode === "edit" && XCurrent) {
      const { error } = await supabase.from("perfil")
        .update({ nm_perfil: XNmPerfil.trim().toUpperCase(), fl_administrador: XFlAdmin })
        .eq("perfil_id", XCurrent.perfil_id);
      if (error) { toast.error("Erro ao alterar: " + error.message); return; }
      XPerfilId = XCurrent.perfil_id;
      toast.success("Perfil alterado com sucesso");
    } else {
      return;
    }

    // Save horarios
    for (const h of XHorarios) {
      if (h.perfil_horario_id) {
        await supabase.from("perfil_horario")
          .update({
            fl_matutino: h.fl_matutino,
            fl_vespertino: h.fl_vespertino,
            fl_noturno: h.fl_noturno,
            hr_matutino_inicio: h.hr_matutino_inicio,
            hr_matutino_fim: h.hr_matutino_fim,
            hr_vespertino_inicio: h.hr_vespertino_inicio,
            hr_vespertino_fim: h.hr_vespertino_fim,
            hr_noturno_inicio: h.hr_noturno_inicio,
            hr_noturno_fim: h.hr_noturno_fim,
          } as any)
          .eq("perfil_horario_id", h.perfil_horario_id);
      } else if (h.fl_matutino || h.fl_vespertino || h.fl_noturno) {
        await supabase.from("perfil_horario").insert({
          empresa_id: XEmpresaId,
          perfil_id: XPerfilId,
          nr_dia_semana: h.nr_dia_semana,
          fl_matutino: h.fl_matutino,
          fl_vespertino: h.fl_vespertino,
          fl_noturno: h.fl_noturno,
          hr_matutino_inicio: h.hr_matutino_inicio,
          hr_matutino_fim: h.hr_matutino_fim,
          hr_vespertino_inicio: h.hr_vespertino_inicio,
          hr_vespertino_fim: h.hr_vespertino_fim,
          hr_noturno_inicio: h.hr_noturno_inicio,
          hr_noturno_fim: h.hr_noturno_fim,
        } as any);
      }
    }

    setXFormMode("view");
    await reload();
  }, [XFormMode, XNmPerfil, XFlAdmin, XCurrent, XEmpresaId, XHorarios, ensureAuth, reload]);

  const handleDelete = useCallback(async () => {
    if (!XCurrent) return;
    if (!(await ensureAuth())) return;
    if (!confirm("Deseja realmente excluir este perfil?")) return;
    const { error } = await supabase.from("perfil")
      .update({ fl_excluido: true })
      .eq("perfil_id", XCurrent.perfil_id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Perfil excluído");
    await reload();
    setXCurrentIdx(0);
  }, [XCurrent, ensureAuth, reload]);

  const handleInsert = () => {
    setXFormMode("insert");
    setXNmPerfil("");
    setXFlAdmin(false);
    setXHorarios(defaultHorarios());
    setXInnerTab("cadastro");
  };

  const handleEdit = () => {
    if (!XCurrent) return;
    setXFormMode("edit");
    setXNmPerfil(XCurrent.nm_perfil);
    setXFlAdmin(XCurrent.fl_administrador);
    setXInnerTab("cadastro");
  };

  const handleCancel = () => {
    setXFormMode("view");
    if (XCurrent) {
      setXNmPerfil(XCurrent.nm_perfil);
      setXFlAdmin(XCurrent.fl_administrador);
      loadHorarios(XCurrent.perfil_id);
    }
  };

  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XPerfis.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XPerfis.length - 1);

  const handleRefresh = async () => {
    await reload();
    toast.info("Dados recarregados.");
  };

  const handleSair = () => {
    const XTab = XTabs.find(t => t.id === XActiveTabId);
    if (XTab) closeTab(XTab.id);
  };

  const handleSelectFromSearch = (_row: any, idx: number) => {
    setXCurrentIdx(idx);
    setXInnerTab("cadastro");
    setXFormMode("view");
  };

  const updateHorario = (dia: number, field: keyof IHorario, value: any) => {
    setXHorarios(prev => prev.map(h => h.nr_dia_semana === dia ? { ...h, [field]: value } : h));
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card">
        {!XIsEditing ? (
          <>
            <ToolbarBtn icon={<Plus size={16} />} label="Incluir" onClick={handleInsert} color="success" />
            <ToolbarBtn icon={<Pencil size={16} />} label="Editar" onClick={handleEdit} disabled={!XCurrent} />
            <ToolbarSep />
            <ToolbarBtn icon={<ChevronsLeft size={16} />} label="Primeiro" onClick={handleFirst} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronLeft size={16} />} label="Anterior" onClick={handlePrev} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronRight size={16} />} label="Próximo" onClick={handleNext} disabled={XCurrentIdx >= XPerfis.length - 1} />
            <ToolbarBtn icon={<ChevronsRight size={16} />} label="Último" onClick={handleLast} disabled={XCurrentIdx >= XPerfis.length - 1} />
            <ToolbarSep />
            <ToolbarBtn icon={<Trash2 size={16} />} label="Excluir" onClick={handleDelete} disabled={!XCurrent} color="destructive" />
            <ToolbarBtn icon={<RefreshCw size={16} />} label="Recarregar" onClick={handleRefresh} />
            <ToolbarBtn icon={<Search size={16} />} label="Localizar" onClick={() => setXInnerTab("localizar")} />
            <ToolbarBtn icon={<List size={16} />} label="Log" onClick={() => toast.info("Log de operações")} />
            <ToolbarBtn icon={<HelpCircle size={16} />} label="Ajuda" onClick={() => toast.info("Ajuda do formulário")} />
            <ToolbarBtn icon={<LogOut size={16} />} label="Sair" onClick={handleSair} />
          </>
        ) : (
          <>
            <ToolbarBtn icon={<Save size={16} />} label="Salvar" onClick={handleSave} color="success" />
            <ToolbarBtn icon={<LogOut size={16} />} label="Cancelar" onClick={handleCancel} color="destructive" />
          </>
        )}
      </div>

      {/* ── Inner tabs ── */}
      <div className="flex border-b border-border bg-card">
        <button
          className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === "cadastro" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setXInnerTab("cadastro")}
        >
          Cadastro
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === "localizar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setXInnerTab("localizar")}
        >
          <Search size={14} className="inline mr-1" />Localizar
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-5">
            {XCurrent && XFormMode === "view" && (
              <div className="text-xs text-muted-foreground">Código: {XCurrent.perfil_id}</div>
            )}
            <div className="max-w-lg space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Nome do Perfil <span className="text-destructive">*</span>
                </label>
                <input
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:bg-secondary disabled:cursor-not-allowed"
                  value={XNmPerfil}
                  onChange={e => setXNmPerfil(e.target.value)}
                  disabled={!XIsEditing}
                  maxLength={100}
                  placeholder="Ex: VENDEDOR, CAIXA, GERENTE"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fl_admin"
                  checked={XFlAdmin}
                  onChange={e => setXFlAdmin(e.target.checked)}
                  disabled={!XIsEditing}
                  className="rounded border-input"
                />
                <label htmlFor="fl_admin" className="text-sm">Perfil Administrador (acesso total)</label>
              </div>
            </div>

            {/* ── Horário de Acesso ── */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Horário de Acesso por Dia da Semana
              </div>
              <div className="border border-border rounded overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[120px_1fr_1fr_1fr] bg-grid-header text-grid-header-foreground text-xs font-semibold">
                  <div className="px-2 py-1.5 border-r border-primary-foreground/20">Dia</div>
                  <div className="px-2 py-1.5 border-r border-primary-foreground/20 text-center">Matutino</div>
                  <div className="px-2 py-1.5 border-r border-primary-foreground/20 text-center">Vespertino</div>
                  <div className="px-2 py-1.5 text-center">Noturno</div>
                </div>
                {/* Rows */}
                {XHorarios.map((h, i) => (
                  <div
                    key={h.nr_dia_semana}
                    className={`grid grid-cols-[120px_1fr_1fr_1fr] text-xs border-t border-border ${i % 2 === 0 ? "bg-card" : "bg-grid-stripe"}`}
                  >
                    <div className="px-2 py-2 border-r border-border font-medium">
                      {XDiasSemana[h.nr_dia_semana]}
                    </div>
                    <ShiftCell
                      XEnabled={h.fl_matutino}
                      XInicio={h.hr_matutino_inicio}
                      XFim={h.hr_matutino_fim}
                      XIsEditing={XIsEditing}
                      onToggle={v => updateHorario(h.nr_dia_semana, "fl_matutino", v)}
                      onInicioChange={v => updateHorario(h.nr_dia_semana, "hr_matutino_inicio", v)}
                      onFimChange={v => updateHorario(h.nr_dia_semana, "hr_matutino_fim", v)}
                    />
                    <ShiftCell
                      XEnabled={h.fl_vespertino}
                      XInicio={h.hr_vespertino_inicio}
                      XFim={h.hr_vespertino_fim}
                      XIsEditing={XIsEditing}
                      onToggle={v => updateHorario(h.nr_dia_semana, "fl_vespertino", v)}
                      onInicioChange={v => updateHorario(h.nr_dia_semana, "hr_vespertino_inicio", v)}
                      onFimChange={v => updateHorario(h.nr_dia_semana, "hr_vespertino_fim", v)}
                    />
                    <ShiftCell
                      XEnabled={h.fl_noturno}
                      XInicio={h.hr_noturno_inicio}
                      XFim={h.hr_noturno_fim}
                      XIsEditing={XIsEditing}
                      onToggle={v => updateHorario(h.nr_dia_semana, "fl_noturno", v)}
                      onInicioChange={v => updateHorario(h.nr_dia_semana, "hr_noturno_inicio", v)}
                      onFimChange={v => updateHorario(h.nr_dia_semana, "hr_noturno_fim", v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <DataGrid
            columns={XLocalizarColumns}
            data={XPerfis}
            selectedIdx={XSelectedGridIdx}
            onRowClick={(_, idx) => { setXSelectedGridIdx(idx); setXCurrentIdx(idx); }}
            onRowDoubleClick={handleSelectFromSearch}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
            maxHeight="400px"
            exportTitle="Perfis de Acesso"
          />
        )}
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-muted text-xs text-muted-foreground shrink-0">
        <span>Total: {XPerfis.length} registro(s)</span>
        <span>{XFormMode === "insert" ? "Incluindo" : XFormMode === "edit" ? "Editando" : "Visualizando"}</span>
      </div>
    </div>
  );
};

/* ── ShiftCell Component ── */
const ShiftCell: React.FC<{
  XEnabled: boolean;
  XInicio: string;
  XFim: string;
  XIsEditing: boolean;
  onToggle: (v: boolean) => void;
  onInicioChange: (v: string) => void;
  onFimChange: (v: string) => void;
}> = ({ XEnabled, XInicio, XFim, XIsEditing, onToggle, onInicioChange, onFimChange }) => (
  <div className="px-2 py-2 border-r border-border last:border-r-0 flex items-center gap-2">
    <input
      type="checkbox"
      checked={XEnabled}
      onChange={e => onToggle(e.target.checked)}
      disabled={!XIsEditing}
      className="rounded border-input shrink-0"
    />
    {XEnabled && (
      <div className="flex items-center gap-1 text-[11px]">
        <input
          type="time"
          value={XInicio}
          onChange={e => onInicioChange(e.target.value)}
          disabled={!XIsEditing}
          className="border border-border rounded px-1 py-0.5 bg-card disabled:bg-secondary w-[70px]"
        />
        <span>-</span>
        <input
          type="time"
          value={XFim}
          onChange={e => onFimChange(e.target.value)}
          disabled={!XIsEditing}
          className="border border-border rounded px-1 py-0.5 bg-card disabled:bg-secondary w-[70px]"
        />
      </div>
    )}
  </div>
);

/* ── Toolbar helpers ── */
const ToolbarBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "success" | "destructive" | "default";
}> = ({ icon, label, onClick, disabled, color = "default" }) => {
  const XColorClass =
    color === "success" ? "text-success hover:bg-success/10" :
    color === "destructive" ? "text-destructive hover:bg-destructive/10" :
    "text-foreground hover:bg-accent";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded transition-colors ${XColorClass} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {icon}
    </button>
  );
};

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

export default PerfilForm;
