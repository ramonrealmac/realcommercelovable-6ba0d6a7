import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { IMdfLog } from "./types";

const db = supabase as any;

interface Props {
  mdfCabecalhoId: number | null;
}

const TP_ACAO_LABELS: Record<string, string> = {
  EMISSAO:        "Emissão",
  CANCELAMENTO:   "Cancelamento",
  ENCERRAMENTO:   "Encerramento",
  CONSULTA:       "Consulta",
};

const MdfLogTab: React.FC<Props> = ({ mdfCabecalhoId }) => {
  const [logs, setLogs] = useState<IMdfLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!mdfCabecalhoId) return;
    setLoading(true);
    const { data } = await db.from("fiscal_mdf_log")
      .select("*")
      .eq("mdf_cabecalho_id", mdfCabecalhoId)
      .order("dt_log", { ascending: false });
    setLogs(data || []);
    setLoading(false);
  }, [mdfCabecalhoId]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) return <p className="text-sm text-muted-foreground p-4">Carregando logs...</p>;

  return (
    <div className="space-y-2">
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center">Nenhum log de transmissão.</p>
      )}
      {logs.map(log => (
        <div
          key={log.mdf_log_id}
          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
            log.sucesso
              ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
              : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
          }`}
          onClick={() => setExpandedId(expandedId === log.mdf_log_id ? null : log.mdf_log_id)}
        >
          <div className="flex items-center gap-3">
            {log.sucesso
              ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              : <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            }
            <span className="text-xs font-semibold text-foreground">
              {TP_ACAO_LABELS[log.tp_acao] || log.tp_acao}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(log.dt_log).toLocaleString("pt-BR")}
            </span>
          </div>
          {log.obs && <p className="text-xs text-muted-foreground mt-1 ml-7">{log.obs}</p>}
          {expandedId === log.mdf_log_id && log.retorno_acbr && (
            <pre className="mt-2 ml-7 text-xs bg-secondary rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap">
              {log.retorno_acbr}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
};

export default MdfLogTab;

