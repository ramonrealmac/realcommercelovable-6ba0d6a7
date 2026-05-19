import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Search, Info, HelpCircle } from "lucide-react";
import type { IMovimento, IMovimentoItem } from "../pedido/types";
import ProdutoSearchDialog, { IProdutoRow, buscarProdutoPorCodigo } from "../pedido/ProdutoSearchDialog";

const db = supabase as any;

interface IDepositoLookup { deposito_id: number; nome: string; }

interface IProps {
  pedido: IMovimento | null;
  podeEditar: boolean;
  onItemsChanged?: () => void;
  autoNovoTrigger?: number;
}

const fmt = (v: number, dec = 2) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const fmtInput = (v: any, dec = 2) => {
  if (v === 0 || v === "0") return Number(0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (v === "" || v === undefined || v === null) return "";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  return String(v);
};

const parseNum = (v: any) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/\s/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export default function AjusteEstoqueItensTab({ pedido, podeEditar, onItemsChanged, autoNovoTrigger }: IProps) {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XItens, setXItens] = useState<IMovimentoItem[]>([]);
  const [XDepositos, setXDepositos] = useState<IDepositoLookup[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IMovimentoItem> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XEditEstoque, setXEditEstoque] = useState<{ disp: number; res: number } | null>(null);
  const [XCodigo, setXCodigo] = useState("");
  const [XDepEstoque, setXDepEstoque] = useState<Record<number, number>>({});
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  const lupaRef = useRef<HTMLButtonElement>(null);
  const qtdRef = useRef<HTMLInputElement>(null);

  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  const loadItens = useCallback(async () => {
    if (!pedido?.movimento_id) { setXItens([]); return; }
    const { data, error } = await db.from("movimento_item")
      .select("*")
      .eq("movimento_id", pedido.movimento_id)
      .eq("excluido", false)
      .order("movimento_item_id");
    
    if (error) { toast.error("Erro itens: " + error.message); return; }
    setXItens(data || []);
    onItemsChanged?.();
  }, [pedido?.movimento_id, onItemsChanged]);

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

  // Carregar depósitos disponíveis
  useEffect(() => {
    (async () => {
      const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
      const { data } = await db.from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado")
        .in("empresa_id", ids)
        .eq("excluido", false)
        .order("nome");
      
      const filtered = (data || []).filter((d: any) =>
        d.empresa_id === XEmpresaId || d.st_privado === false
      );
      setXDepositos(filtered);
    })();
  }, [XEmpresaId, XGroupEmpresaIds]);

  const carregarEstoquePorDeposito = useCallback(async (produto_id: number) => {
    const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
    const { data } = await db.from("estoque")
      .select("deposito_id, estoque_fisico")
      .eq("produto_id", produto_id)
      .in("empresa_id", ids)
      .eq("excluido", false);
    
    const map: Record<number, number> = {};
    for (const e of (data || []) as any[]) {
      map[e.deposito_id] = (map[e.deposito_id] || 0) + Number(e.estoque_fisico || 0);
    }
    setXDepEstoque(map);
  }, [XEmpresaId, XGroupEmpresaIds]);

  const novo = useCallback(() => {
    setXEditingId(null);
    setXEditEstoque(null);
    setXDepEstoque({});
    setXCodigo("");
    setXEdit({
      qt_movimento: 1,
      deposito_id: XDepositos[0]?.deposito_id ?? pedido?.deposito_id ?? 1,
      tp_ajs_estoque: "A", // Default: Adicionar
      infad_produto: "",
      vl_und_produto: 0,
      vl_produto: 0,
      vl_desconto: 0,
      vl_movimento: 0,
      vl_despesa: 0,
      vl_frete: 0,
      vl_seguro: 0,
      vl_outro: 0,
      entrega: "N",
    });
    setTimeout(() => codigoRef.current?.focus(), 50);
  }, [XDepositos, pedido?.deposito_id]);

  useEffect(() => {
    if (autoNovoTrigger && pedido?.movimento_id && podeEditar && !XEdit) {
      novo();
    }
  }, [autoNovoTrigger, pedido?.movimento_id, podeEditar, novo, XEdit]);

  const editar = (it: IMovimentoItem) => {
    if (!podeEditar) return;
    setXEdit({ ...it });
    setXEditingId(it.movimento_item_id);
    setXEditEstoque(null);
    setXCodigo(it.cd_produto || String(it.produto_id || ""));
    if (it.produto_id) carregarEstoquePorDeposito(it.produto_id);
  };

  const setF = (k: keyof IMovimentoItem, v: any) => {
    setXEdit(prev => ({ ...prev!, [k]: v }));
  };

  const handleBlur = (key: keyof IMovimentoItem, val: any, decimals = 4) => {
    const n = parseNum(val);
    setF(key, n);
  };

  const aplicarProduto = useCallback((p: IProdutoRow, deposito_id?: number) => {
    setXEdit(prev => ({
      ...(prev || {}),
      produto_id: p.produto_id,
      cd_produto: String(p.produto_id),
      nm_produto: p.nome,
      unidade_id: p.unidade_id,
      vl_und_produto: 0,
      vl_produto: 0,
      vl_desconto: 0,
      vl_movimento: 0,
      ...(deposito_id ? { deposito_id } : {}),
    }));
    setXEditEstoque({ disp: p.estoque_disponivel, res: p.estoque_reservado });
    setXCodigo(String(p.produto_id));
    carregarEstoquePorDeposito(p.produto_id);
    
    // Foco imediato na quantidade
    setTimeout(() => { qtdRef.current?.focus(); qtdRef.current?.select(); }, 80);
  }, [carregarEstoquePorDeposito]);

  const onCodigoBlur = async () => {
    const t = XCodigo.trim();
    if (!t) {
      setTimeout(() => lupaRef.current?.focus(), 30);
      return;
    }
    if (XEdit?.produto_id && (String(XEdit.produto_id) === t || XEdit.cd_produto === t)) {
      setTimeout(() => { qtdRef.current?.focus(); qtdRef.current?.select(); }, 30);
      return;
    }
    const p = await buscarProdutoPorCodigo(t, XEmpresaId, XGroupEmpresaIds);
    if (!p) { toast.error("Produto não encontrado."); return; }
    aplicarProduto(p);
  };

  const limparProduto = () => {
    setXEdit(prev => ({
      ...(prev || {}),
      produto_id: undefined,
      cd_produto: undefined,
      nm_produto: undefined,
      unidade_id: undefined,
    }));
    setXEditEstoque(null);
    setXDepEstoque({});
    setXCodigo("");
  };

  const salvarItem = async () => {
    if (!pedido?.movimento_id) { toast.error("Salve o cabeçalho do ajuste antes."); return; }
    if (!XEdit?.produto_id) { toast.error("Selecione o produto."); return; }
    const qt = parseNum(XEdit.qt_movimento);
    if (qt <= 0) { toast.error("Qtd. inválida."); return; }
    if (!XEdit.deposito_id) { toast.error("Selecione o depósito."); return; }
    if (!XEdit.tp_ajs_estoque) { toast.error("Selecione o tipo de ajuste."); return; }

    const payload = {
      ...XEdit,
      empresa_id: XEmpresaId,
      movimento_id: pedido.movimento_id,
      tp_movimento: "AE",
    };

    if (XEditingId) {
      const { error } = await db.from("movimento_item").update(payload).eq("movimento_item_id", XEditingId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await db.from("movimento_item").insert(payload);
      if (error) { toast.error(error.message); return; }
    }

    toast.success("Item do ajuste salvo.");
    const wasInsert = !XEditingId;
    setXEdit(null);
    setXEditingId(null);
    setXEditEstoque(null);
    setXDepEstoque({});
    setXCodigo("");
    await loadItens();
    
    // Inserção contínua automática se estiver editando
    if (wasInsert && podeEditar) {
      setTimeout(() => novo(), 100);
    }
  };

  const excluirItem = async (it: IMovimentoItem) => {
    if (!podeEditar) return;
    if (!confirm(`Deseja realmente remover o produto "${it.nm_produto}" deste ajuste?`)) return;
    const { error } = await db.from("movimento_item").update({ excluido: true }).eq("movimento_item_id", it.movimento_item_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removido.");
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

  const getTipoAjsLabel = (tp: string | null | undefined) => {
    if (tp === "A") return "➕ Adiciona";
    if (tp === "R") return "➖ Retira";
    if (tp === "M") return "✏️ Modifica";
    return "--";
  };

  const cols: IGridColumn[] = [
    { key: "cd_produto", label: "Código", width: "90px", align: "right", render: r => r.cd_produto || (r.produto_id ?? "") },
    { key: "nm_produto", label: "Produto", width: "3fr" },
    { key: "tp_ajs_estoque", label: "Tipo Ajuste", width: "120px", align: "center", render: r => getTipoAjsLabel(r.tp_ajs_estoque) },
    { key: "qt_movimento", label: "Quantidade", width: "100px", align: "right", render: r => fmt(r.qt_movimento, 4) },
    { key: "unidade_id", label: "Unidade", width: "80px", align: "center", render: r => r.unidade_id ?? "--" },
    { 
      key: "deposito_id", 
      label: "Depósito", 
      width: "1.5fr", 
      render: r => {
        const dep = XDepositos.find(d => d.deposito_id === r.deposito_id);
        return dep ? `${dep.deposito_id} - ${dep.nome}` : `Dep. ${r.deposito_id}`;
      } 
    },
    { key: "infad_produto", label: "Informações Adicionais / Justificativa", width: "2.5fr" },
  ];

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
      count={`${XItens.length} produto(s)`}
    />
  );

  if (!pedido?.movimento_id) {
    return <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-lg">Salve os dados básicos na aba Cadastro para liberar a inclusão de itens do ajuste.</div>;
  }

  return (
    <div className="space-y-4">
      {XEdit && (
        <div className="border border-border/80 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2 border-b border-border/50 pb-2">
            <Info className="w-4 h-4 text-cyan-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {XEditingId ? "Editar Item do Ajuste" : "Lançar Novo Item de Ajuste"}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-start">
            {/* Código / EAN */}
            <div className="col-span-12 sm:col-span-2">
              <label className="text-xs font-medium text-foreground/80">Código/EAN</label>
              <div className="flex gap-1.5 mt-1">
                <input
                  ref={codigoRef}
                  disabled={ro}
                  value={XCodigo}
                  onChange={e => setXCodigo(e.target.value)}
                  onBlur={onCodigoBlur}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
                  placeholder="Cód. ou EAN"
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-sm bg-background/50 focus:bg-background focus:ring-1 focus:ring-primary/30 outline-none"
                />
                <button ref={lupaRef} type="button" disabled={ro} onClick={() => setXSearchOpen(true)}
                  className="px-2.5 py-1.5 border border-border rounded-lg bg-background hover:bg-accent disabled:opacity-50 flex items-center justify-center transition-all"
                  title="Pesquisar produto">
                  <Search className="w-4 h-4" />
                </button>
                {XEdit.produto_id && !ro && (
                  <button type="button" onClick={limparProduto}
                    className="px-2 py-1.5 border border-border rounded-lg bg-background hover:bg-accent text-sm font-semibold transition-all"
                    title="Limpar produto">×</button>
                )}
              </div>
            </div>

            {/* Nome do Produto */}
            <div className="col-span-12 sm:col-span-4">
              <label className="text-xs font-medium text-foreground/80">Produto</label>
              <input readOnly tabIndex={-1} value={XEdit.nm_produto || ""}
                placeholder="Clique na lupa para selecionar o produto..."
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-secondary/30 text-muted-foreground outline-none" />
            </div>

            {/* Unidade */}
            <div className="col-span-12 sm:col-span-1">
              <label className="text-xs font-medium text-foreground/80">Und.</label>
              <input readOnly tabIndex={-1} value={XEdit.unidade_id ?? ""}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-secondary/30 text-center text-muted-foreground outline-none" />
            </div>

            {/* Tipo de Ajuste de Estoque */}
            <div className="col-span-12 sm:col-span-2">
              <label className="text-xs font-medium text-foreground/80 flex items-center gap-1">
                Tipo de Ajuste
                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" title="A = Adiciona ao físico, R = Retira do físico, M = Modifica/Força a quantidade atual no estoque" />
              </label>
              <select disabled={ro} value={XEdit.tp_ajs_estoque ?? ""}
                onChange={e => setF("tp_ajs_estoque", e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background/50 focus:bg-background outline-none font-medium">
                <option value="A">➕ Adiciona</option>
                <option value="R">➖ Retira</option>
                <option value="M">✏️ Modifica</option>
              </select>
            </div>

            {/* Quantidade */}
            <div className="col-span-12 sm:col-span-1.5">
              <label className="text-xs font-medium text-foreground/80">Quantidade</label>
              <input
                ref={qtdRef}
                type="text"
                disabled={ro}
                value={fmtInput(XEdit.qt_movimento, 4)}
                onChange={e => setF("qt_movimento", e.target.value)}
                onBlur={e => handleBlur("qt_movimento", e.target.value, 4)}
                onFocus={e => e.target.select()}
                className={`w-full border border-border rounded-lg px-3 py-1.5 text-sm text-right mt-1 bg-background/50 focus:bg-background outline-none font-semibold ${NO_SPIN}`}
              />
            </div>

            {/* Estoque Físico Atual de Referência */}
            <div className="col-span-12 sm:col-span-1.5">
              <label className="text-xs font-medium text-foreground/80">Físico Atual</label>
              <input readOnly tabIndex={-1} 
                value={XEdit.produto_id && XEdit.deposito_id ? fmt(XDepEstoque[XEdit.deposito_id] || 0, 4) : "--"}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm text-right mt-1 bg-secondary/30 text-muted-foreground outline-none font-semibold" />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3 items-end">
            {/* Depósito Selecionado */}
            <div className="col-span-12 sm:col-span-4">
              <label className="text-xs font-medium text-foreground/80">Depósito para Ajuste</label>
              <select disabled={ro} value={XEdit.deposito_id ?? ""}
                onChange={e => setF("deposito_id", Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background/50 focus:bg-background outline-none font-medium">
                <option value="">-- Selecione o Depósito --</option>
                {XDepositos.map(d => (
                  <option key={d.deposito_id} value={d.deposito_id}>
                    {d.deposito_id} - {d.nome} {XEdit.produto_id ? `(Físico: ${fmt(XDepEstoque[d.deposito_id] || 0, 4)})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Justificativa / Observação do Produto (PROMINENTE!) */}
            <div className="col-span-12 sm:col-span-6">
              <label className="text-xs font-semibold text-foreground/90">Informações Adicionais / Justificativa</label>
              <input
                disabled={ro}
                value={XEdit.infad_produto || ""}
                onChange={e => setF("infad_produto", e.target.value)}
                placeholder="Insira o motivo deste acerto físico (ex: avaria, quebra, acerto de balanço)..."
                className="w-full border border-border rounded-lg px-3 py-1.5 text-sm mt-1 bg-background/50 focus:bg-background outline-none focus:ring-1 focus:ring-primary/20"
              />
            </div>

            {/* Ações de Confirmar / Cancelar */}
            <div className="col-span-12 sm:col-span-2 flex gap-1.5">
              <button onClick={salvarItem} disabled={ro}
                className="w-full text-sm font-semibold py-1.5 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50">
                {XEditingId ? "Salvar" : "Lançar"}
              </button>
              <button onClick={() => { setXEdit(null); setXEditingId(null); setXEditEstoque(null); setXDepEstoque({}); setXCodigo(""); }}
                className="w-full text-sm font-semibold py-1.5 px-3 rounded-lg border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border border-border/60 rounded-xl overflow-hidden shadow-sm bg-card">
        <DataGrid
          columns={cols}
          data={XItens}
          maxHeight="360px"
          selectedIdx={XSelectedIdx}
          onRowClick={(_r, i) => setXSelectedIdx(i)}
          onRowDoubleClick={(r) => { if(podeEditar) editar(r as IMovimentoItem); }}
          toolbarLeft={itensToolbar}
          showRecordCount={false}
          exportTitle="Itens do Ajuste de Estoque"
        />
      </div>

      <ProdutoSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        onSelect={aplicarProduto}
      />
    </div>
  );
}
