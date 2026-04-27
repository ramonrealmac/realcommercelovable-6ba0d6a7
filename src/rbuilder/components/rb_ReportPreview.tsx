import React from "react";
import type { IRbReportLayout, IRbColumnLayout } from "../models/rb_types";

interface Props {
  XData: any[];
  XLayout: IRbReportLayout;
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

const RbReportPreview: React.FC<Props> = ({ XData, XLayout }) => {
  const XCols = XLayout.columns.filter(c => c.visible);
  if (XCols.length === 0) return <div className="p-4 text-center text-muted-foreground text-sm">Configure o layout para visualizar.</div>;

  return (
    <div className="space-y-2">
      {XLayout.showHeader && (
        <div className="mb-2">
          <h3 className="text-lg font-bold">{XLayout.title}</h3>
          {XLayout.subtitle && <p className="text-sm text-muted-foreground">{XLayout.subtitle}</p>}
        </div>
      )}
      <div className="border border-border rounded overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-grid-header text-grid-header-foreground">
              {XCols.map(c => (
                <th key={c.key} className="px-2 py-1.5 font-semibold" style={{ textAlign: c.align, width: `${c.width}px` }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {XData.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-grid-stripe"}>
                {XCols.map(c => (
                  <td key={c.key} className="px-2 py-1 border-t border-border" style={{ textAlign: c.align }}>{rbFormatValue(row[c.key], c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {XLayout.showFooter && (
            <tfoot>
              <tr className="bg-muted font-bold border-t-2 border-border">
                {XCols.map(c => {
                  if (!c.totalType || c.totalType === "none") return <td key={c.key} className="px-2 py-1"></td>;
                  const XValues = XData.map(r => parseFloat(r[c.key]) || 0);
                  let XTotal = "";
                  if (c.totalType === "sum") XTotal = rbFormatValue(XValues.reduce((a, b) => a + b, 0), c);
                  else if (c.totalType === "avg") XTotal = rbFormatValue(XValues.reduce((a, b) => a + b, 0) / (XValues.length || 1), c);
                  else if (c.totalType === "count") XTotal = String(XData.length);
                  return <td key={c.key} className="px-2 py-1" style={{ textAlign: c.align }}>{XTotal}</td>;
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="text-xs text-muted-foreground">{XData.length} registro(s)</div>
    </div>
  );
};

export default RbReportPreview;
