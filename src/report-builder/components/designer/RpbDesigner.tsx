// ============================================================
// Report Builder Pro — Designer Principal
// Orquestra: Paleta + Canvas + Propriedades
// ============================================================
import React, { useState, useCallback, useEffect } from 'react';
import type { RpbLayout, RpbBandName, RpbComponent, RpbGroupDef, IRpbRelatorio } from '../../types';
import {
  emptyLayout, newId, DEFAULT_STYLE, emptyBand,
  BAND_LABELS, BAND_ORDER,
} from '../../types';
import { rpbExecuteQuery } from '../../services/rpbService';
import RpbPalette    from './RpbPalette';
import RpbCanvas     from './RpbCanvas';
import RpbProperties from './RpbProperties';
import { Save, Eye, Plus, Trash2, RefreshCw, Loader2, HelpCircle, List, X, Copy,
  AlignLeft, AlignRight, AlignHorizontalJustifyCenter,
  AlignStartHorizontal, AlignEndHorizontal, AlignCenterVertical,
  Maximize2, Move } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  relatorio: IRpbRelatorio;
  queryColumns: string[];
  onSave: (layout: RpbLayout) => Promise<void>;
  onPreview: (layout: RpbLayout) => void;
}

const RpbDesigner: React.FC<Props> = ({ relatorio, queryColumns: qColsFromParent, onSave, onPreview }) => {
  const [layout, setLayout]             = useState<RpbLayout>(() => relatorio.layout_json || emptyLayout());
  const [activeBand, setActiveBand]     = useState<RpbBandName | null>(null);
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);
  const [activeTab, setActiveTab]       = useState<'canvas' | 'groups' | 'page'>('canvas');
  const [saving, setSaving]             = useState(false);
  const [queryColumns, setQueryColumns] = useState<string[]>(qColsFromParent);
  const [detecting, setDetecting]       = useState(false);
  const [showHelp, setShowHelp]         = useState(false);
  const [showFields, setShowFields]     = useState(false);

  // Variáveis de sistema sempre disponíveis
  const SYSTEM_VARS = [
    { v: '{data}',             d: 'Data atual' },
    { v: '{hora}',             d: 'Hora atual' },
    { v: '{data_emissao}',     d: 'Data de emissão' },
    { v: '{hora_emissao}',     d: 'Hora de emissão' },
    { v: '{datetime_emissao}', d: 'Data e hora de emissão' },
    { v: '{relatorio_nome}',   d: 'Nome do relatório' },
    { v: '{total_registros}',  d: 'Total de registros' },
    { v: '{relatorio_descricao}', d: 'Descrição do relatório' },
    { v: '{empresa_logo}',     d: 'URL da logomarca da empresa' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copiado: ${text}`);
    }).catch(() => {
      toast.info(`Copie manualmente: ${text}`);
    });
  };

  // Sincroniza layout quando relatório muda
  useEffect(() => {
    setLayout(relatorio.layout_json || emptyLayout());
    setActiveBand(null);
    setSelectedIds([]);
  }, [relatorio.rpb_relatorio_id]);

  // ── Auto-detecta colunas ao abrir o designer ──────────────
  // Usa LIMIT 1 para ser rápido — não filtra por parâmetros
  useEffect(() => {
    if (qColsFromParent.length > 0) {
      setQueryColumns(qColsFromParent);
      return;
    }
    if (!relatorio.query_sql?.trim()) return;

    const detect = async () => {
      setDetecting(true);
      // Remove cláusulas com {{variaveis}} ou {variaveis} não preenchidas 
      // Substituímos por NULL para tentar manter a sintaxe SQL válida
      const safeSql = relatorio.query_sql.replace(/\{{1,2}[^}]+\}{1,2}/g, 'NULL');
      // Usamos WHERE 1=0 para obter apenas o esquema sem processar dados
      const limitedSql = `SELECT * FROM (${safeSql}) __rpb_detect__ WHERE 1=0`;
      const { data, error } = await rpbExecuteQuery(limitedSql, {});
      setDetecting(false);
      if (!error) {
        // Mesmo com WHERE 1=0, o RPC do Supabase deve retornar as chaves do objeto (esquema)
        // Se não retornar nada (array vazio sem chaves), tentamos com LIMIT 1
        if (data && data.length > 0) {
          setQueryColumns(Object.keys(data[0]));
        } else {
          const fallbackSql = `SELECT * FROM (${safeSql}) __rpb_detect__ LIMIT 1`;
          const { data: fData } = await rpbExecuteQuery(fallbackSql, {});
          if (fData && fData.length > 0) setQueryColumns(Object.keys(fData[0]));
        }
      }
    };
    detect();
  }, [relatorio.rpb_relatorio_id, relatorio.query_sql]); // eslint-disable-line

  // ── Detectar colunas manualmente (botão) ─────────────────
  const handleDetectColumns = async () => {
    if (!relatorio.query_sql?.trim()) { toast.warning('Query SQL vazia — salve a query antes.'); return; }
    setDetecting(true);
    const safeSql = relatorio.query_sql.replace(/\{{1,2}[^}]+\}{1,2}/g, 'NULL');
    const limitedSql = `SELECT * FROM (${safeSql}) __rpb_detect__ LIMIT 1`;
    const { data, error } = await rpbExecuteQuery(limitedSql, {});
    setDetecting(false);
    if (error) { toast.error('Erro ao detectar colunas: ' + error); return; }
    if (data.length === 0) { toast.warning('Query não retornou dados. Verifique a SQL.'); return; }
    const cols = Object.keys(data[0]);
    setQueryColumns(cols);
    toast.success(`${cols.length} coluna(s) detectada(s): ${cols.slice(0, 6).join(', ')}${cols.length > 6 ? '...' : ''}`);
  };

  // ── Componente selecionado (apenas 1 para propriedades) ─────
  // Busca em TODAS as bandas (cross-band)
  const selectedComp = selectedIds.length === 1
    ? (() => {
        for (const bandName of Object.keys(layout.bands) as (keyof typeof layout.bands)[]) {
          const found = layout.bands[bandName].components.find(c => c.id === selectedIds[0]);
          if (found) return found;
        }
        return null;
      })()
    : null;

  // ── Multi-seleção cross-band ─────────────────────────────
  // Ao clicar num componente, ativa automaticamente sua banda
  const handleSelectComponent = (id: string, bandName: RpbBandName, multi: boolean) => {
    // Sempre ativa a banda do componente clicado por último
    setActiveBand(bandName);
    if (multi) {
      setSelectedIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleClearSelection = () => setSelectedIds([]);

  // ── Alinhamento cross-band ────────────────────────────────
  // A referência é SEMPRE o primeiro componente clicado (selectedIds[0]).
  // Os demais itens selecionados copiam a propriedade do primeiro.
  // Opera em TODAS as bandas onde há componentes selecionados.
  const applyAlignment = (op: string) => {
    if (selectedIds.length < 2) return;

    // Mapeia id -> componente (de qualquer banda)
    const allComps: Record<string, { comp: RpbComponent; band: RpbBandName }> = {};
    for (const bandName of Object.keys(layout.bands) as RpbBandName[]) {
      for (const comp of layout.bands[bandName].components) {
        allComps[comp.id] = { comp, band: bandName };
      }
    }

    // ref = primeiro componente clicado
    const refEntry = allComps[selectedIds[0]];
    if (!refEntry) return;
    const ref = refEntry.comp;

    // Componentes selecionados (exceto o ref para distribute)
    const selEntries = selectedIds
      .map(id => allComps[id])
      .filter(Boolean);
    if (selEntries.length < 2) return;

    // Calcula patch por componente
    const patches: Record<string, Partial<RpbComponent>> = {};

    if (op === 'align-left') {
      selEntries.forEach(({ comp }) => { patches[comp.id] = { x: ref.x }; });
    } else if (op === 'align-right') {
      const refRight = ref.x + ref.w;
      selEntries.forEach(({ comp }) => { patches[comp.id] = { x: refRight - comp.w }; });
    } else if (op === 'align-top') {
      selEntries.forEach(({ comp }) => { patches[comp.id] = { y: ref.y }; });
    } else if (op === 'align-bottom') {
      const refBottom = ref.y + ref.h;
      selEntries.forEach(({ comp }) => { patches[comp.id] = { y: refBottom - comp.h }; });
    } else if (op === 'align-center-h') {
      const refCx = ref.x + ref.w / 2;
      selEntries.forEach(({ comp }) => { patches[comp.id] = { x: refCx - comp.w / 2 }; });
    } else if (op === 'align-center-v') {
      const refCy = ref.y + ref.h / 2;
      selEntries.forEach(({ comp }) => { patches[comp.id] = { y: refCy - comp.h / 2 }; });
    } else if (op === 'same-width') {
      selEntries.forEach(({ comp }) => { patches[comp.id] = { w: ref.w }; });
    } else if (op === 'same-height') {
      selEntries.forEach(({ comp }) => { patches[comp.id] = { h: ref.h }; });
    } else if (op === 'distribute-h') {
      const sorted = [...selEntries].sort((a, b) => a.comp.x - b.comp.x);
      const first = sorted[0].comp;
      const last  = sorted[sorted.length - 1].comp;
      const totalW = last.x + last.w - first.x;
      const innerW = selEntries.reduce((acc, { comp }) => acc + comp.w, 0);
      const gap = (totalW - innerW) / (sorted.length - 1);
      let curX = first.x;
      for (const { comp } of sorted) {
        patches[comp.id] = { x: curX };
        curX += comp.w + gap;
      }
    } else if (op === 'distribute-v') {
      const sorted = [...selEntries].sort((a, b) => a.comp.y - b.comp.y);
      const first = sorted[0].comp;
      const last  = sorted[sorted.length - 1].comp;
      const totalH = last.y + last.h - first.y;
      const innerH = selEntries.reduce((acc, { comp }) => acc + comp.h, 0);
      const gap = (totalH - innerH) / (sorted.length - 1);
      let curY = first.y;
      for (const { comp } of sorted) {
        patches[comp.id] = { y: curY };
        curY += comp.h + gap;
      }
    }

    // Aplica patches agrupando por banda
    setLayout(prev => {
      const newBands = { ...prev.bands };
      for (const bandName of Object.keys(newBands) as RpbBandName[]) {
        const band = newBands[bandName];
        const hasChanges = band.components.some(c => patches[c.id]);
        if (!hasChanges) continue;
        newBands[bandName] = {
          ...band,
          components: band.components.map(c =>
            patches[c.id] ? { ...c, ...patches[c.id] } : c
          ),
        };
      }
      return { ...prev, bands: newBands };
    });
  };


  const handleAddComponent = useCallback((type: string, defaultW: number, defaultH: number) => {
    if (!activeBand) return;
    const base = { id: newId(), x: 10, y: 5, w: defaultW, h: defaultH };
    let comp: RpbComponent;

    switch (type) {
      case 'text':
        comp = { ...base, type: 'text', content: 'Texto', style: { ...DEFAULT_STYLE } };
        break;
      case 'table':
        comp = {
          ...base, type: 'table',
          columns: queryColumns.slice(0, 6).map((f, i) => ({
            field: f, label: f,
            w: Math.floor(defaultW / Math.max(queryColumns.slice(0, 6).length, 1)),
            align: 'left', format: 'text', totalType: 'none',
          })),
          headerStyle: { ...DEFAULT_STYLE, bold: true, bgColor: '#f1f5f9', border: 'all', borderColor: '#cbd5e1' },
          rowStyle: { ...DEFAULT_STYLE, border: 'bottom', borderColor: '#e2e8f0' },
          altRowBg: '#f8fafc',
          showHeader: true,
          showColumnTotals: false,
        };
        break;
      case 'totalizer':
        comp = {
          ...base, type: 'totalizer',
          field: queryColumns[0] || '',
          operation: 'sum', format: 'currency',
          labelText: 'Total:', scope: 'report',
          style: { ...DEFAULT_STYLE, bold: true, fontSize: 11 },
        };
        break;
      case 'image':
        comp = { ...base, type: 'image', src: '{empresa_logo}', fit: 'contain' };
        break;
      case 'line':
        comp = { ...base, type: 'line', orientation: 'horizontal', color: '#cccccc', thickness: 1, h: 1 };
        break;
      case 'line-v':
        comp = { ...base, type: 'line', orientation: 'vertical', color: '#cccccc', thickness: 1, w: 1, h: defaultH };
        break;
      case 'box':
        comp = { ...base, type: 'box', borderColor: '#cccccc', borderThickness: 1, bgColor: 'transparent', borderRadius: 0 };
        break;
      default:
        return;
    }

    setLayout(prev => ({
      ...prev,
      bands: {
        ...prev.bands,
        [activeBand]: {
          ...prev.bands[activeBand],
          components: [...prev.bands[activeBand].components, comp],
        },
      },
    }));
    setSelectedIds([comp.id]);
  }, [activeBand, queryColumns]);

  // ── Atualizar componente (cross-band) ──────────────────────
  const handleUpdateComponent = useCallback((updated: RpbComponent) => {
    setLayout(prev => {
      const newBands = { ...prev.bands };
      for (const bandName of Object.keys(newBands) as RpbBandName[]) {
        const band = newBands[bandName];
        if (band.components.some(c => c.id === updated.id)) {
          newBands[bandName] = {
            ...band,
            components: band.components.map(c => c.id === updated.id ? updated : c),
          };
          break;
        }
      }
      return { ...prev, bands: newBands };
    });
  }, []);

  // ── Excluir componente (cross-band) ──────────────────────
  const handleDeleteComponent = useCallback(() => {
    if (selectedIds.length === 0) return;
    setLayout(prev => {
      const newBands = { ...prev.bands };
      for (const bandName of Object.keys(newBands) as RpbBandName[]) {
        const band = newBands[bandName];
        if (band.components.some(c => selectedIds.includes(c.id))) {
          newBands[bandName] = {
            ...band,
            components: band.components.filter(c => !selectedIds.includes(c.id)),
          };
        }
      }
      return { ...prev, bands: newBands };
    });
    setSelectedIds([]);
  }, [selectedIds]);

  // ── Salvar ────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    await onSave(layout);
    setSaving(false);
  };

  // ── Grupos ────────────────────────────────────────────────
  const handleAddGroup = () => {
    if (layout.groups.length >= 2) return;
    const level = (layout.groups.length + 1) as 1 | 2;
    const newGroup: RpbGroupDef = {
      level, field: '', label: `Grupo ${level}`,
      pageBreakBefore: false,
      header: emptyBand(12),
      footer: emptyBand(12),
    };
    const bandUpdates: any = {};
    if (level === 1) {
      bandUpdates.group1Header = { ...emptyBand(12), visible: true };
      bandUpdates.group1Footer = { ...emptyBand(12), visible: true };
    } else {
      bandUpdates.group2Header = { ...emptyBand(12), visible: true };
      bandUpdates.group2Footer = { ...emptyBand(12), visible: true };
    }
    setLayout(prev => ({ ...prev, groups: [...prev.groups, newGroup], bands: { ...prev.bands, ...bandUpdates } }));
  };

  const handleRemoveGroup = (level: 1 | 2) => {
    const bandUpdates: any = {};
    if (level === 1) {
      bandUpdates.group1Header = { ...layout.bands.group1Header, visible: false };
      bandUpdates.group1Footer = { ...layout.bands.group1Footer, visible: false };
    } else {
      bandUpdates.group2Header = { ...layout.bands.group2Header, visible: false };
      bandUpdates.group2Footer = { ...layout.bands.group2Footer, visible: false };
    }
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.level !== level),
      bands: { ...prev.bands, ...bandUpdates },
    }));
  };

  const updateGroup = (level: 1 | 2, patch: Partial<RpbGroupDef>) => {
    setLayout(prev => ({
      ...prev,
      groups: prev.groups.map(g => g.level === level ? { ...g, ...patch } : g),
    }));
  };

  // ── Atalhos de Teclado (Mover e Redimensionar) ──────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;

      // Não atua se estiver digitando em campos de texto
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const step = 1; // 1mm
      const isShift = e.shiftKey;
      let dx = 0, dy = 0, dw = 0, dh = 0;

      if (e.key === 'ArrowLeft')  isShift ? (dw = -step) : (dx = -step);
      if (e.key === 'ArrowRight') isShift ? (dw = step)  : (dx = step);
      if (e.key === 'ArrowUp')    isShift ? (dh = -step) : (dy = -step);
      if (e.key === 'ArrowDown')  isShift ? (dh = step)  : (dy = step);

      if (dx === 0 && dy === 0 && dw === 0 && dh === 0) return;

      e.preventDefault();

      setLayout(prev => {
        const newBands = { ...prev.bands };
        let changed = false;

        for (const bandName of Object.keys(newBands) as RpbBandName[]) {
          const band = newBands[bandName];
          if (band.components.some(c => selectedIds.includes(c.id))) {
            changed = true;
            newBands[bandName] = {
              ...band,
              components: band.components.map(c => {
                if (selectedIds.includes(c.id)) {
                  return {
                    ...c,
                    x: Math.max(0, c.x + dx),
                    y: Math.max(0, c.y + dy),
                    w: Math.max(1, c.w + dw),
                    h: Math.max(1, c.h + dh),
                  };
                }
                return c;
              }),
            };
          }
        }
        return changed ? { ...prev, bands: newBands } : prev;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
        <span className="text-sm font-semibold truncate max-w-[180px]">{relatorio.nome}</span>

        {/* Colunas detectadas */}
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-secondary border border-border text-xs text-muted-foreground">
          {detecting
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Detectando...</>
            : queryColumns.length > 0
              ? <span className="text-green-600 font-medium">✓ {queryColumns.length} col.</span>
              : <span className="text-amber-600">Sem colunas</span>
          }
        </div>
        <button
          onClick={handleDetectColumns}
          disabled={detecting}
          title="Detectar colunas da query SQL automaticamente"
          className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${detecting ? 'animate-spin' : ''}`} />
          Detectar Colunas
        </button>

        <div className="flex-1" />

        {/* Abas */}
        {(['canvas','groups','page'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              activeTab === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            {t === 'canvas' ? '🎨 Canvas' : t === 'groups' ? '📂 Grupos' : '📄 Página'}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={() => setShowFields(v => !v)}
          title="Painel de campos e variáveis"
          className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded border transition-all ${
            showFields ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
          }`}>
          <List className="w-3.5 h-3.5" /> Campos
        </button>
        <button onClick={() => setShowHelp(true)}
          title="Ajuda — variáveis e dicas de uso"
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded border border-border text-muted-foreground hover:bg-secondary">
          <HelpCircle className="w-3.5 h-3.5" /> Ajuda
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={() => onPreview(layout)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-secondary hover:bg-secondary/80 border border-border">
          <Eye className="w-3.5 h-3.5" /> Preview
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* ── Modal de Ajuda ────────────────────────────────────── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-auto m-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Ajuda — Variáveis e Campos</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-5 text-sm">

              {/* Variáveis de sistema */}
              <section>
                <h3 className="font-semibold text-primary mb-2">📅 Variáveis de Sistema</h3>
                <p className="text-xs text-muted-foreground mb-2">Use nos componentes de <strong>Texto</strong> em qualquer banda (cabeçalho, rodapé, etc.).</p>
                <table className="w-full text-xs border border-border rounded overflow-hidden">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold">Variável</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SYSTEM_VARS.map(sv => (
                      <tr key={sv.v} className="border-t border-border hover:bg-accent/10">
                        <td className="px-3 py-1.5">
                          <code
                            className="text-primary bg-primary/10 rounded px-1 cursor-pointer hover:bg-primary/20"
                            onClick={() => copyToClipboard(sv.v)}
                            title="Clique para copiar"
                          >{sv.v}</code>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{sv.d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Campos da query */}
              <section>
                <h3 className="font-semibold text-blue-600 mb-2">📊 Campos da Query (colunas detectadas)</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Use em componentes de <strong>Texto</strong> e como colunas de <strong>Tabela</strong>. Disponíveis na banda <em>Detalhe</em>.
                </p>
                {queryColumns.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded p-2">Nenhuma coluna detectada. Clique em "Detectar Colunas" na toolbar.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {queryColumns.map(c => (
                      <code
                        key={c}
                        className="text-blue-600 bg-blue-50 rounded px-2 py-0.5 cursor-pointer hover:bg-blue-100 text-xs"
                        onClick={() => copyToClipboard(`{${c}}`)}
                        title="Clique para copiar"
                      >{`{${c}}`}</code>
                    ))}
                  </div>
                )}
              </section>

              {/* Filtros */}
              <section>
                <h3 className="font-semibold text-orange-600 mb-2">🔍 Variáveis de Filtros</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  Os filtros preenchidos pelo usuário ficam disponíveis como variáveis.
                  Use o <strong>nome interno</strong> do filtro entre chaves.
                </p>
                <div className="bg-secondary/40 rounded p-3 space-y-1 text-xs font-mono">
                  <div><span className="text-orange-600">{'{dt_inicial}'}</span> <span className="text-muted-foreground">— ex: filtro com nome interno "dt_inicial"</span></div>
                  <div><span className="text-orange-600">{'{filtro_dt_inicial}'}</span> <span className="text-muted-foreground">— prefixo alternativo (evita conflito)</span></div>
                </div>
              </section>

              {/* Dicas de uso */}
              <section>
                <h3 className="font-semibold text-green-700 mb-2">💡 Dicas de Uso</h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Variáveis funcionam com <code className="text-primary">{'{campo}'}</code> ou <code className="text-primary">{'{{campo}}'}</code></li>
                  <li>No <strong>Cabeçalho da Página</strong>: use variáveis de sistema e filtros</li>
                  <li>No <strong>Rodapé</strong>: use totalizadores e <code className="text-primary">{'{total_registros}'}</code></li>
                  <li>No <strong>Detalhe</strong>: adicione uma <strong>Tabela</strong> para listar os dados da query</li>
                  <li>Clique em qualquer variável nesta janela para <strong>copiar para a área de transferência</strong></li>
                  <li>No painel <strong>Campos</strong> (toolbar), clique para copiar e cole no campo de conteúdo do texto</li>
                  <li>Use as <strong>Setas do teclado</strong> para mover componentes selecionados (1mm por vez)</li>
                  <li>Use <strong>Shift + Setas</strong> para ajustar o tamanho dos componentes</li>
                </ul>
              </section>

              {/* ── Novidades ───────────────────────────────────────── */}
              <section>
                <h3 className="font-semibold text-violet-600 mb-2">🚀 Novidades — Últimas Atualizações</h3>
                <div className="space-y-3 text-xs">

                  {/* Novos componentes */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-violet-50 px-3 py-1.5 font-semibold text-violet-700">🧱 Novos Componentes na Paleta</div>
                    <table className="w-full text-xs">
                      <tbody>
                        {[
                          ['Linha Horizontal', 'Separador horizontal clássico (cor e espessura configuráveis)'],
                          ['Linha Vertical',   'Separador vertical — útil para dividir colunas em cabeçalhos'],
                          ['Box / Retângulo',  'Caixa com borda, fundo e arredondamento configuráveis'],
                        ].map(([n, d]) => (
                          <tr key={n} className="border-t border-border">
                            <td className="px-3 py-1.5 font-medium text-violet-700 whitespace-nowrap">{n}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Multi-seleção e alinhamento */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-700">🎯 Multi-seleção e Alinhamento</div>
                    <div className="px-3 py-2 space-y-1 text-muted-foreground">
                      <p>Selecione múltiplos componentes com <strong>Ctrl + Clique</strong> para ativar a barra de alinhamento flutuante na base do canvas.</p>
                      <ul className="list-disc list-inside space-y-0.5 mt-1">
                        <li><strong>Alinhar:</strong> esquerda, direita, topo, base, centro horizontal, centro vertical</li>
                        <li><strong>Igualar:</strong> mesma largura ou mesma altura (baseado no 1º selecionado)</li>
                        <li><strong>Distribuir</strong> (3+ comp.): espaçamento igual horizontal ou vertical</li>
                      </ul>
                    </div>
                  </div>

                  {/* Atalhos de Teclado */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-sky-50 px-3 py-1.5 font-semibold text-sky-700">⌨️ Atalhos de Teclado</div>
                    <div className="px-3 py-2 space-y-2 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary font-mono text-[10px] text-foreground">Setas</kbd>
                        <span>Move o componente selecionado em 1mm</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <kbd className="px-1.5 py-0.5 rounded border border-border bg-secondary font-mono text-[10px] text-foreground">Shift + Setas</kbd>
                        <span>Ajusta o tamanho do componente em 1mm</span>
                      </div>
                      <p className="text-[10px] italic mt-1 border-t border-border pt-1">
                        Dica: Selecione múltiplos itens (Ctrl+Clique) para mover todos juntos!
                      </p>
                    </div>
                  </div>

                  {/* Formatação avançada */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">📐 Formatação Avançada de Colunas</div>
                    <div className="px-3 py-2 space-y-2 text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground mb-1">Casas decimais <span className="text-xs font-normal text-muted-foreground">(Número, Moeda, %)</span></p>
                        <div className="bg-secondary/40 rounded p-2 font-mono text-xs space-y-0.5">
                          <div><span className="text-emerald-700">0</span> → 1.234</div>
                          <div><span className="text-emerald-700">2</span> → 1.234,56 <span className="text-muted-foreground">(padrão)</span></div>
                          <div><span className="text-emerald-700">4</span> → 1.234,5678</div>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Formato de data <span className="text-xs font-normal text-muted-foreground">(Data, Data+Hora)</span></p>
                        <div className="bg-secondary/40 rounded p-2 font-mono text-xs space-y-0.5">
                          {[
                            ['dd/mm/yyyy',      '01/05/2026'],
                            ['dd/mm/yy',        '01/05/26'],
                            ['dd/mm/yyyy hh:mm','01/05/2026 22:43'],
                            ['dd/mm/yy hh:mm',  '01/05/26 22:43'],
                            ['hh:mm',           '22:43'],
                          ].map(([fmt, ex]) => (
                            <div key={fmt}><span className="text-emerald-700">{fmt}</span><span className="text-muted-foreground ml-2">→ {ex}</span></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </section>

            </div>
          </div>
        </div>
      )}

      {/* ── Dica de uso (quando não há colunas) ─────────────── */}
      {queryColumns.length === 0 && !detecting && (
        <div className="flex-shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
          ⚠️ <strong>Nenhuma coluna detectada.</strong> Certifique-se de que a query SQL foi salva e clique em{' '}
          <strong>"Detectar Colunas"</strong> para carregar os campos disponíveis para a tabela.
        </div>
      )}

      {/* ── Agrupamentos ───────────────────────────────────── */}
      {activeTab === 'groups' && (
        <div className="p-4 border-b border-border bg-card flex-shrink-0 space-y-3 overflow-auto">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Agrupamentos</h3>
            {layout.groups.length < 2 && (
              <button onClick={handleAddGroup}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground">
                <Plus className="w-3 h-3" /> Adicionar Grupo
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Os dados da query devem estar ordenados pelo campo de agrupamento para que funcione corretamente.
          </p>
          {layout.groups.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhum agrupamento configurado.</p>
          )}
          {layout.groups.map(g => (
            <div key={g.level} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary">Grupo {g.level}</span>
                <button onClick={() => handleRemoveGroup(g.level)}
                  className="text-xs text-destructive hover:bg-destructive/10 rounded px-1">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Campo de agrupamento</label>
                  <select value={g.field}
                    onChange={e => updateGroup(g.level, { field: e.target.value })}
                    className="w-full border border-border rounded px-2 py-1 text-xs bg-card">
                    <option value="">— Selecione —</option>
                    {queryColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Rótulo</label>
                  <input value={g.label}
                    onChange={e => updateGroup(g.level, { label: e.target.value })}
                    className="w-full border border-border rounded px-2 py-1 text-xs bg-card" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={g.pageBreakBefore}
                  onChange={e => updateGroup(g.level, { pageBreakBefore: e.target.checked })} />
                Quebra de página antes de cada grupo
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ── Configurações da página ─────────────────────────── */}
      {activeTab === 'page' && (
        <div className="p-4 border-b border-border bg-card flex-shrink-0 overflow-auto">
          <div className="mb-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-[10px] text-blue-700 font-bold uppercase mb-3 flex items-center gap-1">
              🎨 Zebrado da Banda de Detalhe
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Cor Padrão</label>
                <div className="flex gap-2">
                  <input type="color" 
                    value={layout.bands.detail.bgColor === 'transparent' ? '#ffffff' : layout.bands.detail.bgColor}
                    onChange={e => setLayout(p => ({
                      ...p,
                      bands: { ...p.bands, detail: { ...p.bands.detail, bgColor: e.target.value } },
                    }))}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-white" 
                  />
                  <input type="text" 
                    value={layout.bands.detail.bgColor}
                    onChange={e => setLayout(p => ({
                      ...p,
                      bands: { ...p.bands, detail: { ...p.bands.detail, bgColor: e.target.value } },
                    }))}
                    className="flex-1 border border-border rounded px-2 py-1 text-xs bg-white" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold uppercase block mb-1">Cor Alternada (Zebrado)</label>
                <div className="flex gap-2">
                  <input type="color" 
                    value={layout.detailAltBgColor === 'transparent' ? '#f1f5f9' : (layout.detailAltBgColor || '#f1f5f9')}
                    onChange={e => setLayout(p => ({ ...p, detailAltBgColor: e.target.value }))}
                    className="w-8 h-8 rounded border border-border cursor-pointer bg-white" 
                  />
                  <input type="text" 
                    value={layout.detailAltBgColor || 'transparent'}
                    onChange={e => setLayout(p => ({ ...p, detailAltBgColor: e.target.value }))}
                    className="flex-1 border border-border rounded px-2 py-1 text-xs bg-white" 
                  />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-blue-600 mt-2 italic">
              * Dica: As cores escolhidas aqui serão alternadas automaticamente nas linhas do relatório.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase">Tamanho</label>
              <select value={layout.pageSize}
                onChange={e => setLayout(p => ({ ...p, pageSize: e.target.value as any }))}
                className="w-full border border-border rounded px-2 py-1 text-xs bg-card">
                <option value="A4">A4 (210×297mm)</option>
                <option value="A3">A3 (297×420mm)</option>
                <option value="Letter">Letter (216×279mm)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold uppercase">Orientação</label>
              <select value={layout.orientation}
                onChange={e => setLayout(p => ({ ...p, orientation: e.target.value as any }))}
                className="w-full border border-border rounded px-2 py-1 text-xs bg-card">
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </select>
            </div>
            {(['top','right','bottom','left'] as const).map(m => (
              <div key={m}>
                <label className="text-[10px] text-muted-foreground font-semibold uppercase">
                  Margem {m === 'top' ? 'Sup.' : m === 'right' ? 'Dir.' : m === 'bottom' ? 'Inf.' : 'Esq.'} (mm)
                </label>
                <input type="number" value={layout.margins[m]}
                  onChange={e => setLayout(p => ({ ...p, margins: { ...p.margins, [m]: Number(e.target.value) } }))}
                  className="w-full border border-border rounded px-2 py-1 text-xs bg-card" />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase mb-2">Visibilidade das bandas</p>
            <div className="grid grid-cols-3 gap-1">
              {BAND_ORDER.map(name => (
                <label key={name} className="flex items-center gap-1 text-[10px]">
                  <input type="checkbox"
                    checked={layout.bands[name].visible}
                    onChange={e => setLayout(p => ({
                      ...p,
                      bands: { ...p.bands, [name]: { ...p.bands[name], visible: e.target.checked } },
                    }))}
                  />
                  {BAND_LABELS[name]}
                  <span className="text-muted-foreground">({layout.bands[name].height}mm)</span>
                </label>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Designer: Paleta + [Campos] + Canvas + Propriedades ────── */}
      {activeTab === 'canvas' && (
        <div className="flex-1 flex overflow-hidden relative">
          <RpbPalette activeBand={activeBand} onAddComponent={handleAddComponent} />

          {/* Painel lateral de campos e variáveis */}
          {showFields && (
            <div className="w-44 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
              <div className="px-2 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wide">Campos</span>
                <button onClick={() => setShowFields(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-1.5 space-y-2 text-[10px]">
                {/* Variáveis de sistema */}
                <div>
                  <p className="font-semibold text-muted-foreground uppercase mb-1">Sistema</p>
                  {SYSTEM_VARS.map(sv => (
                    <button key={sv.v}
                      onClick={() => copyToClipboard(sv.v)}
                      title={sv.d + ' — clique para copiar'}
                      className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 group"
                    >
                      <Copy className="w-2.5 h-2.5 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                      <code className="text-primary truncate">{sv.v}</code>
                    </button>
                  ))}
                </div>

                {/* Campos da query */}
                {queryColumns.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground uppercase mb-1">Campos ({queryColumns.length})</p>
                    {queryColumns.map(c => (
                      <button key={c}
                        onClick={() => copyToClipboard(`{${c}}`)}
                        title={`Copiar {${c}}`}
                        className="w-full text-left flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 group"
                      >
                        <Copy className="w-2.5 h-2.5 text-muted-foreground group-hover:text-blue-600 flex-shrink-0" />
                        <code className="text-blue-600 truncate">{`{${c}}`}</code>
                      </button>
                    ))}
                  </div>
                )}

                {queryColumns.length === 0 && (
                  <p className="text-muted-foreground italic">Detecte as colunas para ver os campos aqui.</p>
                )}
              </div>
            </div>
          )}

          {/* ── Barra de Alinhamento (aparece com 2+ selecionados) ─ */}
          {selectedIds.length >= 2 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-3 py-2 bg-card border border-primary/40 rounded-xl shadow-xl animate-in slide-in-from-bottom-2 duration-200">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider mr-1">
                {selectedIds.length} sel.
              </span>
              {/* Indicador: 1º clicado é a referência */}
              <span className="text-[9px] bg-primary/10 text-primary rounded px-1.5 py-0.5 font-semibold" title="O primeiro componente clicado define posição/tamanho para os demais">
                1º = ref.
              </span>
              <div className="w-px h-5 bg-border mx-1" />

              {/* Alinhar horizontalmente */}
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide mr-0.5">Alinhar</span>
              {[
                { op: 'align-left',     icon: <AlignLeft size={14} />,                     title: 'Alinhar à esquerda — todos copiam o X do 1º selecionado'        },
                { op: 'align-center-h', icon: <AlignHorizontalJustifyCenter size={14} />,  title: 'Centralizar horizontal — centro dos demais = centro do 1º'         },
                { op: 'align-right',    icon: <AlignRight size={14} />,                    title: 'Alinhar à direita — borda direita dos demais = borda direita do 1º' },
                { op: 'align-top',      icon: <AlignStartHorizontal size={14} />,          title: 'Alinhar ao topo — todos copiam o Y do 1º selecionado'            },
                { op: 'align-center-v', icon: <AlignCenterVertical size={14} />,           title: 'Centralizar vertical — centro dos demais = centro do 1º'           },
                { op: 'align-bottom',   icon: <AlignEndHorizontal size={14} />,            title: 'Alinhar à base — borda inferior dos demais = borda inferior do 1º'  },
              ].map(btn => (
                <button key={btn.op} onClick={() => applyAlignment(btn.op)} title={btn.title}
                  className="p-1.5 rounded hover:bg-primary/10 text-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/30">
                  {btn.icon}
                </button>
              ))}

              <div className="w-px h-5 bg-border mx-1" />

              {/* Mesma dimensão */}
              <span className="text-[9px] text-muted-foreground uppercase tracking-wide mr-0.5">Igualar</span>
              {[
                { op: 'same-width',  icon: <Maximize2 size={14} />, title: 'Mesma largura — todos ficam com a largura do 1º selecionado'  },
                { op: 'same-height', icon: <Move size={14} />,      title: 'Mesma altura — todos ficam com a altura do 1º selecionado'    },
              ].map(btn => (
                <button key={btn.op} onClick={() => applyAlignment(btn.op)} title={btn.title}
                  className="p-1.5 rounded hover:bg-primary/10 text-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/30">
                  {btn.icon}
                </button>
              ))}

              {selectedIds.length >= 3 && (
                <>
                  <div className="w-px h-5 bg-border mx-1" />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wide mr-0.5">Distribuir</span>
                  {[
                    { op: 'distribute-h', title: 'Distribuir horizontalmente com espaçamento igual', icon: <span className="text-xs font-mono">⇔</span> },
                    { op: 'distribute-v', title: 'Distribuir verticalmente com espaçamento igual',   icon: <span className="text-xs font-mono">⇕</span> },
                  ].map(btn => (
                    <button key={btn.op} onClick={() => applyAlignment(btn.op)} title={btn.title}
                      className="p-1.5 rounded hover:bg-primary/10 text-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/30">
                      {btn.icon}
                    </button>
                  ))}
                </>
              )}

              <div className="w-px h-5 bg-border mx-1" />
              <button onClick={handleClearSelection} title="Limpar seleção (Esc)"
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X size={14} />

              </button>
            </div>
          )}

          <RpbCanvas
            layout={layout}
            activeBand={activeBand}
            selectedIds={selectedIds}
            onChange={setLayout}
            onSelectBand={(band) => { setActiveBand(band); setSelectedIds([]); }}
            onSelectComponent={handleSelectComponent}
            onClearSelection={handleClearSelection}
          />
          <RpbProperties
            component={selectedComp}
            queryColumns={queryColumns}
            onChange={handleUpdateComponent}
            onDelete={handleDeleteComponent}
          />
        </div>
      )}
    </div>
  );
};

export default RpbDesigner;
