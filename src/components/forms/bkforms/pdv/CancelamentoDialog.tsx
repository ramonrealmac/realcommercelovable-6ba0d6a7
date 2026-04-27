import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

const db = supabase as any;

interface IProps {
  open: boolean;
  caixaNome: string;
  onClose: () => void;
  onCancelado: () => void;
}

interface IPedidoCancRow {
  movimento_id: number;
  nr_movimento: number | null;
  cliente_nome: string;
  vl_movimento: number;
  st_pedido: string;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CancelamentoDialog: React.FC<IProps> = ({ open, caixaNome, onClose, onCancelado }) => {
  const { XEmpresaId } = useAppContext();
  const [XPedidos, setXPedidos] = useState<IPedidoCancRow[]>([]);
  const [XSelId, setXSelId] = useState<number>(0);
  const [XMotivo, setXMotivo] = useState("");
  const [XSalvando, setXSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setXSelId(0); setXMotivo("");
    (async () => {
      const { data } = await db.from("movimento")
        .select("movimento_id, nr_movimento, cadastro_id, vl_movimento, st_pedido")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .in("st_pedido", ["F", "R"])
        .order("movimento_id", { ascending: false })
        .limit(100);
      const lista = (data || []) as any[];
      const cadIds = Array.from(new Set(lista.map(m => m.cadastro_id).filter(Boolean)));
      const cadRes = cadIds.length
        ? await db.from("cadastro").select("cadastro_id, razao_social, nome_fantasia").in("cadastro_id", cadIds)
        : { data: [] };
      const cadMap: Record<number, string> = {};
      for (const c of (cadRes.data || []) as any[]) cadMap[c.cadastro_id] = c.nome_fantasia || c.razao_social;
      setXPedidos(lista.map(m => ({
        movimento_id: m.movimento_id,
        nr_movimento: m.nr_movimento,
        cliente_nome: cadMap[m.cadastro_id] || "(Consumidor)",
        vl_movimento: Number(m.vl_movimento || 0),
        st_pedido: m.st_pedido,
      })));
    })();
  }, [open, XEmpresaId]);

  const imprimirComprovante = (ped: IPedidoCancRow, motivo: string) => {
    const dt = new Date().toLocaleString("pt-BR");
    const html = `
<!doctype html><html><head><meta charset="utf-8"><title>Cancelamento ${ped.nr_movimento}</title>
<style>
  body{font-family:monospace;margin:0;padding:6mm;font-size:11px;color:#000}
  .hdr{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:8px}
  .row{margin:3px 0}
  .lbl{color:#444}
  @page{size:80mm auto;margin:2mm}
</style></head><body>
  <div class="hdr">
    <div style="font-weight:bold;font-size:13px">COMPROVANTE DE CANCELAMENTO</div>
  </div>
  <div class="row"><span class="lbl">Pedido:</span> <strong>Nº ${ped.nr_movimento || ped.movimento_id}</strong></div>
  <div class="row"><span class="lbl">Cliente:</span> ${ped.cliente_nome}</div>
  <div class="row"><span class="lbl">Valor:</span> R$ ${fmt(ped.vl_movimento)}</div>
  <div class="row"><span class="lbl">Operador:</span> ${caixaNome}</div>
  <div class="row"><span class="lbl">Data/Hora:</span> ${dt}</div>
  <div class="row" style="margin-top:8px"><span class="lbl">Motivo:</span></div>
  <div style="border:1px dashed #000;padding:4px;margin-top:2px">${motivo.replace(/</g,"&lt;")}</div>
  <div style="text-align:center;margin-top:12px;font-size:10px">*** Documento sem valor fiscal ***</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) { toast.error("Bloqueador de pop-up impediu a impressão."); return; }
    w.document.write(html); w.document.close();
  };

  const cancelar = async () => {
    if (!XSelId) { toast.error("Selecione um pedido."); return; }
    if (!XMotivo.trim()) { toast.error("Informe o motivo do cancelamento."); return; }
    if (!confirm("Confirma o cancelamento desta venda?")) return;
    setXSalvando(true);
    try {
      const { error } = await db.from("movimento").update({
        st_pedido: "C",
        dt_cancelamento: new Date().toISOString(),
        mot_cancelamento: XMotivo.trim(),
      }).eq("movimento_id", XSelId);
      if (error) { toast.error(error.message); return; }
      const ped = XPedidos.find(p => p.movimento_id === XSelId)!;
      imprimirComprovante(ped, XMotivo.trim());
      toast.success("Venda cancelada.");
      onCancelado();
      onClose();
    } finally { setXSalvando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Cancelamento de Venda</DialogTitle></DialogHeader>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Selecione o pedido</label>
          <div className="max-h-60 overflow-y-auto border border-border rounded">
            {XPedidos.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground text-center">Nenhum pedido disponível.</div>
            )}
            {XPedidos.map((p, i) => (
              <button key={p.movimento_id}
                onClick={() => setXSelId(p.movimento_id)}
                className={`w-full text-left px-3 py-2 border-b border-border text-sm
                  ${i % 2 ? "bg-muted/40" : ""}
                  ${XSelId === p.movimento_id ? "!bg-red-100 dark:!bg-red-950/40" : "hover:bg-accent/50"}`}>
                <div className="flex justify-between">
                  <span><strong>Nº {p.nr_movimento || p.movimento_id}</strong> · <span className="text-blue-600 dark:text-blue-400">{p.cliente_nome}</span></span>
                  <span className="font-mono">R$ {fmt(p.vl_movimento)}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">Status: {p.st_pedido === "F" ? "Fechado" : "Recebido"}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Motivo do cancelamento *</label>
          <textarea value={XMotivo} onChange={e => setXMotivo(e.target.value)} rows={3}
            className="w-full border border-border rounded px-2 py-1.5 text-sm bg-white text-black resize-none" />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} disabled={XSalvando}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">Sair</button>
          <button onClick={cancelar} disabled={XSalvando || !XSelId || !XMotivo.trim()}
            className="text-sm px-4 py-1.5 rounded bg-red-600 text-white font-semibold disabled:opacity-50 hover:bg-red-700">
            {XSalvando ? "Cancelando..." : "Cancelar Venda"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CancelamentoDialog;
