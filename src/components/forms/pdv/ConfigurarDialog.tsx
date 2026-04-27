import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

const db = supabase as any;
const MIN_FONT = 10;
const MAX_FONT = 24;

interface IProps {
  open: boolean;
  funcionarioId: number;
  fontePedidos: number;
  fonteProdutos: number;
  tempoRefresh: number;
  onClose: () => void;
  onSalvar: (v: { fontePedidos: number; fonteProdutos: number; tempoRefresh: number }) => void;
}

const ConfigurarDialog: React.FC<IProps> = ({
  open, funcionarioId, fontePedidos, fonteProdutos, tempoRefresh, onClose, onSalvar,
}) => {
  const [XFontePed, setXFontePed] = useState(fontePedidos);
  const [XFonteProd, setXFonteProd] = useState(fonteProdutos);
  const [XRefresh, setXRefresh] = useState(tempoRefresh);
  const [XSalvando, setXSalvando] = useState(false);

  React.useEffect(() => {
    if (open) {
      setXFontePed(fontePedidos);
      setXFonteProd(fonteProdutos);
      setXRefresh(tempoRefresh);
    }
  }, [open, fontePedidos, fonteProdutos, tempoRefresh]);

  const clampFont = (v: number) => Math.min(MAX_FONT, Math.max(MIN_FONT, v));
  const clampRefresh = (v: number) => Math.min(99999, Math.max(5, Math.floor(v || 5)));

  const salvar = async () => {
    setXSalvando(true);
    try {
      const payload = {
        tamanho_fonte_pedidos: XFontePed,
        tamanho_fonte_produtos: XFonteProd,
        tempo_refresh_pdv: XRefresh,
      };
      const { error } = await db.from("funcionario").update(payload).eq("funcionario_id", funcionarioId);
      if (error) throw new Error(error.message);
      toast.success("Configurações salvas.");
      onSalvar({ fontePedidos: XFontePed, fonteProdutos: XFonteProd, tempoRefresh: XRefresh });
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setXSalvando(false);
    }
  };

  const FontControl = ({ label, value, setValue, sample }: any) => (
    <div className="border border-border rounded p-3 space-y-2">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue(clampFont(value - 1))}
          className="p-1.5 border border-border rounded hover:bg-accent">
          <Minus size={14} />
        </button>
        <div className="flex-1 text-center font-mono text-sm border border-border rounded py-1 bg-muted/40">
          {value}px
        </div>
        <button onClick={() => setValue(clampFont(value + 1))}
          className="p-1.5 border border-border rounded hover:bg-accent">
          <Plus size={14} />
        </button>
      </div>
      <div className="border border-dashed border-border rounded px-2 py-1.5 bg-muted/20 truncate"
        style={{ fontSize: `${value}px` }}>
        {sample}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do PDV</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <FontControl label="Fonte — Lista de Pedidos a Receber"
            value={XFontePed} setValue={setXFontePed}
            sample="Nº 123 — Cliente Exemplo — R$ 100,00" />
          <FontControl label="Fonte — Lista de Produtos"
            value={XFonteProd} setValue={setXFonteProd}
            sample="Produto Exemplo  1,000 UN × 10,00" />
          <div className="border border-border rounded p-3 space-y-2">
            <div className="text-xs font-semibold text-foreground">Tempo de Refresh (segundos)</div>
            <input type="number" min={5} max={99999} step={1}
              value={XRefresh}
              onChange={(e) => setXRefresh(clampRefresh(Number(e.target.value)))}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card" />
            <div className="text-[11px] text-muted-foreground">Mínimo 5, máximo 99999.</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button onClick={onClose} disabled={XSalvando}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">Cancelar</button>
          <button onClick={salvar} disabled={XSalvando}
            className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
            {XSalvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigurarDialog;
