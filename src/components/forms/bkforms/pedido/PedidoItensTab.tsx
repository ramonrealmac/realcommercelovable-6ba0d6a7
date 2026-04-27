import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Search } from "lucide-react";
import type { IMovimento, IMovimentoItem } from "./types";
import ProdutoSearchDialog, { IProdutoRow, buscarProdutoPorCodigo } from "./ProdutoSearchDialog";

const db = supabase as any;

interface IDepositoLookup { deposito_id: number; nome: string; }

interface IProps {
  pedido: IMovimento | null;
  podeEditar: boolean;
  onTotalsChanged?: (total: number, itens: IMovimentoItem[]) => void;
  autoNovoTrigger?: number;
}

const fmt = (v: number, dec = 2) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Classe utilitária para remover spinners dos inputs number
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const PedidoItensTab: React.FC<IProps> = ({ pedido, podeEditar, onTotalsChanged, autoNovoTrigger }) => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XItens, setXItens] = useState<IMovimentoItem[]>([]);
  const [XDepositos, setXDepositos] = useState<IDepositoLookup[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IMovimentoItem> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XEditEstoque, setXEditEstoque] = useState<{ disp: number; res: number } | null>(null);
  const [XCodigo, setXCodigo] = useState("");
  const [XDepEstoque, setXDepEstoque] = useState<Record<number, number>>({});
  const [XValidaEstoque, setXValidaEstoque] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  const lupaRef = useRef<HTMLButtonElement>(null);
  const precoUnitRef = useRef<HTMLInputElement>(null);

  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  const loadItens = useCallback(async () => {
    if (!pedido?.movimento_id) { setXItens([]); return; }
    const { data, error } = await db.from("movimento_item")
      .select("*").eq("movimento_id", pedido.movimento_id).eq("excluido", false)
      .order("movimento_item_id");
    if (error) { toast.error("Erro itens: " + error.message); return; }
    setXItens(data || []);
  }, [pedido?.movimento_id]);

  useEffect(() => { loadItens(); }, [loadItens]);

  useEffect(() => {
    if (!pedido?.movimento_id) {
      setXItens([]);
      setXEdit(null);
      setXEditingId(null);
      setXEditEstoque(null);
      setXCodigo("");
      setXDepEstoque({});
      setXSelectedIdx(null);
    }
  }, [pedido?.movimento_id]);

  // Depósitos visíveis
  useEffect(() => {
    (async () => {
      const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
      const { data } = await db.from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado")
        .in("empresa_id", ids).eq("excluido", false).order("nome");
      const filtered = (data || []).filter((d: any) =>
        d.empresa_id === XEmpresaId || d.st_privado === false
      );
      setXDepositos(filtered);
    })();
  }, [XEmpresaId, XGroupEmpresaIds]);

  // Carrega flag de validação de estoque (empresa.valida_estoque)
  useEffect(() => {
    (async () => {
      const { data } = await db.from("empresa")
        .select("valida_estoque").eq("empresa_id", XEmpresaId).maybeSingle();
      const v = (data?.valida_estoque || "").toString().toUpperCase();
      setXValidaEstoque(v === "S" || v === "T" || v === "true" || v === "1");
    })();
  }, [XEmpresaId]);

  const novo = useCallback(() => {
    setXEditingId(null);
    setXEditEstoque(null);
    setXDepEstoque({});
    setXCodigo("");
    setXEdit({
      qt_movimento: 1, vl_und_produto: 0, vl_produto: 0,
      pc_desconto: 0, vl_desconto: 0, vl_movimento: 0,
      vl_despesa: 0, vl_frete: 0, vl_seguro: 0, vl_outro: 0,
      entrega: "N", deposito_id: XDepositos[0]?.deposito_id ?? 1,
    });
    setTimeout(() => codigoRef.current?.focus(), 50);
  }, [XDepositos]);

  // Auto disparar "novo" após inserção do cabeçalho
  useEffect(() => {
    if (autoNovoTrigger && pedido?.movimento_id && podeEditar && !XEdit) {
      novo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNovoTrigger, pedido?.movimento_id]);

  const carregarEstoquePorDeposito = useCallback(async (produto_id: number) => {
    const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
    const { data } = await db.from("estoque")
      .select("deposito_id, estoque_disponivel")
      .eq("produto_id", produto_id)
      .in("empresa_id", ids)
      .eq("excluido", false);
    const map: Record<number, number> = {};
    for (const e of (data || []) as any[]) {
      map[e.deposito_id] = (map[e.deposito_id] || 0) + Number(e.estoque_disponivel || 0);
    }
    setXDepEstoque(map);
  }, [XEmpresaId, XGroupEmpresaIds]);

  const editar = (it: IMovimentoItem) => {
    setXEdit({ ...it });
    setXEditingId(it.movimento_item_id);
    setXEditEstoque(null);
    setXCodigo(it.cd_produto || String(it.produto_id || ""));
    if (it.produto_id) carregarEstoquePorDeposito(it.produto_id);
  };

  const recalc = (e: Partial<IMovimentoItem>): Partial<IMovimentoItem> => {
    const qt = Number(e.qt_movimento) || 0;
    const vu = Number(e.vl_und_produto) || 0;
    const sub = qt * vu;
    const pc = Number(e.pc_desconto) || 0;
    const vd = +(sub * pc / 100).toFixed(2);
    const out = (Number(e.vl_despesa) || 0) + (Number(e.vl_frete) || 0) + (Number(e.vl_seguro) || 0) + (Number(e.vl_outro) || 0);
    return { ...e, vl_produto: +sub.toFixed(2), vl_desconto: vd, vl_movimento: +(sub - vd + out).toFixed(2) };
  };

  const setF = <K extends keyof IMovimentoItem>(k: K, v: any) => {
    setXEdit(prev => recalc({ ...prev!, [k]: v }));
  };

  const aplicarProduto = useCallback((p: IProdutoRow, deposito_id?: number) => {
    setXEdit(prev => recalc({
      ...(prev || {}),
      produto_id: p.produto_id,
      cd_produto: String(p.produto_id),
      nm_produto: p.nome,
      unidade_id: p.unidade_id,
      vl_und_produto: Number(p.st_promo && p.preco_promocional > 0 ? p.preco_promocional : p.preco_venda) || 0,
      ...(deposito_id ? { deposito_id } : {}),
    }));
    setXEditEstoque({ disp: p.estoque_disponivel, res: p.estoque_reservado });
    setXCodigo(String(p.produto_id));
    carregarEstoquePorDeposito(p.produto_id);
    // foco no preço unitário
    setTimeout(() => { precoUnitRef.current?.focus(); precoUnitRef.current?.select(); }, 80);
  }, [carregarEstoquePorDeposito]);

  const onCodigoBlur = async () => {
    const t = XCodigo.trim();
    if (!t) {
      // vazio → vai pro botão da lupa
      setTimeout(() => lupaRef.current?.focus(), 30);
      return;
    }
    if (XEdit?.produto_id && (String(XEdit.produto_id) === t || XEdit.cd_produto === t)) {
      setTimeout(() => { precoUnitRef.current?.focus(); precoUnitRef.current?.select(); }, 30);
      return;
    }
    const p = await buscarProdutoPorCodigo(t, XEmpresaId, XGroupEmpresaIds);
    if (!p) { toast.error("Produto não encontrado."); return; }
    aplicarProduto(p);
  };

  const limparProduto = () => {
    setXEdit(prev => recalc({
      ...(prev || {}),
      produto_id: undefined, cd_produto: undefined, nm_produto: undefined,
      unidade_id: undefined, vl_und_produto: 0,
    }));
    setXEditEstoque(null);
    setXDepEstoque({});
    setXCodigo("");
  };

  const onPcDesc = (pc: number) => setXEdit(prev => recalc({ ...prev!, pc_desconto: pc }));
  const onVlDesc = (vl: number) => {
    setXEdit(prev => {
      const sub = (Number(prev?.qt_movimento) || 0) * (Number(prev?.vl_und_produto) || 0);
      const pc = sub > 0 ? +(vl / sub * 100).toFixed(2) : 0;
      return recalc({ ...prev!, pc_desconto: pc });
    });
  };

  const salvarItem = async () => {
    if (!pedido?.movimento_id) { toast.error("Salve o pedido antes."); return; }
    if (!XEdit?.produto_id) { toast.error("Selecione o produto."); return; }
    const qt = Number(XEdit.qt_movimento) || 0;
    if (qt <= 0) { toast.error("Qtd. inválida."); return; }
    if (!XEdit.deposito_id) { toast.error("Selecione o depósito."); return; }

    if (XValidaEstoque) {
      const dispDep = XDepEstoque[XEdit.deposito_id] ?? 0;
      const depNome = XDepositos.find(d => d.deposito_id === XEdit.deposito_id)?.nome || XEdit.deposito_id;
      if (qt > dispDep) {
        toast.error(`Quantidade (${fmt(qt, 4)}) excede o estoque disponível (${fmt(dispDep, 4)}) no depósito ${depNome}.`);
        return;
      }
    }

    const payload = {
      ...XEdit,
      empresa_id: XEmpresaId,
      movimento_id: pedido.movimento_id,
      tp_movimento: pedido.tp_movimento || "PD",
    };
    if (XEditingId) {
      const { error } = await db.from("movimento_item").update(payload).eq("movimento_item_id", XEditingId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("movimento_item").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    await db.rpc("fu_recalcular_pedido", { _movimento_id: pedido.movimento_id });
    toast.success("Item salvo.");
    const wasInsert = !XEditingId;
    setXEdit(null); setXEditingId(null); setXEditEstoque(null);
    setXDepEstoque({}); setXCodigo("");
    await loadItens();
    // Após inserir, abrir automaticamente um novo item para inserção contínua
    if (wasInsert && podeEditar) {
      setTimeout(() => novo(), 100);
    }
  };

  const excluirItem = async (it: IMovimentoItem) => {
    if (!confirm("Excluir item?")) return;
    const { error } = await db.from("movimento_item").update({ excluido: true }).eq("movimento_item_id", it.movimento_item_id);
    if (error) { toast.error(error.message); return; }
    await db.rpc("fu_recalcular_pedido", { _movimento_id: pedido!.movimento_id });
    await loadItens();
  };

  const itemSelecionado = XSelectedIdx != null ? XItens[XSelectedIdx] : null;

  const onToolbarEditar = () => {
    if (!itemSelecionado) { toast.error("Selecione um item."); return; }
    editar(itemSelecionado);
  };
  const onToolbarExcluir = () => {
    if (!itemSelecionado) { toast.error("Selecione um item."); return; }
    excluirItem(itemSelecionado);
  };

  const cols: IGridColumn[] = [
    { key: "cd_produto", label: "Código", width: "90px", align: "right", render: r => r.cd_produto || (r.produto_id ?? "") },
    { key: "nm_produto", label: "Produto", width: "2fr" },
    { key: "qt_movimento", label: "Qtd.", width: "90px", align: "right", render: r => fmt(r.qt_movimento, 4) },
    { key: "vl_und_produto", label: "Vlr. Unit", width: "100px", align: "right", render: r => fmt(r.vl_und_produto) },
    { key: "vl_produto", label: "Subtotal", width: "110px", align: "right", render: r => fmt(r.vl_produto) },
    { key: "pc_desconto", label: "Desc.(%)", width: "80px", align: "right", render: r => fmt(r.pc_desconto) },
    { key: "vl_desconto", label: "Desc.(R$)", width: "100px", align: "right", render: r => fmt(r.vl_desconto) },
    { key: "vl_despesa", label: "Vlr. Desp.", width: "100px", align: "right", render: r => fmt(r.vl_despesa) },
    { key: "vl_frete", label: "Vlr. Frete", width: "100px", align: "right", render: r => fmt(r.vl_frete) },
    { key: "vl_seguro", label: "Vlr. Seg.", width: "100px", align: "right", render: r => fmt(r.vl_seguro) },
    { key: "vl_outro", label: "Vlr. Outros", width: "100px", align: "right", render: r => fmt(r.vl_outro) },
    { key: "vl_movimento", label: "Total", width: "110px", align: "right", render: r => fmt(r.vl_movimento) },
  ];

  const T = XItens.reduce((acc, i) => ({
    vl_produto: acc.vl_produto + Number(i.vl_produto || 0),
    vl_desconto: acc.vl_desconto + Number(i.vl_desconto || 0),
    vl_frete: acc.vl_frete + Number(i.vl_frete || 0),
    vl_despesa: acc.vl_despesa + Number(i.vl_despesa || 0),
    vl_seguro: acc.vl_seguro + Number(i.vl_seguro || 0),
    vl_outro: acc.vl_outro + Number(i.vl_outro || 0),
    vl_movimento: acc.vl_movimento + Number(i.vl_movimento || 0),
  }), { vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_despesa: 0, vl_seguro: 0, vl_outro: 0, vl_movimento: 0 });

  useEffect(() => {
    onTotalsChanged?.(T.vl_movimento, XItens);
  }, [T.vl_movimento, XItens, onTotalsChanged]);

  if (!pedido?.movimento_id) {
    return <div className="text-sm text-muted-foreground p-4">Salve o pedido para começar a inserir itens.</div>;
  }

  const ro = !podeEditar;

  const itensToolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(novo, ro),
        gridActions.alterar(onToolbarEditar, ro || !itemSelecionado),
        null,
        gridActions.excluir(onToolbarExcluir, ro || !itemSelecionado),
        gridActions.atualizar(loadItens),
      ]}
      count={`${XItens.length} item(ns)`}
    />
  );

  return (
    <div className="space-y-3">

      {XEdit && (
        <div className="border border-border rounded p-3 space-y-2 bg-card">
          {/* Linha 1: Código | 🔎 | Produto | Und | Preço Unit | Qtd | Subtotal */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Código/EAN</label>
              <input
                ref={codigoRef}
                disabled={ro}
                value={XCodigo}
                onChange={e => setXCodigo(e.target.value)}
                onBlur={onCodigoBlur}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                placeholder="Cód. ou EAN"
                className="w-full border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="col-span-1 flex gap-1">
              <button ref={lupaRef} type="button" disabled={ro} onClick={() => setXSearchOpen(true)}
                className="px-2 py-1 border border-border rounded bg-card hover:bg-accent disabled:opacity-50"
                title="Pesquisar produto">
                <Search className="w-4 h-4" />
              </button>
              {XEdit.produto_id && !ro && (
                <button type="button" onClick={limparProduto}
                  className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                  title="Limpar">×</button>
              )}
            </div>
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">Produto</label>
              <input readOnly tabIndex={-1} value={XEdit.nm_produto || ""}
                placeholder="Selecione um produto..."
                className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-muted-foreground">Und.</label>
              <input readOnly tabIndex={-1} value={XEdit.unidade_id ?? ""}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
            </div>
            <div className="col-span-1">
              <label className="text-xs text-muted-foreground">Preço Unit.</label>
              <input ref={precoUnitRef} type="number" step="0.01" disabled={ro}
                value={XEdit.vl_und_produto ?? 0}
                onChange={e => setF("vl_und_produto", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Qtd.</label>
              <input type="number" step="0.0001" disabled={ro}
                value={XEdit.qt_movimento ?? 0}
                onChange={e => setF("qt_movimento", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-1 flex flex-col justify-end">
              <label className="text-xs text-muted-foreground">Subtotal</label>
              <input readOnly tabIndex={-1} value={fmt(XEdit.vl_produto || 0)}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right font-semibold" />
            </div>
          </div>

          {/* Linha 2: Desc.(%) | Desc.(R$) | P/Entrega | Estoq.Disp | Depósito */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Desc.(%)</label>
              <input type="number" step="0.01" disabled={ro || pedido.tp_desconto === "N"}
                value={XEdit.pc_desconto ?? 0}
                onChange={e => onPcDesc(Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Desc.(R$)</label>
              <input type="number" step="0.01" disabled={ro || pedido.tp_desconto === "N"}
                value={XEdit.vl_desconto ?? 0}
                onChange={e => onVlDesc(Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2 flex items-end">
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" disabled={ro}
                  checked={XEdit.entrega === "S"}
                  onChange={e => setF("entrega", e.target.checked ? "S" : "N")} />
                P/Entrega?
              </label>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Estoq. Disp.</label>
              <input readOnly tabIndex={-1} value={XEditEstoque ? fmt(XEditEstoque.disp, 4) : ""}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">Depósito</label>
              <select disabled={ro} value={XEdit.deposito_id ?? ""}
                onChange={e => setF("deposito_id", Number(e.target.value))}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
                <option value="">--</option>
                {XDepositos
                  .filter(d => !XEdit.produto_id || XDepEstoque[d.deposito_id] !== undefined)
                  .map(d => (
                    <option key={d.deposito_id} value={d.deposito_id}>
                      {d.deposito_id} - {d.nome}
                      {XEdit.produto_id ? ` (${fmt(XDepEstoque[d.deposito_id] || 0, 4)})` : ""}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Linha 3: Despesas / Frete / Seguro / Outros / Total / botões */}
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Desp.</label>
              <input type="number" step="0.01" disabled={ro} value={XEdit.vl_despesa ?? 0}
                onChange={e => setF("vl_despesa", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Frete</label>
              <input type="number" step="0.01" disabled={ro} value={XEdit.vl_frete ?? 0}
                onChange={e => setF("vl_frete", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Seg.</label>
              <input type="number" step="0.01" disabled={ro} value={XEdit.vl_seguro ?? 0}
                onChange={e => setF("vl_seguro", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Vlr. Outros</label>
              <input type="number" step="0.01" disabled={ro} value={XEdit.vl_outro ?? 0}
                onChange={e => setF("vl_outro", Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${NO_SPIN}`} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Total</label>
              <input readOnly tabIndex={-1} value={fmt(XEdit.vl_movimento || 0)}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right font-semibold" />
            </div>
            <div className="col-span-2 flex items-end gap-1">
              <button onClick={salvarItem} disabled={ro}
                className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50">
                {XEditingId ? "Salvar" : "Inserir"}
              </button>
              <button onClick={() => { setXEdit(null); setXEditingId(null); setXEditEstoque(null); setXDepEstoque({}); setXCodigo(""); }}
                className="text-sm px-3 py-1 rounded border border-border">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <DataGrid
        columns={cols}
        data={XItens}
        maxHeight="320px"
        selectedIdx={XSelectedIdx}
        onRowClick={(_r, i) => setXSelectedIdx(i)}
        onRowDoubleClick={(r) => editar(r as IMovimentoItem)}
        toolbarLeft={itensToolbar}
        showRecordCount={false}
        exportTitle="Itens do Pedido"
      />

      {/* Painel de Totais — 7 cards horizontais */}
      <div className="border border-border rounded p-3 bg-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: "Subtotal", value: T.vl_produto },
            { label: "Desc. (R$)", value: T.vl_desconto },
            { label: "Vlr. Frete", value: T.vl_frete },
            { label: "Vlr. Desp.", value: T.vl_despesa },
            { label: "Vlr. Seg.", value: T.vl_seguro },
            { label: "Vlr. Outros", value: T.vl_outro },
          ].map((c) => (
            <div key={c.label} className="flex flex-col border border-border rounded px-3 py-2 bg-secondary/40">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</span>
              <span className="text-base font-semibold text-right tabular-nums">{fmt(c.value)}</span>
            </div>
          ))}
          <div className="flex flex-col border border-primary/40 rounded px-3 py-2 bg-primary/10">
            <span className="text-xs uppercase tracking-wide text-primary/80">Total</span>
            <span className="text-lg font-bold text-primary text-right tabular-nums">{fmt(T.vl_movimento)}</span>
          </div>
        </div>
      </div>

      <ProdutoSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        onSelect={aplicarProduto}
      />
    </div>
  );
};

export default PedidoItensTab;
