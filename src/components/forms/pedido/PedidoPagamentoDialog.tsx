import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { useAppContext } from "@/contexts/AppContext";
import { CreditCard, ShoppingCart, Wallet, ArrowRightLeft, Calculator, Delete, Trash2, Percent, Lock } from "lucide-react";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const parseNum = (v: string | number | null | undefined) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmtInput = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : parseNum(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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
  tipo_prazo: string | null;
  qtd_parcelas: number | null;
  intervalo: number | null;
  plano_conta_id: number | null;
  meio_pagamento_id: number | null;
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
  open: boolean;
  movimentoId: number;
  cadastroId: number | null;
  subtotalPedido: number; // vl_movimento + vl_desconto
  tpDesconto: string;
  onClose: () => void;
  onConfirmar: (pagtos: IPagamentoLinha[], vlDesconto: number, pcDesconto: number, enviarAoCaixa?: boolean) => Promise<void>;
}

const getTipoPrazoCondicao = (c: ICondicao | null | undefined): "U" | "F" | "V" => {
  if (!c) return "U";
  if (c.tipo_prazo === "U" || c.tipo_prazo === "F" || c.tipo_prazo === "V") {
    return c.tipo_prazo;
  }
  if (c.qtd_parcelas && Number(c.qtd_parcelas) > 1) return "F";
  for (let i = 1; i <= 12; i++) {
    const key = `prazo_${i}` as keyof ICondicao;
    if (c[key] !== null && c[key] !== undefined && Number(c[key]) > 0) return "V";
  }
  return "U";
};

const getQtdParcelasCondicao = (c: ICondicao | null | undefined): number => {
  if (!c) return 1;
  const tp = getTipoPrazoCondicao(c);
  if (tp === "U") return 1;
  if (tp === "F") {
    const q = Number(c.qtd_parcelas);
    return q > 0 ? q : 1;
  }
  if (tp === "V") {
    let count = 0;
    for (let i = 1; i <= 12; i++) {
      const key = `prazo_${i}` as keyof ICondicao;
      if (c[key] !== null && c[key] !== undefined && Number(c[key]) > 0) count++;
    }
    return count > 0 ? count : 1;
  }
  return 1;
};

const PedidoPagamentoDialog: React.FC<IProps> = ({ open, movimentoId, cadastroId, subtotalPedido, tpDesconto, onClose, onConfirmar }) => {
  const { XEmpresaId, XEmpresaMatrizId } = useAppContext();
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XLinhas, setXLinhas] = useState<IPagamentoLinha[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSalvando, setXSalvando] = useState(false);
  const [XDeletadosDb, setXDeletadosDb] = useState<number[]>([]);

  // Database totals
  const [XDbTotals, setXDbTotals] = useState({ subtotal: 0, desconto: 0, total: 0 });

  // Discount states (input as numbers)
  const [XVlDesconto, setXVlDesconto] = useState<number>(0);
  const [XPcDesconto, setXPcDesconto] = useState<number>(0);

  // Form fields
  const [XCondicaoId, setXCondicaoId] = useState<number>(0);
  const [XVlPagar, setXVlPagar] = useState<number>(0);
  const [XQtParcela, setXQtParcela] = useState<number>(1);
  const [XEditUid, setXEditUid] = useState<string | null>(null);

  // Portadores state
  const [XPortadores, setXPortadores] = useState<{ portador_id: number; cd_portador: number; nome: string; banco_id: number | null }[]>([]);
  const [XPortadorId, setXPortadorId] = useState<number>(0);

  // Price Table Type state ('V' | 'P')
  const [XTpPagamentoTabela, setXTpPagamentoTabela] = useState<"V" | "P">("V");

  // Calculator State
  const [XCalcDisplay, setXCalcDisplay] = useState("0");
  const [XCalcReset, setXCalcReset] = useState(false);

  const condicaoRef = useRef<HTMLSelectElement>(null);
  const portadorRef = useRef<HTMLSelectElement>(null);
  const vlPagarRef = useRef<HTMLInputElement>(null);
  const adicionarBtnRef = useRef<HTMLButtonElement>(null);
  const finalizarRef = useRef<HTMLButtonElement>(null);

  const vlDescNum = XVlDesconto;
  const subtotalEfetivo = XDbTotals.subtotal > 0 ? XDbTotals.subtotal : subtotalPedido;
  const totalPedido = useMemo(() => Number((subtotalEfetivo - vlDescNum).toFixed(2)), [subtotalEfetivo, vlDescNum]);
  const totalPago = useMemo(() => Number(XLinhas.reduce((a, l) => a + Number(l.vl_pagamento || 0), 0).toFixed(2)), [XLinhas]);
  const valorRestante = Number(Math.max(0, totalPedido - totalPago).toFixed(2));
  
  const vlPagarNum = XVlPagar;
  const vlParcela = XQtParcela > 0 ? +(vlPagarNum / XQtParcela).toFixed(2) : vlPagarNum;

  useEffect(() => {
    if (!open || !movimentoId || !XEmpresaId) return;
    setXSelectedIdx(null);
    setXDeletadosDb([]);
    (async () => {
      try {
        let dbMov = subtotalPedido;
        let tpTab: "V" | "P" = "V";
        // Fetch current movement for totals and price table ID
        const { data: mov } = await supabase.from("movimento")
          .select("vl_desconto, pc_desconto, vl_movimento, vl_produto, tabela_preco_id")
          .eq("movimento_id", movimentoId).single();
        
        if (mov) {
          const dbVlDesc = Number(mov.vl_desconto || 0);
          const dbPcDesc = Number(mov.pc_desconto || 0);
          dbMov = Number(mov.vl_movimento || 0);
          const dbSub = Number(mov.vl_produto || 0);
          
          setXDbTotals({ subtotal: dbSub, desconto: dbVlDesc, total: dbMov });
          setXVlDesconto(dbVlDesc);
          setXPcDesconto(dbPcDesc);

          if (mov.tabela_preco_id) {
            const { data: tab } = await supabase.from("tabela_preco")
              .select("tp_pagamento")
              .eq("tabela_id", mov.tabela_preco_id)
              .maybeSingle();
            if (tab?.tp_pagamento === "P") {
              tpTab = "P";
            }
          }
        }
        setXTpPagamentoTabela(tpTab);

        // 1. Fetch Portadores
        const { data: portadorData } = await supabase.from("portador")
          .select("portador_id, cd_portador, nome, banco_id")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false)
          .eq("ativo", "S")
          .order("nome");
        if (portadorData) setXPortadores(portadorData);

        // 2. Fetch Client defaults
        let defaultCondId = 0;
        let defaultPortadorId = 0;
        if (cadastroId) {
          const { data: cli } = await supabase.from("cadastro")
            .select("condicao_id, portador_id")
            .eq("cadastro_id", cadastroId)
            .single();
          if (cli) {
            defaultCondId = cli.condicao_id || 0;
            defaultPortadorId = cli.portador_id || 0;
          }
        }

        // 3. Fetch Conditions for logged in company
        const condQuery = supabase.from("condicao_pagamento")
          .select(`
            condicao_id, descricao, tipo_prazo, qtd_parcelas, intervalo, plano_conta_id, meio_pagamento_id, empresa_id,
            prazo_1, prazo_2, prazo_3, prazo_4, prazo_5, prazo_6, prazo_7, prazo_8, prazo_9, prazo_10, prazo_11, prazo_12
          `)
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false);

        const { data: condData, error: condErr } = await condQuery;
        if (condErr) {
          toast.error("Erro ao carregar condições de pagamento: " + condErr.message);
        }

        // Deduplica priorizando a empresa logada
        const rawConds = condData || [];
        const condsMap = new Map<string, typeof rawConds[0]>();

        rawConds.forEach(c => {
          const key = c.descricao.trim().toLowerCase();
          const existing = condsMap.get(key);
          if (!existing || c.empresa_id === XEmpresaId) {
            condsMap.set(key, c);
          }
        });

        const conds = Array.from(condsMap.values());
        conds.sort((a, b) => a.descricao.localeCompare(b.descricao));

        setXCondicoes(conds);

        // 4. Fetch existing payments
        const { data: pagtoData } = await supabase.from("movimento_pagamento")
          .select("*")
          .eq("movimento_id", movimentoId)
          .eq("excluido", false)
          .order("movimento_pagamento_id");

        if (pagtoData && pagtoData.length > 0) {
          const linhasMapeadas: IPagamentoLinha[] = pagtoData.map((p) => {
            const cond = conds.find((c) => c.condicao_id === p.condicao_id);
            const nParc = p.n_parcelas || getQtdParcelasCondicao(cond);
            const vlParc = Number(p.vl_parcelas) > 0 
              ? Number(p.vl_parcelas) 
              : (nParc > 0 ? Number((Number(p.vl_pagamento || 0) / nParc).toFixed(2)) : Number(p.vl_pagamento || 0));

            return {
              uid: String(p.movimento_pagamento_id || crypto.randomUUID()),
              movimento_pagamento_id: p.movimento_pagamento_id,
              condicao_id: p.condicao_id,
              condicao_descricao: cond?.descricao || `Condição ${p.condicao_id}`,
              n_parcelas: nParc,
              vl_parcelas: vlParc,
              vl_pagamento: Number(p.vl_pagamento || 0),
              tp_pagamento: p.tp_pagamento || "DI",
              empresa_id: p.empresa_id,
              movimento_id: p.movimento_id,
              portador_id: p.portador_id || null
            };
          });
          setXLinhas(linhasMapeadas);
          
          const totalPagoExistente = linhasMapeadas.reduce((a, l) => a + l.vl_pagamento, 0);
          const restante = Math.max(0, dbMov - totalPagoExistente);
          resetForm(restante);
        } else {
          // If no existing payments, apply defaults (filter by price table allowed types)
          const allowedConds = conds.filter(c => tpTab === "V" ? getTipoPrazoCondicao(c) === "U" : (getTipoPrazoCondicao(c) === "F" || getTipoPrazoCondicao(c) === "V"));
          const hasCond = allowedConds.some(c => c.condicao_id === defaultCondId);
          if (hasCond) {
            setXCondicaoId(defaultCondId);
            const cObj = allowedConds.find(c => c.condicao_id === defaultCondId);
            if (cObj) setXQtParcela(getQtdParcelasCondicao(cObj));
          } else {
            setXCondicaoId(0);
          }
          setXVlPagar(dbMov);
          setXEditUid(null);

          if (defaultPortadorId) {
            setXPortadorId(defaultPortadorId);
          } else {
            setXPortadorId(0);
          }
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        toast.error("Erro ao carregar dados: " + errMsg);
      }
    })();
  }, [open, movimentoId, cadastroId, subtotalPedido, XEmpresaId, XEmpresaMatrizId]);

  // Sincroniza o valor a pagar inicial apenas quando o totalPedido (calculado) mudar significativamente
  // ou quando o formulário for resetado
  useEffect(() => {
    if (open && XLinhas.length === 0) {
      setXVlPagar(totalPedido);
    }
  }, [totalPedido, open, XLinhas.length]);

  // Filter conditions by price table payment type ('V' -> Único 'U', 'P' -> Fixo 'F' ou Variável 'V')
  const XFilteredCondicoes = useMemo(() => {
    if (!XCondicoes || XCondicoes.length === 0) return [];
    if (XTpPagamentoTabela === "V") {
      return XCondicoes.filter(c => getTipoPrazoCondicao(c) === "U");
    } else if (XTpPagamentoTabela === "P") {
      return XCondicoes.filter(c => {
        const tp = getTipoPrazoCondicao(c);
        return tp === "F" || tp === "V";
      });
    }
    return XCondicoes;
  }, [XCondicoes, XTpPagamentoTabela]);

  // Filter portadores by selected payment method
  const XFilteredPortadores = useMemo(() => {
    if (!XCondicaoId) return XPortadores;
    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    if (!cond) return XPortadores;

    const mpId = cond.meio_pagamento_id || 0;
    if ([1, 5, 14, 91].includes(mpId)) {
      // Dinheiro / Crediário / Duplicata / Posterior -> banco_id is null or 0
      return XPortadores.filter(p => p.banco_id === null || p.banco_id === 0);
    } else if ([3, 4, 15, 16, 17, 20].includes(mpId)) {
      // Banks / Cards / Boletos / Pix -> banco_id is NOT null and NOT 0
      return XPortadores.filter(p => p.banco_id !== null && p.banco_id !== 0);
    }
    return XPortadores;
  }, [XCondicaoId, XCondicoes, XPortadores]);

  // Sync selected portador with filtered options
  useEffect(() => {
    if (XFilteredPortadores.length > 0) {
      const exists = XFilteredPortadores.some(p => p.portador_id === XPortadorId);
      if (!exists) {
        setXPortadorId(XFilteredPortadores[0].portador_id);
      }
    } else {
      setXPortadorId(0);
    }
  }, [XFilteredPortadores, XPortadorId]);

  const resetForm = (vl: number) => {
    setXCondicaoId(0); setXVlPagar(vl); setXQtParcela(1); setXEditUid(null); setXPortadorId(0);
  };

  // Abre a combobox de Condição de Pagamento ao pressionar Alt + Seta para Baixo
  useEffect(() => {
    if (!open) return;
    const handleDialogKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (condicaoRef.current) {
          condicaoRef.current.focus();
          if (typeof condicaoRef.current.showPicker === 'function') {
            try {
              condicaoRef.current.showPicker();
            } catch (err) {
              console.warn("showPicker error:", err);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", handleDialogKeyDown);
    return () => window.removeEventListener("keydown", handleDialogKeyDown);
  }, [open]);

  const handleVlDesconto = (val: number) => {
    setXVlDesconto(val);
    const sub = XDbTotals.subtotal || subtotalPedido;
    const pc = sub > 0 ? +(val / sub * 100).toFixed(2) : 0;
    setXPcDesconto(pc);
  };

  const handlePcDesconto = (val: number) => {
    setXPcDesconto(val);
    const sub = XDbTotals.subtotal || subtotalPedido;
    const v = +(sub * val / 100).toFixed(2);
    setXVlDesconto(v);
  };

  const confirmarLinha = () => {
    if (!XCondicaoId) { toast.error("Selecione a condição."); return; }
    if (!XPortadorId) { toast.error("Selecione o portador."); return; }
    const vPagar = XVlPagar;
    if (vPagar <= 0) { toast.error("Informe um valor maior que zero."); return; }
    
    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    const tpCond = getTipoPrazoCondicao(cond);

    // Validações de tipo de prazo da condição x tipo de pagamento da tabela de preço
    if (XTpPagamentoTabela === "V" && tpCond !== "U") {
      toast.error("Para Tabela de Preço À Vista, apenas condições de pagamento Único são permitidas.");
      return;
    }
    if (XTpPagamentoTabela === "P" && tpCond !== "F" && tpCond !== "V") {
      toast.error("Para Tabela de Preço À Prazo, apenas condições de pagamento Fixo ou Variável são permitidas.");
      return;
    }

    const novaSomada = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_pagamento || 0) : 0) + vPagar;
    
    if (novaSomada > totalPedido + 0.01) {
      toast.error("Valor pago não pode ultrapassar o total do pedido.");
      return;
    }

    const nParc = getQtdParcelasCondicao(cond);
    const vlParcCalculado = nParc > 0 ? Number((vPagar / nParc).toFixed(2)) : vPagar;

    const linha: IPagamentoLinha = {
      uid: XEditUid || crypto.randomUUID(),
      condicao_id: XCondicaoId,
      condicao_descricao: cond?.descricao || "",
      n_parcelas: nParc,
      vl_parcelas: vlParcCalculado,
      vl_pagamento: vPagar,
      tp_pagamento: "DI", // Default
      portador_id: XPortadorId,
      empresa_id: XEmpresaId,
      movimento_id: movimentoId
    };

    setXLinhas(prev => {
      if (XEditUid) return prev.map(l => l.uid === XEditUid ? linha : l);
      return [...prev, linha];
    });
    setXSelectedIdx(null);
    const restante = Math.max(0, totalPedido - (totalPago + vPagar));
    resetForm(restante);
    setTimeout(() => {
      condicaoRef.current?.focus();
    }, 50);
  };

  const finalizar = async (enviarAoCaixa: boolean = false) => {
    if (XLinhas.length === 0) {
      // Se não há linhas de pagamento, permitimos a finalização (exclusão de todos os pagamentos)
      // e limpamos XDeletadosDb para evitar que onClose os restaure
      setXDeletadosDb([]);
    } else if (totalPago + 0.01 < totalPedido) {
      toast.error("Valor pago é menor que o total do pedido.");
      return;
    }
    
    setXSalvando(true);
    try {
      setXDeletadosDb([]);
      await onConfirmar(XLinhas, vlDescNum, XPcDesconto, enviarAoCaixa);
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error("Erro: " + errMsg);
    } finally {
      setXSalvando(false);
    }
  };

  const handleClose = async () => {
    if (XDeletadosDb.length > 0) {
      try {
        const { error } = await supabase.from("movimento_pagamento")
          .update({ excluido: false })
          .in("movimento_pagamento_id", XDeletadosDb);
        if (error) {
          toast.error("Erro ao restaurar pagamentos cancelados: " + error.message);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        toast.error("Erro ao restaurar pagamentos cancelados: " + errMsg);
      }
    }
    onClose();
  };

  const cols: IGridColumn[] = [
    { key: "condicao_descricao", label: "Condição", width: "1fr" },
    { 
      key: "portador_id", 
      label: "Portador", 
      width: "1.2fr",
      render: r => {
        const p = XPortadores.find(x => x.portador_id === r.portador_id);
        return p ? `${p.cd_portador} - ${p.nome}` : "";
      }
    },
    { key: "n_parcelas", label: "Parc.", width: "60px", align: "right" },
    { key: "vl_parcelas", label: "Vlr Parcela", width: "100px", align: "right", render: r => fmt(r.vl_parcelas) },
    { key: "vl_pagamento", label: "Valor", width: "100px", align: "right", render: r => fmt(r.vl_pagamento) },
    { key: "acoes", label: "", width: "40px", align: "center", render: (r) => (
      <button 
        type="button"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (!confirm("Deseja realmente excluir este pagamento?")) return;
          
          if (r.movimento_pagamento_id) {
            try {
              const { error } = await supabase.from("movimento_pagamento")
                .update({ excluido: true })
                .eq("movimento_pagamento_id", r.movimento_pagamento_id);
              
              if (error) {
                toast.error("Erro ao excluir do banco de dados: " + error.message);
                return;
              }
              
              setXDeletadosDb(prev => [...prev, r.movimento_pagamento_id]);
              toast.success("Pagamento excluído.");
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              toast.error("Erro ao excluir pagamento: " + errMsg);
              return;
            }
          }
          
          setXLinhas(prev => prev.filter(l => l.uid !== r.uid));
        }} 
        className="text-rose-600 hover:text-rose-800 transition-colors p-1"
        title="Excluir"
      >
        <Trash2 size={16} />
      </button>
    )},
  ];

  const handleCalcBtn = (val: string) => {
    if (val === "C") { setXCalcDisplay("0"); return; }
    if (val === "DEL") { setXCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : "0"); return; }
    if (val === ",") { if (!XCalcDisplay.includes(",")) setXCalcDisplay(prev => prev + ","); return; }
    if (XCalcDisplay === "0" || XCalcReset) { setXCalcDisplay(val); setXCalcReset(false); }
    else { setXCalcDisplay(prev => prev + val); }
  };

  const editableDesc = tpDesconto === 'P';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && handleClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2">
          <CreditCard size={18} />
          <h2 className="text-sm font-semibold">Pagamento do Pedido</h2>
        </div>

        <div className="p-4 grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-amber-200 rounded p-3 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart size={14} className="text-amber-600" />
                  <span className="text-[10px] font-bold uppercase">Subtotal</span>
                </div>
                <span className="font-bold text-lg">{fmt(subtotalEfetivo)}</span>
              </div>
              <div className="border border-rose-200 rounded p-3 bg-rose-50 dark:bg-rose-950/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Percent size={14} className="text-rose-600" />
                    <span className="text-[10px] font-bold uppercase">Desconto</span>
                  </div>
                  {editableDesc && (
                    <div className="flex gap-1">
                      <CurrencyInput 
                        value={XPcDesconto} 
                        onChange={handlePcDesconto}
                        decimals={2}
                        className="w-12 text-[10px] text-right border border-rose-300 rounded px-1 bg-white"
                        placeholder="%"
                      />
                      <span className="text-[10px]">%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {editableDesc ? (
                    <CurrencyInput 
                      value={XVlDesconto} 
                      onChange={handleVlDesconto}
                      decimals={2}
                      className="w-full font-bold text-lg bg-transparent border-none focus:outline-none text-right"
                    />
                  ) : (
                    <span className="font-bold text-lg">{fmt(vlDescNum)}</span>
                  )}
                </div>
              </div>
              <div className="border border-emerald-200 rounded p-3 bg-emerald-50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase">Total Líquido</span>
                </div>
                <span className="font-black text-xl text-emerald-700">{fmt(totalPedido)}</span>
              </div>
              <div className="border border-blue-200 rounded p-3 bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRightLeft size={14} className="text-blue-600" />
                  <span className="text-[10px] font-bold uppercase">A Pagar</span>
                </div>
                <span className="font-black text-xl text-blue-700">{fmt(valorRestante)}</span>
              </div>
            </div>

            <div className="border border-border rounded p-3 bg-muted/20 space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="text-[10px] font-bold uppercase">Condição de Pagamento</label>
                  <select 
                    ref={condicaoRef} 
                    value={XCondicaoId} 
                    disabled={valorRestante <= 0 || XSalvando}
                    onChange={e => {
                      const cid = Number(e.target.value);
                      setXCondicaoId(cid);
                      const c = XCondicoes.find(x => x.condicao_id === cid);
                      if (c) setXQtParcela(getQtdParcelasCondicao(c));
                    }} 
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        portadorRef.current?.focus();
                      }
                    }}
                    className="w-full border border-border rounded px-2 py-1 text-sm h-9 bg-white disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value={0}>-- Selecione --</option>
                    {XFilteredCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-bold uppercase">Valor</label>
                  <CurrencyInput 
                    ref={vlPagarRef}
                    value={XVlPagar} 
                    disabled={valorRestante <= 0 || XSalvando}
                    onChange={val => setXVlPagar(val)} 
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        adicionarBtnRef.current?.focus();
                      }
                    }}
                    className="w-full border border-border rounded px-2 py-1 text-sm text-right h-9 font-bold bg-white disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed" 
                  />
                </div>
                <div className="col-span-3 flex items-end">
                  <button 
                    ref={adicionarBtnRef}
                    onClick={confirmarLinha} 
                    disabled={valorRestante <= 0 || XSalvando}
                    className="w-full h-9 rounded bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Adicionar
                  </button>
                </div>
              </div>

              {/* Portador selection row */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12">
                  <label className="text-[10px] font-bold uppercase">Portador</label>
                  <select
                    ref={portadorRef}
                    value={XPortadorId}
                    disabled={valorRestante <= 0 || XSalvando}
                    onChange={e => setXPortadorId(Number(e.target.value))}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        vlPagarRef.current?.focus();
                        vlPagarRef.current?.select();
                      }
                    }}
                    className="w-full border border-border rounded px-2 py-1 text-sm h-9 bg-white disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    <option value={0}>-- Selecione --</option>
                    {XFilteredPortadores.map(p => (
                      <option key={p.portador_id} value={p.portador_id}>
                        {p.cd_portador} - {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <DataGrid columns={cols} data={XLinhas} maxHeight="200px" showRecordCount={false} showExport={false} onRowClick={(_, idx) => setXSelectedIdx(idx)} selectedIdx={XSelectedIdx} />

            <div className="flex justify-between items-center pt-2 gap-2">
              <button onClick={handleClose} className="text-xs px-4 py-2 border border-border rounded hover:bg-accent whitespace-nowrap">Cancelar</button>
              
              <div className="flex gap-2 w-full justify-end">
                <button 
                  ref={finalizarRef} 
                  onClick={() => finalizar(true)} 
                  disabled={XSalvando || (XLinhas.length > 0 && valorRestante > 0.01)} 
                  className="text-xs px-6 py-2 rounded bg-muted/50 border border-border text-emerald-600 font-bold h-10 disabled:opacity-50 hover:bg-accent flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap"
                >
                  {XLinhas.length > 0 && <Lock size={16} className="fill-emerald-600" />}
                  {XSalvando ? "Gravando..." : (XLinhas.length === 0 ? "Finalizar Exclusão" : "Finalizar e Enviar p/ Cx.")}
                </button>
              </div>
            </div>
          </div>

          <div className="col-span-5 bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1 mb-1">
              <Calculator size={14} className="text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase">Calculadora</span>
            </div>
            <div className="bg-white border border-border rounded px-3 py-2 text-right font-mono text-2xl font-bold mb-2 shadow-inner">
              {fmtInput(XCalcDisplay)}
            </div>
            <div className="grid grid-cols-4 gap-2 flex-1">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "C"].map(b => (
                <button key={b} onClick={() => handleCalcBtn(b)} className="h-12 rounded bg-card border border-border font-bold hover:bg-accent transition-colors">{b}</button>
              ))}
              <button onClick={() => handleCalcBtn("DEL")} className="h-12 rounded bg-card border border-border flex items-center justify-center hover:bg-accent text-rose-500"><Delete size={18} /></button>
              <button onClick={() => setXVlPagar(parseNum(XCalcDisplay))} className="col-span-3 h-12 rounded bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors">Usar Valor</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PedidoPagamentoDialog;
