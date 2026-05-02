import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Check, Loader2 } from 'lucide-react';
import { rpbExecuteQuery } from '../../services/rpbService';
import DataGrid, { IGridColumn } from '@/components/grid/DataGrid';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (rows: any[]) => void;
  sql: string;
  multi?: boolean;
  valueField: string;
  labelField: string;
  title?: string;
}

const RpbSearchDialog: React.FC<Props> = ({
  open, onClose, onSelect, sql, multi, valueField, labelField, title
}) => {
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<any>>(new Set());

  const load = useCallback(async () => {
    if (!open || !sql) return;
    setLoading(true);
    const { data: rows, error } = await rpbExecuteQuery(sql, {});
    setLoading(false);
    if (!error) {
      setData(rows);
      setFilteredData(rows);
    }
  }, [open, sql]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredData(data);
      return;
    }
    const s = search.toLowerCase();
    const filtered = data.filter(r => 
      Object.values(r).some(v => String(v || '').toLowerCase().includes(s))
    );
    setFilteredData(filtered);
  }, [search, data]);

  if (!open) return null;

  const toggleSelect = (row: any) => {
    const key = row[valueField];
    if (multi) {
      const next = new Set(selectedKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelectedKeys(next);
    } else {
      onSelect([row]);
      onClose();
    }
  };

  const handleConfirm = () => {
    const selectedRows = data.filter(r => selectedKeys.has(r[valueField]));
    onSelect(selectedRows);
    onClose();
  };

  const baseCols: IGridColumn[] = data.length > 0 ? Object.keys(data[0]).map(k => ({
    key: k,
    label: k.toUpperCase(),
    width: k === valueField ? '80px' : '1fr'
  })) : [];

  const cols: IGridColumn[] = multi ? [
    {
      key: '_select',
      label: '',
      width: '40px',
      render: (row: any) => (
        <div className="flex items-center justify-center">
          <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${selectedKeys.has(row[valueField]) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {selectedKeys.has(row[valueField]) && <Check size={12} />}
          </div>
        </div>
      )
    },
    ...baseCols
  ] : baseCols;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/10">
          <div>
            <h3 className="font-bold text-sm">{title || 'Pesquisa'}</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Selecione o(s) registro(s) desejado(s)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 border-b border-border bg-muted/20 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Digite para filtrar os resultados..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          {multi && selectedKeys.size > 0 && (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
            >
              <Check size={18} /> Confirmar ({selectedKeys.size})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Carregando dados...</span>
            </div>
          ) : (
            <DataGrid
              columns={cols}
              data={filteredData}
              maxHeight="100%"
              selectedIdx={null}
              onRowClick={(row) => toggleSelect(row)}
              onRowDoubleClick={(row) => {
                if (!multi) {
                  onSelect([row]);
                  onClose();
                }
              }}
            />
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-secondary/5 flex justify-between items-center">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{filteredData.length} registros encontrados</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 text-xs font-bold uppercase rounded border border-border bg-card hover:bg-accent transition-colors">Cancelar</button>
            {multi && (
              <button 
                onClick={handleConfirm} 
                disabled={selectedKeys.size === 0}
                className="px-6 py-1.5 text-xs font-bold uppercase rounded bg-primary text-primary-foreground shadow-sm disabled:opacity-50 hover:bg-primary/90 transition-all"
              >
                Confirmar Seleção
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RpbSearchDialog;
