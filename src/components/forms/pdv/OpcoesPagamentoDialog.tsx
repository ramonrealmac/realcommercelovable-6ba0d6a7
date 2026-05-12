import React from "react";
import { Printer, FileText, FileCode2, ScanLine, Loader2, Eye, X, ChevronRight, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FiscalEmailDialog from "./FiscalEmailDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";
import { supabase } from "@/integrations/supabase/client";


export interface IImpressaoItem {
  nm_produto: string;
  qt_movimento: number;
  unidade_id?: string | null;
  vl_und_produto: number;
  vl_movimento: number;
}

export interface IImpressaoDados {
  movimento_id: number;
  nr_movimento: number | string;
  cliente_nome: string;
  caixa_nome: string;
  dt_movimento: string;
  itens: IImpressaoItem[];
  total: number;
  cliente_id?: number | null;
}

interface IProps {
  open: boolean;
  dados: IImpressaoDados | null;
  empresaId: number;
  funcionarioId: number;
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

const OpcoesPagamentoDialog: React.FC<IProps> = ({ open, dados, empresaId, funcionarioId, onClose, onConcluir }) => {
  const [XSalvando, setXSalvando] = React.useState(false);
  const [XStatus, setXStatus] = React.useState<string>("");
  const [XNfeId, setXNfeId] = React.useState<number | null>(null);
  const [XLastPdf, setXLastPdf] = React.useState<string | null>(null);
  const [XEmailDialogOpen, setXEmailDialogOpen] = React.useState(false);

  const handleVisualizarFiscal = () => {
    if (!XLastPdf) {
      toast.error("PDF não disponível para visualização.");
      return;
    }
    try {
      const byteCharacters = atob(XLastPdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const win = window.open(fileURL, 'danfe_view', '_blank');
      if (!win) {
        toast.error("O bloqueador de popups impediu a abertura do DANFE.");
      }
    } catch (err) {
      toast.error("Erro ao abrir PDF.");
    }
  };

  const handleGerarFiscal = async (tipo: "NFE" | "NFCE") => {
    if (!dados?.movimento_id) return;

    try {
      setXSalvando(true);
      setXStatus(`Gerando ${tipo} e enviando ao Fiscal Worker...`);
      const res = await fiscalEmissaoService.gerarDocumentoFiscalFromMovimento(
        dados.movimento_id,
        tipo,
        empresaId,
        funcionarioId
      );

      if (!res.success || !res.fiscal_evento_id) {
        setXSalvando(false);
        setXStatus("");
        toast.error(`Erro ao gerar ${tipo}: ` + res.message);
        return;
      }

      setXStatus(`Aguardando autorização da SEFAZ...`);
      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, 90000);

      if (ret.success) {
        toast.success(`${tipo} autorizada!`);

        // Abre o PDF se retornado pelo worker
        let pdfBase64 = ret.resposta?.pdf_base64 || ret.resposta?.impressao?.pdf_base64;

        if (res.nfe_cabecalho_id) {
          setXNfeId(res.nfe_cabecalho_id);
        }

        // Fallback: Se o worker não retornou o PDF na emissão, solicita explicitamente
        if (!pdfBase64 && res.nfe_cabecalho_id) {
          console.log(`[OpcoesPagamentoDialog] PDF não retornado na emissão. Solicitando impressão explícita para nota ID: ${res.nfe_cabecalho_id}`);
          setXStatus("Gerando DANFE para visualização...");
          const impRes = await fiscalEmissaoService.imprimirDocumento(res.nfe_cabecalho_id, empresaId);
          if (impRes.success) {
            pdfBase64 = impRes.pdf_base64;
          } else {
            console.warn("[OpcoesPagamentoDialog] Falha ao gerar DANFE após emissão:", impRes.message);
          }
        }

        if (pdfBase64) {
          setXLastPdf(pdfBase64);
          try {
            const byteCharacters = atob(pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const file = new Blob([byteArray], { type: 'application/pdf' });
            const fileURL = URL.createObjectURL(file);
            const win = window.open(fileURL, 'danfe_view', '_blank');
            if (!win) {
              toast.error("O bloqueador de popups impediu a abertura do DANFE. Use o botão 'Visualizar' abaixo.");
            }
          } catch (err) {
            console.error("Erro ao abrir PDF:", err);
            toast.error("Erro ao processar o PDF do DANFE.");
          }
        }

        // Verifica se deve enviar e-mail automaticamente
        try {
          const { data: configItem } = await supabase
            .from("fiscal_config_item")
            .select("enviar_email")
            .eq("empresa_id", empresaId)
            .eq("modelo", tipo === "NFE" ? "55" : "65")
            .limit(1)
            .maybeSingle();

          if (configItem?.enviar_email === "S") {
            setXEmailDialogOpen(true);
          }
        } catch (errEmail) {
          console.error("Erro ao verificar config de e-mail:", errEmail);
        }

        setXSalvando(false);
        setXStatus("");
      } else {
        setXSalvando(false);
        setXStatus("");
        toast.error(`Falha na ${tipo}: ${ret.mensagem || "verifique o log fiscal"}`);
      }
    } catch (err: any) {
      console.error(`[OpcoesPagamentoDialog] Erro fatal em handleGerarFiscal:`, err);
      setXSalvando(false);
      setXStatus("");
      toast.error("Ocorreu um erro inesperado: " + (err.message || "Erro interno"));
    }
  };

  const cards = [
    {
      key: "nfe", label: "NFe", desc: "Nota Fiscal Eletrônica", icon: <FileCode2 size={28} />, color: "text-amber-600",
      action: () => handleGerarFiscal("NFE"), enabled: true
    },
    {
      key: "nfce", label: "NFCe", desc: "Nota de Consumidor", icon: <ScanLine size={28} />, color: "text-emerald-600",
      action: () => handleGerarFiscal("NFCE"), enabled: true
    },
    {
      key: "bobina", label: "Bobina", desc: "Impressão Térmica", icon: <Printer size={28} />, color: "text-slate-600",
      action: () => imprimir(dados, "bobina"), enabled: true
    },
    {
      key: "a4", label: "A4 / PDF", desc: "Relatório de Pedido", icon: <FileText size={28} />, color: "text-blue-600",
      action: () => imprimir(dados, "a4"), enabled: true
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-slate-50">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-800">Finalizar Venda</DialogTitle>
          <DialogDescription className="text-slate-500">
            Selecione uma opção de documento fiscal
          </DialogDescription>
        </DialogHeader>

        <div className="relative py-6 flex flex-col items-center">
          {/* Overlay de Bloqueio */}
          {XSalvando && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-[1px] rounded-xl animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-4 p-8 bg-white shadow-2xl rounded-2xl border border-slate-100">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-800">Processando...</p>
                  <p className="text-sm text-slate-500 max-w-[200px]">{XStatus}</p>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 w-full">
            {cards.map((card) => (
              <button
                key={card.key}
                disabled={XSalvando || !card.enabled}
                onClick={card.action}
                autoFocus={card.key === "bobina"}
                className={cn(
                  "flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-200",
                  "hover:shadow-lg active:scale-95 group",
                  card.enabled
                    ? "bg-white border-slate-200 hover:border-primary/50"
                    : "bg-slate-100 border-slate-100 opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn("mb-3 p-3 rounded-xl bg-slate-50 group-hover:bg-white transition-colors", card.color)}>
                  {card.icon}
                </div>
                <div className="text-lg font-bold text-slate-800">{card.label}</div>
                <div className="text-xs text-slate-500 text-center mt-1">{card.desc}</div>
              </button>
            ))}
          </div>

          {XLastPdf && (
            <div className="mt-4 flex gap-2 w-full">
              <Button variant="secondary" className="flex-1 gap-2 py-6 rounded-xl font-bold shadow-sm" onClick={handleVisualizarFiscal}>
                <Eye size={20} /> VISUALIZAR
              </Button>
              <Button variant="outline" className="flex-1 gap-2 py-6 rounded-xl font-bold shadow-sm border-2" onClick={() => setXEmailDialogOpen(true)}>
                <Mail size={20} /> ENVIAR E-MAIL
              </Button>
            </div>
          )}

          {XStatus && (
            <div className="mt-6 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
              </div>
              <p className="text-sm font-medium text-slate-600">{XStatus}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onConcluir}
            disabled={XSalvando}
            className="flex-1 rounded-xl h-12"
          >
            Concluir Venda
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={XSalvando}
            className="rounded-xl h-12"
          >
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>

      <FiscalEmailDialog
        open={XEmailDialogOpen}
        onClose={() => setXEmailDialogOpen(false)}
        nfeCabecalhoId={XNfeId}
        empresaId={empresaId}
        clienteId={dados?.cliente_id}
      />
    </Dialog>
  );
};

export default OpcoesPagamentoDialog;
