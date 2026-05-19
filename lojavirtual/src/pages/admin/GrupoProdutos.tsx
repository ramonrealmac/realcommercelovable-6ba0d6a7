import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useSorting, SortableHead, GridTotals, ExportMenu } from '@/components/DataGridToolbar';
import { Layers, Plus, Pencil, Trash2, RefreshCw, Search } from 'lucide-react';

interface GrupoProduto {
  id: number; xcd_grupo_produto: string; xnm_grupo_produto: string;
  xdt_cadastro: string; excluido_visivel: boolean;
}

export default function GrupoProdutos() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<GrupoProduto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoProduto | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const db = supabase as any;
  const { sort, toggle, compareFn } = useSorting();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await db.from('grupo_produto').select('*').eq('excluido_visivel', false).order('xcd_grupo_produto');
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else setData(rows || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accessor = (g: GrupoProduto, col: string) => (g as any)[col];
  const filtered = data.filter(g =>
    g.xcd_grupo_produto.toLowerCase().includes(search.toLowerCase()) ||
    g.xnm_grupo_produto.toLowerCase().includes(search.toLowerCase())
  ).sort(compareFn(accessor));

  const openNew = () => { setEditing(null); setFormCode(''); setFormName(''); setDialogOpen(true); };
  const openEdit = (item: GrupoProduto) => { setEditing(item); setFormCode(item.xcd_grupo_produto); setFormName(item.xnm_grupo_produto); setDialogOpen(true); };

  const handleSave = async () => {
    if (!formCode.trim() || !formName.trim()) { toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = editing
      ? await db.from('grupo_produto').update({ xcd_grupo_produto: formCode.trim(), xnm_grupo_produto: formName.trim() }).eq('id', editing.id)
      : await db.from('grupo_produto').insert({ xcd_grupo_produto: formCode.trim(), xnm_grupo_produto: formName.trim() });
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: editing ? 'Grupo atualizado!' : 'Grupo criado!' });
    setSaving(false); setDialogOpen(false); fetchData();
  };

  const handleDelete = async (item: GrupoProduto) => {
    if (!confirm(`Excluir grupo "${item.xnm_grupo_produto}"?`)) return;
    const { error } = await db.from('grupo_produto').update({ excluido_visivel: true }).eq('id', item.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Grupo excluído' }); fetchData(); }
  };

  const exportHeaders = ['Código', 'Nome'];
  const exportRows = filtered.map(g => [g.xcd_grupo_produto, g.xnm_grupo_produto]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Grupos de Produtos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu headers={exportHeaders} rows={exportRows} filename="grupos" />
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Grupo</Button>}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por código ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <tr className="border-b">
              <SortableHead column="xcd_grupo_produto" label="Código" sort={sort} onToggle={toggle} className="w-24" />
              <SortableHead column="xnm_grupo_produto" label="Nome" sort={sort} onToggle={toggle} />
              {isAdmin && <th className="h-12 px-4 text-right font-medium text-muted-foreground w-24">Ações</th>}
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum grupo encontrado</TableCell></TableRow>
            ) : filtered.map(g => (
              <TableRow key={g.id} className="cursor-pointer" onDoubleClick={() => isAdmin && openEdit(g)}>
                <TableCell className="font-mono">{g.xcd_grupo_produto}</TableCell>
                <TableCell>{g.xnm_grupo_produto}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(g)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <GridTotals totalRecords={data.length} filteredRecords={filtered.length} label="grupo" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Código</Label><Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="Ex: 05" /></div>
            <div className="space-y-2"><Label>Nome</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do grupo" /></div>
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
