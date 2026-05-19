import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { validateCPFOrCNPJ, formatCPFCNPJ, formatPhone } from '@/lib/validators';
import { useSorting, SortableHead, GridTotals, ExportMenu } from '@/components/DataGridToolbar';
import { Users, Plus, Pencil, Trash2, RefreshCw, Search, ShieldAlert } from 'lucide-react';

const db = supabase as any;

interface Cliente {
  id: number; xcd_cliente: string; xnr_cpf_cnpj: string | null;
  xnm_razao_social: string; xnm_fantasia_social: string | null;
  xnr_telefone: string | null; xnm_crianca: string | null;
}

export default function Clientes() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const { sort, toggle, compareFn } = useSorting();

  const [f, setF] = useState({ xcd_cliente: '', xnr_cpf_cnpj: '', xnm_razao_social: '', xnm_fantasia_social: '', xnr_telefone: '', xnm_crianca: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await db.from('cliente').select('*').eq('excluido_visivel', false).order('xcd_cliente');
    setData(rows || []); setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const accessor = (c: Cliente, col: string) => (c as any)[col];
  const filtered = data.filter(c =>
    c.xnm_razao_social.toLowerCase().includes(search.toLowerCase()) ||
    c.xcd_cliente.includes(search) ||
    (c.xnr_cpf_cnpj && c.xnr_cpf_cnpj.includes(search.replace(/\D/g, ''))) ||
    (c.xnm_crianca && c.xnm_crianca.toLowerCase().includes(search.toLowerCase()))
  ).sort(compareFn(accessor));

  const openNew = () => { setEditing(null); setF({ xcd_cliente: '', xnr_cpf_cnpj: '', xnm_razao_social: '', xnm_fantasia_social: '', xnr_telefone: '', xnm_crianca: '' }); setDialogOpen(true); };
  const openEdit = (c: Cliente) => {
    setEditing(c);
    setF({ xcd_cliente: c.xcd_cliente, xnr_cpf_cnpj: c.xnr_cpf_cnpj || '', xnm_razao_social: c.xnm_razao_social, xnm_fantasia_social: c.xnm_fantasia_social || '', xnr_telefone: c.xnr_telefone || '', xnm_crianca: c.xnm_crianca || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!f.xcd_cliente.trim() || !f.xnm_razao_social.trim()) { toast({ title: 'Preencha código e nome', variant: 'destructive' }); return; }
    if (f.xnr_cpf_cnpj && !validateCPFOrCNPJ(f.xnr_cpf_cnpj)) { toast({ title: 'CPF/CNPJ inválido', variant: 'destructive' }); return; }
    setSaving(true);
    const payload = {
      xcd_cliente: f.xcd_cliente.trim(), xnr_cpf_cnpj: f.xnr_cpf_cnpj.replace(/\D/g, '') || null,
      xnm_razao_social: f.xnm_razao_social.trim(), xnm_fantasia_social: f.xnm_fantasia_social.trim() || null,
      xnr_telefone: f.xnr_telefone.replace(/\D/g, '') || null, xnm_crianca: f.xnm_crianca.trim() || null,
    };
    const { error } = editing ? await db.from('cliente').update(payload).eq('id', editing.id) : await db.from('cliente').insert(payload);
    setSaving(false);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: editing ? 'Cliente atualizado!' : 'Cliente criado!' });
    setDialogOpen(false); fetchData();
  };

  const handleDelete = async (c: Cliente) => {
    if (c.id === 1) { toast({ title: 'Cliente padrão não pode ser excluído', variant: 'destructive' }); return; }
    if (!confirm(`Excluir "${c.xnm_razao_social}"?`)) return;
    await db.from('cliente').update({ excluido_visivel: true }).eq('id', c.id);
    toast({ title: 'Cliente excluído' }); fetchData();
  };

  const exportHeaders = ['Código', 'Nome', 'Fantasia', 'CPF/CNPJ', 'Telefone', 'Criança'];
  const exportRows = filtered.map(c => [c.xcd_cliente, c.xnm_razao_social, c.xnm_fantasia_social || '', c.xnr_cpf_cnpj ? formatCPFCNPJ(c.xnr_cpf_cnpj) : '', c.xnr_telefone ? formatPhone(c.xnr_telefone) : '', c.xnm_crianca || '']);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu headers={exportHeaders} rows={exportRows} filename="clientes" />
          <Button variant="outline" size="icon" onClick={fetchData}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
          {isAdmin && <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Cliente</Button>}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar nome, código, CPF ou criança..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <tr className="border-b">
              <SortableHead column="xcd_cliente" label="Código" sort={sort} onToggle={toggle} className="w-20" />
              <SortableHead column="xnm_razao_social" label="Nome" sort={sort} onToggle={toggle} />
              <SortableHead column="xnm_fantasia_social" label="Fantasia" sort={sort} onToggle={toggle} />
              <SortableHead column="xnr_cpf_cnpj" label="CPF/CNPJ" sort={sort} onToggle={toggle} />
              <SortableHead column="xnr_telefone" label="Telefone" sort={sort} onToggle={toggle} />
              <SortableHead column="xnm_crianca" label="Criança(s)" sort={sort} onToggle={toggle} />
              {isAdmin && <th className="h-12 px-4 text-right font-medium text-muted-foreground w-24">Ações</th>}
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum cliente</TableCell></TableRow>
            ) : filtered.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onDoubleClick={() => isAdmin && openEdit(c)}>
                <TableCell className="font-mono">{c.xcd_cliente}{c.id === 1 && <ShieldAlert className="inline w-3.5 h-3.5 ml-1 text-primary" />}</TableCell>
                <TableCell className="font-medium">{c.xnm_razao_social}</TableCell>
                <TableCell className="text-muted-foreground">{c.xnm_fantasia_social || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{c.xnr_cpf_cnpj ? formatCPFCNPJ(c.xnr_cpf_cnpj) : '-'}</TableCell>
                <TableCell className="font-mono text-sm">{c.xnr_telefone ? formatPhone(c.xnr_telefone) : '-'}</TableCell>
                <TableCell>{c.xnm_crianca || '-'}</TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c)} disabled={c.id === 1}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <GridTotals totalRecords={data.length} filteredRecords={filtered.length} label="cliente" />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Código *</Label><Input value={f.xcd_cliente} onChange={(e) => setF({ ...f, xcd_cliente: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={f.xnr_cpf_cnpj} onChange={(e) => setF({ ...f, xnr_cpf_cnpj: e.target.value })} placeholder="Opcional" /></div>
            </div>
            <div className="space-y-2"><Label>Nome / Razão Social *</Label><Input value={f.xnm_razao_social} onChange={(e) => setF({ ...f, xnm_razao_social: e.target.value })} /></div>
            <div className="space-y-2"><Label>Nome Fantasia</Label><Input value={f.xnm_fantasia_social} onChange={(e) => setF({ ...f, xnm_fantasia_social: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={f.xnr_telefone} onChange={(e) => setF({ ...f, xnr_telefone: e.target.value })} placeholder="(00) 00000-0000" /></div>
            <div className="space-y-2"><Label>Nome da(s) criança(s)</Label><Input value={f.xnm_crianca} onChange={(e) => setF({ ...f, xnm_crianca: e.target.value })} placeholder="Separe por vírgula se mais de uma" /></div>
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
