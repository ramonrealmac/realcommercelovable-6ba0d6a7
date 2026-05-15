import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Lock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: { uf: string; cidade_cod: string; dt: string }) => void;
  loading: boolean;
  empresaId: number;
}

const MdfeCloseDialog: React.FC<IProps> = ({ isOpen, onClose, onConfirm, loading, empresaId }) => {
  const [uf, setUf] = useState("SP");
  const [cidadeCod, setCidadeCod] = useState("");
  const [dt, setDt] = useState(new Date().toISOString().substring(0, 10));

  useEffect(() => {
    if (isOpen) {
      // Tentar buscar UF da empresa como padrão
      const fetchEmpresa = async () => {
        const { data } = await supabase.from("empresa").select("endereco_uf").eq("empresa_id", empresaId).single();
        if (data?.endereco_uf) setUf(data.endereco_uf);
      };
      fetchEmpresa();
    }
  }, [isOpen, empresaId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <Lock className="w-5 h-5" /> Encerramento de MDF-e
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-xs text-muted-foreground">
            O encerramento deve ser realizado após a conclusão da viagem para liberar o veículo para novos manifestos.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>UF de Encerramento</Label>
              <Input value={uf} onChange={e => setUf(e.target.value.toUpperCase())} maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label>Cód. IBGE Município</Label>
              <Input value={cidadeCod} onChange={e => setCidadeCod(e.target.value)} placeholder="Ex: 3550308" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data de Encerramento</Label>
            <Input type="date" value={dt} onChange={e => setDt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold bg-secondary rounded">CANCELAR</button>
          <button 
            onClick={() => onConfirm({ uf, cidade_cod: cidadeCod, dt })} 
            disabled={!cidadeCod || loading} 
            className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded flex items-center gap-2 hover:bg-blue-700"
          >
            {loading && <RefreshCw className="w-3 h-3 animate-spin" />} CONFIRMAR ENCERRAMENTO
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MdfeCloseDialog;
