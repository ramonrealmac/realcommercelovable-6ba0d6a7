// ============================================================
// Report Builder Pro — Manager (CRUD + Designer + Executor)
// Componente raiz do módulo, integra tudo
// ============================================================
import React, { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { toast } from 'sonner';
import FormToolbar from '@/components/shared/FormToolbar';
import DataGrid, { IGridColumn } from '@/components/grid/DataGrid';
import GridActionToolbar, { gridActions } from '@/components/grid/GridActionToolbar';
import type { IRpbRelatorio, IRpbFiltro, IRpbConexao, RpbLayout } from '../../types';
import { emptyLayout } from '../../types';
import {
  rpbListRelatorios, rpbInsertRelatorio,
  rpbUpdateRelatorio, rpbDeleteRelatorio, rpbSaveLayout,
  rpbListFiltros, rpbInsertFiltro, rpbUpdateFiltro, rpbDeleteFiltro,
  rpbListConexoes, rpbExecuteQuery,
} from '../../services/rpbService';
import RpbExecutor from '../executor/RpbExecutor';
import { Plus, Trash2, Pencil, Play, PenTool } from 'lucide-react'; // Pencil/Trash2 usados no form de filtros

const RpbDesigner = lazy(() => import('../designer/RpbDesigner'));

// ── Colunas da grid ──────────────────────────────────────────
const GRID_COLS: IGridColumn[] = [
  { key: 'rpb_relatorio_id', label: 'Cód.',      width: '60px',  align: 'right' },
  { key: 'categoria',        label: 'Categoria', width: '130px' },
  { key: 'nome',             label: 'Nome',      width: '2fr' },
  { key: 'descricao',        label: 'Descrição', width: '2fr' },
];

type TView = 'list' | 'form' | 'designer' | 'execute';

const FILTRO_TIPOS = [
  { v: 'text',         l: 'Texto' },
  { v: 'date',         l: 'Data' },
  { v: 'date_range',   l: 'Período (de/até)' },
  { v: 'number',       l: 'Número' },
  { v: 'select',       l: 'Lista Fixa' },
  { v: 'boolean',      l: 'Sim/Não' },
];

const emptyForm = (): Partial<IRpbRelatorio> => ({
  nome: '', descricao: '', categoria: '', query_sql: '', rpb_conexao_id: null,
});

const emptyFiltro = (): Partial<IRpbFiltro> => ({
  nome: '', label: '', tipo: 'text', obrigatorio: false,
  valor_padrao: '', opcoes_fixas: '', query_opcoes: '', ordem: 0,
});

const RpbManager: React.FC = () => {
  const { XEmpresaId, closeTab, XTabs, XActiveTabId } = useAppContext();

  const [view, setView]               = useState<TView>('list');
  const [relatorios, setRelatorios]   = useState<IRpbRelatorio[]>([]);
  const [conexoes, setConexoes]       = useState<IRpbConexao[]>([]);
  const [selected, setSelected]       = useState<IRpbRelatorio | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [form, setForm]               = useState(emptyForm());
  const [filtros, setFiltros]         = useState<IRpbFiltro[]>([]);
  const [filtroForm, setFiltroForm]   = useState(emptyFiltro());
  const [filtroIdx, setFiltroIdx]     = useState<number | null>(null);
  const [filtroMode, setFiltroMode]   = useState<'view'|'edit'|'insert'>('view');
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  const [activeInnerTab, setActiveInnerTab] = useState<'dados'|'query'|'filtros'>('dados');
  const [searchFilter, setSearchFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [mode, setMode]               = useState<'view'|'edit'|'insert'>('view');

  const isEditing = mode === 'edit' || mode === 'insert';

  const load = useCallback(async () => {
    const [rels, cons] = await Promise.all([
      rpbListRelatorios(XEmpresaId),
      rpbListConexoes(XEmpresaId),
    ]);
    setRelatorios(rels);
    setConexoes(cons);
  }, [XEmpresaId]);

  useEffect(() => { load(); }, [load]);

  const loadFiltros = useCallback(async (id: number) => {
    const f = await rpbListFiltros(id);
    setFiltros(f);
  }, []);

  useEffect(() => {
    if (selected) loadFiltros(selected.rpb_relatorio_id);
  }, [selected, loadFiltros]);

  const handleNew = () => {
    setForm(emptyForm());
    setSelected(null);
    setFiltros([]);
    setQueryColumns([]);
    setMode('insert');
    setView('form');
    setActiveInnerTab('dados');
  };

  const handleEdit = (rel: IRpbRelatorio) => {
    setSelected(rel);
    setForm({
      nome: rel.nome, descricao: rel.descricao,
      categoria: rel.categoria, query_sql: rel.query_sql,
      rpb_conexao_id: rel.rpb_conexao_id,
    });
    setMode('edit');
    setView('form');
    setActiveInnerTab('dados');
  };

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error('Nome é obrigatório.'); return; }
    setSaving(true);
    const payload = { empresa_id: XEmpresaId, ...form };
    if (mode === 'insert') {
      const { data, error } = await rpbInsertRelatorio(payload);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      await load();
      const novo = relatorios.find(r => r.rpb_relatorio_id === data?.rpb_relatorio_id) || data;
      setSelected(novo);
      toast.success('Relatório criado!');
    } else if (selected) {
      const { error } = await rpbUpdateRelatorio(selected.rpb_relatorio_id, payload);
      if (error) { toast.error('Erro: ' + error.message); setSaving(false); return; }
      await load();
      toast.success('Relatório salvo!');
    }
    setMode('view');
    setSaving(false);
  };

  const handleDelete = async (rel: IRpbRelatorio) => {
    if (!confirm(`Excluir "${rel.nome}"?`)) return;
    await rpbDeleteRelatorio(rel.rpb_relatorio_id);
    toast.success('Excluído.');
    await load();
    if (selected?.rpb_relatorio_id === rel.rpb_relatorio_id) {
      setSelected(null); setView('list');
    }
  };

  const handleTestQuery = async () => {
    if (!form.query_sql?.trim()) { toast.warning('Query vazia.'); return; }
    const conexao = conexoes.find(c => c.rpb_conexao_id === form.rpb_conexao_id) || null;
    const { data, error } = await rpbExecuteQuery(form.query_sql, {}, conexao);
    if (error) { toast.error('Erro: ' + error); return; }
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    setQueryColumns(cols);
    toast.success(`${data.length} registros. Colunas: ${cols.join(', ')}`);
  };

  const handleSaveLayout = async (layout: RpbLayout) => {
    if (!selected) return;
    const { error } = await rpbSaveLayout(selected.rpb_relatorio_id, layout);
    if (error) toast.error('Erro ao salvar layout.');
    else { toast.success('Layout salvo!'); await load(); }
  };

  // ── Filtros CRUD ─────────────────────────────────────────
  const handleSaveFiltro = async () => {
    if (!selected) return;
    if (!filtroForm.nome?.trim()) { toast.error('Nome interno obrigatório.'); return; }
    if (!filtroForm.label?.trim()) { toast.error('Rótulo obrigatório.'); return; }
    const payload = { ...filtroForm, rpb_relatorio_id: selected.rpb_relatorio_id, empresa_id: XEmpresaId };
    if (filtroMode === 'insert') {
      const { error } = await rpbInsertFiltro(payload);
      if (error) { toast.error(error.message); return; }
    } else if (filtroMode === 'edit' && filtroIdx !== null) {
      const { error } = await rpbUpdateFiltro(filtros[filtroIdx].rpb_filtro_id, filtroForm);
      if (error) { toast.error(error.message); return; }
    }
    setFiltroMode('view'); setFiltroIdx(null); setFiltroForm(emptyFiltro());
    loadFiltros(selected.rpb_relatorio_id);
    toast.success('Filtro salvo.');
  };

  const handleDeleteFiltro = async (id: number) => {
    if (!confirm('Excluir filtro?')) return;
    await rpbDeleteFiltro(id);
    loadFiltros(selected!.rpb_relatorio_id);
    toast.success('Filtro excluído.');
  };

  const filtered = relatorios.filter(r =>
    !searchFilter ||
    r.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
    r.categoria.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const setF = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setFF = (k: string, v: any) => setFiltroForm(p => ({ ...p, [k]: v }));

  const inp = 'w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-1 focus:ring-ring outline-none';
  const sel = 'w-full border border-border rounded px-2 py-1.5 text-sm bg-card';

  // ── Renderização ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-sm font-bold text-muted-foreground">📊 Report Builder Pro</span>
        <div className="flex-1" />
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setMode('view'); }}
            className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary">
            ← Lista
          </button>
        )}
        {view === 'list' && (
          <button onClick={handleNew}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> Novo Relatório
          </button>
        )}
        {view === 'form' && selected && mode === 'view' && (
          <>
            <button onClick={() => handleEdit(selected)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button onClick={() => { setView('designer'); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
              🎨 Designer
            </button>
            <button onClick={() => setView('execute')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-green-600 text-white hover:bg-green-700">
              <Play className="w-3.5 h-3.5" /> Executar
            </button>
          </>
        )}
        {view === 'form' && isEditing && (
          <>
            <button onClick={() => setMode('view')}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? 'Salvando...' : '💾 Salvar'}
            </button>
          </>
        )}
        <button onClick={() => { const t = XTabs.find(t => t.id === XActiveTabId); if (t) closeTab(t.id); }}
          className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary">
          Sair
        </button>
      </div>

      {/* ── Lista ────────────────────────────────────── */}
      {view === 'list' && (
        <div className="flex-1 overflow-auto p-3">
          <DataGrid
            columns={GRID_COLS}
            data={filtered}
            maxHeight="calc(100vh - 150px)"
            exportTitle="Relatórios"
            selectedIdx={selectedIdx}
            showFilters={showFilters}
            filterValues={{ nome: searchFilter }}
            onFilterChange={(_, v) => setSearchFilter(v)}
            onRowClick={(row, idx) => {
              setSelectedIdx(idx);
              const rel = relatorios.find(r => r.rpb_relatorio_id === row.rpb_relatorio_id) || null;
              setSelected(rel);
            }}
            onRowDoubleClick={(row) => {
              const rel = relatorios.find(r => r.rpb_relatorio_id === row.rpb_relatorio_id);
              if (rel) { setSelected(rel); setSelectedIdx(null); handleEdit(rel); }
            }}
            showRecordCount={false}
            toolbarLeft={
              <GridActionToolbar
                actions={[
                  gridActions.incluir(handleNew),
                  gridActions.alterar(() => selected && handleEdit(selected), !selected),
                  null,
                  gridActions.excluir(() => selected && handleDelete(selected), !selected),
                  gridActions.atualizar(load),
                  gridActions.filtro(() => setShowFilters(v => !v), showFilters),
                ]}
                count={`${filtered.length} relatório(s)`}
                extras={
                  <>
                    <div className="w-px h-5 bg-border mx-1" />
                    {/* Botão Executar */}
                    <button
                      onClick={() => selected && setView('execute')}
                      disabled={!selected}
                      title="Executar relatório selecionado"
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        selected
                          ? 'border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:scale-105 active:scale-95'
                          : 'border-border text-muted-foreground opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <Play size={13} /> Executar
                    </button>
                    {/* Botão Designer */}
                    <button
                      onClick={() => selected && setView('designer')}
                      disabled={!selected}
                      title="Abrir designer de layout"
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        selected
                          ? 'border-indigo-500 text-indigo-600 hover:bg-indigo-50 hover:scale-105 active:scale-95'
                          : 'border-border text-muted-foreground opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <PenTool size={13} /> Designer
                    </button>
                  </>
                }
              />
            }
          />
        </div>
      )}

      {/* Formulário de edição */}
      {view === 'form' && (
        <div className="flex-1 overflow-auto p-4">
          {/* Inner tabs */}
          <div className="flex border-b border-border mb-4">
            {(['dados','query','filtros'] as const).map(t => (
              <button key={t} onClick={() => setActiveInnerTab(t)}
                className={`px-4 py-1.5 text-sm font-medium border-b-2 ${
                  activeInnerTab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                }`}>
                {t === 'dados' ? 'Dados' : t === 'query' ? 'Query SQL' : 'Filtros'}
              </button>
            ))}
          </div>

          {activeInnerTab === 'dados' && (
            <div className="space-y-3 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Nome *</label>
                  <input value={isEditing ? (form.nome || '') : selected?.nome || ''} readOnly={!isEditing}
                    onChange={e => setF('nome', e.target.value)}
                    className={inp + (!isEditing ? ' bg-secondary' : '')} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold">Categoria</label>
                  <input value={isEditing ? (form.categoria || '') : selected?.categoria || ''} readOnly={!isEditing}
                    onChange={e => setF('categoria', e.target.value)}
                    placeholder="Ex: Financeiro, Vendas..."
                    className={inp + (!isEditing ? ' bg-secondary' : '')} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold">Descrição</label>
                <input value={isEditing ? (form.descricao || '') : selected?.descricao || ''} readOnly={!isEditing}
                  onChange={e => setF('descricao', e.target.value)}
                  className={inp + (!isEditing ? ' bg-secondary' : '')} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-semibold">Conexão</label>
                {isEditing ? (
                  <select value={form.rpb_conexao_id || ''} onChange={e => setF('rpb_conexao_id', e.target.value ? Number(e.target.value) : null)} className={sel}>
                    <option value="">— Supabase (padrão) —</option>
                    {conexoes.map(c => <option key={c.rpb_conexao_id} value={c.rpb_conexao_id}>{c.nome}</option>)}
                  </select>
                ) : (
                  <input readOnly value={conexoes.find(c => c.rpb_conexao_id === selected?.rpb_conexao_id)?.nome || 'Supabase (padrão)'} className={inp + ' bg-secondary'} />
                )}
              </div>
            </div>
          )}

          {activeInnerTab === 'query' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-semibold">Query SQL</label>
                <p className="text-xs text-muted-foreground">— Use &#123;&#123;variavel&#125;&#125; para filtros</p>
                <div className="flex-1" />
                <button onClick={handleTestQuery}
                  className="flex items-center gap-1 px-3 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  <Play className="w-3 h-3" /> Testar Query
                </button>
              </div>
              {isEditing ? (
                <textarea value={form.query_sql || ''} onChange={e => setF('query_sql', e.target.value)}
                  rows={12} className={inp + ' font-mono text-xs resize-y'} />
              ) : (
                <pre className="border border-border rounded p-3 text-xs font-mono bg-secondary whitespace-pre-wrap min-h-[200px]">
                  {selected?.query_sql || ''}
                </pre>
              )}
              {queryColumns.length > 0 && (
                <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                  Colunas detectadas: <strong>{queryColumns.join(', ')}</strong>
                </div>
              )}
            </div>
          )}

          {activeInnerTab === 'filtros' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Filtros do Relatório</h4>
                {mode !== 'insert' && (
                  <button onClick={() => { setFiltroMode('insert'); setFiltroForm(emptyFiltro()); setFiltroIdx(null); }}
                    className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground">
                    <Plus className="w-3 h-3" /> Novo Filtro
                  </button>
                )}
              </div>

              {mode === 'insert' && <p className="text-xs text-muted-foreground">Salve o relatório primeiro para adicionar filtros.</p>}

              {(filtroMode === 'insert' || filtroMode === 'edit') && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-secondary/20">
                  <p className="text-xs font-semibold">{filtroMode === 'insert' ? 'Novo Filtro' : 'Editar Filtro'}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Nome interno (&#123;&#123;variavel&#125;&#125;) *</label>
                      <input value={filtroForm.nome || ''} onChange={e => setFF('nome', e.target.value)} placeholder="dt_inicial" className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Rótulo *</label>
                      <input value={filtroForm.label || ''} onChange={e => setFF('label', e.target.value)} placeholder="Data Inicial" className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Tipo</label>
                      <select value={filtroForm.tipo || 'text'} onChange={e => setFF('tipo', e.target.value)} className={sel}>
                        {FILTRO_TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                    </div>
                    {filtroForm.tipo === 'select' && (
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground">Opções (separadas por |)</label>
                        <input value={filtroForm.opcoes_fixas || ''} onChange={e => setFF('opcoes_fixas', e.target.value)} placeholder="Ativo|Inativo|Todos" className={inp} />
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-muted-foreground">Valor padrão</label>
                      <input value={filtroForm.valor_padrao || ''} onChange={e => setFF('valor_padrao', e.target.value)} className={inp} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Ordem</label>
                      <input type="number" value={filtroForm.ordem || 0} onChange={e => setFF('ordem', parseInt(e.target.value) || 0)} className={inp} />
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input type="checkbox" checked={!!filtroForm.obrigatorio} onChange={e => setFF('obrigatorio', e.target.checked)} />
                      <label className="text-xs">Obrigatório</label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveFiltro} className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground">Salvar Filtro</button>
                    <button onClick={() => { setFiltroMode('view'); setFiltroIdx(null); }} className="px-3 py-1 text-xs rounded border border-border">Cancelar</button>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Nome</th>
                      <th className="px-3 py-2 text-left font-semibold">Rótulo</th>
                      <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-3 py-2 text-center font-semibold w-16">Obrig.</th>
                      <th className="w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtros.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Nenhum filtro cadastrado.</td></tr>
                    )}
                    {filtros.map((f, i) => (
                      <tr key={f.rpb_filtro_id} className="border-t border-border hover:bg-accent/20">
                        <td className="px-3 py-1.5 font-mono text-primary">{`{{${f.nome}}}`}</td>
                        <td className="px-3 py-1.5">{f.label}</td>
                        <td className="px-3 py-1.5">{FILTRO_TIPOS.find(t => t.v === f.tipo)?.l || f.tipo}</td>
                        <td className="px-3 py-1.5 text-center">{f.obrigatorio ? '✓' : '—'}</td>
                        <td className="px-2 py-1 flex gap-1">
                          <button onClick={() => { setFiltroMode('edit'); setFiltroIdx(i); setFiltroForm({ ...f }); }}
                            className="p-1 hover:bg-secondary rounded"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeleteFiltro(f.rpb_filtro_id)}
                            className="p-1 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="w-3 h-3" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Designer */}
      {view === 'designer' && selected && (
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Carregando designer...</div>}>
            <RpbDesigner
              relatorio={selected}
              queryColumns={queryColumns}
              onSave={handleSaveLayout}
              onPreview={() => setView('execute')}
            />
          </Suspense>
        </div>
      )}

      {/* Executor */}
      {view === 'execute' && selected && (
        <div className="flex-1 overflow-hidden">
          <RpbExecutor relatorio={selected} conexoes={conexoes} />
        </div>
      )}
    </div>
  );
};

export default RpbManager;
