import React, { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { rbFetchRelatorios, rbInsertRelatorio, rbUpdateRelatorio, rbDeleteRelatorio, rbFetchVariaveis, rbInsertVariavel, rbDeleteVariavel } from "../services/rb_reportService";
import { rbFetchConexoes } from "../services/rb_connectionService";
import { rbFetchTemplates } from "../services/rb_templateService";
import { rbExecutarQuery } from "../services/rb_queryService";
import RbLayoutEditor from "./rb_LayoutEditor";
import RbReportPreview from "./rb_ReportPreview";
import type { IRbRelatorio, IRbRelatorioVariavel, IRbConexao, IRbTemplatePesquisa, IRbReportLayout } from "../models/rb_types";
import { RB_OPERADOR_OPTIONS } from "../models/rb_types";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

type TFormMode = "view" | "edit" | "insert";

const XColumns: IGridColumn[] = [
  { key: "rb_relatorio_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "menu", label: "Menu", width: "120px" },
  { key: "submenu", label: "Submenu", width: "120px" },
  { key: "ordem", label: "Ordem", width: "60px", align: "right" },
];

const EMPTY_LAYOUT: IRbReportLayout = {
  title: "", subtitle: "", columns: [], groupByField: "", showHeader: true, showFooter: false,
};

interface IEditState {
  nome: string; rb_conexao_id: number | null; menu: string; submenu: string; ordem: number; query_sql: string; report_json: IRbReportLayout;
}

const EMPTY_EDIT: IEditState = { nome: "", rb_conexao_id: null, menu: "", submenu: "", ordem: 0, query_sql: "", report_json: EMPTY_LAYOUT };

const RbRelatorioForm: React.FC = () => {
  const { XEmpresaMatrizId, closeTab, XTabs, XActiveTabId } = useAppContext();
  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"dados" | "query" | "variaveis" | "layout" | "execucao" | "localizar">("dados");
  const [XData, setXData] = useState<IRbRelatorio[]>([]);
  const [XConexoes, setXConexoes] = useState<IRbConexao[]>([]);
  const [XTemplates, setXTemplates] = useState<IRbTemplatePesquisa[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XEdit, setXEdit] = useState<IEditState>(EMPTY_EDIT);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XVariaveis, setXVariaveis] = useState<IRbRelatorioVariavel[]>([]);
  const [XPreviewData, setXPreviewData] = useState<any[]>([]);
  const [XDetectedColumns, setXDetectedColumns] = useState<string[]>([]);
  const [XAddVarId, setXAddVarId] = useState<number | null>(null);
  const [XAddVarOp, setXAddVarOp] = useState("=");

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const loadData = useCallback(async () => {
    const [d, c, t] = await Promise.all([
      rbFetchRelatorios(XEmpresaMatrizId),
      rbFetchConexoes(XEmpresaMatrizId),
      rbFetchTemplates(XEmpresaMatrizId),
    ]);
    setXData(d); setXConexoes(c); setXTemplates(t);
  }, [XEmpresaMatrizId]);

  useEffect(() => { loadData(); setXCurrentIdx(0); setXFormMode("view"); }, [XEmpresaMatrizId]);

  useEffect(() => {
    if (XCurrentRecord) {
      if (XFormMode === "edit") {
        setXEdit({
          nome: XCurrentRecord.nome, rb_conexao_id: XCurrentRecord.rb_conexao_id,
          menu: XCurrentRecord.menu, submenu: XCurrentRecord.submenu, ordem: XCurrentRecord.ordem,
          query_sql: XCurrentRecord.query_sql, report_json: XCurrentRecord.report_json || EMPTY_LAYOUT,
        });
      }
      rbFetchVariaveis(XCurrentRecord.rb_relatorio_id).then(setXVariaveis);
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => { setXFormMode("insert"); setXEdit(EMPTY_EDIT); setXVariaveis([]); setXInnerTab("dados"); };
  const handleEditar = () => { if (!XCurrentRecord) return; setXFormMode("edit"); setXInnerTab("dados"); };

  const handleSalvar = async () => {
    if (!XEdit.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    const XPayload = { empresa_id: XEmpresaMatrizId, ...XEdit };
    if (XFormMode === "insert") {
      const { error } = await rbInsertRelatorio(XPayload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Relatório criado.");
    } else if (XCurrentRecord) {
      const { error } = await rbUpdateRelatorio(XCurrentRecord.rb_relatorio_id, XPayload);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Relatório atualizado.");
    }
    setXFormMode("view"); await loadData();
  };

  const handleExcluir = async () => {
    if (!XCurrentRecord || !confirm(`Excluir "${XCurrentRecord.nome}"?`)) return;
    await rbDeleteRelatorio(XCurrentRecord.rb_relatorio_id);
    toast.success("Excluído."); await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
  };

  const handleSair = () => { const t = XTabs.find(t => t.id === XActiveTabId); if (t) closeTab(t.id); };

  const handleExecutarQuery = async () => {
    const XSql = XIsEditing ? XEdit.query_sql : XCurrentRecord?.query_sql || "";
    if (!XSql.trim()) { toast.error("Query SQL vazia."); return; }
    const XCon = XConexoes.find(c => c.rb_conexao_id === (XIsEditing ? XEdit.rb_conexao_id : XCurrentRecord?.rb_conexao_id));
    const { data, error } = await rbExecutarQuery(XSql, {}, XCon);
    if (error) { toast.error(error); return; }
    setXPreviewData(data);
    if (data.length > 0) setXDetectedColumns(Object.keys(data[0]));
    toast.success(`${data.length} registro(s) retornado(s).`);
  };

  const handleAddVariavel = async () => {
    if (!XCurrentRecord || !XAddVarId) return;
    const { error } = await rbInsertVariavel({ rb_relatorio_id: XCurrentRecord.rb_relatorio_id, rb_templatepesquisa_id: XAddVarId, operador: XAddVarOp });
    if (error) { toast.error(error.message); return; }
    const v = await rbFetchVariaveis(XCurrentRecord.rb_relatorio_id);
    setXVariaveis(v); setXAddVarId(null);
  };

  const handleRemoveVariavel = async (id: number) => {
    await rbDeleteVariavel(id);
    if (XCurrentRecord) {
      const v = await rbFetchVariaveis(XCurrentRecord.rb_relatorio_id);
      setXVariaveis(v);
    }
  };

  const XFilteredData = useMemo(() => {
    return XData.filter(r => {
      for (const [k, v] of Object.entries(XSearchFilters)) {
        if (v && !String((r as any)[k] || "").toLowerCase().includes(v.toLowerCase())) return false;
      }
      return true;
    });
  }, [XData, XSearchFilters]);

  const handleSelectFromSearch = (row: any) => {
    const idx = XData.findIndex(r => r.rb_relatorio_id === row.rb_relatorio_id);
    if (idx >= 0) { setXCurrentIdx(idx); setXInnerTab("dados"); setXFormMode("view"); }
  };

  const XTabs2 = ["dados", "query", "variaveis", "layout", "execucao", "localizar"] as const;
  const XTabLabels: Record<string, string> = { dados: "Dados", query: "Query", variaveis: "Variáveis", layout: "Layout", execucao: "Execução", localizar: "Localizar" };

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
      <div className="flex border-b border-border bg-card overflow-x-auto">
        {XTabs2.map(t => (
          <button key={t} className={`px-4 py-1.5 text-sm font-medium border-b-2 whitespace-nowrap ${XInnerTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`} onClick={() => setXInnerTab(t)}>
            {XTabLabels[t]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {XInnerTab === "dados" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Código</label>
                <input type="text" value={XFormMode === "insert" ? "(Novo)" : XCurrentRecord?.rb_relatorio_id ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nome <span className="text-destructive">*</span></label>
                {XIsEditing ? (
                  <input type="text" value={XEdit.nome} onChange={e => setXEdit(p => ({ ...p, nome: e.target.value }))} autoFocus className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                ) : (
                  <input type="text" value={XCurrentRecord?.nome ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Conexão</label>
                {XIsEditing ? (
                  <select value={XEdit.rb_conexao_id ?? ""} onChange={e => setXEdit(p => ({ ...p, rb_conexao_id: e.target.value ? Number(e.target.value) : null }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card">
                    <option value="">-- Conexão padrão --</option>
                    {XConexoes.map(c => <option key={c.rb_conexao_id} value={c.rb_conexao_id}>{c.nome}</option>)}
                  </select>
                ) : (
                  <input type="text" value={XConexoes.find(c => c.rb_conexao_id === XCurrentRecord?.rb_conexao_id)?.nome ?? "Padrão"} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Menu</label>
                {XIsEditing ? (
                  <input type="text" value={XEdit.menu} onChange={e => setXEdit(p => ({ ...p, menu: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                ) : (
                  <input type="text" value={XCurrentRecord?.menu ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Submenu</label>
                {XIsEditing ? (
                  <input type="text" value={XEdit.submenu} onChange={e => setXEdit(p => ({ ...p, submenu: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                ) : (
                  <input type="text" value={XCurrentRecord?.submenu ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Ordem</label>
                {XIsEditing ? (
                  <input type="number" value={XEdit.ordem} onChange={e => setXEdit(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none text-right" />
                ) : (
                  <input type="text" value={XCurrentRecord?.ordem ?? 0} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
                )}
              </div>
            </div>
          </div>
        )}

        {XInnerTab === "query" && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">Query SQL (use {"{{variavel}}"} para filtros)</label>
            {XIsEditing ? (
              <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Carregando editor...</div>}>
                <MonacoEditor
                  height="300px"
                  language="sql"
                  value={XEdit.query_sql}
                  onChange={v => setXEdit(p => ({ ...p, query_sql: v || "" }))}
                  theme="vs-dark"
                  options={{ minimap: { enabled: false }, fontSize: 13 }}
                />
              </Suspense>
            ) : (
              <pre className="w-full border border-border rounded p-3 text-sm bg-secondary font-mono whitespace-pre-wrap min-h-[200px]">{XCurrentRecord?.query_sql ?? ""}</pre>
            )}
            <button onClick={handleExecutarQuery} className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90">
              Executar Query
            </button>
            {XPreviewData.length > 0 && <div className="text-xs text-muted-foreground">{XPreviewData.length} registro(s) | Colunas: {XDetectedColumns.join(", ")}</div>}
          </div>
        )}

        {XInnerTab === "variaveis" && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Variáveis vinculadas ao relatório</h4>
            {XVariaveis.length > 0 ? (
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-muted px-2 py-1 grid grid-cols-[1fr_1fr_100px_40px] gap-1 text-xs font-semibold text-muted-foreground">
                  <span>Variável</span><span>Label</span><span>Operador</span><span></span>
                </div>
                {XVariaveis.map(v => {
                  const t = XTemplates.find(tp => tp.rb_templatepesquisa_id === v.rb_templatepesquisa_id);
                  return (
                    <div key={v.rb_relatorio_variavel_id} className="px-2 py-1 grid grid-cols-[1fr_1fr_100px_40px] gap-1 text-xs border-t border-border items-center">
                      <span>{t?.nome ?? v.rb_templatepesquisa_id}</span>
                      <span>{t?.label ?? ""}</span>
                      <span>{v.operador}</span>
                      <button onClick={() => handleRemoveVariavel(v.rb_relatorio_variavel_id)} className="text-destructive hover:bg-destructive/10 rounded p-0.5">✕</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Nenhuma variável vinculada.</div>
            )}
            {XCurrentRecord && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Variável</label>
                  <select value={XAddVarId ?? ""} onChange={e => setXAddVarId(e.target.value ? Number(e.target.value) : null)} className="border border-border rounded px-2 py-1 text-sm bg-card">
                    <option value="">Selecione...</option>
                    {XTemplates.map(t => <option key={t.rb_templatepesquisa_id} value={t.rb_templatepesquisa_id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Operador</label>
                  <select value={XAddVarOp} onChange={e => setXAddVarOp(e.target.value)} className="border border-border rounded px-2 py-1 text-sm bg-card">
                    {RB_OPERADOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <button onClick={handleAddVariavel} disabled={!XAddVarId} className="px-3 py-1 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  Adicionar
                </button>
              </div>
            )}
          </div>
        )}

        {XInnerTab === "layout" && (
          <RbLayoutEditor
            XLayout={XIsEditing ? XEdit.report_json : (XCurrentRecord?.report_json || EMPTY_LAYOUT)}
            onChange={l => { if (XIsEditing) setXEdit(p => ({ ...p, report_json: l })); }}
            XAvailableColumns={XDetectedColumns}
          />
        )}

        {XInnerTab === "execucao" && (
          <div className="space-y-3">
            <button onClick={handleExecutarQuery} className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90">
              Executar Query
            </button>
            <RbReportPreview XData={XPreviewData} XLayout={XIsEditing ? XEdit.report_json : (XCurrentRecord?.report_json || EMPTY_LAYOUT)} />
          </div>
        )}

        {XInnerTab === "localizar" && (
          <DataGrid columns={XColumns} data={XFilteredData} showFilters filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={handleSelectFromSearch} maxHeight="400px" exportTitle="Relatórios RBuilder" />
        )}
      </div>
    </div>
  );
};

export default RbRelatorioForm;
