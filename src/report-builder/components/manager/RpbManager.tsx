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
import { Plus, Trash2, Pencil, Play, PenTool, HelpCircle, FileUp, Download, Upload, Save, X } from 'lucide-react'; 
import { useRef } from 'react';
import { MENU_CONFIG, getLeafItems } from '@/config/menuConfig';

const RpbDesigner = lazy(() => import('../designer/RpbDesigner'));

// ── Remove prefixos de schema do SQL (dbo., public., banco.dbo., etc.) ──
const cleanSqlPrefixes = (sql: string): string =>
  sql
    .replace(/\b\w+\.\w+\.(\w+)\b/g, '$1')           // banco.dbo.tabela → tabela
    .replace(/\b(?:dbo|public|\w+schema)\.(\w+)\b/gi, '$1'); // dbo.tabela → tabela

// ── Colunas da grid ──────────────────────────────────────────
const GRID_COLS: IGridColumn[] = [
  { key: 'rpb_relatorio_id', label: 'Cód.',      width: '60px',  align: 'right' },
  { key: 'categoria',        label: 'Categoria', width: '130px' },
  { key: 'nome',             label: 'Nome',      width: '1.5fr' },
  { 
    key: 'nm_form',          
    label: 'Vínculo Form', 
    width: '130px',
    render: (row) => getLeafItems(MENU_CONFIG).find(x => x.id === row.nm_form)?.title || row.nm_form || '-'
  },
  { key: 'descricao',        label: 'Descrição', width: '2fr' },
];

type TView = 'list' | 'dados' | 'query' | 'filtros' | 'designer' | 'execute';

const FILTRO_TIPOS = [
  { v: 'text',         l: 'Texto' },
  { v: 'date',         l: 'Data' },
  { v: 'date_range',   l: 'Período (de/até)' },
  { v: 'number',       l: 'Número' },
  { v: 'select',       l: 'Lista Fixa' },
  { v: 'boolean',      l: 'Sim/Não' },
];

const emptyForm = (): Partial<IRpbRelatorio> => ({
  nome: '', descricao: '', categoria: '', nm_form: '', query_sql: '', rpb_conexao_id: null,
});

const emptyFiltro = (): Partial<IRpbFiltro> => ({
  nome: '', label: '', tipo: 'text', obrigatorio: false,
  valor_padrao: '', opcoes_fixas: '', query_opcoes: '', ordem: 0,
});

interface IProps {
  initialView?: TView;
  initialSelectedId?: number;
}

const RpbManager: React.FC<IProps> = ({ initialView, initialSelectedId }) => {
  const { XEmpresaId, closeTab, XTabs, XActiveTabId, openTab } = useAppContext();

  const [view, setView]               = useState<TView>(initialView || 'list');
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
  const [mode, setMode]               = useState<'view'|'edit'|'insert'>(initialView ? 'view' : 'view');
  const [showHelp, setShowHelp]       = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const jasperInputRef = useRef<HTMLInputElement>(null);
  const rpbInputRef    = useRef<HTMLInputElement>(null);

  // ── Importar Jasper (.jrxml) ─────────────────────────────
  const handleJasperImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target?.result as string;
        const doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) throw new Error('Arquivo XML inválido.');

        // 1. Extrai SQL
        const rawSql = doc.querySelector('queryString')?.textContent?.trim() || '';
        if (!rawSql) { toast.warning('Nenhuma queryString encontrada no arquivo.'); return; }
        const cleanedSql = cleanSqlPrefixes(rawSql);

        // 2. Extrai campos
        const fields = [...doc.querySelectorAll('field')].map(f => f.getAttribute('name')).filter(Boolean);

        if (view === 'form' && isEditing) {
          setF('query_sql', cleanedSql);
          toast.success(`Query atualizada! ${fields.length} campos detectados.`);
        } else {
          // Criar novo relatório a partir da lista
          const nomeSugerido = file.name.replace(/\.[^/.]+$/, "") + " (Jasper)";
          const { data: novo, error } = await rpbInsertRelatorio({
            empresa_id: XEmpresaId,
            nome: nomeSugerido,
            descricao: 'Importado de arquivo Jasper Reports',
            categoria: 'Importados',
            query_sql: cleanedSql,
            nm_form: '',
            rpb_conexao_id: null,
            layout_json: null
          });
          if (error) throw error;
          await load();
          toast.success(`Novo relatório "${nomeSugerido}" criado com sucesso!`);
        }
      } catch (err: any) {
        toast.error('Erro ao importar: ' + err.message);
      } finally {
        if (jasperInputRef.current) jasperInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ── Exportar .rpb ─────────────────────────────────────────
  const handleExportRpb = async (rel: IRpbRelatorio) => {
    const filtrosExp = await rpbListFiltros(rel.rpb_relatorio_id);
    const payload = {
      __rpb_version: '1.0',
      nome: rel.nome,
      descricao: rel.descricao,
      categoria: rel.categoria,
      nm_form: rel.nm_form || '',
      query_sql: rel.query_sql,
      layout_json: rel.layout_json,
      filtros: filtrosExp.map(({ rpb_filtro_id, rpb_relatorio_id, empresa_id, excluido, ...f }) => f),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${rel.nome.replace(/[^\w]/g, '_')}.rpb`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Relatório exportado: ${a.download}`);
  };

  // ── Importar .rpb ─────────────────────────────────────────
  const handleRpbImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        if (!payload.__rpb_version) throw new Error('Arquivo .rpb inválido ou corrompido.');

        // Cria o relatório
        const { data: novo, error } = await rpbInsertRelatorio({
          empresa_id:  XEmpresaId,
          nome:        payload.nome + ' (importado)',
          descricao:   payload.descricao || '',
          categoria:   payload.categoria || '',
          nm_form:     payload.nm_form || '',
          query_sql:   payload.query_sql || '',
          layout_json: payload.layout_json || null,
          rpb_conexao_id: null,
        });
        if (error || !novo) throw new Error(error?.message || 'Falha ao criar relatório.');

        // Recria os filtros
        if (Array.isArray(payload.filtros) && payload.filtros.length > 0) {
          for (const f of payload.filtros) {
            await rpbInsertFiltro({ ...f, rpb_relatorio_id: novo.rpb_relatorio_id, empresa_id: XEmpresaId });
          }
        }

        await load();
        toast.success(`"${payload.nome}" importado com sucesso! ${payload.filtros?.length || 0} filtro(s) restaurado(s).`);
      } catch (err: any) {
        toast.error('Erro ao importar .rpb: ' + err.message);
      } finally {
        if (rpbInputRef.current) rpbInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

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

  // Inicialização por props
  useEffect(() => {
    if (!isInitialized && initialSelectedId && relatorios.length > 0) {
      const found = relatorios.find(r => r.rpb_relatorio_id === initialSelectedId);
      if (found) {
        setSelected(found);
        setView(initialView || 'dados');
        // Se abriu direto no designer ou consulta, carregar filtros também
        if (initialView === 'designer' || initialView === 'execute') {
          rpbListFiltros(found.rpb_relatorio_id).then(setFiltros);
        }
        setIsInitialized(true);
      }
    }
  }, [initialSelectedId, initialView, relatorios, isInitialized, initialView]);

  const loadFiltros = useCallback(async (id: number) => {
    const f = await rpbListFiltros(id);
    setFiltros(f);
  }, []);

  useEffect(() => {
    if (selected && !isInitialized) loadFiltros(selected.rpb_relatorio_id);
  }, [selected, loadFiltros, isInitialized]);

  const handleNew = () => {
    setForm(emptyForm());
    setSelected(null);
    setFiltros([]);
    setQueryColumns([]);
    setMode('insert');
    setView('dados');
  };

  const handleEdit = (rel: IRpbRelatorio) => {
    setSelected(rel);
    setForm({
      nome: rel.nome, descricao: rel.descricao,
      categoria: rel.categoria, nm_form: rel.nm_form || '',
      query_sql: rel.query_sql, rpb_conexao_id: rel.rpb_conexao_id,
    });
    setMode('edit');
    setView('dados');
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
      <input ref={jasperInputRef} type="file" accept=".jrxml,.xml" className="hidden" onChange={handleJasperImport} />
      <input ref={rpbInputRef} type="file" accept=".rpb,.json" className="hidden" onChange={handleRpbImport} />


      {/* ── Tabs de Navegação Principal ───────────────────── */}
      <div className="flex items-center border-b border-border bg-card shrink-0 px-2 overflow-x-auto">
        <button
          onClick={() => setView('list')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'list' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Pesquisa
        </button>
        <button
          onClick={() => setView('dados')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'dados' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Dados
        </button>
        <button
          onClick={() => setView('query')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'query' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          SQL Query
        </button>
        <button
          onClick={() => setView('filtros')}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'filtros' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Filtros
        </button>
        <button
          onClick={() => selected && setView('designer')}
          disabled={!selected}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'designer' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          } ${!selected ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          Designer
        </button>
        <button
          onClick={() => selected && setView('execute')}
          disabled={!selected}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-all whitespace-nowrap ${
            view === 'execute' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          } ${!selected ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          Consulta
        </button>
      </div>

      {/* ── Toolbar de Ações (Visível em todas as abas exceto Pesquisa) ── */}
      {view !== 'list' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
          {isEditing ? (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-95 shrink-0">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => { setMode('view'); if (!selected) setView('list'); }}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded border border-border bg-card hover:bg-secondary transition-all active:scale-95 shrink-0">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => selected && handleEdit(selected)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded border border-border bg-card hover:bg-secondary shadow-sm transition-all active:scale-95 shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            </>
          )}

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          {/* Botões Específicos sugeridos pelo USER */}
          <button
            onClick={() => setView('execute')}
            disabled={!selected}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all active:scale-95 shrink-0 ${
              view === 'execute' ? 'bg-emerald-600 text-white' : 'border border-emerald-500 text-emerald-600 hover:bg-emerald-50'
            } ${!selected ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Play className="w-3.5 h-3.5" /> Executar
          </button>

          <button
            onClick={() => setView('designer')}
            disabled={!selected}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-all active:scale-95 shrink-0 ${
              view === 'designer' ? 'bg-indigo-600 text-white' : 'border border-indigo-500 text-indigo-600 hover:bg-indigo-50'
            } ${!selected ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <PenTool className="w-3.5 h-3.5" /> Designer
          </button>

          {view === 'designer' && selected && (
            <button
              onClick={() => openTab({ 
                component: 'rpb-designer', 
                title: 'Design: ' + selected.nome, 
                params: { relatorioId: selected.rpb_relatorio_id } 
              })}
              title="Abrir este designer em uma nova aba do sistema"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-indigo-300 text-indigo-500 hover:bg-indigo-50 transition-all active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Abrir em Nova Aba
            </button>
          )}

          <div className="w-px h-6 bg-border mx-1 shrink-0" />

          <button
            onClick={() => selected && handleExportRpb(selected)}
            disabled={!selected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-amber-500 text-amber-600 hover:bg-amber-50 transition-all active:scale-95 shrink-0 disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" /> Exportar RPB
          </button>

          <button
            onClick={() => rpbInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-emerald-500 text-emerald-600 hover:bg-emerald-50 transition-all active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5" /> Importar RPB
          </button>

          <button
            onClick={() => jasperInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-indigo-500 text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95 shrink-0"
          >
            <FileUp className="w-3.5 h-3.5" /> Importar Jasper
          </button>

          <button onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-slate-400 text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shrink-0">
            <HelpCircle className="w-3.5 h-3.5" /> Ajuda / Dicas
          </button>

          <div className="flex-1" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded hidden sm:inline">
            {mode === 'insert' ? 'Novo' : mode === 'edit' ? 'Edição' : 'Visualização'}
          </span>
        </div>
      )}

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
                    {/* Exportar / Importar .rpb */}
                    <div className="w-px h-5 bg-border mx-1" />
                    <button
                      onClick={() => selected && handleExportRpb(selected)}
                      disabled={!selected}
                      title="Exportar relatório como arquivo .rpb"
                      className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        selected
                          ? 'border-amber-500 text-amber-600 hover:bg-amber-50 hover:scale-105 active:scale-95'
                          : 'border-border text-muted-foreground opacity-30 cursor-not-allowed'
                      }`}
                    >
                      <Download size={13} /> Exportar .rpb
                    </button>
                    <button
                      onClick={() => rpbInputRef.current?.click()}
                      title="Importar relatório de um arquivo .rpb"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Upload size={13} /> Importar .rpb
                    </button>
                  </>
                }
              />
            }
          />
        </div>
      )}

      {/* ── Conteúdo das Abas ────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'dados' && (
          <div className="flex-1 overflow-auto p-4">
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
              <label className="text-xs text-muted-foreground font-semibold">Vínculo com Formulário (Tela)</label>
              {isEditing ? (
                <select 
                  value={form.nm_form || ''} 
                  onChange={e => setF('nm_form', e.target.value)}
                  className={inp}
                >
                  <option value="">Nenhum (Relatório avulso)</option>
                  {getLeafItems(MENU_CONFIG).sort((a,b) => a.title.localeCompare(b.title)).map(item => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              ) : (
                <input 
                  value={getLeafItems(MENU_CONFIG).find(x => x.id === selected?.nm_form)?.title || selected?.nm_form || ''} 
                  readOnly 
                  className={inp + ' bg-secondary'} 
                />
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">Define em qual tela este relatório aparecerá como opção de impressão.</p>
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
          </div>
        )}

        {view === 'query' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-3 h-full flex flex-col">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-semibold">Query SQL</label>
              <p className="text-xs text-muted-foreground">— Use &#123;&#123;variavel&#125;&#125; para filtros</p>
              <div className="flex-1" />
              <button onClick={handleTestQuery}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-95">
                <Play className="w-3.5 h-3.5" /> Testar Query
              </button>
            </div>
            {isEditing ? (
              <textarea value={form.query_sql || ''} onChange={e => setF('query_sql', e.target.value)}
                rows={15} className={inp + ' font-mono text-xs resize-none flex-1'} />
            ) : (
              <pre className="border border-border rounded p-3 text-xs font-mono bg-secondary whitespace-pre-wrap min-h-[200px] flex-1">
                {selected?.query_sql || ''}
              </pre>
            )}
            {queryColumns.length > 0 && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                Colunas detectadas: <strong>{queryColumns.join(', ')}</strong>
              </div>
            )}
          </div>
          </div>
        )}

        {view === 'filtros' && (
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold uppercase tracking-tight">Filtros do Relatório</h4>
              <button
                onClick={() => { setFiltroMode('insert'); setFiltroForm(emptyFiltro()); setFiltroIdx(null); }}
                disabled={mode === 'insert'}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded ${
                  mode === 'insert'
                    ? 'bg-secondary text-muted-foreground opacity-50 cursor-not-allowed border border-border'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> Novo Filtro
              </button>
            </div>

            {mode === 'insert' && <p className="text-[10px] text-amber-600 mt-1 italic font-bold">Salve o relatório primeiro para poder adicionar filtros.</p>}

            {(filtroMode === 'insert' || filtroMode === 'edit') && (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-secondary/20 shadow-inner">
                <p className="text-xs font-bold uppercase text-primary">{filtroMode === 'insert' ? 'Novo Filtro' : 'Editar Filtro'}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Nome interno (&#123;&#123;variavel&#125;&#125;) *</label>
                    <input value={filtroForm.nome || ''} onChange={e => setFF('nome', e.target.value)} placeholder="dt_inicial" className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Rótulo *</label>
                    <input value={filtroForm.label || ''} onChange={e => setFF('label', e.target.value)} placeholder="Data Inicial" className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Tipo</label>
                    <select value={filtroForm.tipo || 'text'} onChange={e => setFF('tipo', e.target.value)} className={sel}>
                      {FILTRO_TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </div>
                  {filtroForm.tipo === 'select' && (
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground font-bold uppercase">Opções (separadas por |)</label>
                      <input value={filtroForm.opcoes_fixas || ''} onChange={e => setFF('opcoes_fixas', e.target.value)} placeholder="Ativo|Inativo|Todos" className={inp} />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Valor padrão</label>
                    <input value={filtroForm.valor_padrao || ''} onChange={e => setFF('valor_padrao', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-bold uppercase">Ordem</label>
                    <input type="number" value={filtroForm.ordem || 0} onChange={e => setFF('ordem', parseInt(e.target.value) || 0)} className={inp} />
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input type="checkbox" checked={!!filtroForm.obrigatorio} onChange={e => setFF('obrigatorio', e.target.checked)} className="w-4 h-4 text-primary" />
                    <label className="text-xs font-bold uppercase">Obrigatório</label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveFiltro} className="px-4 py-1.5 text-xs font-bold uppercase rounded bg-primary text-primary-foreground shadow-sm">Salvar Filtro</button>
                  <button onClick={() => { setFiltroMode('view'); setFiltroIdx(null); }} className="px-4 py-1.5 text-xs font-bold uppercase rounded border border-border bg-card">Cancelar</button>
                </div>
              </div>
            )}

            <div className="border border-border rounded-lg overflow-hidden shadow-sm bg-card">
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-2 text-left">Nome</th>
                    <th className="px-4 py-2 text-left">Rótulo</th>
                    <th className="px-4 py-2 text-left">Tipo</th>
                    <th className="px-4 py-2 text-center w-16">Obrig.</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtros.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground italic">Nenhum filtro cadastrado.</td></tr>
                  )}
                  {filtros.map((f, i) => (
                    <tr key={f.rpb_filtro_id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2 font-mono text-primary font-bold">{`{{${f.nome}}}`}</td>
                      <td className="px-4 py-2 font-medium">{f.label}</td>
                      <td className="px-4 py-2 text-muted-foreground uppercase text-[10px]">{FILTRO_TIPOS.find(t => t.v === f.tipo)?.l || f.tipo}</td>
                      <td className="px-4 py-2 text-center font-bold text-primary">{f.obrigatorio ? '✓' : '—'}</td>
                      <td className="px-3 py-2 flex gap-1 justify-end">
                        <button onClick={() => { setFiltroMode('edit'); setFiltroIdx(i); setFiltroForm({ ...f }); }}
                          className="p-1.5 hover:bg-secondary rounded border border-transparent hover:border-border transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteFiltro(f.rpb_filtro_id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded border border-transparent hover:border-destructive/20 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        )}

        {view === 'designer' && selected && (
          <div className="flex-1 overflow-hidden bg-card">
            <Suspense fallback={
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 animate-pulse">
                <PenTool className="w-8 h-8 opacity-20" />
                <span className="font-bold uppercase tracking-widest text-[10px]">Carregando editor visual...</span>
              </div>
            }>
              <RpbDesigner
                relatorio={selected}
                queryColumns={queryColumns}
                onSave={handleSaveLayout}
                onPreview={() => setView('execute')}
              />
            </Suspense>
          </div>
        )}

        {view === 'execute' && selected && (
          <div className="flex-1 overflow-hidden bg-card">
            <RpbExecutor relatorio={selected} conexoes={conexoes} />
          </div>
        )}
      </div>


      {/* ── Modal de Ajuda ────────────────────────────────── */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/20">
              <div className="flex items-center gap-2">
                <HelpCircle className="text-primary w-5 h-5" />
                <h3 className="font-bold text-sm">Como utilizar o Report Builder Pro</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-1 hover:bg-foreground/10 rounded">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 text-sm space-y-4">
              <section>
                <h4 className="font-bold text-primary mb-1 uppercase text-xs">1. Organização em Menus</h4>
                <p className="text-muted-foreground">Os relatórios criados aqui aparecem automaticamente no menu <strong>6. Relatórios</strong>, dentro da pasta <strong>RBuilder</strong>. Eles são agrupados de acordo com a <strong>Categoria</strong> que você preencher no cadastro.</p>
              </section>

              <section>
                <h4 className="font-bold text-primary mb-1 uppercase text-xs">2. Vínculo com Telas (Botão Imprimir)</h4>
                <p className="text-muted-foreground">Para que um relatório apareça como opção de impressão dentro de uma tela (ex: Pedidos), preencha o campo <strong>Vínculo com Formulário (nm_form)</strong> com o nome técnico da tela (ex: <code>PedidoForm</code>).</p>
                <p className="text-xs text-slate-500 mt-1 italic">* Os relatórios aparecerão no botão "Imprimir" localizado na barra de ferramentas do formulário.</p>
              </section>

              <section>
                <h4 className="font-bold text-primary mb-1 uppercase text-xs">3. Parâmetros Automáticos</h4>
                <p className="text-muted-foreground">Se o relatório estiver vinculado a uma tela, você pode capturar os dados do registro atual usando a sintaxe <code>&#123;&#123;nome_do_campo&#125;&#125;</code> na sua Query SQL.</p>
                <div className="bg-secondary/40 p-2 rounded font-mono text-[11px] border border-border mt-1">
                  SELECT * FROM movimento WHERE movimento_id = &#123;&#123;movimento_id&#125;&#125;
                </div>
              </section>

              <section>
                <h4 className="font-bold text-primary mb-1 uppercase text-xs">4. Filtros Customizados</h4>
                <p className="text-muted-foreground">Na aba <strong>Filtros</strong>, você pode criar campos para que o usuário preencha antes de gerar o relatório. O nome interno do filtro deve ser o mesmo usado na query: <code>&#123;&#123;meu_filtro&#125;&#125;</code>.</p>
              </section>

              <section>
                <h4 className="font-bold text-primary mb-1 uppercase text-xs">5. Designer e Layout</h4>
                <p className="text-muted-foreground">Use o <strong>Designer</strong> para criar o visual do relatório. Você pode arrastar campos da query para as bandas (Cabeçalho, Detalhe, Rodapé). O sistema suporta até 2 níveis de agrupamento com totalizadores automáticos.</p>
              </section>

              <section>
                <h4 className="font-bold text-indigo-600 mb-1 uppercase text-xs">6. Importar do Jasper Reports (.jrxml)</h4>
                <p className="text-muted-foreground mb-2">
                  Na aba <strong>Query SQL</strong>, em modo de edição, clique em <strong>"Importar Jasper"</strong> e selecione um arquivo <code>.jrxml</code> exportado do iReport / Jasper Studio.
                  O sistema irá automaticamente:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Extrair a query SQL do elemento <code>&lt;queryString&gt;</code></li>
                  <li>Remover prefixos de banco/schema da SQL (<code>dbo.tabela</code>, <code>public.tabela</code>, <code>banco.dbo.tabela</code> → <code>tabela</code>)</li>
                  <li>Listar os campos (<code>&lt;field&gt;</code>) detectados no arquivo</li>
                </ul>
                <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-2">
                  ⚠️ O <strong>posicionamento dos campos</strong> não é importado automaticamente, pois o Jasper usa coordenadas absolutas. Após importar a query, use o <strong>Designer</strong> para montar o layout.
                </p>
              </section>

              <section>
                <h4 className="font-bold text-amber-600 mb-1 uppercase text-xs">7. Exportar / Importar formato nativo (.rpb)</h4>
                <p className="text-muted-foreground mb-2">
                  Use os botões <strong>"Exportar .rpb"</strong> e <strong>"Importar .rpb"</strong> na barra de ferramentas da lista de relatórios para fazer backup ou migrar relatórios entre ambientes.
                </p>
                <p className="text-xs text-muted-foreground mb-1">O arquivo <code>.rpb</code> é um JSON que contém <strong>tudo</strong>:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside ml-2">
                  <li>Nome, descrição, categoria e vínculo com formulário</li>
                  <li>Query SQL completa</li>
                  <li>Layout visual (bandas, componentes, estilos, agrupamentos)</li>
                  <li>Todos os filtros configurados (tipo, rótulo, valor padrão)</li>
                </ul>
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded p-2 mt-2">
                  ✓ Ao importar, o relatório é criado com o sufixo <strong>"(importado)"</strong> no nome para evitar conflitos. Renomeie após a importação se necessário.
                </p>
              </section>
            </div>
            <div className="p-4 border-t border-border bg-secondary/10 flex justify-end">
              <button onClick={() => setShowHelp(false)} className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-bold">Entendi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RpbManager;
