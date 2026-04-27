import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import type { IMovimento, IMovimentoPagamento } from "./types";

const db = supabase as any;

interface ICondicao { condicao_id: number; descricao: string; qtd_parcelas: number | null; }

interface IProps {
  pedido: IMovimento | null;
  podeEditar: boolean;
  totalPedido?: number;
  refreshToken?: number;
  onMudarStatus?: (novo: string) => void;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const PedidoPagamentoTab: React.FC<IProps> = ({ pedido, podeEditar, totalPedido: totalPedidoProp, refreshToken, onMudarStatus }) => {
  const { XEmpresaId } = useAppContext();
  const [XPagtos, setXPagtos] = useState<IMovimentoPagamento[]>([]);
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IMovimentoPagamento> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSelected, setXSelected] = useState<IMovimentoPagamento | null>(null);

  const load = useCallback(async () => {
    if (!pedido?.movimento_id) { setXPagtos([]); return; }

    const { data, error } = await db.from("movimento_pagamento")
      .select("*").eq("movimento_id", pedido.movimento_id).eq("excluido", false)
      .order("movimento_pagamento_id");
    if (error) { toast.error(error.message); return; }
    setXPagtos(data || []);
  }, [pedido?.movimento_id]);

  useEffect(() => { load(); }, [load, refreshToken]);

  useEffect(() => {
    if (!pedido?.movimento_id) {
      setXPagtos([]);
      setXEdit(null);
      setXEditingId(null);
      setXSelected(null);
    }
  }, [pedido?.movimento_id]);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("condicao_pagamento")
        .select("condicao_id, descricao, qtd_parcelas").eq("excluido", false).order("descricao");
      setXCondicoes(data || []);
    })();
  }, []);

  const totalPedido = Number(totalPedidoProp ?? pedido?.vl_movimento ?? 0);
  const totalPago = XPagtos.reduce((a, p) => a + Number(p.vl_pagamento || 0), 0);
  const valorAPagar = Math.max(0, totalPedido - totalPago);

  const novo = () => {
    setXEditingId(null);
    setXEdit({ vl_pagamento: valorAPagar, n_parcelas: 1, vl_parcelas: valorAPagar, condicao_id: 0, tp_pagamento: "DI", obs_pagamento: "", nr_autorizacao: "" });
  };

  const editar = (p: IMovimentoPagamento | null) => {
    if (!p) { toast.error("Selecione um pagamento."); return; }
    setXEdit({ ...p }); setXEditingId(p.movimento_pagamento_id);
  };

  const setCondicao = (cid: number) => {
    const c = XCondicoes.find(x => x.condicao_id === cid);
    const parc = c?.qtd_parcelas || 1;
    setXEdit(prev => {
      const v = Number(prev?.vl_pagamento) || 0;
      return { ...prev!, condicao_id: cid, n_parcelas: parc, vl_parcelas: parc > 0 ? +(v / parc).toFixed(2) : v };
    });
  };

  const setVlPagto = (v: number) => setXEdit(prev => {
    const p = Number(prev?.n_parcelas) || 1;
    return { ...prev!, vl_pagamento: v, vl_parcelas: p > 0 ? +(v / p).toFixed(2) : v };
  });

  const salvar = async () => {
    if (!pedido?.movimento_id) { toast.error("Salve o pedido antes."); return; }
    if (!XEdit?.condicao_id) { toast.error("Selecione a condição."); return; }
    const valorPagamento = Number(XEdit.vl_pagamento || 0);
    if (valorPagamento <= 0) { toast.error("Informe um valor de pagamento maior que zero."); return; }
    const valorAnterior = XEditingId ? Number(XSelected?.vl_pagamento || 0) : 0;
    const novoTotalPago = totalPago - valorAnterior + valorPagamento;
    if (novoTotalPago > totalPedido) {
      toast.error("O valor pago não pode ser maior que o valor do pedido.");
      return;
    }
    const payload = { ...XEdit, empresa_id: XEmpresaId, movimento_id: pedido.movimento_id };
    if (XEditingId) {
      const { error } = await db.from("movimento_pagamento").update(payload).eq("movimento_pagamento_id", XEditingId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("movimento_pagamento").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Pagamento salvo.");
    setXEdit(null); setXEditingId(null);
    await load();
  };

  const excluir = async (p: IMovimentoPagamento | null) => {
    if (!p) { toast.error("Selecione um pagamento."); return; }
    if (!confirm("Excluir pagamento?")) return;
    const { error } = await db.from("movimento_pagamento").update({ excluido: true }).eq("movimento_pagamento_id", p.movimento_pagamento_id);
    if (error) { toast.error(error.message); return; }
    setXSelected(null);
    await load();
  };

  const cols: IGridColumn[] = [
    { key: "condicao_id", label: "Condição", width: "2fr", render: r => XCondicoes.find(c => c.condicao_id === r.condicao_id)?.descricao || r.condicao_id },
    { key: "vl_pagamento", label: "Valor", width: "120px", align: "right", render: r => fmt(r.vl_pagamento) },
    { key: "n_parcelas", label: "Parcelas", width: "100px", align: "right" },
    { key: "vl_parcelas", label: "Valor Parcela", width: "120px", align: "right", render: r => fmt(r.vl_parcelas) },
  ];

  if (!pedido?.movimento_id) {
    return <div className="text-sm text-muted-foreground p-4">Salve o pedido para inserir pagamentos.</div>;
  }
  const ro = !podeEditar;

  // Toolbar padrão (GridActionToolbar)
  const pagtoToolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(novo, ro),
        gridActions.alterar(() => editar(XSelected), ro || !XSelected),
        null, // separador
        gridActions.excluir(() => excluir(XSelected), ro || !XSelected),
        gridActions.atualizar(load),
      ]}
      count={`${XPagtos.length} pagto(s)`}
    />
  );

  const stAtual = pedido.st_pedido;

  return (
    <div className="space-y-3">
      {XEdit && (
        <div className="border border-border rounded p-3 space-y-2 bg-card">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5"><label className="text-xs text-muted-foreground">Condição</label>
              <select disabled={ro} value={XEdit.condicao_id ?? 0} onChange={e => setCondicao(Number(e.target.value))} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                <option value={0}>--</option>
                {XCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
              </select>
            </div>
            <div className="col-span-3"><label className="text-xs text-muted-foreground">Valor</label><input type="number" disabled={ro} value={XEdit.vl_pagamento ?? 0} onChange={e => setVlPagto(Number(e.target.value))} className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} /></div>
            <div className="col-span-2"><label className="text-xs text-muted-foreground">Parcelas</label><input type="number" disabled={ro} value={XEdit.n_parcelas ?? 1} onChange={e => setXEdit(prev => { const p = Number(e.target.value) || 1; const v = Number(prev?.vl_pagamento) || 0; return { ...prev!, n_parcelas: p, vl_parcelas: p > 0 ? +(v / p).toFixed(2) : v }; })} className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} /></div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Parcela</label>
              <div className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right text-foreground select-text">
                {fmt(XEdit.vl_parcelas || 0)}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={salvar} disabled={ro} className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50">Salvar</button>
            <button onClick={() => { setXEdit(null); setXEditingId(null); }} className="text-sm px-3 py-1 rounded border border-border">Cancelar</button>
          </div>
        </div>
      )}

      <DataGrid
        columns={cols}
        data={XPagtos}
        maxHeight="300px"
        exportTitle="Pagamentos do Pedido"
        toolbarLeft={pagtoToolbar}
        showRecordCount={false}
        onRowClick={(r) => setXSelected(r)}
        onRowDoubleClick={(r) => editar(r)}
        selectedIdx={XSelected ? XPagtos.findIndex(p => p.movimento_pagamento_id === XSelected.movimento_pagamento_id) : null}
      />

      {/* Rodapé: ações à esquerda, totais empilhados à direita */}
      <div className="flex items-start justify-between gap-4 pt-2 border-t border-border">
        <div className="flex flex-col gap-2">
          {stAtual === "O" && onMudarStatus && (
            <button onClick={() => { if (confirm("Confirma o envio deste pedido para o Caixa?")) onMudarStatus("P"); }} className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground">→ Caixa (Pedido)</button>
          )}
          {(stAtual === "O" || stAtual === "P") && onMudarStatus && (
            <button
              onClick={() => { if (confirm("Cancelar este pedido?")) onMudarStatus("C"); }}
              className="text-sm px-4 py-1.5 rounded border border-destructive text-destructive"
            >Cancelar Pedido</button>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end min-w-[240px]">
          <div className="w-full border border-border rounded px-3 py-2 bg-muted/40 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Total Pedido</span>
            <span className="font-semibold text-sm">{fmt(totalPedido)}</span>
          </div>
          <div className="w-full border border-blue-300 rounded px-3 py-2 bg-blue-50 dark:bg-blue-950/30 flex justify-between items-center">
            <span className="text-xs text-blue-900 dark:text-blue-200">Valor Pago</span>
            <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">{fmt(totalPago)}</span>
          </div>
          {valorAPagar > 0 && (
            <div className="w-full border border-red-300 rounded px-3 py-2 bg-red-50 dark:bg-red-950/30 flex justify-between items-center">
              <span className="text-xs text-red-900 dark:text-red-200">Valor a Pagar</span>
              <span className="font-bold text-base text-red-700 dark:text-red-300">{fmt(valorAPagar)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PedidoPagamentoTab;
