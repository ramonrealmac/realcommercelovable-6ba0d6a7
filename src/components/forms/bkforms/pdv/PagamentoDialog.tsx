import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { useAppContext } from "@/contexts/AppContext";
import type { IPdvPagamentoLinha, IMovimentoPagamento } from "./types";

const db = supabase as any;

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface ICondicao { condicao_id: number; descricao: string; qtd_parcelas: number | null; tp_documento?: number | null; }
interface IBandeira { bandeira_id: number; descricao: string; }
interface IOperadora { operadora_id: number; razao: string; }

interface IProps {
  open: boolean;
  totalPedido: number;
  /** Pagamentos previamente cadastrados em movimento_pagamento (preenche automaticamente). */
  pagtosPreCarregados?: IMovimentoPagamento[];
  onClose: () => void;
  /** Confirmação final → grava caixa_movimento + itens, atualiza st_pedido='R'. Recebe linhas digitadas. */
  onConfirmar: (linhas: IPdvPagamentoLinha[]) => Promise<void>;
}

const PagamentoDialog: React.FC<IProps> = ({ open, totalPedido, pagtosPreCarregados, onClose, onConfirmar }) => {
  const { XEmpresaId } = useAppContext();
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XBandeiras, setXBandeiras] = useState<IBandeira[]>([]);
  const [XOperadoras, setXOperadoras] = useState<IOperadora[]>([]);
  const [XLinhas, setXLinhas] = useState<IPdvPagamentoLinha[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSalvando, setXSalvando] = useState(false);

  // Fila de pré-preenchimento
  const [XFila, setXFila] = useState<IMovimentoPagamento[]>([]);

  // Form fields
  const [XCondicaoId, setXCondicaoId] = useState<number>(0);
  const [XBandeiraId, setXBandeiraId] = useState<number>(0);
  const [XOperadoraId, setXOperadoraId] = useState<number>(0);
  const [XNrAutoriz, setXNrAutoriz] = useState("");
  const [XVlPagar, setXVlPagar] = useState<number>(0);
  const [XQtParcela, setXQtParcela] = useState<number>(1);
  const [XEditUid, setXEditUid] = useState<string | null>(null);

  const bandeiraRef = useRef<HTMLSelectElement>(null);

  const totalPago = useMemo(() => XLinhas.reduce((a, l) => a + Number(l.vl_recebido || 0), 0), [XLinhas]);
  const valorAPagar = Math.max(0, totalPedido - totalPago);
  const troco = totalPago > totalPedido ? totalPago - totalPedido : 0;
  const vlParcela = XQtParcela > 0 ? +(XVlPagar / XQtParcela).toFixed(2) : XVlPagar;

  // tp_documento da condição atualmente selecionada
  const tpDoc = useMemo(() => {
    const c = XCondicoes.find(x => x.condicao_id === XCondicaoId);
    return c?.tp_documento ?? null;
  }, [XCondicoes, XCondicaoId]);
  const camposCartaoEditaveis = tpDoc === 3 || tpDoc === 4;

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [cond, band, oper] = await Promise.all([
        db.from("condicao").select("condicao_id, descricao, qtd_parcelas:qt_parcelas, tp_documento")
          .eq("excluido", false).order("descricao"),
        db.from("bandeira").select("bandeira_id, descricao").eq("excluido", false).order("descricao"),
        db.from("operadora").select("operadora_id, razao").eq("empresa_id", XEmpresaId).order("razao"),
      ]);
      // condicao_pagamento como fallback se a tabela condicao retornar erro
      let condList: ICondicao[] = (cond.data || []) as ICondicao[];
      if (cond.error || condList.length === 0) {
        const cp = await db.from("condicao_pagamento")
          .select("condicao_id, descricao, qtd_parcelas").eq("excluido", false).order("descricao");
        condList = ((cp.data || []) as any[]).map(r => ({ ...r, tp_documento: null }));
      }
      setXCondicoes(condList);
      setXBandeiras((band.data || []) as IBandeira[]);
      setXOperadoras((oper.data || []) as IOperadora[]);
    })();
    // Reset
    setXLinhas([]);
    setXSelectedIdx(null);
    resetForm(totalPedido);
    setXFila([...(pagtosPreCarregados || [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Pré-preenche o primeiro item da fila quando carrega condições
  useEffect(() => {
    if (!open) return;
    if (XCondicoes.length === 0) return;
    if (XEditUid) return;
    if (totalPago + 0.0001 >= totalPedido) return;
    if (XFila.length === 0) return;
    const proximo = XFila[0];
    aplicarPagtoFila(proximo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [XCondicoes, XFila, open]);

  const aplicarPagtoFila = (p: IMovimentoPagamento) => {
    if (p.condicao_id) setXCondicaoId(Number(p.condicao_id));
    if (p.bandeira_id) setXBandeiraId(Number(p.bandeira_id));
    if (p.operadora_id) setXOperadoraId(Number(p.operadora_id));
    if (p.numero_autorizacao) setXNrAutoriz(p.numero_autorizacao);
    if (p.n_parcelas) setXQtParcela(Number(p.n_parcelas));
    const restante = Math.max(0, totalPedido - totalPago);
    const v = Number(p.vl_pagamento || 0);
    setXVlPagar(v > 0 ? Math.min(v, restante) : restante);
  };

  // Atualiza vl a pagar quando recalcula (sem fila, sem edit)
  useEffect(() => {
    if (!XEditUid && XFila.length === 0) setXVlPagar(valorAPagar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAPagar, XEditUid]);

  const resetForm = (vl: number) => {
    setXCondicaoId(0); setXBandeiraId(0); setXOperadoraId(0);
    setXNrAutoriz(""); setXVlPagar(vl); setXQtParcela(1); setXEditUid(null);
  };

  const setCondicao = (cid: number) => {
    setXCondicaoId(cid);
    const c = XCondicoes.find(x => x.condicao_id === cid);
    if (c?.qtd_parcelas) setXQtParcela(c.qtd_parcelas);
    // Se virou cartão, foca a bandeira
    if (c?.tp_documento === 3 || c?.tp_documento === 4) {
      setTimeout(() => bandeiraRef.current?.focus(), 50);
    }
  };

  const confirmarLinha = () => {
    if (!XCondicaoId) { toast.error("Selecione a condição."); return; }
    if (XVlPagar <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (XQtParcela <= 0) { toast.error("Informe quantidade de parcelas."); return; }

    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    const band = XBandeiras.find(b => b.bandeira_id === XBandeiraId);
    const oper = XOperadoras.find(o => o.operadora_id === XOperadoraId);

    const novaSomada = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_recebido || 0) : 0) + XVlPagar;
    if (novaSomada > totalPedido + 0.0001) {
      const isDinheiro = cond?.descricao?.toLowerCase().includes("dinheiro");
      if (!isDinheiro) {
        toast.error("Valor pago não pode ultrapassar o total do pedido.");
        return;
      }
    }

    const linha: IPdvPagamentoLinha = {
      uid: XEditUid || crypto.randomUUID(),
      condicao_id: XCondicaoId,
      condicao_descricao: cond?.descricao || "",
      bandeira_id: XBandeiraId || null,
      bandeira_descricao: band?.descricao || "",
      operadora_id: XOperadoraId || null,
      operadora_descricao: oper?.razao || "",
      numero_autoriza: XNrAutoriz,
      qt_parcela: XQtParcela,
      vl_parcela: vlParcela,
      vl_recebido: XVlPagar,
    };

    setXLinhas(prev => XEditUid ? prev.map(l => l.uid === XEditUid ? linha : l) : [...prev, linha]);
    setXSelectedIdx(null);

    // Avança a fila
    const novaFila = XFila.slice(1);
    setXFila(novaFila);

    // Calcula novo restante para próximo
    const novoTotalPago = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_recebido || 0) : 0) + XVlPagar;
    const restante = Math.max(0, totalPedido - novoTotalPago);
    resetForm(restante);

    // Se restante > 0 e ainda há item na fila, será pré-preenchido pelo effect.
  };

  const editarLinha = (l: IPdvPagamentoLinha | null) => {
    if (!l) { toast.error("Selecione um pagamento."); return; }
    setXEditUid(l.uid);
    setXCondicaoId(l.condicao_id);
    setXBandeiraId(l.bandeira_id || 0);
    setXOperadoraId(l.operadora_id || 0);
    setXNrAutoriz(l.numero_autoriza || "");
    setXVlPagar(l.vl_recebido);
    setXQtParcela(l.qt_parcela);
  };

  const excluirLinha = (l: IPdvPagamentoLinha | null) => {
    if (!l) { toast.error("Selecione um pagamento."); return; }
    if (!confirm("Excluir este pagamento?")) return;
    setXLinhas(prev => prev.filter(x => x.uid !== l.uid));
    setXSelectedIdx(null);
  };

  const finalizar = async () => {
    if (XLinhas.length === 0) { toast.error("Inclua ao menos um pagamento."); return; }
    if (totalPago + 0.0001 < totalPedido) { toast.error("Valor pago é menor que o total do pedido."); return; }
    if (!confirm("Confirma o recebimento e a baixa do pedido?")) return;
    setXSalvando(true);
    try {
      await onConfirmar(XLinhas);
    } finally {
      setXSalvando(false);
    }
  };

  const cols: IGridColumn[] = [
    { key: "condicao_descricao", label: "Condição", width: "2fr" },
    { key: "vl_recebido", label: "Valor", width: "120px", align: "right", render: r => fmt(r.vl_recebido) },
    { key: "qt_parcela", label: "Parcelas", width: "100px", align: "right" },
    { key: "vl_parcela", label: "Valor Parcela", width: "120px", align: "right", render: r => fmt(r.vl_parcela) },
  ];

  const selecionado = XSelectedIdx != null ? XLinhas[XSelectedIdx] : null;

  const toolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(() => { setXSelectedIdx(null); resetForm(valorAPagar); }, false),
        gridActions.alterar(() => editarLinha(selecionado), !selecionado),
        null,
        gridActions.excluir(() => excluirLinha(selecionado), !selecionado),
      ]}
      count={`${XLinhas.length} pagto(s)`}
    />
  );

  // estilos: brancos para condicao/vlr; bandeira/operadora/nrautoriz brancos só quando editáveis
  const brancoCls = "bg-white text-black dark:bg-white dark:text-black";
  const cinzaCls = "bg-muted text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Meios de Pagamento e Prazos</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-4">
          {/* Esquerda: formulário */}
          <div className="col-span-7 space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Condição</label>
              <select value={XCondicaoId} onChange={e => setCondicao(Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1.5 text-sm ${brancoCls}`}>
                <option value={0}>--</option>
                {XCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bandeira</label>
              <select
                ref={bandeiraRef}
                value={XBandeiraId}
                onChange={e => setXBandeiraId(Number(e.target.value))}
                disabled={!camposCartaoEditaveis}
                tabIndex={camposCartaoEditaveis ? 0 : -1}
                className={`w-full border border-border rounded px-2 py-1.5 text-sm ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                <option value={0}>--</option>
                {XBandeiras.map(b => <option key={b.bandeira_id} value={b.bandeira_id}>{b.descricao}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Operadora</label>
              <select value={XOperadoraId} onChange={e => setXOperadoraId(Number(e.target.value))}
                disabled={!camposCartaoEditaveis}
                tabIndex={camposCartaoEditaveis ? 0 : -1}
                className={`w-full border border-border rounded px-2 py-1.5 text-sm ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                <option value={0}>--</option>
                {XOperadoras.map(o => <option key={o.operadora_id} value={o.operadora_id}>{o.razao}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-5">
                <label className="text-xs text-muted-foreground">Nº Autorização</label>
                <input value={XNrAutoriz} onChange={e => setXNrAutoriz(e.target.value)}
                  disabled={!camposCartaoEditaveis}
                  tabIndex={camposCartaoEditaveis ? 0 : -1}
                  className={`w-full border border-border rounded px-2 py-1.5 text-sm ${camposCartaoEditaveis ? brancoCls : cinzaCls}`} />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Vlr a Pagar</label>
                <input type="number" value={XVlPagar} onChange={e => setXVlPagar(Number(e.target.value))}
                  className={`w-full border border-border rounded px-2 py-1.5 text-sm text-right ${brancoCls} ${NO_SPIN}`} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Vezes</label>
                <input type="number" value={XQtParcela} onChange={e => setXQtParcela(Number(e.target.value) || 1)}
                  className={`w-full border border-border rounded px-2 py-1.5 text-sm text-right bg-card ${NO_SPIN}`} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Vlr Parcela</label>
                <div tabIndex={-1} className="w-full border border-border rounded px-2 py-1.5 text-sm bg-secondary text-right text-foreground select-text">
                  {fmt(vlParcela)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={confirmarLinha}
                className="text-sm px-4 py-1.5 rounded bg-success text-success-foreground border border-success">
                ✓ {XEditUid ? "Atualizar" : "Confirmar"}
              </button>
              {XEditUid && (
                <button onClick={() => resetForm(valorAPagar)}
                  className="text-sm px-4 py-1.5 rounded border border-border">Cancelar Edição</button>
              )}
            </div>
          </div>

          {/* Direita: cards de totais */}
          <div className="col-span-5 space-y-2">
            <div className="border border-border rounded px-3 py-2 bg-muted/40 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Total Pedido</span>
              <span className="font-semibold text-base">{fmt(totalPedido)}</span>
            </div>
            <div className="border border-blue-300 rounded px-3 py-2 bg-blue-50 dark:bg-blue-950/30 flex justify-between items-center">
              <span className="text-xs text-blue-900 dark:text-blue-200">Valor Pago</span>
              <span className="font-semibold text-base text-blue-900 dark:text-blue-200">{fmt(totalPago)}</span>
            </div>
            <div className={`border rounded px-3 py-2 flex justify-between items-center ${
              valorAPagar > 0 ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-border bg-muted/40"
            }`}>
              <span className={`text-xs ${valorAPagar > 0 ? "text-red-900 dark:text-red-200" : "text-muted-foreground"}`}>Valor a Pagar</span>
              <span className={`font-bold text-lg ${valorAPagar > 0 ? "text-red-700 dark:text-red-300" : ""}`}>{fmt(valorAPagar)}</span>
            </div>
            <div className="border border-border rounded px-3 py-2 bg-muted/40 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Troco</span>
              <span className="font-semibold text-base">{fmt(troco)}</span>
            </div>
          </div>
        </div>

        {/* Grid de pagamentos */}
        <DataGrid
          columns={cols}
          data={XLinhas}
          maxHeight="200px"
          exportTitle="Pagamentos"
          toolbarLeft={toolbar}
          showRecordCount={false}
          onRowClick={(_, idx) => setXSelectedIdx(idx)}
          onRowDoubleClick={(r) => editarLinha(r)}
          selectedIdx={XSelectedIdx}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} disabled={XSalvando}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent">
            Sair
          </button>
          <button onClick={finalizar} disabled={XSalvando || valorAPagar > 0}
            className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
            {XSalvando ? "Gravando..." : "Finalizar Recebimento →"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PagamentoDialog;
