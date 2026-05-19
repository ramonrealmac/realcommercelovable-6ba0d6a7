import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { FileText, Search, Download, FileSpreadsheet, FileType2, UtensilsCrossed, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import RelatorioLanches from '@/components/RelatorioLanches';

const db = supabase as any;
const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '';

const PAYMENT_LABELS: Record<string, string> = {
  DINHEIRO: 'Dinheiro', CARTAO_CREDITO: 'Crédito', CARTAO_DEBITO: 'Débito', PIX: 'PIX',
};

interface PedidoRow {
  id: number;
  xnr_pedido: number;
  xdt_pedido: string;
  xst_pedido: string;
  xvl_total_liquido: number;
  xnm_cliente?: string;
  xnm_crianca?: string;
}

export default function Relatorios() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const [dtInicio, setDtInicio] = useState(firstDay);
  const [dtFim, setDtFim] = useState(today.toISOString().split('T')[0]);
  const [origem, setOrigem] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<PedidoRow[]>([]);
  const [pagamentos, setPagamentos] = useState<any[]>([]);

  const search = useCallback(async () => {
    setLoading(true);
    let q = db.from('vw_pedidos_completos').select('*')
      .in('xst_pedido', ['F', 'T'])
      .gte('xdt_pedido', `${dtInicio}T00:00:00`)
      .lte('xdt_pedido', `${dtFim}T23:59:59`)
      .order('xdt_pedido', { ascending: false });
    if (origem !== 'TODOS') q = q.eq('xtipo_origem_pedido', origem);
    const { data: p } = await q;
    setPedidos(p || []);
    const ids = (p || []).map((x: any) => x.id);
    if (ids.length > 0) {
      const { data: pg } = await db.from('pedido_pagamento').select('*').in('xpedido_id', ids).eq('excluido_visivel', false);
      setPagamentos(pg || []);
    } else {
      setPagamentos([]);
    }
    setLoading(false);
  }, [dtInicio, dtFim, origem]);

  // Sintético
  const totalGeral = pedidos.reduce((s, p) => s + (p.xvl_total_liquido || 0), 0);
  const byPayment: Record<string, number> = pagamentos.reduce((acc: Record<string, number>, pg: any) => {
    const k = pg.xtp_pagamento || 'OUTROS';
    acc[k] = (acc[k] || 0) + (pg.xvl_pagamento || 0);
    return acc;
  }, {} as Record<string, number>);

  // Analítico agrupado por data
  const byDate = pedidos.reduce((acc, p) => {
    const d = fmtDate(p.xdt_pedido);
    if (!acc[d]) acc[d] = [];
    acc[d].push(p);
    return acc;
  }, {} as Record<string, PedidoRow[]>);

  // Export helpers
  const exportCSV = () => {
    const header = 'Pedido;Data;Cliente;Aluno;Valor;Status\n';
    const rows = pedidos.map(p => `${p.xnr_pedido};${fmtDate(p.xdt_pedido)};${p.xnm_cliente || ''};${p.xnm_crianca || ''};${(p.xvl_total_liquido || 0).toFixed(2)};${p.xst_pedido}`).join('\n');
    downloadFile(header + rows, 'relatorio_vendas.csv', 'text/csv');
  };

  const exportTXT = () => {
    let txt = `RELATÓRIO DE VENDAS - ${dtInicio} a ${dtFim}\n${'='.repeat(60)}\n\n`;
    Object.entries(byDate).forEach(([date, items]) => {
      txt += `--- ${date} ---\n`;
      items.forEach(p => {
        txt += `  Pedido #${p.xnr_pedido} | ${p.xnm_cliente || 'Consumidor'} | ${fmt(p.xvl_total_liquido || 0)}\n`;
      });
      txt += `  Subtotal: ${fmt(items.reduce((s, p) => s + (p.xvl_total_liquido || 0), 0))}\n\n`;
    });
    txt += `\nTOTAL GERAL: ${fmt(totalGeral)}\n`;
    Object.entries(byPayment).forEach(([k, v]) => { txt += `  ${PAYMENT_LABELS[k] || k}: ${fmt(v)}\n`; });
    downloadFile(txt, 'relatorio_vendas.txt', 'text/plain');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${filename} exportado!` });
  };

  const exportAnaliticoPDF = () => {
    if (pedidos.length === 0) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 10;
    const cw = pw - 20;
    let y = 15;

    const header = () => {
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Relatório Analítico de Vendas', pw / 2, y, { align: 'center' });
      y += 6; doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${fmtDate(dtInicio)} a ${fmtDate(dtFim)} | Origem: ${origem}`, pw / 2, y, { align: 'center' });
      y += 8;
    };
    const checkPage = (need: number) => { if (y + need > ph - 15) { doc.addPage(); y = 15; header(); } };

    header();

    Object.entries(byDate).forEach(([date, items]) => {
      checkPage(14);
      doc.setFillColor(100, 100, 100); doc.rect(ml, y, cw, 6, 'F');
      doc.setTextColor(255); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text(`${date} — ${items.length} pedido(s) — ${fmt(items.reduce((s, p) => s + (p.xvl_total_liquido || 0), 0))}`, ml + 2, y + 4);
      doc.setTextColor(0); y += 8;

      doc.setFontSize(7); doc.setFont('helvetica', 'normal');
      items.forEach((p, idx) => {
        checkPage(5);
        if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(ml, y - 1, cw, 5, 'F'); }
        doc.text(String(p.xnr_pedido || ''), ml + 2, y + 2.5);
        doc.text(p.xnm_cliente || 'Consumidor Final', ml + 20, y + 2.5);
        doc.text(p.xnm_crianca || '-', ml + 80, y + 2.5);
        doc.text(fmt(p.xvl_total_liquido || 0), ml + 130, y + 2.5);
        doc.text(p.xst_pedido || '', ml + 170, y + 2.5);
        y += 5;
      });
      y += 3;
    });

    y += 4; doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`Total Geral: ${fmt(totalGeral)} — ${pedidos.length} pedido(s)`, ml, y);

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
    toast({ title: 'PDF Analítico gerado!' });
  };

  const exportSinteticoPDF = () => {
    if (pedidos.length === 0) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ml = 10;
    let y = 15;

    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('Relatório Sintético de Vendas', pw / 2, y, { align: 'center' });
    y += 7; doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Período: ${fmtDate(dtInicio)} a ${fmtDate(dtFim)} | Origem: ${origem}`, pw / 2, y, { align: 'center' });
    y += 12;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(`Total Geral: ${fmt(totalGeral)}`, pw / 2, y, { align: 'center' });
    y += 6; doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`${pedidos.length} pedido(s) no período`, pw / 2, y, { align: 'center' });
    y += 14;

    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Forma de Pagamento', ml, y); y += 7;

    doc.setFillColor(100, 100, 100); doc.rect(ml, y, pw - 20, 6, 'F');
    doc.setTextColor(255); doc.setFontSize(8);
    doc.text('Forma de Pagamento', ml + 2, y + 4);
    doc.text('Valor', ml + 100, y + 4);
    doc.text('%', ml + 150, y + 4);
    doc.setTextColor(0); y += 8;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    Object.entries(byPayment).forEach(([k, v], idx) => {
      if (idx % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(ml, y - 1, pw - 20, 6, 'F'); }
      doc.text(PAYMENT_LABELS[k] || k, ml + 2, y + 3);
      doc.text(fmt(v), ml + 100, y + 3);
      doc.text(totalGeral > 0 ? `${((v / totalGeral) * 100).toFixed(1)}%` : '0%', ml + 150, y + 3);
      y += 6;
    });

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
    toast({ title: 'PDF Sintético gerado!' });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Relatórios</h1>
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
            <Button onClick={search} disabled={loading} className="gap-1">
              <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Consultar
            </Button>
            <div className="ml-auto flex gap-1">
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={pedidos.length === 0} className="gap-1">
                <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportTXT} disabled={pedidos.length === 0} className="gap-1">
                <FileType2 className="w-3.5 h-3.5" /> TXT
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="analitico">
        <TabsList>
          <TabsTrigger value="analitico">Analítico</TabsTrigger>
          <TabsTrigger value="sintetico">Sintético</TabsTrigger>
          <TabsTrigger value="lanches" className="gap-1"><UtensilsCrossed className="w-3.5 h-3.5" /> Lanches</TabsTrigger>
        </TabsList>

        <TabsContent value="analitico" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportAnaliticoPDF} disabled={pedidos.length === 0} className="gap-1">
              <Printer className="w-3.5 h-3.5" /> Imprimir PDF
            </Button>
          </div>
          {Object.keys(byDate).length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-10">Nenhum dado encontrado. Use os filtros acima.</p>
          )}
          {Object.entries(byDate).map(([date, items]) => (
            <Card key={date}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{date}</span>
                  <Badge variant="secondary">{items.length} pedido(s) — {fmt(items.reduce((s, p) => s + (p.xvl_total_liquido || 0), 0))}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20"># Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Aluno</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono">{p.xnr_pedido}</TableCell>
                        <TableCell>{p.xnm_cliente || 'Consumidor Final'}</TableCell>
                        <TableCell>{p.xnm_crianca || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(p.xvl_total_liquido || 0)}</TableCell>
                        <TableCell><Badge variant="outline">{p.xst_pedido}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="sintetico" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={exportSinteticoPDF} disabled={pedidos.length === 0} className="gap-1">
              <Printer className="w-3.5 h-3.5" /> Imprimir PDF
            </Button>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Resumo do Período</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <p className="text-muted-foreground text-sm">Total Geral</p>
                <p className="text-3xl font-bold text-primary">{fmt(totalGeral)}</p>
                <p className="text-xs text-muted-foreground mt-1">{pedidos.length} pedido(s) no período</p>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Forma de Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(byPayment).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{PAYMENT_LABELS[k] || k}</TableCell>
                        <TableCell className="text-right">{fmt(v)}</TableCell>
                        <TableCell className="text-right">{totalGeral > 0 ? ((v / totalGeral) * 100).toFixed(1) : 0}%</TableCell>
                      </TableRow>
                    ))}
                    {Object.keys(byPayment).length === 0 && (
                      <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lanches">
          <RelatorioLanches />
        </TabsContent>
      </Tabs>
    </div>
  );
}
