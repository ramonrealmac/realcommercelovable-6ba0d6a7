// ============================================================
// Report Builder Pro — Modal de Configuração do Sub-Relatório
// SQL editor + links pai→filho + detecção/edição de colunas
// ============================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RpbSubreportComp, RpbSubreportLink, RpbTableColumn } from '../../types';
import { DEFAULT_STYLE } from '../../types';
import { rpbExecuteQuery } from '../../services/rpbService';
import {
  X, Plus, Trash2, RefreshCw, Loader2, LayoutList,
  Link2, Table2, Settings2, PanelTop,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  GripVertical, Move,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  comp:          RpbSubreportComp;
  parentColumns: string[];           // colunas do dataset principal
  onChange:      (updated: RpbSubreportComp) => void;
  onClose:       () => void;
}

type Tab = 'geral' | 'formatacao' | 'sql' | 'links';

// ── Constantes do Canvas ──────────────────────────────────
// Área de trabalho: largura da faixa em mm = largura A4 menos margens ≈ 190mm
const CANVAS_W_MM = 190;
const CANVAS_SCALE = 3.2; // px por mm
const canvasPx = (mm: number) => Math.round(mm * CANVAS_SCALE);
const pxToMm = (px: number) => Math.round((px / CANVAS_SCALE) * 10) / 10;

const RpbSubreportConfig: React.FC<Props> = ({ comp, parentColumns, onChange, onClose }) => {
  const [draft, setDraft]       = useState<RpbSubreportComp>({ ...comp, links: [...comp.links], columns: [...comp.columns] });
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [detecting, setDetecting] = useState(false);

  // ── Drag & Drop — Layout Customizado ──────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    active: boolean;
    compId: string;
    startMouseX: number;
    startMouseY: number;
    startCompX: number;
    startCompY: number;
    mode: 'move' | 'resize-br';
  } | null>(null);

  // ── Drag & Drop — Reordenação de Colunas ──────────────────
  const colDragRef = useRef<{ fromIndex: number } | null>(null);
  const [colDragOver, setColDragOver] = useState<number | null>(null);

  const patch = (p: Partial<RpbSubreportComp>) => setDraft(prev => ({ ...prev, ...p }));

  const patchComp = useCallback((id: string, changes: Record<string, any>) => {
    setDraft(prev => ({
      ...prev,
      customComponents: prev.customComponents?.map(c => c.id === id ? { ...c, ...changes } : c)
    }));
  }, []);

  // Mouse handlers para drag no canvas
  const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d || !d.active) return;
    const dx = pxToMm(e.clientX - d.startMouseX);
    const dy = pxToMm(e.clientY - d.startMouseY);
    if (d.mode === 'move') {
      const newX = Math.max(0, Math.round((d.startCompX + dx) * 10) / 10);
      const newY = Math.max(0, Math.round((d.startCompY + dy) * 10) / 10);
      patchComp(d.compId, { x: newX, y: newY });
    } else {
      // resize: atualiza w e h
      setDraft(prev => ({
        ...prev,
        customComponents: prev.customComponents?.map(c => {
          if (c.id !== d.compId) return c;
          const newW = Math.max(5, Math.round((d.startCompX + dx) * 10) / 10);
          const newH = Math.max(2, Math.round((d.startCompY + dy) * 10) / 10);
          return { ...c, w: newW, h: newH };
        })
      }));
    }
  }, [patchComp]);

  const handleCanvasMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [handleCanvasMouseMove, handleCanvasMouseUp]);

  // Teclado: mover elemento selecionado com setas
  useEffect(() => {
    if (activeTab !== 'formatacao' || draft.tipoLayout !== 'custom') return;
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 1;
      const delta: Record<string, [string, number]> = {
        ArrowUp:    ['y', -step],
        ArrowDown:  ['y',  step],
        ArrowLeft:  ['x', -step],
        ArrowRight: ['x',  step],
      };
      const [axis, val] = delta[e.key];
      setDraft(prev => ({
        ...prev,
        customComponents: prev.customComponents?.map(c => {
          if (c.id !== selectedId) return c;
          const cur = (c as any)[axis] as number;
          return { ...c, [axis]: Math.max(0, Math.round((cur + val) * 10) / 10) };
        })
      }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, activeTab, draft.tipoLayout]);

  const moveComponent = useCallback((index: number, direction: 'back' | 'backward' | 'forward' | 'front') => {
    if (!draft.customComponents) return;
    const comps = [...draft.customComponents];
    const compToMove = comps[index];
    comps.splice(index, 1);
    let newIndex = index;
    if (direction === 'back') newIndex = 0;
    else if (direction === 'backward') newIndex = Math.max(0, index - 1);
    else if (direction === 'forward') newIndex = Math.min(comps.length, index + 1);
    else if (direction === 'front') newIndex = comps.length;
    comps.splice(newIndex, 0, compToMove);
    patch({ customComponents: comps });
  }, [draft.customComponents]);

  // ── Detectar colunas do SQL filho ────────────────────────────
  const handleDetectCols = useCallback(async () => {
    if (!draft.query_sql.trim()) { toast.warning('Digite o SQL antes de detectar as colunas.'); return; }
    setDetecting(true);
    // Substitui variáveis por NULL/1 para rodar sem parâmetros reais
    const safeSql = draft.query_sql.replace(/\{{1,2}([\s\S]+?)\}{1,2}/g, (_, name) => {
      const n = name.trim().toLowerCase();
      return (n.includes('id') || n.includes('codigo') || n.includes('num')) ? '1' : 'NULL';
    });
    const testSql = `SELECT __rpb_sub__.* FROM (${safeSql}) __rpb_sub__ RIGHT JOIN (SELECT 1 AS __dummy) __d ON true LIMIT 1`;
    const { data, error } = await rpbExecuteQuery(testSql, {});
    setDetecting(false);
    if (error) { toast.error('Erro ao detectar colunas: ' + error); return; }
    if (!data.length) { toast.warning('A query não retornou dados com valores padrão. Revise o SQL.'); return; }
    const cols: RpbTableColumn[] = Object.keys(data[0]).map(k => ({
      field: k, label: k, w: 40, align: 'left', format: 'text', totalType: 'none',
    }));
    patch({ columns: cols });
    toast.success(`${cols.length} coluna(s) detectada(s).`);
    setActiveTab('formatacao');
  }, [draft.query_sql]);

  // ── Links ──────────────────────────────────────────────────
  const addLink = () => patch({ links: [...draft.links, { parentField: parentColumns[0] || '', childParam: '' }] });
  const removeLink = (i: number) => patch({ links: draft.links.filter((_, idx) => idx !== i) });
  const updateLink = (i: number, p: Partial<RpbSubreportLink>) =>
    patch({ links: draft.links.map((l, idx) => idx === i ? { ...l, ...p } : l) });

  // ── Colunas ────────────────────────────────────────────────
  const removeCol = (i: number) => patch({ columns: draft.columns.filter((_, idx) => idx !== i) });
  const reorderCol = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const cols = [...draft.columns];
    const [moved] = cols.splice(fromIdx, 1);
    cols.splice(toIdx, 0, moved);
    patch({ columns: cols });
  }, [draft.columns]);
  const updateCol = (i: number, p: Partial<RpbTableColumn>) =>
    patch({ columns: draft.columns.map((c, idx) => idx === i ? { ...c, ...p } : c) });

  // ── Salvar ─────────────────────────────────────────────────
  const handleSave = () => { onChange(draft); onClose(); };

  const input = 'w-full border border-border rounded px-2 py-1 text-xs bg-card focus:ring-1 focus:ring-ring outline-none';
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'geral',      label: 'Geral',      icon: <Settings2 size={13} />   },
    { key: 'formatacao', label: 'Formatação', icon: <PanelTop size={13} />    },
    { key: 'sql',        label: 'SQL',        icon: <LayoutList size={13} />  },
    { key: 'links',      label: 'Vínculos',   icon: <Link2 size={13} />       },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        style={{ width: '760px', maxWidth: '95vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Configurar Sub-Relatório</h2>
            <span className="text-xs text-muted-foreground bg-secondary rounded px-2 py-0.5">{draft.label || 'sem nome'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 flex-shrink-0 border-b border-border">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t-lg border border-b-0 transition-all -mb-px ${
                activeTab === t.key
                  ? 'bg-card border-border text-foreground font-semibold'
                  : 'bg-muted/30 border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon} {t.label}
              {t.key === 'links' && draft.links.length > 0 &&
                <span className="ml-1 bg-primary/10 text-primary rounded-full px-1.5 py-0 text-[10px] font-bold">{draft.links.length}</span>
              }
              {t.key === 'formatacao' && (
                draft.tipoLayout === 'custom'
                  ? (draft.customComponents?.length || 0) > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0 text-[10px] font-bold">{draft.customComponents?.length}</span>
                  : draft.columns.length > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0 text-[10px] font-bold">{draft.columns.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">

          {/* ── Aba Geral ─────────────────────────────────────── */}
          {activeTab === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Rótulo interno (no designer)</label>
                  <input className={input} value={draft.label} onChange={e => patch({ label: e.target.value })} placeholder="Ex: Pagamentos do Pedido" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Título exibido no relatório</label>
                  <input className={input} value={draft.titleText} onChange={e => patch({ titleText: e.target.value })} placeholder="Ex: Formas de Pagamento" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Mensagem quando sem dados</label>
                <input className={input} value={draft.emptyMessage} onChange={e => patch({ emptyMessage: e.target.value })} placeholder="Ex: Nenhum pagamento" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={draft.showTitleBar} onChange={e => patch({ showTitleBar: e.target.checked })} />
                  Exibir barra de título
                </label>
                {draft.tipoLayout !== 'custom' && (
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={draft.showHeader} onChange={e => patch({ showHeader: e.target.checked })} />
                    Exibir cabeçalho das colunas
                  </label>
                )}
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Layout</label>
                  <select
                    className={input}
                    value={draft.tipoLayout || 'tabela'}
                    onChange={e => patch({ tipoLayout: e.target.value as any })}
                  >
                    <option value="tabela">Tabela (Grade de Colunas)</option>
                    <option value="custom">Customizado (Elementos Livres)</option>
                  </select>
                </div>
                {draft.tipoLayout === 'custom' && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Altura da Linha/Registro (mm)</label>
                    <input
                      type="number"
                      className={input}
                      value={draft.rowHeight ?? 15}
                      onChange={e => patch({ rowHeight: parseFloat(e.target.value) || 15 })}
                      placeholder="15"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  🔒 Filtro Automático de Empresa
                </label>
                <select
                  className={input}
                  value={draft.filtroEmpresaMode || 'herdar'}
                  onChange={e => patch({ filtroEmpresaMode: e.target.value as any })}
                >
                  <option value="herdar">Herdar do Relatório Principal (Padrão)</option>
                  <option value="nenhum">Nenhum (Sem filtro automático / Manual via SQL)</option>
                  <option value="empresa">Empresa Logada / Atual (empresa_id = &#123;sys_empresa_id&#125;)</option>
                  <option value="matriz">Matriz da Empresa Logada (empresa_id = &#123;sys_matriz_id&#125;)</option>
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Por padrão, o sub-relatório herda a mesma opção de filtro de empresa configurada no relatório pai.
                </p>
              </div>

              {/* Resumo de status */}
              <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-4 space-y-2 text-xs">
                <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Status da configuração</p>
                <div className="flex items-center gap-2">
                  {draft.query_sql.trim() ? (
                    <span className="text-emerald-600 font-medium">✓ SQL configurado ({draft.query_sql.length} chars)</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠ SQL não configurado — vá para a aba SQL</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {draft.links.length > 0 ? (
                    <span className="text-emerald-600 font-medium">✓ {draft.links.length} vínculo(s) pai→filho</span>
                  ) : (
                    <span className="text-muted-foreground">— Sem vínculos (sub-relatório independente)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {draft.tipoLayout === 'custom' ? (
                    <span className="text-emerald-600 font-medium">✓ Layout customizado com {draft.customComponents?.length || 0} elemento(s)</span>
                  ) : draft.columns.length > 0 ? (
                    <span className="text-emerald-600 font-medium">✓ {draft.columns.length} coluna(s) configurada(s)</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠ Sem colunas — detecte na aba SQL</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Aba Formatação (Cabeçalho & Corpo) ───────────── */}
          {activeTab === 'formatacao' && (
            <div className="space-y-6">
              {/* ── Seção 1: Cabeçalho do Sub-Relatório ────────── */}
              <div className="border border-border rounded-xl p-4 bg-secondary/10 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <PanelTop className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Formatação do Cabeçalho
                    </h3>
                  </div>
                </div>

<div className="space-y-5">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                <div>
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.showTitleBar}
                      onChange={e => patch({ showTitleBar: e.target.checked })}
                      className="w-4 h-4 text-primary rounded"
                    />
                    Exibir Seção de Cabeçalho no Sub-Relatório
                  </label>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">
                    Habilita o bloco de título, subtítulo e estilos acima dos dados do sub-relatório
                  </p>
                </div>
                {draft.showTitleBar && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    Ativado
                  </span>
                )}
              </div>

              {draft.showTitleBar && (
                <>
                  {/* Textos do Cabeçalho */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Título do Cabeçalho
                      </label>
                      <input
                        className={input}
                        value={draft.titleText || ''}
                        onChange={e => patch({ titleText: e.target.value })}
                        placeholder="Ex: FORMALIZAÇÃO DO PEDIDO Nº {pedido_id}"
                      />
                      <p className="text-[9px] text-muted-foreground mt-1">
                        Suporta variáveis: <code className="text-primary font-mono">&#123;campo&#125;</code> (da linha pai) ou do sistema
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Subtítulo / Descrição Opcional
                      </label>
                      <input
                        className={input}
                        value={draft.headerSubtitle || ''}
                        onChange={e => patch({ headerSubtitle: e.target.value })}
                        placeholder="Ex: Detalhamento dos produtos e serviços vinculados"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!draft.showHeaderBadge}
                        onChange={e => patch({ showHeaderBadge: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary rounded"
                      />
                      Exibir Badge com Contador de Registros (ex: 3 registro(s))
                    </label>
                  </div>

                  {/* Estilização Visual */}
                  <div className="border-t border-border pt-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Estilos Visuais do Cabeçalho
                    </h4>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Cor de Fundo</label>
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="color"
                            value={draft.headerStyle?.bgColor === 'transparent' ? '#ffffff' : (draft.headerStyle?.bgColor || '#f1f5f9')}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), bgColor: e.target.value } })}
                            className="w-7 h-7 p-0 border border-border rounded cursor-pointer"
                          />
                          <input
                            className={input}
                            value={draft.headerStyle?.bgColor || '#f1f5f9'}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), bgColor: e.target.value } })}
                            placeholder="#f1f5f9"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Cor do Texto</label>
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="color"
                            value={draft.headerStyle?.color || '#1e293b'}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), color: e.target.value } })}
                            className="w-7 h-7 p-0 border border-border rounded cursor-pointer"
                          />
                          <input
                            className={input}
                            value={draft.headerStyle?.color || '#1e293b'}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), color: e.target.value } })}
                            placeholder="#1e293b"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Tamanho da Fonte (pt)</label>
                        <input
                          type="number"
                          className={input}
                          value={draft.headerStyle?.fontSize || 9}
                          onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), fontSize: parseInt(e.target.value) || 9 } })}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Borda</label>
                        <select
                          className={input}
                          value={draft.headerStyle?.border || 'all'}
                          onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), border: e.target.value as any } })}
                        >
                          <option value="none">Sem Borda</option>
                          <option value="all">Todas as Bordas</option>
                          <option value="bottom">Apenas Borda Inferior</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Alinhamento</label>
                        <div className="flex border border-border rounded overflow-hidden">
                          <button
                            type="button"
                            onClick={() => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), align: 'left' } })}
                            className={`flex-1 py-1 flex items-center justify-center text-xs ${draft.headerStyle?.align === 'left' || !draft.headerStyle?.align ? 'bg-primary text-primary-foreground font-bold' : 'bg-card hover:bg-accent'}`}
                          >
                            <AlignLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), align: 'center' } })}
                            className={`flex-1 py-1 flex items-center justify-center text-xs ${draft.headerStyle?.align === 'center' ? 'bg-primary text-primary-foreground font-bold' : 'bg-card hover:bg-accent'}`}
                          >
                            <AlignCenter size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), align: 'right' } })}
                            className={`flex-1 py-1 flex items-center justify-center text-xs ${draft.headerStyle?.align === 'right' ? 'bg-primary text-primary-foreground font-bold' : 'bg-card hover:bg-accent'}`}
                          >
                            <AlignRight size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-4">
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draft.headerStyle?.bold}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), bold: e.target.checked } })}
                            className="w-3.5 h-3.5 text-primary rounded"
                          />
                          <Bold size={13} /> Negrito
                        </label>
                        <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!draft.headerStyle?.italic}
                            onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), italic: e.target.checked } })}
                            className="w-3.5 h-3.5 text-primary rounded"
                          />
                          <Italic size={13} /> Itálico
                        </label>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">Padding Interno (px)</label>
                        <input
                          type="number"
                          className={input}
                          value={draft.headerStyle?.padding ?? 4}
                          onChange={e => patch({ headerStyle: { ...(draft.headerStyle || DEFAULT_STYLE), padding: parseInt(e.target.value) || 0 } })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Visual Preview Card */}
                  <div className="border-t border-border pt-4">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Pré-Visualização em Tempo Real</p>
                    <div className="p-4 rounded border border-border bg-slate-100/50 flex flex-col items-center justify-center">
                      <div
                        style={{
                          width: '100%',
                          backgroundColor: draft.headerStyle?.bgColor !== 'transparent' ? draft.headerStyle?.bgColor : '#f1f5f9',
                          color: draft.headerStyle?.color || '#1e293b',
                          fontSize: `${draft.headerStyle?.fontSize || 9}pt`,
                          fontWeight: draft.headerStyle?.bold ? 'bold' : 'normal',
                          fontStyle: draft.headerStyle?.italic ? 'italic' : 'normal',
                          textAlign: draft.headerStyle?.align || 'left',
                          border: draft.headerStyle?.border === 'none'
                            ? 'none'
                            : draft.headerStyle?.border === 'bottom'
                            ? `1px solid ${draft.headerStyle?.borderColor || '#cbd5e1'}`
                            : `1px solid ${draft.headerStyle?.borderColor || '#cbd5e1'}`,
                          padding: `${draft.headerStyle?.padding ?? 4}px ${(draft.headerStyle?.padding ?? 4) + 2}px`,
                          borderRadius: '2px',
                        }}
                      >
                        <div>
                          <span>{draft.titleText || 'Título do Sub-Relatório'}</span>
                          {draft.showHeaderBadge && (
                            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full bg-black/10 ml-2 inline-block">
                              3 registro(s)
                            </span>
                          )}
                        </div>
                        {draft.headerSubtitle && (
                          <div className="text-[80%] opacity-80 font-normal mt-0.5">
                            {draft.headerSubtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
              </div>

              {/* ── Seção 2: Corpo do Sub-Relatório ────────────── */}
              <div className="border border-border rounded-xl p-4 bg-secondary/10 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-primary" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      {draft.tipoLayout === 'custom' ? 'Formatação do Corpo — Layout Customizado' : 'Formatação do Corpo — Grade de Colunas'}
                    </h3>
                  </div>
                </div>

                {draft.tipoLayout !== 'custom' ? (
                  <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Colunas do Sub-Relatório</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Configure rótulo, largura e formato de cada coluna.</p>
                </div>
                <button onClick={handleDetectCols} disabled={detecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border hover:bg-secondary disabled:opacity-50">
                  {detecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Re-detectar
                </button>
              </div>

              {draft.columns.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma coluna configurada</p>
                  <p className="text-xs mt-1">Configure o SQL e clique em "Detectar Colunas"</p>
                </div>
              )}

              {draft.columns.length > 0 && (
                <div className="space-y-1">
                  <div className="grid text-[10px] font-semibold text-muted-foreground uppercase pb-1"
                    style={{ gridTemplateColumns: '20px 3fr 2fr 1fr 2fr 2fr 1.5fr auto' }}>
                    <span /><span>Campo</span><span>Rótulo</span><span>Larg(mm)</span><span>Alinhamento</span><span>Formato</span><span>Total</span><span />
                  </div>
                  {draft.columns.map((col, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => { colDragRef.current = { fromIndex: i }; }}
                      onDragOver={e => { e.preventDefault(); setColDragOver(i); }}
                      onDragLeave={() => setColDragOver(null)}
                      onDrop={() => {
                        setColDragOver(null);
                        if (colDragRef.current) reorderCol(colDragRef.current.fromIndex, i);
                        colDragRef.current = null;
                      }}
                      onDragEnd={() => { colDragRef.current = null; setColDragOver(null); }}
                      className={`grid items-center gap-1 py-1.5 rounded border transition-colors ${
                        colDragOver === i
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-secondary/10 hover:bg-secondary/20'
                      }`}
                      style={{ gridTemplateColumns: '20px 3fr 2fr 1fr 2fr 2fr 1.5fr auto' }}
                    >
                      <span className="flex items-center justify-center cursor-grab text-muted-foreground hover:text-foreground">
                        <GripVertical size={12} />
                      </span>
                      <span className="text-xs font-mono text-primary truncate pr-1" title={col.field}>{col.field}</span>
                      <input className={input} value={col.label} onChange={e => updateCol(i, { label: e.target.value })} />
                      <input type="number" className={input} value={col.w} min={5} max={210}
                        onChange={e => updateCol(i, { w: Number(e.target.value) })} />
                      <select className={input} value={col.align} onChange={e => updateCol(i, { align: e.target.value as any })}>
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                      </select>
                      <select className={input} value={col.format} onChange={e => updateCol(i, { format: e.target.value as any })}>
                        <option value="text">Texto</option>
                        <option value="number">Número</option>
                        <option value="currency">Moeda</option>
                        <option value="date">Data</option>
                        <option value="datetime">Data+Hora</option>
                        <option value="percent">Percentual</option>
                      </select>
                      <select className={input} value={col.totalType || 'none'} onChange={e => updateCol(i, { totalType: e.target.value as any })}>
                        <option value="none">—</option>
                        <option value="sum">Soma</option>
                        <option value="avg">Média</option>
                        <option value="count">Contagem</option>
                      </select>
                      <button onClick={() => removeCol(i)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
                ) : (
                  <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Layout Customizado (Elementos Livres)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Arraste para posicionar • ↑↓←→ move 1mm • Shift+seta = 0.1mm</p>
                </div>
                <div className="flex gap-1">
                  {(['text', 'line', 'box', 'image'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        const newComp = {
                          id: 'sub_' + Math.random().toString(36).substring(2, 9),
                          type,
                          x: 2, y: (draft.customComponents?.length || 0) * 7 + 2,
                          w: type === 'line' ? 50 : 40, h: type === 'line' ? 1 : 5,
                          ...(type === 'text' && { content: '{campo}', style: { ...DEFAULT_STYLE } }),
                          ...(type === 'line' && { orientation: 'horizontal', color: '#1a1a1a', thickness: 1 }),
                          ...(type === 'box' && { borderColor: '#cccccc', borderThickness: 1, bgColor: 'transparent', borderRadius: 0 }),
                          ...(type === 'image' && { src: '', fit: 'contain' })
                        } as any;
                        patch({ customComponents: [...(draft.customComponents || []), newComp] });
                        setSelectedId(newComp.id);
                      }}
                      className="px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    >
                      + {type === 'text' ? 'Texto' : type === 'line' ? 'Linha' : type === 'box' ? 'Retângulo' : 'Imagem'}
                    </button>
                  ))}
                </div>
              </div>

              {(!draft.customComponents || draft.customComponents.length === 0) && (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <LayoutList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum elemento no layout</p>
                  <p className="text-xs mt-1">Adicione elementos acima para começar a desenhar.</p>
                </div>
              )}

              {/* ── Canvas Visual de Drag-and-Drop ─────────────────── */}
              {(draft.customComponents?.length || 0) > 0 && (() => {
                const rowH = draft.rowHeight ?? 15;
                const canvasH = canvasPx(rowH);
                const canvasW = canvasPx(CANVAS_W_MM);
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide flex items-center gap-1">
                        <Move size={10} /> Canvas ({CANVAS_W_MM}mm × {rowH}mm por registro)
                      </span>
                      {selectedId && (
                        <span className="text-[10px] text-primary bg-primary/10 rounded px-2 py-0.5">
                          Selecionado: {draft.customComponents?.find(c => c.id === selectedId)?.type || ''} — use ↑↓←→ para mover
                        </span>
                      )}
                    </div>
                    <div
                      ref={canvasRef}
                      className="relative border-2 border-dashed border-border rounded bg-white/50 overflow-hidden select-none"
                      style={{ width: canvasW, height: Math.max(canvasH, 80), cursor: 'default' }}
                      tabIndex={0}
                      onClick={() => setSelectedId(null)}
                    >
                      {/* Régua horizontal em mm */}
                      {Array.from({ length: Math.floor(CANVAS_W_MM / 10) + 1 }, (_, idx) => (
                        <div key={idx} style={{ position: 'absolute', left: canvasPx(idx * 10), top: 0, height: 6, borderLeft: '1px solid #ccc' }}>
                          <span style={{ position: 'absolute', left: 2, top: 0, fontSize: 7, color: '#aaa' }}>{idx * 10}</span>
                        </div>
                      ))}

                      {(draft.customComponents || []).map((c, idx) => {
                        const isSel = selectedId === c.id;
                        const left = canvasPx(c.x);
                        const top  = canvasPx(c.y);
                        const w    = canvasPx(c.w);
                        const h    = canvasPx(c.h);
                        const label = c.type === 'text'
                          ? ((c as any).content || '').substring(0, 30)
                          : c.type === 'line' ? '─ linha' : c.type === 'box' ? '□ retângulo' : '🖼 imagem';

                        return (
                          <div
                            key={c.id}
                            title={`${c.type} — X:${c.x}mm Y:${c.y}mm W:${c.w}mm H:${c.h}mm`}
                            style={{
                              position: 'absolute',
                              left, top, width: w, height: h,
                              boxSizing: 'border-box',
                              border: isSel ? '2px solid #2563eb' : '1.5px dashed #94a3b8',
                              background: isSel ? 'rgba(37,99,235,0.07)' : 'rgba(248,250,252,0.8)',
                              cursor: 'move',
                              zIndex: isSel ? 20 : idx + 1,
                              borderRadius: 2,
                              userSelect: 'none',
                              overflow: 'hidden',
                            }}
                            onClick={e => { e.stopPropagation(); setSelectedId(c.id); }}
                            onMouseDown={e => {
                              e.stopPropagation();
                              e.preventDefault();
                              setSelectedId(c.id);
                              dragRef.current = {
                                active: true,
                                compId: c.id,
                                startMouseX: e.clientX,
                                startMouseY: e.clientY,
                                startCompX: c.x,
                                startCompY: c.y,
                                mode: 'move',
                              };
                            }}
                          >
                            <span style={{ fontSize: 9, color: '#374151', padding: '1px 3px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2' }}>
                              {label}
                            </span>

                            {/* Handle de redimensionamento (canto inferior direito) */}
                            {isSel && (
                              <div
                                style={{
                                  position: 'absolute', right: 0, bottom: 0,
                                  width: 8, height: 8,
                                  background: '#2563eb',
                                  cursor: 'se-resize',
                                  borderRadius: '2px 0 2px 0',
                                }}
                                onMouseDown={e => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  dragRef.current = {
                                    active: true,
                                    compId: c.id,
                                    startMouseX: e.clientX,
                                    startMouseY: e.clientY,
                                    startCompX: c.w,
                                    startCompY: c.h,
                                    mode: 'resize-br',
                                  };
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      💡 Arraste os elementos para posicionar. Handle azul no canto = redimensionar. Clique fora para desselecionar.
                    </p>
                  </div>
                );
              })()}

              <div className="space-y-3">
                {(draft.customComponents || []).map((comp, i) => {
                  const s = (comp as any).style || DEFAULT_STYLE;
                  return (
                    <div key={comp.id} className="p-3 border border-border rounded-lg bg-secondary/15 space-y-2">
                      <div className="flex items-center justify-between border-b border-border pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-secondary border border-border text-muted-foreground px-1.5 py-0.5 rounded font-mono font-semibold">
                            Camada #{i + 1}
                          </span>
                          <span className="text-xs font-bold text-primary capitalize">
                            {comp.type === 'text' ? 'Caixa de Texto' : comp.type === 'line' ? 'Linha' : comp.type === 'box' ? 'Retângulo' : 'Imagem'}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => moveComponent(i, 'back')}
                            disabled={i === 0}
                            title="Enviar para trás (Z-Index menor)"
                            className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                          >
                            <ChevronsDown size={13} />
                          </button>
                          <button
                            onClick={() => moveComponent(i, 'backward')}
                            disabled={i === 0}
                            title="Recuar uma camada"
                            className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                          >
                            <ChevronDown size={13} />
                          </button>
                          <button
                            onClick={() => moveComponent(i, 'forward')}
                            disabled={i === (draft.customComponents?.length || 0) - 1}
                            title="Avançar uma camada"
                            className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                          >
                            <ChevronUp size={13} />
                          </button>
                          <button
                            onClick={() => moveComponent(i, 'front')}
                            disabled={i === (draft.customComponents?.length || 0) - 1}
                            title="Trazer para frente (Z-Index maior)"
                            className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30"
                          >
                            <ChevronsUp size={13} />
                          </button>
                          <div className="w-px h-3 bg-border mx-1" />
                          <button
                            onClick={() => patch({ customComponents: draft.customComponents?.filter((_, idx) => idx !== i) })}
                            className="text-[10px] text-destructive hover:bg-destructive/10 px-1.5 py-0.5 rounded font-medium"
                          >
                            Remover
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Posição X (mm)</label>
                          <input type="number" className={input} value={comp.x} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, x: val } : c) });
                          }} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Posição Y (mm)</label>
                          <input type="number" className={input} value={comp.y} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, y: val } : c) });
                          }} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Largura W (mm)</label>
                          <input type="number" className={input} value={comp.w} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, w: val } : c) });
                          }} />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block">Altura H (mm)</label>
                          <input type="number" className={input} value={comp.h} onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, h: val } : c) });
                          }} />
                        </div>
                      </div>

                      {/* Especificidades de cada tipo */}
                      {comp.type === 'text' && (
                        <div className="space-y-2 pt-1.5 border-t border-border/50">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                              <label className="text-[10px] text-muted-foreground block">Conteúdo (ex: {'{campo_filho}'})</label>
                              <input className={input} value={(comp as any).content || ''} onChange={e => {
                                const val = e.target.value;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, content: val } : c) });
                              }} />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block">Fonte</label>
                              <select className={input} value={s.fontFamily || ''} onChange={e => {
                                const val = e.target.value || undefined;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, fontFamily: val } } : c) });
                              }}>
                                <option value="">Padrão (Sistema)</option>
                                <option value="'Arial', sans-serif">Arial</option>
                                <option value="'Times New Roman', serif">Times New Roman</option>
                                <option value="'Courier New', monospace">Courier New</option>
                                <option value="'Georgia', serif">Georgia</option>
                                <option value="'Verdana', sans-serif">Verdana</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-2 text-xs items-end">
                            <div>
                              <label className="text-[10px] text-muted-foreground block">Tamanho (pt)</label>
                              <input type="number" className={input} value={s.fontSize || 9} onChange={e => {
                                const val = parseInt(e.target.value) || 9;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, fontSize: val } } : c) });
                              }} />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block">Cor</label>
                              <input type="color" className="w-full h-6 border rounded" value={s.color || '#1a1a1a'} onChange={e => {
                                const val = e.target.value;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, color: val } } : c) });
                              }} />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block">Alinhamento</label>
                              <select className={input} value={s.align} onChange={e => {
                                const val = e.target.value as any;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, align: val } } : c) });
                              }}>
                                <option value="left">Esquerda</option>
                                <option value="center">Centro</option>
                                <option value="right">Direita</option>
                              </select>
                            </div>
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => {
                                  patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, bold: !s.bold } } : c) });
                                }}
                                className={`px-2 py-0.5 rounded border ${s.bold ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                              >N</button>
                              <button
                                onClick={() => {
                                  patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, italic: !s.italic } } : c) });
                                }}
                                className={`px-2 py-0.5 rounded border ${s.italic ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                              >I</button>
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground block">Fundo</label>
                              <input type="color" className="w-full h-6 border rounded" value={s.bgColor === 'transparent' ? '#ffffff' : s.bgColor} onChange={e => {
                                const val = e.target.value;
                                patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, style: { ...s, bgColor: val } } : c) });
                              }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {comp.type === 'line' && (
                        <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-border/50 text-xs">
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Orientação</label>
                            <select className={input} value={(comp as any).orientation} onChange={e => {
                              const val = e.target.value as any;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, orientation: val } : c) });
                            }}>
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Espessura (px)</label>
                            <input type="number" className={input} value={(comp as any).thickness} onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, thickness: val } : c) });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Cor</label>
                            <input type="color" className="w-full h-6 border rounded" value={(comp as any).color || '#1a1a1a'} onChange={e => {
                              const val = e.target.value;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, color: val } : c) });
                            }} />
                          </div>
                        </div>
                      )}

                      {comp.type === 'box' && (
                        <div className="grid grid-cols-4 gap-2 pt-1.5 border-t border-border/50 text-xs">
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Cor da Borda</label>
                            <input type="color" className="w-full h-6 border rounded" value={(comp as any).borderColor || '#cccccc'} onChange={e => {
                              const val = e.target.value;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, borderColor: val } : c) });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Espessura Borda (px)</label>
                            <input type="number" className={input} value={(comp as any).borderThickness} onChange={e => {
                              const val = parseInt(e.target.value) || 1;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, borderThickness: val } : c) });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Cor de Fundo</label>
                            <input type="color" className="w-full h-6 border rounded" value={(comp as any).bgColor === 'transparent' ? '#ffffff' : (comp as any).bgColor} onChange={e => {
                              const val = e.target.value;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, bgColor: val } : c) });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Arredondamento (px)</label>
                            <input type="number" className={input} value={(comp as any).borderRadius} onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, borderRadius: val } : c) });
                            }} />
                          </div>
                        </div>
                      )}

                      {comp.type === 'image' && (
                        <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/50 text-xs">
                          <div>
                            <label className="text-[10px] text-muted-foreground block">URL ou Caminho</label>
                            <input className={input} value={(comp as any).src || ''} onChange={e => {
                              const val = e.target.value;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, src: val } : c) });
                            }} />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground block">Ajuste da Imagem</label>
                            <select className={input} value={(comp as any).fit} onChange={e => {
                              const val = e.target.value as any;
                              patch({ customComponents: draft.customComponents?.map((c, idx) => idx === i ? { ...c, fit: val } : c) });
                            }}>
                              <option value="contain">Conter</option>
                              <option value="cover">Cobrir</option>
                              <option value="fill">Esticar</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
                </div>
                )}
            </div>
          )}


          {/* ── Aba SQL ───────────────────────────────────────── */}
{activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Query SQL do sub-relatório</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Use <code className="bg-muted rounded px-1">{'{variavel}'}</code> para referenciar parâmetros vinculados ao relatório pai.
                  </p>
                </div>
                <button
                  onClick={handleDetectCols}
                  disabled={detecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  {detecting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  Detectar Colunas
                </button>
              </div>

              <textarea
                value={draft.query_sql}
                onChange={e => patch({ query_sql: e.target.value })}
                placeholder={`-- Exemplo de sub-relatório de pagamentos vinculado ao pedido pai:\nSELECT\n  fp.descricao AS forma_pagamento,\n  p.valor\nFROM PAGAMENTO p\nJOIN FORMA_PAGAMENTO fp ON fp.forma_pagamento_id = p.forma_pagamento_id\nWHERE p.pedido_id = {pedido_id}\nAND p.excluido = false`}
                rows={14}
                className="w-full border border-border rounded px-3 py-2 text-xs bg-card font-mono focus:ring-1 focus:ring-ring outline-none resize-none"
                spellCheck={false}
              />

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-700 space-y-1">
                <p className="font-semibold">💡 Dicas de SQL</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                  <li>Use <code className="bg-blue-100 rounded px-1">{'{campo_pai}'}</code> para parâmetros vinculados (configure na aba Vínculos)</li>
                  <li>Filtre sempre por <code className="bg-blue-100 rounded px-1">excluido = false</code> se a tabela tiver exclusão lógica</li>
                  <li>Após salvar o SQL, clique em <strong>Detectar Colunas</strong> para gerar automaticamente as colunas</li>
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-[11px] text-emerald-700 space-y-1">
                <p className="font-semibold">🔒 Variáveis de Sistema & Herança de Filtro</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-600">
                  <li><code className="bg-emerald-100 rounded px-1">{'{sys_empresa_id}'}</code> — ID da empresa logada</li>
                  <li><code className="bg-emerald-100 rounded px-1">{'{sys_matriz_id}'}</code> — ID da empresa matriz</li>
                </ul>
                <p className="mt-1 text-emerald-600 font-medium">
                  ℹ️ Por padrão, o sub-relatório <strong>herda automaticamente a seleção de empresa/matriz do relatório principal</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── Aba Vínculos ──────────────────────────────────── */}
{activeTab === 'links' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Vínculos Pai → Filho</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Define como os valores do relatório principal são passados como parâmetros para o SQL do sub-relatório.
                  </p>
                </div>
                <button onClick={addLink} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus size={13} /> Adicionar Vínculo
                </button>
              </div>

              {draft.links.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum vínculo configurado</p>
                  <p className="text-xs mt-1">O sub-relatório será executado sem parâmetros do pai</p>
                  <button onClick={addLink} className="mt-3 text-xs text-primary hover:underline">+ Adicionar primeiro vínculo</button>
                </div>
              )}

              {draft.links.map((link, i) => (
                <div key={i} className="flex items-start gap-3 p-3 border border-border rounded-lg bg-secondary/20">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                        Campo do Pai
                      </label>
                      <select
                        value={link.parentField}
                        onChange={e => updateLink(i, { parentField: e.target.value })}
                        className={input}
                      >
                        <option value="">— Selecione —</option>
                        {parentColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Coluna do dataset principal</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                        Parâmetro no SQL Filho
                      </label>
                      <input
                        className={input}
                        value={link.childParam}
                        onChange={e => updateLink(i, { childParam: e.target.value })}
                        placeholder="pedido_id"
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Nome sem chaves — use <code>{'{' + (link.childParam || 'param') + '}'}</code> no SQL</p>
                    </div>
                  </div>
                  <button onClick={() => removeLink(i)} title="Remover vínculo" className="mt-5 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {draft.links.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-[11px] text-amber-700">
                  <p className="font-semibold mb-1">📌 Como funciona</p>
                  <p>Para cada linha do relatório pai, o motor injeta o valor do <strong>Campo do Pai</strong> como parâmetro no SQL filho. Exemplo:</p>
                  {draft.links[0] && (
                    <code className="block mt-1.5 bg-amber-100 rounded p-2 font-mono text-amber-800">
                      {`-- Para cada linha onde ${draft.links[0].parentField} = 42:`}<br />
                      {`-- ${'{' + draft.links[0].childParam + '}'} é substituído por 42`}
                    </code>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0 bg-secondary/20">
          <p className="text-[11px] text-muted-foreground">
            As alterações só são aplicadas ao clicar em <strong>Salvar</strong>.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-1.5 text-xs rounded border border-border hover:bg-secondary">
              Cancelar
            </button>
            <button onClick={handleSave}
              className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpbSubreportConfig;
