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

interface AcbrLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
  empresaId: number;
}

const XCols: IGridColumn[] = [
  { 
    key: "created_at", 
    label: "Data/Hora", 
    width: "160px",
    render: r => new Date(r.created_at).toLocaleString("pt-BR")
  },
  { 
    key: "comando", 
    label: "Comando Enviado", 
    width: "2fr",
    render: r => (
      <div className="font-mono text-[10px] bg-secondary/50 p-1 rounded border border-border overflow-hidden text-ellipsis whitespace-nowrap" title={r.comando}>
        {r.comando}
      </div>
    )
  },
  { 
    key: "resposta", 
    label: "Resposta do ACBr", 
    width: "2fr",
    render: r => {
      const isError = String(r.resposta || "").includes("ERRO") || String(r.resposta || "").includes("Rejeicao");
      return (
        <div className={`font-mono text-[10px] p-1 rounded border overflow-hidden text-ellipsis whitespace-nowrap ${isError ? "bg-red-50 text-red-700 border-red-100" : "bg-green-50 text-green-700 border-green-100"}`} title={r.resposta}>
          {r.resposta}
        </div>
      );
    }
  },
];

const AcbrLogDialog: React.FC<AcbrLogDialogProps> = ({ isOpen, onClose, empresaId }) => {
  const [XData, setXData] = useState<any[]>([]);
  const [XLoading, setXLoading] = useState(false);

  const loadLogs = async () => {
    if (!empresaId || !isOpen) return;
    setXLoading(true);
    try {
      const { data, error } = await db
        .from("acbr_log")
        .select("*")
        .eq("empresa_id", empresaId)
        .order("created_at", { ascending: false })
        .limit(100);

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
  }, [isOpen, empresaId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Log de Integração ACBr
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <DataGrid 
            columns={XCols}
            data={XData}
            maxHeight="calc(80vh - 150px)"
            showRecordCount
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AcbrLogDialog;
