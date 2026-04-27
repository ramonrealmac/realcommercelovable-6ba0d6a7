import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { rbFetchConexoes, rbInsertConexao, rbUpdateConexao, rbDeleteConexao, rbTestarConexao } from "../services/rb_connectionService";
import type { IRbConexao } from "../models/rb_types";

type TFormMode = "view" | "edit" | "insert";

const XColumns: IGridColumn[] = [
  { key: "rb_conexao_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "url", label: "URL", width: "1fr" },
  { key: "descricao", label: "Descrição", width: "1fr" },
];

const RbConexaoForm: React.FC = () => {
  const { XEmpresaMatrizId, closeTab, XTabs, XActiveTabId } = useAppContext();
  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("cadastro");
  const [XData, setXData] = useState<IRbConexao[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XEdit, setXEdit] = useState({ nome: "", url: "", api_key: "", descricao: "" });
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XTestando, setXTestando] = useState(false);

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const loadData = useCallback(async () => {
    const d = await rbFetchConexoes(XEmpresaMatrizId);
    setXData(d);
  }, [XEmpresaMatrizId]);

  useEffect(() => { loadData(); setXCurrentIdx(0); setXFormMode("view"); }, [XEmpresaMatrizId]);

  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      setXEdit({ nome: XCurrentRecord.nome, url: XCurrentRecord.url, api_key: XCurrentRecord.api_key, descricao: XCurrentRecord.descricao });
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => { setXFormMode("insert"); setXEdit({ nome: "", url: "", api_key: "", descricao: "" }); setXInnerTab("cadastro"); };
  const handleEditar = () => { if (!XCurrentRecord) return; setXFormMode("edit"); setXInnerTab("cadastro"); };

  const handleSalvar = async () => {
    if (!XEdit.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!XEdit.url.trim()) { toast.error("URL é obrigatória."); return; }
    if (XFormMode === "insert") {
      const { error } = await rbInsertConexao({ empresa_id: XEmpresaMatrizId, ...XEdit });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Conexão criada.");
    } else if (XCurrentRecord) {
      const { error } = await rbUpdateConexao(XCurrentRecord.rb_conexao_id, XEdit);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Conexão atualizada.");
    }
    setXFormMode("view"); await loadData();
  };

  const handleExcluir = async () => {
    if (!XCurrentRecord || !confirm(`Excluir "${XCurrentRecord.nome}"?`)) return;
    await rbDeleteConexao(XCurrentRecord.rb_conexao_id);
    toast.success("Conexão excluída."); await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleTestar = async () => {
    setXTestando(true);
    const r = await rbTestarConexao(XEdit.url, XEdit.api_key);
    setXTestando(false);
    if (r.ok) toast.success(r.msg); else toast.error(r.msg);
  };

  const handleSair = () => { const t = XTabs.find(t => t.id === XActiveTabId); if (t) closeTab(t.id); };

  const XFilteredData = useMemo(() => {
    return XData.filter(r => {
      for (const [k, v] of Object.entries(XSearchFilters)) {
        if (v && !String((r as any)[k] || "").toLowerCase().includes(v.toLowerCase())) return false;
      }
      return true;
    });
  }, [XData, XSearchFilters]);

  const handleSelectFromSearch = (row: any) => {
    const idx = XData.findIndex(r => r.rb_conexao_id === row.rb_conexao_id);
    if (idx >= 0) { setXCurrentIdx(idx); setXInnerTab("cadastro"); setXFormMode("view"); }
  };

  return (
    <div className="flex flex-col h-full bg-card" data-form-container>
      <FormToolbar
        XIsEditing={XIsEditing} XHasRecord={!!XCurrentRecord}
        XIsFirst={XCurrentIdx === 0} XIsLast={XCurrentIdx >= XData.length - 1}
        onIncluir={handleIncluir} onEditar={handleEditar} onSalvar={handleSalvar}
        onCancelar={() => setXFormMode("view")} onExcluir={handleExcluir}
        onFirst={() => setXCurrentIdx(0)} onPrev={() => setXCurrentIdx(Math.max(0, XCurrentIdx - 1))}
        onNext={() => setXCurrentIdx(Math.min(XData.length - 1, XCurrentIdx + 1))}
        onLast={() => setXCurrentIdx(XData.length - 1)}
        onRefresh={async () => { await loadData(); toast.info("Recarregado."); }}
        onLocalizar={() => setXInnerTab("localizar")} onSair={handleSair}
      />
      <div className="flex border-b border-border bg-card">
        {(["cadastro", "localizar"] as const).map(t => (
          <button key={t} className={`px-4 py-1.5 text-sm font-medium border-b-2 ${XInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setXInnerTab(t)}>
            {t === "cadastro" ? "Cadastro" : "Localizar"}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "cadastro" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={XFormMode === "insert" ? "(Novo)" : XCurrentRecord?.rb_conexao_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                {XIsEditing ? (
                  <input type="text" value={XEdit.nome} onChange={e => setXEdit(p => ({ ...p, nome: e.target.value }))} autoFocus className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                ) : (
                  <input type="text" value={XCurrentRecord?.nome ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">URL <span className="text-destructive">*</span></label>
              {XIsEditing ? (
                <input type="text" value={XEdit.url} onChange={e => setXEdit(p => ({ ...p, url: e.target.value }))} placeholder="https://xxx.supabase.co" className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ) : (
                <input type="text" value={XCurrentRecord?.url ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">API Key</label>
              {XIsEditing ? (
                <input type="password" value={XEdit.api_key} onChange={e => setXEdit(p => ({ ...p, api_key: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ) : (
                <input type="password" value={XCurrentRecord?.api_key ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
              {XIsEditing ? (
                <textarea value={XEdit.descricao} onChange={e => setXEdit(p => ({ ...p, descricao: e.target.value }))} rows={2} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ) : (
                <textarea value={XCurrentRecord?.descricao ?? ""} readOnly rows={2} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
              )}
            </div>
            {XIsEditing && (
              <button onClick={handleTestar} disabled={XTestando} className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {XTestando ? "Testando..." : "Testar Conexão"}
              </button>
            )}
          </div>
        ) : (
          <DataGrid columns={XColumns} data={XFilteredData} showFilters filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={handleSelectFromSearch} maxHeight="400px" exportTitle="Conexões RBuilder" />
        )}
      </div>
    </div>
  );
};

export default RbConexaoForm;
