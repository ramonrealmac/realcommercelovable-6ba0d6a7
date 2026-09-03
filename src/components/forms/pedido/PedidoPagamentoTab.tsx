import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import type { IMovimento, IMovimentoPagamento } from "./types";
import PedidoPagamentoDialog from "./PedidoPagamentoDialog";

interface IPagamentoLinha {
  uid: string;
  movimento_pagamento_id?: number;
  condicao_id: number;
  condicao_descricao: string;
  n_parcelas: number;
  vl_parcelas: number;
  vl_pagamento: number;
  tp_pagamento: string;
  empresa_id: number;
  movimento_id: number;
  portador_id: number | null;
}

interface ICondicao {
  condicao_id: number;
  descricao: string;
  tipo_prazo?: string | null;
  qtd_parcelas: number | null;
  intervalo?: number | null;
  plano_conta_id?: number | null;
  meio_pagamento_id?: number | null;
  prazo_1?: number | null;
  prazo_2?: number | null;
  prazo_3?: number | null;
  prazo_4?: number | null;
  prazo_5?: number | null;
  prazo_6?: number | null;
  prazo_7?: number | null;
  prazo_8?: number | null;
  prazo_9?: number | null;
  prazo_10?: number | null;
  prazo_11?: number | null;
  prazo_12?: number | null;
}

interface IProps {
  pedido: IMovimento | null;
  podeEditar: boolean;
  totalPedido?: number;
  subtotalPedido?: number;
  refreshToken?: number;
  openDialog?: boolean;
  setOpenDialog?: (v: boolean) => void;
  onMudarStatus?: (novo: string) => Promise<void> | void;
  onRetornar?: () => void;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const fmtInput = (v: string | number | null | undefined) => {
  if (v === 0 || v === "0" || v === "" || v === undefined || v === null) return "";
  return String(v).replace(".", ",");
};

const parseNum = (v: string | number | null | undefined) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const PedidoPagamentoTab: React.FC<IProps> = ({ pedido, podeEditar, totalPedido: totalPedidoProp, subtotalPedido: subtotalPedidoProp, refreshToken, onMudarStatus, onRetornar, openDialog, setOpenDialog }) => {
  const { XEmpresaId, XEmpresaMatrizId } = useAppContext();
  const [XPagtos, setXPagtos] = useState<IMovimentoPagamento[]>([]);
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XPortadores, setXPortadores] = useState<{ portador_id: number; cd_portador: number; nome: string }[]>([]);
  const [XMeiosPagamento, setXMeiosPagamento] = useState<{ meio_pagamento_id: number; codigo: string; descricao: string }[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IMovimentoPagamento> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSelected, setXSelected] = useState<IMovimentoPagamento | null>(null);
  const [XSubtotalDb, setXSubtotalDb] = useState<number>(0);
  const [XVlDescontoDb, setXVlDescontoDb] = useState<number>(0);
  const XShowPagamento = !!(openDialog && setOpenDialog);
  const setXShowPagamento = (v: boolean) => setOpenDialog?.(v);

  const load = useCallback(async () => {
    if (!pedido?.movimento_id) { setXPagtos([]); return; }

    const { data, error } = await supabase.from("movimento_pagamento")
      .select("*").eq("movimento_id", pedido.movimento_id).eq("excluido", false)
      .order("movimento_pagamento_id");
    if (error) { toast.error(error.message); return; }
    setXPagtos(data || []);

    // Sincroniza totais reais do movimento e seus itens
    const { data: mov } = await supabase.from("movimento")
      .select("vl_produto, vl_desconto, vl_movimento")
      .eq("movimento_id", pedido.movimento_id)
      .single();

    let sub = Number(mov?.vl_produto || 0);
    let desc = Number(mov?.vl_desconto || 0);

    if (sub <= 0) {
      const { data: itList } = await supabase.from("movimento_item")
        .select("vl_produto, vl_movimento, vl_desconto")
        .eq("movimento_id", pedido.movimento_id)
        .eq("excluido", false);
      if (itList && itList.length > 0) {
        sub = itList.reduce((acc, it) => acc + Number(it.vl_produto || 0), 0);
        if (desc === 0) {
          desc = itList.reduce((acc, it) => acc + Number(it.vl_desconto || 0), 0);
        }
      }
    }

    setXSubtotalDb(sub);
    setXVlDescontoDb(desc);
  }, [pedido?.movimento_id]);

  useEffect(() => { load(); }, [load, refreshToken, pedido?.st_pedido]);

  useEffect(() => {
    if (!pedido?.movimento_id) {
      setXPagtos([]);
      setXEdit(null);
      setXEditingId(null);
      setXSelected(null);
      setXSubtotalDb(0);
      setXVlDescontoDb(0);
    }
  }, [pedido?.movimento_id]);

  // Load portadores and medios de pagamento
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const { data: portadorData } = await supabase.from("portador")
        .select("portador_id, cd_portador, nome")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false);
      if (portadorData) setXPortadores(portadorData);

      const { data: mpData } = await supabase.from("meio_pagamento").select("meio_pagamento_id, codigo, descricao");
      if (mpData) setXMeiosPagamento(mpData);
    })();
  }, [XEmpresaId]);

  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const query = supabase.from("condicao_pagamento")
        .select(`
          condicao_id, descricao, tipo_prazo, qtd_parcelas, intervalo, plano_conta_id, meio_pagamento_id, empresa_id,
          prazo_1, prazo_2, prazo_3, prazo_4, prazo_5, prazo_6, prazo_7, prazo_8, prazo_9, prazo_10, prazo_11, prazo_12
        `)
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false);

      const { data, error } = await query;
      if (error) {
        toast.error("Erro ao carregar condições de pagamento: " + error.message);
        return;
      }

      // Deduplica priorizando a empresa logada
      const rawConds = data || [];
      const condsMap = new Map<string, typeof rawConds[0]>();

      rawConds.forEach(c => {
        const key = c.descricao.trim().toLowerCase();
        const existing = condsMap.get(key);
        if (!existing || c.empresa_id === XEmpresaId) {
          condsMap.set(key, c);
        }
      });

      const finalConds = Array.from(condsMap.values());
      finalConds.sort((a, b) => a.descricao.localeCompare(b.descricao));

      setXCondicoes(finalConds);
    })();
  }, [XEmpresaId, XEmpresaMatrizId]);

  const vlDesconto = XVlDescontoDb || Number(pedido?.vl_desconto || 0);
  const subtotal = subtotalPedidoProp || XSubtotalDb || Number(pedido?.vl_produto || 0) || totalPedidoProp || 0;
  const totalPedido = totalPedidoProp || Math.max(0, subtotal - vlDesconto);
  const totalPago = XPagtos.reduce((a, p) => a + Number(p.vl_pagamento || 0), 0);



  const handleConfirmarPagamento = async (linhas: IPagamentoLinha[], vlDesc: number, pcDesc: number, enviarAoCaixa?: boolean) => {
    if (!pedido?.movimento_id) return;

    if (linhas.length === 0) {
      // CASO: Excluindo todos os pagamentos
      
      // 1. Guardamos as informações de desconto originais do movimento e dos itens
      const { data: originalMov } = await supabase.from("movimento")
        .select("tp_desconto, vl_produto")
        .eq("movimento_id", pedido.movimento_id)
        .single();
        
      const { data: originalItens } = await supabase.from("movimento_item")
        .select("movimento_item_id, vl_desconto, pc_desconto, vl_movimento")
        .eq("movimento_id", pedido.movimento_id)
        .eq("excluido", false);

      // 2. Limpa todos os pagamentos no banco de dados para este pedido
      const { error: errDel } = await supabase.from("movimento_pagamento")
        .update({ excluido: true })
        .eq("movimento_id", pedido.movimento_id);
      
      if (errDel) { toast.error("Erro ao limpar pagamentos: " + errDel.message); return; }

      // 3. Se o status atual for "F" (Caixa), retorna para "O" (Orçamento) usando o RPC
      if (pedido.st_pedido === "F") {
        if (onMudarStatus) {
          await onMudarStatus("O");
        }

        // Como o RPC "fu_mudar_status_pedido_pdv" reseta tp_desconto para 'N' e zera os itens,
        // nós restauramos os valores originais em seguida.
        const tpDescontoOriginal = originalMov?.tp_desconto || "N";
        const vlProdutoOriginal = originalMov ? Number(originalMov.vl_produto || 0) : subtotal;

        // Restauramos o tp_desconto no movimento (com vl_desconto = 0, pc_desconto = 0 e vl_movimento = vlProdutoOriginal)
        await supabase.from("movimento")
          .update({
            tp_desconto: tpDescontoOriginal,
            vl_desconto: 0,
            pc_desconto: 0,
            vl_movimento: vlProdutoOriginal
          })
          .eq("movimento_id", pedido.movimento_id);

        // Restauramos os descontos originais de cada item
        if (originalItens && originalItens.length > 0) {
          for (const item of originalItens) {
            await supabase.from("movimento_item")
              .update({
                vl_desconto: item.vl_desconto,
                pc_desconto: item.pc_desconto,
                vl_movimento: item.vl_movimento
              })
              .eq("movimento_item_id", item.movimento_item_id);
          }
        }
      } else {
        // Se já for "O" (Orçamento), apenas zera os descontos e atualiza o total no movimento,
        // PRESERVANDO o tp_desconto original
        const tpDescontoOriginal = originalMov?.tp_desconto || "N";
        const vlProdutoOriginal = originalMov ? Number(originalMov.vl_produto || 0) : subtotal;

        const { error: errMov } = await supabase.from("movimento")
          .update({ 
            vl_desconto: 0, 
            pc_desconto: 0,
            tp_desconto: tpDescontoOriginal,
            vl_movimento: vlProdutoOriginal
          })
          .eq("movimento_id", pedido.movimento_id);
        
        if (errMov) { toast.error("Erro ao atualizar pedido: " + errMov.message); return; }
      }

      toast.success("Pagamentos excluídos e pedido ajustado.");
      await load();
      if (onMudarStatus) onMudarStatus("REFRESH");
      return;
    }

    // Atualiza o desconto e o valor total no cabeçalho do pedido
    const newVlMovimento = Math.max(0, subtotal - vlDesc);
    const { error: errMov } = await supabase.from("movimento")
      .update({ 
        vl_desconto: vlDesc, 
        pc_desconto: pcDesc,
        vl_movimento: newVlMovimento
      })
      .eq("movimento_id", pedido.movimento_id);
    
    if (errMov) { toast.error("Erro ao atualizar desconto: " + errMov.message); return; }

    // Marca os pagamentos anteriores como excluídos
    const { error: errDel } = await supabase.from("movimento_pagamento")
      .update({ excluido: true })
      .eq("movimento_id", pedido.movimento_id);
    
    if (errDel) { toast.error("Erro ao limpar pagamentos anteriores: " + errDel.message); return; }

    // Insere os novos pagamentos
    const payload = linhas.map(l => ({
      movimento_id: pedido.movimento_id,
      empresa_id: XEmpresaId,
      condicao_id: l.condicao_id,
      vl_pagamento: l.vl_pagamento,
      n_parcelas: l.n_parcelas,
      vl_parcelas: l.vl_parcelas || (l.n_parcelas > 0 ? Number((l.vl_pagamento / l.n_parcelas).toFixed(2)) : l.vl_pagamento),
      tp_pagamento: l.tp_pagamento || "DI",
      portador_id: l.portador_id || null
    }));

    const { error: errPagtos } = await supabase.from("movimento_pagamento").insert(payload);
    if (errPagtos) { toast.error("Erro ao gravar pagamentos: " + errPagtos.message); return; }

    toast.success("Pagamentos processados.");
    
    if (enviarAoCaixa && onMudarStatus) {
      await onMudarStatus("F");
    } else {
      await load();
      if (onMudarStatus) onMudarStatus("REFRESH");
    }
  };

  const cols: IGridColumn[] = [
    { key: "condicao_id", label: "Condição", width: "2fr", render: r => XCondicoes.find(c => c.condicao_id === r.condicao_id)?.descricao || r.condicao_id },
    { 
      key: "portador_id", 
      label: "Portador", 
      width: "1.5fr", 
      render: r => {
        const p = XPortadores.find(x => x.portador_id === r.portador_id);
        return p ? `${p.cd_portador} - ${p.nome}` : (r.portador_id || "");
      }
    },
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
          cadastroId={pedido.cadastro_id}
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
