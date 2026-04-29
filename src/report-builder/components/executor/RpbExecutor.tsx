// ============================================================
// Report Builder Pro — Executor de Relatório
// Formulário de filtros + execução + preview/impressão
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import type { IRpbRelatorio, IRpbFiltro, IRpbConexao } from '../../types';
import { rpbListFiltros, rpbExecuteQuery } from '../../services/rpbService';
import { generateReportHtml } from '../renderer/rpbRenderer';
import { emptyLayout } from '../../types';
import { Play, Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  relatorio: IRpbRelatorio;
  conexoes: IRpbConexao[];
}

const RpbExecutor: React.FC<Props> = ({ relatorio, conexoes }) => {
  const [filtros, setFiltros]       = useState<IRpbFiltro[]>([]);
  const [valores, setValores]       = useState<Record<string, any>>({});
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState<any[]>([]);
  const [extraVarsRef, setExtraVarsRef] = useState<Record<string, any>>({});
  const [layout, setLayoutRef]      = useState<any>(null);
  const [html, setHtml]             = useState<string>('');
  const [executed, setExecuted]     = useState(false);
  const [printLimit, setPrintLimit] = useState<number>(100);

  useEffect(() => {
    if (relatorio.rpb_relatorio_id) {
      rpbListFiltros(relatorio.rpb_relatorio_id).then(f => {
        setFiltros(f);
        // preenche valores padrão
        const defaults: Record<string, any> = {};
        f.forEach(fi => { defaults[fi.nome] = fi.valor_padrao || ''; });
        setValores(defaults);
        setData([]); setHtml(''); setExecuted(false);
      });
    }
  }, [relatorio.rpb_relatorio_id]);

  const setVal = (nome: string, val: any) =>
    setValores(prev => ({ ...prev, [nome]: val }));

  const validate = (): boolean => {
    for (const f of filtros) {
      if (f.obrigatorio && (!valores[f.nome] && valores[f.nome] !== 0)) {
        toast.error(`Campo obrigatório: ${f.label}`);
        return false;
      }
    }
    return true;
  };

  const buildParams = (): Record<string, any> => {
    const params: Record<string, any> = { ...valores };
    // date_range expande em _ini e _fim
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
    const conexao = conexoes.find(c => c.rpb_conexao_id === relatorio.rpb_conexao_id) || null;
    const params = buildParams();
    const { data: rows, error } = await rpbExecuteQuery(relatorio.query_sql, params, conexao);
    setLoading(false);
    if (error) { toast.error('Erro na query: ' + error); return; }

    setData(rows);
    const currentLayout = relatorio.layout_json || emptyLayout();

    // Monta variáveis de sistema + valores de filtros para uso nos componentes de texto
    const filtroVars: Record<string, any> = {};
    filtros.forEach(f => {
      const v = params[f.nome] ?? params[`${f.nome}_ini`] ?? '';
      filtroVars[f.nome] = v !== undefined && v !== '' ? v : '';
      filtroVars[`filtro_${f.nome}`] = filtroVars[f.nome];
    });
    const evars = {
      relatorio_nome:        relatorio.nome,
      relatorio_descricao:   relatorio.descricao || '',
      total_registros:       rows.length,
      ...filtroVars,
    };
    setExtraVarsRef(evars);
    setLayoutRef(currentLayout);

    const generatedHtml = generateReportHtml(currentLayout, rows, evars);
    setHtml(generatedHtml);
    setExecuted(true);
    toast.success(`${rows.length} registro(s) carregado(s).`);
  }, [relatorio, conexoes, valores, filtros]);

  // Abre preview de impressão com todos os registros
  const handlePrintAll = () => {
    if (!html) return;
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (!win) { toast.error('Popup bloqueado. Habilite popups para imprimir.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  // Abre preview de impressão limitado (evita lentidão com muitos registros)
  const handlePrintPreview = () => {
    if (!layout || data.length === 0) return;
    const limited = data.slice(0, printLimit);
    const previewHtml = generateReportHtml(layout, limited, {
      ...extraVarsRef,
      total_registros: data.length,
      preview_aviso: `[PREVIEW — ${limited.length} de ${data.length} registros]`,
    });
    const win = window.open('', '_blank', 'width=1000,height=750');
    if (!win) { toast.error('Popup bloqueado. Habilite popups para imprimir.'); return; }
    win.document.write(previewHtml);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  };

  // ── Render de cada tipo de filtro ─────────────────────────
  const renderFiltro = (f: IRpbFiltro) => {
    const cls = 'w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-1 focus:ring-ring outline-none';

    switch (f.tipo) {
      case 'date':
        return <input type="date" value={valores[f.nome] || ''} onChange={e => setVal(f.nome, e.target.value)} className={cls} />;

      case 'date_range':
        return (
          <div className="flex items-center gap-2">
            <input type="date"
              value={valores[f.nome]?.ini || ''}
              onChange={e => setVal(f.nome, { ...valores[f.nome], ini: e.target.value })}
              className={cls} />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date"
              value={valores[f.nome]?.fim || ''}
              onChange={e => setVal(f.nome, { ...valores[f.nome], fim: e.target.value })}
              className={cls} />
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
            <option value="">— Todos —</option>
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
            {executed && (
              <>
                {/* Limite de linhas para o preview rápido */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Preview:</span>
                  <input
                    type="number" min={10} max={10000} step={50}
                    value={printLimit}
                    onChange={e => setPrintLimit(Math.max(10, parseInt(e.target.value) || 100))}
                    className="w-16 border border-border rounded px-1 py-0.5 text-xs bg-card text-center"
                    title="Número máximo de linhas no preview de impressão"
                  />
                  <span>lin.</span>
                </div>
                <button onClick={handlePrintPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-secondary border border-border hover:bg-secondary/80"
                  title={`Abre impressão com as primeiras ${printLimit} linhas (mais rápido)`}>
                  <Printer className="w-4 h-4" /> Preview Rápido
                </button>
                <button onClick={handlePrintAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded border border-border hover:bg-secondary/60"
                  title="Imprime todos os registros (pode ser lento)">
                  <Printer className="w-4 h-4" /> Imprimir Tudo
                </button>
              </>
            )}
            <button onClick={handleExecute} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {loading ? 'Gerando...' : 'Gerar Relatório'}
            </button>
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
          <p className="text-xs text-muted-foreground">Este relatório não possui filtros parametrizados. Clique em "Gerar Relatório".</p>
        )}
      </div>

      {/* Preview do relatório */}
      <div className="flex-1 overflow-auto bg-gray-100">
        {!executed && !loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Configure os filtros e clique em "Gerar Relatório"
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Processando...
          </div>
        )}
        {executed && html && (
          <div className="flex justify-center p-6">
            <iframe
              srcDoc={html}
              title="Preview do Relatório"
              style={{
                width: '210mm',
                minHeight: '297mm',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                background: '#fff',
                display: 'block',
              }}
              sandbox="allow-same-origin"
              onLoad={(e) => {
                const iframe = e.currentTarget;
                try {
                  const doc = iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
                    if (h > 0) iframe.style.height = h + 'px';
                  }
                } catch (_) { /* cross-origin guard */ }
              }}
            />
          </div>
        )}
      </div>

      {executed && (
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-1.5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{data.length} registro(s)</span>
          <span className="text-muted-foreground">•</span>
          <span>"Preview Rápido" limita a {printLimit} linhas para agilizar a visualização</span>
          <span className="ml-auto">"Imprimir Tudo" usa todos os {data.length} registros</span>
        </div>
      )}
    </div>
  );
};

export default RpbExecutor;
