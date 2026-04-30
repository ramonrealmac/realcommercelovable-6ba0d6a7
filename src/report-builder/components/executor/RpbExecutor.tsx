// ============================================================
// Report Builder Pro — Executor de Relatório
// Filtros + execução + diálogo de destino (sem preview automático)
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import type { IRpbRelatorio, IRpbFiltro, IRpbConexao } from '../../types';
import { rpbListFiltros, rpbExecuteQuery } from '../../services/rpbService';
import { generateReportHtml } from '../renderer/rpbRenderer';
import { emptyLayout } from '../../types';
import { Play, Printer, Loader2, FileText, FileSpreadsheet, Monitor, X, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  relatorio: IRpbRelatorio;
  conexoes: IRpbConexao[];
  initialValues?: Record<string, any>;
}

// ── Tipos de destino ─────────────────────────────────────────
type Destino = 'impressora' | 'preview' | 'pdf' | 'excel' | 'txt';

const DESTINOS: { key: Destino; icon: React.ReactNode; label: string; desc: string; color: string }[] = [
  { key: 'impressora', icon: <Printer size={28} />,        label: 'Impressora',   desc: 'Enviar diretamente para impressão',  color: 'text-blue-600'    },
  { key: 'preview',    icon: <Monitor size={28} />,        label: 'Preview',      desc: 'Visualizar antes de imprimir',       color: 'text-violet-600'  },
  { key: 'pdf',        icon: <FileText size={28} />,       label: 'PDF',          desc: 'Salvar como arquivo PDF',            color: 'text-red-500'     },
  { key: 'excel',      icon: <FileSpreadsheet size={28}/>, label: 'Excel / CSV',  desc: 'Exportar dados para planilha',       color: 'text-emerald-600' },
  { key: 'txt',        icon: <Download size={28} />,       label: 'Texto (TXT)',  desc: 'Exportar como arquivo de texto',     color: 'text-slate-500'   },
];

// ── Exportações ───────────────────────────────────────────────
function exportCsv(data: any[], title: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const header = keys.map(k => `"${k}"`).join(';');
  const rows = data.map(r => keys.map(k => `"${String(r[k] ?? '')}"`).join(';'));
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportTxt(data: any[], title: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const widths = keys.map(k => Math.max(k.length, ...data.map(r => String(r[k] ?? '').length)));
  const line   = widths.map(w => '-'.repeat(w)).join('-+-');
  const header = keys.map((k, i) => k.padEnd(widths[i])).join(' | ');
  const rows   = data.map(r => keys.map((k, i) => String(r[k] ?? '').padEnd(widths[i])).join(' | '));
  const txt = [title, '', header, line, ...rows, '', `Total: ${data.length} registro(s)`].join('\n');
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${title}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ── Componente Principal ──────────────────────────────────────
const RpbExecutor: React.FC<Props> = ({ relatorio, conexoes, initialValues }) => {
  const [filtros, setFiltros]         = useState<IRpbFiltro[]>([]);
  const [valores, setValores]         = useState<Record<string, any>>(initialValues || {});
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<any[]>([]);
  const [extraVarsRef, setExtraVarsRef] = useState<Record<string, any>>({});
  const [layout, setLayoutRef]        = useState<any>(null);
  const [html, setHtml]               = useState<string>('');
  const [executed, setExecuted]       = useState(false);
  const [showDestino, setShowDestino] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreviewInline, setShowPreviewInline] = useState(false);

  useEffect(() => {
    if (relatorio.rpb_relatorio_id) {
      rpbListFiltros(relatorio.rpb_relatorio_id).then(f => {
        setFiltros(f);
        const defaults: Record<string, any> = {};
        f.forEach(fi => { defaults[fi.nome] = fi.valor_padrao || ''; });
        setValores(prev => ({ ...defaults, ...initialValues, ...prev }));
        setData([]); setHtml(''); setExecuted(false); setShowPreviewInline(false);
      });
    }
  }, [relatorio.rpb_relatorio_id]);

  const setVal = (nome: string, val: any) => {
    setValores(prev => ({ ...prev, [nome]: val }));
    if (executed) setExecuted(false);
    if (showPreviewInline) setShowPreviewInline(false);
  };

  const validate = (): boolean => {
    for (const f of filtros) {
      if (f.obrigatorio && (!valores[f.nome] && valores[f.nome] !== 0)) {
        toast.error(`Campo obrigatorio: ${f.label}`);
        return false;
      }
    }
    return true;
  };

  const buildParams = (): Record<string, any> => {
    const params: Record<string, any> = { ...valores };
    filtros.filter(f => f.tipo === 'date_range').forEach(f => {
      const v = valores[f.nome] || {};
      params[`${f.nome}_ini`] = v.ini || '';
      params[`${f.nome}_fim`] = v.fim || '';
      delete params[f.nome];
    });
    return params;
  };

  const handleExecute = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    setShowPreviewInline(false);
    const conexao = conexoes.find(c => c.rpb_conexao_id === relatorio.rpb_conexao_id) || null;
    const params = buildParams();
    const { data: rows, error } = await rpbExecuteQuery(relatorio.query_sql, params, conexao);
    setLoading(false);
    if (error) { toast.error('Erro na query: ' + error); return; }

    setData(rows);
    const currentLayout = relatorio.layout_json || emptyLayout();

    const filtroVars: Record<string, any> = {};
    filtros.forEach(f => {
      const v = params[f.nome] ?? params[`${f.nome}_ini`] ?? '';
      filtroVars[f.nome] = v !== undefined && v !== '' ? v : '';
      filtroVars[`filtro_${f.nome}`] = filtroVars[f.nome];
    });
    const evars = {
      relatorio_nome:      relatorio.nome,
      relatorio_descricao: relatorio.descricao || '',
      total_registros:     rows.length,
      ...filtroVars,
    };
    setExtraVarsRef(evars);
    setLayoutRef(currentLayout);

    const generatedHtml = generateReportHtml(currentLayout, rows, evars);
    setHtml(generatedHtml);
    setExecuted(true);
    toast.success(`${rows.length} registro(s) carregado(s).`);
    // Abre diálogo de destino ao terminar
    setShowDestino(true);
  }, [relatorio, conexoes, valores, filtros]);

  // Abre popup com o relatorio, ocultando o conteudo na tela
  // para evitar que apareca por tras do dialogo de impressao
  const openPrintWindow = (htmlContent: string, autoPrint: boolean) => {
    // Injeta CSS que oculta o corpo no modo tela
    const printReadyHtml = htmlContent.replace(
      '</style>',
      `  @media screen {
        body > * { visibility: hidden !important; }
        #rpb-aguarde { visibility: visible !important; position: fixed; inset: 0; display: flex !important; flex-direction: column; align-items: center; justify-content: center; background: #fff; font-family: Arial, sans-serif; z-index: 9999; }
      }
      @media print {
        #rpb-aguarde { display: none !important; }
        body > * { visibility: visible !important; }
      }
    </style>`
    ).replace(
      '<body>',
      `<body><div id="rpb-aguarde"><svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg><div style="font-size:16px;color:#1e40af;margin:12px 0 4px;font-weight:bold">Preparando impressao...</div><div style="font-size:13px;color:#666">O dialogo de impressao sera aberto em instantes.</div></div>`
    );

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Popup bloqueado. Habilite popups para imprimir.'); return; }
    win.document.write(printReadyHtml);
    win.document.close();
    win.focus();
    if (autoPrint) setTimeout(() => win.print(), 700);
  };

  // ── Acoes por destino ────────────────────────────────────
  const handleDestino = (dest: Destino) => {
    setShowDestino(false);
    if (dest === 'impressora') openPrintWindow(html, true);
    if (dest === 'preview') {
      setPreviewHtml(html);
      setShowPreviewInline(true);
    }
    if (dest === 'pdf') openPrintWindow(html, true);
    if (dest === 'excel') exportCsv(data, relatorio.nome);
    if (dest === 'txt')   exportTxt(data, relatorio.nome);
  };

  // ── Render de filtros ────────────────────────────────────
  const renderFiltro = (f: IRpbFiltro) => {
    const cls = 'w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-1 focus:ring-ring outline-none';

    switch (f.tipo) {
      case 'date':
        return <input type="date" value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} className={cls} />;

      case 'date_range':
        return (
          <div className="flex items-center gap-2">
            <input type="date" value={valores[f.nome]?.ini || ''}
              onChange={e => setVal(f.nome, { ...valores[f.nome], ini: e.target.value })} className={cls} />
            <span className="text-xs text-muted-foreground">ate</span>
            <input type="date" value={valores[f.nome]?.fim || ''}
              onChange={e => setVal(f.nome, { ...valores[f.nome], fim: e.target.value })} className={cls} />
          </div>
        );

      case 'number':
        return <input type="number" value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} className={cls} />;

      case 'boolean':
        return (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!valores[f.nome]} onChange={e => setVal(f.nome, e.target.checked)} />
            {f.label}
          </label>
        );

      case 'select': {
        const opts = f.opcoes_fixas.split('|').map(o => o.trim()).filter(Boolean);
        return (
          <select value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} className={cls}>
            <option value="">Todos</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      }

      default:
        return <input type="text" value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} placeholder={f.label} className={cls} />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Painel de filtros */}
      <div className="flex-shrink-0 border-b border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold">{relatorio.nome}</h2>
            {relatorio.descricao && <p className="text-xs text-muted-foreground">{relatorio.descricao}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {loading ? (
              <button disabled className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded bg-primary/70 text-primary-foreground cursor-wait">
                <Loader2 className="w-4 h-4 animate-spin" /> Processando...
              </button>
            ) : !executed ? (
              <button onClick={handleExecute}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all active:scale-95">
                <Play className="w-4 h-4" /> Gerar Relatório
              </button>
            ) : (
              <button onClick={() => setShowDestino(true)}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 animate-in fade-in zoom-in-95 duration-300 active:scale-95">
                <Printer className="w-4 h-4" /> Imprimir / Exportar
              </button>
            )}
          </div>
        </div>

        {filtros.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtros.map(f => (
              <div key={f.rpb_filtro_id}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {f.label} {f.obrigatorio && <span className="text-destructive">*</span>}
                </label>
                {renderFiltro(f)}
              </div>
            ))}
          </div>
        )}

        {filtros.length === 0 && !executed && (
          <p className="text-xs text-muted-foreground">
            Este relatorio nao possui filtros. Clique em "Gerar Relatorio" para executar.
          </p>
        )}
      </div>

      {/* Área central - status ou preview */}
      <div className="flex-1 overflow-auto bg-muted/30">
        {!executed && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Play size={40} className="opacity-20" />
            <p className="text-sm">Configure os filtros e clique em "Gerar Relatorio"</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Processando...
          </div>
        )}
        {/* Preview inline (somente quando usuario escolhe Preview) */}
        {showPreviewInline && previewHtml && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
              <span className="text-xs font-semibold">Visualizacao</span>
              <div className="flex gap-2">
                <button onClick={() => setShowDestino(true)}
                  className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  <Printer size={12} className="inline mr-1" />Imprimir
                </button>
                <button onClick={() => { setShowPreviewInline(false); }}
                  className="text-xs px-3 py-1 rounded border border-border hover:bg-accent">
                  <X size={12} className="inline mr-1" />Fechar
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto" style={{ background: '#e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
              <iframe
                srcDoc={previewHtml}
                title="Preview do Relatorio"
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                  background: '#ffffff',
                  display: 'block',
                  backgroundColor: '#ffffff',
                }}
                sandbox="allow-same-origin"
                onLoad={(e) => {
                  const iframe = e.currentTarget;
                  // Força fundo branco dentro do iframe
                  try {
                    const doc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc) {
                      doc.documentElement.style.background = '#ffffff';
                      doc.body.style.background = '#ffffff';
                      const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
                      if (h > 0) iframe.style.height = h + 'px';
                    }
                  } catch (_) {}
                }}
              />
              </div>
            </div>
          </div>
        )}
        {/* Mensagem de sucesso após executar (sem preview automático) */}
        {executed && !showPreviewInline && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <FileText size={32} className="text-emerald-600" />
            </div>
            <p className="text-sm font-semibold">{data.length} registro(s) carregado(s)</p>
            <p className="text-xs text-muted-foreground">Utilize os botões no topo para imprimir ou exportar os resultados.</p>
          </div>
        )}
      </div>

      {/* Status bar */}
      {executed && (
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{data.length} registro(s)</span>
          <span className="ml-auto">{relatorio.nome}</span>
        </div>
      )}

      {/* ── Dialogo de Destino ──────────────────────────────── */}
      {showDestino && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">Destino do Relatorio</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Como deseja receber o relatorio?</p>
              </div>
              <button onClick={() => setShowDestino(false)} className="p-1 rounded hover:bg-accent">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-1 gap-2">
              {DESTINOS.map(d => (
                <button
                  key={d.key}
                  onClick={() => handleDestino(d.key)}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:bg-accent hover:border-primary transition-all text-left group"
                >
                  <span className={`${d.color} group-hover:scale-110 transition-transform`}>{d.icon}</span>
                  <div>
                    <div className="font-semibold text-sm">{d.label}</div>
                    <div className="text-xs text-muted-foreground">{d.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <button onClick={() => setShowDestino(false)}
                className="text-xs px-4 py-1.5 rounded border border-border hover:bg-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RpbExecutor;
