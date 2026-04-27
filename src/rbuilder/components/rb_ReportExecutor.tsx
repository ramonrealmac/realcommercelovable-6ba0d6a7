import React, { useState, useEffect, useCallback } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { rbFetchRelatorios, rbFetchVariaveis } from "../services/rb_reportService";
import { rbFetchConexoes } from "../services/rb_connectionService";
import { rbFetchTemplates } from "../services/rb_templateService";
import { rbExecutarQuery } from "../services/rb_queryService";
import { rbExportPdf, rbExportExcel, rbExportCsv, rbExportPrint } from "../services/rb_exportService";
import RbReportPreview from "./rb_ReportPreview";
import type { IRbRelatorio, IRbConexao, IRbTemplatePesquisa, IRbRelatorioVariavel, IRbReportLayout } from "../models/rb_types";
import { FileText, FileSpreadsheet, File, Printer } from "lucide-react";

const EMPTY_LAYOUT: IRbReportLayout = { title: "", subtitle: "", columns: [], groupByField: "", showHeader: true, showFooter: false };

interface Props {
  XReportId: number;
}

const RbReportExecutor: React.FC<Props> = ({ XReportId }) => {
  const { XEmpresaMatrizId } = useAppContext();
  const [XRelatorio, setXRelatorio] = useState<IRbRelatorio | null>(null);
  const [XVariaveis, setXVariaveis] = useState<IRbRelatorioVariavel[]>([]);
  const [XTemplates, setXTemplates] = useState<IRbTemplatePesquisa[]>([]);
  const [XConexoes, setXConexoes] = useState<IRbConexao[]>([]);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const loadReport = useCallback(async () => {
    const [rels, cons, tpls] = await Promise.all([
      rbFetchRelatorios(XEmpresaMatrizId),
      rbFetchConexoes(XEmpresaMatrizId),
      rbFetchTemplates(XEmpresaMatrizId),
    ]);
    const XRel = rels.find(r => r.rb_relatorio_id === XReportId);
    setXRelatorio(XRel || null);
    setXConexoes(cons);
    setXTemplates(tpls);
    if (XRel) {
      const vars = await rbFetchVariaveis(XRel.rb_relatorio_id);
      setXVariaveis(vars);
    }
  }, [XReportId, XEmpresaMatrizId]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const handleExecutar = async () => {
    if (!XRelatorio) return;
    setXLoading(true);
    const XCon = XConexoes.find(c => c.rb_conexao_id === XRelatorio.rb_conexao_id);
    // Build variable map
    const XVarMap: Record<string, string | number | boolean | null> = {};
    for (const v of XVariaveis) {
      const t = XTemplates.find(tp => tp.rb_templatepesquisa_id === v.rb_templatepesquisa_id);
      if (t) {
        const XVal = XFilterValues[t.nome] ?? t.valor_padrao ?? "";
        if (t.tipo === "integer") XVarMap[t.nome] = XVal ? parseInt(XVal) : null;
        else if (t.tipo === "boolean") XVarMap[t.nome] = XVal === "true";
        else XVarMap[t.nome] = XVal || null;
      }
    }
    const { data, error } = await rbExecutarQuery(XRelatorio.query_sql, XVarMap, XCon);
    setXLoading(false);
    if (error) { toast.error(error); return; }
    setXData(data);
    toast.success(`${data.length} registro(s) retornado(s).`);
  };

  if (!XRelatorio) return <div className="p-4 text-muted-foreground">Carregando relatório...</div>;

  const XLayout: IRbReportLayout = XRelatorio.report_json || EMPTY_LAYOUT;
  const XNome = XRelatorio.nome;

  return (
    <div className="flex flex-col h-full bg-card p-4 space-y-4">
      <h2 className="text-lg font-bold">{XNome}</h2>

      {/* Filter form */}
      {XVariaveis.length > 0 && (
        <div className="border border-border rounded p-3 space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">Filtros</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {XVariaveis.map(v => {
              const t = XTemplates.find(tp => tp.rb_templatepesquisa_id === v.rb_templatepesquisa_id);
              if (!t) return null;
              return (
                <div key={v.rb_relatorio_variavel_id}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {t.label || t.nome} {t.obrigatorio && <span className="text-destructive">*</span>}
                  </label>
                  {t.tipo === "boolean" ? (
                    <select value={XFilterValues[t.nome] ?? ""} onChange={e => setXFilterValues(p => ({ ...p, [t.nome]: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card">
                      <option value="">-- Todos --</option>
                      <option value="true">Sim</option>
                      <option value="false">Não</option>
                    </select>
                  ) : t.tipo === "select" ? (
                    <select value={XFilterValues[t.nome] ?? ""} onChange={e => setXFilterValues(p => ({ ...p, [t.nome]: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card">
                      <option value="">-- Todos --</option>
                      {(() => { try { return JSON.parse(t.opcoes_fixas || "[]"); } catch { return []; } })().map((o: string) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : t.tipo === "date" ? (
                    <input type="date" value={XFilterValues[t.nome] ?? ""} onChange={e => setXFilterValues(p => ({ ...p, [t.nome]: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                  ) : (
                    <input type={t.tipo === "integer" ? "number" : "text"} value={XFilterValues[t.nome] ?? ""} onChange={e => setXFilterValues(p => ({ ...p, [t.nome]: e.target.value }))} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button onClick={handleExecutar} disabled={XLoading} className="px-4 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {XLoading ? "Executando..." : "Executar"}
        </button>
        {XData.length > 0 && (
          <>
            <button onClick={() => rbExportPdf(XData, XLayout, XNome)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-accent"><File size={12} /> PDF</button>
            <button onClick={() => rbExportExcel(XData, XLayout, XNome)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-accent"><FileSpreadsheet size={12} /> Excel</button>
            <button onClick={() => rbExportCsv(XData, XLayout, XNome)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-accent"><FileText size={12} /> CSV</button>
            <button onClick={() => rbExportPrint(XData, XLayout, XNome)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground hover:bg-accent"><Printer size={12} /> Imprimir</button>
          </>
        )}
      </div>

      {/* Preview */}
      {XData.length > 0 && <RbReportPreview XData={XData} XLayout={XLayout} />}
    </div>
  );
};

export default RbReportExecutor;
