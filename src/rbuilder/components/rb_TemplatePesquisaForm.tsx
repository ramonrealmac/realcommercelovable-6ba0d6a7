import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import FormToolbar from "@/components/shared/FormToolbar";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { rbFetchTemplates, rbInsertTemplate, rbUpdateTemplate, rbDeleteTemplate } from "../services/rb_templateService";
import { rbFetchConexoes } from "../services/rb_connectionService";
import type { IRbTemplatePesquisa, IRbConexao } from "../models/rb_types";
import { RB_TIPO_OPTIONS } from "../models/rb_types";

type TFormMode = "view" | "edit" | "insert";

const XColumns: IGridColumn[] = [
  { key: "rb_templatepesquisa_id", label: "Código", width: "80px", align: "right" },
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "label", label: "Label", width: "1fr" },
  { key: "tipo", label: "Tipo", width: "100px" },
  { key: "obrigatorio", label: "Obrig.", width: "60px", render: (r) => r.obrigatorio ? "Sim" : "Não" },
];

interface IEditState {
  nome: string; label: string; tipo: IRbTemplatePesquisa["tipo"]; obrigatorio: boolean;
  valor_padrao: string; opcoes_fixas: string; query: string; rb_conexao_id: number | null;
}

const EMPTY_EDIT: IEditState = { nome: "", label: "", tipo: "text", obrigatorio: false, valor_padrao: "", opcoes_fixas: "", query: "", rb_conexao_id: null };

const RbTemplatePesquisaForm: React.FC = () => {
  const { XEmpresaMatrizId, closeTab, XTabs, XActiveTabId } = useAppContext();
  const [XFormMode, setXFormMode] = useState<TFormMode>("view");
  const [XInnerTab, setXInnerTab] = useState<"cadastro" | "localizar">("cadastro");
  const [XData, setXData] = useState<IRbTemplatePesquisa[]>([]);
  const [XConexoes, setXConexoes] = useState<IRbConexao[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XEdit, setXEdit] = useState<IEditState>(EMPTY_EDIT);
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});

  const XCurrentRecord = XData[XCurrentIdx] || null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const loadData = useCallback(async () => {
    const [d, c] = await Promise.all([rbFetchTemplates(XEmpresaMatrizId), rbFetchConexoes(XEmpresaMatrizId)]);
    setXData(d); setXConexoes(c);
  }, [XEmpresaMatrizId]);

  useEffect(() => { loadData(); setXCurrentIdx(0); setXFormMode("view"); }, [XEmpresaMatrizId]);

  useEffect(() => {
    if (XCurrentRecord && XFormMode === "edit") {
      setXEdit({
        nome: XCurrentRecord.nome, label: XCurrentRecord.label, tipo: XCurrentRecord.tipo,
        obrigatorio: XCurrentRecord.obrigatorio, valor_padrao: XCurrentRecord.valor_padrao,
        opcoes_fixas: XCurrentRecord.opcoes_fixas, query: XCurrentRecord.query,
        rb_conexao_id: XCurrentRecord.rb_conexao_id,
      });
    }
  }, [XCurrentRecord, XFormMode]);

  const handleIncluir = () => { setXFormMode("insert"); setXEdit(EMPTY_EDIT); setXInnerTab("cadastro"); };
  const handleEditar = () => { if (!XCurrentRecord) return; setXFormMode("edit"); setXInnerTab("cadastro"); };

  const handleSalvar = async () => {
    if (!XEdit.nome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (XFormMode === "insert") {
      const { error } = await rbInsertTemplate({ empresa_id: XEmpresaMatrizId, ...XEdit });
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Variável criada.");
    } else if (XCurrentRecord) {
      const { error } = await rbUpdateTemplate(XCurrentRecord.rb_templatepesquisa_id, XEdit);
      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Variável atualizada.");
    }
    setXFormMode("view"); await loadData();
  };

  const handleExcluir = async () => {
    if (!XCurrentRecord || !confirm(`Excluir "${XCurrentRecord.nome}"?`)) return;
    await rbDeleteTemplate(XCurrentRecord.rb_templatepesquisa_id);
    toast.success("Excluída."); await loadData();
    if (XCurrentIdx > 0) setXCurrentIdx(XCurrentIdx - 1);
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
    const idx = XData.findIndex(r => r.rb_templatepesquisa_id === row.rb_templatepesquisa_id);
    if (idx >= 0) { setXCurrentIdx(idx); setXInnerTab("cadastro"); setXFormMode("view"); }
  };

  const renderField = (label: string, value: string, editEl?: React.ReactNode, required?: boolean) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label} {required && <span className="text-destructive">*</span>}</label>
      {XIsEditing && editEl ? editEl : (
        <input type="text" value={value} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
      )}
    </div>
  );

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
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {renderField("Código", XFormMode === "insert" ? "(Novo)" : String(XCurrentRecord?.rb_templatepesquisa_id ?? ""))}
              {renderField("Nome", XCurrentRecord?.nome ?? "", (
                <input type="text" value={XEdit.nome} onChange={e => setXEdit(p => ({ ...p, nome: e.target.value }))} autoFocus className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ), true)}
              {renderField("Label", XCurrentRecord?.label ?? "", (
                <input type="text" value={XEdit.label} onChange={e => setXEdit(p => ({ ...p, label: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
                {XIsEditing ? (
                  <select value={XEdit.tipo} onChange={e => setXEdit(p => ({ ...p, tipo: e.target.value as IRbTemplatePesquisa["tipo"] }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card">
                    {RB_TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type="text" value={RB_TIPO_OPTIONS.find(o => o.value === XCurrentRecord?.tipo)?.label ?? ""} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Obrigatório</label>
                {XIsEditing ? (
                  <label className="flex items-center gap-2 mt-1">
                    <input type="checkbox" checked={XEdit.obrigatorio} onChange={e => setXEdit(p => ({ ...p, obrigatorio: e.target.checked }))} />
                    <span className="text-sm">Sim</span>
                  </label>
                ) : (
                  <input type="text" value={XCurrentRecord?.obrigatorio ? "Sim" : "Não"} readOnly className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
                )}
              </div>
              {renderField("Valor Padrão", XCurrentRecord?.valor_padrao ?? "", (
                <input type="text" value={XEdit.valor_padrao} onChange={e => setXEdit(p => ({ ...p, valor_padrao: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
              ))}
            </div>
            {(XEdit.tipo === "select" || XCurrentRecord?.tipo === "select") && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Opções Fixas (JSON array)</label>
                {XIsEditing ? (
                  <textarea value={XEdit.opcoes_fixas} onChange={e => setXEdit(p => ({ ...p, opcoes_fixas: e.target.value }))} rows={2} placeholder='["Opção 1","Opção 2"]' className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card font-mono focus:ring-2 focus:ring-ring outline-none" />
                ) : (
                  <textarea value={XCurrentRecord?.opcoes_fixas ?? ""} readOnly rows={2} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary font-mono" />
                )}
              </div>
            )}
            {(XEdit.tipo === "query_select" || XCurrentRecord?.tipo === "query_select") && (
              <>
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
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Query SQL</label>
                  {XIsEditing ? (
                    <textarea value={XEdit.query} onChange={e => setXEdit(p => ({ ...p, query: e.target.value }))} rows={3} placeholder="SELECT id, descricao FROM tabela" className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card font-mono focus:ring-2 focus:ring-ring outline-none" />
                  ) : (
                    <textarea value={XCurrentRecord?.query ?? ""} readOnly rows={3} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary font-mono" />
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <DataGrid columns={XColumns} data={XFilteredData} showFilters filterValues={XSearchFilters}
            onFilterChange={(key, value) => setXSearchFilters(prev => ({ ...prev, [key]: value }))}
            onRowDoubleClick={handleSelectFromSearch} maxHeight="400px" exportTitle="Variáveis de Pesquisa" />
        )}
      </div>
    </div>
  );
};

export default RbTemplatePesquisaForm;
