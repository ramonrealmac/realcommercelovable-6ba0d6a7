import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Search, Printer } from 'lucide-react';
import jsPDF from 'jspdf';

const db = supabase as any;

const DIAS_SEMANA = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Segunda-feira' },
  { value: '2', label: 'Terça-feira' },
  { value: '3', label: 'Quarta-feira' },
  { value: '4', label: 'Quinta-feira' },
  { value: '5', label: 'Sexta-feira' },
  { value: '6', label: 'Sábado' },
];

const TURNOS = [
  { value: 'M', label: 'Matutino' },
  { value: 'V', label: 'Vespertino' },
];

const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'A', label: 'Aberto' },
  { value: 'F', label: 'Finalizado' },
  { value: 'T', label: 'Faturado' },
  { value: 'C', label: 'Cancelado' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  A: { label: 'Aberto', color: 'bg-blue-100 text-blue-800' },
  F: { label: 'Finalizado', color: 'bg-yellow-100 text-yellow-800' },
  T: { label: 'Faturado', color: 'bg-green-100 text-green-800' },
  C: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
};

interface ReportRow {
  xnr_pedido: number;
  xdt_pedido: string;
  xhr_pedido: string;
  xst_pedido: string;
  xnm_responsavel: string;
  xnm_crianca: string;
  itens: { xnm_produto: string; xqt_item: number; xvl_unitario: number }[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RelatorioLanches() {
  const today = new Date();
  const [diaSemana, setDiaSemana] = useState(String(today.getDay()));
  const [turno, setTurno] = useState('M');
  const [hrInicio, setHrInicio] = useState('');
  const [hrFim, setHrFim] = useState('');
  const [dtConsulta, setDtConsulta] = useState(today.toISOString().split('T')[0]);
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [nomeEscola, setNomeEscola] = useState('');
  const tableRef = useRef<HTMLDivElement>(null);

  // Load school name
  useEffect(() => {
    db.rpc('fu_get_parametro_publico').then(({ data }: any) => {
      if (data?.[0]) setNomeEscola(data[0].xnm_escola || '');
    });
  }, []);

  // Auto-fill hours from parametro_horario
  useEffect(() => {
    (async () => {
      const { data } = await db.from('parametro_horario')
        .select('*')
        .eq('xdia_semana', Number(diaSemana))
        .eq('excluido_visivel', false)
        .limit(1)
        .single();
      if (data) {
        if (turno === 'M') {
          setHrInicio(data.xhr_inicio_matutino || '07:00');
          setHrFim(data.xhr_fim_matutino || '12:00');
        } else {
          setHrInicio(data.xhr_inicio_vespertino || '13:00');
          setHrFim(data.xhr_fim_vespertino || '18:00');
        }
      } else {
        setHrInicio(turno === 'M' ? '07:00' : '13:00');
        setHrFim(turno === 'M' ? '12:00' : '18:00');
      }
    })();
  }, [diaSemana, turno]);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      // Build timezone-aware timestamps for Brazil (UTC-3)
      // hrInicio/hrFim can be "HH:MM" or "HH:MM:SS" — normalize to HH:MM:SS
      const normStart = hrInicio.length <= 5 ? `${hrInicio}:00` : hrInicio;
      const normEnd = hrFim.length <= 5 ? `${hrFim}:59` : hrFim;
      const dtStart = `${dtConsulta}T${normStart}-03:00`;
      const dtEnd = `${dtConsulta}T${normEnd}-03:00`;

      let q = db.from('vw_pedidos_completos')
        .select('id, xnr_pedido, xdt_pedido, xhr_pedido, xst_pedido, xnm_responsavel, xnm_crianca, xnm_cliente')
        .gte('xdt_pedido', dtStart)
        .lte('xdt_pedido', dtEnd)
        .order('xdt_pedido', { ascending: true });

      if (filtroStatus !== 'TODOS') {
        q = q.eq('xst_pedido', filtroStatus);
      }

      const { data: pedidos, error: pedErr } = await q;

      if (pedErr) {
        console.error('Query error:', pedErr);
        toast({ title: 'Erro na consulta', description: pedErr.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      if (!pedidos || pedidos.length === 0) {
        setRows([]);
        toast({ title: 'Nenhum pedido encontrado no período' });
        setLoading(false);
        return;
      }

      const ids = pedidos.map((p: any) => p.id);
      const { data: itens } = await db.from('pedido_item')
        .select('xpedido_id, xnm_produto, xqt_item, xvl_unitario')
        .in('xpedido_id', ids)
        .eq('excluido_visivel', false);

      const itensByPedido: Record<number, any[]> = {};
      (itens || []).forEach((i: any) => {
        if (!itensByPedido[i.xpedido_id]) itensByPedido[i.xpedido_id] = [];
        itensByPedido[i.xpedido_id].push(i);
      });

      const result: ReportRow[] = pedidos.map((p: any) => ({
        xnr_pedido: p.xnr_pedido,
        xdt_pedido: p.xdt_pedido,
        xhr_pedido: p.xhr_pedido || '',
        xst_pedido: p.xst_pedido || '',
        xnm_responsavel: p.xnm_responsavel || p.xnm_cliente || 'Consumidor',
        xnm_crianca: p.xnm_crianca || '-',
        itens: itensByPedido[p.id] || [],
      }));

      setRows(result);
      toast({ title: `${result.length} pedido(s) encontrado(s)` });
    } catch (e: any) {
      console.error('Report error:', e);
      toast({ title: 'Erro ao consultar', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [dtConsulta, hrInicio, hrFim, filtroStatus]);

  const fmtHM = (t: string) => t ? t.substring(0, 5) : '';

  const fmtDateTime = (d: string) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const turnoLabel = TURNOS.find(t => t.value === turno)?.label || '';
  const diaLabel = DIAS_SEMANA.find(d => d.value === diaSemana)?.label || '';

  const exportPDF = () => {
    if (rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const ml = 10, mr = 10;
    const cw = pw - ml - mr;
    let y = 15;

    const addHeader = () => {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(nomeEscola || 'Relatório de Lanches', pw / 2, y, { align: 'center' });
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const statusLabel = filtroStatus === 'TODOS' ? 'Todos' : (STATUS_MAP[filtroStatus]?.label || filtroStatus);
      doc.text(`${diaLabel} - ${turnoLabel} | ${new Date(dtConsulta).toLocaleDateString('pt-BR')} | ${fmtHM(hrInicio)} - ${fmtHM(hrFim)} | Status: ${statusLabel}`, pw / 2, y, { align: 'center' });
      y += 8;
    };

    const checkPage = (need: number) => {
      if (y + need > ph - 15) {
        doc.addPage();
        y = 15;
        addHeader();
      }
    };

    addHeader();

    const cols = [
      { x: ml, w: 15, label: 'Pedido' },
      { x: ml + 15, w: 30, label: 'Data/Hora' },
      { x: ml + 45, w: 15, label: 'Status' },
      { x: ml + 60, w: 35, label: 'Responsável' },
      { x: ml + 95, w: 30, label: 'Aluno(s)' },
      { x: ml + 125, w: cw - 125, label: 'Itens' },
    ];

    doc.setFillColor(100, 100, 100);
    doc.rect(ml, y, cw, 6, 'F');
    doc.setTextColor(255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    cols.forEach(c => doc.text(c.label, c.x + 1, y + 4));
    doc.setTextColor(0);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);

    rows.forEach((row, idx) => {
      const itensText = row.itens.map(i => `${i.xqt_item}x ${i.xnm_produto}`).join(', ');
      const itensLines = doc.splitTextToSize(itensText || '-', cols[5].w - 2);
      const criancaLines = doc.splitTextToSize(row.xnm_crianca, cols[4].w - 2);
      const responsavelLines = doc.splitTextToSize(row.xnm_responsavel, cols[3].w - 2);
      const lineCount = Math.max(itensLines.length, criancaLines.length, responsavelLines.length, 1);
      const rowH = lineCount * 3.5 + 2;

      checkPage(rowH);

      if (idx % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(ml, y - 1, cw, rowH, 'F');
      }

      doc.text(String(row.xnr_pedido || ''), cols[0].x + 1, y + 2.5);
      doc.text(fmtDateTime(row.xdt_pedido) || '', cols[1].x + 1, y + 2.5);
      const stLabel = STATUS_MAP[row.xst_pedido]?.label || row.xst_pedido || '';
      doc.text(stLabel, cols[2].x + 1, y + 2.5);
      doc.text(responsavelLines || '', cols[3].x + 1, y + 2.5);
      doc.text(criancaLines || '', cols[4].x + 1, y + 2.5);
      doc.text(itensLines || '', cols[5].x + 1, y + 2.5);

      y += rowH;
    });

    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de pedidos: ${rows.length}`, ml, y);

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    toast({ title: 'PDF gerado com sucesso!' });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={dtConsulta} onChange={e => setDtConsulta(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dia da Semana</Label>
              <Select value={diaSemana} onValueChange={setDiaSemana}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turno</Label>
              <Select value={turno} onValueChange={setTurno}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TURNOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora Início</Label>
              <Input type="time" value={hrInicio} onChange={e => setHrInicio(e.target.value)} className="w-28" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hora Fim</Label>
              <Input type="time" value={hrFim} onChange={e => setHrFim(e.target.value)} className="w-28" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={search} disabled={loading} className="gap-1">
              <Search className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Consultar
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} disabled={rows.length === 0} className="gap-1 ml-auto">
              <Printer className="w-3.5 h-3.5" /> Imprimir PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card ref={tableRef}>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Relatório de Lanches — {diaLabel}, {turnoLabel} ({fmtHM(hrInicio)} - {fmtHM(hrFim)})</span>
            <span className="text-muted-foreground text-xs">{rows.length} pedido(s)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 && !loading ? (
            <p className="text-center text-muted-foreground py-10">Nenhum pedido encontrado. Ajuste os filtros e consulte.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20"># Pedido</TableHead>
                  <TableHead className="w-36">Data/Hora</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Aluno(s)</TableHead>
                  <TableHead>Itens do Pedido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const st = STATUS_MAP[r.xst_pedido] || { label: r.xst_pedido, color: '' };
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{r.xnr_pedido}</TableCell>
                      <TableCell className="text-xs">{fmtDateTime(r.xdt_pedido)}</TableCell>
                      <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                      <TableCell>{r.xnm_responsavel}</TableCell>
                      <TableCell>{r.xnm_crianca}</TableCell>
                      <TableCell className="text-xs">
                        {r.itens.length > 0
                          ? r.itens.map((it, j) => (
                              <span key={j} className="inline-block mr-2">
                                {it.xqt_item}x {it.xnm_produto}
                              </span>
                            ))
                          : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
