// ============================================================
// Report Builder Pro — Painel de Propriedades (sidebar direita)
// ============================================================
import React, { useState } from 'react';
import type {
  RpbComponent, RpbStyle, RpbTableColumn, RpbTotalizerComp,
  RpbTextComp, RpbTableComp, RpbImageComp, RpbLineComp, RpbBoxComp,
  RpbAlign, RpbFormat, RpbTotalOp, RpbDateFormat,
} from '../../types';
import { DEFAULT_STYLE } from '../../types';

interface Props {
  component: RpbComponent | null;
  queryColumns: string[];
  onChange: (updated: RpbComponent) => void;
  onDelete: () => void;
}

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{children}</label>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`w-full border border-border rounded px-2 py-1 text-xs bg-card focus:ring-1 focus:ring-ring outline-none ${props.className || ''}`} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`w-full border border-border rounded px-2 py-1 text-xs bg-card ${props.className || ''}`} />
);

// ── Variáveis de sistema disponíveis ────────────────────────
const SYSTEM_VARS = [
  { v: '{data}',             d: 'Data atual (dd/mm/aaaa)' },
  { v: '{hora}',             d: 'Hora atual (hh:mm:ss)' },
  { v: '{data_emissao}',     d: 'Data de emissão' },
  { v: '{hora_emissao}',     d: 'Hora de emissão' },
  { v: '{datetime_emissao}', d: 'Data e hora de emissão' },
  { v: '{relatorio_nome}',   d: 'Nome do relatório' },
  { v: '{total_registros}',  d: 'Total de registros' },
];

const RpbProperties: React.FC<Props> = ({ component, queryColumns, onChange, onDelete }) => {
  const [showVars, setShowVars]           = useState(false);
  const [expandedColIdx, setExpandedColIdx] = useState<number | null>(null);

  if (!component) {
    return (
      <div className="w-60 flex-shrink-0 border-l border-border bg-card flex items-center justify-center">
        <p className="text-xs text-muted-foreground text-center px-4">
          Selecione um componente para editar suas propriedades
        </p>
      </div>
    );
  }

  const upd = (patch: Partial<RpbComponent>) => onChange({ ...component, ...patch } as RpbComponent);
  const updStyle = (patch: Partial<RpbStyle>) => {
    const c = component as any;
    onChange({ ...c, style: { ...(c.style || DEFAULT_STYLE), ...patch } });
  };

  const s: RpbStyle = (component as any).style || DEFAULT_STYLE;

  const updCol = (idx: number, patch: Partial<RpbTableColumn & { fontSize?: number }>) => {
    const cols = [...(component as RpbTableComp).columns];
    cols[idx] = { ...cols[idx], ...patch };
    upd({ columns: cols } as any);
  };

  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-card flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Propriedades</p>
        <button onClick={onDelete} className="text-[10px] text-destructive hover:bg-destructive/10 rounded px-1 py-0.5">
          ✕ Excluir
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">

        {/* Posição e tamanho */}
        <div>
          <Label>Posição e Tamanho (mm)</Label>
          <div className="grid grid-cols-2 gap-1">
            {(['x','y','w','h'] as const).map(k => (
              <div key={k}>
                <span className="text-[9px] text-muted-foreground uppercase">{k}</span>
                <Input type="number" value={(component as any)[k] ?? 0}
                  onChange={e => upd({ [k]: parseFloat(e.target.value) || 0 } as any)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Text component ──────────────────────────────────── */}
        {component.type === 'text' && (
          <div className="space-y-2">
            <div>
              <Label>Conteúdo</Label>
              <textarea
                value={(component as RpbTextComp).content}
                onChange={e => upd({ content: e.target.value } as any)}
                rows={3}
                placeholder='Ex: {empresa_nome} ou "Relatório"'
                className="w-full border border-border rounded px-2 py-1 text-xs bg-card resize-none"
              />
              <button
                onClick={() => setShowVars(v => !v)}
                className="text-[9px] text-primary underline mt-0.5"
              >
                {showVars ? '▲ Ocultar variáveis' : '▼ Variáveis disponíveis'}
              </button>
              {showVars && (
                <div className="mt-1 border border-border rounded p-1.5 space-y-0.5 bg-secondary/30">
                  <p className="text-[9px] font-semibold text-muted-foreground mb-1">Sistema:</p>
                  {SYSTEM_VARS.map(sv => (
                    <div key={sv.v} className="flex items-start gap-1">
                      <code className="text-[9px] text-primary bg-primary/10 rounded px-1 whitespace-nowrap cursor-pointer"
                        onClick={() => {
                          const c = component as RpbTextComp;
                          upd({ content: c.content + sv.v } as any);
                        }}
                        title="Clique para inserir"
                      >{sv.v}</code>
                      <span className="text-[9px] text-muted-foreground leading-tight">{sv.d}</span>
                    </div>
                  ))}
                  {queryColumns.length > 0 && (
                    <>
                      <p className="text-[9px] font-semibold text-muted-foreground mt-1 pt-1 border-t border-border">Campos da query:</p>
                      <div className="flex flex-wrap gap-0.5">
                        {queryColumns.map(c => (
                          <code key={c}
                            className="text-[9px] text-blue-600 bg-blue-50 rounded px-1 cursor-pointer hover:bg-blue-100"
                            onClick={() => {
                              const comp2 = component as RpbTextComp;
                              upd({ content: comp2.content + `{${c}}` } as any);
                            }}
                            title="Clique para inserir"
                          >{`{${c}}`}</code>
                        ))}
                      </div>
                    </>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1 pt-1 border-t border-border">
                    Filtros: use <code className="text-orange-600">{'{nome_do_filtro}'}</code>
                  </p>
                </div>
              )}
            </div>

            {/* Formato do campo — data do sistema */}
            <div className="bg-violet-50 border border-violet-200 rounded p-2 space-y-1.5">
              <span className="text-[9px] font-semibold text-violet-700 uppercase tracking-wide block">Formato do campo</span>
              <Select
                value={(component as RpbTextComp).format || 'text'}
                onChange={e => upd({ format: e.target.value as any, dateFormat: undefined, decimals: undefined } as any)}
              >
                <option value="text">Texto (padrão)</option>
                <option value="date">Data</option>
                <option value="datetime">Data + Hora</option>
                <option value="number">Número</option>
                <option value="currency">Moeda (R$)</option>
                <option value="percent">Percentual (%)</option>
              </Select>

              {/* Máscara de data */}
              {['date', 'datetime'].includes((component as RpbTextComp).format || '') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded p-1.5">
                  <span className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide block mb-1">Máscara de data</span>
                  <Select
                    value={(component as RpbTextComp).dateFormat || ((component as RpbTextComp).format === 'datetime' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy')}
                    onChange={e => upd({ dateFormat: e.target.value as RpbDateFormat } as any)}
                  >
                    <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                    <option value="dd/mm/yy">dd/mm/yy</option>
                    <option value="dd/mm/yyyy hh:mm">dd/mm/yyyy hh:mm</option>
                    <option value="dd/mm/yy hh:mm">dd/mm/yy hh:mm</option>
                    <option value="hh:mm">hh:mm (só hora)</option>
                  </Select>
                  <span className="text-[9px] text-emerald-600 font-mono mt-1 block">
                    ex: {(() => {
                      const fmt = (component as RpbTextComp).dateFormat || ((component as RpbTextComp).format === 'datetime' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy');
                      const now = new Date();
                      const dd = String(now.getDate()).padStart(2,'0');
                      const mm2 = String(now.getMonth()+1).padStart(2,'0');
                      const yyyy = String(now.getFullYear());
                      const yy = yyyy.slice(-2);
                      const hh = String(now.getHours()).padStart(2,'0');
                      const mi = String(now.getMinutes()).padStart(2,'0');
                      if (fmt === 'dd/mm/yy') return `${dd}/${mm2}/${yy}`;
                      if (fmt === 'dd/mm/yy hh:mm') return `${dd}/${mm2}/${yy} ${hh}:${mi}`;
                      if (fmt === 'dd/mm/yyyy hh:mm') return `${dd}/${mm2}/${yyyy} ${hh}:${mi}`;
                      if (fmt === 'hh:mm') return `${hh}:${mi}`;
                      return `${dd}/${mm2}/${yyyy}`;
                    })()}
                  </span>
                </div>
              )}

              {/* Casas decimais */}
              {['number', 'currency', 'percent'].includes((component as RpbTextComp).format || '') && (
                <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                  <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wide block mb-1">Casas decimais</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0} max={10}
                      value={(component as RpbTextComp).decimals !== undefined ? (component as RpbTextComp).decimals : ''}
                      placeholder="2 (padrão)"
                      className="w-20"
                      onChange={e => {
                        const v = parseInt(e.target.value);
                        upd({ decimals: isNaN(v) ? undefined : v } as any);
                      }} />
                    <span className="text-[9px] text-blue-600 font-mono">
                      ex: {Number(1234.5678).toLocaleString('pt-BR', {
                        minimumFractionDigits: (component as RpbTextComp).decimals ?? 2,
                        maximumFractionDigits: (component as RpbTextComp).decimals ?? 2,
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Totalizer component ─────────────────────────────── */}
        {component.type === 'totalizer' && (
          <div className="space-y-2">
            <div>
              <Label>Campo</Label>
              <Select value={(component as RpbTotalizerComp).field}
                onChange={e => upd({ field: e.target.value } as any)}>
                <option value="">— Selecione —</option>
                {queryColumns.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <Label>Operação</Label>
              <Select value={(component as RpbTotalizerComp).operation}
                onChange={e => upd({ operation: e.target.value } as any)}>
                <option value="sum">Soma</option>
                <option value="avg">Média</option>
                <option value="count">Contagem</option>
                <option value="min">Mínimo</option>
                <option value="max">Máximo</option>
              </Select>
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={(component as RpbTotalizerComp).scope}
                onChange={e => upd({ scope: e.target.value as any } as any)}>
                <option value="report">Total do Relatório</option>
                <option value="group1">Subtotal Grupo 1</option>
                <option value="group2">Subtotal Grupo 2</option>
              </Select>
            </div>
            <div>
              <Label>Rótulo</Label>
              <Input value={(component as RpbTotalizerComp).labelText}
                onChange={e => upd({ labelText: e.target.value } as any)} />
            </div>
            <div>
              <Label>Formato</Label>
              <Select value={(component as RpbTotalizerComp).format}
                onChange={e => upd({ format: e.target.value as RpbFormat, decimals: undefined } as any)}>
                <option value="number">Número</option>
                <option value="currency">Moeda (R$)</option>
                <option value="percent">Percentual</option>
                <option value="text">Texto</option>
              </Select>
            </div>

            {/* Casas decimais — visível quando number/currency/percent */}
            {['number', 'currency', 'percent'].includes((component as RpbTotalizerComp).format) && (
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wide block mb-1">Casas decimais</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} max={10}
                    value={(component as RpbTotalizerComp).decimals !== undefined ? (component as RpbTotalizerComp).decimals : ''}
                    placeholder="2 (padrão)"
                    className="w-20"
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      upd({ decimals: isNaN(v) ? undefined : v } as any);
                    }} />
                  <span className="text-[9px] text-blue-600 font-mono">
                    ex: {Number(1234.5678).toLocaleString('pt-BR', {
                      minimumFractionDigits: (component as RpbTotalizerComp).decimals ?? 2,
                      maximumFractionDigits: (component as RpbTotalizerComp).decimals ?? 2,
                    })}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Image component ─────────────────────────────────── */}
        {component.type === 'image' && (
          <div className="space-y-2">
            <div>
              <Label>URL / Variável</Label>
              <Input value={(component as RpbImageComp).src}
                onChange={e => upd({ src: e.target.value } as any)}
                placeholder="{empresa_logo} ou https://..." />
            </div>
            <div>
              <Label>Ajuste</Label>
              <Select value={(component as RpbImageComp).fit}
                onChange={e => upd({ fit: e.target.value as any } as any)}>
                <option value="contain">Conter</option>
                <option value="cover">Cobrir</option>
                <option value="fill">Esticar</option>
              </Select>
            </div>
          </div>
        )}

        {/* ── Line component ───────────────────────────────────── */}
        {component.type === 'line' && (
          <div className="space-y-2">
            <div>
              <Label>Orientação</Label>
              <Select value={(component as RpbLineComp).orientation}
                onChange={e => upd({ orientation: e.target.value as any } as any)}>
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={(component as RpbLineComp).color}
                onChange={e => upd({ color: e.target.value } as any)} />
            </div>
            <div>
              <Label>Espessura (px)</Label>
              <Input type="number" value={(component as RpbLineComp).thickness}
                onChange={e => upd({ thickness: parseInt(e.target.value) || 1 } as any)} />
            </div>
          </div>
        )}

        {/* ── Box component ────────────────────────────────────── */}
        {component.type === 'box' && (
          <div className="space-y-2">
            <div>
              <Label>Cor da Borda</Label>
              <Input type="color" value={(component as RpbBoxComp).borderColor}
                onChange={e => upd({ borderColor: e.target.value } as any)} />
            </div>
            <div>
              <Label>Espessura da Borda (px)</Label>
              <Input type="number" value={(component as RpbBoxComp).borderThickness}
                onChange={e => upd({ borderThickness: parseInt(e.target.value) || 1 } as any)} />
            </div>
            <div>
              <Label>Cor de Fundo</Label>
              <Input type="color"
                value={(component as RpbBoxComp).bgColor === 'transparent' ? '#ffffff' : (component as RpbBoxComp).bgColor}
                onChange={e => upd({ bgColor: e.target.value } as any)} />
              <button
                onClick={() => upd({ bgColor: 'transparent' } as any)}
                className="text-[9px] text-primary underline mt-0.5"
              >Sem fundo (transparente)</button>
            </div>
            <div>
              <Label>Arredondamento (px)</Label>
              <Input type="number" min={0} value={(component as RpbBoxComp).borderRadius}
                onChange={e => upd({ borderRadius: parseInt(e.target.value) || 0 } as any)} />
            </div>
          </div>
        )}

        {/* ── Table component ──────────────────────────────────── */}
        {component.type === 'table' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={(component as RpbTableComp).showHeader}
                onChange={e => upd({ showHeader: e.target.checked } as any)} />
              <span className="text-xs">Exibir cabeçalho</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={(component as RpbTableComp).showColumnTotals}
                onChange={e => upd({ showColumnTotals: e.target.checked } as any)} />
              <span className="text-xs">Exibir totais</span>
            </div>
            <div>
              <Label>Cor alternada de linha</Label>
              <Input type="color"
                value={(component as RpbTableComp).altRowBg === 'transparent'
                  ? '#ffffff' : (component as RpbTableComp).altRowBg}
                onChange={e => upd({ altRowBg: e.target.value } as any)} />
            </div>

            {/* Fonte global cabeçalho / linhas */}
            <div className="grid grid-cols-2 gap-1">
              <div>
                <span className="text-[9px] text-muted-foreground">Fonte cab. (pt)</span>
                <Input type="number" min={6} max={24}
                  value={(component as RpbTableComp).headerStyle?.fontSize ?? DEFAULT_STYLE.fontSize}
                  onChange={e => {
                    const c = component as RpbTableComp;
                    upd({ headerStyle: { ...(c.headerStyle || DEFAULT_STYLE), fontSize: parseInt(e.target.value) || 9 } } as any);
                  }} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">Fonte linha (pt)</span>
                <Input type="number" min={6} max={24}
                  value={(component as RpbTableComp).rowStyle?.fontSize ?? DEFAULT_STYLE.fontSize}
                  onChange={e => {
                    const c = component as RpbTableComp;
                    upd({ rowStyle: { ...(c.rowStyle || DEFAULT_STYLE), fontSize: parseInt(e.target.value) || 9 } } as any);
                  }} />
              </div>
            </div>

            {/* Colunas — colapsáveis */}
            <div>
              <Label>Colunas</Label>
              <div className="space-y-1">
                {(component as RpbTableComp).columns.map((col, idx) => {
                  const isExpanded = expandedColIdx === idx;
                  return (
                    <div key={col.field + idx} className="border border-border rounded overflow-hidden">
                      {/* Cabeçalho da linha (clica para expandir) */}
                      <div
                        className="flex items-center justify-between px-1.5 py-1 bg-secondary/40 cursor-pointer hover:bg-secondary/70 select-none"
                        onClick={() => setExpandedColIdx(isExpanded ? null : idx)}
                      >
                        <span className="text-[10px] font-mono text-primary truncate max-w-[90px]">{col.field}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">
                            {col.format === 'number' ? '#.##' : col.format === 'currency' ? 'R$' : col.format === 'percent' ? '%' : col.format === 'date' ? '📅' : col.format === 'datetime' ? '🕐' : 'abc'}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{col.w}mm</span>
                          <span className="text-[9px] text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                          <button
                            className="text-[10px] text-destructive ml-1 leading-none"
                            onClick={e => {
                              e.stopPropagation();
                              const cols = (component as RpbTableComp).columns.filter((_, i) => i !== idx);
                              upd({ columns: cols } as any);
                              if (expandedColIdx === idx) setExpandedColIdx(null);
                            }}
                          >✕</button>
                        </div>
                      </div>

                      {/* Detalhes expandíveis */}
                      {isExpanded && (
                        <div className="p-1.5 space-y-1.5 bg-card">
                          <div>
                            <span className="text-[9px] text-muted-foreground">Rótulo</span>
                            <Input value={col.label} placeholder="Rótulo"
                              onChange={e => updCol(idx, { label: e.target.value })} />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <div>
                              <span className="text-[9px] text-muted-foreground">Largura (mm)</span>
                              <Input type="number" min={5} max={250}
                                value={col.w}
                                onChange={e => updCol(idx, { w: parseFloat(e.target.value) || 20 })} />
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground">Fonte (pt)</span>
                              <Input type="number" min={6} max={24}
                                value={(col as any).fontSize || ''}
                                placeholder="—"
                                onChange={e => {
                                  const v = parseInt(e.target.value);
                                  updCol(idx, { fontSize: v > 0 ? v : undefined } as any);
                                }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <Select value={col.align}
                              onChange={e => updCol(idx, { align: e.target.value as RpbAlign })}>
                              <option value="left">Esq.</option>
                              <option value="center">Centro</option>
                              <option value="right">Dir.</option>
                            </Select>
                            <Select value={col.format}
                              onChange={e => updCol(idx, { format: e.target.value as RpbFormat, decimals: undefined, dateFormat: undefined } as any)}>
                              <option value="text">Texto</option>
                              <option value="number">Número</option>
                              <option value="currency">Moeda (R$)</option>
                              <option value="date">Data</option>
                              <option value="datetime">Data+Hora</option>
                              <option value="percent">Percentual (%)</option>
                            </Select>
                          </div>

                          {/* Casas decimais — visível e destacado quando number/currency/percent */}
                          {['number', 'currency', 'percent'].includes(col.format) && (
                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                              <span className="text-[9px] font-semibold text-blue-700 uppercase tracking-wide block mb-1">Casas decimais</span>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number" min={0} max={10}
                                  value={(col as any).decimals !== undefined ? (col as any).decimals : ''}
                                  placeholder="2 (padrão)"
                                  className="w-20"
                                  onChange={e => {
                                    const v = parseInt(e.target.value);
                                    updCol(idx, { decimals: isNaN(v) ? undefined : v } as any);
                                  }} />
                                <span className="text-[9px] text-blue-600 font-mono">
                                  ex: {Number(1234.5678).toLocaleString('pt-BR', {
                                    minimumFractionDigits: (col as any).decimals ?? 2,
                                    maximumFractionDigits: (col as any).decimals ?? 2,
                                  })}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Formato de data — visível e destacado quando date/datetime */}
                          {['date', 'datetime'].includes(col.format) && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                              <span className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wide block mb-1">Formato de data</span>
                              <Select
                                value={(col as any).dateFormat || (col.format === 'datetime' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy')}
                                onChange={e => updCol(idx, { dateFormat: e.target.value as RpbDateFormat } as any)}>
                                <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                                <option value="dd/mm/yy">dd/mm/yy</option>
                                <option value="dd/mm/yyyy hh:mm">dd/mm/yyyy hh:mm</option>
                                <option value="dd/mm/yy hh:mm">dd/mm/yy hh:mm</option>
                                <option value="hh:mm">hh:mm (só hora)</option>
                              </Select>
                              <span className="text-[9px] text-emerald-600 font-mono mt-1 block">
                                ex: {(() => {
                                  const fmt = (col as any).dateFormat || (col.format === 'datetime' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy');
                                  const now = new Date();
                                  const dd = String(now.getDate()).padStart(2,'0');
                                  const mm2 = String(now.getMonth()+1).padStart(2,'0');
                                  const yyyy = String(now.getFullYear());
                                  const yy = yyyy.slice(-2);
                                  const hh = String(now.getHours()).padStart(2,'0');
                                  const mi = String(now.getMinutes()).padStart(2,'0');
                                  if (fmt === 'dd/mm/yy') return `${dd}/${mm2}/${yy}`;
                                  if (fmt === 'dd/mm/yy hh:mm') return `${dd}/${mm2}/${yy} ${hh}:${mi}`;
                                  if (fmt === 'dd/mm/yyyy hh:mm') return `${dd}/${mm2}/${yyyy} ${hh}:${mi}`;
                                  if (fmt === 'hh:mm') return `${hh}:${mi}`;
                                  return `${dd}/${mm2}/${yyyy}`;
                                })()}
                              </span>
                            </div>
                          )}

                          <Select value={col.totalType}
                            onChange={e => updCol(idx, { totalType: e.target.value as RpbTotalOp })}>
                            <option value="none">Sem total</option>
                            <option value="sum">Soma</option>
                            <option value="avg">Média</option>
                            <option value="count">Contagem</option>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Adicionar campo */}
              {queryColumns.length > 0 && (
                <div className="mt-1">
                  <Label>Adicionar campo</Label>
                  <Select onChange={e => {
                    if (!e.target.value) return;
                    const field = e.target.value;
                    const existing = (component as RpbTableComp).columns;
                    if (existing.find(c => c.field === field)) return;
                    const newCol: RpbTableColumn = {
                      field, label: field, w: 30, align: 'left',
                      format: 'text', totalType: 'none',
                    };
                    upd({ columns: [...existing, newCol] } as any);
                    e.target.value = '';
                  }}>
                    <option value="">+ Campo...</option>
                    {queryColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Estilo de texto (para text e totalizer) ──────────── */}
        {(component.type === 'text' || component.type === 'totalizer') && (
          <div>
            <Label>Estilo do Texto</Label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <span className="text-[9px] text-muted-foreground">Tamanho (pt)</span>
                  <Input type="number" value={s.fontSize}
                    onChange={e => updStyle({ fontSize: parseInt(e.target.value) || 9 })} />
                </div>
                <div>
                  <span className="text-[9px] text-muted-foreground">Cor</span>
                  <Input type="color" value={s.color}
                    onChange={e => updStyle({ color: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[['bold','N'],['italic','I'],['underline','_']].map(([k, l]) => (
                  <button key={k}
                    onClick={() => updStyle({ [k]: !(s as any)[k] } as any)}
                    className={`px-2 py-0.5 rounded text-xs border border-border ${(s as any)[k] ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
                  >{l}</button>
                ))}
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">Alinhamento</span>
                <div className="flex gap-1">
                  {(['left','center','right'] as RpbAlign[]).map(a => (
                    <button key={a} onClick={() => updStyle({ align: a })}
                      className={`flex-1 py-0.5 rounded text-xs border border-border ${s.align === a ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
                      {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">Fundo</span>
                <Input type="color"
                  value={s.bgColor === 'transparent' ? '#ffffff' : s.bgColor}
                  onChange={e => updStyle({ bgColor: e.target.value })} />
              </div>
              <div>
                <span className="text-[9px] text-muted-foreground">Borda</span>
                <Select value={s.border}
                  onChange={e => updStyle({ border: e.target.value as any })}>
                  <option value="none">Nenhuma</option>
                  <option value="all">Todas</option>
                  <option value="bottom">Inferior</option>
                  <option value="top">Superior</option>
                </Select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RpbProperties;
