import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ArrowUp, ArrowDown, Download, FileText, FileSpreadsheet, File } from "lucide-react";

export interface IGridColumn {
  key: string;
  label: React.ReactNode;
  exportLabel?: string; // Usado para exportação de texto/excel
  width?: string;
  align?: "left" | "right" | "center";
  render?: (row: any, idx?: number) => React.ReactNode;
  getValue?: (row: any) => string | number;
}

interface ISortItem {
  key: string;
  dir: "asc" | "desc";
}

interface DataGridProps {
  columns: IGridColumn[];
  data: any[];
  loading?: boolean;
  isLoading?: boolean;
  onRowClick?: (row: any, idx: number) => void;
  onRowDoubleClick?: (row: any, idx: number) => void;
  selectedIdx?: number | null;
  showFilters?: boolean;
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  maxHeight?: string;
  exportTitle?: string;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  showRecordCount?: boolean;
  showExport?: boolean;
  headerClassName?: string;
}

// --- Sorting logic ---
function applySorting<T>(data: T[], sorts: ISortItem[], columns: IGridColumn[]): T[] {
  if (sorts.length === 0) return data;
  return [...data].sort((a, b) => {
    for (const s of sorts) {
      const col = columns.find(c => c.key === s.key);
      const va = col?.getValue ? col.getValue(a) : (a as any)[s.key];
      const vb = col?.getValue ? col.getValue(b) : (b as any)[s.key];
      let cmp = 0;
      if (typeof va === "number" && typeof vb === "number") {
        cmp = va - vb;
      } else {
        cmp = String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { sensitivity: "base" });
      }
      if (cmp !== 0) return s.dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

// --- Export helpers ---
function exportAsText(columns: IGridColumn[], data: any[], title: string) {
  const visibleCols = columns;
  const widths = visibleCols.map(c => {
    const labelStr = c.exportLabel || (typeof c.label === "string" ? c.label : "");
    return Math.max(labelStr.length, ...data.map(r => String(c.getValue ? c.getValue(r) : (r as any)[c.key] ?? "").length));
  });
  const header = visibleCols.map((c, i) => {
    const labelStr = c.exportLabel || (typeof c.label === "string" ? c.label : "");
    return labelStr.padEnd(widths[i]);
  }).join(" | ");
  const sep = widths.map(w => "-".repeat(w)).join("-+-");
  const rows = data.map(r => visibleCols.map((c, i) => String(c.getValue ? c.getValue(r) : (r as any)[c.key] ?? "").padEnd(widths[i])).join(" | "));
  const text = [title, "", header, sep, ...rows, "", `Total: ${data.length} registro(s)`].join("\n");
  downloadFile(text, `${title}.txt`, "text/plain");
}

function exportAsCsv(columns: IGridColumn[], data: any[], title: string) {
  const visibleCols = columns;
  const header = visibleCols.map(c => `"${c.exportLabel || (typeof c.label === "string" ? c.label : "")}"`).join(";");
  const rows = data.map(r => visibleCols.map(c => `"${String(c.getValue ? c.getValue(r) : (r as any)[c.key] ?? "")}"`).join(";"));
  const csv = [header, ...rows].join("\n");
  // BOM for Excel to detect UTF-8
  downloadFile("\uFEFF" + csv, `${title}.csv`, "text/csv;charset=utf-8");
}

function exportAsPdf(columns: IGridColumn[], data: any[], title: string) {
  const visibleCols = columns;
  const w = window.open("", "_blank");
  if (!w) return;
  const html = `<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
    h2{margin-bottom:10px}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #999;padding:4px 8px;text-align:left}
    th{background:#336;color:#fff}
    tr:nth-child(even){background:#f0f0f0}
    .footer{margin-top:8px;font-size:11px;color:#666}
    @media print{button{display:none}}</style></head><body>
    <h2>${title}</h2>
    <table><thead><tr>${visibleCols.map(c => `<th>${c.exportLabel || (typeof c.label === "string" ? c.label : "")}</th>`).join("")}</tr></thead>
    <tbody>${data.map(r => `<tr>${visibleCols.map(c => `<td style="text-align:${c.align || "left"}">${c.getValue ? c.getValue(r) : (r as any)[c.key] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <div class="footer">Total: ${data.length} registro(s)</div>
    <br><button onclick="window.print()">Imprimir / Salvar PDF</button>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- DataGrid Component ---
const DataGrid: React.FC<DataGridProps> = ({
  columns,
  data = [],
  loading = false,
  isLoading = false,
  onRowClick,
  onRowDoubleClick,
  selectedIdx,
  showFilters = false,
  filterValues,
  onFilterChange,
  maxHeight = "300px",
  exportTitle = "Dados",
  toolbarLeft,
  toolbarRight,
  showRecordCount = true,
  showExport = true,
  headerClassName,
}) => {
  const [XSorts, setXSorts] = useState<ISortItem[]>([]);
  const [XHiddenCols, setXHiddenCols] = useState<Set<string>>(new Set());
  const [XContextMenu, setXContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [XShowExport, setXShowExport] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setXContextMenu(null);
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setXShowExport(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const XVisibleCols = useMemo(() => columns.filter(c => !XHiddenCols.has(c.key)), [columns, XHiddenCols]);

  const handleSort = (key: string) => {
    setXSorts(prev => {
      const idx = prev.findIndex(s => s.key === key);
      if (idx === -1) return [...prev, { key, dir: "asc" }];
      if (prev[idx].dir === "asc") return prev.map((s, i) => i === idx ? { ...s, dir: "desc" as const } : s);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const XSortedData = useMemo(() => applySorting(data, XSorts, columns), [data, XSorts, columns]);

  const [XColWidths, setXColWidths] = useState<Record<string, string>>({});
  const headerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const gridTemplate = XVisibleCols.map(c => XColWidths[c.key] || c.width || "1fr").join(" ");

  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const headerEl = headerRefs.current[key];
    if (!headerEl) return;
    
    const initialWidth = headerEl.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(40, initialWidth + deltaX);
      setXColWidths(prev => ({ ...prev, [key]: `${newWidth}px` }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = '';
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setXContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const toggleColumn = (key: string) => {
    setXHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (XVisibleCols.length > 1) next.add(key); // keep at least 1
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (XSortedData.length === 0) return;
    
    let nextIdx = selectedIdx;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedIdx === null || selectedIdx === undefined) {
        nextIdx = 0;
      } else if (selectedIdx < XSortedData.length - 1) {
        nextIdx = selectedIdx + 1;
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (selectedIdx === null || selectedIdx === undefined) {
        nextIdx = XSortedData.length - 1;
      } else if (selectedIdx > 0) {
        nextIdx = selectedIdx - 1;
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIdx !== null && selectedIdx !== undefined && onRowDoubleClick) {
        onRowDoubleClick(XSortedData[selectedIdx], selectedIdx);
      }
      return;
    } else {
      return;
    }

    if (nextIdx !== null && nextIdx !== undefined && nextIdx !== selectedIdx) {
      if (onRowClick) onRowClick(XSortedData[nextIdx], nextIdx);
      requestAnimationFrame(() => {
        document.getElementById(`grid-row-${nextIdx}`)?.scrollIntoView({ block: "nearest" });
      });
    }
  };

  const getSortIcon = (key: string) => {
    const s = XSorts.find(s => s.key === key);
    if (!s) return null;
    const idx = XSorts.indexOf(s);
    return (
      <span className="inline-flex items-center ml-1">
        {s.dir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
        {XSorts.length > 1 && <span className="text-[9px] ml-0.5">{idx + 1}</span>}
      </span>
    );
  };

  return (
    <div className="space-y-1">
      {/* Top bar: Todas as ações alinhadas à esquerda para um visual mais limpo */}
      {(toolbarLeft || toolbarRight || showExport) && (
        <div className="flex items-center justify-start gap-2 pb-1.5 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">{toolbarLeft}</div>
          
          <div className="flex items-center gap-1">
            {toolbarRight}
            
            {showExport && (
              <div className="relative" ref={exportRef}>
                <button
                  onClick={() => setXShowExport(!XShowExport)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-transparent text-slate-600 dark:text-slate-400 hover:bg-accent hover:text-foreground transition-all"
                  title="Exportar"
                >
                  <Download size={14} className="text-sky-600 dark:text-sky-500" /> Exportar
                </button>
                {XShowExport && (
                  <div className="absolute left-0 top-9 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-150">
                    <button
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                      onClick={() => { exportAsPdf(XVisibleCols, XSortedData, exportTitle); setXShowExport(false); }}
                    >
                      <File size={14} className="text-rose-500" /> PDF (Impressão)
                    </button>
                    <button
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                      onClick={() => { exportAsText(XVisibleCols, XSortedData, exportTitle); setXShowExport(false); }}
                    >
                      <FileText size={14} className="text-slate-500" /> Arquivo de Texto
                    </button>
                    <button
                      className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                      onClick={() => { exportAsCsv(XVisibleCols, XSortedData, exportTitle); setXShowExport(false); }}
                    >
                      <FileSpreadsheet size={14} className="text-emerald-600" /> Planilha Excel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div 
        className="border border-border rounded overflow-hidden overflow-x-auto outline-none focus-within:ring-1 focus-within:ring-ring" 
        onContextMenu={handleContextMenu}
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
          handleKeyDown(e);
        }}
      >
        <div className="min-w-[500px] overflow-y-auto" style={{ maxHeight }}>
        {/* Filters */}
        {showFilters && filterValues && onFilterChange && (
          <div className="bg-card border-b border-border sticky top-0 z-20" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
            {XVisibleCols.map(c => (
              <input
                key={c.key}
                type="text"
                placeholder={typeof c.label === "string" ? c.label : ""}
                value={filterValues[c.key] || ""}
                onChange={e => onFilterChange(c.key, e.target.value)}
                className="px-2 py-1 text-xs border-r border-border outline-none last:border-r-0 bg-card min-w-0"
              />
            ))}
          </div>
        )}

        {/* Header */}
        <div
          className={`${headerClassName || "bg-grid-header text-grid-header-foreground text-xs font-semibold"} sticky ${showFilters && filterValues ? 'top-[26px]' : 'top-0'} z-10`}
          style={{ display: "grid", gridTemplateColumns: gridTemplate }}
        >
          {XVisibleCols.map(c => (
            <div
              key={c.key}
              ref={(el) => { headerRefs.current[c.key] = el; }}
              className={`relative px-2 py-1.5 border-r last:border-r-0 cursor-pointer select-none flex items-center min-w-0 truncate ${headerClassName ? 'border-current/10' : 'border-primary-foreground/20'}`}
              style={{ justifyContent: c.align === "right" ? "flex-end" : c.align === "center" ? "center" : "flex-start" }}
              onClick={() => typeof c.label === "string" ? handleSort(c.key) : null}
            >
              <div className="truncate">{c.label}</div>
              {typeof c.label === "string" && getSortIcon(c.key)}
              <div
                className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/50 opacity-0 hover:opacity-100 z-20"
                onMouseDown={(e) => handleResizeStart(e, c.key)}
                onClick={(e) => e.stopPropagation()}
                title="Redimensionar"
              />
            </div>
          ))}
        </div>

        {/* Rows */}
        <div>
          {(loading || isLoading) && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Carregando...
            </div>
          )}
          {!loading && !isLoading && XSortedData.map((row, i) => (
            <div
              key={i}
              id={`grid-row-${i}`}
              className={`text-xs cursor-pointer transition-colors ${
                selectedIdx === i
                  ? "bg-grid-selected text-grid-selected-foreground"
                  : i % 2 === 0
                  ? "bg-card hover:bg-accent"
                  : "bg-grid-stripe hover:bg-accent"
              }`}
              style={{ display: "grid", gridTemplateColumns: gridTemplate }}
              onClick={() => onRowClick?.(row, i)}
              onDoubleClick={() => onRowDoubleClick?.(row, i)}
            >
              {XVisibleCols.map(c => (
                <div
                  key={c.key}
                  className="px-2 py-1.5 border-r border-border last:border-r-0 min-w-0 overflow-hidden"
                  style={{ textAlign: c.align || "left" }}
                >
                  {(() => {
                    try {
                      return c.render ? c.render(row, i) : c.getValue ? c.getValue(row) : (row as any)[c.key];
                    } catch (err) {
                      console.error("Erro ao renderizar célula:", err, c.key, row);
                      return <span className="text-red-500 text-[9px]">Err</span>;
                    }
                  })()}
                </div>
              ))}
            </div>
          ))}
          {!loading && !isLoading && XSortedData.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhum registro encontrado.
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Record count */}
      {showRecordCount && (
        <div className="text-xs text-muted-foreground">
          {XSortedData.length} registro(s)
        </div>
      )}

      {/* Context menu - column visibility */}
      {XContextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[9999] bg-popover border border-border rounded shadow-lg py-1 min-w-[160px]"
          style={{ left: XContextMenu.x, top: XContextMenu.y }}
        >
          <div className="px-3 py-1 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
            Colunas visíveis
          </div>
          {columns.map(c => (
            <button
              key={c.key}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent text-left"
              onClick={() => toggleColumn(c.key)}
            >
              <span className={`w-3 h-3 border rounded-sm flex items-center justify-center ${
                !XHiddenCols.has(c.key) ? "bg-primary border-primary text-primary-foreground" : "border-border"
              }`}>
                {!XHiddenCols.has(c.key) && "✓"}
              </span>
              {typeof c.label === "string" ? c.label : c.exportLabel || c.key}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DataGrid;
