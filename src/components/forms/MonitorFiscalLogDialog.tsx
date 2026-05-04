import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Clock, Terminal, ChevronRight } from "lucide-react";

const db = supabase as any;

interface MonitorFiscalLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: number;
}

const XCols: IGridColumn[] = [
  { 
    key: "created_at", 
    label: "Data/Hora", 
    width: "140px",
    render: r => new Date(r.created_at).toLocaleString("pt-BR")
  },
  { 
    key: "comando", 
    label: "Comando", 
    width: "1.5fr",
    render: r => (
      <div className="font-mono text-[10px] bg-secondary/50 p-1 rounded border border-border overflow-hidden text-ellipsis whitespace-nowrap" title={String(r.comando || "").replace(/ACBr/gi, "MonitorFiscal")}>
        {String(r.comando || "").replace(/ACBr/gi, "MonitorFiscal")}
      </div>
    )
  },
  { 
    key: "ult_nsu", 
    label: "Últ. NSU", 
    width: "110px",
    align: "center",
    render: r => <span className="font-mono text-[10px]">{r.ult_nsu || "-"}</span>
  },
  { 
    key: "max_nsu", 
    label: "Máx. NSU", 
    width: "110px",
    align: "center",
    render: r => <span className="font-mono text-[10px]">{r.max_nsu || "-"}</span>
  },
  { 
    key: "resposta", 
    label: "Resposta do MonitorFiscal", 
    width: "2fr",
    render: r => {
      const masked = String(r.resposta || "")
        .replace(/ACBrMonitorPLUS/gi, "MonitorFiscal")
        .replace(/ACBr/gi, "MonitorFiscal")
        .replace(/SCBRMonitor/gi, "MonitorFiscal");
      const isError = masked.includes("ERRO") || masked.includes("Rejeicao") || masked.includes("Consumo Indevido");
      return (
        <div className={`font-mono text-[10px] p-1 rounded border overflow-hidden text-ellipsis whitespace-nowrap ${isError ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`} title={masked}>
          {masked}
        </div>
      );
    }
  },
];

const MonitorFiscalLogDialog: React.FC<MonitorFiscalLogDialogProps> = ({ isOpen, onClose, empresaId }) => {
  const [XFilters, setXFilters] = useState<Record<string, string>>({});

  const XFilteredData = XData.filter(row => {
    for (const [key, val] of Object.entries(XFilters)) {
      if (!val) continue;
      const rowVal = String(row[key] || "").toLowerCase();
      if (!rowVal.includes(val.toLowerCase())) return false;
    }
    return true;
  });

  const loadLogs = async () => {
    if (!empresaId || !isOpen) return;
    setXLoading(true);
    try {
      const { data, error } = await db
        .from("dfe_nsu_log")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(200); // Aumentado para 200 para dar mais margem ao filtro

      if (error) throw error;
      setXData(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar logs:", e);
    } finally {
      setXLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    if (isOpen) setXFilters({}); // Reseta filtros ao abrir
  }, [isOpen, empresaId]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-primary" />
              Log de DFE
            </DialogTitle>
            <p className="text-[10px] text-muted-foreground italic">* Use a linha de filtros abaixo dos títulos para pesquisar</p>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <DataGrid 
              columns={XCols}
              data={XFilteredData}
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

      {/* Detalhe do Registro Único */}
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
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Log ID / Empresa ID</span>
                  <span className="text-sm">#{XSelected.dfe_log_id} / <span className="font-bold text-primary">ID: {XSelected.empresa_id}</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Último NSU</span>
                  <span className="text-sm font-mono">{XSelected.ult_nsu || "0"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Máximo NSU</span>
                  <span className="text-sm font-mono">{XSelected.max_nsu || "0"}</span>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Comando Enviado</span>
                <pre className="bg-secondary/50 p-3 rounded-md text-xs font-mono border border-border whitespace-pre-wrap break-all">
                  {String(XSelected.comando || "").replace(/ACBr/gi, "MonitorFiscal")}
                </pre>
              </div>

              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Resposta do MonitorFiscal</span>
                <pre className={`p-3 rounded-md text-xs font-mono border whitespace-pre-wrap break-all ${
                  String(XSelected.resposta || "").includes("ERRO") || String(XSelected.resposta || "").includes("Rejeicao")
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-green-50 text-green-700 border-green-200"
                }`}>
                  {String(XSelected.resposta || "Sem resposta registrada")
                    .replace(/ACBrMonitorPLUS/gi, "MonitorFiscal")
                    .replace(/ACBr/gi, "MonitorFiscal")
                    .replace(/SCBRMonitor/gi, "MonitorFiscal")}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MonitorFiscalLogDialog;
