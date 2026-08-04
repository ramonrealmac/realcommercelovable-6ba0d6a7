// ============================================================
// Report Builder Pro — Modal de Configuração do Sub-Relatório
// SQL editor + links pai→filho + detecção/edição de colunas
// ============================================================
import React, { useState, useCallback } from 'react';
import type { RpbSubreportComp, RpbSubreportLink, RpbTableColumn } from '../../types';
import { DEFAULT_STYLE } from '../../types';
import { rpbExecuteQuery } from '../../services/rpbService';
import {
  X, Plus, Trash2, RefreshCw, Loader2, LayoutList,
  Link2, Table2, Settings2,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  comp:          RpbSubreportComp;
  parentColumns: string[];           // colunas do dataset principal
  onChange:      (updated: RpbSubreportComp) => void;
  onClose:       () => void;
}

type Tab = 'geral' | 'sql' | 'links' | 'colunas';

const RpbSubreportConfig: React.FC<Props> = ({ comp, parentColumns, onChange, onClose }) => {
  const [draft, setDraft]       = useState<RpbSubreportComp>({ ...comp, links: [...comp.links], columns: [...comp.columns] });
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [detecting, setDetecting] = useState(false);

  const patch = (p: Partial<RpbSubreportComp>) => setDraft(prev => ({ ...prev, ...p }));

  const moveComponent = useCallback((index: number, direction: 'back' | 'backward' | 'forward' | 'front') => {
    if (!draft.customComponents) return;
    const comps = [...draft.customComponents];
    const compToMove = comps[index];
    
    comps.splice(index, 1);
    
    let newIndex = index;
    if (direction === 'back') {
      newIndex = 0;
    } else if (direction === 'backward') {
      newIndex = Math.max(0, index - 1);
    } else if (direction === 'forward') {
      newIndex = Math.min(comps.length, index + 1);
    } else if (direction === 'front') {
      newIndex = comps.length;
    }
    
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
    setActiveTab('colunas');
  }, [draft.query_sql]);

  // ── Links ──────────────────────────────────────────────────
  const addLink = () => patch({ links: [...draft.links, { parentField: parentColumns[0] || '', childParam: '' }] });
  const removeLink = (i: number) => patch({ links: draft.links.filter((_, idx) => idx !== i) });
  const updateLink = (i: number, p: Partial<RpbSubreportLink>) =>
    patch({ links: draft.links.map((l, idx) => idx === i ? { ...l, ...p } : l) });

  // ── Colunas ────────────────────────────────────────────────
  const removeCol = (i: number) => patch({ columns: draft.columns.filter((_, idx) => idx !== i) });
  const updateCol = (i: number, p: Partial<RpbTableColumn>) =>
    patch({ columns: draft.columns.map((c, idx) => idx === i ? { ...c, ...p } : c) });

  // ── Salvar ─────────────────────────────────────────────────
  const handleSave = () => { onChange(draft); onClose(); };

  const input = 'w-full border border-border rounded px-2 py-1 text-xs bg-card focus:ring-1 focus:ring-ring outline-none';
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'geral',   label: 'Geral',    icon: <Settings2 size={13} />   },
    { key: 'sql',     label: 'SQL',      icon: <LayoutList size={13} />  },
    { key: 'links',   label: 'Vínculos', icon: <Link2 size={13} />       },
    { key: 'colunas', label: draft.tipoLayout === 'custom' ? 'Layout Custom.' : 'Colunas',  icon: <Table2 size={13} />      },
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
              {t.key === 'colunas' && (
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

          {/* ── Aba Colunas ───────────────────────────────────── */}
          {activeTab === 'colunas' && draft.tipoLayout !== 'custom' && (
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
                  <div className="grid text-[10px] font-semibold text-muted-foreground uppercase px-2 pb-1"
                    style={{ gridTemplateColumns: '3fr 2fr 1fr 2fr 2fr 1.5fr auto' }}>
                    <span>Campo</span><span>Rótulo</span><span>Larg(mm)</span><span>Alinhamento</span><span>Formato</span><span>Total</span><span />
                  </div>
                  {draft.columns.map((col, i) => (
                    <div key={i} className="grid items-center gap-1 px-2 py-1.5 rounded border border-border bg-secondary/10 hover:bg-secondary/20"
                      style={{ gridTemplateColumns: '3fr 2fr 1fr 2fr 2fr 1.5fr auto' }}>
                      <span className="text-xs font-mono text-primary truncate" title={col.field}>{col.field}</span>
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
          )}

          {activeTab === 'colunas' && draft.tipoLayout === 'custom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Layout Customizado (Elementos Livres)</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Adicione e posicione caixas de texto, linhas, imagens e retângulos por registro.</p>
                </div>
                <div className="flex gap-1">
                  {(['text', 'line', 'box', 'image'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        const newComp = {
                          id: 'sub_' + Math.random().toString(36).substring(2, 9),
                          type,
                          x: 0, y: 0, w: type === 'line' ? 50 : 40, h: type === 'line' ? 2 : 5,
                          ...(type === 'text' && { content: 'Texto', style: { ...DEFAULT_STYLE } }),
                          ...(type === 'line' && { orientation: 'horizontal', color: '#1a1a1a', thickness: 1 }),
                          ...(type === 'box' && { borderColor: '#cccccc', borderThickness: 1, bgColor: 'transparent', borderRadius: 0 }),
                          ...(type === 'image' && { src: '', fit: 'contain' })
                        } as any;
                        patch({ customComponents: [...(draft.customComponents || []), newComp] });
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
                  <p className="text-xs mt-1">Adicione elementos acima para começar a desenhar o sub-relatório.</p>
                </div>
              )}

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
