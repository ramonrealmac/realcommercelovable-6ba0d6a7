// ============================================================
// Report Builder Pro — Renderer HTML
// Produz HTML imprimível com agrupamentos e totalizadores
// ============================================================
import type {
  RpbLayout, RpbBand, RpbComponent, RpbGroupDef,
  RpbTableComp, RpbTextComp, RpbTotalizerComp,
  RpbImageComp, RpbLineComp, RpbBoxComp, RpbTableColumn,
} from '../../types';
import { formatValue, DEFAULT_STYLE } from '../../types';
import type { RpbDateFormat } from '../../types';

// ── Calcula totais de um dataset ──────────────────────────────
function calcTotals(data: any[], columns: RpbTableColumn[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const col of columns) {
    if (col.totalType === 'none') continue;
    const vals = data.map(r => Number(r[col.field] || 0));
    if (col.totalType === 'sum')   totals[col.field] = vals.reduce((a, b) => a + b, 0);
    if (col.totalType === 'avg')   totals[col.field] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    if (col.totalType === 'count') totals[col.field] = vals.length;
    if (col.totalType === 'min')   totals[col.field] = Math.min(...vals);
    if (col.totalType === 'max')   totals[col.field] = Math.max(...vals);
  }
  return totals;
}

// ── Calcula totalizer ─────────────────────────────────────────
function calcTotalizer(comp: RpbTotalizerComp, data: any[]): number {
  const vals = data.map(r => Number(r[comp.field] || 0));
  if (!vals.length) return 0;
  switch (comp.operation) {
    case 'sum':   return vals.reduce((a, b) => a + b, 0);
    case 'avg':   return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'count': return vals.length;
    case 'min':   return Math.min(...vals);
    case 'max':   return Math.max(...vals);
    default:      return 0;
  }
}

// ── Formata data com máscara ──────────────────────────────────
function formatDateWithMask(d: Date, fmt: string): string {
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const yy   = yyyy.slice(-2);
  const hh   = String(d.getHours()).padStart(2, '0');
  const mi   = String(d.getMinutes()).padStart(2, '0');
  switch (fmt) {
    case 'dd/mm/yy':          return `${dd}/${mm}/${yy}`;
    case 'dd/mm/yy hh:mm':    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
    case 'dd/mm/yyyy hh:mm':  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    case 'hh:mm':             return `${hh}:${mi}`;
    default:                  return `${dd}/${mm}/${yyyy}`;
  }
}

// ── Substitui variáveis de sistema num texto ──────────────────
// Suporta tanto {campo} quanto {{campo}} (ambos funcionam)
function resolveText(
  content: string,
  row: Record<string, any> = {},
  extraVars: Record<string, any> = {},
  opts?: { dateFormat?: RpbDateFormat; decimals?: number }
): string {
  let out = content;
  const allVars = { ...row, ...extraVars };

  // Substitui {{campo}} primeiro (dois pares de chaves)
  for (const [k, v] of Object.entries(allVars)) {
    out = out.split(`{{${k}}}`).join(String(v ?? ''));
  }
  // Depois substitui {campo} (par simples de chaves)
  for (const [k, v] of Object.entries(allVars)) {
    out = out.split(`{${k}}`).join(String(v ?? ''));
  }

  // Variáveis de sistema — aplica máscara de data se configurada
  const now = new Date();
  const dateFmt = opts?.dateFormat || 'dd/mm/yyyy';
  const dataBR  = formatDateWithMask(now, dateFmt);
  const dataBRDefault = now.toLocaleDateString('pt-BR');
  const horaBR  = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const horaBRFull = now.toLocaleTimeString('pt-BR');

  // {data} e {data_emissao} respeitam a máscara configurada no componente
  out = out.split('{data}').join(dataBR)
           .split('{{data}}').join(dataBR)
           .split('{data_emissao}').join(dataBR)
           .split('{{data_emissao}}').join(dataBR)
           .split('{hora}').join(horaBRFull)
           .split('{{hora}}').join(horaBRFull)
           .split('{hora_emissao}').join(horaBR)
           .split('{{hora_emissao}}').join(horaBR)
           .split('{datetime_emissao}').join(`${dataBRDefault} ${horaBR}`)
           .split('{{datetime_emissao}}').join(`${dataBRDefault} ${horaBR}`);

  return out;
}

// ── Estilos inline de um componente de texto ─────────────────
function textStyle(s: typeof DEFAULT_STYLE): string {
  const border = s.border === 'none' ? 'border: none;'
    : s.border === 'all' ? `border: 1px solid ${s.borderColor};`
    : `border-${s.border}: 1px solid ${s.borderColor};`;

  return [
    `font-size: ${s.fontSize}pt;`,
    s.bold      ? 'font-weight: bold;'   : '',
    s.italic    ? 'font-style: italic;'  : '',
    s.underline ? 'text-decoration: underline;' : '',
    `color: ${s.color};`,
    s.bgColor !== 'transparent' ? `background-color: ${s.bgColor};` : '',
    `text-align: ${s.align};`,
    border,
    `padding: ${s.padding}px;`,
    'box-sizing: border-box;',
  ].join(' ');
}

// ── Renderiza um componente numa banda ────────────────────────
function renderComponent(
  comp: RpbComponent,
  data: any[],
  row: Record<string, any> = {},
  extraVars: Record<string, any> = {}
): string {
  const pos = `
    position: absolute;
    left: ${comp.x}mm; top: ${comp.y}mm;
    width: ${comp.w}mm; height: ${(comp.type === 'line' && (comp as RpbLineComp).orientation !== 'vertical') ? 'auto' : comp.h + 'mm'};
    overflow: hidden; box-sizing: border-box;
  `;

  switch (comp.type) {
    case 'text': {
      const c = comp as RpbTextComp;
      const txt = resolveText(c.content, row, extraVars, { dateFormat: c.dateFormat, decimals: c.decimals });
      const s = c.style || DEFAULT_STYLE;
      return `<div style="${pos} ${textStyle(s)}">${txt}</div>`;
    }

    case 'image': {
      const c = comp as RpbImageComp;
      const src = resolveText(c.src, row, extraVars);
      return `<div style="${pos}">
        <img src="${src}" style="width:100%;height:100%;object-fit:${c.fit};" />
      </div>`;
    }

    case 'line': {
      const c = comp as RpbLineComp;
      if (c.orientation === 'vertical') {
        return `<div style="${pos}">
          <div style="width:${c.thickness}px;height:100%;background-color:${c.color};margin:0;"></div>
        </div>`;
      }
      return `<div style="${pos}">
        <hr style="border:none;border-top:${c.thickness}px solid ${c.color};margin:0;" />
      </div>`;
    }

    case 'box': {
      const c = comp as RpbBoxComp;
      const bg = c.bgColor !== 'transparent' ? `background-color:${c.bgColor};` : '';
      const radius = c.borderRadius ? `border-radius:${c.borderRadius}px;` : '';
      return `<div style="${pos} border:${c.borderThickness}px solid ${c.borderColor};${bg}${radius}"></div>`;
    }

    case 'totalizer': {
      const c = comp as RpbTotalizerComp;
      const val = calcTotalizer(c, data);
      const s = c.style || DEFAULT_STYLE;
      return `<div style="${pos} display:flex;align-items:center;gap:4px;${textStyle(s)}">
        <span style="color:#666">${c.labelText}</span>
        <span style="font-weight:bold">${formatValue(val, c.format, { decimals: (c as any).decimals, dateFormat: (c as any).dateFormat as RpbDateFormat })}</span>
      </div>`;
    }

    case 'table': {
      const c = comp as RpbTableComp;
      const cols = c.columns || [];
      const hs = c.headerStyle || DEFAULT_STYLE;
      const rs = c.rowStyle   || DEFAULT_STYLE;
      const totals = c.showColumnTotals ? calcTotals(data, cols) : {};

      // Fonte da tabela pode vir de rowStyle.fontSize
      const tableFontSize = rs.fontSize || 9;

      const colWidths = cols.map(col => `<col style="width:${col.w}mm" />`).join('');

      const thead = c.showHeader ? `
        <thead>
          <tr>
            ${cols.map(col => {
              // Usa estilo de coluna individual se existir, senão o estilo do cabeçalho
              const colHs = (col as any).headerStyle ? { ...hs, ...(col as any).headerStyle } : hs;
              return `<th style="padding:${colHs.padding}px;text-align:${col.align};
                font-size:${(col as any).fontSize || colHs.fontSize || tableFontSize}pt;
                font-weight:bold;
                background-color:${colHs.bgColor !== 'transparent' ? colHs.bgColor : '#f1f5f9'};
                border:1px solid ${colHs.borderColor || '#ddd'};
                box-sizing:border-box;">${col.label}</th>`;
            }).join('')}
          </tr>
        </thead>` : '';

      const tbody = `
        <tbody>
          ${data.map((row, i) => {
            const bg = i % 2 === 1 && c.altRowBg !== 'transparent'
              ? `background-color:${c.altRowBg};` : '';
            return `<tr style="${bg}">
              ${cols.map(col => {
                const colFontSize = (col as any).fontSize || rs.fontSize || tableFontSize;
                const colColor = (col as any).color || rs.color || '#1a1a1a';
                return `<td style="padding:${rs.padding}px;text-align:${col.align};
                  font-size:${colFontSize}pt;
                  color:${colColor};
                  border:1px solid #e5e7eb;
                  box-sizing:border-box;">
                  ${formatValue(row[col.field], col.format, { decimals: (col as any).decimals, dateFormat: (col as any).dateFormat as RpbDateFormat })}
                </td>`;
              }).join('')}
            </tr>`;
          }).join('')}
        </tbody>`;

      const tfoot = c.showColumnTotals && Object.keys(totals).length ? `
        <tfoot>
          <tr style="font-weight:bold;background:#f1f5f9;">
            ${cols.map(col => `
              <td style="padding:${rs.padding}px;text-align:${col.align};border:1px solid #ddd;box-sizing:border-box;font-size:${rs.fontSize || tableFontSize}pt;">
                ${totals[col.field] !== undefined ? formatValue(totals[col.field], col.format, { decimals: (col as any).decimals }) : ''}
              </td>`).join('')}
          </tr>
        </tfoot>` : '';

      // Tabela renderizada fora do position:absolute para fluir com o conteúdo
      return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${tableFontSize}pt;">
          <colgroup>${colWidths}</colgroup>
          ${thead}${tbody}${tfoot}
        </table>`;
    }

    default: return '';
  }
}

// ── Renderiza uma banda com componentes NÃO-tabela ────────────
// (usa position:absolute — adequado para cabeçalho/rodapé)
function renderBand(
  band: RpbBand,
  data: any[],
  row: Record<string, any> = {},
  extraVars: Record<string, any> = {},
  skipTable = false
): string {
  if (!band.visible || band.height === 0) return '';
  const bg = band.bgColor !== 'transparent' ? `background-color:${band.bgColor};` : '';
  const comps = skipTable
    ? band.components.filter(c => c.type !== 'table')
    : band.components;

  // Usa height fixo (não min-height) para que position:absolute funcione corretamente
  return `<div style="position:relative;width:100%;height:${band.height}mm;${bg}overflow:hidden;page-break-inside:avoid;">
    ${comps.map(c => renderComponent(c, data, row, extraVars)).join('')}
  </div>`;
}

// ── Renderiza banda de detalhe (tabela + texto por linha) ─────
// Tabelas são exibidas uma vez para todos os dados.
// Componentes text/outros são renderizados por linha individualmente.
function renderDetailBand(band: RpbBand, data: any[], extraVars: Record<string, any> = {}): string {
  if (!band.visible || band.height === 0) return '';

  const tableComps = band.components.filter(c => c.type === 'table') as RpbTableComp[];
  const otherComps = band.components.filter(c => c.type !== 'table');

  let html = '';

  // Renderiza tabelas (abrangem todos os dados de uma vez)
  if (tableComps.length > 0) {
    html += tableComps.map(comp => renderComponent(comp, data, {}, extraVars)).join('');
  }

  // Renderiza componentes text/outros uma vez por linha de dados
  if (otherComps.length > 0) {
    const bg = band.bgColor !== 'transparent' ? `background-color:${band.bgColor};` : '';
    for (const row of data) {
      html += `<div style="position:relative;width:100%;height:${band.height}mm;${bg}overflow:hidden;">
        ${otherComps.map(c => renderComponent(c, data, row, extraVars)).join('')}
      </div>`;
    }
  }

  return html;
}

// ── Agrupamento ────────────────────────────────────────────────
function groupData(data: any[], field: string): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of data) {
    const key = String(row[field] ?? '');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return map;
}

// ── HTML de uma seção agrupada ─────────────────────────────────
function renderGroupSection(
  layout: RpbLayout,
  data: any[],
  allData: any[],
  extraVars: Record<string, any> = {},
  group1?: RpbGroupDef,
  group2?: RpbGroupDef
): string {
  let html = '';

  if (group1 && group1.field) {
    const grouped = groupData(data, group1.field);
    for (const [key, g1Rows] of grouped) {
      const pb = group1.pageBreakBefore ? 'page-break-before:always;' : '';
      html += `<div style="${pb}">`;
      const g1ExtraVars = { ...extraVars, grupo1_valor: key, [group1.field]: key };
      html += renderBand(layout.bands.group1Header, g1Rows, { [group1.field]: key }, g1ExtraVars);

      if (group2 && group2.field) {
        const grouped2 = groupData(g1Rows, group2.field);
        for (const [key2, g2Rows] of grouped2) {
          const pb2 = group2.pageBreakBefore ? 'page-break-before:always;' : '';
          html += `<div style="${pb2}">`;
          const g2ExtraVars = { ...g1ExtraVars, grupo2_valor: key2, [group2.field]: key2 };
          html += renderBand(layout.bands.group2Header, g2Rows, { [group2.field]: key2 }, g2ExtraVars);
          html += renderDetailBand(layout.bands.detail, g2Rows, g2ExtraVars);
          html += renderBand(layout.bands.group2Footer, g2Rows, {}, g2ExtraVars, true);
          html += `</div>`;
        }
      } else {
        html += renderDetailBand(layout.bands.detail, g1Rows, g1ExtraVars);
      }

      html += renderBand(layout.bands.group1Footer, g1Rows, {}, g1ExtraVars, true);
      html += `</div>`;
    }
  } else {
    html += renderDetailBand(layout.bands.detail, data, extraVars);
  }

  return html;
}

// ── Gerador principal ──────────────────────────────────────────
export function generateReportHtml(
  layout: RpbLayout,
  data: any[],
  extraVars: Record<string, any> = {}
): string {
  const group1 = layout.groups.find(g => g.level === 1);
  const group2 = layout.groups.find(g => g.level === 2);

  const { top, right, bottom, left } = layout.margins;

  // Variáveis de sistema disponíveis em todos os campos de texto
  const now = new Date();
  const sysVars: Record<string, any> = {
    data:             now.toLocaleDateString('pt-BR'),
    hora:             now.toLocaleTimeString('pt-BR'),
    data_emissao:     now.toLocaleDateString('pt-BR'),
    hora_emissao:     now.toLocaleTimeString('pt-BR'),
    datetime_emissao: `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`,
    ...extraVars,
  };

  const pageStyle = `
    @page {
      size: ${layout.pageSize} ${layout.orientation};
      margin: ${top}mm ${right}mm ${bottom}mm ${left}mm;
    }
    @media print {
      body { margin: 0; padding: 0; background: #fff !important; }
      .rpb-page-header { position: running(pageHeader); }
      .rpb-page-footer { position: running(pageFooter); }
      tr { page-break-inside: avoid; }
    }
    * { box-sizing: border-box; }
    html {
      background: #ffffff;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      background: #ffffff;
      margin: 0;
      padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
    }
    table { border-collapse: collapse; }
    td, th { word-break: break-word; }
  `;

  const body = [
    renderBand(layout.bands.pageHeader,   data, {}, sysVars),
    renderBand(layout.bands.reportHeader, data, {}, sysVars),
    renderGroupSection(layout, data, data, sysVars, group1, group2),
    renderBand(layout.bands.reportFooter, data, {}, sysVars, true),
    renderBand(layout.bands.pageFooter,   data, {}, sysVars),
  ].join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Relatório</title>
  <style>${pageStyle}</style>
</head>
<body>${body}</body>
</html>`;
}
