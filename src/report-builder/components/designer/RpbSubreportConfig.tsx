// ============================================================
// Report Builder Pro — Modal de Configuração do Sub-Relatório
// SQL editor + links pai→filho + formatação por bandas em Folha Única Canvas
// ============================================================
import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RpbSubreportComp, RpbSubreportLink, RpbTableColumn, RpbComponent } from '../../types';
import { DEFAULT_STYLE } from '../../types';
import { rpbExecuteQuery } from '../../services/rpbService';
import {
  X, Plus, Trash2, RefreshCw, Loader2, LayoutList,
  Link2, Table2, Settings2, PanelTop, PanelBottom,
  ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  GripVertical, Move, Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  comp:          RpbSubreportComp;
  parentColumns: string[];           // colunas do dataset principal
  onChange:      (updated: RpbSubreportComp) => void;
  onClose:       () => void;
}

type Tab = 'geral' | 'formatacao' | 'sql' | 'links';
type SubBandTarget = 'header' | 'detail' | 'footer';

// ── Constantes do Canvas ──────────────────────────────────
const CANVAS_W_MM = 190;
const CANVAS_SCALE = 4.6; // px por mm (escala ampliada para preenchimento total)
const canvasPx = (mm: number) => Math.round(mm * CANVAS_SCALE);
const pxToMm = (px: number) => Math.round((px / CANVAS_SCALE) * 10) / 10;
const inputCls = 'w-full border border-border rounded px-2 py-1 text-xs bg-card focus:ring-1 focus:ring-ring outline-none';

// ── Editor Canvas de Folha Única Contínua (Idêntico ao Relatório Principal) ─────────
const UnifiedSubreportSheetCanvas: React.FC<{
  draft: RpbSubreportComp;
  onPatch: (patch: Partial<RpbSubreportComp>) => void;
  childColumns: string[];
  parentColumns: string[];
  handleDetectCols: () => void;
  detecting: boolean;
  colDragRef: React.MutableRefObject<{ fromIndex: number } | null>;
  colDragOver: number | null;
  setColDragOver: (idx: number | null) => void;
  reorderCol: (from: number, to: number) => void;
  updateCol: (i: number, patch: Partial<RpbTableColumn>) => void;
  removeCol: (i: number) => void;
}> = ({
  draft, onPatch, childColumns, parentColumns, handleDetectCols, detecting,
  colDragRef, colDragOver, setColDragOver, reorderCol, updateCol, removeCol,
}) => {
  const [activeSubBand, setActiveSubBand] = useState<SubBandTarget>('header');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  const dragRef = useRef<{
    active: boolean;
    compId: string;
    band: SubBandTarget;
    startMouseX: number;
    startMouseY: number;
    startCompX: number;
    startCompY: number;
    mode: 'move' | 'resize-br';
  } | null>(null);

  const headerComps = draft.headerComponents || [];
  const detailComps = draft.customComponents || [];
  const footerComps = draft.footerComponents || [];

  const getCompsByBand = useCallback((band: SubBandTarget): RpbComponent[] => {
    if (band === 'header') return headerComps;
    if (band === 'detail') return detailComps;
    return footerComps;
  }, [headerComps, detailComps, footerComps]);

  const updateCompsByBand = useCallback((band: SubBandTarget, newComps: RpbComponent[]) => {
    if (band === 'header') onPatch({ headerComponents: newComps });
    else if (band === 'detail') onPatch({ customComponents: newComps });
    else onPatch({ footerComponents: newComps });
  }, [onPatch]);

  const patchCompInBand = useCallback((band: SubBandTarget, id: string, changes: Record<string, any>) => {
    const comps = getCompsByBand(band);
    updateCompsByBand(band, comps.map(c => c.id === id ? { ...c, ...changes } as RpbComponent : c));
  }, [getCompsByBand, updateCompsByBand]);

  // ── Drag & Drop no Canvas ──
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const d = dragRef.current;
    if (!d || !d.active) return;
    const dx = pxToMm(e.clientX - d.startMouseX);
    const dy = pxToMm(e.clientY - d.startMouseY);
    if (d.mode === 'move') {
      const newX = Math.max(0, Math.round((d.startCompX + dx) * 10) / 10);
      const newY = Math.max(0, Math.round((d.startCompY + dy) * 10) / 10);
      patchCompInBand(d.band, d.compId, { x: newX, y: newY });
    } else {
      const newW = Math.max(5, Math.round((d.startCompX + dx) * 10) / 10);
      const newH = Math.max(2, Math.round((d.startCompY + dy) * 10) / 10);
      patchCompInBand(d.band, d.compId, { w: newW, h: newH });
    }
  }, [patchCompInBand]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // ── Teclas de seta para mover elemento selecionado em qualquer banda ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedCompId) return;
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.1 : 1;
      const delta: Record<string, [string, number]> = {
        ArrowUp:    ['y', -step],
        ArrowDown:  ['y',  step],
        ArrowLeft:  ['x', -step],
        ArrowRight: ['x',  step],
      };
      const [axis, val] = delta[e.key];

      for (const b of ['header', 'detail', 'footer'] as SubBandTarget[]) {
        const comps = getCompsByBand(b);
        const target = comps.find(c => c.id === selectedCompId);
        if (target) {
          const cur = (target as any)[axis] as number;
          patchCompInBand(b, selectedCompId, { [axis]: Math.max(0, Math.round((cur + val) * 10) / 10) });
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedCompId, getCompsByBand, patchCompInBand]);

  // Adicionar novo elemento na banda ativa
  const addElementToActiveBand = (type: 'text' | 'line' | 'box' | 'image' | 'totalizer') => {
    const curComps = getCompsByBand(activeSubBand);
    const newComp: RpbComponent = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      type,
      x: 2, y: curComps.length * 4 + 2,
      w: type === 'line' ? 50 : type === 'totalizer' ? 45 : 40,
      h: type === 'line' ? 1 : 6,
      ...(type === 'text' && { content: 'Texto', style: { ...DEFAULT_STYLE } }),
      ...(type === 'line' && { orientation: 'horizontal', color: '#1a1a1a', thickness: 1 }),
      ...(type === 'box' && { borderColor: '#cccccc', borderThickness: 1, bgColor: 'transparent', borderRadius: 0 }),
      ...(type === 'image' && { src: '', fit: 'contain' }),
      ...(type === 'totalizer' && { field: childColumns[0] || '', operation: 'sum', format: 'currency', labelText: 'Total: ', scope: 'report', style: { ...DEFAULT_STYLE, bold: true } }),
    } as any;

    updateCompsByBand(activeSubBand, [...curComps, newComp]);
    setSelectedCompId(newComp.id);
  };

  // Reordenar camada do elemento na banda
  const moveLayerInBand = (band: SubBandTarget, id: string, direction: 'back' | 'backward' | 'forward' | 'front') => {
    const comps = [...getCompsByBand(band)];
    const index = comps.findIndex(c => c.id === id);
    if (index === -1) return;
    const item = comps[index];
    comps.splice(index, 1);
    let newIndex = index;
    if (direction === 'back') newIndex = 0;
    else if (direction === 'backward') newIndex = Math.max(0, index - 1);
    else if (direction === 'forward') newIndex = Math.min(comps.length, index + 1);
    else if (direction === 'front') newIndex = comps.length;
    comps.splice(newIndex, 0, item);
    updateCompsByBand(band, comps);
  };

  // Encontrar o componente selecionado e a banda correspondente
  let selectedComp: RpbComponent | null = null;
  let selectedBand: SubBandTarget = activeSubBand;
  for (const b of ['header', 'detail', 'footer'] as SubBandTarget[]) {
    const found = getCompsByBand(b).find(c => c.id === selectedCompId);
    if (found) {
      selectedComp = found;
      selectedBand = b;
      break;
    }
  }

  // Redimensionamento de altura de banda por drag
  const handleStartResizeBand = (band: SubBandTarget, currentH: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startY = e.clientY;
    const startH = currentH;
    const onMove = (ev: MouseEvent) => {
      const dy = pxToMm(ev.clientY - startY);
      const newH = Math.max(5, Math.round((startH + dy) * 10) / 10);
      if (band === 'header') onPatch({ headerHeight: newH });
      else if (band === 'detail') onPatch({ rowHeight: newH });
      else if (band === 'footer') onPatch({ footerHeight: newH });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* Barra de Ferramentas Superior */}
      <div className="flex items-center justify-between p-2.5 bg-card border border-border rounded-lg shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Banda Ativa:</span>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded flex items-center gap-1">
            {activeSubBand === 'header' ? 'Sub-Cabeçalho' : activeSubBand === 'detail' ? 'Sub-Corpo / Detalhe' : 'Sub-Rodapé'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-semibold uppercase mr-1">Adicionar:</span>
          {(['text', 'line', 'box', 'image', 'totalizer'] as const).map(type => {
            if (type === 'totalizer' && activeSubBand !== 'footer') return null;
            return (
              <button
                key={type}
                type="button"
                onClick={() => addElementToActiveBand(type)}
                className="px-2.5 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-xs flex items-center gap-1"
              >
                + {type === 'text' ? 'Texto' : type === 'line' ? 'Linha' : type === 'box' ? 'Retângulo' : type === 'image' ? 'Imagem' : 'Totalizador'}
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA PRINCIPAL EM 2 COLUNAS (LADO A LADO) */}
      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        {/* COLUNA ESQUERDA: BARRA LATERAL DE PROPRIEDADES (280px) */}
        <div className="w-[280px] flex-shrink-0 border border-border rounded-xl bg-card p-3 overflow-y-auto flex flex-col shadow-xs">
          {selectedComp ? (() => {
            const s = (selectedComp as any).style || DEFAULT_STYLE;
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-primary capitalize truncate">
                    {selectedComp.type === 'text' ? 'Caixa de Texto' : selectedComp.type === 'line' ? 'Linha' : selectedComp.type === 'box' ? 'Retângulo' : selectedComp.type === 'totalizer' ? 'Totalizador' : 'Imagem'}
                  </span>
                  <button
                    onClick={() => {
                      updateCompsByBand(selectedBand, getCompsByBand(selectedBand).filter(c => c.id !== selectedComp!.id));
                      setSelectedCompId(null);
                    }}
                    className="text-[11px] text-destructive hover:bg-destructive/10 px-1.5 py-0.5 rounded font-semibold"
                  >
                    Excluir
                  </button>
                </div>

                <div className="flex items-center gap-1 justify-between text-[10px]">
                  <span className="bg-secondary border border-border text-muted-foreground px-1 py-0.5 rounded font-mono">
                    ID: {selectedComp.id}
                  </span>
                  <span className="bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded font-semibold uppercase">
                    {selectedBand === 'header' ? 'Sub-Cabeçalho' : selectedBand === 'detail' ? 'Sub-Corpo' : 'Sub-Rodapé'}
                  </span>
                </div>

                {/* Camadas */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-[10px] text-muted-foreground font-semibold">Camada:</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveLayerInBand(selectedBand, selectedComp!.id, 'back')} title="Enviar para trás" className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronsDown size={13} /></button>
                    <button type="button" onClick={() => moveLayerInBand(selectedBand, selectedComp!.id, 'backward')} title="Recuar camada" className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronDown size={13} /></button>
                    <button type="button" onClick={() => moveLayerInBand(selectedBand, selectedComp!.id, 'forward')} title="Avançar camada" className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronUp size={13} /></button>
                    <button type="button" onClick={() => moveLayerInBand(selectedBand, selectedComp!.id, 'front')} title="Trazer para frente" className="p-1 rounded hover:bg-accent text-muted-foreground"><ChevronsUp size={13} /></button>
                  </div>
                </div>

                {/* Grid Coordenadas */}
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Posição X (mm)</label>
                    <input type="number" step="0.1" className={inputCls} value={selectedComp.x} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { x: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Posição Y (mm)</label>
                    <input type="number" step="0.1" className={inputCls} value={selectedComp.y} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { y: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Largura W (mm)</label>
                    <input type="number" step="0.1" className={inputCls} value={selectedComp.w} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { w: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block">Altura H (mm)</label>
                    <input type="number" step="0.1" className={inputCls} value={selectedComp.h} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { h: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                {/* Form específico por tipo */}
                {selectedComp.type === 'text' && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Conteúdo do Texto</label>
                      <input className={inputCls} value={(selectedComp as any).content || ''} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { content: e.target.value })} />
                    </div>

                    <div>
                      <label className="text-[10px] text-primary font-bold block mb-0.5">➕ Inserir Campo na Posição</label>
                      <select
                        className={inputCls + ' border-primary/40 bg-primary/5 font-semibold text-primary'}
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value) {
                            const curText = (selectedComp as any).content || '';
                            patchCompInBand(selectedBand, selectedComp!.id, { content: curText + `{${e.target.value}}` });
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">— Selecione um Campo —</option>
                        {childColumns.length > 0 && (
                          <optgroup label="Colunas do Sub-Relatório">
                            {childColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        )}
                        {parentColumns.length > 0 && (
                          <optgroup label="Campos do Relatório Pai">
                            {parentColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Tamanho (pt)</label>
                        <input type="number" className={inputCls} value={s.fontSize || 9} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, fontSize: parseInt(e.target.value) || 9 } })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Alinhamento</label>
                        <select className={inputCls} value={s.align || 'left'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, align: e.target.value } })}>
                          <option value="left">Esquerda</option>
                          <option value="center">Centro</option>
                          <option value="right">Direita</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Cor Texto</label>
                        <input type="color" className="w-full h-6 border rounded" value={s.color || '#1a1a1a'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, color: e.target.value } })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Cor Fundo</label>
                        <input type="color" className="w-full h-6 border rounded" value={s.bgColor === 'transparent' ? '#ffffff' : (s.bgColor || '#ffffff')} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, bgColor: e.target.value } })} />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button type="button" onClick={() => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, bold: !s.bold } })} className={`flex-1 py-1 rounded border text-xs ${s.bold ? 'bg-primary text-primary-foreground font-bold' : 'bg-card'}`}>Negrito</button>
                      <button type="button" onClick={() => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, italic: !s.italic } })} className={`flex-1 py-1 rounded border text-xs ${s.italic ? 'bg-primary text-primary-foreground font-bold' : 'bg-card'}`}>Itálico</button>
                    </div>
                  </div>
                )}

                {selectedComp.type === 'totalizer' && (
                  <div className="space-y-2 pt-2 border-t border-border text-xs">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Campo a Totalizar</label>
                      <select className={inputCls} value={(selectedComp as any).field || ''} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { field: e.target.value })}>
                        <option value="">— Selecione o Campo —</option>
                        {childColumns.length > 0 && (
                          <optgroup label="Colunas do Sub-Relatório">
                            {childColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        )}
                        {parentColumns.length > 0 && (
                          <optgroup label="Campos do Relatório Pai">
                            {parentColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block">Operação</label>
                      <select className={inputCls} value={(selectedComp as any).operation || 'sum'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { operation: e.target.value })}>
                        <option value="sum">Soma (Σ)</option>
                        <option value="avg">Média (X̄)</option>
                        <option value="count">Contagem (#)</option>
                        <option value="min">Mínimo (Min)</option>
                        <option value="max">Máximo (Max)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground block">Rótulo Exibido</label>
                      <input className={inputCls} value={(selectedComp as any).labelText || ''} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { labelText: e.target.value })} placeholder="Ex: Total: " />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Formato</label>
                        <select className={inputCls} value={(selectedComp as any).format || 'currency'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { format: e.target.value })}>
                          <option value="currency">Moeda (R$)</option>
                          <option value="number">Número</option>
                          <option value="percent">Percentual (%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Tamanho Fonte</label>
                        <input type="number" className={inputCls} value={s.fontSize || 9} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { style: { ...s, fontSize: parseInt(e.target.value) || 9 } })} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedComp.type === 'line' && (
                  <div className="space-y-2 pt-2 border-t border-border text-xs">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Orientação</label>
                      <select className={inputCls} value={(selectedComp as any).orientation || 'horizontal'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { orientation: e.target.value })}>
                        <option value="horizontal">Horizontal</option>
                        <option value="vertical">Vertical</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Espessura (px)</label>
                      <input type="number" className={inputCls} value={(selectedComp as any).thickness || 1} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { thickness: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Cor</label>
                      <input type="color" className="w-full h-6 border rounded" value={(selectedComp as any).color || '#1a1a1a'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { color: e.target.value })} />
                    </div>
                  </div>
                )}

                {selectedComp.type === 'box' && (
                  <div className="space-y-2 pt-2 border-t border-border text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Cor da Borda</label>
                        <input type="color" className="w-full h-6 border rounded" value={(selectedComp as any).borderColor || '#cccccc'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { borderColor: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Cor de Fundo</label>
                        <input type="color" className="w-full h-6 border rounded" value={(selectedComp as any).bgColor === 'transparent' ? '#ffffff' : ((selectedComp as any).bgColor || '#ffffff')} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { bgColor: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Espessura Borda</label>
                        <input type="number" className={inputCls} value={(selectedComp as any).borderThickness || 1} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { borderThickness: parseInt(e.target.value) || 1 })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block">Arredondamento</label>
                        <input type="number" className={inputCls} value={(selectedComp as any).borderRadius || 0} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { borderRadius: parseInt(e.target.value) || 0 })} />
                      </div>
                    </div>
                  </div>
                )}

                {selectedComp.type === 'image' && (
                  <div className="space-y-2 pt-2 border-t border-border text-xs">
                    <div>
                      <label className="text-[10px] text-muted-foreground block">URL da Imagem</label>
                      <input className={inputCls} value={(selectedComp as any).src || ''} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { src: e.target.value })} placeholder="https://..." />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground block">Ajuste da Imagem</label>
                      <select className={inputCls} value={(selectedComp as any).fit || 'contain'} onChange={e => patchCompInBand(selectedBand, selectedComp!.id, { fit: e.target.value })}>
                        <option value="contain">Conter (Proporcional)</option>
                        <option value="cover">Cobrir</option>
                        <option value="fill">Esticar</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })() : draft.tipoLayout !== 'custom' && activeSubBand === 'detail' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <p className="text-xs font-semibold">Colunas da Tabela</p>
                  <p className="text-[10px] text-muted-foreground">Ordem das colunas SQL.</p>
                </div>
                <button onClick={handleDetectCols} disabled={detecting}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] rounded border border-border hover:bg-secondary disabled:opacity-50 font-semibold">
                  {detecting ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  Detectar
                </button>
              </div>

              {draft.columns.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <Table2 className="w-6 h-6 mx-auto mb-1 opacity-30" />
                  <p className="text-xs">Nenhuma coluna</p>
                  <p className="text-[10px] mt-0.5">Clique em "Detectar" após informar a Query SQL.</p>
                </div>
              )}

              {draft.columns.length > 0 && (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
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
                      className={`p-2 rounded border transition-colors space-y-1.5 ${
                        colDragOver === i ? 'border-primary bg-primary/5' : 'border-border bg-secondary/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 cursor-grab text-muted-foreground text-xs">
                          <GripVertical size={12} />
                          <span className="font-mono text-primary font-bold truncate max-w-[180px]" title={col.field}>{col.field}</span>
                        </span>
                        <button onClick={() => removeCol(i)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div>
                          <label className="text-[9px] text-muted-foreground block">Rótulo</label>
                          <input className={inputCls} value={col.label} onChange={e => updateCol(i, { label: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted-foreground block">Largura (mm)</label>
                          <input type="number" className={inputCls} value={col.w} min={5} max={210} onChange={e => updateCol(i, { w: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 border border-border rounded-lg bg-muted/20 p-4 flex flex-col items-center justify-center text-center text-muted-foreground space-y-2 border-dashed">
              <Move className="w-8 h-8 opacity-30 text-primary mb-1" />
              <p className="text-xs font-semibold text-foreground">Nenhum componente selecionado</p>
              <p className="text-[11px]">Clique em qualquer elemento do canvas à direita para editar posições X/Y/W/H, fontes, cores e propriedades.</p>
              <p className="text-[10px] text-muted-foreground/70 font-mono">Dica: Use as teclas de seta (↑ ↓ ← →) para movimentar (Shift = 0.1mm)</p>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: ÁREA DE SCROLL DO CANVAS (Folha Papel com Altura Total) */}
        <div className="flex-1 min-h-0 flex justify-center bg-gray-100/80 p-2 rounded-lg border border-border overflow-auto">
          <div
            className="shadow-2xl border border-gray-300 bg-white rounded overflow-hidden select-none my-1"
            style={{ width: canvasPx(CANVAS_W_MM) }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedCompId(null);
            }}
          >
            <div className="bg-gray-200 text-[9px] text-gray-500 px-2 py-0.5 flex justify-between font-mono select-none border-b border-gray-300">
              <span>0mm</span>
              <span>{Math.round(CANVAS_W_MM / 2)}mm</span>
              <span>{CANVAS_W_MM}mm</span>
            </div>

            {/* Sub-Cabeçalho */}
            <div className={`relative border-b border-dashed transition-all ${activeSubBand === 'header' ? 'border-indigo-400 bg-indigo-50/10' : 'border-gray-200'}`}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-[10px] select-none ${
                  activeSubBand === 'header' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveSubBand('header')}
              >
                <span className="font-bold flex items-center gap-1"><PanelTop size={12} /> Sub-Cabeçalho</span>
                <span className="ml-auto opacity-70">{draft.headerHeight || 15}mm</span>
                <div className="flex items-center gap-2 ml-3" onClick={e => e.stopPropagation()}>
                  <label className="flex items-center gap-1 cursor-pointer text-[9px]">
                    <input
                      type="radio"
                      name="cabModeSheet"
                      checked={!!(draft.headerComponents && draft.headerComponents.length > 0) || !draft.showTitleBar}
                      onChange={() => {
                        if (!draft.headerComponents || draft.headerComponents.length === 0) {
                          onPatch({ headerComponents: [], headerHeight: 15 });
                        }
                      }}
                    />
                    <span>Elementos Livres</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-[9px]">
                    <input
                      type="radio"
                      name="cabModeSheet"
                      checked={draft.showTitleBar && (!draft.headerComponents || draft.headerComponents.length === 0)}
                      onChange={() => onPatch({ showTitleBar: true, headerComponents: [] })}
                    />
                    <span>Título Simples</span>
                  </label>
                </div>
              </div>

              <div
                className="relative bg-white"
                style={{ width: canvasPx(CANVAS_W_MM), height: canvasPx(draft.headerHeight || 15), overflow: 'hidden' }}
                onClick={() => setActiveSubBand('header')}
              >
                {(draft.headerComponents && draft.headerComponents.length > 0) || (!draft.showTitleBar) ? (
                  headerComps.map((c, idx) => {
                    const isSel = selectedCompId === c.id;
                    return (
                      <div
                        key={c.id}
                        style={{
                          position: 'absolute',
                          left: canvasPx(c.x), top: canvasPx(c.y),
                          width: canvasPx(c.w), height: canvasPx(c.h),
                          boxSizing: 'border-box',
                          outline: isSel ? '2px solid #2563eb' : '1px dashed #94a3b8',
                          background: isSel ? 'rgba(37,99,235,0.08)' : 'rgba(248,250,252,0.9)',
                          cursor: 'move',
                          zIndex: isSel ? 20 : idx + 1,
                          overflow: 'hidden',
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          setActiveSubBand('header');
                          setSelectedCompId(c.id);
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          setActiveSubBand('header');
                          setSelectedCompId(c.id);
                          dragRef.current = {
                            active: true, compId: c.id, band: 'header',
                            startMouseX: e.clientX, startMouseY: e.clientY,
                            startCompX: c.x, startCompY: c.y, mode: 'move',
                          };
                        }}
                      >
                        <span style={{ fontSize: 9, color: '#1e293b', padding: '1px 3px', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600 }}>
                          {c.type === 'text' ? ((c as any).content || 'Texto') : c.type === 'line' ? '─ linha' : c.type === 'box' ? '□ retângulo' : '🖼 imagem'}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-start justify-center h-full px-3 bg-slate-50 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800">{draft.titleText || 'Título do Sub-Relatório'}</span>
                    {draft.headerSubtitle && <span className="text-[10px] text-slate-500">{draft.headerSubtitle}</span>}
                  </div>
                )}
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-indigo-500/40 transition-colors"
                onMouseDown={e => handleStartResizeBand('header', draft.headerHeight || 15, e)}
                title="Arraste para ajustar a altura do cabeçalho"
              />
            </div>

            {/* Sub-Corpo / Detalhe */}
            <div className={`relative border-b border-dashed transition-all ${activeSubBand === 'detail' ? 'border-emerald-400 bg-emerald-50/10' : 'border-gray-200'}`}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-[10px] select-none ${
                  activeSubBand === 'detail' ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveSubBand('detail')}
              >
                <span className="font-bold flex items-center gap-1"><Table2 size={12} /> Sub-Corpo / Detalhe</span>
                <span className="ml-auto opacity-70">{draft.rowHeight || 15}mm</span>
                <select
                  className="ml-3 bg-white border border-gray-300 rounded text-[9px] px-1 font-semibold"
                  value={draft.tipoLayout || 'tabela'}
                  onChange={e => onPatch({ tipoLayout: e.target.value as any })}
                  onClick={e => e.stopPropagation()}
                >
                  <option value="tabela">Tabela (Grade de Colunas)</option>
                  <option value="custom">Layout Customizado</option>
                </select>
              </div>

              <div
                className="relative bg-white"
                style={{ width: canvasPx(CANVAS_W_MM), height: canvasPx(draft.rowHeight || 15), overflow: 'hidden' }}
                onClick={() => setActiveSubBand('detail')}
              >
                {draft.tipoLayout !== 'custom' ? (
                  <div className="flex flex-col h-full bg-slate-50/60 border-b border-slate-200">
                    <div className="flex items-center bg-slate-100 border-b border-slate-300 text-[9px] font-bold text-slate-700 overflow-hidden">
                      {draft.columns.map((col, i) => (
                        <div key={i} style={{ width: canvasPx(col.w), padding: '2px 4px', borderRight: '1px solid #cbd5e1' }} className="truncate">
                          {col.label || col.field}
                        </div>
                      ))}
                      {draft.columns.length === 0 && <span className="p-2 text-amber-600 italic">Nenhuma coluna configurada</span>}
                    </div>
                    <div className="flex items-center text-[9px] text-slate-500 overflow-hidden opacity-60">
                      {draft.columns.map((col, i) => (
                        <div key={i} style={{ width: canvasPx(col.w), padding: '2px 4px', borderRight: '1px solid #e2e8f0' }} className="truncate">
                          {`{${col.field}}`}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  detailComps.map((c, idx) => {
                    const isSel = selectedCompId === c.id;
                    return (
                      <div
                        key={c.id}
                        style={{
                          position: 'absolute',
                          left: canvasPx(c.x), top: canvasPx(c.y),
                          width: canvasPx(c.w), height: canvasPx(c.h),
                          boxSizing: 'border-box',
                          outline: isSel ? '2px solid #2563eb' : '1px dashed #94a3b8',
                          background: isSel ? 'rgba(37,99,235,0.08)' : 'rgba(248,250,252,0.9)',
                          cursor: 'move',
                          zIndex: isSel ? 20 : idx + 1,
                          overflow: 'hidden',
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          setActiveSubBand('detail');
                          setSelectedCompId(c.id);
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          setActiveSubBand('detail');
                          setSelectedCompId(c.id);
                          dragRef.current = {
                            active: true, compId: c.id, band: 'detail',
                            startMouseX: e.clientX, startMouseY: e.clientY,
                            startCompX: c.x, startCompY: c.y, mode: 'move',
                          };
                        }}
                      >
                        <span style={{ fontSize: 9, color: '#1e293b', padding: '1px 3px', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600 }}>
                          {c.type === 'text' ? ((c as any).content || 'Texto') : c.type === 'line' ? '─ linha' : c.type === 'box' ? '□ retângulo' : '🖼 imagem'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-emerald-500/40 transition-colors"
                onMouseDown={e => handleStartResizeBand('detail', draft.rowHeight || 15, e)}
                title="Arraste para ajustar a altura da linha de detalhe"
              />
            </div>

            {/* Sub-Rodapé */}
            <div className={`relative transition-all ${activeSubBand === 'footer' ? 'bg-purple-50/10' : ''}`}>
              <div
                className={`flex items-center gap-1 px-2 py-0.5 cursor-pointer text-[10px] select-none ${
                  activeSubBand === 'footer' ? 'bg-purple-100 text-purple-700 font-bold' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveSubBand('footer')}
              >
                <span className="font-bold flex items-center gap-1"><PanelBottom size={12} /> Sub-Rodapé</span>
                <span className="ml-auto opacity-70">{draft.footerHeight || 15}mm</span>
              </div>

              <div
                className="relative bg-white"
                style={{ width: canvasPx(CANVAS_W_MM), height: canvasPx(draft.footerHeight || 15), overflow: 'hidden' }}
                onClick={() => setActiveSubBand('footer')}
              >
                {footerComps.map((c, idx) => {
                  const isSel = selectedCompId === c.id;
                  return (
                    <div
                      key={c.id}
                      style={{
                        position: 'absolute',
                        left: canvasPx(c.x), top: canvasPx(c.y),
                        width: canvasPx(c.w), height: canvasPx(c.h),
                        boxSizing: 'border-box',
                        outline: isSel ? '2px solid #2563eb' : '1px dashed #94a3b8',
                        background: isSel ? 'rgba(37,99,235,0.08)' : 'rgba(248,250,252,0.9)',
                        cursor: 'move',
                        zIndex: isSel ? 20 : idx + 1,
                        overflow: 'hidden',
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setActiveSubBand('footer');
                        setSelectedCompId(c.id);
                      }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        setActiveSubBand('footer');
                        setSelectedCompId(c.id);
                        dragRef.current = {
                          active: true, compId: c.id, band: 'footer',
                          startMouseX: e.clientX, startMouseY: e.clientY,
                          startCompX: c.x, startCompY: c.y, mode: 'move',
                        };
                      }}
                    >
                      <span style={{ fontSize: 9, color: '#1e293b', padding: '1px 3px', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 600 }}>
                        {c.type === 'text' ? ((c as any).content || 'Texto') : c.type === 'totalizer' ? `Σ ${(c as any).labelText || ''} ${(c as any).field || ''}` : c.type === 'line' ? '─ linha' : c.type === 'box' ? '□ retângulo' : '🖼 imagem'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-purple-500/40 transition-colors"
                onMouseDown={e => handleStartResizeBand('footer', draft.footerHeight || 15, e)}
                title="Arraste para ajustar a altura do rodapé"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const RpbSubreportConfig: React.FC<Props> = ({ comp, parentColumns, onChange, onClose }) => {
  const [draft, setDraft]       = useState<RpbSubreportComp>({ ...comp, links: [...comp.links], columns: [...comp.columns] });
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [detecting, setDetecting] = useState(false);

  const colDragRef = useRef<{ fromIndex: number } | null>(null);
  const [colDragOver, setColDragOver] = useState<number | null>(null);

  const patch = (p: Partial<RpbSubreportComp>) => setDraft(prev => ({ ...prev, ...p }));

  const handleDetectCols = useCallback(async () => {
    if (!draft.query_sql.trim()) { toast.warning('Digite o SQL antes de detectar as colunas.'); return; }
    setDetecting(true);
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
  }, [draft.query_sql]);

  const addLink = () => patch({ links: [...draft.links, { parentField: parentColumns[0] || '', childParam: '' }] });
  const removeLink = (i: number) => patch({ links: draft.links.filter((_, idx) => idx !== i) });
  const updateLink = (i: number, p: Partial<RpbSubreportLink>) =>
    patch({ links: draft.links.map((l, idx) => idx === i ? { ...l, ...p } : l) });

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

  const handleSave = () => { onChange(draft); onClose(); };

  const childColsList = draft.columns.map(c => c.field);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'geral',      label: 'Geral',      icon: <Settings2 size={13} />   },
    { key: 'formatacao', label: 'Formatação por Bandas (Canvas)', icon: <PanelTop size={13} />    },
    { key: 'sql',        label: 'SQL',        icon: <LayoutList size={13} />  },
    { key: 'links',      label: 'Vínculos',   icon: <Link2 size={13} />       },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-1" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200"
        style={{ width: '1290px', maxWidth: '98vw', height: '95vh', maxHeight: '97vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <LayoutList className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold">Configurar Sub-Relatório</h2>
            <span className="text-xs text-muted-foreground bg-secondary rounded px-2 py-0.5">{draft.label || 'sem nome'}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-3.5 pt-2 pb-0 flex-shrink-0 border-b border-border">
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
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-3">
          {activeTab === 'geral' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Rótulo interno (no designer)</label>
                  <input className={inputCls} value={draft.label} onChange={e => patch({ label: e.target.value })} placeholder="Ex: Pagamentos do Pedido" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Título exibido no relatório</label>
                  <input className={inputCls} value={draft.titleText} onChange={e => patch({ titleText: e.target.value })} placeholder="Ex: Formas de Pagamento" />
                </div>
              </div>
              <div className="border-t border-border pt-3 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Tipo de Layout do Corpo</label>
                  <select
                    className={inputCls}
                    value={draft.tipoLayout || 'tabela'}
                    onChange={e => patch({ tipoLayout: e.target.value as any })}
                  >
                    <option value="tabela">Tabela (Grade de Colunas)</option>
                    <option value="custom">Customizado (Elementos Livres por Registro)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">🔒 Filtro Automático de Empresa</label>
                  <select
                    className={inputCls}
                    value={draft.filtroEmpresaMode || 'herdar'}
                    onChange={e => patch({ filtroEmpresaMode: e.target.value as any })}
                  >
                    <option value="herdar">Herdar do Relatório Principal (Padrão)</option>
                    <option value="nenhum">Nenhum (Sem filtro automático)</option>
                    <option value="empresa">Empresa Logada (empresa_id = &#123;sys_empresa_id&#125;)</option>
                    <option value="matriz">Matriz da Empresa (empresa_id = &#123;sys_matriz_id&#125;)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ── Aba Formatação por Bandas (Folha Única Canvas) ─────────────────────── */}
          {activeTab === 'formatacao' && (
            <UnifiedSubreportSheetCanvas
              draft={draft}
              onPatch={patch}
              childColumns={childColsList}
              parentColumns={parentColumns}
              handleDetectCols={handleDetectCols}
              detecting={detecting}
              colDragRef={colDragRef}
              colDragOver={colDragOver}
              setColDragOver={setColDragOver}
              reorderCol={reorderCol}
              updateCol={updateCol}
              removeCol={removeCol}
            />
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
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 disabled:opacity-50 font-semibold"
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
                <button onClick={addLink} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                  <Plus size={13} /> Adicionar Vínculo
                </button>
              </div>

              {draft.links.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-border rounded-lg text-muted-foreground">
                  <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum vínculo configurado</p>
                  <p className="text-xs mt-1">O sub-relatório será executado sem parâmetros do pai</p>
                  <button onClick={addLink} className="mt-3 text-xs text-primary hover:underline font-semibold">+ Adicionar primeiro vínculo</button>
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
                        className={inputCls}
                      >
                        <option value="">— Selecione —</option>
                        {parentColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase block mb-1">
                        Parâmetro no SQL Filho
                      </label>
                      <input
                        className={inputCls}
                        value={link.childParam}
                        onChange={e => updateLink(i, { childParam: e.target.value })}
                        placeholder="pedido_id"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeLink(i)} title="Remover vínculo" className="mt-5 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
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
              className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
              Salvar Configuração
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpbSubreportConfig;
