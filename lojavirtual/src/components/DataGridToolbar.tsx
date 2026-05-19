import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download, FileText, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ─── Sorting ──────────────────────────────────────────────────
export type SortDir = 'asc' | 'desc' | null;
export interface SortState { column: string; dir: SortDir }

export function useSorting(initial?: SortState) {
  const [sort, setSort] = useState<SortState>(initial || { column: '', dir: null });

  const toggle = (col: string) => {
    setSort(prev => {
      if (prev.column !== col) return { column: col, dir: 'asc' };
      if (prev.dir === 'asc') return { column: col, dir: 'desc' };
      return { column: '', dir: null };
    });
  };

  const compareFn = <T,>(accessor: (item: T, col: string) => any) => (a: T, b: T): number => {
    if (!sort.column || !sort.dir) return 0;
    const va = accessor(a, sort.column);
    const vb = accessor(b, sort.column);
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { sensitivity: 'base' });
    return sort.dir === 'desc' ? -cmp : cmp;
  };

  return { sort, toggle, compareFn };
}

export function SortableHead({ column, label, sort, onToggle, className = '' }: {
  column: string; label: string; sort: SortState; onToggle: (col: string) => void; className?: string;
}) {
  const active = sort.column === column;
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      onClick={() => onToggle(column)}
      className={`h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors [&:has([role=checkbox])]:pr-0 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-primary' : 'opacity-40'}`} />
      </span>
    </th>
  );
}

// ─── Totals bar ──────────────────────────────────────────────
export function GridTotals({ totalRecords, filteredRecords, label = 'registro' }: {
  totalRecords: number; filteredRecords: number; label?: string;
}) {
  const plural = (n: number) => n !== 1 ? 's' : '';
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground px-1 pt-1">
      <span>Total: <strong className="text-foreground">{totalRecords}</strong> {label}{plural(totalRecords)}</span>
      {filteredRecords !== totalRecords && (
        <span>| Exibindo: <strong className="text-foreground">{filteredRecords}</strong> {label}{plural(filteredRecords)}</span>
      )}
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────
function escapeCsvField(val: any): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadFile(content: string, filename: string, type: string) {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: `${type};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCSV(headers: string[], rows: any[][], filename: string) {
  const csv = [headers.map(escapeCsvField).join(','), ...rows.map(r => r.map(escapeCsvField).join(','))].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToTXT(headers: string[], rows: any[][], filename: string) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length)));
  const pad = (val: any, w: number) => String(val ?? '').padEnd(w);
  const lines = [headers.map((h, i) => pad(h, widths[i])).join(' | '), '-'.repeat(widths.reduce((a, w) => a + w + 3, 0)),
    ...rows.map(r => r.map((v, i) => pad(v, widths[i])).join(' | '))];
  downloadFile(lines.join('\n'), `${filename}.txt`, 'text/plain');
}

export function ExportMenu({ headers, rows, filename }: {
  headers: string[]; rows: any[][]; filename: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="w-4 h-4" /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => exportToCSV(headers, rows, filename)}>
          <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToTXT(headers, rows, filename)}>
          <FileText className="w-4 h-4 mr-2" /> TXT (Texto)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
