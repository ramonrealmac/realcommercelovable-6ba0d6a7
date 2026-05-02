// ============================================================
// Report Builder Pro — Executor de Relatório
// Filtros + execução + diálogo de destino (sem preview automático)
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import type { IRpbRelatorio, IRpbFiltro, IRpbConexao } from '../../types';
import { rpbListFiltros, rpbExecuteQuery } from '../../services/rpbService';
import { generateReportHtml } from '../renderer/rpbRenderer';
import { emptyLayout } from '../../types';
import { Play, Printer, Loader2, FileText, FileSpreadsheet, Monitor, X, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import RpbSearchDialog from './RpbSearchDialog';

interface Props {
  relatorio: IRpbRelatorio;
  conexoes: IRpbConexao[];
  initialValues?: Record<string, any>;
  empresaLogo?: string;
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
const RpbExecutor: React.FC<Props> = ({ relatorio, conexoes, initialValues, empresaLogo }) => {
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
  const [searchFilter, setSearchFilter] = useState<IRpbFiltro | null>(null);

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
      empresa_logo:        empresaLogo || '',
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
    // Injeta CSS e Scripts de forma robusta
    const styles = `
      @media screen {
        body > * { visibility: hidden !important; }
        #rpb-aguarde { 
          visibility: visible !important; 
          position: fixed; inset: 0; 
          display: flex !important; flex-direction: column; align-items: center; justify-content: center; 
          background: #ffffff; font-family: 'Inter', Arial, sans-serif; z-index: 99999; 
        }
      }
      @media print {
        #rpb-aguarde { display: none !important; }
        body > * { visibility: visible !important; }
      }
    `;
    
    let printReadyHtml = htmlContent;
    if (printReadyHtml.includes('</head>')) {
      printReadyHtml = printReadyHtml.replace('</head>', `<style>${styles}</style></head>`);
    } else if (printReadyHtml.includes('</style>')) {
      printReadyHtml = printReadyHtml.replace('</style>', `</style><style>${styles}</style>`);
    }

    const waitHtml = `<div id="rpb-aguarde">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
      <div style="font-size:16px;color:#1e40af;margin:12px 0 4px;font-weight:bold">Preparando impressão...</div>
      <div style="font-size:13px;color:#666">O diálogo de impressão será aberto em instantes.</div>
    </div>`;

    printReadyHtml = printReadyHtml.replace('<body>', `<body>${waitHtml}`);

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast.error('Popup bloqueado. Habilite popups para imprimir.'); return; }
    win.document.write(printReadyHtml);
    win.document.close();
    win.focus();
    if (autoPrint) setTimeout(() => win.print(), 700);
  };

  // ── Gera PDF e abre automaticamente numa nova aba ─────────
  const openPdfWindow = async (htmlContent: string) => {
    const loadingToast = toast.loading('Gerando PDF...');
    try {
      // Carrega html2pdf.js do CDN se ainda não estiver carregado
      if (!(window as any).html2pdf) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Falha ao carregar html2pdf.js'));
          document.head.appendChild(script);
        });
      }

      // Cria iframe invisível para renderizar o HTML
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('Não foi possível criar o documento de renderização.');
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Aguarda imagens carregarem
      await new Promise(r => setTimeout(r, 800));

      const currentLayout = layout || relatorio.layout_json;
      const pageSize = (currentLayout as any)?.pageSize?.toLowerCase() || 'a4';
      const orientation = (currentLayout as any)?.orientation || 'portrait';
      const margins = (currentLayout as any)?.margins || { top: 10, right: 10, bottom: 10, left: 10 };

      // Remove o padding do wrapper para evitar margem dupla no PDF
      // (html2pdf aplica as margens via sua própria opção 'margin')
      const pdfHtml = htmlContent.replace(
        /\.rpb-margin-wrap\s*\{[^}]*\}/g,
        '.rpb-margin-wrap { padding: 0 !important; }'
      );
      iframeDoc.open();
      iframeDoc.write(pdfHtml);
      iframeDoc.close();
      await new Promise(r => setTimeout(r, 500));

      const pdfBlob: Blob = await (window as any).html2pdf()
        .set({
          // [top, right, bottom, left] em mm — usa as margens salvas no layout
          margin: [margins.top, margins.right, margins.bottom, margins.left],
          filename: `${relatorio.nome}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: pageSize, orientation },
        })
        .from(iframeDoc.body)
        .outputPdf('blob');

      document.body.removeChild(iframe);

      // Abre o PDF numa nova aba
      const url = URL.createObjectURL(pdfBlob);
      const tab = window.open(url, '_blank');
      if (!tab) {
        // Fallback: download direto
        const a = document.createElement('a');
        a.href = url;
        a.download = `${relatorio.nome}.pdf`;
        a.click();
      }
      // Libera a URL após 60s
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      toast.dismiss(loadingToast);
      toast.success('PDF gerado e aberto com sucesso!');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Erro ao gerar PDF: ' + (err?.message || err));
    }
  };

  // ── Acoes por destino ────────────────────────────────────
  const handleDestino = (dest: Destino) => {
    setShowDestino(false);
    if (dest === 'impressora') openPrintWindow(html, true);
    if (dest === 'preview') {
      setPreviewHtml(html);
      setShowPreviewInline(true);
    }
    if (dest === 'pdf') openPdfWindow(html);
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

      case 'lista_dinamica': {
        const val = valores[f.nome];
        let label = 'Clique para selecionar...';
        if (Array.isArray(val)) {
          label = val.length > 0 ? `${val.length} selecionado(s)` : 'Clique para selecionar...';
        } else if (val) {
          label = String(val);
        }

        return (
          <div className="flex gap-1">
            <input 
              readOnly 
              value={label} 
              className={cls + ' cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap'} 
              onClick={() => setSearchFilter(f)} 
            />
            <button 
              onClick={() => setSearchFilter(f)}
              className="px-2 py-1.5 border border-border rounded bg-muted hover:bg-accent transition-colors"
            >
              <Search size={14} />
            </button>
          </div>
        );
      }

      default:
        return <input type="text" value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} placeholder={f.label} className={cls} />;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Diálogo de Busca Dinâmica */}
      {searchFilter && (() => {
        const [vField, lField, multiStr] = (searchFilter.opcoes_fixas || '').split(';');
        return (
          <RpbSearchDialog
            open={!!searchFilter}
            title={searchFilter.label}
            onClose={() => setSearchFilter(null)}
            sql={searchFilter.query_opcoes}
            valueField={vField || 'id'}
            labelField={lField || 'nome'}
            multi={multiStr === 'true'}
            onSelect={(rows) => {
              const multi = multiStr === 'true';
              if (multi) {
                setVal(searchFilter.nome, rows.map(r => r[vField || 'id']));
              } else {
                setVal(searchFilter.nome, rows[0]?.[vField || 'id'] || '');
              }
            }}
          />
        );
      })()}
      {/* Painel de filtros */}
      <div className="flex-shrink-0 border-b border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold">{relatorio.nome}</h2>
            {relatorio.descricao && <p className="text-xs text-muted-foreground">{relatorio.descricao}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          </div>
        </div>

        {filtros.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            {filtros.map(f => (
              <div key={f.rpb_filtro_id}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {f.label} {f.obrigatorio && <span className="text-destructive">*</span>}
                </label>
                {renderFiltro(f)}
              </div>
            ))}
            <div className="flex items-center gap-2">
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
        )}

        {filtros.length === 0 && (
          <div className="space-y-3">
            {!executed && (
              <p className="text-xs text-muted-foreground">
                Este relatorio nao possui filtros. Clique em "Gerar Relatorio" para executar.
              </p>
            )}
            <div className="flex items-center gap-2">
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
                <div />
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
