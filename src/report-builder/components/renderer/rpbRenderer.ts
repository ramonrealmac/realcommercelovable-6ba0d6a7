// ============================================================
// Report Builder Pro — Renderer HTML
// Produz HTML imprimível com agrupamentos e totalizadores
// ============================================================
import type {
  RpbLayout, RpbBand, RpbComponent, RpbGroupDef,
  RpbTableComp, RpbTextComp, RpbTotalizerComp,
  RpbImageComp, RpbLineComp, RpbBoxComp, RpbTableColumn,
  RpbFormat, RpbDateFormat, RpbSubreportComp,
} from '../../types';
import { formatValue, DEFAULT_STYLE } from '../../types';

// ── Mapa de dados pré-carregados dos sub-relatórios ──────────
// compId → rowKey → rows[]
export type SubReportDataMap = Record<string, Record<string, any[]>>;

function getFieldValue(row: Record<string, any>, field: string): any {
  if (row[field] !== undefined) return row[field];
  // Case-insensitive lookup
  const lowerField = field.toLowerCase();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase() === lowerField) return v;
  }
  return undefined;
}

// ── Calcula totais de um dataset ──────────────────────────────
function calcTotals(data: any[], columns: RpbTableColumn[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const col of columns) {
    if (col.totalType === 'none') continue;
    const vals = data.map(r => Number(getFieldValue(r, col.field) || 0));
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
  const vals = data.map(r => Number(getFieldValue(r, comp.field) || 0));
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
  opts?: { format?: RpbFormat; dateFormat?: RpbDateFormat; decimals?: number }
): string {
  let out = content;
  const allVars = { ...row, ...extraVars };

  // Substitui variáveis do dataset e extras
  for (const [k, v] of Object.entries(allVars)) {
    let valStr = String(v ?? '');

    // Se houver um formato definido (ex: número/moeda), tenta formatar o valor da variável
    if (opts?.format && opts.format !== 'text' && v !== null && v !== undefined && v !== '') {
      valStr = formatValue(v, opts.format, { decimals: opts.decimals, dateFormat: opts.dateFormat });
    }

    const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{{1,2}\\s*${escapedK}\\s*\\}{1,2}`, 'gi');
    out = out.replace(regex, () => valStr);
  }

  // Variáveis de sistema
  const now = new Date();
  const dateFmt = opts?.dateFormat || 'dd/mm/yyyy';
  const dataBR = formatDateWithMask(now, dateFmt);
  const dataBRDefault = now.toLocaleDateString('pt-BR');
  const horaBR  = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sysVarsMap: Record<string, any> = {
    data: dataBR,
    hora: now.toLocaleTimeString('pt-BR'),
    data_emissao: dataBR,
    hora_emissao: horaBR,
    datetime_emissao: `${dataBRDefault} ${horaBR}`,
  };

  // Aplica substituição de sistema (usando o mesmo motor robusto)
  for (const [k, v] of Object.entries(sysVarsMap)) {
    const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{{1,2}\\s*${escapedK}\\s*\\}{1,2}`, 'gi');
    out = out.replace(regex, () => String(v ?? ''));
  }

  return out;
}

// ── Estilos inline de um componente de texto ─────────────────
function textStyle(s: typeof DEFAULT_STYLE): string {
  const border = s.border === 'none' ? 'border: none;'
    : s.border === 'all' ? `border: 1px solid ${s.borderColor};`
    : `border-${s.border}: 1px solid ${s.borderColor};`;

  const fontFam = (s as any).fontFamily ? `font-family: ${(s as any).fontFamily};` : '';

  return [
    `font-size: ${s.fontSize}pt;`,
    fontFam,
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
  extraVars: Record<string, any> = {},
  altBgColor?: string,
  subDataMap?: SubReportDataMap
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
      const txt = resolveText(c.content, row, extraVars, { format: c.format, dateFormat: c.dateFormat, decimals: c.decimals });
      const s = c.style || DEFAULT_STYLE;
      const border = s.border === 'none' ? 'border:none;'
        : s.border === 'all' ? `border:1px solid ${s.borderColor};`
        : `border-${s.border}:1px solid ${s.borderColor};`;
      const bgStyle = s.bgColor !== 'transparent' ? `background-color:${s.bgColor};` : '';
      const justify = s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start';
      const fontFam = s.fontFamily ? `font-family:${s.fontFamily};` : '';
      return `<div style="${pos} display:flex; align-items:center; justify-content:${justify}; ${bgStyle} ${border} ${fontFam} padding:${s.padding}px; font-size:${s.fontSize}pt; ${
        s.bold ? 'font-weight:bold;' : ''}${ s.italic ? 'font-style:italic;' : ''}${
        s.underline ? 'text-decoration:underline;' : ''} color:${s.color}; white-space:nowrap;">${txt}</div>`;
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
      const justify = s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start';
      const bgStyle = s.bgColor !== 'transparent' ? `background-color:${s.bgColor};` : '';
      const fontFam = s.fontFamily ? `font-family:${s.fontFamily};` : '';
      const formattedVal = formatValue(val, c.format, { decimals: (c as any).decimals, dateFormat: (c as any).dateFormat as RpbDateFormat });
      return `<div style="${pos} display:flex; align-items:center; justify-content:${justify}; gap:4px; ${bgStyle} ${fontFam} font-size:${s.fontSize}pt; ${
        s.bold ? 'font-weight:bold;' : ''} color:${s.color};">
        <span style="color:#555;">${c.labelText}</span>
        <span style="font-weight:bold;">${formattedVal}</span>
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
            const currentAltBg = c.altRowBg && c.altRowBg !== 'transparent' ? c.altRowBg : altBgColor;
            const bg = i % 2 === 1 && currentAltBg && currentAltBg !== 'transparent'
              ? `background-color:${currentAltBg};` : '';
            return `<tr style="${bg}">
              ${cols.map(col => {
                const colFontSize = (col as any).fontSize || rs.fontSize || tableFontSize;
                const colColor = (col as any).color || rs.color || '#1a1a1a';
                return `<td style="padding:${rs.padding}px;text-align:${col.align};
                  font-size:${colFontSize}pt;
                  color:${colColor};
                  border:1px solid #e5e7eb;
                  box-sizing:border-box;">
                  ${formatValue(getFieldValue(row, col.field), col.format, { decimals: (col as any).decimals, dateFormat: (col as any).dateFormat as RpbDateFormat })}
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
      return `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${tableFontSize}pt;background-color:#ffffff;">
          <colgroup>${colWidths}</colgroup>
          ${thead}${tbody}${tfoot}
        </table>`;
    }

    case 'subreport': {
      const c = comp as RpbSubreportComp;
      // Monta chave do cache (valores dos campos de vínculo na linha atual)
      const rowKey = JSON.stringify(c.links.map(l => row[l.parentField]));
      const subRows = subDataMap?.[c.id]?.[rowKey] || [];

      const cols = c.columns || [];
      const hs = c.headerStyle || DEFAULT_STYLE;
      const rs = c.rowStyle   || DEFAULT_STYLE;
      const fontSize = rs.fontSize || 9;

      // Interpolação de variáveis no título e subtítulo do sub-relatório
      const interpolateText = (txt?: string) => {
        if (!txt) return '';
        return txt.replace(/\{{1,2}\s*([\w\.]+)\s*\}{1,2}/g, (_, key) => {
          const val = getFieldValue(row, key) ?? extraVars?.[key];
          return val !== undefined && val !== null ? String(val) : `{${key}}`;
        });
      };

      // ── 1. Banda de Cabeçalho do Sub-Relatório ─────────────────
      let headerHtml = '';
      if (c.headerComponents && c.headerComponents.length > 0) {
        const hHeight = c.headerHeight || 15;
        headerHtml = `<div style="position:relative;width:100%;height:${hHeight}mm;overflow:hidden;box-sizing:border-box;">
          ${c.headerComponents.map(hComp => renderComponent(hComp, subRows, row, extraVars, undefined, undefined)).join('')}
        </div>`;
      } else if (c.showTitleBar) {
        const titleTextInterpolated = interpolateText(c.titleText || '');
        const subtitleTextInterpolated = interpolateText(c.headerSubtitle || '');
        const bg = hs.bgColor !== 'transparent' ? hs.bgColor : '#f1f5f9';
        const fg = hs.color || '#1e293b';
        const fontSz = hs.fontSize || 9;
        const fontW = hs.bold ? 'bold' : 'normal';
        const fontSt = hs.italic ? 'italic' : 'normal';
        const textAlg = hs.align || 'left';
        const borderStyle = hs.border === 'none'
          ? 'border:none;'
          : hs.border === 'bottom'
          ? `border-bottom:1px solid ${hs.borderColor || '#cbd5e1'};`
          : `border:1px solid ${hs.borderColor || '#cbd5e1'};`;
        const pad = hs.padding !== undefined ? hs.padding : 4;

        const badgeHtml = c.showHeaderBadge
          ? `<span style="font-size:${Math.max(7, fontSz - 2)}pt;font-weight:600;padding:1px 6px;border-radius:9999px;background-color:rgba(0,0,0,0.06);color:${fg};margin-left:6px;display:inline-block;">${subRows.length} registro(s)</span>`
          : '';

        const subtitleHtml = subtitleTextInterpolated
          ? `<div style="font-size:${Math.max(7.5, fontSz - 1.5)}pt;font-weight:normal;opacity:0.85;margin-top:2px;">${subtitleTextInterpolated}</div>`
          : '';

        headerHtml = `<div style="font-size:${fontSz}pt;font-weight:${fontW};font-style:${fontSt};text-align:${textAlg};color:${fg};background-color:${bg};${borderStyle}padding:${pad}px ${pad + 2}px;margin-bottom:2px;border-radius:2px;box-sizing:border-box;">
          <div>
            <span>${titleTextInterpolated || ''}</span>
            ${badgeHtml}
          </div>
          ${subtitleHtml}
        </div>`;
      }

      // ── 2. Banda de Rodapé do Sub-Relatório ───────────────────
      let footerHtml = '';
      if (c.footerComponents && c.footerComponents.length > 0) {
        const fHeight = c.footerHeight || 15;
        footerHtml = `<div style="position:relative;width:100%;height:${fHeight}mm;overflow:hidden;box-sizing:border-box;">
          ${c.footerComponents.map(fComp => renderComponent(fComp, subRows, row, extraVars, undefined, undefined)).join('')}
        </div>`;
      }

      // ── 3. Corpo/Detalhe do Sub-Relatório ──────────────────────
      let bodyHtml = '';
      if (!subRows.length) {
        bodyHtml = `<div style="font-size:${fontSize}pt;color:#888;padding:2px 4px;font-style:italic;">${c.emptyMessage || 'Nenhum registro'}</div>`;
      } else if (c.tipoLayout === 'custom') {
        const customComps = c.customComponents || [];
        const customHtml = subRows.map((subRow, i) => {
          const bg = i % 2 === 1 && c.altRowBg && c.altRowBg !== 'transparent'
            ? `background-color:${c.altRowBg};` : '';
          return `<div style="position:relative;width:100%;height:${c.rowHeight || 15}mm;${bg}overflow:hidden;page-break-inside:avoid;">
            ${customComps.map(comp => renderComponent(comp, subRows, subRow, extraVars, undefined, undefined)).join('')}
          </div>`;
        }).join('');
        bodyHtml = `<div style="width:100%;display:flex;flex-direction:column;">${customHtml}</div>`;
      } else {
        // Renderização Tabela (padrão)
        const colgroup = cols.map(col => `<col style="width:${col.w}mm" />`).join('');
        const totals = (c as any).showColumnTotals ? calcTotals(subRows, cols) : {};

        const thead = c.showHeader && cols.length ? `
          <thead><tr>${cols.map(col => {
            const colHs = (col as any).headerStyle ? { ...hs, ...(col as any).headerStyle } : hs;
            const colBg = colHs.bgColor !== 'transparent' ? colHs.bgColor : '#f1f5f9';
            const colFg = colHs.color || '#1e293b';
            const colFontSz = (col as any).fontSize || colHs.fontSize || fontSize;
            const colFontW = colHs.bold !== false ? 'bold' : 'normal';
            const colFontSt = colHs.italic ? 'italic' : 'normal';
            const colBorderColor = colHs.borderColor || '#cbd5e1';
            const colBorder = colHs.border === 'none' ? 'border:none;'
              : colHs.border === 'bottom' ? `border-bottom:1px solid ${colBorderColor};`
              : `border:1px solid ${colBorderColor};`;
            return `<th style="padding:${colHs.padding ?? 4}px;text-align:${col.align || 'left'};
              font-size:${colFontSz}pt;
              font-weight:${colFontW};
              font-style:${colFontSt};
              color:${colFg};
              background-color:${colBg};
              ${colBorder}box-sizing:border-box;">${col.label}</th>`;
          }).join('')}</tr></thead>` : '';

        const tbody = `<tbody>${subRows.map((subRow, i) => {
          const rowBg = i % 2 === 1 && (c as any).altRowBg && (c as any).altRowBg !== 'transparent'
            ? `background-color:${(c as any).altRowBg};`
            : rs.bgColor && rs.bgColor !== 'transparent'
            ? `background-color:${rs.bgColor};`
            : i % 2 === 1 ? 'background-color:#f8fafc;' : '';
          return `<tr style="${rowBg}">${cols.map(col => {
            const colFontSize = (col as any).fontSize || rs.fontSize || fontSize;
            const colColor = (col as any).color || rs.color || '#1a1a1a';
            const colBold = (col as any).bold || (col as any).style?.bold || rs.bold ? 'font-weight:bold;' : '';
            const colItalic = (col as any).italic || (col as any).style?.italic || rs.italic ? 'font-style:italic;' : '';
            const colBorderColor = rs.borderColor || '#e5e7eb';
            const colBorder = rs.border === 'none' ? 'border:none;'
              : rs.border === 'bottom' ? `border-bottom:1px solid ${colBorderColor};`
              : `border:1px solid ${colBorderColor};`;
            return `<td style="padding:${rs.padding ?? 4}px;text-align:${col.align || 'left'};
              font-size:${colFontSize}pt;
              color:${colColor};
              ${colBold}
              ${colItalic}
              ${colBorder}box-sizing:border-box;">
              ${formatValue(getFieldValue(subRow, col.field), col.format, { decimals: (col as any).decimals, dateFormat: (col as any).dateFormat as RpbDateFormat })}
            </td>`;
          }).join('')}</tr>`;
        }).join('')}</tbody>`;

        const tfoot = (c as any).showColumnTotals && Object.keys(totals).length ? `
          <tfoot>
            <tr style="font-weight:bold;background:#f1f5f9;">
              ${cols.map(col => `
                <td style="padding:${rs.padding ?? 4}px;text-align:${col.align || 'left'};border:1px solid #cbd5e1;box-sizing:border-box;font-size:${rs.fontSize || fontSize}pt;">
                  ${totals[col.field] !== undefined ? formatValue(totals[col.field], col.format, { decimals: (col as any).decimals }) : ''}
                </td>`).join('')}
            </tr>
          </tfoot>` : '';

        bodyHtml = `<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:${fontSize}pt;">
          <colgroup>${colgroup}</colgroup>
          ${thead}${tbody}${tfoot}
        </table>`;
      }

      const subreportHtml = `${headerHtml}${bodyHtml}${footerHtml}`;

      // Posicionamento absoluto do sub-relatório dentro da banda onde foi inserido
      return `<div style="${pos} height:auto; overflow:visible;">${subreportHtml}</div>`;
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
  skipTable = false,
  subDataMap?: SubReportDataMap
): string {
  if (!band.visible || band.height === 0) return '';
  const bg = band.bgColor !== 'transparent' ? `background-color:${band.bgColor};` : '';
  const comps = skipTable
    ? band.components.filter(c => c.type !== 'table')
    : band.components;

  return `<div class="rpb-band-row" style="position:relative;width:100%;min-height:${band.height}mm;${bg}overflow:visible;page-break-inside:avoid;break-inside:avoid;">
    ${comps.map(c => renderComponent(c, data, row, extraVars, undefined, subDataMap)).join('')}
  </div>`;
}

// ── Renderiza banda de detalhe (tabela + texto por linha) ─────
// Tabelas são exibidas uma vez para todos os dados.
// Componentes text/outros/subreports são renderizados por linha individualmente respeitando coordenadas.
function renderDetailBand(
  band: RpbBand, 
  data: any[], 
  extraVars: Record<string, any> = {},
  altBgColor?: string,
  subDataMap?: SubReportDataMap
): string {
  if (!band.visible || band.height === 0) return '';

  const tableComps = band.components.filter(c => c.type === 'table') as RpbTableComp[];
  const otherComps = band.components.filter(c => c.type !== 'table');

  let html = '';

  // Renderiza tabelas (abrangem todos os dados de uma vez)
  if (tableComps.length > 0) {
    html += tableComps.map(comp => renderComponent(comp, data, {}, extraVars, altBgColor, subDataMap)).join('');
  }

  // Renderiza componentes posicionados (text, line, box, image, totalizer, subreport) uma vez por linha de dados
  if (otherComps.length > 0) {
    data.forEach((row, i) => {
      const isAlt = i % 2 === 1;
      const rowColor = isAlt ? (altBgColor || 'transparent') : (band.bgColor || 'transparent');
      const bgStyle = (rowColor && rowColor !== 'transparent') ? `background-color:${rowColor} !important;` : '';

      html += `<div class="rpb-detail-row" style="position:relative;width:100%;min-height:${band.height}mm;${bgStyle}overflow:visible;page-break-inside:avoid;break-inside:avoid;">
        ${otherComps.map(c => renderComponent(c, data, row, extraVars, altBgColor, subDataMap)).join('')}
      </div>`;
    });
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
  group2?: RpbGroupDef,
  subDataMap?: SubReportDataMap
): string {
  let html = '';

  if (group1 && group1.field) {
    const grouped = groupData(data, group1.field);
    for (const [key, g1Rows] of grouped) {
      const pb = group1.pageBreakBefore ? 'page-break-before:always;' : '';
      html += `<div style="${pb}">`;
      const g1ExtraVars = { ...extraVars, grupo1_valor: key, [group1.field]: key };
      html += renderBand(layout.bands.group1Header, g1Rows, g1Rows[0] || { [group1.field]: key }, g1ExtraVars, false, subDataMap);

      if (group2 && group2.field) {
        const grouped2 = groupData(g1Rows, group2.field);
        for (const [key2, g2Rows] of grouped2) {
          const pb2 = group2.pageBreakBefore ? 'page-break-before:always;' : '';
          html += `<div style="${pb2}">`;
          const g2ExtraVars = { ...g1ExtraVars, grupo2_valor: key2, [group2.field]: key2 };
          html += renderBand(layout.bands.group2Header, g2Rows, g2Rows[0] || { [group2.field]: key2 }, g2ExtraVars, false, subDataMap);
          html += renderDetailBand(layout.bands.detail, g2Rows, g2ExtraVars, layout.detailAltBgColor, subDataMap);
          html += renderBand(layout.bands.group2Footer, g2Rows, g2Rows[g2Rows.length - 1] || {}, g2ExtraVars, true, subDataMap);
          html += `</div>`;
        }
      } else {
        html += renderDetailBand(layout.bands.detail, g1Rows, g1ExtraVars, layout.detailAltBgColor, subDataMap);
      }

      html += renderBand(layout.bands.group1Footer, g1Rows, g1Rows[g1Rows.length - 1] || {}, g1ExtraVars, true, subDataMap);
      html += `</div>`;
    }
  } else {
    html += renderDetailBand(layout.bands.detail, data, extraVars, layout.detailAltBgColor, subDataMap);
  }

  return html;
}

// ── Gerador principal ──────────────────────────────────────────
export function generateReportHtml(
  layout: RpbLayout,
  data: any[],
  extraVars: Record<string, any> = {},
  subDataMap?: SubReportDataMap,
  isPrint: boolean = false
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

  const headerHeight = layout.bands.pageHeader.visible ? (layout.bands.pageHeader.height || 0) : 0;
  const footerHeight = layout.bands.pageFooter.visible ? (layout.bands.pageFooter.height || 0) : 0;

  const getPaperCssSize = (pageSize: string, orientation: string): string => {
    const ps = (pageSize || 'a4').toString().toLowerCase();
    const orient = orientation === 'landscape' ? 'landscape' : 'portrait';
    if (ps === 'roll50') return orient === 'landscape' ? '200mm 50mm' : '50mm 200mm';
    if (ps === 'roll80') return orient === 'landscape' ? '200mm 80mm' : '80mm 200mm';
    return `${pageSize} ${orient}`;
  };

  const cssSize = getPaperCssSize(layout.pageSize, layout.orientation);

  let pageStyle = '';
  if (isPrint) {
    pageStyle = `
      @page {
        size: ${cssSize};
        margin-top: ${top + headerHeight}mm;
        margin-bottom: ${bottom + footerHeight}mm;
        margin-left: ${left}mm;
        margin-right: ${right}mm;
      }
      * { box-sizing: border-box; }
      html, body {
        background: #ffffff;
        margin: 0 !important;
        padding: 0 !important;
        font-family: 'Inter', Arial, sans-serif;
        font-size: 9pt;
        color: #1a1a1a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .rpb-margin-wrap { 
        display: block !important; 
        padding: 0 !important; 
      }
      /* Cabeçalho fixo: posicionado na margem superior reservada pelo @page */
      .rpb-page-header {
        position: fixed;
        top: -${headerHeight}mm;
        left: 0;
        right: 0;
        height: ${headerHeight}mm;
        overflow: hidden;
        z-index: 1000;
      }
      /* Rodapé fixo: posicionado na margem inferior reservada pelo @page */
      .rpb-page-footer {
        position: fixed;
        bottom: -${footerHeight}mm;
        left: 0;
        right: 0;
        height: ${footerHeight}mm;
        overflow: hidden;
        z-index: 1000;
      }
      /* Remove clipping das linhas de detalhe para evitar corte na quebra de página */
      .rpb-band-row,
      .rpb-detail-row {
        overflow: visible !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      /* Tabelas de dados fluem com quebra automática por linha */
      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    `;

  } else {
    pageStyle = `
      @page {
        size: ${cssSize};
        margin: 0;
      }
      * { box-sizing: border-box; }
      html, body {
        background: #ffffff;
        margin: 0;
        padding: 0;
        font-family: 'Inter', Arial, sans-serif;
        font-size: 9pt;
        color: #1a1a1a;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        height: 100%;
      }
      .rpb-margin-wrap {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        padding: ${top}mm ${right}mm ${bottom}mm ${left}mm;
        box-sizing: border-box;
        background: #ffffff;
      }
      .rpb-screen-layout {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .rpb-main-content {
        flex: 1 0 auto;
      }
      .rpb-page-header, .rpb-page-footer {
        width: 100%;
        flex-shrink: 0;
      }
      table { border-collapse: collapse; }
      td, th { word-break: break-word; }
      tr { page-break-inside: avoid; }
    `;
  }

  const firstRow = data[0] || {};
  const lastRow  = data[data.length - 1] || {};

  const renderedPageHeader   = renderBand(layout.bands.pageHeader,   data, firstRow, sysVars, false, subDataMap);
  const renderedReportHeader = renderBand(layout.bands.reportHeader, data, firstRow, sysVars, false, subDataMap);
  const renderedGroupSection = renderGroupSection(layout, data, data, sysVars, group1, group2, subDataMap);
  const renderedReportFooter = renderBand(layout.bands.reportFooter, data, lastRow, sysVars, true, subDataMap);
  const renderedPageFooter   = renderBand(layout.bands.pageFooter,   data, lastRow, sysVars, false, subDataMap);

  const body = `
    <!-- Cabeçalho de Página -->
    <div class="rpb-page-header">${renderedPageHeader}</div>

    <!-- Layout de Tela / PDF / Impressão (Sem tabelas aninhadas de layout) -->
    <div class="rpb-screen-layout">
      <div class="rpb-main-content">
        ${renderedReportHeader}
        ${renderedGroupSection}
        ${renderedReportFooter}
      </div>
    </div>

    <!-- Rodapé de Página -->
    <div class="rpb-page-footer">${renderedPageFooter}</div>
  `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Relatório</title>
  <style>${pageStyle}</style>
</head>
<body><div class="rpb-margin-wrap">${body}</div></body>
</html>`;
}
