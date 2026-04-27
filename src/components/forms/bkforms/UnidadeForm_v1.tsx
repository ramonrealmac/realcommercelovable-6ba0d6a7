import React, { useState, useCallback, useEffect } from "react";
import {
  Plus, Save, Pencil, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  Trash2, RefreshCw, List, HelpCircle, LogOut, Search
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";

const db = supabase as any;

const XLocalizarColumns: IGridColumn[] = [
  { key: "unidade_id", label: "Sigla", width: "100px" },
  { key: "descricao", label: "Descrição", width: "1fr" },
];

type TFormMode = "view" | "edit" | "insert";

interface IUnidade {
  unidade_id: string;
  descricao: string;
  empresa_id: number;
  excluido: boolean;
}

const UnidadeForm: React.FC = () => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("cadastro");
  const [XData, setXData] = useState<IUnidade[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XSiglaEdit, setXSiglaEdit] = useState("");
  const [XDescricaoEdit, setXDescricaoEdit] = useState("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const loadData = useCallback(async () => {
    const { data } = await db
      .from("unidade")
      .select("*")
      .eq("empresa_id", XEmpresaMatrizId)
      .eq("excluido",false)
      .order("unidade_id");
    setXData(data || []);
  }, [XEmpresaMatrizId]);

  useEffect(() => { loadData(); setXCurrentIdx(0); setXFormMode("view"); }, [XEmpresaMatrizId]);

  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      setXSiglaEdit(XCurrentRecord.unidade_id);
      setXDescricaoEdit(XCurrentRecord.descricao);
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => { setXFormMode("insert"); setXSiglaEdit(""); setXDescricaoEdit(""); setXInnerTab("cadastro"); };
  const handleEditar = () => { if (!XCurrentRecord) return; setXFormMode("edit"); setXInnerTab("cadastro"); };

  const handleSalvar = async () => {
    if (!XSiglaEdit.trim()) { toast.error("A sigla da unidade é obrigatória."); return; }
    if (!XDescricaoEdit.trim()) { toast.error("A descrição é obrigatória."); return; }
    if (XFormMode === "insert") {
      const { error } = await db.from("unidade").insert({ empresa_id: XEmpresaMatrizId, unidade_id: XSiglaEdit.trim().toUpperCase(), descricao: XDescricaoEdit.trim(), excluido: false });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Unidade incluída com sucesso.");
    } else if (XCurrentRecord) {
      const { error } = await db.from("unidade").update({ descricao: XDescricaoEdit.trim(), empresa_id: XEmpresaMatrizId, dt_alteracao: new Date().toISOString() }).eq("unidade_id", XCurrentRecord.unidade_id).eq("empresa_id", XEmpresaMatrizId);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Unidade alterada com sucesso.");
    }
    setXFormMode("view");
    await loadData();
  };

  const handleCancelar = () => setXFormMode("view");

  const handleExcluir = async () => {
    if (!XCurrentRecord) return;
    if (confirm(`Deseja realmente excluir a unidade "${XCurrentRecord.unidade_id}"?`)) {
      const { error } = await db.from("unidade").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("unidade_id", XCurrentRecord.unidade_id).eq("empresa_id", XEmpresaMatrizId);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Unidade excluída com sucesso.");
      await loadData();
      if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
    }
  };

  const handleFirst = () => setXCurrentIdx(0);
  const handlePrev = () => setXCurrentIdx(Math.max(0, XCurrentIdx - 1));
  const handleNext = () => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1));
  const handleLast = () => setXCurrentIdx(XData.length - 1);
  const handleRefresh = () => { loadData(); toast.info("Dados recarregados."); };
  const handleSair = () => { const XTab = XTabs.find(t => t.id === XActiveTabId); if (XTab) closeTab(XTab.id); };

  const XFilteredData = XData.filter(r => {
    const fs = XSearchFilters["unidade_id"] || "";
    const fd = XSearchFilters["descricao"] || "";
    if (fs && !r.unidade_id.toLowerCase().includes(fs.toLowerCase())) return false;
    if (fd && !r.descricao.toLowerCase().includes(fd.toLowerCase())) return false;
    return true;
  });

  const handleSelectFromSearch = (row: IUnidade) => {
    const XIdx = XData.findIndex(r => r.unidade_id === row.unidade_id);
    if (XIdx >= 0) { setXCurrentIdx(XIdx); setXInnerTab("cadastro"); setXFormMode("view"); }
  };

  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card flex-wrap">
        {!XIsEditing ? (
          <>
            <ToolbarBtn icon={<Plus size={16} />} label="Incluir" onClick={handleIncluir} color="success" />
            <ToolbarBtn icon={<Pencil size={16} />} label="Editar" onClick={handleEditar} disabled={!XCurrentRecord} />
            <ToolbarSep />
            <ToolbarBtn icon={<ChevronsLeft size={16} />} label="Primeiro" onClick={handleFirst} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronLeft size={16} />} label="Anterior" onClick={handlePrev} disabled={XCurrentIdx === 0} />
            <ToolbarBtn icon={<ChevronRight size={16} />} label="Próximo" onClick={handleNext} disabled={XCurrentIdx >= XData.length - 1} />
            <ToolbarBtn icon={<ChevronsRight size={16} />} label="Último" onClick={handleLast} disabled={XCurrentIdx >= XData.length - 1} />
            <ToolbarSep />
            <ToolbarBtn icon={<Trash2 size={16} />} label="Excluir" onClick={handleExcluir} disabled={!XCurrentRecord} color="destructive" />
            <ToolbarBtn icon={<RefreshCw size={16} />} label="Recarregar" onClick={handleRefresh} />
            <ToolbarBtn icon={<Search size={16} />} label="Localizar" onClick={() => setXInnerTab("localizar")} />
            <ToolbarBtn icon={<List size={16} />} label="Log" onClick={() => toast.info("Log de operações")} />
            <ToolbarBtn icon={<HelpCircle size={16} />} label="Ajuda" onClick={() => toast.info("Ajuda do formulário")} />
            <ToolbarBtn icon={<LogOut size={16} />} label="Sair" onClick={handleSair} />
          </>
        ) : (
          <>
            <ToolbarBtn icon={<Save size={16} />} label="Salvar" onClick={handleSalvar} color="success" />
            <ToolbarBtn icon={<LogOut size={16} />} label="Cancelar" onClick={handleCancelar} color="destructive" />
          </>
        )}
      </div>

      <div className="flex border-b border-border bg-card">
        <button className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === "cadastro" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setXInnerTab("cadastro")}>Cadastro</button>
        <button className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === "localizar" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setXInnerTab("localizar")}>Localizar</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-[13.5rem]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Emp. Matriz</label>
                <input type="text" value={(() => { const em = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId); return em ? `${em.empresa_id} - ${em.identificacao}` : String(XEmpresaMatrizId); })()} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:flex md:gap-4 gap-3">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Sigla <span className="text-destructive">*</span></label>
                {XIsEditing && XFormMode === "insert" ? (
                  <input type="text" value={XSiglaEdit} onChange={(e) => setXSiglaEdit(e.target.value.toUpperCase())} maxLength={10} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" autoFocus />
                ) : (
                  <input type="text" value={XCurrentRecord?.unidade_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição <span className="text-destructive">*</span></label>
                {XIsEditing ? (
                  <input type="text" value={XDescricaoEdit} onChange={(e) => setXDescricaoEdit(e.target.value)} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" autoFocus={XFormMode === "edit"} />
                ) : (
                  <input type="text" value={XCurrentRecord?.descricao ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
            </div>
          </div>
        ) : (
          <DataGrid
            columns={XLocalizarColumns}
            data={XFilteredData}
            showFilters
            filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={(row) => handleSelectFromSearch(row as IUnidade)}
            maxHeight="400px"
            exportTitle="Unidades"
          />
        )}
      </div>
    </div>
  );
};

const ToolbarBtn: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; color?: "success" | "destructive" | "default"; }> = ({ icon, label, onClick, disabled, color = "default" }) => {
  const XColorClass = color === "success" ? "text-success hover:bg-success/10" : color === "destructive" ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent";
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`p-1.5 rounded transition-colors ${XColorClass} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
      {icon}
    </button>
  );
};

const ToolbarSep = () => <div className="w-px h-5 bg-border mx-0.5" />;

export default UnidadeForm;
