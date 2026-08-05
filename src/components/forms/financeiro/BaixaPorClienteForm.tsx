import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { HandCoins, RefreshCw, Search, CheckCircle, AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import ClienteSearchDialog, { type IClienteRow } from "../pedido/ClienteSearchDialog";

interface IContaOpt { conta_id: string; nome_conta: string; }
interface IMeioPagOpt { meio_pagamento_id: number; codigo: string; descricao: string; }
interface IPortadorOpt { portador_id: number; nome: string; conta_id: string | null; cd_portador?: number | null; }
interface ICondicaoPagOpt { condicao_id: number; descricao: string; meio_pagamento_id: number | null; tipo_prazo: string | null; }

interface IOpenTitle {
  empresa_id: number | null;
  financeiro_id: number | null;
  documento: string | null;
  cadastro_id: number | null;
  vl_a_pagar: number | null;
  vl_pago: number | null;
  vl_titulo: number | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  situacao: string | null;
  plano_id: number | null;
}

interface IPagamentoLinha {
  uid: string;
  meio_pagamento_id: number;
  meio_pagamento_descricao: string;
  portador_id: number;
  portador_nome: string;
  numero_documento: string; // Salvo na coluna 'recibo'
  observacao: string;
  vl_recebido: number;
  conta_id: string | null;
  prazo: string;
}

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const maskMoney = (value: string | number): string => {
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "0,00";
  const numValue = parseInt(cleanValue, 10) / 100;
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoneyToFloat = (val: string): number => {
  const clean = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// IDs de Meios de Pagamento permitidos (incluindo Cartão de Crédito - 3)
const MEIOS_A_VISTA_IDS = [1, 2, 3, 4, 16, 17, 18, 20];

const BaixaPorClienteForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  
  // Opções carregadas do banco
  const [XPortadores, setXPortadores] = useState<IPortadorOpt[]>([]);
  const [XMeiosPagamento, setXMeiosPagamento] = useState<IMeioPagOpt[]>([]);
  const [XCondicoes, setXCondicoes] = useState<ICondicaoPagOpt[]>([]);
  
  // Seleção de cliente
  const [XCadastroId, setXCadastroId] = useState<string>("");
  const [XClienteNome, setXClienteNome] = useState<string>("");
  const [XSearchOpen, setXSearchOpen] = useState(false);
  
  // Títulos e Seleções
  const [XOpenTitles, setXOpenTitles] = useState<IOpenTitle[]>([]);
  const [XSelectedIds, setXSelectedIds] = useState<number[]>([]);
  
  // Lista local de pagamentos
  const [XLinhasPagamento, setXLinhasPagamento] = useState<IPagamentoLinha[]>([]);
  
  // Inputs do formulário de pagamento
  const [XMeioId, setXMeioId] = useState<string>("");
  const [XPrazo, setXPrazo] = useState<string>("A VISTA");
  const [XPortadorId, setXPortadorId] = useState<string>("");
  const [XNrDocumento, setXNrDocumento] = useState<string>(""); // Nº Doc Transação / Recibo
  const [XValorLinha, setXValorLinha] = useState<string>("0,00");
  const [XObservacao, setXObservacao] = useState<string>("");
  
  // Loadings
  const [XLoading, setXLoading] = useState(false);
  const [XFetchingTitles, setXFetchingTitles] = useState(false);

  // Refs de inputs para controle de foco via teclado (Enter-key navigation)
  const meioRef = useRef<HTMLSelectElement>(null);
  const prazoRef = useRef<HTMLSelectElement>(null);
  const portadorRef = useRef<HTMLSelectElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);
  const obsRef = useRef<HTMLInputElement>(null);

  // Computa se o prazo está disponível e quais opções de parcelamento exibir
  const selectedMeio = useMemo(() => {
    return XMeiosPagamento.find(m => m.meio_pagamento_id === Number(XMeioId));
  }, [XMeioId, XMeiosPagamento]);

  const prazoOptions = useMemo(() => {
    if (!XMeioId) return [];
    
    const meioId = Number(XMeioId);
    const meio = XMeiosPagamento.find(m => m.meio_pagamento_id === meioId);
    const codigoMeio = meio?.codigo || "";
    const descMeio = (meio?.descricao || "").toUpperCase();
    
    // Filtra condições que correspondam ao meio_pagamento_id, tipo_prazo, ou por texto na descrição
    const matchingConds = XCondicoes.filter(c => {
      // 1. Se a condição tiver correspondência direta por ID ou código NFe
      if (c.meio_pagamento_id === meioId) return true;
      if (c.tipo_prazo === codigoMeio && codigoMeio !== "") return true;
      
      // 2. Correspondência flexível por texto na descrição para contornar cadastros inconsistentes no banco
      const descCond = (c.descricao || "").toUpperCase();
      const isCardCond = descCond.includes("CRÉDITO") || descCond.includes("CREDITO") || descCond.includes("CARTÃO") || descCond.includes("CARTAO");
      const isChequeCond = descCond.includes("CHEQUE");
      const isPixCond = descCond.includes("PIX");
      const isDinheiroCond = descCond.includes("DINHEIRO");
      
      if (isCardCond) {
        return descMeio.includes("CRÉDITO") || descMeio.includes("CREDITO") || descMeio.includes("CARTÃO") || descMeio.includes("CARTAO");
      }
      if (isChequeCond) {
        return descMeio.includes("CHEQUE");
      }
      if (isPixCond) {
        return descMeio.includes("PIX");
      }
      if (isDinheiroCond) {
        return descMeio.includes("DINHEIRO");
      }
      
      return false;
    });
    
    if (matchingConds.length > 0) {
      return matchingConds.map(c => ({
        value: String(c.condicao_id),
        label: c.descricao
      }));
    }
    
    // Fallback: se não houver condição cadastrada, mostra apenas "À vista"
    return [{ value: "A VISTA", label: "À vista" }];
  }, [XMeioId, XCondicoes, XMeiosPagamento]);

  const isPrazoAvailable = useMemo(() => {
    return prazoOptions.length > 1;
  }, [prazoOptions]);

  const selectedPrazoDesc = useMemo(() => {
    if (XPrazo === "A VISTA") return "À vista";
    const cond = XCondicoes.find(c => String(c.condicao_id) === XPrazo);
    return cond ? cond.descricao : XPrazo;
  }, [XPrazo, XCondicoes]);

  // Carregar meios de pagamento, portadores e condições de pagamento
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const [meioRes, portRes, condRes] = await Promise.all([
        supabase.from("meio_pagamento").select("meio_pagamento_id, codigo, descricao").order("descricao"),
        supabase.from("portador")
          .select("portador_id, cd_portador, nome, conta_id")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false)
          .eq("ativo", "S")
          .order("nome"),
        supabase.from("condicao_pagamento")
          .select("condicao_id, descricao, meio_pagamento_id, tipo_prazo")
          .eq("empresa_id", XEmpresaId)
          .eq("excluido", false)
          .order("descricao")
      ]);

      if (meioRes.data) {
        // Filtrar apenas formas permitidas
        const aVista = (meioRes.data as IMeioPagOpt[]).filter(m => MEIOS_A_VISTA_IDS.includes(m.meio_pagamento_id));
        setXMeiosPagamento(aVista);
      }
      if (portRes.data) setXPortadores(portRes.data as IPortadorOpt[]);
      if (condRes.data) setXCondicoes(condRes.data as ICondicaoPagOpt[]);
    })();
  }, [XEmpresaId]);

  // Carregar títulos em aberto do cliente selecionado
  const fetchOpenTitles = useCallback(async (cadastroId: number) => {
    if (!cadastroId) return;
    setXFetchingTitles(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_view")
        .select("empresa_id, financeiro_id, documento, cadastro_id, vl_a_pagar, vl_pago, vl_titulo, dt_emissao, dt_vencto, situacao, plano_id, tp_conta")
        .eq("tp_conta", "R")
        .eq("cadastro_id", cadastroId)
        .gt("vl_a_pagar", 0)
        .not("situacao", "eq", "CANCELADO")
        .order("dt_vencto", { ascending: true });

      if (error) throw error;
      
      const titles = (data ?? []) as IOpenTitle[];
      setXOpenTitles(titles);
      
      // Pré-seleciona todos por padrão
      setXSelectedIds(titles.map(t => t.financeiro_id!).filter(Boolean));
    } catch (e: any) {
      toast.error("Erro ao buscar títulos: " + (e?.message || String(e)));
    } finally {
      setXFetchingTitles(false);
    }
  }, []);

  // Recarrega os títulos quando mudar o cliente
  useEffect(() => {
    if (XCadastroId) {
      fetchOpenTitles(Number(XCadastroId));
    } else {
      setXOpenTitles([]);
      setXSelectedIds([]);
    }
  }, [XCadastroId, fetchOpenTitles]);

  // Limpa tudo
  const limpar = () => {
    setXCadastroId("");
    setXClienteNome("");
    setXOpenTitles([]);
    setXSelectedIds([]);
    setXLinhasPagamento([]);
    resetFormPagamento(0);
  };

  // Alterna seleção individual
  const handleToggleSelect = (id: number) => {
    setXSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Seleciona/desmarca todos
  const handleSelectAll = () => {
    if (XSelectedIds.length === XOpenTitles.length) {
      setXSelectedIds([]);
    } else {
      setXSelectedIds(XOpenTitles.map(t => t.financeiro_id!).filter(Boolean));
    }
  };

  // Reseta inputs do formulário de inserção de pagamentos
  const resetFormPagamento = (vlSugerido: number) => {
    setXMeioId("");
    setXPrazo("A VISTA");
    setXPortadorId("");
    setXNrDocumento("");
    setXObservacao("");
    setXValorLinha(maskMoney(vlSugerido));
  };

  // Alteração de Meio de Pagamento auto-seleciona o Portador adequado e pré-seleciona o primeiro prazo
  const handleMeioChange = (val: string) => {
    setXMeioId(val);
    if (!val) {
      setXPrazo("A VISTA");
      setXPortadorId("");
      return;
    }
    const meioId = Number(val);
    const meio = XMeiosPagamento.find(m => m.meio_pagamento_id === meioId);
    if (!meio) {
      setXPrazo("A VISTA");
      return;
    }
    
    const codigoMeio = meio.codigo || "";
    const descMeio = (meio.descricao || "").toUpperCase();
    
    const matchingConds = XCondicoes.filter(c => {
      const descCond = (c.descricao || "").toUpperCase();
      const isCardCond = descCond.includes("CRÉDITO") || descCond.includes("CREDITO") || descCond.includes("CARTÃO") || descCond.includes("CARTAO");
      const isChequeCond = descCond.includes("CHEQUE");
      const isPixCond = descCond.includes("PIX");
      const isDinheiroCond = descCond.includes("DINHEIRO");
      
      if (isCardCond) {
        return descMeio.includes("CRÉDITO") || descMeio.includes("CREDITO") || descMeio.includes("CARTÃO") || descMeio.includes("CARTAO");
      }
      if (isChequeCond) {
        return descMeio.includes("CHEQUE");
      }
      if (isPixCond) {
        return descMeio.includes("PIX");
      }
      if (isDinheiroCond) {
        return descMeio.includes("DINHEIRO");
      }
      
      if (c.meio_pagamento_id === meioId) return true;
      if (c.tipo_prazo === codigoMeio && codigoMeio !== "") return true;
      
      return false;
    });
    
    if (matchingConds.length > 0) {
      setXPrazo(String(matchingConds[0].condicao_id));
    } else {
      setXPrazo("A VISTA");
    }

    const desc = (meio.descricao || "").toUpperCase();
    let autoSelectedId = "";
    if (desc.includes("DINHEIRO")) {
      // Dinheiro busca "CARTEIRA" ou "CAIXA"
      const p = XPortadores.find(p => p.nome.toUpperCase().includes("CARTEIRA") || p.nome.toUpperCase().includes("CAIXA"));
      if (p) autoSelectedId = String(p.portador_id);
    } else if (desc.includes("PIX") || desc.includes("DEPÓSITO") || desc.includes("DEPOSITO") || desc.includes("TRANSFERÊNCIA") || desc.includes("TRANSFERENCIA") || desc.includes("BOLETO") || desc.includes("CHEQUE") || desc.includes("DÉBITO") || desc.includes("DEBITO") || desc.includes("CARTÃO") || desc.includes("CARTAO") || desc.includes("CRÉDITO") || desc.includes("CREDITO")) {
      // Métodos bancários buscam portadores com conta_id associada (ex: Banco do Brasil)
      const p = XPortadores.find(p => p.conta_id !== null);
      if (p) autoSelectedId = String(p.portador_id);
    }

    // Se não encontrou de forma inteligente, escolhe o primeiro da lista
    if (!autoSelectedId && XPortadores.length > 0) {
      autoSelectedId = String(XPortadores[0].portador_id);
    }
    
    setXPortadorId(autoSelectedId);
  };

  // Cálculos dinâmicos em tempo real
  const selectedTitles = XOpenTitles.filter(t => t.financeiro_id && XSelectedIds.includes(t.financeiro_id));
  const selectedCount = selectedTitles.length;
  const selectedSum = selectedTitles.reduce((acc, t) => acc + (t.vl_a_pagar ?? 0), 0);

  // Total acumulado nas linhas de pagamento
  const totalPagoLinhas = useMemo(() => 
    Number(XLinhasPagamento.reduce((acc, l) => acc + l.vl_recebido, 0).toFixed(2))
  , [XLinhasPagamento]);

  // Saldo restante sugerido para pagamento
  const valorRestanteSugerido = useMemo(() => 
    Math.max(0, Number((selectedSum - totalPagoLinhas).toFixed(2)))
  , [selectedSum, totalPagoLinhas]);

  // Efeito para sugerir valor restante sempre que recalcular
  useEffect(() => {
    setXValorLinha(maskMoney(valorRestanteSugerido));
  }, [valorRestanteSugerido]);

  // Adiciona uma linha de pagamento local
  const handleAdicionarPagamento = () => {
    if (!XMeioId) {
      toast.error("Selecione o Meio de Pagamento");
      meioRef.current?.focus();
      return;
    }
    if (!XPortadorId) {
      toast.error("Selecione o Portador");
      portadorRef.current?.focus();
      return;
    }
    const valor = parseMoneyToFloat(XValorLinha);
    if (valor <= 0) {
      toast.error("Informe um valor maior que zero");
      valorRef.current?.focus();
      return;
    }

    if (totalPagoLinhas + valor > selectedSum + 0.0001) {
      toast.error("O valor pago total não pode ultrapassar o saldo total dos títulos selecionados");
      valorRef.current?.focus();
      return;
    }

    const meio = XMeiosPagamento.find(m => m.meio_pagamento_id === Number(XMeioId));
    const port = XPortadores.find(p => p.portador_id === Number(XPortadorId));

    const novaLinha: IPagamentoLinha = {
      uid: crypto.randomUUID(),
      meio_pagamento_id: Number(XMeioId),
      meio_pagamento_descricao: meio?.descricao || "",
      portador_id: Number(XPortadorId),
      portador_nome: port?.nome || "",
      numero_documento: XNrDocumento.substring(0, 10),
      observacao: XObservacao,
      vl_recebido: valor,
      conta_id: port?.conta_id || null,
      prazo: selectedPrazoDesc
    };

    setXLinhasPagamento(prev => [...prev, novaLinha]);
    resetFormPagamento(Math.max(0, Number((selectedSum - (totalPagoLinhas + valor)).toFixed(2))));
    
    // Feedback e Refoco
    toast.success("Pagamento adicionado!");
    setTimeout(() => {
      meioRef.current?.focus();
    }, 50);
  };

  // Remove uma linha de pagamento local
  const handleRemoverPagamento = (uid: string) => {
    setXLinhasPagamento(prev => prev.filter(p => p.uid !== uid));
    toast.success("Pagamento removido!");
  };

  // Keydown handler para navegar entre os campos com a tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent, nextRef: React.RefObject<HTMLElement | null>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  // Executa o processamento de baixa transacional/sequencial
  const handleConfirmarBaixa = async () => {
    if (!XCadastroId) {
      toast.error("Selecione um Cliente");
      return;
    }
    if (selectedCount === 0) {
      toast.error("Selecione pelo menos um título da grade");
      return;
    }
    if (XLinhasPagamento.length === 0) {
      toast.error("Inclua pelo menos uma forma de pagamento");
      return;
    }

    const totalAmortizar = totalPagoLinhas;
    if (totalAmortizar <= 0) {
      toast.error("Informe formas de pagamento com valor maior que zero");
      return;
    }

    if (!window.confirm(`Confirma o processamento da baixa de ${selectedCount} título(s) no valor total de R$ ${fmtMoney(totalAmortizar)}?`)) {
      return;
    }

    setXLoading(true);
    try {
      // Ordena os títulos selecionados por data de vencimento ascendente (mais antigos primeiro)
      const sortedSelected = [...selectedTitles].sort((a, b) => {
        const dateA = a.dt_vencto ? new Date(a.dt_vencto).getTime() : 0;
        const dateB = b.dt_vencto ? new Date(b.dt_vencto).getTime() : 0;
        return dateA - dateB;
      });

      // Mapear títulos e saldos devedores atuais
      const titlesBalances = sortedSelected.map(t => ({
        title: t,
        remaining: t.vl_a_pagar ?? 0,
        baixasToInsert: [] as { 
          vl_pago: number; 
          meio_pagamento_id: number; 
          portador_id: number; 
          recibo: string; 
          observacao: string; 
          conta_id: string | null; 
        }[]
      }));

      // Mapear formas de pagamento disponíveis
      const paymentsToUse = XLinhasPagamento.map(p => ({
        payment: p,
        remaining: p.vl_recebido
      }));

      let titleIdx = 0;
      let paymentIdx = 0;

      // Distribui os pagamentos sequencialmente sobre os títulos
      while (titleIdx < titlesBalances.length && paymentIdx < paymentsToUse.length) {
        const tBal = titlesBalances[titleIdx];
        const pUse = paymentsToUse[paymentIdx];

        if (tBal.remaining <= 0) {
          titleIdx++;
          continue;
        }
        if (pUse.remaining <= 0) {
          paymentIdx++;
          continue;
        }

        const amountToApply = Number(Math.min(tBal.remaining, pUse.remaining).toFixed(2));
        if (amountToApply > 0) {
          const prazoInfo = pUse.payment.prazo && pUse.payment.prazo !== "A VISTA" ? ` [Prazo: ${pUse.payment.prazo}]` : "";
          const docInfo = pUse.payment.numero_documento ? ` | Doc: ${pUse.payment.numero_documento}` : "";
          const obsPgto = pUse.payment.observacao.trim() ? ` - Obs: ${pUse.payment.observacao.trim()}` : "";
          
          tBal.baixasToInsert.push({
            vl_pago: amountToApply,
            meio_pagamento_id: pUse.payment.meio_pagamento_id,
            portador_id: pUse.payment.portador_id,
            recibo: pUse.payment.numero_documento, // Numero doc é o mesmo do recibo
            observacao: `Baixa automática em lote${prazoInfo}${docInfo}${obsPgto}`,
            conta_id: pUse.payment.conta_id
          });

          tBal.remaining = Number((tBal.remaining - amountToApply).toFixed(2));
          pUse.remaining = Number((pUse.remaining - amountToApply).toFixed(2));
        }
      }

      // Buscar próximo ID incremental para a tabela de baixas
      const { data: maxRow } = await supabase
        .from("financeiro_baixa")
        .select("financeiro_baixa_id")
        .order("financeiro_baixa_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextBaixaId = ((maxRow?.financeiro_baixa_id as number) ?? 0) + 1;

      // Executa as gravações e atualizações sequencialmente no banco
      for (const tBal of titlesBalances) {
        if (tBal.baixasToInsert.length === 0) continue;

        let lastPortadorId = tBal.title.plano_id; // Default de portador do título se não atualizado
        let lastMeioCodigo = tBal.title.tp_documento_id; // Default de meio de pagamento do título se não atualizado
        
        for (const bInfo of tBal.baixasToInsert) {
          const { error: insErr } = await supabase
            .from("financeiro_baixa")
            .insert({
              financeiro_baixa_id: nextBaixaId,
              empresa_id: XEmpresaId,
              financeiro_id: tBal.title.financeiro_id,
              documento: tBal.title.documento ? String(tBal.title.documento).trim() : null,
              dt_pagamento: toIsoDate(new Date()),
              vl_pago: bInfo.vl_pago,
              recibo: bInfo.recibo || null,
              conta_id: bInfo.conta_id || null,
              tipo_pag_rec_id: bInfo.meio_pagamento_id,
              observacao: bInfo.observacao,
              plano_id: tBal.title.plano_id,
              tp_conta: "R",
              cadastro_id: Number(XCadastroId),
            });

          if (insErr) throw insErr;
          nextBaixaId++;
          lastPortadorId = bInfo.portador_id;

          // Recupera o código NFe do meio de pagamento
          const meioObj = XMeiosPagamento.find(m => m.meio_pagamento_id === bInfo.meio_pagamento_id);
          if (meioObj?.codigo) {
            lastMeioCodigo = meioObj.codigo;
          }
        }

        // Calcula soma total paga de todas as baixas do título
        const { data: bxs } = await supabase
          .from("financeiro_baixa")
          .select("vl_pago")
          .eq("empresa_id", XEmpresaId)
          .eq("financeiro_id", tBal.title.financeiro_id);
        
        const totalPago = (bxs ?? []).reduce((sum, b) => sum + Number(b.vl_pago || 0), 0);
        const vlTit = Number(tBal.title.vl_titulo ?? 0);
        const novoStatus = totalPago > 0 && totalPago >= vlTit - 0.0001 ? "B" : "A";

        // Atualiza a tabela principal de títulos
        const { error: updErr } = await supabase
          .from("financeiro")
          .update({
            vl_pago: totalPago,
            status: novoStatus,
            portador_id: lastPortadorId,
            tp_documento_id: lastMeioCodigo
          })
          .eq("empresa_id", XEmpresaId)
          .eq("financeiro_id", tBal.title.financeiro_id);

        if (updErr) throw updErr;
      }

      toast.success("Baixas em lote processadas com sucesso!");
      window.dispatchEvent(new CustomEvent("financeiro:baixa-changed"));
      
      // Reseta formulários locais, limpa linhas de pagamento, e recarrega títulos em aberto
      setXLinhasPagamento([]);
      await fetchOpenTitles(Number(XCadastroId));
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao processar as baixas: " + (e?.message || String(e)));
    } finally {
      setXLoading(false);
    }
  };

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden bg-background">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
          <HandCoins className="w-6 h-6 text-emerald-500" /> Baixa por Cliente
        </h2>
        <p className="text-xs text-muted-foreground">
          Selecione o cliente para listar seus títulos em aberto, monte a lista de pagamentos e confirme a baixa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Painel lateral de pagamentos (4 colunas) */}
        <div className="lg:col-span-4 border border-border rounded-lg p-4 bg-card flex flex-col justify-between overflow-y-auto shadow-sm">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b border-border pb-2 text-card-foreground">Dados do Recebimento</h3>
            
            {/* Cliente */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Cliente</label>
              <div className="flex gap-1">
                <input
                  readOnly
                  value={XClienteNome}
                  placeholder="Pesquisar cliente..."
                  className="flex-1 border border-border rounded px-3 py-2 text-sm bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onClick={() => setXSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setXSearchOpen(true);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setXSearchOpen(true)}
                  className="px-3 py-2 border border-border rounded bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                  title="Pesquisar cliente"
                >
                  <Search size={16} />
                </button>
                {XCadastroId && (
                  <button
                    type="button"
                    onClick={() => {
                      setXCadastroId("");
                      setXClienteNome("");
                      setXOpenTitles([]);
                      setXSelectedIds([]);
                      setXLinhasPagamento([]);
                    }}
                    className="px-2.5 py-2 border border-border rounded bg-secondary hover:bg-destructive hover:text-destructive-foreground text-sm font-bold transition-colors"
                    title="Limpar cliente"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Adicionar Forma de Pagamento */}
            <div className="border border-border rounded-md p-3 bg-secondary/15 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 border-b border-border pb-1">
                <Plus size={14} className="text-emerald-500" /> Detalhes do Pagamento
              </h4>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Meio de Pagamento */}
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Meio de Pagamento</label>
                  <select
                    ref={meioRef}
                    value={XMeioId}
                    onChange={(e) => handleMeioChange(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, prazoRef)}
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                  >
                    <option value="">Selecione...</option>
                    {XMeiosPagamento.map(m => (
                      <option key={m.meio_pagamento_id} value={m.meio_pagamento_id}>{m.descricao}</option>
                    ))}
                  </select>
                </div>

                {/* Prazo */}
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Prazo</label>
                  <select
                    ref={prazoRef}
                    value={XPrazo}
                    onChange={(e) => setXPrazo(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, portadorRef)}
                    disabled={!isPrazoAvailable}
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium disabled:opacity-60"
                  >
                    {prazoOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2 - Portador */}
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Portador</label>
                <select
                  ref={portadorRef}
                  value={XPortadorId}
                  onChange={(e) => setXPortadorId(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, docRef)}
                  className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                >
                  <option value="">Selecione...</option>
                  {XPortadores.map(p => (
                    <option key={p.portador_id} value={p.portador_id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              {/* Nº Documento da transação e Valor na mesma linha (Recibo retirado) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Nº Doc. Transação</label>
                  <input
                    ref={docRef}
                    type="text"
                    maxLength={10}
                    value={XNrDocumento}
                    onChange={(e) => setXNrDocumento(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, valorRef)}
                    placeholder="Documento/Recibo"
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Valor</label>
                  <input
                    ref={valorRef}
                    type="text"
                    value={XValorLinha}
                    onChange={(e) => setXValorLinha(maskMoney(e.target.value))}
                    onKeyDown={(e) => handleKeyDown(e, obsRef)}
                    placeholder="0,00"
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs font-bold text-right bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Observação na última linha ocupando tudo */}
              <div className="w-full">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">Observação</label>
                <input
                  ref={obsRef}
                  type="text"
                  value={XObservacao}
                  onChange={(e) => setXObservacao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdicionarPagamento();
                    }
                  }}
                  placeholder="Observações do pagamento..."
                  className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleAdicionarPagamento}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <Plus size={14} /> Adicionar Pagamento
                </button>
              </div>
            </div>

            {/* Listagem de formas adicionadas */}
            {XLinhasPagamento.length > 0 && (
              <div className="border-t border-border pt-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Formas de Pagamento Adicionadas</h4>
                <div className="border border-border rounded overflow-hidden max-h-[160px] overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 text-[10px] uppercase font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2">Forma/Portador</th>
                        <th className="p-2 text-center">Nº Documento</th>
                        <th className="p-2 text-right">Valor</th>
                        <th className="p-2 w-[30px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {XLinhasPagamento.map(l => (
                        <tr key={l.uid} className="hover:bg-accent/40 bg-card">
                          <td className="p-2 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{l.meio_pagamento_descricao}</span>
                              {l.prazo && l.prazo !== "A VISTA" && (
                                <span className="text-[9px] px-1 py-0.2 bg-secondary text-secondary-foreground rounded font-bold uppercase">
                                  {l.prazo}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-muted-foreground font-normal">
                              Portador: {l.portador_nome}
                            </div>
                            {l.observacao && (
                              <div className="text-[9px] text-muted-foreground italic font-normal">
                                Obs: {l.observacao}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-center text-muted-foreground font-medium">
                            {l.numero_documento || "-"}
                          </td>
                          <td className="p-2 text-right font-bold text-card-foreground">
                            R$ {fmtMoney(l.vl_recebido)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRemoverPagamento(l.uid)}
                              className="text-rose-600 hover:text-rose-700 transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Botões do Rodapé do painel */}
          <div className="flex gap-2 mt-4 pt-4 border-t border-border shrink-0">
            <button
              onClick={limpar}
              disabled={XLoading}
              className="flex-1 py-2.5 text-xs font-semibold border border-border rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              Limpar Tudo
            </button>
            <button
              onClick={handleConfirmarBaixa}
              disabled={XLoading || XLinhasPagamento.length === 0}
              className="flex-1 py-2.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 transition-opacity"
            >
              {XLoading ? <RefreshCw size={14} className="animate-spin" /> : <HandCoins size={14} />}
              Confirmar Baixa
            </button>
          </div>
        </div>

        {/* Tabela dos títulos abertos (8 colunas) */}
        <div className="lg:col-span-8 border border-border rounded-lg bg-card flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 border-b border-border bg-card/50 flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">Grade de Títulos em Aberto</h3>
            {XCadastroId && (
              <span className="text-xs text-muted-foreground font-medium bg-secondary px-2.5 py-1 rounded-full">
                {XOpenTitles.length} título(s) em aberto
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!XCadastroId ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <Info className="w-8 h-8 mb-2 text-muted-foreground/60" />
                <p className="text-sm font-medium">Nenhum cliente selecionado</p>
                <p className="text-xs text-center">Selecione o cliente na barra lateral para carregar os títulos.</p>
              </div>
            ) : XFetchingTitles ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Buscando títulos...
              </div>
            ) : XOpenTitles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <CheckCircle className="w-8 h-8 mb-2 text-emerald-500" />
                <p className="text-sm font-medium">Nenhum título em aberto!</p>
                <p className="text-xs text-center">Este parceiro não possui títulos a receber em aberto no momento.</p>
              </div>
            ) : (
              <table className="w-full text-sm border-collapse text-left">
                <thead className="bg-secondary/40 text-xs font-semibold text-muted-foreground sticky top-0 uppercase tracking-wider z-10 border-b border-border">
                  <tr>
                    <th className="p-3 w-[50px] text-center">
                      <input
                        type="checkbox"
                        checked={XSelectedIds.length === XOpenTitles.length && XOpenTitles.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-border focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="p-3">Título/Doc</th>
                    <th className="p-3 text-center">Emissão</th>
                    <th className="p-3 text-center">Vencimento</th>
                    <th className="p-3 text-right">Vlr. Título</th>
                    <th className="p-3 text-right">Vlr. Pago</th>
                    <th className="p-3 text-right">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {XOpenTitles.map((t, idx) => {
                    const isSelected = XSelectedIds.includes(t.financeiro_id!);
                    const isVencido = t.situacao === "VENCIDO";
                    
                    return (
                      <tr 
                        key={t.financeiro_id} 
                        className={`hover:bg-accent/40 cursor-pointer transition-colors ${isSelected ? "bg-accent/15" : ""} ${idx % 2 === 0 ? "bg-card" : "bg-card/50"}`}
                        onClick={() => handleToggleSelect(t.financeiro_id!)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(t.financeiro_id!)}
                            className="rounded border-border focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-card-foreground">
                          {t.documento || "-"}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {fmtDate(t.dt_emissao)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={isVencido ? "text-rose-500 font-bold" : "text-muted-foreground"}>
                            {fmtDate(t.dt_vencto)}
                          </span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {fmtMoney(t.vl_titulo)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {fmtMoney(t.vl_pago)}
                        </td>
                        <td className="p-3 text-right font-bold text-card-foreground border-l border-transparent">
                          {fmtMoney(t.vl_a_pagar)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Resumo do rodapé da grade */}
          {XOpenTitles.length > 0 && (
            <div className="p-4 border-t border-border bg-secondary/20 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-medium">Títulos Selecionados</p>
                <p className="text-lg font-bold text-card-foreground">
                  {selectedCount} <span className="text-xs font-normal text-muted-foreground font-medium">de {XOpenTitles.length}</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-medium">Saldo Total Selecionado</p>
                <p className="text-lg font-bold text-card-foreground">R$ {fmtMoney(selectedSum)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider font-medium">Total Pago Informado</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-lg font-bold text-card-foreground">R$ {fmtMoney(totalPagoLinhas)}</p>
                  {totalPagoLinhas > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      totalPagoLinhas >= selectedSum - 0.0001 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {totalPagoLinhas >= selectedSum - 0.0001 ? "Total" : "Parcial"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up de pesquisa de cliente */}
      {XSearchOpen && (
        <ClienteSearchDialog
          open={XSearchOpen}
          onClose={() => setXSearchOpen(false)}
          onSelect={(cli: IClienteRow) => {
            setXCadastroId(String(cli.cadastro_id));
            setXClienteNome(cli.razao_social || cli.nome_fantasia || "");
            setXSearchOpen(false);
          }}
          empresaId={XEmpresaId}
        />
      )}
    </div>
  );
};

export default BaixaPorClienteForm;
