import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { useAppContext } from "@/contexts/AppContext";
import type { IPdvPagamentoLinha, IMovimentoPagamento } from "./types";
import { CreditCard, ShoppingCart, Wallet, ArrowRightLeft, Calculator, X, Delete, Trash2, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

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

interface ICondicao { 
  condicao_id: number; 
  descricao: string; 
  qtd_parcelas: number | null; 
  tipo_prazo?: string | null;
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
  tp_documento?: number | null; 
  plano_conta_id?: number | null; 
  meio_pagamento_id?: number | null; 
}
interface IBandeira { bandeira_id: number; descricao: string; }
interface IOperadora { operadora_id: number; razao: string; }
interface IPortador { portador_id: number; cd_portador: number; nome: string; banco_id: number | null; }

const getQtdParcelasCondicaoPDV = (c: ICondicao | null | undefined): number => {
  if (!c) return 1;
  if (c.qtd_parcelas && c.qtd_parcelas > 0) return c.qtd_parcelas;
  let count = 0;
  for (let i = 1; i <= 12; i++) {
    const key = `prazo_${i}` as keyof ICondicao;
    if (c[key] && Number(c[key]) > 0) count++;
  }
  return count > 0 ? count : 1;
};

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
  const isMobile = useIsMobile();
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XBandeiras, setXBandeiras] = useState<IBandeira[]>([]);
  const [XOperadoras, setXOperadoras] = useState<IOperadora[]>([]);
  const [XPortadores, setXPortadores] = useState<IPortador[]>([]);
  const [XLinhas, setXLinhas] = useState<IPdvPagamentoLinha[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSalvando, setXSalvando] = useState(false);


  // Form fields
  const [XCondicaoId, setXCondicaoId] = useState<number>(0);
  const [XBandeiraId, setXBandeiraId] = useState<number>(0);
  const [XOperadoraId, setXOperadoraId] = useState<number>(0);
  const [XNrAutoriz, setXNrAutoriz] = useState("");
  const [XVlPagar, setXVlPagar] = useState<string>("0,00");
  const [XQtParcela, setXQtParcela] = useState<number>(1);
  const [XEditUid, setXEditUid] = useState<string | null>(null);
  const [XPortadorId, setXPortadorId] = useState<number>(0);

  // Calculator State
  const [XCalcDisplay, setXCalcDisplay] = useState("0");
  const [XCalcMemory, setXCalcMemory] = useState<number | null>(null);
  const [XCalcOp, setXCalcOp] = useState<string | null>(null);
  const [XCalcReset, setXCalcReset] = useState(false);

  const condicaoRef = useRef<HTMLSelectElement>(null);
  const bandeiraRef = useRef<HTMLSelectElement>(null);
  const operadoraRef = useRef<HTMLSelectElement>(null);
  const portadorRef = useRef<HTMLSelectElement>(null);
  const nrAutorizRef = useRef<HTMLInputElement>(null);
  const vlPagarRef = useRef<HTMLInputElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const finalizarRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation: Enter moves to next field, Alt+ArrowDown opens select
  const handleSelectKeyDown = (
    e: React.KeyboardEvent<HTMLSelectElement>,
    nextRef: React.RefObject<HTMLElement | null>,
    skipWhen?: () => boolean
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (skipWhen && skipWhen()) {
        // Skip disabled fields, find next enabled one
        const chain = [bandeiraRef, operadoraRef, nrAutorizRef, vlPagarRef, confirmarRef, finalizarRef];
        const nextIdx = chain.indexOf(nextRef as any);
        if (nextIdx >= 0) {
          for (let i = nextIdx; i < chain.length; i++) {
            const el = chain[i].current;
            if (el && !(el as any).disabled && (el as any).tabIndex !== -1) {
              el.focus();
              return;
            }
          }
        }
        vlPagarRef.current?.focus();
      } else {
        nextRef.current?.focus();
      }
    }
    // ArrowUp/Down changes value without opening dropdown (native behavior)
    // Alt+ArrowDown opens the dropdown (native browser behavior)
  };

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLElement | null>
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const totalPago = useMemo(() => Number(XLinhas.reduce((a, l) => a + Number(l.vl_recebido || 0), 0).toFixed(2)), [XLinhas]);
  const valorAPagar = Number(Math.max(0, totalPedido - totalPago).toFixed(2));
  
  useEffect(() => {
    if (open) {
      console.log("[PagamentoDialog] totalPedido:", totalPedido, "totalPago:", totalPago, "valorAPagar:", valorAPagar);
    }
  }, [open, totalPedido, totalPago, valorAPagar]);

  const troco = totalPago > totalPedido ? totalPago - totalPedido : 0;
  const vlPagarNum = useMemo(() => parseNum(XVlPagar), [XVlPagar]);
  const vlParcela = XQtParcela > 0 ? +(vlPagarNum / XQtParcela).toFixed(2) : vlPagarNum;

  interface IMeioPagamento { meio_pagamento_id: number; descricao: string; }

  const [XMeiosPagamento, setXMeiosPagamento] = useState<IMeioPagamento[]>([]);

  const requerCartao = useCallback((condicaoId: number) => {
    const c = XCondicoes.find(x => x.condicao_id === condicaoId);
    if (!c) return false;

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
  }, [XCondicoes, XMeiosPagamento]);

  // Determina se a condição selecionada exige dados de cartão
  const camposCartaoEditaveis = useMemo(() => {
    return requerCartao(XCondicaoId);
  }, [XCondicaoId, requerCartao]);

  // Filter portadores by selected payment method
  const XFilteredPortadores = useMemo(() => {
    if (!XCondicaoId) return XPortadores;
    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    if (!cond) return XPortadores;

    const mpId = Number(cond.meio_pagamento_id || 0);
    // Se for Dinheiro/Crediário/Duplicata/Posterior (1, 5, 14, 91)
    if ([1, 5, 14, 91].includes(mpId)) {
      return XPortadores.filter(p => p.banco_id === null || p.banco_id === 0);
    }
    // Se for Banco/Cartão/Pix (3, 4, 15, 16, 17, 20)
    if ([3, 4, 15, 16, 17, 20].includes(mpId)) {
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

        // Fetch Condições filtradas pela empresa logada
        let condRes = await db.from("condicao_pagamento")
          .select("condicao_id, descricao, qtd_parcelas, tipo_prazo, prazo_1, prazo_2, prazo_3, prazo_4, prazo_5, prazo_6, prazo_7, prazo_8, prazo_9, prazo_10, prazo_11, prazo_12, plano_conta_id, meio_pagamento_id")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false);
        if (condRes.error || !condRes.data || condRes.data.length === 0) {
           condRes = await db.from("condicao")
             .select("condicao_id, descricao, qtd_parcelas:qt_parcelas, tp_documento, plano_conta_id, meio_pagamento_id")
             .eq("empresa_id", XEmpresaId);
        }
        
        const condList = (condRes.data || []).map((r: any) => ({ ...r, tp_documento: r.tp_documento || null }));
        console.log("PagamentoDialog: Condições carregadas:", condList.length);
        setXCondicoes(condList);

        // Fetch Bandeiras filtradas pela empresa logada
        const bandRes = await db.from("bandeira")
          .select("bandeira_id, descricao")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false)
          .order("descricao");
        console.log("PagamentoDialog: Bandeiras carregadas:", bandRes.data?.length || 0);
        const bandList = bandRes.data || [];
        setXBandeiras(bandList);

        // Fetch Operadoras filtradas pela empresa logada
        const operRes = await db.from("operadora")
          .select("operadora_id, razao")
          .eq("empresa_id", XEmpresaId)
          .order("razao");
        console.log("PagamentoDialog: Operadoras carregadas:", operRes.data?.length || 0);
        const operList = operRes.data || [];
        setXOperadoras(operList);

        // Fetch Portadores
        const portRes = await db.from("portador")
          .select("portador_id, cd_portador, nome, banco_id")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false)
          .eq("ativo", "S")
          .order("nome");
        console.log("PagamentoDialog: Portadores carregados:", portRes.data?.length || 0);
        const portList = portRes.data || [];
        setXPortadores(portList);

        // Pre-populate XLinhas if pre-loaded payments exist
        if (pagtosPreCarregados && pagtosPreCarregados.length > 0) {
          const preenchidos = pagtosPreCarregados.map(p => {
            const cond = condList.find(c => Number(c.condicao_id) === Number(p.condicao_id));
            const band = bandList.find(b => Number(b.bandeira_id) === Number(p.bandeira_id));
            const oper = operList.find(o => Number(o.operadora_id) === Number(p.operadora_id));
            const port = portList.find(o => Number(o.portador_id) === Number(p.portador_id));
            const vRecebido = Number(p.vl_pagamento || 0);
            const qtParc = Number(p.n_parcelas || 1);
            const vlParc = qtParc > 0 ? +(vRecebido / qtParc).toFixed(2) : vRecebido;

            return {
              uid: crypto.randomUUID(),
              condicao_id: Number(p.condicao_id),
              condicao_descricao: cond?.descricao || `Condição ${p.condicao_id}`,
              bandeira_id: p.bandeira_id ? Number(p.bandeira_id) : null,
              bandeira_descricao: band?.descricao || "",
              operadora_id: p.operadora_id ? Number(p.operadora_id) : null,
              operadora_descricao: oper?.razao || (p.operadora_id ? `Operadora ${p.operadora_id}` : ""),
              numero_autoriza: p.numero_autorizacao || "",
              qt_parcela: qtParc,
              vl_parcela: vlParc,
              vl_recebido: vRecebido,
              plano_conta_id: cond?.plano_conta_id || null,
              meio_pagamento_id: cond?.meio_pagamento_id ?? null,
              portador_id: p.portador_id ? Number(p.portador_id) : null,
              portador_descricao: port ? (port.cd_portador ? `${port.cd_portador} - ${port.nome}` : port.nome) : (p.portador_id ? `Portador ${p.portador_id}` : ""),
            };
          });

          // Se houver exatamente UMA linha de pagamento pré-carregada, e o valor dela for diferente
          // do total do pedido (por ex., o pedido foi editado ou o pagamento foi salvo com valor zero/desatualizado),
          // ajustamos automaticamente o valor dela para o total do pedido para evitar redigitação desnecessária.
          if (preenchidos.length === 1) {
            if (preenchidos[0].vl_recebido !== totalPedido) {
              preenchidos[0].vl_recebido = totalPedido;
              const qtParc = preenchidos[0].qt_parcela || 1;
              preenchidos[0].vl_parcela = qtParc > 0 ? +(totalPedido / qtParc).toFixed(2) : totalPedido;
            }
          } else {
            // Se houver múltiplos pagamentos, mas a soma deles tiver uma pequena diferença centesimal/arredondamento
            // (ex: dízima de parcelas de até 10 centavos), ajustamos a última parcela para bater exatamente com o total.
            const somaPreenchidos = preenchidos.reduce((acc, current) => acc + current.vl_recebido, 0);
            const diff = Math.abs(totalPedido - somaPreenchidos);
            if (diff > 0 && diff <= 0.10) {
              const ultimo = preenchidos[preenchidos.length - 1];
              ultimo.vl_recebido = Number((ultimo.vl_recebido + (totalPedido - somaPreenchidos)).toFixed(2));
              const qtParc = ultimo.qt_parcela || 1;
              ultimo.vl_parcela = qtParc > 0 ? +(ultimo.vl_recebido / qtParc).toFixed(2) : ultimo.vl_recebido;
            }
          }

          setXLinhas(preenchidos);
        }

      } catch (err: any) {
        console.error("PagamentoDialog: Erro ao carregar dados:", err);
        toast.error("Erro ao carregar listas de pagamento: " + (err.message || "Erro desconhecido"));
      }
    })();
    // Reset
    setXLinhas([]);
    setXSelectedIdx(null);
    resetForm(totalPedido);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, XEmpresaId, pagtosPreCarregados]);

  // Atualiza vl a pagar quando recalcula (sem edit)
  useEffect(() => {
    if (!XEditUid) setXVlPagar(fmtInput(valorAPagar));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorAPagar, XEditUid]);

  const resetForm = (vl: number) => {
    setXCondicaoId(0); setXBandeiraId(0); setXOperadoraId(0);
    setXNrAutoriz(""); setXVlPagar(fmtInput(vl)); setXQtParcela(1); setXEditUid(null);
    setXPortadorId(0);
  };

  const setCondicao = (cid: number) => {
    setXCondicaoId(cid);
    const c = XCondicoes.find(x => x.condicao_id === cid);
    if (c) setXQtParcela(getQtdParcelasCondicaoPDV(c));
    // Se virou cartão, foca a bandeira
    if (c?.meio_pagamento_id === 3 || c?.meio_pagamento_id === 4) {
      setTimeout(() => bandeiraRef.current?.focus(), 50);
    }
  };

  const confirmarLinha = () => {
    if (!XCondicaoId) { toast.error("Selecione a condição."); return; }
    const vPagar = parseNum(XVlPagar);
    if (vPagar <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (XQtParcela <= 0) { toast.error("Informe quantidade de parcelas."); return; }
    
    if (camposCartaoEditaveis) {
      if (!XBandeiraId) { toast.error("Selecione a bandeira do cartão."); return; }
      if (!XOperadoraId) { toast.error("Selecione a operadora do cartão."); return; }
      if (!XNrAutoriz.trim()) { toast.error("Informe o número de autorização."); return; }
    }

    const cond = XCondicoes.find(c => Number(c.condicao_id) === Number(XCondicaoId));
    const band = XBandeiras.find(b => Number(b.bandeira_id) === Number(XBandeiraId));
    const oper = XOperadoras.find(o => Number(o.operadora_id) === Number(XOperadoraId));
    const port = XPortadores.find(o => Number(o.portador_id) === Number(XPortadorId));

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
      portador_id: XPortadorId || null,
      portador_descricao: port ? (port.cd_portador ? `${port.cd_portador} - ${port.nome}` : port.nome) : (XPortadorId ? `Portador ${XPortadorId}` : ""),
    };

    setXLinhas(prev => XEditUid ? prev.map(l => l.uid === XEditUid ? linha : l) : [...prev, linha]);
    setXSelectedIdx(null);



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
    setXPortadorId(l.portador_id || 0);
  };

  const excluirLinha = (l: IPdvPagamentoLinha | null) => {
    if (!l) { toast.error("Selecione um pagamento."); return; }
    if (!confirm("Excluir este pagamento?")) return;
    setXLinhas(prev => prev.filter(x => x.uid !== l.uid));
    setXSelectedIdx(null);
  };

  const finalizar = async () => {
    console.log("[PagamentoDialog] finalizar clicado. totalPago:", totalPago, "totalPedido:", totalPedido);
    if (XLinhas.length === 0) { 
      console.warn("[PagamentoDialog] Nenhuma linha de pagamento.");
      toast.error("Inclua ao menos um pagamento."); 
      return; 
    }
    if (totalPago + 0.0001 < totalPedido) { 
      console.warn("[PagamentoDialog] Valor insuficiente:", totalPago, "<", totalPedido);
      toast.error("Valor pago é menor que o total do pedido."); 
      return; 
    }

    // Validação de dados de cartão
    for (const linha of XLinhas) {
      if (requerCartao(linha.condicao_id)) {
        if (!linha.bandeira_id || !linha.operadora_id || !linha.numero_autoriza?.trim()) {
          toast.error(`O pagamento de R$ ${fmt(linha.vl_recebido)} na condição "${linha.condicao_descricao}" requer os dados do cartão (Bandeira, Operadora e Autorização). Selecione a linha correspondente, clique em Alterar para preencher e confirme.`);
          return;
        }
      }
    }
    
    // Removido confirm temporariamente para debugar se ele está bloqueando
    console.log("[PagamentoDialog] Iniciando gravação. XSalvando=true");
    setXSalvando(true);
    try {
      console.log("[PagamentoDialog] Chamando onConfirmar com", XLinhas.length, "linhas...");
      await onConfirmar(XLinhas);
      console.log("[PagamentoDialog] onConfirmar retornou com sucesso.");
    } catch (err: any) {
      console.error("[PagamentoDialog] Erro capturado no catch de finalizar:", err);
      toast.error("Erro inesperado: " + (err.message || err));
    } finally {
      console.log("[PagamentoDialog] Finalizando gravação. XSalvando=false");
      setXSalvando(false);
    }
  };

  const colsAll: IGridColumn[] = [
    { key: "condicao_descricao", label: "Condição", width: isMobile ? "120px" : "1fr" },
    { key: "portador_descricao", label: "Portador", width: "160px", render: r => r.portador_descricao || "--" },
    { key: "qt_parcela", label: "Parc.", width: "60px", align: "right" },
    { key: "vl_parcela", label: "Vlr Parcela", width: "100px", align: "right", render: r => fmt(r.vl_parcela) },
    { key: "vl_recebido", label: "Valor", width: "100px", align: "right", render: r => fmt(r.vl_recebido) },
    { key: "acoes", label: "", width: "40px", align: "center", render: r => (
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          excluirLinha(r);
        }} 
        className="text-rose-600 hover:text-rose-700 transition-colors" 
        title="Remover Pagamento"
      >
        <Trash2 size={16} />
      </button>
    )},
  ];
  const cols = isMobile ? colsAll.filter(c => !["qt_parcela", "vl_parcela"].includes(c.key)) : colsAll;

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
      <DialogContent className="max-w-5xl p-0 overflow-hidden w-screen h-[100dvh] max-h-[100dvh] md:max-h-[90vh] md:h-auto md:rounded-lg flex flex-col">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2 shrink-0">
          <CreditCard size={18} />
          <h2 className="text-sm font-semibold">Meios de Pagamento e Prazos</h2>
        </div>

        <div className="md:p-3 overflow-y-auto flex-1 min-h-0 bg-background">
          <div className="h-full grid grid-cols-[repeat(2,100vw)] auto-rows-min gap-y-5 overflow-x-auto overflow-y-auto snap-x snap-mandatory scroll-smooth md:h-auto md:grid-cols-12 md:gap-x-10 md:gap-y-2 md:items-end md:overflow-visible md:auto-rows-auto">
            {/* Row 1: Condição vs Total Pedido */}
            <div className="col-span-7 max-md:col-span-1 max-md:col-start-1 max-md:snap-start max-md:px-3 max-md:pt-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Condição</label>
              <select ref={condicaoRef} value={XCondicaoId} onChange={e => setCondicao(Number(e.target.value))}
                onKeyDown={e => handleSelectKeyDown(e, camposCartaoEditaveis ? bandeiraRef : portadorRef)}
                className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${brancoCls}`}>
                <option value={0}>--</option>
                {XCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
              </select>
            </div>
            <div className="col-span-5 max-md:col-span-1 max-md:col-start-2 max-md:snap-start max-md:px-3 max-md:pt-4">
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

            {/* Row 2: Bandeira e Portador vs Valor Pago */}
            <div className="col-span-7 max-md:col-span-1 max-md:col-start-1 max-md:snap-start max-md:px-3 max-md:pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Bandeira</label>
                  <select
                    ref={bandeiraRef}
                    value={XBandeiraId}
                    onChange={e => setXBandeiraId(Number(e.target.value))}
                    onKeyDown={e => handleSelectKeyDown(e, portadorRef)}
                    disabled={!camposCartaoEditaveis}
                    tabIndex={camposCartaoEditaveis ? 0 : -1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                    <option value={0}>--</option>
                    {XBandeiras.map(b => <option key={b.bandeira_id} value={b.bandeira_id}>{b.descricao}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Portador</label>
                  <select
                    ref={portadorRef}
                    value={XPortadorId}
                    onChange={e => setXPortadorId(Number(e.target.value))}
                    onKeyDown={e => handleSelectKeyDown(e, camposCartaoEditaveis ? operadoraRef : vlPagarRef)}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${brancoCls}`}>
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
            <div className="col-span-5 max-md:col-span-1 max-md:col-start-2 max-md:snap-start max-md:px-3 max-md:pt-4">
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
            <div className="col-span-7 max-md:col-span-1 max-md:col-start-1 max-md:snap-start max-md:px-3 max-md:pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Operadora</label>
                  <select ref={operadoraRef} value={XOperadoraId} onChange={e => setXOperadoraId(Number(e.target.value))}
                    onKeyDown={e => handleSelectKeyDown(e, nrAutorizRef)}
                    disabled={!camposCartaoEditaveis}
                    tabIndex={camposCartaoEditaveis ? 0 : -1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`}>
                    <option value={0}>--</option>
                    {XOperadoras.map(o => <option key={o.operadora_id} value={o.operadora_id}>{o.razao}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Nº Autorização</label>
                  <input ref={nrAutorizRef} value={XNrAutoriz} onChange={e => setXNrAutoriz(e.target.value)}
                    onKeyDown={e => handleInputKeyDown(e, vlPagarRef)}
                    disabled={!camposCartaoEditaveis}
                    tabIndex={camposCartaoEditaveis ? 0 : -1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm h-9 ${camposCartaoEditaveis ? brancoCls : cinzaCls}`} />
                </div>
              </div>
            </div>
            <div className="col-span-5 max-md:col-span-1 max-md:col-start-2 max-md:snap-start max-md:px-3 max-md:pt-4">
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
            <div className="col-span-7 max-md:col-span-1 max-md:col-start-1 max-md:snap-start max-md:px-3 max-md:pt-2">
              <div className="grid grid-cols-8 max-md:grid-cols-5 gap-2 items-end">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-tight mb-1.5 block">Vlr a Pagar</label>
                  <input
                    ref={vlPagarRef}
                    type="text"
                    value={XVlPagar}
                    onChange={e => setXVlPagar(e.target.value)}
                    onBlur={() => setXVlPagar(fmtInput(XVlPagar))}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={e => handleInputKeyDown(e, confirmarRef)}
                    className={`w-full border border-border rounded px-2 py-1 text-sm text-right h-9 font-bold ${brancoCls}`}
                  />
                </div>
                <div className="col-span-1 max-md:hidden">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Vezes</label>
                  <input type="number" value={XQtParcela} readOnly tabIndex={-1}
                    className={`w-full border border-border rounded px-2 py-1 text-sm text-right bg-secondary h-9 ${NO_SPIN}`} />
                </div>
                <div className="col-span-2 max-md:hidden">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1 block">Vlr Parcela</label>
                  <div tabIndex={-1} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right text-foreground select-text h-9 flex items-center justify-end font-medium">
                    {fmt(vlParcela)}
                  </div>
                </div>
                <div className="col-span-3 flex gap-1">
                  <button ref={confirmarRef} onClick={confirmarLinha}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmarLinha(); } }}
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
            <div className="col-span-5 max-md:col-span-1 max-md:col-start-2 max-md:snap-start max-md:px-3 max-md:pt-4">
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
            <div className="col-span-7 max-md:col-span-1 max-md:col-start-1 max-md:snap-start max-md:px-3 flex flex-col pt-2 self-stretch">
              <div className="flex-1">
                <DataGrid
                  columns={cols}
                  data={XLinhas}
                  maxHeight="250px"
                  exportTitle="Pagamentos"
                  showRecordCount={false}
                  showExport={false}
                  headerClassName="bg-topbar text-topbar-foreground text-[10px] uppercase tracking-wider font-bold"
                  onRowClick={(_, idx) => setXSelectedIdx(idx)}
                  onRowDoubleClick={(r) => editarLinha(r)}
                  selectedIdx={XSelectedIdx}
                />
              </div>
              <div className="flex justify-start gap-2 pt-4 pb-4 md:pb-2">
                <button ref={finalizarRef} onClick={finalizar} disabled={XSalvando || valorAPagar > 0.001}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); finalizar(); } }}
                  className="text-xs px-6 py-2 rounded bg-primary text-primary-foreground disabled:opacity-50 font-bold h-9">
                  {XSalvando ? "Gravando..." : "Finalizar Recebimento →"}
                </button>
                <button onClick={onClose} disabled={XSalvando}
                  className="text-xs px-4 py-2 rounded border border-border hover:bg-accent flex items-center gap-1">
                  <X size={14} /> Sair
                </button>
              </div>
            </div>
            <div className="col-span-5 max-md:col-span-1 max-md:col-start-2 max-md:snap-start max-md:px-3 flex flex-col pt-2 self-stretch">
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
