import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { useAppContext } from "@/contexts/AppContext";
import type { IPdvPagamentoLinha, IMovimentoPagamento } from "./types";
import { CreditCard, ShoppingCart, Wallet, ArrowRightLeft, Calculator, X, Delete, Trash2, Check } from "lucide-react";

const db = supabase as any;

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const parseNum = (v: any) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmtInput = (v: any) => {
  const n = typeof v === "number" ? v : parseNum(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatVisor = (v: string) => {
  if (!v) return "0,00";
  if (v === "-") return "-";
  const parts = v.split(",");
  const integerPart = parts[0].replace(/\./g, "");
  if (!integerPart && parts.length > 1) return `0,${parts[1]}`;
  
  const n = parseInt(integerPart || "0");
  const formattedInteger = integerPart.startsWith("-") && n === 0 ? "-0" : n.toLocaleString("pt-BR");
  
  return parts.length > 1 ? `${formattedInteger},${parts[1]}` : formattedInteger;
};

interface ICondicao { condicao_id: number; descricao: string; qtd_parcelas: number | null; tp_documento?: number | null; plano_conta_id?: number | null; meio_pagamento_id?: number | null; }
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
  const [XVlPagar, setXVlPagar] = useState<string>("0,00");
  const [XQtParcela, setXQtParcela] = useState<number>(1);
  const [XEditUid, setXEditUid] = useState<string | null>(null);

  // Calculator State
  const [XCalcDisplay, setXCalcDisplay] = useState("0");
  const [XCalcMemory, setXCalcMemory] = useState<number | null>(null);
  const [XCalcOp, setXCalcOp] = useState<string | null>(null);
  const [XCalcReset, setXCalcReset] = useState(false);

  const bandeiraRef = useRef<HTMLSelectElement>(null);
  const condicaoRef = useRef<HTMLSelectElement>(null);
  const finalizarRef = useRef<HTMLButtonElement>(null);

  const totalPago = useMemo(() => XLinhas.reduce((a, l) => a + Number(l.vl_recebido || 0), 0), [XLinhas]);
  const valorAPagar = Math.max(0, totalPedido - totalPago);
  const troco = totalPago > totalPedido ? totalPago - totalPedido : 0;
  const vlPagarNum = useMemo(() => parseNum(XVlPagar), [XVlPagar]);
  const vlParcela = XQtParcela > 0 ? +(vlPagarNum / XQtParcela).toFixed(2) : vlPagarNum;

  interface IMeioPagamento { meio_pagamento_id: number; descricao: string; }

  const [XMeiosPagamento, setXMeiosPagamento] = useState<IMeioPagamento[]>([]);

  // Determina se a condição selecionada exige dados de cartão
  const camposCartaoEditaveis = useMemo(() => {
    const c = XCondicoes.find(x => x.condicao_id === XCondicaoId);
    if (!c) return false;
    
    console.log("PagamentoDialog: Verificando se condicao", XCondicaoId, "é cartão. meio_pagamento_id:", c.meio_pagamento_id);

    // Check by ID (3=Crédito, 4=Débito are defaults, but let's be more flexible)
    if ([3, 4, 10, 11].includes(c.meio_pagamento_id || 0)) return true;
    
    // Check by description in MeioPagamento if available
    const mp = XMeiosPagamento.find(m => m.meio_pagamento_id === c.meio_pagamento_id);
    if (mp) {
      const desc = mp.descricao.toLowerCase();
      if (desc.includes("cartão") || desc.includes("cartao") || desc.includes("card") || desc.includes("débito") || desc.includes("debito") || desc.includes("crédito") || desc.includes("credito")) return true;
    }
    
    // Check by condition description as last resort
    const cDesc = c.descricao.toLowerCase();
    if (cDesc.includes("cartão") || cDesc.includes("cartao") || cDesc.includes("débito") || cDesc.includes("debito")) return true;
    
    return false;
  }, [XCondicoes, XCondicaoId, XMeiosPagamento]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        console.log("PagamentoDialog: Iniciando carga de dados. Empresa:", XEmpresaId);
        
        // Fetch Meios de Pagamento (sem filtros para garantir)
        const mpRes = await db.from("meio_pagamento").select("meio_pagamento_id, descricao");
        if (mpRes.data) {
          setXMeiosPagamento(mpRes.data);
          console.log("PagamentoDialog: Meios de pagamento carregados:", mpRes.data.length);
        } else if (mpRes.error) {
          console.warn("PagamentoDialog: Erro ao carregar meio_pagamento:", mpRes.error);
        }

        // Fetch Condições (sem filtros restritivos no início)
        let condRes = await db.from("condicao_pagamento").select("condicao_id, descricao, qtd_parcelas, plano_conta_id, meio_pagamento_id");
        if (condRes.error || !condRes.data || condRes.data.length === 0) {
           condRes = await db.from("condicao").select("condicao_id, descricao, qtd_parcelas:qt_parcelas, tp_documento, plano_conta_id, meio_pagamento_id");
        }
        
        const condList = (condRes.data || []).map((r: any) => ({ ...r, tp_documento: r.tp_documento || null }));
        console.log("PagamentoDialog: Condições carregadas:", condList.length);
        setXCondicoes(condList);

        // Fetch Bandeiras - Sem filtro de exclusão para teste
        let bandRes = await db.from("bandeira").select("bandeira_id, descricao").eq("empresa_id", XEmpresaId).order("descricao");
        if (bandRes.error || !bandRes.data || bandRes.data.length === 0) {
          console.warn("PagamentoDialog: Nenhuma bandeira com empresa_id", XEmpresaId, "tentando geral...");
          bandRes = await db.from("bandeira").select("bandeira_id, descricao").order("descricao");
        }
        console.log("PagamentoDialog: Bandeiras carregadas:", bandRes.data?.length || 0);
        if (bandRes.data) setXBandeiras(bandRes.data);

        // Fetch Operadoras - Sem filtro de exclusão para teste
        let operRes = await db.from("operadora").select("operadora_id, razao").eq("empresa_id", XEmpresaId).order("razao");
        if (operRes.error || !operRes.data || operRes.data.length === 0) {
          console.warn("PagamentoDialog: Nenhuma operadora com empresa_id", XEmpresaId, "tentando geral...");
          operRes = await db.from("operadora").select("operadora_id, razao").order("razao");
        }
        console.log("PagamentoDialog: Operadoras carregadas:", operRes.data?.length || 0);
        if (operRes.data) setXOperadoras(operRes.data);

      } catch (err: any) {
        console.error("PagamentoDialog: Erro ao carregar dados:", err);
        toast.error("Erro ao carregar listas de pagamento: " + (err.message || "Erro desconhecido"));
      }
    })();
    // Reset
    setXLinhas([]);
    setXSelectedIdx(null);
    resetForm(totalPedido);
    setXFila([...(pagtosPreCarregados || [])]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, XEmpresaId]);

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
    setXVlPagar(fmtInput(v > 0 ? Math.min(v, restante) : restante));
  };

  // Atualiza vl a pagar quando recalcula (sem fila, sem edit)
  useEffect(() => {
    if (!XEditUid && XFila.length === 0) setXVlPagar(fmtInput(valorAPagar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAPagar, XEditUid]);

  const resetForm = (vl: number) => {
    setXCondicaoId(0); setXBandeiraId(0); setXOperadoraId(0);
    setXNrAutoriz(""); setXVlPagar(fmtInput(vl)); setXQtParcela(1); setXEditUid(null);
  };

  const setCondicao = (cid: number) => {
    setXCondicaoId(cid);
    const c = XCondicoes.find(x => x.condicao_id === cid);
    if (c?.qtd_parcelas) setXQtParcela(c.qtd_parcelas);
    // Se virou cartão, foca a bandeira
    if (c?.meio_pagamento_id === 3 || c?.meio_pagamento_id === 4) {
      setTimeout(() => bandeiraRef.current?.focus(), 50);
    }
  };

  const confirmarLinha = () => {
    if (!XCondicaoId) { toast.error("Selecione a condição."); return; }
    let vPagar = parseNum(XVlPagar);
    if (vPagar <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (XQtParcela <= 0) { toast.error("Informe quantidade de parcelas."); return; }
    
    if (camposCartaoEditaveis) {
      if (!XBandeiraId) { toast.error("Selecione a bandeira do cartão."); return; }
      if (!XOperadoraId) { toast.error("Selecione a operadora do cartão."); return; }
      if (!XNrAutoriz.trim()) { toast.error("Informe o número de autorização."); return; }
    }

    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    const band = XBandeiras.find(b => b.bandeira_id === XBandeiraId);
    const oper = XOperadoras.find(o => o.operadora_id === XOperadoraId);

    const novaSomada = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_recebido || 0) : 0) + vPagar;
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
      vl_recebido: vPagar,
      plano_conta_id: cond?.plano_conta_id || null,
      meio_pagamento_id: cond?.meio_pagamento_id ?? null,
    };

    setXLinhas(prev => XEditUid ? prev.map(l => l.uid === XEditUid ? linha : l) : [...prev, linha]);
    setXSelectedIdx(null);

    // Avança a fila
    const novaFila = XFila.slice(1);
    setXFila(novaFila);

    // Calcula novo restante para próximo
    const novoTotalPago = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_recebido || 0) : 0) + vPagar;
    const restante = Math.max(0, totalPedido - novoTotalPago);
    resetForm(restante);

    // Foco inteligente
    setTimeout(() => {
      if (restante > 0.001) {
        condicaoRef.current?.focus();
      } else {
        finalizarRef.current?.focus();
      }
    }, 100);

    // Se restante > 0 e ainda há item na fila, será pré-preenchido pelo effect.
  };

  const editarLinha = (l: IPdvPagamentoLinha | null) => {
    if (!l) { toast.error("Selecione um pagamento."); return; }
    setXEditUid(l.uid);
    setXCondicaoId(l.condicao_id);
    setXBandeiraId(l.bandeira_id || 0);
    setXOperadoraId(l.operadora_id || 0);
    setXNrAutoriz(l.numero_autoriza || "");
    setXVlPagar(fmtInput(l.vl_recebido));
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
    { key: "condicao_descricao", label: "Condição", width: "1fr" },
    { key: "qt_parcela", label: "Parc.", width: "60px", align: "right" },
    { key: "vl_parcela", label: "Vlr Parcela", width: "100px", align: "right", render: r => fmt(r.vl_parcela) },
    { key: "vl_recebido", label: "Valor", width: "100px", align: "right", render: r => fmt(r.vl_recebido) },
    { key: "acoes", label: "", width: "40px", align: "center", render: r => (
      <button onClick={() => excluirLinha(r)} className="text-rose-600 hover:text-rose-700 transition-colors" title="Remover Pagamento">
        <Trash2 size={16} />
      </button>
    )},
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

  /* --- Calculator logic --- */
  const handleCalcBtn = (val: string) => {
    if (val === "C") {
      setXCalcDisplay("0");
      setXCalcMemory(null);
      setXCalcOp(null);
      return;
    }
    if (val === "DEL") {
      setXCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : "0");
      return;
    }
    if (["+", "-", "*", "/"].includes(val)) {
      setXCalcMemory(parseFloat(XCalcDisplay.replace(",", ".")));
      setXCalcOp(val);
      setXCalcReset(true);
      return;
    }
    if (val === "=") {
      if (XCalcOp && XCalcMemory !== null) {
        const cur = parseFloat(XCalcDisplay.replace(",", "."));
        let res = 0;
        if (XCalcOp === "+") res = XCalcMemory + cur;
        if (XCalcOp === "-") res = XCalcMemory - cur;
        if (XCalcOp === "*") res = XCalcMemory * cur;
        if (XCalcOp === "/") res = XCalcMemory / cur;
        setXCalcDisplay(String(res).replace(".", ","));
        setXCalcMemory(null);
        setXCalcOp(null);
      }
      return;
    }
    if (val === ",") {
      if (!XCalcDisplay.includes(",")) setXCalcDisplay(prev => prev + ",");
      return;
    }
    // Number
    if (XCalcDisplay === "0" || XCalcReset) {
      setXCalcDisplay(val);
      setXCalcReset(false);
    } else {
      setXCalcDisplay(prev => prev + val);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2 shrink-0">
          <CreditCard size={18} />
          <h2 className="text-sm font-semibold">Meios de Pagamento e Prazos</h2>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-12 gap-x-10 gap-y-2 items-end">
            {/* Row 1: Condição vs Total Pedido */}
            <div className="col-span-7">
              <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Condição</label>
              <select ref={condicaoRef} value={XCondicaoId} onChange={e => setCondicao(Number(e.target.value))}
                className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${brancoCls}`}>
                <option value={0}>--</option>
                {XCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
              </select>
            </div>
            <div className="col-span-5">
              <div 
                onClick={() => setXCalcDisplay(totalPedido.toFixed(2).replace(".", ","))}
                className="border border-amber-300 rounded px-3 py-1 bg-amber-50 dark:bg-amber-950/30 flex justify-between items-center h-9 cursor-pointer hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart size={14} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] text-amber-900 dark:text-amber-200 font-bold uppercase">Total Pedido</span>
                </div>
                <span className="font-bold text-lg text-amber-900 dark:text-amber-200">{fmt(totalPedido)}</span>
              </div>
            </div>

            {/* Row 2: Bandeira vs Valor Pago */}
            <div className="col-span-7">
              <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Bandeira</label>
              <select
                ref={bandeiraRef}
                value={XBandeiraId}
                onChange={e => setXBandeiraId(Number(e.target.value))}
                disabled={!camposCartaoEditaveis}
                tabIndex={camposCartaoEditaveis ? 0 : -1}
                className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                <option value={0}>--</option>
                {XBandeiras.map(b => <option key={b.bandeira_id} value={b.bandeira_id}>{b.descricao}</option>)}
              </select>
            </div>
            <div className="col-span-5">
              <div 
                onClick={() => setXCalcDisplay(totalPago.toFixed(2).replace(".", ","))}
                className="border border-emerald-200 rounded px-3 py-1 bg-emerald-50/60 dark:bg-emerald-950/20 flex justify-between items-center h-9 cursor-pointer hover:bg-emerald-100/50 transition-colors">
                <div className="flex items-center gap-1.5">
                  <Wallet size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-200 font-bold uppercase">Valor Pago</span>
                </div>
                <span className="font-bold text-lg text-emerald-800 dark:text-emerald-200">{fmt(totalPago)}</span>
              </div>
            </div>

            {/* Row 3: Operadora/Autoriz vs Valor a Pagar */}
            <div className="col-span-7">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Operadora</label>
                  <select value={XOperadoraId} onChange={e => setXOperadoraId(Number(e.target.value))}
                    disabled={!camposCartaoEditaveis}
                    tabIndex={camposCartaoEditaveis ? 0 : -1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                    <option value={0}>--</option>
                    {XOperadoras.map(o => <option key={o.operadora_id} value={o.operadora_id}>{o.razao}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Nº Autorização</label>
                  <input value={XNrAutoriz} onChange={e => setXNrAutoriz(e.target.value)}
                    disabled={!camposCartaoEditaveis}
                    tabIndex={camposCartaoEditaveis ? 0 : -1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`} />
                </div>
              </div>
            </div>
            <div className="col-span-5">
              <div 
                onClick={() => setXCalcDisplay(valorAPagar.toFixed(2).replace(".", ","))}
                className={`border rounded px-3 py-1 flex justify-between items-center h-9 cursor-pointer transition-colors border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/50`}>
                <div className="flex items-center gap-1.5">
                  <CreditCard size={14} className="text-rose-600 dark:text-rose-400" />
                  <span className="text-[11px] font-bold uppercase text-rose-800 dark:text-rose-200">Valor a Pagar</span>
                </div>
                <span className="font-black text-xl text-rose-700 dark:text-rose-300">{fmt(valorAPagar)}</span>
              </div>
            </div>

            {/* Row 4: Valores vs Troco */}
            <div className="col-span-7">
              <div className="grid grid-cols-8 gap-2 items-end">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Vlr a Pagar</label>
                  <input
                    type="text"
                    value={XVlPagar}
                    onChange={e => setXVlPagar(e.target.value)}
                    onBlur={() => setXVlPagar(fmtInput(XVlPagar))}
                    onFocus={(e) => e.target.select()}
                    className={`w-full border border-border rounded px-2 py-1 text-sm text-right h-9 font-bold ${brancoCls}`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Vezes</label>
                  <input type="number" value={XQtParcela} readOnly tabIndex={-1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm text-right bg-secondary h-9 ${NO_SPIN}`} />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Vlr Parcela</label>
                  <div tabIndex={-1} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right text-foreground select-text h-9 flex items-center justify-end font-medium">
                    {fmt(vlParcela)}
                  </div>
                </div>
                <div className="col-span-3 flex gap-1">
                  <button onClick={confirmarLinha}
                    className="flex-1 h-9 rounded bg-emerald-500 text-white flex items-center justify-center gap-1 hover:bg-emerald-600 transition-colors text-xs font-bold">
                    ✓ Confirmar
                  </button>
                  {XEditUid && (
                    <button onClick={() => resetForm(valorAPagar)} title="Cancelar Edição"
                      className="w-8 h-9 rounded border border-border flex items-center justify-center hover:bg-accent text-destructive">
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-5">
              <div 
                onClick={() => setXCalcDisplay(troco.toFixed(2).replace(".", ","))}
                className={`border rounded px-3 py-1 flex justify-between items-center h-9 cursor-pointer transition-colors border-blue-400 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100`}>
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft size={14} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-[11px] font-bold uppercase text-blue-900 dark:text-blue-200">Troco</span>
                </div>
                <span className="font-bold text-lg text-blue-700 dark:text-blue-300">{fmt(troco)}</span>
              </div>
            </div>

            {/* Row 5: Grid vs Calculator */}
            <div className="col-span-7 flex flex-col pt-2 self-stretch">
              <div className="flex-1">
                <DataGrid
                  columns={cols}
                  data={XLinhas}
                  maxHeight="420px"
                  exportTitle="Pagamentos"
                  showRecordCount={false}
                  showExport={false}
                  headerClassName="bg-topbar text-topbar-foreground text-[10px] uppercase tracking-wider font-bold"
                  onRowClick={(_, idx) => setXSelectedIdx(idx)}
                  onRowDoubleClick={(r) => editarLinha(r)}
                  selectedIdx={XSelectedIdx}
                />
              </div>
              <div className="flex justify-start gap-2 pt-4">
                <button onClick={onClose} disabled={XSalvando}
                  className="text-xs px-4 py-2 rounded border border-border hover:bg-accent flex items-center gap-1">
                  <X size={14} /> Sair
                </button>
                <button ref={finalizarRef} onClick={finalizar} disabled={XSalvando || valorAPagar > 0.001}
                  className="text-xs px-6 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 font-bold h-9">
                  {XSalvando ? "Gravando..." : "Finalizar Recebimento →"}
                </button>
              </div>
            </div>
            <div className="col-span-5 flex flex-col pt-2 self-stretch">
              {/* Calculadora compacta ocupando o resto da altura */}
              <div className="flex-1 bg-muted/30 border border-border rounded-lg p-2 flex flex-col gap-1 shadow-inner min-h-[350px]">
                <div className="flex items-center gap-1 mb-1 px-1">
                  <Calculator size={12} className="text-muted-foreground" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Calculadora</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-2 py-1 text-right font-mono text-lg font-bold mb-1 truncate text-blue-900 dark:text-blue-100 shadow-inner">
                  {fmtInput(XCalcDisplay)}
                </div>
                <div className="grid grid-cols-4 gap-1 flex-1">
                  {["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ",", "C", "+"].map(b => (
                    <button key={b} onClick={() => handleCalcBtn(b)}
                      className="h-full min-h-[30px] rounded bg-card border border-border text-[10px] font-bold hover:bg-accent transition-colors">
                      {b}
                    </button>
                  ))}
                  
                  <button onClick={() => handleCalcBtn("DEL")} className="h-full min-h-[30px] rounded bg-card border border-border flex items-center justify-center hover:bg-accent text-rose-500">
                    <Delete size={12} />
                  </button>
                  <button onClick={() => handleCalcBtn("=")} className="col-span-2 h-full min-h-[30px] rounded bg-primary/20 text-primary text-[10px] font-bold hover:bg-primary/30 border border-primary/30">
                    =
                  </button>
                  <button onClick={() => setXVlPagar(fmtInput(XCalcDisplay))} className="h-full min-h-[30px] rounded bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors">
                    <Check size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PagamentoDialog;
