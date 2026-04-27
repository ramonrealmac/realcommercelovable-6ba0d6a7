import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, FileText, FileCode2, ScanLine } from "lucide-react";
import { toast } from "sonner";

export interface IImpressaoItem {
  nm_produto: string;
  qt_movimento: number;
  unidade_id?: string | null;
  vl_und_produto: number;
  vl_movimento: number;
}

export interface IImpressaoDados {
  nr_movimento: number | string;
  cliente_nome: string;
  caixa_nome: string;
  dt_movimento: string;
  itens: IImpressaoItem[];
  total: number;
}

interface IProps {
  open: boolean;
  dados: IImpressaoDados | null;
  onClose: () => void;
  onConcluir: () => void;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const buildHTML = (d: IImpressaoDados, modo: "bobina" | "a4") => {
  const isBob = modo === "bobina";
  const linhas = d.itens.map(i => `
    <tr>
      <td style="text-align:left">${i.nm_produto}</td>
      <td style="text-align:right">${fmt(i.qt_movimento)} ${i.unidade_id || ""}</td>
      <td style="text-align:right">${fmt(i.vl_und_produto)}</td>
      <td style="text-align:right">${fmt(i.vl_movimento)}</td>
    </tr>`).join("");

  return `
<!doctype html><html><head><meta charset="utf-8"><title>Pedido ${d.nr_movimento}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:${isBob ? "monospace" : "Arial,sans-serif"};margin:0;padding:${isBob ? "4mm" : "12mm"};font-size:${isBob ? "11px" : "13px"};color:#000}
  .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin:6px 0}
  th,td{padding:${isBob ? "1px 2px" : "4px 6px"};border-bottom:${isBob ? "1px dotted #999" : "1px solid #ddd"}}
  th{text-align:left;background:${isBob ? "transparent" : "#f0f0f0"}}
  .total{font-size:${isBob ? "13px" : "16px"};font-weight:bold;text-align:right;border-top:2px solid #000;padding-top:6px;margin-top:6px}
  .small{font-size:${isBob ? "10px" : "11px"};color:#444}
  ${isBob ? "@page{size:80mm auto;margin:2mm}" : "@page{size:A4;margin:14mm}"}
</style></head><body>
  <div class="header">
    <div style="font-weight:bold;font-size:${isBob ? "13px" : "16px"}">PEDIDO Nº ${d.nr_movimento}</div>
    <div class="small">Caixa: ${d.caixa_nome}</div>
    <div class="small">Data: ${d.dt_movimento}</div>
    <div class="small">Cliente: ${d.cliente_nome}</div>
  </div>
  <table>
    <thead><tr><th>Produto</th><th style="text-align:right">Qtd</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>
  <div class="total">TOTAL: R$ ${fmt(d.total)}</div>
  <div class="small" style="text-align:center;margin-top:10px">*** Documento sem valor fiscal ***</div>
  <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}</script>
</body></html>`;
};

const imprimir = (d: IImpressaoDados | null, modo: "bobina" | "a4") => {
  if (!d) { toast.error("Sem dados para imprimir."); return; }
  const w = window.open("", "_blank", `width=${modo === "bobina" ? 380 : 800},height=600`);
  if (!w) { toast.error("Bloqueador de pop-up impediu a impressão."); return; }
  w.document.write(buildHTML(d, modo));
  w.document.close();
};

const OpcoesPagamentoDialog: React.FC<IProps> = ({ open, dados, onClose, onConcluir }) => {
  const cards = [
    { key: "bobina", label: "Bobina", desc: "Impressão térmica 80mm", icon: <Printer size={28} />, color: "text-blue-600",
      action: () => imprimir(dados, "bobina"), enabled: true },
    { key: "a4", label: "A4", desc: "Folha grande", icon: <FileText size={28} />, color: "text-indigo-600",
      action: () => imprimir(dados, "a4"), enabled: true },
    { key: "nfe", label: "NFe", desc: "Em desenvolvimento", icon: <FileCode2 size={28} />, color: "text-amber-600",
      action: () => toast.info("NFe será implementada em seguida."), enabled: false },
    { key: "nfce", label: "NFCe", desc: "Em desenvolvimento", icon: <ScanLine size={28} />, color: "text-emerald-600",
      action: () => toast.info("NFCe será implementada em seguida."), enabled: false },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Documento da Venda</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          Selecione um documento para imprimir e prossiga para o pagamento.
        </div>
        <div className="grid grid-cols-2 gap-3 py-2">
          {cards.map(c => (
            <button key={c.key} onClick={c.action} disabled={!c.enabled}
              className={`border border-border rounded p-4 text-left flex items-center gap-3 transition
                ${c.enabled ? "hover:bg-accent hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed"}`}>
              <div className={c.color}>{c.icon}</div>
              <div>
                <div className="font-semibold text-sm">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.desc}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border">
          <button onClick={onConcluir}
            className="text-sm px-4 py-1.5 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
            ✓ Concluir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OpcoesPagamentoDialog;
