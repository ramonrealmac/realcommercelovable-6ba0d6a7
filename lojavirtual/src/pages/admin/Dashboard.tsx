import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, DollarSign, ShoppingCart, TrendingUp, Receipt, RefreshCw,
  Banknote, CreditCard, QrCode, Filter,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const db = supabase as any;

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABELS: Record<string, string> = { A: 'Aberto', F: 'Finalizado', T: 'Faturado', C: 'Cancelado' };
const STATUS_COLORS: Record<string, string> = { A: 'bg-blue-100 text-blue-800', F: 'bg-green-100 text-green-800', T: 'bg-purple-100 text-purple-800', C: 'bg-red-100 text-red-800' };

export default function Dashboard() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [dtInicio, setDtInicio] = useState(firstDay);
  const [dtFim, setDtFim] = useState(lastDay);
  const [origem, setOrigem] = useState('TODOS');
  const [agrupamento, setAgrupamento] = useState<'semanal' | 'mensal'>('semanal');
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = db.from('pedido').select('*').eq('excluido_visivel', false)
      .gte('xdt_pedido', `${dtInicio}T00:00:00`)
      .lte('xdt_pedido', `${dtFim}T23:59:59`);
    if (origem !== 'TODOS') q = q.eq('xtipo_origem_pedido', origem);
    const { data: p } = await q;
    setPedidos(p || []);

    const pedidoIds = (p || []).map((x: any) => x.id);
    if (pedidoIds.length > 0) {
      const { data: pg } = await db.from('pedido_pagamento').select('*').in('xpedido_id', pedidoIds).eq('excluido_visivel', false);
      setPagamentos(pg || []);
    } else {
      setPagamentos([]);
    }
    setLoading(false);
  }, [dtInicio, dtFim, origem]);

  useEffect(() => { load(); }, [load]);

  // KPIs
  const pedidosAtivos = pedidos.filter(p => p.xst_pedido !== 'C');
  const totalVendas = pedidosAtivos.reduce((s, p) => s + (p.xvl_total_liquido || 0), 0);
  const qtdPedidos = pedidosAtivos.length;
  const ticketMedio = qtdPedidos > 0 ? totalVendas / qtdPedidos : 0;

  // Por status
  const byStatus = pedidos.reduce((acc, p) => {
    acc[p.xst_pedido] = (acc[p.xst_pedido] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Por tipo de pagamento
  const byPayment = pagamentos.reduce((acc, pg) => {
    acc[pg.xtp_pagamento] = (acc[pg.xtp_pagamento] || 0) + (pg.xvl_pagamento || 0);
    return acc;
  }, {} as Record<string, number>);

  // Chart data
  const chartData = (() => {
    const map = new Map<string, number>();
    pedidosAtivos.forEach(p => {
      const d = new Date(p.xdt_pedido);
      let key: string;
      if (agrupamento === 'semanal') {
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        key = startOfWeek.toISOString().split('T')[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      map.set(key, (map.get(key) || 0) + (p.xvl_total_liquido || 0));
    });
    return Array.from(map.entries()).sort().map(([k, v]) => ({ periodo: k, valor: v }));
  })();

  const paymentChartData = Object.entries(byPayment).map(([k, v]) => ({ tipo: k, valor: v }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Data Inicial</Label>
              <Input type="date" value={dtInicio} onChange={e => setDtInicio(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Final</Label>
              <Input type="date" value={dtFim} onChange={e => setDtFim(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos</SelectItem>
                  <SelectItem value="PDV">PDV</SelectItem>
                  <SelectItem value="LINK">Link</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Agrupamento</Label>
              <Select value={agrupamento} onValueChange={v => setAgrupamento(v as any)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="gap-1">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><DollarSign className="w-5 h-5 text-green-700" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total de Vendas</p>
              <p className="text-lg font-bold">{formatCurrency(totalVendas)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><ShoppingCart className="w-5 h-5 text-blue-700" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Pedidos</p>
              <p className="text-lg font-bold">{qtdPedidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><TrendingUp className="w-5 h-5 text-purple-700" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Ticket Médio</p>
              <p className="text-lg font-bold">{formatCurrency(ticketMedio)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Receipt className="w-5 h-5 text-amber-700" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Por Status</p>
              <div className="flex gap-1 flex-wrap mt-0.5">
                {Object.entries(byStatus).map(([s, c]) => (
                  <span key={s} className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[s] || ''}`}>{STATUS_LABELS[s]}: {c as number}</span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução de Vendas</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1).toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Sem dados no período</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Vendas por Pagamento</CardTitle></CardHeader>
          <CardContent>
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={paymentChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">Sem dados no período</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
