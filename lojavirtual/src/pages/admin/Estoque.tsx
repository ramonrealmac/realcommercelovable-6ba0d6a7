import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useSorting, SortableHead, GridTotals, ExportMenu } from '@/components/DataGridToolbar';
import { Warehouse, RefreshCw, Search, Save, AlertTriangle } from 'lucide-react';

const db = supabase as any;

interface ProdutoEstoque {
  id: number; xcd_produto: string; xcd_barra: string | null; xnm_produto: string;
  xqt_estoque_fisico: number; xqt_estoque_reservado: number; xqt_estoque_disponivel: number;
  xqt_estoque_minimo: number; xqt_estoque_padrao: number; xlg_venda_online: boolean;
  xgrupo_produto_id: number | null;
  _edited?: boolean; _original_fisico?: number; _original_reservado?: number;
}

export default function Estoque() {
  const { user } = useAuth();
  const [data, setData] = useState<ProdutoEstoque[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const [filtroBaixo, setFiltroBaixo] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => void } | null>(null);
  const { sort, toggle, compareFn } = useSorting();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: p } = await db.from('produto').select('id, xcd_produto, xcd_barra, xnm_produto, xqt_estoque_fisico, xqt_estoque_reservado, xqt_estoque_disponivel, xqt_estoque_minimo, xqt_estoque_padrao, xlg_venda_online, xgrupo_produto_id')
      .eq('excluido_visivel', false).order('xnm_produto');
    setData((p || []).map((x: any) => ({ ...x, _original_fisico: x.xqt_estoque_fisico, _original_reservado: x.xqt_estoque_reservado })));
    const { data: g } = await db.from('grupo_produto').select('id, xnm_grupo_produto').eq('excluido_visivel', false).order('xnm_grupo_produto');
    setGrupos(g || []); setSelected(new Set()); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (id: number, field: string, value: number) => {
    setData(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value, _edited: true };
      updated.xqt_estoque_disponivel = (updated.xqt_estoque_fisico || 0) - (updated.xqt_estoque_reservado || 0);
      return updated;
    }));
  };

  const accessor = (p: ProdutoEstoque, col: string) => (p as any)[col];
  const filtered = data.filter(p => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!p.xcd_produto.toLowerCase().includes(s) && !p.xnm_produto.toLowerCase().includes(s) && !(p.xcd_barra || '').toLowerCase().includes(s)) return false;
    }
    if (filtroGrupo !== 'TODOS' && String(p.xgrupo_produto_id) !== filtroGrupo) return false;
    if (filtroBaixo && p.xqt_estoque_disponivel >= (p.xqt_estoque_minimo || 0)) return false;
    return true;
  }).sort(compareFn(accessor));

  const toggleSelect = (id: number) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const batchAction = (label: string, fn: (p: ProdutoEstoque) => Partial<ProdutoEstoque>) => {
    setConfirmAction({
      label,
      action: () => {
        setData(prev => prev.map(p => {
          if (!selected.has(p.id)) return p;
          const changes = fn(p);
          const updated = { ...p, ...changes, _edited: true };
          updated.xqt_estoque_disponivel = (updated.xqt_estoque_fisico || 0) - (updated.xqt_estoque_reservado || 0);
          return updated;
        }));
        setConfirmAction(null);
        toast({ title: `Ação "${label}" aplicada a ${selected.size} produto(s)` });
      }
    });
  };

  const saveAll = async () => {
    const edited = data.filter(p => p._edited);
    if (edited.length === 0) { toast({ title: 'Nenhuma alteração' }); return; }
    setSaving(true);
    try {
      for (const p of edited) {
        await db.from('produto').update({ xqt_estoque_fisico: p.xqt_estoque_fisico, xqt_estoque_reservado: p.xqt_estoque_reservado }).eq('id', p.id);
        if (p._original_fisico !== p.xqt_estoque_fisico || p._original_reservado !== p.xqt_estoque_reservado) {
          await db.from('auditoria').insert({
            xtabela: 'produto', xregistro_id: String(p.id), xacao: 'ESTOQUE_MANUTENCAO',
            xdados_anteriores: { fisico: p._original_fisico, reservado: p._original_reservado },
            xdados_novos: { fisico: p.xqt_estoque_fisico, reservado: p.xqt_estoque_reservado },
            xusuario_id: user?.id,
          });
        }
      }
      toast({ title: `${edited.length} produto(s) atualizado(s)` }); load();
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
    setSaving(false);
  };

  const editedCount = data.filter(p => p._edited).length;

  const exportHeaders = ['Código', 'Cód. Barras', 'Produto', 'Físico', 'Reservado', 'Disponível', 'Mínimo'];
  const exportRows = filtered.map(p => [p.xcd_produto, p.xcd_barra || '', p.xnm_produto, p.xqt_estoque_fisico, p.xqt_estoque_reservado, p.xqt_estoque_disponivel, p.xqt_estoque_minimo]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Manutenção de Estoque</h1>
        </div>
        <div className="flex items-center gap-2">
          {editedCount > 0 && <Badge variant="secondary">{editedCount} alterado(s)</Badge>}
          <ExportMenu headers={exportHeaders} rows={exportRows} filename="estoque" />
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={saveAll} disabled={saving || editedCount === 0} className="gap-1"><Save className="w-4 h-4" /> Salvar</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9" />
            </div>
            <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Grupo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os grupos</SelectItem>
                {grupos.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.xnm_grupo_produto}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox id="baixo" checked={filtroBaixo} onCheckedChange={v => setFiltroBaixo(!!v)} />
              <Label htmlFor="baixo" className="text-sm cursor-pointer flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Estoque baixo
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">{selected.size} selecionado(s)</span>
          <Button variant="outline" size="sm" onClick={() => batchAction('Zerar Reservado', () => ({ xqt_estoque_reservado: 0 }))}>Zerar Reservado</Button>
          <Button variant="outline" size="sm" onClick={() => batchAction('Zerar Físico', () => ({ xqt_estoque_fisico: 0, xqt_estoque_reservado: 0 }))}>Zerar Físico</Button>
          <Button variant="outline" size="sm" onClick={() => batchAction('Igualar ao Padrão', p => ({ xqt_estoque_fisico: p.xqt_estoque_padrao || 0 }))}>Igualar ao Padrão</Button>
        </div>
      )}

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <tr className="border-b">
              <th className="h-12 px-4 w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></th>
              <SortableHead column="xcd_produto" label="Código" sort={sort} onToggle={toggle} />
              <SortableHead column="xcd_barra" label="Cód. Barras" sort={sort} onToggle={toggle} />
              <SortableHead column="xnm_produto" label="Produto" sort={sort} onToggle={toggle} />
              <SortableHead column="xqt_estoque_fisico" label="Físico" sort={sort} onToggle={toggle} className="text-right w-28" />
              <SortableHead column="xqt_estoque_reservado" label="Reservado" sort={sort} onToggle={toggle} className="text-right w-28" />
              <SortableHead column="xqt_estoque_disponivel" label="Disponível" sort={sort} onToggle={toggle} className="text-right w-28" />
              <SortableHead column="xqt_estoque_minimo" label="Mínimo" sort={sort} onToggle={toggle} className="text-right w-20" />
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10"><div className="animate-spin mx-auto w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
            ) : filtered.map(p => {
              const baixo = p.xqt_estoque_disponivel < (p.xqt_estoque_minimo || 0);
              return (
                <TableRow key={p.id} className={`${p._edited ? 'bg-primary/5' : ''} ${baixo ? 'bg-amber-50' : ''}`}>
                  <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{p.xcd_produto}</TableCell>
                  <TableCell className="font-mono text-xs">{p.xcd_barra || '-'}</TableCell>
                  <TableCell className="font-medium flex items-center gap-1">{p.xnm_produto}{baixo && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" min={0} value={p.xqt_estoque_fisico} onChange={e => updateField(p.id, 'xqt_estoque_fisico', Number(e.target.value))} className="w-24 text-right ml-auto h-8 text-sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input type="number" min={0} value={p.xqt_estoque_reservado} onChange={e => updateField(p.id, 'xqt_estoque_reservado', Number(e.target.value))} className="w-24 text-right ml-auto h-8 text-sm" />
                  </TableCell>
                  <TableCell className={`text-right font-bold ${baixo ? 'text-amber-600' : ''}`}>{p.xqt_estoque_disponivel}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{p.xqt_estoque_minimo}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <GridTotals totalRecords={data.length} filteredRecords={filtered.length} label="produto" />

      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Ação</DialogTitle></DialogHeader>
          <p className="text-sm">Deseja aplicar "<strong>{confirmAction?.label}</strong>" em {selected.size} produto(s)?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancelar</Button>
            <Button onClick={confirmAction?.action}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
