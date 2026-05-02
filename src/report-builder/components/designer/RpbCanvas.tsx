// ============================================================
// Report Builder Pro — Canvas das Bandas (área central)
// ============================================================
import React, { useRef, useCallback } from 'react';
import type {
  RpbLayout, RpbBandName, RpbComponent, RpbBand,
} from '../../types';
import {
  BAND_ORDER, BAND_LABELS, pxToMm, DEFAULT_STYLE,
} from '../../types';

const SCALE = 3.2; // px por mm (canvas display scale)
const mm = (v: number) => v * SCALE;

interface Props {
  layout: RpbLayout;
  activeBand: RpbBandName | null;
  selectedIds: string[];
  onChange: (layout: RpbLayout) => void;
  onSelectBand: (band: RpbBandName) => void;
  /** id do componente, nome da banda, multi-seleção (Ctrl) */
  onSelectComponent: (id: string, bandName: RpbBandName, multi: boolean) => void;
  onClearSelection: () => void;
}

// ── Renderiza um componente dentro da banda ──────────────────
const CompItem: React.FC<{
  comp: RpbComponent;
  selected: boolean;
  isRef: boolean;       // true = primeiro selecionado (referência de alinhamento)
  onSelect: (multi: boolean) => void;
  onMove: (dx: number, dy: number) => void;
}> = ({ comp, selected, isRef, onSelect, onMove }) => {
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const moved    = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    dragging.current = true;
    moved.current    = false;
    startPos.current = { x: e.clientX, y: e.clientY };

    const onUp = (ev: MouseEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const dx = pxToMm((ev.clientX - startPos.current.x));
      const dy = pxToMm((ev.clientY - startPos.current.y));
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
        onMove(dx, dy);
        moved.current = true;
      }
      if (!moved.current) onSelect(ev.ctrlKey || ev.metaKey);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mouseup', onUp);
  }, [onSelect, onMove]);

  // Cor de destaque: ref = dourado, selected = primário, default = tracejado
  const outlineColor = isRef ? '#f59e0b' : selected ? '#6366f1' : 'rgba(99,102,241,0.3)';
  const outlineWidth = isRef || selected ? '2px' : '1px';
  const outlineStyle = isRef ? 'solid' : selected ? 'solid' : 'dashed';

  const style: React.CSSProperties = {
    position: 'absolute',
    left: mm(comp.x),
    top:  mm(comp.y),
    width: mm(comp.w),
    height: (comp.type === 'line' && (comp as any).orientation !== 'vertical') ? 'auto' : mm(comp.h),
    cursor: 'move',
    boxSizing: 'border-box',
    outline: `${outlineWidth} ${outlineStyle} ${outlineColor}`,
    userSelect: 'none',
    overflow: 'hidden',
    zIndex: selected ? 10 : 1,
  };

  // Badge de referência (1º selecionado)
  const refBadge = isRef ? (
    <div style={{
      position: 'absolute', top: -1, left: -1,
      background: '#f59e0b', color: '#fff',
      fontSize: '7px', fontWeight: 'bold',
      padding: '0 3px', lineHeight: '12px',
      borderRadius: '0 0 4px 0',
      zIndex: 20, pointerEvents: 'none',
    }}>1º</div>
  ) : null;

  let inner: React.ReactNode;
  const s = (comp as any).style;

  if (comp.type === 'text') {
    inner = (
      <div style={{
        fontSize: s?.fontSize ? `${s.fontSize}pt` : '9pt',
        fontWeight: s?.bold ? 'bold' : 'normal',
        fontStyle: s?.italic ? 'italic' : 'normal',
        color: s?.color || '#1a1a1a',
        textAlign: s?.align || 'left',
        backgroundColor: s?.bgColor !== 'transparent' ? s?.bgColor : undefined,
        padding: `${s?.padding || 2}px`,
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center',
        whiteSpace: 'nowrap', overflow: 'hidden',
      }}>
        {(comp as any).content || <span className="text-muted-foreground text-xs italic">Texto</span>}
      </div>
    );
  } else if (comp.type === 'table') {
    inner = (
      <div className="flex items-center justify-center w-full h-full bg-blue-50/60 border border-blue-200 rounded text-xs text-blue-700 font-medium gap-1">
        <span>⊞</span> Tabela ({(comp as any).columns?.length || 0} colunas)
      </div>
    );
  } else if (comp.type === 'totalizer') {
    inner = (
      <div className="flex items-center w-full h-full px-1 gap-1 text-xs font-bold"
        style={{ color: s?.color || '#1a1a1a', fontSize: `${s?.fontSize || 9}pt` }}>
        <span className="text-muted-foreground">{(comp as any).labelText || 'Total'}</span>
        <span className="text-primary">Σ {(comp as any).field || '—'}</span>
      </div>
    );
  } else if (comp.type === 'image') {
    inner = (
      <div className="flex items-center justify-center w-full h-full bg-amber-50/60 border border-amber-200 rounded text-xs text-amber-700">
        🖼 {(comp as any).src?.includes('{') ? (comp as any).src : 'Imagem'}
      </div>
    );
  } else if (comp.type === 'line') {
    const lc = comp as any;
    if (lc.orientation === 'vertical') {
      style.width  = mm(lc.thickness || 1);
      style.height = mm(comp.h);
      inner = <div style={{ width: '100%', height: '100%', backgroundColor: lc.color || '#333' }} />;
    } else {
      inner = <hr style={{ border: 'none', borderTop: `${lc.thickness || 1}px solid ${lc.color || '#333'}`, margin: 0 }} />;
      style.height = 'auto';
    }
  } else if (comp.type === 'box') {
    const bc = comp as any;
    inner = (
      <div style={{
        width: '100%', height: '100%',
        border: `${bc.borderThickness || 1}px solid ${bc.borderColor || '#ccc'}`,
        backgroundColor: bc.bgColor !== 'transparent' ? bc.bgColor : undefined,
        borderRadius: bc.borderRadius ? `${bc.borderRadius}px` : undefined,
        boxSizing: 'border-box',
      }} />
    );
  }

  return (
    <div style={style} onMouseDown={onMouseDown}>
      {refBadge}
      {inner}
    </div>
  );
};

// ── Componente de banda ──────────────────────────────────────
const BandRow: React.FC<{
  name: RpbBandName;
  band: RpbBand;
  active: boolean;
  selectedIds: string[];
  refId: string | null;    // id do primeiro selecionado (badge amarelo)
  pageW: number;
  onActivate: () => void;
  onSelectComp: (id: string, bandName: RpbBandName, multi: boolean) => void;
  onClearSelection: () => void;
  onMoveComp: (id: string, dx: number, dy: number) => void;
  onResizeBand: (newH: number) => void;
}> = ({ name, band, active, selectedIds, refId, pageW, onActivate, onSelectComp, onClearSelection, onMoveComp, onResizeBand }) => {
  const resizing = useRef(false);
  const startY  = useRef(0);
  const startH  = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    resizing.current = true;
    startY.current = e.clientY;
    startH.current = band.height;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const dy = pxToMm(ev.clientY - startY.current);
      onResizeBand(Math.max(5, startH.current + dy));
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [band.height, onResizeBand]);

  const visible = band.visible && band.height > 0;

  // Conta quantos componentes desta banda estão selecionados
  const selCount = band.components.filter(c => selectedIds.includes(c.id)).length;

  return (
    <div className={`relative border-b border-dashed ${active ? 'border-primary/60' : 'border-border/40'}`}>
      {/* Band label */}
      <div
        className={`
          flex items-center gap-1 px-2 py-0.5 cursor-pointer text-[10px]
          ${active ? 'bg-primary/10 text-primary' : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'}
        `}
        onClick={onActivate}
      >
        <span className="font-semibold">{BAND_LABELS[name]}</span>
        <span className="ml-auto opacity-60">{band.height}mm</span>
        {!visible && <span className="text-[9px] opacity-50">(oculta)</span>}
        {selCount > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[9px] font-bold">
            {selCount}
          </span>
        )}
      </div>

      {/* Band canvas */}
      {visible && (
        <div
          className="relative bg-white"
          style={{ width: mm(pageW), height: mm(band.height), overflow: 'hidden' }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              onActivate();
              onClearSelection();
            }
          }}
        >
          {band.components.map(comp => (
            <CompItem
              key={comp.id}
              comp={comp}
              selected={selectedIds.includes(comp.id)}
              isRef={refId === comp.id}
              onSelect={(multi) => onSelectComp(comp.id, name, multi)}
              onMove={(dx, dy) => onMoveComp(comp.id, dx, dy)}
            />
          ))}
        </div>
      )}

      {/* Resize handle */}
      {visible && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/30 transition-colors"
          onMouseDown={onResizeStart}
          title="Arraste para redimensionar a banda"
        />
      )}
    </div>
  );
};

// ── Canvas principal ─────────────────────────────────────────
const RpbCanvas: React.FC<Props> = ({
  layout, activeBand, selectedIds, onChange, onSelectBand, onSelectComponent, onClearSelection,
}) => {
  const { pageSize, orientation, margins } = layout;

  const sizes: Record<string, { w: number; h: number }> = {
    A4: { w: 210, h: 297 }, A3: { w: 297, h: 420 }, Letter: { w: 216, h: 279 },
  };
  const ps = sizes[pageSize] || sizes['A4'];
  const pageW = orientation === 'portrait' ? ps.w - margins.left - margins.right
    : ps.h - margins.left - margins.right;

  const updateBand = (name: RpbBandName, patch: Partial<RpbBand>) => {
    onChange({
      ...layout,
      bands: { ...layout.bands, [name]: { ...layout.bands[name], ...patch } },
    });
  };

  const handleMoveComp = (bandName: RpbBandName, id: string, dx: number, dy: number) => {
    const band = layout.bands[bandName];
    const comps = band.components.map(c =>
      c.id === id ? { ...c, x: Math.max(0, c.x + dx), y: Math.max(0, c.y + dy) } : c
    );
    updateBand(bandName, { components: comps });
  };

  // id do primeiro selecionado (referência de alinhamento) — para mostrar badge amarelo
  const refId = selectedIds.length > 0 ? selectedIds[0] : null;

  const visibleBands = BAND_ORDER.filter(name => {
    const band = layout.bands[name];
    if (name === 'group1Header' || name === 'group1Footer') return layout.groups.some(g => g.level === 1);
    if (name === 'group2Header' || name === 'group2Footer') return layout.groups.some(g => g.level === 2);
    return true;
  });

  return (
    <div className="flex-1 overflow-auto bg-gray-100 p-6 flex justify-center">
      <div
        className="shadow-2xl border border-gray-300 bg-white"
        style={{ width: mm(pageW + margins.left + margins.right) }}
      >
        {/* Régua superior */}
        <div className="bg-gray-200 text-[9px] text-gray-500 px-2 py-0.5 flex justify-between">
          <span>0mm</span>
          <span>{Math.round(pageW / 2)}mm</span>
          <span>{pageW}mm</span>
        </div>

        {/* Bandas */}
        <div style={{ paddingLeft: mm(margins.left), paddingRight: mm(margins.right) }}>
          {visibleBands.map(name => (
            <BandRow
              key={name}
              name={name}
              band={layout.bands[name]}
              active={activeBand === name}
              selectedIds={selectedIds}       // passa TODOS os ids (cross-band)
              refId={refId}
              pageW={pageW}
              onActivate={() => onSelectBand(name)}
              onSelectComp={onSelectComponent}
              onClearSelection={onClearSelection}
              onMoveComp={(id, dx, dy) => handleMoveComp(name, id, dx, dy)}
              onResizeBand={newH => updateBand(name, { height: newH })}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RpbCanvas;
