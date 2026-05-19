import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { formatCurrencyFromDecimal } from '@/lib/validators';
import { useSorting, SortableHead, GridTotals, ExportMenu } from '@/components/DataGridToolbar';
import { Package, Plus, Pencil, Trash2, RefreshCw, Search, Upload, AlertTriangle } from 'lucide-react';

const db = supabase as any;

interface Produto {
  id: number; xcd_produto: string; xcd_barra: string | null; xnm_produto: string;
  xun_produto: string; xurl_foto: string | null; xgrupo_produto_id: number | null;
  xqt_estoque_fisico: number; xqt_estoque_reservado: number; xqt_estoque_disponivel: number;
  xqt_estoque_minimo: number; xqt_estoque_padrao: number; xvl_preco_compra: number;
  xpc_markup: number; xvl_preco_sugerido: number; xvl_preco_venda: number;
  xlg_venda_online: boolean; excluido_visivel: boolean;
  grupo_produto?: { xnm_grupo_produto: string } | null;
}

interface Grupo { id: number; xcd_grupo_produto: string; xnm_grupo_produto: string; }

export default function Produtos() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { sort, toggle, compareFn } = useSorting();

  const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const [f, setF] = useState({
    xcd_produto: '', xcd_barra: '', xnm_produto: '', xun_produto: 'UN',
    xgrupo_produto_id: '', xvl_preco_compra: 0, xpc_markup: 0,
    xvl_preco_venda: 0, xqt_estoque_fisico: 0, xqt_estoque_minimo: 0,
    xqt_estoque_padrao: 0, xlg_venda_online: true, xurl_foto: '',
    xdias_venda_online: '0,1,2,3,4',
  });

  const suggestedPrice = f.xvl_preco_compra * (1 + f.xpc_markup / 100);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: prods }, { data: grps }] = await Promise.all([
      db.from('produto').select('*, grupo_produto(xnm_grupo_produto)').eq('excluido_visivel', false).order('xcd_produto'),
      db.from('grupo_produto').select('*').eq('excluido_visivel', false).order('xnm_grupo_produto'),
    ]);
    setData(prods || []); setGrupos(grps || []); setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accessor = (p: Produto, col: string) => {
    if (col === 'grupo') return p.grupo_produto?.xnm_grupo_produto || '';
    return (p as any)[col];
  };
  const filtered = data.filter((p) =>
    p.xcd_produto.toLowerCase().includes(search.toLowerCase()) ||
    p.xnm_produto.toLowerCase().includes(search.toLowerCase()) ||
    (p.xcd_barra && p.xcd_barra.includes(search))
  ).sort(compareFn(accessor));

  const resetForm = () => setF({
    xcd_produto: '', xcd_barra: '', xnm_produto: '', xun_produto: 'UN',
    xgrupo_produto_id: '', xvl_preco_compra: 0, xpc_markup: 0,
    xvl_preco_venda: 0, xqt_estoque_fisico: 0, xqt_estoque_minimo: 0,
    xqt_estoque_padrao: 0, xlg_venda_online: true, xurl_foto: '',
    xdias_venda_online: '0,1,2,3,4',
  });

  const openNew = () => { setEditing(null); resetForm(); setDialogOpen(true); };
  const openEdit = (p: Produto) => {
    setEditing(p);
    setF({
      xcd_produto: p.xcd_produto, xcd_barra: p.xcd_barra || '', xnm_produto: p.xnm_produto,
      xun_produto: p.xun_produto, xgrupo_produto_id: p.xgrupo_produto_id?.toString() || '',
      xvl_preco_compra: Number(p.xvl_preco_compra), xpc_markup: Number(p.xpc_markup),
      xvl_preco_venda: Number(p.xvl_preco_venda), xqt_estoque_fisico: Number(p.xqt_estoque_fisico),
      xqt_estoque_minimo: Number(p.xqt_estoque_minimo), xqt_estoque_padrao: Number(p.xqt_estoque_padrao),
      xlg_venda_online: p.xlg_venda_online, xurl_foto: p.xurl_foto || '',
      xdias_venda_online: (p as any).xdias_venda_online || '0,1,2,3,4',
    });
    setDialogOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const path = `${Date.now()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('produtos').upload(path, file);
    if (error) { toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' }); return; }
    const { data: urlData } = supabase.storage.from('produtos').getPublicUrl(path);
    setF(prev => ({ ...prev, xurl_foto: urlData.publicUrl }));
    toast({ title: 'Foto enviada!' });
  };

  const handleSave = async () => {
    if (!f.xcd_produto.trim() || !f.xnm_produto.trim()) { toast({ title: 'Preencha código e nome', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      xcd_produto: f.xcd_produto.trim(), xcd_barra: f.xcd_barra.trim() || null,
      xnm_produto: f.xnm_produto.trim(), xun_produto: f.xun_produto,
      xgrupo_produto_id: f.xgrupo_produto_id ? parseInt(f.xgrupo_produto_id) : null,
      xvl_preco_compra: f.xvl_preco_compra, xpc_markup: f.xpc_markup,
      xvl_preco_sugerido: Math.round(suggestedPrice * 100) / 100,
      xvl_preco_venda: f.xvl_preco_venda, xqt_estoque_fisico: f.xqt_estoque_fisico,
      xqt_estoque_minimo: f.xqt_estoque_minimo, xqt_estoque_padrao: f.xqt_estoque_padrao,
      xlg_venda_online: f.xlg_venda_online, xurl_foto: f.xurl_foto || null,
      xdias_venda_online: f.xdias_venda_online || '0,1,2,3,4',
    };
    const { error } = editing ? await db.from('produto').update(payload).eq('id', editing.id) : await db.from('produto').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Produto atualizado!' : 'Produto criado!' });
    setDialogOpen(false); fetchData();
  };

  const handleDelete = async (p: Produto) => {
    if (!confirm(`Excluir "${p.xnm_produto}"?`)) return;
    await db.from('produto').update({ excluido_visivel: true }).eq('id', p.id);
    toast({ title: 'Produto excluído' }); fetchData();
  };

  const exportHeaders = ['Código', 'Nome', 'Grupo', 'Preço Venda', 'Estoque Disp.', 'Online'];
  const exportRows = filtered.map(p => [
    p.xcd_produto, p.xnm_produto, p.grupo_produto?.xnm_grupo_produto || '',
    Number(p.xvl_preco_venda).toFixed(2), Number(p.xqt_estoque_disponivel).toFixed(0),
    p.xlg_venda_online ? 'Sim' : 'Não',
  ]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Produtos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu headers={exportHeaders} rows={exportRows} filename="produtos" />
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Produto</Button>}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar código, nome ou barras..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <tr className="border-b">
              <SortableHead column="xcd_produto" label="Código" sort={sort} onToggle={toggle} className="w-20" />
              <SortableHead column="xnm_produto" label="Nome" sort={sort} onToggle={toggle} />
              <SortableHead column="grupo" label="Grupo" sort={sort} onToggle={toggle} />
              <SortableHead column="xvl_preco_venda" label="Preço" sort={sort} onToggle={toggle} className="text-right" />
              <SortableHead column="xqt_estoque_disponivel" label="Estoque" sort={sort} onToggle={toggle} className="text-right" />
              <SortableHead column="xlg_venda_online" label="Online" sort={sort} onToggle={toggle} className="text-center" />
              {isAdmin && <th className="h-12 px-4 text-right font-medium text-muted-foreground w-24">Ações</th>}
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</TableCell></TableRow>
            ) : filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onDoubleClick={() => isAdmin && openEdit(p)}>
                <TableCell className="font-mono">{p.xcd_produto}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {p.xurl_foto && <img src={p.xurl_foto} alt="" className="w-8 h-8 rounded object-cover" />}
                    {p.xnm_produto}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.grupo_produto?.xnm_grupo_produto || '-'}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrencyFromDecimal(Number(p.xvl_preco_venda))}</TableCell>
                <TableCell className="text-right">
                  <span className={Number(p.xqt_estoque_disponivel) <= Number(p.xqt_estoque_minimo) ? 'text-destructive font-semibold' : ''}>
                    {Number(p.xqt_estoque_disponivel).toFixed(0)}
                  </span>
                  {Number(p.xqt_estoque_disponivel) <= Number(p.xqt_estoque_minimo) && <AlertTriangle className="inline w-3.5 h-3.5 ml-1 text-destructive" />}
                </TableCell>
                <TableCell className="text-center"><Badge variant={p.xlg_venda_online ? 'default' : 'secondary'}>{p.xlg_venda_online ? 'Sim' : 'Não'}</Badge></TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <GridTotals totalRecords={data.length} filteredRecords={filtered.length} label="produto" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Produto' : 'Novo Produto'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Código *</Label><Input value={f.xcd_produto} onChange={(e) => setF({ ...f, xcd_produto: e.target.value })} /></div>
            <div className="space-y-2"><Label>Código de Barras</Label><Input value={f.xcd_barra} onChange={(e) => setF({ ...f, xcd_barra: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Nome *</Label><Input value={f.xnm_produto} onChange={(e) => setF({ ...f, xnm_produto: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={f.xun_produto} onValueChange={(v) => setF({ ...f, xun_produto: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['UN', 'KG', 'LT', 'CX', 'PC', 'ML'].map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={f.xgrupo_produto_id} onValueChange={(v) => setF({ ...f, xgrupo_produto_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{grupos.map(g => <SelectItem key={g.id} value={g.id.toString()}>{g.xnm_grupo_produto}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 border-t pt-3 mt-1"><h3 className="font-semibold text-sm text-muted-foreground">PREÇOS</h3></div>
            <div className="space-y-2"><Label>Preço Compra (R$)</Label><Input type="number" step="0.01" min="0" value={f.xvl_preco_compra} onChange={(e) => setF({ ...f, xvl_preco_compra: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Markup (%)</Label><Input type="number" step="0.01" min="0" value={f.xpc_markup} onChange={(e) => setF({ ...f, xpc_markup: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Preço Sugerido</Label><Input value={formatCurrencyFromDecimal(suggestedPrice)} readOnly className="bg-muted" /></div>
            <div className="space-y-2"><Label>Preço Venda (R$) *</Label><Input type="number" step="0.01" min="0" value={f.xvl_preco_venda} onChange={(e) => setF({ ...f, xvl_preco_venda: parseFloat(e.target.value) || 0 })} /></div>
            <div className="md:col-span-2 border-t pt-3 mt-1"><h3 className="font-semibold text-sm text-muted-foreground">ESTOQUE</h3></div>
            <div className="space-y-2"><Label>Estoque Físico</Label><Input type="number" step="1" min="0" value={f.xqt_estoque_fisico} onChange={(e) => setF({ ...f, xqt_estoque_fisico: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Estoque Mínimo</Label><Input type="number" step="1" min="0" value={f.xqt_estoque_minimo} onChange={(e) => setF({ ...f, xqt_estoque_minimo: parseFloat(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Estoque Padrão</Label><Input type="number" step="1" min="0" value={f.xqt_estoque_padrao} onChange={(e) => setF({ ...f, xqt_estoque_padrao: parseFloat(e.target.value) || 0 })} /></div>
            <div className="md:col-span-2 border-t pt-3 mt-1"><h3 className="font-semibold text-sm text-muted-foreground">FOTO E VISIBILIDADE</h3></div>
            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex items-center gap-2">
                <Input value={f.xurl_foto} onChange={(e) => setF({ ...f, xurl_foto: e.target.value })} placeholder="URL da foto" className="flex-1" />
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" /></Button>
              </div>
              {f.xurl_foto && <img src={f.xurl_foto} alt="Preview" className="w-20 h-20 rounded-lg object-cover border" />}
            </div>
            <div className="space-y-2 flex items-end gap-3 pb-1">
              <div className="flex items-center gap-2">
                <Switch checked={f.xlg_venda_online} onCheckedChange={(v) => setF({ ...f, xlg_venda_online: v })} />
                <Label>Venda Online</Label>
              </div>
            </div>
            {f.xlg_venda_online && (
              <div className="md:col-span-2 space-y-2">
                <Label>Dias disponíveis para venda online</Label>
                <div className="flex flex-wrap gap-2">
                  {DIAS_SEMANA.map((dia, idx) => {
                    const dias = (f.xdias_venda_online || '').split(',').filter(Boolean);
                    const checked = dias.includes(String(idx));
                    return (
                      <label key={idx} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border'}`}>
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => {
                          const newDias = checked ? dias.filter(d => d !== String(idx)) : [...dias, String(idx)];
                          setF({ ...f, xdias_venda_online: newDias.sort().join(',') });
                        }} />
                        {dia}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
