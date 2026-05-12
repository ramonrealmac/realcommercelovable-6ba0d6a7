import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { LogOut, Search, Trash2, Plus, Receipt, RefreshCw, Settings, Wrench, Percent, ShoppingCart, Tag, CircleDollarSign } from "lucide-react";
import ProdutoSearchDialog, { buscarProdutoPorCodigo, IProdutoRow } from "../pedido/ProdutoSearchDialog";
import ClienteSearchDialog, { IClienteRow } from "../pedido/ClienteSearchDialog";
import VendedorSearchDialog, { IVendedorRow } from "./VendedorSearchDialog";
import PagamentoDialog from "./PagamentoDialog";
import ConfigurarDialog from "./ConfigurarDialog";
import OpcoesPagamentoDialog, { IImpressaoDados } from "./OpcoesPagamentoDialog";
import DescontoDialog from "./DescontoDialog";
import FuncoesDialog from "./FuncoesDialog";
import CancelamentoDialog from "./CancelamentoDialog";
import FechamentoCaixaForm from "./FechamentoCaixaForm";
import AberturaCaixaForm from "./AberturaCaixaForm";
import SuprimentoSangriaForm from "./SuprimentoSangriaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  IPdvCaixa, IPdvCaixaAbertura, IPdvParamsEmpresa, IPdvPedidoFechado,
  IPdvPagamentoLinha, IMovimentoPagamento,
} from "./types";

const db = supabase as any;
const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface IProps {
  caixa: IPdvCaixa;
  abertura: IPdvCaixaAbertura;
  dtMovimento: string;
  onSair: () => void;
}

interface ICartItem {
  produto_id: number;
  cd_produto: string;
  nm_produto: string;
  unidade_id: string | null;
  vl_unitario: number;
  qt_item: number;
  deposito_id: number | null;
}

// --- Sub-componente para linha do carrinho (gerencia estado local da quantidade para permitir decimais fluídos) ---
interface ICartItemRowProps {
  item: ICartItem;
  idx: number;
  XFonteProd: number;
  alterarQt: (idx: number, delta: number) => void;
  setQt: (idx: number, val: string) => void;
  removerItem: (idx: number) => void;
}

const CartItemRow: React.FC<ICartItemRowProps> = ({ item, idx, XFonteProd, alterarQt, setQt, removerItem }) => {
  const [localVal, setLocalVal] = useState(item.qt_item.toString().replace(".", ","));

  // Sincroniza localVal quando a prop item.qt_item muda externamente (ex: pelos botões + ou -)
  useEffect(() => {
    setLocalVal(item.qt_item.toString().replace(".", ","));
  }, [item.qt_item]);

  const handleChange = (v: string) => {
    setLocalVal(v);
    const n = parseFloat(v.replace(",", "."));
    if (!isNaN(n)) {
      setQt(idx, v);
    }
  };

  return (
      <div className={`px-3 py-2 flex items-center gap-2 border-b border-border ${idx % 2 ? "bg-muted/40" : ""}`}>
      <div className="flex-1">
        <div className="font-medium truncate text-blue-700 dark:text-blue-400">{item.nm_produto}</div>
        <div className="text-muted-foreground" style={{ fontSize: `${XFonteProd - 1}px` }}>
          {item.qt_item.toLocaleString("pt-BR")} {item.unidade_id || ""} × R$ {item.vl_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">R$ {(item.qt_item * item.vl_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div className="hidden md:flex items-center gap-1">
        <button onClick={() => alterarQt(idx, -1)} className="px-2 py-0.5 border border-border rounded hover:bg-accent">−</button>
        <input 
          type="text" 
          value={localVal}
          onChange={(e) => handleChange(e.target.value)}
          className="w-16 text-center border border-border rounded py-0.5 text-xs bg-white text-black font-bold focus:border-blue-400 outline-none"
        />
        <button onClick={() => alterarQt(idx, +1)} className="px-2 py-0.5 border border-border rounded hover:bg-accent">+</button>
        <button onClick={() => removerItem(idx)} className="p-1 text-destructive hover:bg-destructive/10 rounded">
          <Trash2 size={14} />
        </button>
      </div>
      <button onClick={() => removerItem(idx)} className="md:hidden p-1 text-destructive hover:bg-destructive/10 rounded">
        <Trash2 size={14} />
      </button>
    </div>
  );
};

const PdvTela: React.FC<IProps> = ({ caixa, abertura, dtMovimento, onSair }) => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XParams, setXParams] = useState<IPdvParamsEmpresa | null>(null);

  // Permissões do caixa
  const XPodeInfVend = caixa.caixa_inf_vend === "S";
  const XPodeCancVenda = caixa.caixa_cnc_venda === "S";

  // Configurações por funcionário
  const [XFontePed, setXFontePed] = useState<number>(caixa.tamanho_fonte_pedidos || 12);
  const [XFonteProd, setXFonteProd] = useState<number>(caixa.tamanho_fonte_produtos || 12);
  const [XRefreshSeg, setXRefreshSeg] = useState<number>(caixa.tempo_refresh_pdv || 30);
  const [XOpenConfig, setXOpenConfig] = useState(false);
  const [XOpenFuncoes, setXOpenFuncoes] = useState(false);
  const [XOpenCanc, setXOpenCanc] = useState(false);
  const [XOpenFech, setXOpenFech] = useState(false);
  const [XOpenAbert, setXOpenAbert] = useState(false);
  const [XOpenSupr, setXOpenSupr] = useState(false);
  const [XOpenSang, setXOpenSang] = useState(false);

  // Pedidos fechados disponíveis
  const [XPedidos, setXPedidos] = useState<IPdvPedidoFechado[]>([]);
  const [XPedidoSel, setXPedidoSel] = useState<IPdvPedidoFechado | null>(null);
  const [XPedidoSelItens, setXPedidoSelItens] = useState<any[]>([]);
  const [XBuscaPedido, setXBuscaPedido] = useState("");

  // Venda direta - carrinho
  const [XCart, setXCart] = useState<ICartItem[]>([]);
  const [XCliente, setXCliente] = useState<IClienteRow | null>(null);
  const [XVendedor, setXVendedor] = useState<IVendedorRow | null>(null);
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XOpenProduto, setXOpenProduto] = useState(false);
  const [XOpenCliente, setXOpenCliente] = useState(false);
  const [XOpenVend, setXOpenVend] = useState(false);

  // Desconto
  const [XVlDesc, setXVlDesc] = useState(0);
  const [XPcDesc, setXPcDesc] = useState(0);
  const [XOpenDesc, setXOpenDesc] = useState(false);

  // Fluxo de finalização
  const [XOpenOpcoes, setXOpenOpcoes] = useState(false);
  const [XOpenPagto, setXOpenPagto] = useState(false);
  const [XPagtosPedido, setXPagtosPedido] = useState<IMovimentoPagamento[]>([]);
  const [XImpressaoDados, setXImpressaoDados] = useState<IImpressaoDados | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const pedidoSearchRef = useRef<HTMLInputElement>(null);
  const [XShowAtalhos, setXShowAtalhos] = useState(false);

  // Carrega pedidos fechados
  const carregarPedidos = useCallback(async () => {
    const { data, error } = await db.from("movimento")
      .select("movimento_id, nr_movimento, cadastro_id, vl_movimento, dt_emissao, funcionario_id")
      .eq("empresa_id", XEmpresaId)
      .eq("st_pedido", "F")
      .eq("excluido", false)
      .order("movimento_id", { ascending: false })
      .limit(200);
    if (error) { toast.error(error.message); return; }

    const cadIds = Array.from(new Set((data || []).map((m: any) => m.cadastro_id).filter(Boolean)));
    const funcIds = Array.from(new Set((data || []).map((m: any) => m.funcionario_id).filter(Boolean)));
    const [cadRes, funcRes] = await Promise.all([
      cadIds.length
        ? db.from("cadastro").select("cadastro_id, razao_social, nome_fantasia").in("cadastro_id", cadIds)
        : Promise.resolve({ data: [] }),
      funcIds.length
        ? db.from("funcionario").select("funcionario_id, nome").in("funcionario_id", funcIds)
        : Promise.resolve({ data: [] }),
    ]);
    const cadMap: Record<number, string> = {};
    for (const c of (cadRes.data || []) as any[]) cadMap[c.cadastro_id] = c.nome_fantasia || c.razao_social;
    const funcMap: Record<number, string> = {};
    for (const f of (funcRes.data || []) as any[]) funcMap[f.funcionario_id] = f.nome || "";

    setXPedidos(((data || []) as any[]).map(m => ({
      movimento_id: m.movimento_id,
      nr_movimento: m.nr_movimento,
      cadastro_id: m.cadastro_id,
      cliente_nome: cadMap[m.cadastro_id] || "(Consumidor)",
      vendedor_id: m.funcionario_id,
      vendedor_nome: funcMap[m.funcionario_id] || "",
      vl_movimento: Number(m.vl_movimento || 0),
      dt_emissao: m.dt_emissao,
    })));
  }, [XEmpresaId]);

  // Subtotal e lógica de recebimento necessária para finalizarVenda
  const subtotal = XCart.reduce((a, c) => a + c.qt_item * c.vl_unitario, 0);
  const baseSubtotal = XPedidoSel ? XPedidoSel.vl_movimento : subtotal;
  const vlDescAplicado = XPedidoSel ? 0 : XVlDesc;
  const totalReceber = Number(Math.max(0, baseSubtotal - vlDescAplicado).toFixed(2));
  const podeReceber = (XPedidoSel != null) || (XCart.length > 0);

  // ===== Finalizar venda =====
  const finalizarVenda = useCallback(async () => {
    if (!podeReceber) { toast.error("Selecione um pedido ou adicione itens à venda direta."); return; }
    if (!XParams) { toast.error("Parâmetros da empresa não carregados."); return; }

    let pagtos: IMovimentoPagamento[] = [];
    if (XPedidoSel) {
      const { data } = await db.from("movimento_pagamento")
        .select("movimento_pagamento_id, condicao_id, vl_pagamento, numero_autorizacao, bandeira_id, operadora_id, n_parcelas")
        .eq("movimento_id", XPedidoSel.movimento_id)
        .eq("excluido", false);
      pagtos = (data || []) as IMovimentoPagamento[];
    }
    setXPagtosPedido(pagtos);
    setXOpenPagto(true);
  }, [podeReceber, XParams, XPedidoSel]);

  // ===== Atalhos de teclado =====
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
          break;
        case 'F3':
          e.preventDefault();
          if (!XPedidoSel) setXOpenCliente(true);
          break;
        case 'F4':
          e.preventDefault();
          if (!XPedidoSel && XPodeInfVend) setXOpenVend(true);
          break;
        case 'F5':
          e.preventDefault();
          carregarPedidos();
          toast.info('Lista de pedidos atualizada.');
          break;
        case 'F6':
          e.preventDefault();
          if (!XPedidoSel && XCart.length > 0) setXOpenDesc(true);
          break;
        case 'F9':
          e.preventDefault();
          finalizarVenda();
          break;
        case 'F1':
          e.preventDefault();
          setXShowAtalhos(prev => !prev);
          break;
        case 'Escape':
          e.preventDefault();
          if (XPedidoSel) setXPedidoSel(null);
          break;
        case 'Delete':
          if (!isInput && XCart.length > 0) {
            e.preventDefault();
            setXCart(prev => prev.slice(0, -1));
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [XPedidoSel, XPodeInfVend, XCart, XOpenDesc, finalizarVenda, carregarPedidos]);

  useEffect(() => { carregarPedidos(); }, [carregarPedidos]);

  // Refresh automático
  useEffect(() => {
    const seg = Math.max(5, Math.min(99999, XRefreshSeg || 30));
    const id = setInterval(() => { carregarPedidos(); }, seg * 1000);
    return () => clearInterval(id);
  }, [XRefreshSeg, carregarPedidos]);

  // Auto-foco inteligente
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!XPedidoSel) {
        searchRef.current?.focus();
      } else {
        pedidoSearchRef.current?.focus();
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [XPedidoSel, XOpenProduto, XOpenCliente, XOpenVend, XOpenPagto, XOpenConfig]);

  // Carrega itens do pedido selecionado
  useEffect(() => {
    if (!XPedidoSel) { setXPedidoSelItens([]); return; }
    (async () => {
      const { data } = await db.from("movimento_item")
        .select("movimento_item_id, produto_id, nm_produto, qt_movimento, vl_und_produto, vl_movimento, unidade_id")
        .eq("movimento_id", XPedidoSel.movimento_id)
        .eq("excluido", false)
        .order("movimento_item_id");
      setXPedidoSelItens(data || []);
    })();
  }, [XPedidoSel]);

  // Lista filtrada
  const XPedidosFilt = useMemo(() => {
    const t = XBuscaPedido.trim().toLowerCase();
    if (!t) return XPedidos;
    return XPedidos.filter(p =>
      String(p.nr_movimento || p.movimento_id).toLowerCase().includes(t) ||
      (p.cliente_nome || "").toLowerCase().includes(t) ||
      (p.vendedor_nome || "").toLowerCase().includes(t)
    );
  }, [XPedidos, XBuscaPedido]);

  // ===== Venda direta =====
  const adicionarProdutoAoCarrinho = (p: IProdutoRow, depositoId?: number) => {
    setXCart(prev => {
      const idx = prev.findIndex(c => c.produto_id === p.produto_id);
      if (idx >= 0) {
        const cp = [...prev];
        cp[idx] = { ...cp[idx], qt_item: cp[idx].qt_item + 1 };
        return cp;
      }
      const preco = p.st_promo && p.preco_promocional > 0 ? p.preco_promocional : p.preco_venda;
      return [...prev, {
        produto_id: p.produto_id,
        cd_produto: String(p.produto_id),
        nm_produto: p.nome,
        unidade_id: p.unidade_id,
        vl_unitario: preco,
        qt_item: 1,
        deposito_id: depositoId || XParams?.deposito_estoque_caixa || null,
      }];
    });
    setXSearchTerm("");
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const buscarTermo = async () => {
    const t = XSearchTerm.trim();
    if (!t) { setXOpenProduto(true); return; }
    const XGroupIds = XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
    const p = await buscarProdutoPorCodigo(t, XEmpresaId, XGroupIds);
    if (p) adicionarProdutoAoCarrinho(p);
    else { toast.error("Produto não encontrado. Use a pesquisa avançada."); setXOpenProduto(true); }
  };

  const alterarQt = (idx: number, delta: number) => {
    setXCart(prev => prev.map((c, i) => i === idx ? { ...c, qt_item: Math.max(0.001, c.qt_item + delta) } : c));
  };

  const setQt = (idx: number, val: string) => {
    const s = val.replace(",", ".");
    const n = parseFloat(s);
    if (isNaN(n)) return;
    setXCart(prev => prev.map((c, i) => i === idx ? { ...c, qt_item: n } : c));
  };

  const removerItem = (idx: number) => setXCart(prev => prev.filter((_, i) => i !== idx));

  // Carrega parametros da empresa
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const { data, error } = await db.from("empresa")
        .select("tp_operacao_caixa, conta_gerencial_caixa, centro_custo_caixa, deposito_estoque_caixa, imagem_caixa")
        .eq("empresa_id", XEmpresaId).maybeSingle();
      if (error) { toast.error(error.message); return; }
      setXParams(data as IPdvParamsEmpresa);
    })();
  }, [XEmpresaId]);

  // Carrega cliente padrão das configurações fiscais
  const carregarClientePadrao = useCallback(async () => {
    if (!XEmpresaId) return;
    const { data: fConfig } = await db.from("fiscal_config")
      .select("cliente_padrao_id")
      .eq("empresa_id", XEmpresaId)
      .maybeSingle();

    if (fConfig?.cliente_padrao_id) {
      const { data: cliente } = await db.from("cadastro")
        .select("*")
        .eq("cadastro_id", fConfig.cliente_padrao_id)
        .maybeSingle();
      if (cliente) {
        setXCliente(cliente as IClienteRow);
      }
    }
  }, [XEmpresaId]);

  useEffect(() => { carregarClientePadrao(); }, [carregarClientePadrao]);

  /** Cria movimento (st_pedido='F') quando for venda direta. */
  const criarMovimentoVendaDireta = async (): Promise<{ movimento_id: number; nr: number; total: number; }> => {
    const { data: maxMov } = await db.from("movimento")
      .select("movimento_id").order("movimento_id", { ascending: false }).limit(1);
    const movId = ((maxMov && maxMov[0]?.movimento_id) || 0) + 1;
    const { data: maxNr } = await db.from("movimento")
      .select("nr_movimento").eq("empresa_id", XEmpresaId).order("nr_movimento", { ascending: false }).limit(1);
    const nr = ((maxNr && maxNr[0]?.nr_movimento) || 0) + 1;
    const total = totalReceber;

    const mov = {
      movimento_id: movId,
      empresa_id: XEmpresaId,
      cadastro_id: XCliente?.cadastro_id || null,
      funcionario_id: XVendedor?.cadastro_id || caixa.funcionario_id,
      nr_movimento: nr,
      tp_movimento: "S",
      tp_origem: "PDV",
      st_pedido: "F",
      faturado: "N",
      dt_emissao: new Date().toISOString(),
      dt_finalizacao: new Date().toISOString(),
      tp_operacao_id: XParams!.tp_operacao_caixa,
      tp_desconto: vlDescAplicado > 0 ? "V" : "N",
      vl_desconto: vlDescAplicado,
      pc_desconto: XPcDesc,
      deposito_id: XParams!.deposito_estoque_caixa,
      excluido: false,
    };
    const { error } = await db.from("movimento").insert(mov);
    if (error) throw new Error("Falha ao criar venda: " + error.message);

    const { data: maxIt } = await db.from("movimento_item")
      .select("movimento_item_id").order("movimento_item_id", { ascending: false }).limit(1);
    let nextItId = ((maxIt && maxIt[0]?.movimento_item_id) || 0) + 1;
    const itens = XCart.map(c => ({
      movimento_item_id: nextItId++,
      empresa_id: XEmpresaId,
      movimento_id: movId,
      produto_id: c.produto_id,
      nm_produto: c.nm_produto,
      unidade_id: c.unidade_id,
      tp_movimento: "S",
      qt_movimento: c.qt_item,
      vl_und_produto: c.vl_unitario,
      deposito_id: c.deposito_id,
      excluido: false,
    }));
    if (itens.length > 0) {
      const { error: e2 } = await db.from("movimento_item").insert(itens);
      if (e2) throw new Error("Falha ao criar itens: " + e2.message);
    }
    return { movimento_id: movId, nr, total };
  };

  /** Confirmação do pagamento: grava caixa_movimento + itens + status R, então abre Documento da Venda. */
  const confirmarPagamento = async (linhas: IPdvPagamentoLinha[]) => {
    const tId = toast.loading("Processando recebimento...");
    console.log("[PdvTela] confirmarPagamento iniciado com linhas:", linhas);
    try {
      let movimentoId: number;
      let nrMov: number;
      let total: number;

      if (XPedidoSel) {
        console.log("[PdvTela] Finalizando pedido existente:", XPedidoSel.movimento_id);
        movimentoId = XPedidoSel.movimento_id;
        nrMov = XPedidoSel.nr_movimento || movimentoId;
        total = XPedidoSel.vl_movimento;
        console.log("[PdvTela] Deletando pagamentos antigos de movimento:", movimentoId);
        const { error: eDel } = await db.from("movimento_pagamento").delete().eq("movimento_id", movimentoId);
        if (eDel) console.warn("[PdvTela] Aviso: Erro ao deletar pagamentos antigos:", eDel.message);
      } else {
        console.log("[PdvTela] Criando nova venda direta...");
        const novo = await criarMovimentoVendaDireta();
        if (!novo) throw new Error("Falha ao criar cabeçalho do movimento.");
        movimentoId = novo.movimento_id;
        nrMov = novo.nr;
        total = novo.total;
        console.log("[PdvTela] Venda direta criada. ID:", movimentoId, "NR:", nrMov, "Total:", total);
      }

      console.log("[PdvTela] Inserindo novos pagamentos de movimento...");
      const pagtos = linhas.map(l => ({
        empresa_id: XEmpresaId,
        movimento_id: movimentoId,
        condicao_id: l.condicao_id,
        tp_pagamento: l.condicao_descricao,
        vl_pagamento: l.vl_recebido,
        nr_autorizacao: l.numero_autoriza || "",
        bandeira_id: l.bandeira_id,
        operadora_id: l.operadora_id,
        n_parcelas: l.qt_parcela,
        dt_pagamento: new Date().toISOString()
      }));
      const { error: ePag } = await db.from("movimento_pagamento").insert(pagtos);
      if (ePag) throw new Error("Falha ao gravar pagamentos: " + ePag.message);

      const totalRecebidoSomado = Number(linhas.reduce((acc, l) => acc + Number(l.vl_recebido || 0), 0).toFixed(2));
      const valorTroco = Math.max(0, totalRecebidoSomado - total);
      console.log("[PdvTela] Total:", total, "Recebido:", totalRecebidoSomado, "Troco:", valorTroco);
      
      let linhasAjustadas = [...linhas];
      if (valorTroco > 0) {
        const idxDinheiro = linhasAjustadas.findIndex(l => l.meio_pagamento_id === 1);
        if (idxDinheiro === -1) {
          throw new Error("Para haver troco, é necessário um pagamento em Dinheiro.");
        }
        const vlrAtu = Number(linhasAjustadas[idxDinheiro].vl_recebido || 0);
        const novoVlr = Number((vlrAtu - valorTroco).toFixed(2));
        if (novoVlr < 0) {
          throw new Error("Valor em dinheiro insuficiente para o troco.");
        }
        linhasAjustadas[idxDinheiro] = {
          ...linhasAjustadas[idxDinheiro],
          vl_recebido: novoVlr,
          vl_parcela: Number((novoVlr / (linhasAjustadas[idxDinheiro].qt_parcela || 1)).toFixed(2))
        };
      }

      const { data: maxCx } = await db.from("caixa_movimento")
        .select("caixa_movimento_id").order("caixa_movimento_id", { ascending: false }).limit(1);
      const cxId = ((maxCx && maxCx[0]?.caixa_movimento_id) || 0) + 1;

      const cm = {
        caixa_movimento_id: cxId,
        empresa_id: XEmpresaId,
        caixa_abertura_id: abertura.caixa_abertura_id,
        funcionario_id: caixa.funcionario_id,
        colaborador_id: caixa.funcionario_id,
        dt_movimento: dtMovimento,
        tp_movimento: "E",
        tp_operacao: String(XParams!.tp_operacao_caixa),
        centro_custo_id: XParams!.centro_custo_caixa,
        historico: `Recebimento Pedido ${nrMov}`,
        documento: String(nrMov),
        vl_movimento: total,
        vl_troco: valorTroco,
        movimento_id: movimentoId,
        excluido: false,
      };
      const { error: e1 } = await db.from("caixa_movimento").insert(cm);
      if (e1) throw new Error("Falha ao gravar caixa_movimento: " + e1.message);

      const { data: maxCxIt } = await db.from("caixa_movimento_item")
        .select("caixa_movimento_item_id").order("caixa_movimento_item_id", { ascending: false }).limit(1);
      let nextCxIt = ((maxCxIt && maxCxIt[0]?.caixa_movimento_item_id) || 0) + 1;
      const itensCx = linhasAjustadas.map(l => ({
        caixa_movimento_item_id: nextCxIt++,
        caixa_movimento_id: cxId,
        empresa_id: XEmpresaId,
        condicao_id: l.condicao_id,
        prazo_pagamento_id: 0,
        bandeira_id: l.bandeira_id || 0,
        operadora_id: l.operadora_id || 0,
        numero_autoriza: l.numero_autoriza || "",
        qt_parcela: l.qt_parcela,
        vl_parcela: l.vl_parcela,
        vl_recebido: l.vl_recebido,
        plano_conta_id: (l as any).plano_conta_id || null,
        meio_pagamento_id: (l as any).meio_pagamento_id ?? null,
        excluido: false,
      }));
      console.log("[PdvTela] Gravando", itensCx.length, "itens no caixa_movimento_item...");
      const { error: e2 } = await db.from("caixa_movimento_item").insert(itensCx);
      if (e2) throw new Error("Falha ao gravar formas de pagamento no caixa: " + e2.message);

      // ===== Atualiza vl_fechamento da caixa_abertura com os meios que somam ao caixa =====
      try {
        const meioIds = Array.from(new Set(
          itensCx.map(i => i.meio_pagamento_id).filter((v): v is number => v != null)
        ));
        if (meioIds.length > 0) {
          const { data: meios } = await db.from("meio_pagamento")
            .select("meio_pagamento_id, soma_vl_caixa")
            .in("meio_pagamento_id", meioIds);
          const somamSet = new Set(
            ((meios || []) as any[])
              .filter(m => String(m.soma_vl_caixa || "").toUpperCase() === "S")
              .map(m => m.meio_pagamento_id)
          );
          const vlSomar = itensCx.reduce(
            (acc, i) => acc + (i.meio_pagamento_id != null && somamSet.has(i.meio_pagamento_id) ? Number(i.vl_recebido || 0) : 0),
            0
          );
          if (vlSomar > 0) {
            const novoVlFechamento = Number(abertura.vl_fechamento || 0) + vlSomar;
            const { error: eAb } = await db.from("caixa_abertura")
              .update({ vl_fechamento: novoVlFechamento })
              .eq("empresa_id", abertura.empresa_id)
              .eq("funcionario_id", abertura.funcionario_id)
              .eq("dt_abertura", abertura.dt_abertura);
            if (eAb) throw new Error(eAb.message);
            abertura.vl_fechamento = novoVlFechamento;
          }
        }
      } catch (errCx: any) {
        toast.error("Aviso: falha ao atualizar valor de fechamento do caixa: " + (errCx.message || errCx));
      }

      const { error: e3 } = await db.from("movimento")
        .update({ st_pedido: "R", dt_pagamento: new Date().toISOString() })
        .eq("movimento_id", movimentoId);
      if (e3) throw new Error("Falha ao baixar pedido: " + e3.message);


      // Monta dados de impressão para o próximo dialog
      const itensImp = XPedidoSel
        ? XPedidoSelItens.map((it: any) => ({
            nm_produto: it.nm_produto,
            qt_movimento: Number(it.qt_movimento || 0),
            unidade_id: it.unidade_id,
            vl_und_produto: Number(it.vl_und_produto || 0),
            vl_movimento: Number(it.vl_movimento || it.qt_movimento * it.vl_und_produto || 0),
          }))
        : XCart.map(c => ({
            nm_produto: c.nm_produto,
            qt_movimento: c.qt_item,
            unidade_id: c.unidade_id,
            vl_und_produto: c.vl_unitario,
            vl_movimento: c.qt_item * c.vl_unitario,
          }));
      setXImpressaoDados({
        movimento_id: movimentoId,
        nr_movimento: nrMov,
        cliente_nome: XPedidoSel ? XPedidoSel.cliente_nome : (XCliente?.nome_fantasia || XCliente?.razao_social || "(Consumidor)"),
        cliente_id: XPedidoSel ? XPedidoSel.cadastro_id : (XCliente?.cadastro_id || null),
        caixa_nome: caixa.nome,
        dt_movimento: new Date(dtMovimento + "T00:00:00").toLocaleDateString("pt-BR"),
        itens: itensImp,
        total,
      });

      toast.success(`Pedido ${nrMov} recebido com sucesso.`, { id: tId });
      setXOpenPagto(false);
      setXOpenOpcoes(true);
    } catch (err: any) {
      console.error("[PdvTela] Erro fatal em confirmarPagamento:", err);
      toast.error(err.message || "Erro ao finalizar.", { id: tId });
    }
  };

  const concluirVenda = () => {
    setXOpenOpcoes(false);
    setXPedidoSel(null);
    setXCart([]);
    setXCliente(null);
    carregarClientePadrao();
    setXVendedor(null);
    setXVlDesc(0);
    setXPcDesc(0);
    setXPagtosPedido([]);
    setXImpressaoDados(null);
    carregarPedidos();
  };

  // Cores dos painéis (usando o token do menu/sidebar)
  const painelBg = "bg-sidebar/30 dark:bg-sidebar/40";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-semibold text-primary">PDV</span>
          <span className="text-muted-foreground">Caixa: <strong className="text-blue-600 dark:text-blue-400">{caixa.nome}</strong></span>
          <span className="text-muted-foreground">Data: <strong className="text-foreground">{new Date(dtMovimento + "T00:00:00").toLocaleDateString("pt-BR")}</strong></span>
          <span className="text-muted-foreground">Abertura #<strong className="text-foreground">{abertura.caixa_abertura_id}</strong></span>
          {caixa.nfe_nome && (
            <span className="text-muted-foreground whitespace-nowrap">NF-e: <strong className="text-amber-600 dark:text-amber-400">{caixa.nfe_nome}</strong></span>
          )}
          {caixa.nfce_nome && (
            <span className="text-muted-foreground whitespace-nowrap">NFC-e: <strong className="text-amber-600 dark:text-amber-400">{caixa.nfce_nome}</strong></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setXOpenFuncoes(true)}
            className="text-sm px-3 py-1 rounded border border-amber-400 text-amber-700 dark:text-amber-400 flex items-center gap-1 hover:bg-amber-50 dark:hover:bg-amber-950/30">
            <Wrench size={14} /> Funções
          </button>
          <button onClick={() => setXOpenConfig(true)}
            className="text-sm px-3 py-1 rounded border border-border flex items-center gap-1 hover:bg-accent">
            <Settings size={14} /> Configurar
          </button>
          <button onClick={onSair}
            className="text-sm px-3 py-1 rounded border border-rose-300 text-rose-700 dark:text-rose-400 flex items-center gap-1 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth gap-0 p-0 md:grid md:grid-cols-12 md:gap-3 md:p-3 md:overflow-hidden">
        {/* Coluna esquerda: Venda direta OU detalhes do pedido (mobile = 100vw, desktop = col-span-8) */}
        <div className={`w-screen shrink-0 snap-start p-3 md:p-0 md:w-auto md:shrink md:col-span-8 flex flex-col border border-border rounded ${painelBg} overflow-hidden`}>
          <div className="relative px-3 py-2 border-b border-border flex items-center justify-center bg-topbar">
            <span className="text-sm font-bold text-topbar-foreground opacity-70 uppercase tracking-wider">
              {XPedidoSel ? `Itens do Pedido Nº ${XPedidoSel.nr_movimento || XPedidoSel.movimento_id}` : "Venda Direta"}
            </span>
            {XPedidoSel && (
              <button onClick={() => setXPedidoSel(null)} className="absolute right-3 text-[10px] text-topbar-foreground/50 hover:text-topbar-foreground transition-colors">
                ← VOLTAR
              </button>
            )}
          </div>

          {!XPedidoSel && (
            <div className="px-3 py-2 border-b border-border flex gap-2 bg-card">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input ref={searchRef} value={XSearchTerm} onChange={e => setXSearchTerm(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") buscarTermo(); }}
                  placeholder="Código, GTIN ou nome do produto... (Enter)"
                  className="w-full pl-8 pr-2 py-1.5 border border-border rounded text-sm bg-white text-black" />
              </div>
              <button onClick={() => setXOpenProduto(true)}
                className="text-sm px-3 py-1.5 rounded border border-blue-400 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1">
                <Plus size={14} /> Pesquisar
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto relative bg-background" style={{ fontSize: `${XFonteProd}px` }}>
            {XPedidoSel ? (
              <div>
                {XPedidoSelItens.map((it: any, idx: number) => (
                  <div key={it.movimento_item_id}
                    className={`px-3 py-2 border-b border-border ${idx % 2 ? "bg-muted/40" : ""}`}>
                    <div className="flex-1">
                      <div className="font-medium truncate text-blue-700 dark:text-blue-400">{it.nm_produto}</div>
                      <div className="text-muted-foreground" style={{ fontSize: `${XFonteProd - 1}px` }}>
                        {fmt(Number(it.qt_movimento))} {it.unidade_id || ""} × R$ {fmt(Number(it.vl_und_produto))} = <span className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">R$ {fmt(Number(it.vl_movimento || it.qt_movimento * it.vl_und_produto))}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {XPedidoSelItens.length === 0 && (
                  <div className="p-4 text-xs text-muted-foreground text-center">Sem itens.</div>
                )}
              </div>
            ) : (
              <>
                {XCart.length === 0 && XParams?.imagem_caixa && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img src={XParams.imagem_caixa} alt="" className="max-w-[70%] max-h-[70%] object-contain opacity-65" />
                  </div>
                )}
                <div className="relative">
                  {XCart.length === 0 && !XParams?.imagem_caixa && (
                    <div className="p-4 text-xs text-muted-foreground text-center">Bipagem ou pesquisa para incluir itens.</div>
                  )}
                {XCart.map((c, idx) => (
                  <CartItemRow 
                    key={`${idx}-${c.produto_id}`}
                    item={c} 
                    idx={idx} 
                    XFonteProd={XFonteProd} 
                    alterarQt={alterarQt} 
                    setQt={setQt} 
                    removerItem={removerItem} 
                  />
                ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Coluna direita: Pedidos a Receber (topo) + Resumo (rodapé) — mobile = 100vw, desktop = col-span-4 */}
        <div className="w-screen shrink-0 snap-start p-3 md:p-0 md:w-auto md:shrink md:col-span-4 flex flex-col gap-3 overflow-hidden">
          {/* Pedidos a Receber */}
          <div className={`flex-1 flex flex-col border border-border rounded ${painelBg} overflow-hidden min-h-0`}>
            <div className="relative px-3 py-2 border-b border-border flex items-center justify-center bg-topbar">
              <span className="text-sm font-bold text-topbar-foreground opacity-70 uppercase tracking-wider">Pedidos a Receber</span>
              <button onClick={carregarPedidos} title="Atualizar" className="absolute right-3 p-1 rounded hover:bg-white/10 text-topbar-foreground/70 transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="px-2 py-1.5 border-b border-border bg-card">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  ref={pedidoSearchRef}
                  value={XBuscaPedido}
                  onChange={(e) => setXBuscaPedido(e.target.value)}
                  placeholder="Cliente, vendedor ou nº..."
                  className="w-full pl-7 pr-2 py-1 border border-border rounded text-xs bg-white text-black"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-card" style={{ fontSize: `${XFontePed}px` }}>
              {XPedidosFilt.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  {XPedidos.length === 0 ? "Nenhum pedido fechado." : "Nenhum resultado para a busca."}
                </div>
              )}
              {XPedidosFilt.map((p, idx) => {
                const sel = XPedidoSel?.movimento_id === p.movimento_id;
                return (
                  <button key={p.movimento_id}
                    onClick={() => { setXPedidoSel(p); setXCart([]); }}
                    className={`w-full text-left px-3 py-1.5 border-b border-border
                      ${idx % 2 ? "bg-muted/40" : ""}
                      ${sel ? "!bg-primary/15" : "hover:bg-accent/50"}`}>
                    {/* Linha 1: Nº + Cliente */}
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="font-bold text-foreground shrink-0">#{p.nr_movimento || p.movimento_id}</span>
                      <span className="text-blue-600 dark:text-blue-400 font-semibold truncate flex-1">{p.cliente_nome}</span>
                    </div>
                    {/* Linha 2: Vendedor + total */}
                    <div className="flex justify-between items-baseline gap-2" style={{ fontSize: `${Math.max(10, XFontePed - 1)}px` }}>
                      <span className="text-emerald-600 dark:text-emerald-400 italic truncate flex-1">
                        Vend. {p.vendedor_nome || "—"}
                      </span>
                      <span className="font-mono font-semibold text-amber-700 dark:text-amber-400 shrink-0">R$ {fmt(p.vl_movimento)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumo */}
          <div className={`flex flex-col border border-border rounded ${painelBg} overflow-hidden`}>
            <div className="px-3 py-2 border-b border-border text-sm font-bold bg-topbar text-topbar-foreground opacity-70 uppercase tracking-wider text-center">Resumo</div>
            <div className="p-3 space-y-2 bg-card">
              {!XPedidoSel && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Cliente</label>
                    <div className="flex gap-1">
                      <div className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-white text-black truncate">
                        {XCliente ? (XCliente.nome_fantasia || XCliente.razao_social) : "(Consumidor)"}
                      </div>
                      <button onClick={() => setXOpenCliente(true)} className="px-2 border border-border rounded hover:bg-accent">
                        <Search size={14} />
                      </button>
                      {XCliente && (
                        <button onClick={() => setXCliente(null)} className="px-2 border border-border rounded text-destructive hover:bg-destructive/10">
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {XPodeInfVend && (
                    <div>
                      <label className="text-xs text-muted-foreground">Vendedor</label>
                      <div className="flex gap-1">
                        <div className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-white text-black truncate italic">
                          {XVendedor ? (XVendedor.nome_fantasia || XVendedor.razao_social) : "(Sem vendedor)"}
                        </div>
                        <button onClick={() => setXOpenVend(true)} className="px-2 border border-border rounded hover:bg-accent">
                          <Search size={14} />
                        </button>
                        {XVendedor && (
                          <button onClick={() => setXVendedor(null)} className="px-2 border border-border rounded text-destructive hover:bg-destructive/10">
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Badges de totais */}
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1 flex flex-col">
                  <div className="flex items-center gap-1 text-[10px] text-blue-900 dark:text-blue-200 font-bold uppercase w-full justify-start">
                    <ShoppingCart size={10} /> Subtotal
                  </div>
                  <div className="font-bold text-lg text-blue-900 dark:text-blue-200 leading-none w-full text-right mt-0.5">{fmt(baseSubtotal)}</div>
                </div>
                <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1 flex flex-col">
                  <div className="flex items-center gap-1 text-[10px] text-amber-900 dark:text-amber-200 font-bold uppercase w-full justify-start">
                    <Tag size={10} /> Desc.{XPcDesc > 0 ? ` ${XPcDesc.toFixed(1)}%` : ""}
                  </div>
                  <div className="font-bold text-lg text-amber-900 dark:text-amber-200 leading-none w-full text-right mt-0.5">{fmt(vlDescAplicado)}</div>
                </div>
                <div className="border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded px-2 py-1 flex flex-col">
                  <div className="flex items-center gap-1 text-[10px] text-emerald-900 dark:text-emerald-200 font-bold uppercase w-full justify-start">
                    <CircleDollarSign size={10} /> Total
                  </div>
                  <div className="font-bold text-2xl text-emerald-900 dark:text-emerald-200 leading-none w-full text-right mt-0.5">{fmt(totalReceber)}</div>
                </div>
              </div>
            </div>
            <div className="p-2 border-t border-border bg-card flex gap-2">
              <button onClick={() => setXOpenDesc(true)} disabled={XPedidoSel != null || XCart.length === 0}
                className="flex-[0.4] text-sm px-3 py-2 rounded border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 flex items-center justify-center gap-1 font-medium">
                <Percent size={16} /> Desconto
              </button>
              <button onClick={finalizarVenda} disabled={!podeReceber}
                className="flex-[0.6] text-sm px-3 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-1 font-bold">
                <Receipt size={18} /> Finalizar Venda
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de atalhos (clicáveis) */}
      <div className="flex-shrink-0 border-t border-border bg-card/80 px-3 py-1 flex items-center gap-2 text-[11px] text-muted-foreground overflow-x-auto">
        {([
          { key: 'F1', label: 'Ajuda', color: 'bg-primary/10 border-primary/20 text-primary', enabled: true,
            action: () => setXShowAtalhos(p => !p) },
          { key: 'F2', label: 'Buscar Produto', color: 'bg-primary/10 border-primary/20 text-primary', enabled: !XPedidoSel,
            action: () => { searchRef.current?.focus(); searchRef.current?.select(); } },
          { key: 'F3', label: 'Cliente', color: 'bg-primary/10 border-primary/20 text-primary', enabled: !XPedidoSel,
            action: () => setXOpenCliente(true) },
          ...(XPodeInfVend ? [{ key: 'F4', label: 'Vendedor', color: 'bg-primary/10 border-primary/20 text-primary', enabled: !XPedidoSel,
            action: () => setXOpenVend(true) }] : []),
          { key: 'F5', label: 'Atualizar', color: 'bg-primary/10 border-primary/20 text-primary', enabled: true,
            action: () => { carregarPedidos(); toast.info('Lista de pedidos atualizada.'); } },
          { key: 'F6', label: 'Desconto', color: 'bg-primary/10 border-primary/20 text-primary', enabled: !XPedidoSel && XCart.length > 0,
            action: () => setXOpenDesc(true) },
          { key: 'F9', label: 'Finalizar', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400', enabled: podeReceber,
            action: () => finalizarVenda() },
          { key: 'Esc', label: 'Limpar seleção', color: 'bg-rose-500/10 border-rose-500/20 text-rose-600', enabled: !!XPedidoSel,
            action: () => setXPedidoSel(null) },
        ] as const).map(a => (
          <button
            key={a.key}
            type="button"
            onClick={a.action}
            disabled={!a.enabled}
            className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title={a.label}
          >
            <kbd className={`px-1.5 py-0.5 rounded border font-mono font-bold shadow-sm ${a.color}`}>{a.key}</kbd>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Modal de ajuda de atalhos */}
      {XShowAtalhos && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setXShowAtalhos(false)}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">⌨️ Atalhos de Teclado — PDV</h3>
            <div className="space-y-1.5 text-sm">
              {[
                { key: 'F1', label: 'Exibir / ocultar esta ajuda' },
                { key: 'F2', label: 'Focar campo de busca de produto' },
                { key: 'F3', label: 'Pesquisar cliente' },
                { key: 'F4', label: 'Pesquisar vendedor' },
                { key: 'F5', label: 'Atualizar lista de pedidos' },
                { key: 'F6', label: 'Abrir desconto' },
                { key: 'F9', label: 'Finalizar / receber venda' },
                { key: 'Esc', label: 'Deselecionar pedido' },
                { key: 'Del', label: 'Remover último item do carrinho' },
              ].map(a => (
                <div key={a.key} className="flex items-center gap-3">
                  <kbd className="min-w-[48px] text-center px-2 py-1 rounded border border-border bg-muted font-mono font-bold text-foreground shadow-sm text-xs">{a.key}</kbd>
                  <span className="text-muted-foreground">{a.label}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setXShowAtalhos(false)}
              className="mt-4 w-full text-xs py-1.5 rounded border border-border hover:bg-accent">
              Fechar (F1 ou Esc)
            </button>
          </div>
        </div>
      )}

      <ProdutoSearchDialog open={XOpenProduto} onClose={() => setXOpenProduto(false)}
        onSelect={(p, dep) => adicionarProdutoAoCarrinho(p, dep)} />
      <ClienteSearchDialog open={XOpenCliente} onClose={() => setXOpenCliente(false)}
        onSelect={(c) => setXCliente(c)} empresaId={XEmpresaId} />
      <VendedorSearchDialog open={XOpenVend} onClose={() => setXOpenVend(false)}
        onSelect={(v) => setXVendedor(v)} empresaId={XEmpresaId} />

      <DescontoDialog
        open={XOpenDesc}
        subtotal={subtotal}
        descontoAtual={XVlDesc}
        percAtual={XPcDesc}
        onClose={() => setXOpenDesc(false)}
        onAplicar={(d) => { setXVlDesc(d.vl_desconto); setXPcDesc(d.pc_desconto); }}
      />

      <PagamentoDialog
        open={XOpenPagto}
        totalPedido={totalReceber}
        pagtosPreCarregados={XPagtosPedido}
        onClose={() => setXOpenPagto(false)}
        onConfirmar={confirmarPagamento}
      />

      <OpcoesPagamentoDialog
        open={XOpenOpcoes}
        dados={XImpressaoDados}
        empresaId={XEmpresaId}
        funcionarioId={caixa.funcionario_id}
        onClose={concluirVenda}
        onConcluir={concluirVenda}
      />

      <FuncoesDialog
        open={XOpenFuncoes}
        podeCancelar={XPodeCancVenda}
        onClose={() => setXOpenFuncoes(false)}
        onCancelamento={() => setXOpenCanc(true)}
        onFechamento={() => setXOpenFech(true)}
        onAbertura={() => setXOpenAbert(true)}
        onSuprimento={() => setXOpenSupr(true)}
        onSangria={() => setXOpenSang(true)}
      />

      <Dialog open={XOpenFech} onOpenChange={(o) => !o && setXOpenFech(false)}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Fechamento de Caixa</DialogTitle>
          </DialogHeader>
          <FechamentoCaixaForm />
        </DialogContent>
      </Dialog>

      <Dialog open={XOpenAbert} onOpenChange={(o) => !o && setXOpenAbert(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abertura de Caixa</DialogTitle>
          </DialogHeader>
          <AberturaCaixaForm
            funcionarioId={caixa.funcionario_id}
            dtAbertura={dtMovimento}
            embutido
            onAberto={() => { setXOpenAbert(false); toast.success("Caixa aberto. Reentre no PDV para utilizá-lo."); }}
            onCancelar={() => setXOpenAbert(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={XOpenSupr} onOpenChange={(o) => !o && setXOpenSupr(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Suprimento de Caixa</DialogTitle>
          </DialogHeader>
          <SuprimentoSangriaForm
            tipo="SUP"
            embutido
            funcionarioId={caixa.funcionario_id}
            dtMovimento={dtMovimento}
            onConcluido={() => setXOpenSupr(false)}
            onCancelar={() => setXOpenSupr(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={XOpenSang} onOpenChange={(o) => !o && setXOpenSang(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Sangria de Caixa</DialogTitle>
          </DialogHeader>
          <SuprimentoSangriaForm
            tipo="SAN"
            embutido
            funcionarioId={caixa.funcionario_id}
            dtMovimento={dtMovimento}
            onConcluido={() => setXOpenSang(false)}
            onCancelar={() => setXOpenSang(false)}
          />
        </DialogContent>
      </Dialog>

      <CancelamentoDialog
        open={XOpenCanc}
        caixaNome={caixa.nome}
        onClose={() => setXOpenCanc(false)}
        onCancelado={carregarPedidos}
      />

      <ConfigurarDialog
        open={XOpenConfig}
        funcionarioId={caixa.funcionario_id}
        fontePedidos={XFontePed}
        fonteProdutos={XFonteProd}
        tempoRefresh={XRefreshSeg}
        onClose={() => setXOpenConfig(false)}
        onSalvar={(v) => {
          setXFontePed(v.fontePedidos);
          setXFonteProd(v.fonteProdutos);
          setXRefreshSeg(v.tempoRefresh);
        }}
      />
    </div>
  );
};


export default PdvTela;
