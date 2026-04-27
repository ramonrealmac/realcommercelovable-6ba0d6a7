import type { IRbReportLayout, IRbColumnLayout } from "../models/rb_types";

export function rbExportCsv(XData: any[], XLayout: IRbReportLayout, XTitle: string) {
  const XCols = XLayout.columns.filter(c => c.visible);
  const XHeader = XCols.map(c => `"${c.label}"`).join(";");
  const XRows = XData.map(r => XCols.map(c => `"${rbFormatValue(r[c.key], c)}"`).join(";"));
  const XCsv = "\uFEFF" + [XHeader, ...XRows].join("\n");
  rbDownloadFile(XCsv, `${XTitle}.csv`, "text/csv;charset=utf-8");
}

export async function rbExportPdf(XData: any[], XLayout: IRbReportLayout, XTitle: string) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const XDoc = new jsPDF({ orientation: "landscape" });
  const XCols = XLayout.columns.filter(c => c.visible);

  if (XLayout.showHeader) {
    XDoc.setFontSize(16);
    XDoc.text(XLayout.title || XTitle, 14, 15);
    if (XLayout.subtitle) {
      XDoc.setFontSize(10);
      XDoc.text(XLayout.subtitle, 14, 22);
    }
  }

  const XHead = [XCols.map(c => c.label)];
  const XBody = XData.map(r => XCols.map(c => rbFormatValue(r[c.key], c)));

  // Add footer totals
  if (XLayout.showFooter) {
    const XFooterRow = XCols.map(c => {
      if (!c.totalType || c.totalType === "none") return "";
      const XValues = XData.map(r => parseFloat(r[c.key]) || 0);
      if (c.totalType === "sum") return rbFormatValue(XValues.reduce((a, b) => a + b, 0), c);
      if (c.totalType === "avg") return rbFormatValue(XValues.reduce((a, b) => a + b, 0) / (XValues.length || 1), c);
      if (c.totalType === "count") return String(XData.length);
      return "";
    });
    XBody.push(XFooterRow);
  }

  autoTable(XDoc, {
    head: XHead,
    body: XBody,
    startY: XLayout.showHeader ? (XLayout.subtitle ? 28 : 22) : 10,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [51, 51, 102] },
    columnStyles: Object.fromEntries(
      XCols.map((c, i) => [i, { halign: c.align }])
    ),
  });

  XDoc.save(`${XTitle}.pdf`);
}

export async function rbExportExcel(XData: any[], XLayout: IRbReportLayout, XTitle: string) {
  const XLSX = await import("xlsx");
  const XCols = XLayout.columns.filter(c => c.visible);
  const XWsData = [
    XCols.map(c => c.label),
    ...XData.map(r => XCols.map(c => r[c.key])),
  ];
  const XWs = XLSX.utils.aoa_to_sheet(XWsData);
  const XWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(XWb, XWs, "Relatório");
  XLSX.writeFile(XWb, `${XTitle}.xlsx`);
}

export function rbExportPrint(XData: any[], XLayout: IRbReportLayout, XTitle: string) {
  const XCols = XLayout.columns.filter(c => c.visible);
  const w = window.open("", "_blank");
  if (!w) return;
  const html = `<!DOCTYPE html><html><head><title>${XTitle}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}
    h2{margin-bottom:4px}h4{margin-top:2px;color:#666}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #999;padding:4px 8px;text-align:left}
    th{background:#336;color:#fff}
    tr:nth-child(even){background:#f0f0f0}
    .footer-row{font-weight:bold;background:#ddd!important}
    @media print{button{display:none}}</style></head><body>
    ${XLayout.showHeader ? `<h2>${XLayout.title || XTitle}</h2>${XLayout.subtitle ? `<h4>${XLayout.subtitle}</h4>` : ""}` : ""}
    <table><thead><tr>${XCols.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${XData.map(r => `<tr>${XCols.map(c => `<td style="text-align:${c.align}">${rbFormatValue(r[c.key], c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p style="font-size:11px;color:#666;margin-top:8px">Total: ${XData.length} registro(s)</p>
    <button onclick="window.print()">Imprimir</button></body></html>`;
  w.document.write(html);
  w.document.close();
}

function rbFormatValue(XVal: any, XCol: IRbColumnLayout): string {
  if (XVal === null || XVal === undefined) return "";
  if (XCol.format === "currency") return Number(XVal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (XCol.format === "number") return Number(XVal).toLocaleString("pt-BR");
  if (XCol.format === "date") {
    try { return new Date(XVal).toLocaleDateString("pt-BR"); } catch { return String(XVal); }
  }
  return String(XVal);
}

function rbDownloadFile(XContent: string, XFilename: string, XMimeType: string) {
  const XBlob = new Blob([XContent], { type: XMimeType });
  const XUrl = URL.createObjectURL(XBlob);
  const XA = document.createElement("a");
  XA.href = XUrl;
  XA.download = XFilename;
  XA.click();
  URL.revokeObjectURL(XUrl);
}
