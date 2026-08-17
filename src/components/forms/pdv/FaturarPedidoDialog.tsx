/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { Receipt, FileText, Search, Loader2, X, Check } from "lucide-react";

const db = supabase as any;

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ST_PEDIDO_LABELS: Record<string, string> = {
  O: "ORCAMENTO",
  P: "ORCAMENTO",
  F: "PRE-VENDA(CAIXA)",
  V: "ORCAMENTO (RESERVADO)",
  C: "CANCELADO",
  R: "VENDA (RECEBIDA)",
};

interface IProps {
  open: boolean;
  funcionarioId: number;
  empresaId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const FaturarPedidoDialog: React.FC<IProps> = ({ open, funcionarioId, empresaId, onClose, onSuccess }) => {
  const [XPedidos, setXPedidos] = useState<any[]>([]);
  const [XClientesCache, setXClientesCache] = useState<Record<number, string>>({});
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSelectedPedido, setXSelectedPedido] = useState<any | null>(null);
  const [XModelo, setXModelo] = useState<"55" | "65">("65");
  const [XLoadingPedidos, setXLoadingPedidos] = useState(false);
  const [XFiltro, setXFiltro] = useState("");
  const [XSalvando, setXSalvando] = useState(false);
  const [XStatus, setXStatus] = useState("");

  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number; restante: number }>({
    open: false,
    titulo: "",
    total: 60,
    restante: 60
  });

  const carregarPedidos = useCallback(async () => {
    if (!empresaId) {
      setXPedidos([]);
      return;
    }
    setXLoadingPedidos(true);
    setXSelectedIdx(null);
    setXSelectedPedido(null);
    try {
      // 1. Busca notas fiscais autorizadas/pendentes da empresa logada para saber movimentos já faturados
      const { data: notasExistentes } = await db
        .from("fiscal_nfe_cabecalho")
        .select("movimento_id, modelo, st_nf")
        .eq("empresa_id", empresaId)
        .in("st_nf", ["E", "1", "P", "A"])
        .not("movimento_id", "is", null);

      const movimentosComNota = new Set<number>(
        (notasExistentes || []).map((n: any) => Number(n.movimento_id)).filter(Boolean)
      );

      // 2. Busca somente movimentos da empresa logada, recebidos no caixa (st_pedido = 'R'), com tp_movimento em ('PD', 'SV', 'VD', 'OR') e faturado != 'S'
      const { data: movs, error: movErr } = await db.from("movimento")
        .select("movimento_id, nr_movimento, dt_emissao, vl_movimento, cadastro_id, st_pedido, faturado, tp_movimento")
        .eq("empresa_id", empresaId)
        .in("tp_movimento", ["PD", "SV", "VD", "OR"])
        .eq("st_pedido", "R")
        .neq("faturado", "S")
        .order("nr_movimento", { ascending: false });

      if (movErr) throw movErr;

      // 3. Exclui movimentos que já possuem nota fiscal autorizada/pendente emitida
      let rawMovs = (movs || []).filter((m: any) => !movimentosComNota.has(Number(m.movimento_id)));

      // 4. Carrega cache de clientes
      const clientIds = Array.from(new Set(rawMovs.map((m: any) => m.cadastro_id).filter(Boolean))) as number[];
      let cache: Record<number, string> = {};
      if (clientIds.length > 0) {
        const { data: clients, error: clientErr } = await db.from("cadastro")
          .select("cadastro_id, razao_social")
          .in("cadastro_id", clientIds);

        if (!clientErr && clients) {
          clients.forEach((c: any) => {
            cache[c.cadastro_id] = c.razao_social;
          });
          setXClientesCache(cache);
        }
      }

      // 5. Aplica o filtro de texto XFiltro (número do pedido ou cliente) APENAS no momento do clique em BUSCAR
      if (XFiltro.trim()) {
        const f = XFiltro.trim().toLowerCase();
        rawMovs = rawMovs.filter((p: any) => {
          const nr = String(p.nr_movimento || "");
          const movId = String(p.movimento_id || "");
          const cliente = (cache[p.cadastro_id] || XClientesCache[p.cadastro_id] || "").toLowerCase();
          return nr.includes(f) || movId.includes(f) || cliente.includes(f);
        });
      }

      setXPedidos(rawMovs);
    } catch (err: any) {
      toast.error("Erro ao carregar pedidos: " + err.message);
    } finally {
      setXLoadingPedidos(false);
    }
  }, [empresaId, XFiltro, XClientesCache]);

  useEffect(() => {
    if (open) {
      setXPedidos([]);
      setXSelectedIdx(null);
      setXSelectedPedido(null);
      setXFiltro("");
      setXModelo("65");
      setXStatus("");
      setXSalvando(false);
    }
  }, [open]);

  const handleRowClick = (row: any, idx: number) => {
    setXSelectedIdx(idx);
    setXSelectedPedido(row);
  };

  const handleFaturar = async () => {
    if (!XSelectedPedido) {
      toast.error("Selecione um pedido para faturar.");
      return;
    }

    const tipoEmissao = XModelo === "55" ? "NFE" : "NFCE";
    const modLbl = XModelo === "55" ? "NF-e" : "NFC-e";

    setXSalvando(true);
    setXStatus(`Gerando ${modLbl} e enviando ao Fiscal Worker...`);

    try {
      // 1. Gera documento fiscal
      const res = await fiscalEmissaoService.gerarDocumentoFiscalFromMovimento(
        XSelectedPedido.movimento_id,
        tipoEmissao,
        empresaId,
        funcionarioId
      );

      if (!res.success || !res.fiscal_evento_id) {
        throw new Error(res.message || "Erro ao gerar cabeçalho fiscal.");
      }

      // 2. Aguarda autorização
      setXStatus("Aguardando autorização da SEFAZ...");
      const totalSeg = await fiscalEmissaoService.obterTimeoutFiscalSeg(empresaId);
      setXProg({ open: true, titulo: `Emitindo ${modLbl}...`, total: totalSeg, restante: totalSeg });

      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
        empresaId,
        onTick: (s) => setXProg(p => ({ ...p, restante: s })),
      });
      setXProg(p => ({ ...p, open: false }));

      if (!ret.success) {
        throw new Error(ret.mensagem || "Rejeitado pela SEFAZ ou erro no worker.");
      }

      toast.success(`${modLbl} emitida com sucesso!`);

      // 3. Atualiza o status do campo faturado para S
      setXStatus("Atualizando status do pedido...");
      const { error: errUpdate } = await db.from("movimento")
        .update({ faturado: "S" })
        .eq("movimento_id", XSelectedPedido.movimento_id);

      if (errUpdate) {
        console.warn("Erro ao atualizar faturado = 'S':", errUpdate.message);
      }

      // 4. Solicita impressão/DANFE
      let pdfBase64 = ret.resposta?.pdf_base64 || ret.resposta?.impressao?.pdf_base64;
      if (!pdfBase64 && res.nfe_cabecalho_id) {
        setXStatus("Gerando DANFE para visualização...");
        const impRes = await fiscalEmissaoService.imprimirDocumento(res.nfe_cabecalho_id, empresaId);
        if (impRes.success) {
          pdfBase64 = impRes.pdf_base64;
        }
      }

      // Abre o PDF se gerado
      if (pdfBase64) {
        try {
          const byteCharacters = atob(pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const file = new Blob([byteArray], { type: "application/pdf" });
          const fileURL = URL.createObjectURL(file);
          window.open(fileURL, "_blank");
        } catch (ePdf) {
          console.error("Erro ao exibir PDF da nota:", ePdf);
        }
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error("Erro na emissão: " + err.message);
    } finally {
      setXSalvando(false);
      setXStatus("");
    }
  };

  const cols: IGridColumn[] = [
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "dt_emissao", label: "Emissão", width: "100px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
    { 
      key: "cliente", 
      label: "Cliente", 
      width: "1fr", 
      render: r => XClientesCache[r.cadastro_id] || (r.cadastro_id ? `#${r.cadastro_id}` : "") 
    },
    { key: "vl_movimento", label: "Valor", width: "100px", align: "right", render: r => fmt(r.vl_movimento) },
    { key: "st_pedido", label: "Status", width: "140px", render: r => ST_PEDIDO_LABELS[r.st_pedido] || r.st_pedido }
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2">
          <FileText size={18} />
          <h2 className="text-sm font-semibold">Faturar Pedido (Emissão de NFe/NFCe)</h2>
        </div>

        <div className="p-4 space-y-4">
          {/* Barra de Filtro e Modelo */}
          <div className="flex flex-wrap gap-4 items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 max-w-xs w-full bg-background border border-border rounded px-2.5 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition">
              <Search size={14} className="text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Filtrar por pedido ou cliente..."
                value={XFiltro}
                onChange={e => setXFiltro(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") carregarPedidos(); }}
                disabled={XSalvando}
                className="w-full bg-transparent border-none focus:outline-none focus:ring-0 placeholder-muted-foreground text-xs p-0 text-foreground"
              />
              {XFiltro && (
                <button type="button" onClick={() => setXFiltro("")} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex gap-2.5 items-center">
              <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">Modelo de Emissão:</span>
              <select
                value={XModelo}
                onChange={e => setXModelo(e.target.value as "55" | "65")}
                disabled={XSalvando || XLoadingPedidos}
                className="text-xs bg-background text-foreground border border-border rounded px-2.5 py-1.5 h-8 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm font-semibold transition"
              >
                <option value="65">65 - Cupom (NFC-e)</option>
                <option value="55">55 - Nota Fiscal (NF-e)</option>
              </select>

              <button
                type="button"
                onClick={carregarPedidos}
                disabled={XSalvando || XLoadingPedidos}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded hover:opacity-90 shadow-sm transition disabled:opacity-50 h-8"
              >
                {XLoadingPedidos ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                BUSCAR
              </button>
            </div>
          </div>

          {/* Grid de Pedidos */}
          <div className="border border-border rounded-lg overflow-hidden">
            <DataGrid
              columns={cols}
              data={XPedidos}
              maxHeight="250px"
              showRecordCount={false}
              showExport={false}
              onRowClick={handleRowClick}
              selectedIdx={XSelectedIdx}
              headerClassName="bg-topbar text-topbar-foreground text-[10px] uppercase tracking-wider font-bold"
            />
            {!XLoadingPedidos && XPedidos.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Clique no botão <span className="font-bold text-primary font-mono">BUSCAR</span> para pesquisar os pedidos recebidos no caixa pendentes de faturamento.
              </div>
            )}
            {XLoadingPedidos && (
              <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-primary" /> Carregando pedidos...
              </div>
            )}
          </div>

          {/* Seção de Status e Ações */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              {XSalvando && (
                <>
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-primary font-semibold">{XStatus}</span>
                  {XProg.open && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                      {XProg.restante}s
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={XSalvando}
                className="text-xs px-4 py-2 border border-border rounded hover:bg-accent flex items-center gap-1.5"
              >
                <X size={14} /> Cancelar
              </button>
              <button
                type="button"
                onClick={handleFaturar}
                disabled={XSalvando || XLoadingPedidos || !XSelectedPedido}
                className="text-xs px-5 py-2 rounded bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={14} /> {XSalvando ? "Emitindo..." : "Confirmar Emissão"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FaturarPedidoDialog;
