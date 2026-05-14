import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import type { IMovimento, IMovimentoPagamento } from "./types";
import PedidoPagamentoDialog from "./PedidoPagamentoDialog";

const db = supabase as any;

interface ICondicao { condicao_id: number; descricao: string; qtd_parcelas: number | null; }

interface IProps {
  pedido: IMovimento | null;
  podeEditar: boolean;
  totalPedido?: number;
  refreshToken?: number;
  openDialog?: boolean;
  setOpenDialog?: (v: boolean) => void;
  onMudarStatus?: (novo: string) => void;
  onRetornar?: () => void;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const fmtInput = (v: any) => {
  if (v === 0 || v === "0" || v === "" || v === undefined || v === null) return "";
  return String(v).replace(".", ",");
};

const parseNum = (v: any) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const PedidoPagamentoTab: React.FC<IProps> = ({ pedido, podeEditar, totalPedido: totalPedidoProp, refreshToken, onMudarStatus, onRetornar, openDialog, setOpenDialog }) => {
  const { XEmpresaId } = useAppContext();
  const [XPagtos, setXPagtos] = useState<IMovimentoPagamento[]>([]);
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IMovimentoPagamento> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSelected, setXSelected] = useState<IMovimentoPagamento | null>(null);
  const XShowPagamento = !!(openDialog && setOpenDialog);
  const setXShowPagamento = (v: boolean) => setOpenDialog?.(v);

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

  const vlDesconto = Number(pedido?.vl_desconto || 0);
  const totalPedido = Number(totalPedidoProp ?? pedido?.vl_movimento ?? 0);
  const subtotal = totalPedido + vlDesconto;
  const totalPago = XPagtos.reduce((a, p) => a + Number(p.vl_pagamento || 0), 0);

  const handleConfirmarPagamento = async (linhas: any[], vlDesc: number, pcDesc: number, enviarAoCaixa?: boolean) => {
    if (!pedido?.movimento_id) return;

    // Atualiza o desconto no cabeçalho
    const { error: errMov } = await db.from("movimento")
      .update({ vl_desconto: vlDesc, pc_desconto: pcDesc })
      .eq("movimento_id", pedido.movimento_id);
    
    if (errMov) { toast.error("Erro ao atualizar desconto: " + errMov.message); return; }

    // Insere os novos pagamentos
    const payload = linhas.map(l => ({
      movimento_id: pedido.movimento_id,
      empresa_id: XEmpresaId,
      condicao_id: l.condicao_id,
      vl_pagamento: l.vl_pagamento,
      n_parcelas: l.n_parcelas,
      vl_parcelas: l.vl_parcelas,
      tp_pagamento: l.tp_pagamento || "DI"
    }));

    const { error: errPagtos } = await db.from("movimento_pagamento").insert(payload);
    if (errPagtos) { toast.error("Erro ao gravar pagamentos: " + errPagtos.message); return; }

    toast.success("Pagamentos e desconto processados.");
    
    if (enviarAoCaixa && onMudarStatus) {
      await onMudarStatus("F");
    } else {
      await load();
      if (onMudarStatus) onMudarStatus("REFRESH"); // Trigger header refresh
    }
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
        gridActions.atualizar(load),
      ]}
      count={`${XPagtos.length} item(s) de pagamento`}
    />
  );

  const stAtual = pedido.st_pedido;

  return (
    <div className="space-y-3">
      <DataGrid
        columns={cols}
        data={XPagtos}
        maxHeight="300px"
        exportTitle="Pagamentos do Pedido"
        toolbarLeft={pagtoToolbar}
        showRecordCount={false}
        onRowClick={(r) => setXSelected(r)}
        selectedIdx={XSelected ? XPagtos.findIndex(p => p.movimento_pagamento_id === XSelected.movimento_pagamento_id) : null}
      />

      {XShowPagamento && (
        <PedidoPagamentoDialog
          open={XShowPagamento}
          movimentoId={pedido.movimento_id}
          subtotalPedido={subtotal}
          tpDesconto={pedido.tp_desconto || "N"}
          onClose={() => setXShowPagamento(false)}
          onConfirmar={handleConfirmarPagamento}
        />
      )}
      <div className="flex items-start justify-end gap-4 pt-4 border-t border-border mt-4">
        <div className="flex flex-col gap-2 items-end min-w-[240px]">
          <div className="w-full border border-border rounded px-3 py-2 bg-muted/40 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-sm">{fmt(subtotal)}</span>
          </div>
          <div className="w-full border border-rose-200 rounded px-3 py-2 bg-rose-50 dark:bg-rose-950/20 flex justify-between items-center shadow-sm">
            <span className="text-[10px] font-bold uppercase text-rose-800 dark:text-rose-200">Desconto</span>
            <span className="font-semibold text-sm text-rose-700 dark:text-rose-300">{fmt(vlDesconto)}</span>
          </div>
          <div className="w-full border border-emerald-300 rounded px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 flex justify-between items-center shadow-md">
            <span className="text-[10px] font-bold uppercase text-emerald-900 dark:text-emerald-200">Total</span>
            <span className="font-bold text-base text-emerald-700 dark:text-emerald-300">{fmt(totalPedido)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedidoPagamentoTab;
