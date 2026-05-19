import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Clock, Terminal, ChevronRight, CheckCircle2, XCircle, Timer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const db = supabase as any;

interface MonitorFiscalLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: number;
  nfeCabecalhoId?: number;
  mdfManifestoId?: number;
}

const MonitorFiscalLogDialog: React.FC<MonitorFiscalLogDialogProps> = ({ isOpen, onClose, empresaId, nfeCabecalhoId, mdfManifestoId }) => {
  // Versão de Diagnóstico: 2026-05-14 17:17 (MDF-e support added)
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelected, setXSelected] = useState<any>(null);
  const [XFilters, setXFilters] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Carrega o usuário logado para identificar no log
  useEffect(() => {
    supabase.auth.getUser().then(res => {
      setCurrentUser(res.data?.user);
    });
  }, []);

  const XCols: IGridColumn[] = useMemo(() => [
    { 
      key: "created_at", 
      label: "Data/Hora", 
      width: "150px",
      render: r => <span className="text-[10px]">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
    },
    { 
      key: "status", 
      label: "Status", 
      width: "120px",
      align: "center",
      render: r => {
        const colors: any = {
          "PENDENTE": "bg-gray-100 text-gray-600",
          "PROCESSANDO": "bg-blue-100 text-blue-600 animate-pulse",
          "EMITIDO": "bg-green-100 text-green-700",
          "CONCLUIDO": "bg-green-100 text-green-700",
          "ERRO": "bg-red-100 text-red-700"
        };
        const icons: any = {
          "PENDENTE": <Clock className="w-3 h-3 mr-1" />,
          "PROCESSANDO": <Timer className="w-3 h-3 mr-1" />,
          "EMITIDO": <CheckCircle2 className="w-3 h-3 mr-1" />,
          "CONCLUIDO": <CheckCircle2 className="w-3 h-3 mr-1" />,
          "ERRO": <XCircle className="w-3 h-3 mr-1" />
        };
        return (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center justify-center ${colors[r.status] || "bg-gray-100"}`}>
            {icons[r.status]} {r.status}
          </span>
        );
      }
    },
    { 
      key: "comando", 
      label: "Comando", 
      width: "160px",
      render: r => (
        <div className="font-mono text-[10px] font-bold text-primary truncate" title={r.comando}>
          {r.comando}
        </div>
      )
    },
    { 
      key: "ambiente", 
      label: "Ambiente", 
      width: "110px",
      align: "center",
      render: r => {
        const isProd = String(r.ambiente) === "1";
        return (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isProd ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
            {isProd ? "PRODUÇÃO" : "HOMOLOGAÇÃO"}
          </span>
        );
      }
    },
    { 
      key: "user_name", 
      label: "Usuário", 
      width: "140px",
      render: r => {
        const isMe = currentUser?.id === r.user_id;
        const nome = isMe ? "Ramon (Você)" : (r.user_id ? `ID:${r.user_id.substring(0, 4)}` : "Sistema");
        return <span className="text-[10px] font-medium text-muted-foreground truncate" title={r.user_id}>{nome}</span>
      }
    },
    { 
      key: "ult_nsu", 
      label: "Últ. NSU", 
      width: "80px",
      align: "center",
      render: r => {
        try {
          const res = r.resposta ? JSON.parse(r.resposta) : null;
          const nsu = res?.ult_nsu || res?.retorno?.ult_nsu || res?.retorno_completo?.match(/ultNSU=(\d+)/)?.[1] || "-";
          return <span className="text-[10px] font-mono">{nsu}</span>;
        } catch { return "-" }
      }
    },
    { 
      key: "max_nsu", 
      label: "Máx. NSU", 
      width: "80px",
      align: "center",
      render: r => {
        try {
          const res = r.resposta ? JSON.parse(r.resposta) : null;
          const nsu = res?.max_nsu || res?.retorno?.max_nsu || res?.retorno_completo?.match(/maxNSU=(\d+)/)?.[1] || "-";
          return <span className="text-[10px] font-mono">{nsu}</span>;
        } catch { return "-" }
      }
    },
    { 
      key: "resposta", 
      label: "Resultado / Erro", 
      width: "1fr",
      render: r => {
        if (r.status === "ERRO") {
          return <span className="text-[10px] text-red-600 font-medium italic truncate block">{r.mensagem_erro}</span>;
        }
        
        const res = r.resposta ? JSON.parse(r.resposta) : null;
        if (!res) return <span className="text-[10px] text-muted-foreground">-</span>;

        const resumo = res.status_retorno || res.retorno_completo || res.mensagem || (res.sucesso ? "Operação realizada" : "Falha");
        
        return (
          <div className="font-mono text-[10px] overflow-hidden text-ellipsis whitespace-nowrap" title={typeof resumo === 'string' ? resumo : JSON.stringify(resumo)}>
            {typeof resumo === 'string' ? resumo : JSON.stringify(resumo)}
          </div>
        );
      }
    },
  ], [currentUser]);

  const XFilteredData = useMemo(() => {
    return XData.filter(row => {
      for (const [key, val] of Object.entries(XFilters)) {
        if (!val) continue;
        const rowVal = String(row[key] || "").toLowerCase();
        if (!rowVal.includes(val.toLowerCase())) return false;
      }
      return true;
    });
  }, [XData, XFilters]);

  const loadLogs = async () => {
    if (!isOpen) return;
    setXLoading(true);
    setXData([]);
    try {
      let query = db
        .from("fiscal_evento")
        .select("*")
        .eq("empresa_id", empresaId);

      if (nfeCabecalhoId) {
        query = query.eq("nfe_cabecalho_id", nfeCabecalhoId);
      }
      if (mdfManifestoId) {
        query = query.eq("mdf_manifesto_id", mdfManifestoId);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setXData(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar logs:", e);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      setXFilters({});
    }
  }, [isOpen, empresaId, nfeCabecalhoId, mdfManifestoId]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between w-full pr-8">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                Log de DFE
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 h-8"
                onClick={loadLogs}
                disabled={XLoading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${XLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground italic">* Exibindo os últimos 1000 registros. Use os filtros para pesquisar.</p>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <DataGrid 
              columns={XCols}
              data={XFilteredData}
              loading={XLoading}
              maxHeight="calc(80vh - 150px)"
              showRecordCount
              showFilters
              filterValues={XFilters}
              onFilterChange={(k, v) => setXFilters(prev => ({ ...prev, [k]: v }))}
              onRowDoubleClick={(row) => setXSelected(row)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!XSelected} onOpenChange={() => setXSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 border-b pb-2">
              <ChevronRight className="w-5 h-5 text-primary" />
              Detalhes do Comando
            </DialogTitle>
          </DialogHeader>
          
          {XSelected && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Data/Hora</span>
                  <span className="text-sm">{new Date(XSelected.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Evento ID</span>
                  <span className="text-sm">#{XSelected.id}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Status</span>
                  <span className="text-sm font-bold">{XSelected.status}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Usuário ID</span>
                  <span className="text-sm font-mono truncate" title={XSelected.user_id}>{XSelected.user_id || "Sistema"}</span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Comando</span>
                <pre className="bg-secondary/50 p-4 rounded-md text-[13px] font-mono border border-border whitespace-pre-wrap break-all shadow-inner">
                  {XSelected.comando}
                </pre>
              </div>

              {XSelected.payload && (
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Parâmetros (Payload)</span>
                  <pre className="bg-secondary/20 p-4 rounded-md text-[11px] font-mono border border-border whitespace-pre-wrap break-all shadow-inner">
                    {JSON.stringify(XSelected.payload, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Resposta do Worker</span>
                {XSelected.status === "ERRO" ? (
                   <div className="space-y-2">
                     <pre className="bg-red-50 text-red-700 p-5 rounded-md text-[13px] font-mono border border-red-200 whitespace-pre-wrap break-all shadow-inner">
                       {XSelected.mensagem_erro}
                     </pre>
                     {XSelected.resposta && (
                       <div className="mt-2">
                         <span className="text-[9px] font-bold text-red-400 uppercase">Dados recuperados da resposta:</span>
                         <pre className="bg-slate-50 text-slate-600 p-4 rounded-md text-[11px] font-mono border border-slate-200 whitespace-pre-wrap break-all shadow-inner max-h-[300px] overflow-y-auto">
                           {(() => {
                             try {
                               const res = JSON.parse(XSelected.resposta);
                               return JSON.stringify(res, null, 2);
                             } catch(e) {
                               return XSelected.resposta;
                             }
                           })()}
                         </pre>
                       </div>
                     )}
                   </div>
                ) : (
                  <pre className="bg-green-50 text-green-700 p-5 rounded-md text-[13px] font-mono border border-green-200 whitespace-pre-wrap break-all shadow-inner min-h-[150px]">
                    {XSelected.resposta ? (
                      (() => {
                        try {
                          const res = JSON.parse(XSelected.resposta);
                          return JSON.stringify(res, null, 2);
                        } catch(e) {
                          return XSelected.resposta;
                        }
                      })()
                    ) : "Sem resposta ainda..."}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MonitorFiscalLogDialog;
