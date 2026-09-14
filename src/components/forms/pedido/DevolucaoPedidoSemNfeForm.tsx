import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  FileText, 
  Package, 
  DollarSign, 
  AlertTriangle, 
  Send,
  Edit,
  Trash2
} from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface IItemPedidoRow {
  movimento_item_id: number;
  produto_id: number;
  cd_produto: string;
  nm_produto: string;
  unidade_id: string;
  qt_movimento: number;
  qt_devolvido: number;
  qt_disponivel: number;
  qt_devolver: number;
  vl_und_produto: number;
  vl_desconto: number;
  vl_unit_liquido: number;
  vl_total_item_devolver: number;
  deposito_id: number | null;
  deposito_nome: string;
}

interface IFinanceiroItem {
  financeiro_id: number;
  documento: string;
  parcela?: number;
  dt_vencto: string;
  vl_titulo: number;
  vl_pago: number;
  status: string;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty3 = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const formatDateBR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const clean = String(dateStr).substring(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return clean;
};

// Máscara de digitação com 3 casas decimais no padrão do sistema (0,001 -> 0,010 -> 0,100 -> 1,000)
const maskQuantity3Decimals = (value: string | number): string => {
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "";
  const numValue = parseInt(cleanValue, 10) / 1000;
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

const parseQuantityToFloat = (val: string): number => {
  const clean = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

const DevolucaoPedidoSemNfeForm: React.FC = () => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XStep, setXStep] = useState<1 | 2 | 3 | 4>(1);

  // Etapa 1 - Pesquisa
  const [XBusca, setXBusca] = useState("");
  const [XDtIni, setXDtIni] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().substring(0, 10);
  });
  const [XDtFim, setXDtFim] = useState(() => new Date().toISOString().substring(0, 10));
  const [XLoading, setXLoading] = useState(false);
  const [XResultados, setXResultados] = useState<any[]>([]);

  // Pedido Selecionado
  const [XPedidoSel, setXPedidoSel] = useState<any | null>(null);
  const [XTemNfe, setXTemNfe] = useState(false);
  const [XChaveNfe, setXChaveNfe] = useState<string>("");
  const [XFormasRecebimento, setXFormasRecebimento] = useState<{ id: number; descricao: string; valor: number }[]>([]);
  const [XIsDinheiro, setXIsDinheiro] = useState(false);
  const [XFinanceiros, setXFinanceiros] = useState<IFinanceiroItem[]>([]);

  // Etapa 2 - Itens & Depósitos
  const [XItens, setXItens] = useState<IItemPedidoRow[]>([]);
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);
  const [XDepositosMap, setXDepositosMap] = useState<Record<number, string>>({});
  const firstInputRef = React.useRef<HTMLInputElement | null>(null);

  // Auto-foco e auto-seleção no primeiro campo "Qtd a Devolver" ao entrar na Etapa 2
  useEffect(() => {
    if (XStep === 2 && XItens.length > 0) {
      const timer = setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
          firstInputRef.current.select();
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [XStep, XItens.length]);

  // Etapa 3 - Conferência e Estorno
  const [XOpcaoDinheiro, setXOpcaoDinheiro] = useState<"ESPECIE" | "CREDITO" | "">("");
  const [XEstornando, setXEstornando] = useState(false);
  const [XEstornoConcluido, setXEstornoConcluido] = useState(false);

  // Carregar depósitos da empresa
  useEffect(() => {
    if (!XEmpresaId) return;
    db.from("deposito")
      .select("deposito_id, nome")
      .eq("empresa_id", XEmpresaId)
      .eq("excluido", false)
      .order("nome")
      .then(({ data }: any) => {
        const list = data || [];
        setXDepositos(list);
        const map: Record<number, string> = {};
        list.forEach((d: any) => { map[d.deposito_id] = d.nome; });
        setXDepositosMap(map);
      });
  }, [XEmpresaId]);

  // Carregar pedidos automaticamente na montagem da Etapa 1
  useEffect(() => {
    if (XStep === 1 && XEmpresaId) {
      buscarPedidos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [XStep, XEmpresaId]);

  // --------------------------------------------------
  // ETAPA 1: BUSCAR PEDIDOS
  // --------------------------------------------------
  const buscarPedidos = async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    setXResultados([]);
    try {
      let q = db.from("movimento")
        .select("movimento_id, nr_movimento, dt_emissao, vl_movimento, st_pedido, cadastro_id, deposito_id")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .not("st_pedido", "in", '("C","E")');

      if (XDtIni) q = q.gte("dt_emissao", XDtIni);
      if (XDtFim) q = q.lte("dt_emissao", XDtFim);

      const t = XBusca.trim();
      if (t) {
        if (/^\d+$/.test(t)) {
          q = q.or(`nr_movimento.eq.${t},movimento_id.eq.${t}`);
        } else {
          const { data: cads } = await db.from("cadastro")
            .select("cadastro_id")
            .eq("empresa_id", XEmpresaId)
            .ilike("razao_social", `%${t}%`);
          const cadIds = (cads || []).map((c: any) => c.cadastro_id);
          if (cadIds.length > 0) {
            q = q.in("cadastro_id", cadIds);
          } else {
            setXResultados([]);
            setXLoading(false);
            return;
          }
        }
      }

      q = q.order("movimento_id", { ascending: false }).limit(150);
      const { data: movs, error } = await q;
      if (error) throw error;

      const listaMovs = movs || [];
      const cadIds = Array.from(new Set(listaMovs.map((m: any) => m.cadastro_id).filter(Boolean)));
      const cadMap: Record<number, any> = {};

      if (cadIds.length > 0) {
        const { data: cadsData } = await db.from("cadastro")
          .select("cadastro_id, razao_social, nome_fantasia, cnpj")
          .in("cadastro_id", cadIds);

        (cadsData || []).forEach((c: any) => {
          cadMap[c.cadastro_id] = c;
        });
      }

      const resultadosCompletos = listaMovs.map((m: any) => ({
        ...m,
        cadastro: cadMap[m.cadastro_id] || null,
      }));

      setXResultados(resultadosCompletos);
    } catch (err: any) {
      toast.error("Erro ao buscar pedidos: " + (err.message || String(err)));
    } finally {
      setXLoading(false);
    }
  };

  // --------------------------------------------------
  // SELECIONAR PEDIDO
  // --------------------------------------------------
  const selecionarPedido = async (mov: any) => {
    setXLoading(true);
    try {
      const movId = mov.movimento_id;

      // 1. Verificar se existe NF-e autorizada
      const { data: nfeData } = await db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id, nr_nota, chave_nfe, st_nf")
        .eq("movimento_id", movId)
        .eq("empresa_id", XEmpresaId)
        .in("st_nf", ["E", "1"])
        .eq("excluido", false)
        .maybeSingle();

      if (nfeData) {
        toast.error(`O pedido N° ${mov.nr_movimento || movId} possui a NF-e autorizada N° ${nfeData.nr_nota || ""}. Utilize a Devolução de NF-e de Saída.`);
        setXTemNfe(true);
        setXChaveNfe(nfeData.chave_nfe || `Nota N° ${nfeData.nr_nota}`);
        return;
      }

      // 2. Carregar recebimentos efetuados
      const { data: cmData } = await db.from("caixa_movimento")
        .select("caixa_movimento_id, vl_movimento")
        .eq("movimento_id", movId)
        .eq("excluido", false);

      const cmIds = (cmData || []).map((cm: any) => cm.caixa_movimento_id).filter(Boolean);
      let cmiItems: any[] = [];
      if (cmIds.length > 0) {
        const { data: cmiRes } = await db.from("caixa_movimento_item")
          .select("meio_pagamento_id, vl_recebido")
          .in("caixa_movimento_id", cmIds)
          .eq("excluido", false);
        cmiItems = cmiRes || [];
      }

      const mpIds = new Set<number>();
      cmiItems.forEach((it: any) => {
        if (it.meio_pagamento_id) mpIds.add(it.meio_pagamento_id);
      });

      let mpMap: Record<number, { descricao: string; soma_vl_caixa: string }> = {};
      if (mpIds.size > 0) {
        const { data: mpData } = await db.from("meio_pagamento")
          .select("meio_pagamento_id, descricao, soma_vl_caixa")
          .in("meio_pagamento_id", Array.from(mpIds));

        (mpData || []).forEach((m: any) => {
          mpMap[m.meio_pagamento_id] = {
            descricao: m.descricao || `Meio #${m.meio_pagamento_id}`,
            soma_vl_caixa: m.soma_vl_caixa || "N"
          };
        });
      }

      const formas: { id: number; descricao: string; valor: number }[] = [];
      let temDinheiro = false;

      cmiItems.forEach((it: any) => {
        const mpId = it.meio_pagamento_id || 1;
        const mpInfo = mpMap[mpId] || { descricao: mpId === 1 ? "Dinheiro" : `Meio #${mpId}`, soma_vl_caixa: "N" };
        const desc = mpInfo.descricao;
        if (mpId === 1 || String(mpInfo.soma_vl_caixa).toUpperCase() === "S") temDinheiro = true;

        const idx = formas.findIndex(f => f.id === mpId);
        if (idx >= 0) {
          formas[idx].valor += Number(it.vl_recebido || 0);
        } else {
          formas.push({ id: mpId, descricao: desc, valor: Number(it.vl_recebido || 0) });
        }
      });

      if (formas.length === 0) {
        const { data: mpRows } = await db.from("movimento_pagamento")
          .select("meio_pagamento_id, vl_parcela")
          .eq("movimento_id", movId)
          .eq("excluido", false);

        const pagMpIds = Array.from(new Set((mpRows || []).map((r: any) => r.meio_pagamento_id).filter(Boolean)));
        let pagMpMap: Record<number, { descricao: string; soma_vl_caixa: string }> = {};

        if (pagMpIds.length > 0) {
          const { data: pagMpData } = await db.from("meio_pagamento")
            .select("meio_pagamento_id, descricao, soma_vl_caixa")
            .in("meio_pagamento_id", pagMpIds);

          (pagMpData || []).forEach((m: any) => {
            pagMpMap[m.meio_pagamento_id] = {
              descricao: m.descricao || `Meio #${m.meio_pagamento_id}`,
              soma_vl_caixa: m.soma_vl_caixa || "N"
            };
          });
        }

        (mpRows || []).forEach((r: any) => {
          const mpId = r.meio_pagamento_id || 1;
          const info = pagMpMap[mpId] || { descricao: mpId === 1 ? "Dinheiro" : `Meio #${mpId}`, soma_vl_caixa: "N" };
          if (mpId === 1 || String(info.soma_vl_caixa).toUpperCase() === "S") temDinheiro = true;
          formas.push({ id: mpId, descricao: info.descricao, valor: Number(r.vl_parcela || 0) });
        });
      }

      // 3. Carregar financeiro vinculado
      const { data: finData } = await db.from("financeiro")
        .select("financeiro_id, documento, parcela, dt_vencto, vl_titulo, vl_pago, status")
        .eq("movimento_id", movId)
        .eq("empresa_id", XEmpresaId);

      // 4. Carregar itens do pedido
      const { data: itensData } = await db.from("movimento_item")
        .select("*")
        .eq("movimento_id", movId)
        .eq("excluido", false);

      if (!itensData || itensData.length === 0) {
        toast.error("Este pedido não possui itens para devolução.");
        return;
      }

      const listaItens: IItemPedidoRow[] = (itensData || []).map((it: any) => {
        const qtV = Number(it.qt_movimento || 0);
        const qtD = Number(it.qt_devolvido || 0);
        const qtDisp = Math.max(0, qtV - qtD);
        const vlUnd = Number(it.vl_und_produto || 0);
        const vlDesc = Number(it.vl_desconto || 0);
        const vlLiquido = qtV > 0 ? (Number(it.vl_movimento || (qtV * vlUnd - vlDesc)) / qtV) : vlUnd;
        const depId = it.deposito_id || mov.deposito_id || (XDepositos.length > 0 ? XDepositos[0].deposito_id : 1);

        return {
          movimento_item_id: it.movimento_item_id,
          produto_id: it.produto_id,
          cd_produto: it.cd_produto || String(it.produto_id),
          nm_produto: it.nm_produto || "Produto Sem Nome",
          unidade_id: it.unidade_id || "UN",
          qt_movimento: qtV,
          qt_devolvido: qtD,
          qt_disponivel: qtDisp,
          qt_devolver: qtDisp,
          vl_und_produto: vlUnd,
          vl_desconto: vlDesc,
          vl_unit_liquido: vlLiquido,
          vl_total_item_devolver: qtDisp * vlLiquido,
          deposito_id: depId,
          deposito_nome: XDepositosMap[depId] || `Depósito ${depId}`,
        };
      });

      const temQtDisponivel = listaItens.some(it => it.qt_disponivel > 0);
      if (!temQtDisponivel) {
        toast.error(`O pedido N° ${mov.nr_movimento || movId} já foi totalmente estornado/devolvido.`);
        return;
      }

      setXPedidoSel(mov);
      setXFormasRecebimento(formas);
      setXIsDinheiro(temDinheiro);
      setXFinanceiros(finData || []);
      setXItens(listaItens);
      setXOpcaoDinheiro("");
      setXEstornoConcluido(false);

      // Avança diretamente para a Etapa 2
      setXStep(2);

    } catch (err: any) {
      toast.error("Erro ao carregar detalhes do pedido: " + (err.message || String(err)));
    } finally {
      setXLoading(false);
    }
  };

  // Digitação de quantidade com 3 casas decimais (padrão 0,001 -> 0,010 -> 0,100 -> 1,000)
  const setQtDevolverInput = (idx: number, rawInput: string) => {
    const formatted = maskQuantity3Decimals(rawInput);
    const n = parseQuantityToFloat(formatted);

    setXItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const validQt = Math.min(it.qt_disponivel, Math.max(0, n));
      return {
        ...it,
        qt_devolver: validQt,
        vl_total_item_devolver: validQt * it.vl_unit_liquido,
      };
    }));
  };

  // Alterar depósito de entrada do item
  const setDepositoItem = (idx: number, depId: number) => {
    setXItens(prev => prev.map((it, i) => i === idx ? {
      ...it,
      deposito_id: depId,
      deposito_nome: XDepositosMap[depId] || `Depósito ${depId}`
    } : it));
  };

  const totalDevolucao = useMemo(() => {
    return XItens.reduce((acc, it) => acc + (it.qt_devolver * it.vl_unit_liquido), 0);
  }, [XItens]);

  const vlDinheiroOriginal = useMemo(() => {
    return XFormasRecebimento
      .filter(f => f.id === 1 || f.descricao?.toLowerCase().includes("dinheiro"))
      .reduce((acc, f) => acc + (f.valor || 0), 0);
  }, [XFormasRecebimento]);

  const vlDinheiroEstorno = useMemo(() => {
    return Math.min(totalDevolucao, vlDinheiroOriginal);
  }, [totalDevolucao, vlDinheiroOriginal]);

  const avancarParaEtapa3 = () => {
    const itensComQt = XItens.filter(it => it.qt_devolver > 0);
    if (itensComQt.length === 0) {
      toast.error("Informe a quantidade a devolver de pelo menos 1 item.");
      return;
    }
    if (totalDevolucao <= 0) {
      toast.error("O valor da devolução deve ser maior que zero.");
      return;
    }
    setXStep(3);
  };

  // --------------------------------------------------
  // ETAPA 3: EXECUTAR ESTORNO
  // --------------------------------------------------
  const executarEstorno = async () => {
    if (!XPedidoSel) return;
    if (XIsDinheiro && !XOpcaoDinheiro) {
      toast.error("Para recebimento em dinheiro, selecione DEVOLVER EM ESPÉCIE ou GERAR CRÉDITO PARA O CLIENTE.");
      return;
    }

    const itensFiltrados = XItens.filter(it => it.qt_devolver > 0).map(it => ({
      movimento_item_id: it.movimento_item_id,
      produto_id: it.produto_id,
      qt_devolver: it.qt_devolver,
      deposito_id: it.deposito_id,
      vl_devolucao: it.qt_devolver * it.vl_unit_liquido,
    }));

    if (!confirm(`Confirma o estorno de R$ ${fmt(totalDevolucao)} para ${itensFiltrados.length} item(ns)?`)) return;

    setXEstornando(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await db.rpc("fu_estornar_pedido_sem_nfe", {
        _movimento_id: XPedidoSel.movimento_id,
        _empresa_id: XEmpresaId,
        _usuario_id: userId,
        _opcao_dinheiro: XIsDinheiro ? XOpcaoDinheiro : null,
        _itens: itensFiltrados,
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Estorno realizado com sucesso! Valor: R$ ${fmt(data.vl_devolucao || totalDevolucao)}`);
      setXEstornoConcluido(true);

      if (XFinanceiros.length > 0) {
        setXStep(4);
      }
    } catch (err: any) {
      toast.error("Erro ao efetivar estorno: " + (err.message || String(err)));
    } finally {
      setXEstornando(false);
    }
  };

  // --------------------------------------------------
  // ETAPA 4: AJUSTE FINANCEIRO
  // --------------------------------------------------
  const alterarFinanceiro = (fin: IFinanceiroItem) => {
    openTab("gerar-contas-receber", "Alterar Lançamento Financeiro", { financeiro_id: fin.financeiro_id });
  };

  const excluirFinanceiro = async (fin: IFinanceiroItem) => {
    if (!confirm(`Confirma a exclusão do título ${fin.documento} (R$ ${fmt(fin.vl_titulo)})?`)) return;
    try {
      await db.from("financeiro_baixa")
        .delete()
        .eq("empresa_id", XEmpresaId)
        .eq("financeiro_id", fin.financeiro_id);

      const { error } = await db.from("financeiro")
        .delete()
        .eq("empresa_id", XEmpresaId)
        .eq("financeiro_id", fin.financeiro_id);

      if (error) throw error;

      toast.success("Título financeiro excluído com sucesso.");
      setXFinanceiros(prev => prev.filter(f => f.financeiro_id !== fin.financeiro_id));
    } catch (err: any) {
      toast.error("Erro ao excluir título: " + (err.message || String(err)));
    }
  };

  const reiniciar = () => {
    setXStep(1);
    setXPedidoSel(null);
    setXTemNfe(false);
    setXFormasRecebimento([]);
    setXIsDinheiro(false);
    setXFinanceiros([]);
    setXItens([]);
    setXOpcaoDinheiro("");
    setXEstornoConcluido(false);
    buscarPedidos();
  };

  const StepBadge: React.FC<{ n: 1 | 2 | 3 | 4; label: string; icon: React.ReactNode }> = ({ n, label, icon }) => {
    const isCompleted = XEstornoConcluido ? true : XStep > n;
    const isActive = XStep === n;
    const isDisabled = (n === 4 && XFinanceiros.length === 0) || (n > XStep && !XEstornoConcluido && n !== 4);
    const isClickable = !isDisabled && n !== XStep;

    let style = "";
    if (isActive) {
      style = "bg-[#eab308] text-white border-[#eab308] shadow-md font-bold";
    } else if (isCompleted) {
      style = "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 shadow-sm font-semibold";
    } else if (isDisabled) {
      style = "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed";
    } else {
      style = "bg-muted text-muted-foreground border-border font-semibold";
    }

    return (
      <div 
        onClick={() => {
          if (isClickable) setXStep(n);
        }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${isClickable ? "cursor-pointer hover:opacity-80 active:scale-95" : ""} ${style}`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${isActive ? "bg-white/30 text-white" : isCompleted ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100" : "bg-background/40 text-muted-foreground"}`}>
          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : n}
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-tight">
          {icon}
          <span>{label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500 p-4 md:p-6">
      {/* Header Visual */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary"><RotateCcw className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Estorno de Pedido</h2>
            <p className="text-xs text-muted-foreground">Assistente em etapas — estorno e devolução de pedidos sem emissão de NF-e</p>
          </div>
        </div>
        <button onClick={reiniciar} className="text-xs font-bold px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors">
          REINICIAR
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 bg-card p-3 rounded-xl border border-border shadow-sm overflow-x-auto">
        <StepBadge n={1} label="SELECIONAR PEDIDO ORIGEM" icon={<FileText className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <StepBadge n={2} label="ITENS A DEVOLVER" icon={<Package className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        <StepBadge n={3} label="CONFERIR E ESTORNAR" icon={<Send className="w-3.5 h-3.5" />} />
        {XFinanceiros.length > 0 && (
          <>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <StepBadge n={4} label="AJUSTE FINANCEIRO" icon={<DollarSign className="w-3.5 h-3.5" />} />
          </>
        )}
      </div>

      {/* Container Principal */}
      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        {/* ================================================== */}
        {/* ETAPA 1: SELECIONAR PEDIDO ORIGEM */}
        {/* ================================================== */}
        {XStep === 1 && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={XBusca}
                  onChange={e => setXBusca(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && buscarPedidos()}
                  placeholder="Nº do pedido ou nome do cliente..."
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-background"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Início</label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={XDtIni}
                  onChange={e => setXDtIni(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Fim</label>
                <input
                  type="date"
                  min="2000-01-01"
                  max="2099-12-31"
                  value={XDtFim}
                  onChange={e => setXDtFim(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background"
                />
              </div>
              <button
                onClick={buscarPedidos}
                disabled={XLoading}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                {XLoading ? "BUSCANDO..." : "BUSCAR"}
              </button>
            </div>

            {/* Grid de Resultados */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-2">Pedido</div>
                <div className="col-span-2">Emissão</div>
                <div className="col-span-6">Cliente</div>
                <div className="col-span-2 text-right">Valor Total</div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {XLoading && <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Carregando pedidos...</div>}
                {!XLoading && XResultados.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground italic">Nenhum pedido localizado no período.</div>
                )}
                {!XLoading && XResultados.map((r, i) => (
                  <div
                    key={r.movimento_id}
                    onClick={() => selecionarPedido(r)}
                    className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-sm border-b last:border-0 cursor-pointer hover:bg-primary/5 transition-colors ${i % 2 ? "bg-muted/20" : ""}`}
                  >
                    <div className="col-span-2 font-bold text-blue-700 dark:text-blue-300">
                      N° {r.nr_movimento || r.movimento_id}
                    </div>
                    <div className="col-span-2 text-xs font-mono">
                      {formatDateBR(r.dt_emissao)}
                    </div>
                    <div className="col-span-6 truncate text-xs">
                      <span className="font-semibold">{r.cadastro?.razao_social || r.cadastro?.nome_fantasia || "(Consumidor)"}</span>
                      {r.cadastro?.cnpj && <span className="text-muted-foreground"> — {formatCPFCNPJ(r.cadastro.cnpj)}</span>}
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold">
                      R$ {fmt(r.vl_movimento)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Clique em um pedido para carregar seus itens e avançar.</p>
          </div>
        )}

        {/* ================================================== */}
        {/* ETAPA 2: ITENS A DEVOLVER */}
        {/* ================================================== */}
        {XStep === 2 && XPedidoSel && (
          <div className="flex flex-col gap-3 h-full">
            {/* Header do Pedido Selecionado */}
            <div className="grid grid-cols-12 gap-3 p-3 rounded-lg bg-muted/30 border border-border text-xs">
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Pedido Origem</label>
                <div className="text-sm font-bold">N° {XPedidoSel.nr_movimento || XPedidoSel.movimento_id}</div>
              </div>
              <div className="col-span-4">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente</label>
                <div className="text-sm truncate font-medium">{XPedidoSel.cadastro?.razao_social || "(Consumidor)"}</div>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Recebimento Original</label>
                <div className="text-xs font-mono font-semibold">
                  {XFormasRecebimento.length > 0 ? XFormasRecebimento.map(f => f.descricao).join(", ") : "Sem caixa direto"}
                </div>
              </div>
              <div className="col-span-3 text-right">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Total Devolução</label>
                <div className="text-base font-mono font-bold text-primary">R$ {fmt(totalDevolucao)}</div>
              </div>
            </div>

            {/* Tabela de Itens (Com Qtd Origem, Qtd Devolvido, Qtd a Devolver menor com auto-select, e Combo Depósito) */}
            <div className="border border-border rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b items-center">
                <div className="col-span-1">Cód.</div>
                <div className="col-span-3">Descrição do Produto</div>
                <div className="col-span-1 text-center">Und</div>
                <div className="col-span-1 text-right">Qtd Origem</div>
                <div className="col-span-1 text-right">Qtd Devolvido</div>
                <div className="col-span-1 text-right">Qtd Devolver</div>
                <div className="col-span-2">Depósito Entrada</div>
                <div className="col-span-1 text-right">Vl. Unitário</div>
                <div className="col-span-1 text-right">Subtotal</div>
              </div>
              <div className="overflow-y-auto flex-1">
                {XItens.map((it, idx) => (
                  <div key={it.movimento_item_id} className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0 items-center ${idx % 2 ? "bg-muted/20" : ""}`}>
                    <div className="col-span-1 font-mono text-xs truncate">{it.cd_produto}</div>
                    <div className="col-span-3 truncate text-xs text-blue-800 dark:text-blue-300 font-medium">
                      {it.nm_produto}
                    </div>
                    <div className="col-span-1 text-center text-xs">{it.unidade_id}</div>
                    <div className="col-span-1 text-right font-mono text-xs">{fmtQty3(it.qt_movimento)}</div>
                    <div className="col-span-1 text-right font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{fmtQty3(it.qt_devolvido)}</div>
                    <div className="col-span-1 text-right">
                      <input
                        ref={idx === 0 ? firstInputRef : null}
                        type="text"
                        value={it.qt_devolver === 0 ? "" : maskQuantity3Decimals(it.qt_devolver.toFixed(3))}
                        onChange={e => setQtDevolverInput(idx, e.target.value)}
                        onFocus={e => e.target.select()}
                        placeholder="0,000"
                        className={`w-full text-right px-1.5 py-1 text-xs border rounded font-mono ${it.qt_devolver > 0 ? "border-primary bg-primary/5 font-bold" : "border-border bg-background"}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={it.deposito_id ?? ""}
                        onChange={e => setDepositoItem(idx, Number(e.target.value))}
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background font-medium"
                      >
                        <option value="">— Selecione —</option>
                        {XDepositos.map(d => (
                          <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-right font-mono text-xs text-muted-foreground font-semibold">
                      R$ {fmt(it.vl_unit_liquido)}
                    </div>
                    <div className="col-span-1 text-right font-mono font-bold text-primary text-xs">
                      R$ {fmt(it.vl_total_item_devolver)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => setXStep(1)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80">
                <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
              </button>
              <button onClick={avancarParaEtapa3} className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 shadow-sm">
                CONFERIR E ESTORNAR <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* ETAPA 3: CONFERIR E ESTORNAR */}
        {/* ================================================== */}
        {XStep === 3 && XPedidoSel && (
          <div className="flex flex-col h-full text-xs overflow-hidden">
            {/* Conteúdo com rolagem própria */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-2">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold uppercase">Etapa 3</span>
                  <h3 className="text-base font-bold">Conferência dos Dados e Confirmação do Estorno</h3>
                </div>
                {XEstornoConcluido && (
                  <div className="px-3 py-1 bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 font-bold rounded-full text-xs flex items-center gap-1.5 border border-green-300">
                    <Check className="w-4 h-4 stroke-[3]" /> ESTORNO CONCLUÍDO
                  </div>
                )}
              </div>

              {XEstornoConcluido && (
                <div className="bg-green-50 dark:bg-green-950/40 border border-green-400 dark:border-green-800 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-bold">
                    <Check className="w-5 h-5 text-green-600 stroke-[3]" />
                    <span>Estorno efetuado com sucesso! O estoque foi atualizado.</span>
                  </div>
                  {XFinanceiros.length > 0 && (
                    <button
                      onClick={() => setXStep(4)}
                      className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-md hover:opacity-90 flex items-center gap-1.5 shadow-sm"
                    >
                      AVANÇAR PARA AJUSTE FINANCEIRO (PASSO 4) <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-2">
                  <div className="font-bold text-sm border-b border-border pb-1">Resumo do Pedido</div>
                  <div><strong>Pedido N°:</strong> {XPedidoSel.nr_movimento || XPedidoSel.movimento_id}</div>
                  <div className="font-mono"><strong>Data Emissão:</strong> {formatDateBR(XPedidoSel.dt_emissao)}</div>
                  <div><strong>Cliente:</strong> {XPedidoSel.cadastro?.razao_social || "(Consumidor)"}</div>
                  <div><strong>Itens Selecionados:</strong> {XItens.filter(i => i.qt_devolver > 0).length} item(ns)</div>
                  <div><strong>Valor Total a Estornar:</strong> <span className="font-mono font-bold text-primary text-sm">R$ {fmt(totalDevolucao)}</span></div>
                </div>

                <div className="bg-muted/40 p-4 rounded-lg border border-border space-y-2">
                  <div className="font-bold text-sm border-b border-border pb-1">Forma de Recebimento Original</div>
                  {XFormasRecebimento.length > 0 ? (
                    XFormasRecebimento.map(f => (
                      <div key={f.id} className="flex justify-between font-mono">
                        <span>{f.descricao}:</span>
                        <span>R$ {fmt(f.valor)}</span>
                      </div>
                    ))
                  ) : (
                    <div>Nenhum lançamento direto de caixa encontrado</div>
                  )}
                  <div className="pt-2 border-t border-border text-[11px]">
                    {XFinanceiros.length > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-bold">Possui {XFinanceiros.length} título(s) no financeiro</span>
                    ) : (
                      <span className="text-muted-foreground">Sem financeiro associado</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Opção para recebimento em dinheiro */}
              {XIsDinheiro && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                    <DollarSign className="w-5 h-5 text-amber-600" />
                    DESTINO DO VALOR RECEBIDO EM DINHEIRO (OBRIGATÓRIO PARA DINHEIRO)
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    Escolha como tratar o valor estornado em dinheiro (<strong className="font-mono text-sm">R$ {fmt(vlDinheiroEstorno)}</strong>):
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={XEstornoConcluido}
                      onClick={() => setXOpcaoDinheiro("ESPECIE")}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer shadow-sm active:scale-[0.99] ${
                        XOpcaoDinheiro === "ESPECIE"
                          ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/30"
                          : "bg-card border-border hover:border-emerald-400 hover:bg-emerald-50/20 text-foreground"
                      } ${XEstornoConcluido ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        XOpcaoDinheiro === "ESPECIE"
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-muted-foreground/40 bg-background"
                      }`}>
                        {XOpcaoDinheiro === "ESPECIE" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <span>OPÇÃO 1: DEVOLVER EM ESPÉCIE</span>
                        </div>
                        <div className={XOpcaoDinheiro === "ESPECIE" ? "text-emerald-800 dark:text-emerald-200" : "text-muted-foreground"}>
                          Gera um <strong>DÉBITO/SAÍDA</strong> no caixa de <span className="font-mono font-bold">R$ {fmt(vlDinheiroEstorno)}</span>. NÃO gera crédito para o cliente.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={XEstornoConcluido}
                      onClick={() => setXOpcaoDinheiro("CREDITO")}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer shadow-sm active:scale-[0.99] ${
                        XOpcaoDinheiro === "CREDITO"
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/30"
                          : "bg-card border-border hover:border-blue-400 hover:bg-blue-50/20 text-foreground"
                      } ${XEstornoConcluido ? "opacity-75 cursor-not-allowed" : ""}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        XOpcaoDinheiro === "CREDITO"
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-muted-foreground/40 bg-background"
                      }`}>
                        {XOpcaoDinheiro === "CREDITO" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-sm flex items-center gap-1.5">
                          <span>OPÇÃO 2: GERAR CRÉDITO PARA O CLIENTE</span>
                        </div>
                        <div className={XOpcaoDinheiro === "CREDITO" ? "text-blue-800 dark:text-blue-200" : "text-muted-foreground"}>
                          O dinheiro permanece no caixa. Gera um <strong>CRÉDITO</strong> de <span className="font-mono font-bold">R$ {fmt(vlDinheiroEstorno)}</span> para o cliente.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé Fixo Sempre Visível */}
            <div className="flex justify-between pt-3 mt-2 border-t border-border items-center bg-card shrink-0 px-1">
              <button onClick={() => setXStep(2)} disabled={XEstornando} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80 disabled:opacity-50">
                <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
              </button>

              {!XEstornoConcluido ? (
                <button
                  onClick={executarEstorno}
                  disabled={XEstornando || (XIsDinheiro && !XOpcaoDinheiro)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-md disabled:opacity-50 shadow-md transition-all active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  {XEstornando ? "PROCESSANDO ESTORNO..." : "CONFIRMAR E EFETIVAR ESTORNO"}
                </button>
              ) : XFinanceiros.length > 0 ? (
                <button
                  onClick={() => setXStep(4)}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-md hover:opacity-90 shadow-md transition-all active:scale-95"
                >
                  AVANÇAR PARA AJUSTE FINANCEIRO (PASSO 4) <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={reiniciar}
                  className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-md shadow-md transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" /> CONCLUIR OPERAÇÃO
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* ETAPA 4: AJUSTE FINANCEIRO */}
        {/* ================================================== */}
        {XStep === 4 && (
          <div className="flex flex-col gap-4 h-full text-xs">
            <div className="border-b border-border pb-2">
              <span className="text-xs text-muted-foreground font-semibold uppercase">Etapa 4</span>
              <h3 className="text-base font-bold">Ajuste dos Lançamentos Financeiros do Pedido</h3>
              <p className="text-xs text-muted-foreground">
                Estorno concluído! Escolha a ação para cada título financeiro vinculado a este pedido.
              </p>
            </div>

            <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
              {XFinanceiros.map(fin => (
                <div key={fin.financeiro_id} className="p-4 flex items-center justify-between bg-card hover:bg-accent/30">
                  <div className="space-y-1">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Documento: {fin.documento} {fin.parcela ? `(Parc. ${fin.parcela})` : ""}
                    </div>
                    <div className="text-muted-foreground font-mono">
                      Vencimento: {formatDateBR(fin.dt_vencto)} · Valor Título: R$ {fmt(fin.vl_titulo)} · Pago: R$ {fmt(fin.vl_pago)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alterarFinanceiro(fin)}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded border border-primary/20 flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> ALTERAR
                    </button>
                    <button
                      onClick={() => excluirFinanceiro(fin)}
                      className="px-3 py-1.5 text-xs font-semibold bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded border border-rose-500/20 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> EXCLUIR
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 mt-auto border-t border-border">
              <button
                onClick={reiniciar}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-md hover:opacity-90 flex items-center gap-2 shadow-sm"
              >
                <Check className="w-4 h-4" /> CONCLUIR OPERAÇÃO
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevolucaoPedidoSemNfeForm;
