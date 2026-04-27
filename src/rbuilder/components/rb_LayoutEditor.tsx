import React from "react";
import type { IRbReportLayout, IRbColumnLayout } from "../models/rb_types";
import { ArrowUp, ArrowDown } from "lucide-react";

interface Props {
  XLayout: IRbReportLayout;
  onChange: (layout: IRbReportLayout) => void;
  XAvailableColumns: string[];
}

const RbLayoutEditor: React.FC<Props> = ({ XLayout, onChange, XAvailableColumns }) => {
  const updateColumn = (idx: number, updates: Partial<IRbColumnLayout>) => {
    const XNewCols = [...XLayout.columns];
    XNewCols[idx] = { ...XNewCols[idx], ...updates };
    onChange({ ...XLayout, columns: XNewCols });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const XNewCols = [...XLayout.columns];
    const XTarget = idx + dir;
    if (XTarget < 0 || XTarget >= XNewCols.length) return;
    [XNewCols[idx], XNewCols[XTarget]] = [XNewCols[XTarget], XNewCols[idx]];
    onChange({ ...XLayout, columns: XNewCols });
  };

  const addMissingColumns = () => {
    const XExisting = new Set(XLayout.columns.map(c => c.key));
    const XNew = XAvailableColumns.filter(k => !XExisting.has(k)).map(k => ({
      key: k, label: k, width: 100, align: "left" as const, format: "text" as const, visible: true, totalType: "none" as const,
    }));
    if (XNew.length > 0) onChange({ ...XLayout, columns: [...XLayout.columns, ...XNew] });
  };

  return (
    <div className="space-y-4">
      {/* Header config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Título</label>
          <input type="text" value={XLayout.title} onChange={e => onChange({ ...XLayout, title: e.target.value })} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Subtítulo</label>
          <input type="text" value={XLayout.subtitle} onChange={e => onChange({ ...XLayout, subtitle: e.target.value })} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={XLayout.showHeader} onChange={e => onChange({ ...XLayout, showHeader: e.target.checked })} /> Header
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={XLayout.showFooter} onChange={e => onChange({ ...XLayout, showFooter: e.target.checked })} /> Footer/Totais
        </label>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-xs text-muted-foreground">Agrupar por:</label>
          <select value={XLayout.groupByField} onChange={e => onChange({ ...XLayout, groupByField: e.target.value })} className="border border-border rounded px-2 py-1 text-sm bg-card">
            <option value="">(Sem agrupamento)</option>
            {XLayout.columns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Columns editor */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Colunas</h4>
        {XAvailableColumns.length > 0 && (
          <button onClick={addMissingColumns} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">
            + Adicionar colunas detectadas
          </button>
        )}
      </div>

      <div className="border border-border rounded overflow-hidden">
        <div className="bg-muted px-2 py-1 grid grid-cols-[40px_1fr_80px_80px_90px_80px_90px_40px] gap-1 text-xs font-semibold text-muted-foreground">
          <span></span><span>Campo / Label</span><span>Largura</span><span>Alinhamento</span><span>Formato</span><span>Visível</span><span>Total</span><span></span>
        </div>
        {XLayout.columns.map((col, idx) => (
          <div key={col.key} className="px-2 py-1 grid grid-cols-[40px_1fr_80px_80px_90px_80px_90px_40px] gap-1 items-center text-xs border-t border-border">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveColumn(idx, -1)} disabled={idx === 0} className="p-0.5 hover:bg-accent rounded disabled:opacity-30"><ArrowUp size={10} /></button>
              <button onClick={() => moveColumn(idx, 1)} disabled={idx === XLayout.columns.length - 1} className="p-0.5 hover:bg-accent rounded disabled:opacity-30"><ArrowDown size={10} /></button>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{col.key}</span>
              <input type="text" value={col.label} onChange={e => updateColumn(idx, { label: e.target.value })} className="border border-border rounded px-1 py-0.5 text-xs bg-card" />
            </div>
            <input type="number" value={col.width} onChange={e => updateColumn(idx, { width: parseInt(e.target.value) || 100 })} className="border border-border rounded px-1 py-0.5 text-xs bg-card w-full" />
            <select value={col.align} onChange={e => updateColumn(idx, { align: e.target.value as any })} className="border border-border rounded px-1 py-0.5 text-xs bg-card w-full">
              <option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option>
            </select>
            <select value={col.format} onChange={e => updateColumn(idx, { format: e.target.value as any })} className="border border-border rounded px-1 py-0.5 text-xs bg-card w-full">
              <option value="text">Texto</option><option value="number">Número</option><option value="date">Data</option><option value="currency">Moeda</option>
            </select>
            <label className="flex items-center justify-center">
              <input type="checkbox" checked={col.visible} onChange={e => updateColumn(idx, { visible: e.target.checked })} />
            </label>
            <select value={col.totalType || "none"} onChange={e => updateColumn(idx, { totalType: e.target.value as any })} className="border border-border rounded px-1 py-0.5 text-xs bg-card w-full">
              <option value="none">-</option><option value="sum">Soma</option><option value="avg">Média</option><option value="count">Contagem</option>
            </select>
            <button onClick={() => {
              const XNewCols = XLayout.columns.filter((_, i) => i !== idx);
              onChange({ ...XLayout, columns: XNewCols });
            }} className="text-destructive hover:bg-destructive/10 rounded p-0.5 text-xs">✕</button>
          </div>
        ))}
        {XLayout.columns.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">Nenhuma coluna configurada. Execute a query para detectar colunas.</div>
        )}
      </div>
    </div>
  );
};

export default RbLayoutEditor;
