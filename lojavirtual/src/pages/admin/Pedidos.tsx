import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { formatCurrencyFromDecimal } from '@/lib/validators';
import { useSorting, SortableHead, GridTotals, ExportMenu } from '@/components/DataGridToolbar';
import { ClipboardList, RefreshCw, Search, Eye, ArrowRightLeft } from 'lucide-react';

const db = supabase as any;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  A: { label: 'Aberto', color: 'bg-blue-100 text-blue-800' },
  F: { label: 'Finalizado', color: 'bg-yellow-100 text-yellow-800' },
  T: { label: 'Faturado', color: 'bg-green-100 text-green-800' },
  C: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

const ORIGEM_MAP: Record<string, string> = { PDV: 'PDV', LINK: 'Link Online' };

interface Pedido {
  id: number; xnr_pedido: number; xst_pedido: string; xdt_pedido: string;
  xhr_pedido: string | null; xtipo_origem_pedido: string; xnm_cliente: string | null;
  xnm_crianca: string | null; xnm_responsavel: string | null;
  xvl_total_bruto: number; xvl_total_desconto: number; xvl_total_liquido: number;
  xobs_pedido: string | null; xcliente_id: number | null;
}

interface PedidoItem {
  id: number; xcd_produto: string; xnm_produto: string; xqt_item: number;
  xvl_unitario: number; xvl_total_item: number; xun_produto: string;
}

interface PedidoPgto {
  id: number; xtp_pagamento: string; xvl_pagamento: number; xdt_pagamento: string;
}

export default function Pedidos() {
  const { user } = useAuth();
  const [data, setData] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroOrigem, setFiltroOrigem] = useState('TODOS');
  const [dtIni, setDtIni] = useState('');
  const [dtFim, setDtFim] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPedido, setDetailPedido] = useState<Pedido | null>(null);
  const [detailItems, setDetailItems] = useState<PedidoItem[]>([]);
  const [detailPgtos, setDetailPgtos] = useState<PedidoPgto[]>([]);

  const { sort, toggle, compareFn } = useSorting({ column: 'xnr_pedido', dir: 'desc' });

  const load = useCallback(async () => {
    setLoading(true);
    let q = db.from('vw_pedidos_completos').select('*').eq('excluido_visivel', false);
    if (filtroStatus !== 'TODOS') q = q.eq('xst_pedido', filtroStatus);
    if (filtroOrigem !== 'TODOS') q = q.eq('xtipo_origem_pedido', filtroOrigem);
    if (dtIni) q = q.gte('xdt_pedido', dtIni + 'T00:00:00');
    if (dtFim) q = q.lte('xdt_pedido', dtFim + 'T23:59:59');
    q = q.order('xnr_pedido', { ascending: false });
    const { data: rows } = await q;
    setData(rows || []);
    setLoading(false);
  }, [filtroStatus, filtroOrigem, dtIni, dtFim]);

  useEffect(() => { load(); }, [load]);

  const accessor = (p: Pedido, col: string) => (p as any)[col];
  const filtered = data.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(p.xnr_pedido).includes(s) || (p.xnm_cliente || '').toLowerCase().includes(s)
      || (p.xnm_crianca || '').toLowerCase().includes(s) || (p.xnm_responsavel || '').toLowerCase().includes(s);
  }).sort(compareFn(accessor));

  const openDetail = async (p: Pedido) => {
    setDetailPedido(p);
    setDetailOpen(true);
    const [{ data: items }, { data: pgtos }] = await Promise.all([
      db.from('pedido_item').select('*').eq('xpedido_id', p.id).eq('excluido_visivel', false),
      db.from('pedido_pagamento').select('*').eq('xpedido_id', p.id).eq('excluido_visivel', false),
    ]);
    setDetailItems(items || []);
    setDetailPgtos(pgtos || []);
  };

  const changeStatus = async (pedidoId: number, novoStatus: string) => {
    const { data: res, error } = await db.rpc('fu_transition_pedido_status', {
      _pedido_id: pedidoId, _novo_status: novoStatus, _usuario_id: user?.id,
    });
    if (error || res?.error) {
      toast({ title: 'Erro', description: error?.message || res?.error, variant: 'destructive' }); return;
    }
    toast({ title: `Status alterado para ${STATUS_MAP[novoStatus]?.label || novoStatus}` });
    setDetailOpen(false);
    load();
  };

  const exportHeaders = ['Nº', 'Data', 'Status', 'Origem', 'Cliente', 'Criança', 'Bruto', 'Desconto', 'Líquido'];
  const exportRows = filtered.map(p => [
    p.xnr_pedido, p.xdt_pedido ? new Date(p.xdt_pedido).toLocaleDateString('pt-BR') : '',
    STATUS_MAP[p.xst_pedido]?.label || p.xst_pedido, ORIGEM_MAP[p.xtipo_origem_pedido] || p.xtipo_origem_pedido,
    p.xnm_cliente || '', p.xnm_crianca || '',
    Number(p.xvl_total_bruto).toFixed(2), Number(p.xvl_total_desconto).toFixed(2), Number(p.xvl_total_liquido).toFixed(2),
  ]);

  const transitions: Record<string, { label: string; targets: { status: string; label: string }[] }> = {
    A: { label: 'Aberto', targets: [{ status: 'F', label: 'Finalizar' }, { status: 'C', label: 'Cancelar' }] },
    F: { label: 'Finalizado', targets: [{ status: 'T', label: 'Faturar/Entregar' }, { status: 'C', label: 'Cancelar' }] },
    T: { label: 'Faturado', targets: [{ status: 'C', label: 'Cancelar' }] },
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Pedidos</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu headers={exportHeaders} rows={exportRows} filename="pedidos" />
          <Button variant="outline" size="icon" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nº, cliente, criança, responsável..." className="pl-9" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos Status</SelectItem>
                {Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas Origens</SelectItem>
                <SelectItem value="PDV">PDV</SelectItem>
                <SelectItem value="LINK">Link Online</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dtIni} onChange={e => setDtIni(e.target.value)} className="w-36" />
            <Input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)} className="w-36" />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <tr className="border-b">
              <SortableHead column="xnr_pedido" label="Nº" sort={sort} onToggle={toggle} className="w-20" />
              <SortableHead column="xdt_pedido" label="Data" sort={sort} onToggle={toggle} />
              <SortableHead column="xhr_pedido" label="Hora" sort={sort} onToggle={toggle} className="w-20" />
              <SortableHead column="xst_pedido" label="Status" sort={sort} onToggle={toggle} />
              <SortableHead column="xtipo_origem_pedido" label="Origem" sort={sort} onToggle={toggle} />
              <SortableHead column="xnm_cliente" label="Cliente" sort={sort} onToggle={toggle} />
              <SortableHead column="xnm_crianca" label="Criança" sort={sort} onToggle={toggle} />
              <SortableHead column="xvl_total_liquido" label="Valor" sort={sort} onToggle={toggle} className="text-right" />
              <th className="h-12 px-4 text-right font-medium text-muted-foreground w-20">Ações</th>
            </tr>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10"><div className="animate-spin mx-auto w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum pedido encontrado</TableCell></TableRow>
            ) : filtered.map(p => {
              const st = STATUS_MAP[p.xst_pedido] || { label: p.xst_pedido, color: '' };
              return (
                <TableRow key={p.id} className="cursor-pointer" onDoubleClick={() => openDetail(p)}>
                  <TableCell className="font-mono font-bold">{p.xnr_pedido}</TableCell>
                  <TableCell className="text-sm">{p.xdt_pedido ? new Date(p.xdt_pedido).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.xhr_pedido || '-'}</TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                  <TableCell className="text-sm">{ORIGEM_MAP[p.xtipo_origem_pedido] || p.xtipo_origem_pedido}</TableCell>
                  <TableCell>{p.xnm_cliente || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{p.xnm_crianca || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrencyFromDecimal(Number(p.xvl_total_liquido))}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(p)}><Eye className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <GridTotals totalRecords={data.length} filteredRecords={filtered.length} label="pedido" />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pedido #{detailPedido?.xnr_pedido}</DialogTitle></DialogHeader>
          {detailPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={STATUS_MAP[detailPedido.xst_pedido]?.color}>{STATUS_MAP[detailPedido.xst_pedido]?.label}</Badge></div>
                <div><span className="text-muted-foreground">Origem:</span> {ORIGEM_MAP[detailPedido.xtipo_origem_pedido] || detailPedido.xtipo_origem_pedido}</div>
                <div><span className="text-muted-foreground">Data:</span> {detailPedido.xdt_pedido ? new Date(detailPedido.xdt_pedido).toLocaleString('pt-BR') : '-'}</div>
                <div><span className="text-muted-foreground">Cliente:</span> {detailPedido.xnm_cliente || '-'}</div>
                <div><span className="text-muted-foreground">Criança:</span> {detailPedido.xnm_crianca || '-'}</div>
                <div><span className="text-muted-foreground">Responsável:</span> {detailPedido.xnm_responsavel || '-'}</div>
              </div>

              {detailPedido.xobs_pedido && <p className="text-sm bg-muted p-2 rounded"><strong>Obs:</strong> {detailPedido.xobs_pedido}</p>}

              <div>
                <h4 className="font-semibold text-sm mb-2">Itens</h4>
                <Table>
                  <TableHeader><tr className="border-b">
                    <th className="h-10 px-3 text-left text-xs font-medium text-muted-foreground">Produto</th>
                    <th className="h-10 px-3 text-right text-xs font-medium text-muted-foreground">Qtd</th>
                    <th className="h-10 px-3 text-right text-xs font-medium text-muted-foreground">Unit.</th>
                    <th className="h-10 px-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                  </tr></TableHeader>
                  <TableBody>
                    {detailItems.map(it => (
                      <TableRow key={it.id}>
                        <TableCell className="text-sm">{it.xnm_produto}</TableCell>
                        <TableCell className="text-right text-sm">{Number(it.xqt_item)}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{formatCurrencyFromDecimal(Number(it.xvl_unitario))}</TableCell>
                        <TableCell className="text-right text-sm font-mono">{formatCurrencyFromDecimal(Number(it.xqt_item) * Number(it.xvl_unitario))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-6 text-sm border-t pt-2">
                <span>Bruto: <strong>{formatCurrencyFromDecimal(Number(detailPedido.xvl_total_bruto))}</strong></span>
                <span>Desconto: <strong>{formatCurrencyFromDecimal(Number(detailPedido.xvl_total_desconto))}</strong></span>
                <span>Líquido: <strong className="text-primary">{formatCurrencyFromDecimal(Number(detailPedido.xvl_total_liquido))}</strong></span>
              </div>

              {detailPgtos.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Pagamentos</h4>
                  {detailPgtos.map(pg => (
                    <div key={pg.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{pg.xtp_pagamento}</span>
                      <span className="font-mono">{formatCurrencyFromDecimal(Number(pg.xvl_pagamento))}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status transitions */}
              {transitions[detailPedido.xst_pedido] && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Alterar status:</span>
                  {transitions[detailPedido.xst_pedido].targets.map(t => (
                    <Button key={t.status} size="sm" variant={t.status === 'C' ? 'destructive' : 'default'}
                      onClick={() => { if (confirm(`Confirma "${t.label}" para o pedido #${detailPedido.xnr_pedido}?`)) changeStatus(detailPedido.id, t.status); }}>
                      {t.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
