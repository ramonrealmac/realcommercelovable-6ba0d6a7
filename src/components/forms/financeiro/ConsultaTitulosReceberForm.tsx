import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Plus, HandCoins, RefreshCw, Filter as FilterIcon, Search, CheckCircle, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";
import ClienteSearchDialog from "../pedido/ClienteSearchDialog";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type SituacaoOpt = "A VENCER" | "PAGTO PARCIAL" | "VENCIDO" | "BAIXADO" | "CANCELADO";
const SITUACOES: SituacaoOpt[] = ["A VENCER", "PAGTO PARCIAL", "VENCIDO", "BAIXADO", "CANCELADO"];

interface IRow {
  empresa_id: number | null;
  financeiro_id: number | null;
  empresa: string;
  titulo: string | null;
  cliente: string;
  plano_conta: string;
  meio_pagamento: string;
  vl_a_pagar: number | null;
  vl_pago: number | null;
  vl_titulo: number | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  dt_baixa: string | null;
  dias_atraso: number | null;
  situacao: string | null;
}

interface IFinanceiroView {
  empresa_id: number | null;
  financeiro_id: number | null;
  documento: string | null;
  cadastro_id: number | null;
  vl_a_pagar: number | null;
  vl_pago: number | null;
  vl_titulo: number | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  dias_atraso: number | null;
  situacao: string | null;
  plano_id: number | null;
  tp_conta: string | null;
  tp_documento_id?: string | null;
}

interface IClienteOpt { cadastro_id: number; nome: string; }
interface IPlanoOpt { plano_id: number; nome: string; }

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

const ConsultaTitulosReceberForm: React.FC = () => {
  const { openTab, XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const { handleKeyDown } = useEnterTraversal();

  const [XPlanos, setXPlanos] = useState<IPlanoOpt[]>([]);
  const [XPortadores, setXPortadores] = useState<{ portador_id: number; cd_portador: number; nome: string }[]>([]);
  const [XMeiosPagamento, setXMeiosPagamento] = useState<{ codigo: string; descricao: string }[]>([]);
  const [XBaixaMeioPagamentoId, setXBaixaMeioPagamentoId] = useState<string>("");

  // Action overlays & form states
  const [XActionType, setXActionType] = useState<"BAIXAR" | "ESTORNAR" | "CANCELAR" | null>(null);
  const [XActionRow, setXActionRow] = useState<IRow | null>(null);
  const [XActionLoading, setXActionLoading] = useState(false);
  const [XConfirmOpen, setXConfirmOpen] = useState(false);
  const [XSuccessMessage, setXSuccessMessage] = useState<string>("");

  // Refs para controle de foco do teclado
  const XBtnConfirmarRef = useRef<HTMLButtonElement>(null);
  const XBtnSimRef = useRef<HTMLButtonElement>(null);
  const XBtnSuccessOkRef = useRef<HTMLButtonElement>(null);
  const XInputVlPagoRef = useRef<HTMLInputElement>(null);
  const XSelectCaixaRef = useRef<HTMLSelectElement>(null);

  // Baixar edit states
  const [XBaixaDtPagamento, setXBaixaDtPagamento] = useState<string>("");
  const [XBaixaVlPagoStr, setXBaixaVlPagoStr] = useState<string>("0,00");
  const [XBaixaVlDescontoStr, setXBaixaVlDescontoStr] = useState<string>("0,00");
  const [XBaixaVlJurosStr, setXBaixaVlJurosStr] = useState<string>("0,00");
  const [XBaixaPortadorId, setXBaixaPortadorId] = useState<number>(0);
  const [XBaixaPlanoId, setXBaixaPlanoId] = useState<number>(0);
  const [XCaixas, setXCaixas] = useState<{ caixa_abertura_id: number; funcionario_id: number; funcionario_nome: string }[]>([]);
  const [XBaixaFuncionarioId, setXBaixaFuncionarioId] = useState<number>(0);
  const [XBaixaCaixaAberturaId, setXBaixaCaixaAberturaId] = useState<number>(0);

  const [XClienteId, setXClienteId] = useState<string>("");
  const [XClienteNome, setXClienteNome] = useState<string>("");
  const [XNrMovimento, setXNrMovimento] = useState<string>("");
  const [XNrTitulo, setXNrTitulo] = useState<string>("");
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XTpData, setXTpData] = useState<string>(""); // "" = em branco, E = Emissão, V = Vencimento, B = Baixa
  const [XDtInicial, setXDtInicial] = useState<string>("");
  const [XDtFinal, setXDtFinal] = useState<string>("");
  const [XSituacao, setXSituacao] = useState<string>("");
  const [XPlanoId, setXPlanoId] = useState<string>("");
  const [XShowAlert, setXShowAlert] = useState(false);
  const [XAlertMessage, setXAlertMessage] = useState("");

  const [XRows, setXRows] = useState<IRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XHasLoaded, setXHasLoaded] = useState(false);

  // Carregar listas dos filtros
  useEffect(() => {
    (async () => {
      const [{ data: plData }, { data: mpData }] = await Promise.all([
        supabase
          .from("plano_conta")
          .select("plano_conta_id, nome")
          .eq("tp_conta", "A")
          .eq("tp_natureza", "R")
          .eq("excluido", false)
          .order("nome"),
        supabase
          .from("meio_pagamento")
          .select("codigo, descricao")
          .order("descricao")
      ]);
      
      const planData = (plData as { plano_conta_id: number; nome: string }[] | null) ?? [];
      setXPlanos(planData.map((p) => ({ plano_id: p.plano_conta_id, nome: p.nome })));

      const mpList = (mpData as { codigo: string; descricao: string }[] | null) ?? [];
      setXMeiosPagamento(mpList);
    })();
  }, []);

  // Carregar portadores
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const { data: portData } = await supabase
        .from("portador")
        .select("portador_id, cd_portador, nome")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("ativo", "S")
        .order("nome");
      if (portData) setXPortadores(portData);
    })();
  }, [XEmpresaId]);

  // Efeito para focar automaticamente o botão "Sim" na confirmação dupla
  useEffect(() => {
    if (XConfirmOpen) {
      const timer = setTimeout(() => {
        XBtnSimRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [XConfirmOpen]);

  // Efeito para focar automaticamente o botão "OK" na mensagem de sucesso
  useEffect(() => {
    if (XSuccessMessage) {
      const timer = setTimeout(() => {
        XBtnSuccessOkRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [XSuccessMessage]);

  // Efeito para focar automaticamente o campo Valor Pago e selecionar tudo ao abrir a baixa
  useEffect(() => {
    if (XActionType === "BAIXAR") {
      const timer = setTimeout(() => {
        if (XInputVlPagoRef.current) {
          XInputVlPagoRef.current.focus();
          XInputVlPagoRef.current.select();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [XActionType]);

  const loadGrid = useCallback(async () => {
    if (XDtInicial && XDtFinal) {
      const year1 = parseInt(XDtInicial.substring(0, 4), 10);
      const year2 = parseInt(XDtFinal.substring(0, 4), 10);
      if (year1 >= 1900 && year2 >= 1900 && XDtInicial > XDtFinal) {
        setXAlertMessage("A data inicial não pode ser maior que a data final.");
        setXShowAlert(true);
        return;
      }
    }
    setXLoading(true);
    try {
      let q = supabase
        .from("financeiro_view")
        .select("empresa_id, financeiro_id, documento, cadastro_id, vl_a_pagar, vl_pago, vl_titulo, dt_emissao, dt_vencto, dias_atraso, situacao, plano_id, tp_conta, tp_documento_id")
        .eq("tp_conta", "R")
        .order("dt_emissao", { ascending: false })
        .limit(1000);

      if (XEmpresaId === XEmpresaMatrizId) {
        // Matriz: traz dados da matriz e de suas filiais
        const filialIds = XEmpresas
          .filter(e => e.empresa_matriz_id === XEmpresaMatrizId)
          .map(e => e.empresa_id);
        const targetIds = filialIds.length > 0 ? filialIds : [XEmpresaId];
        q = q.in("empresa_id", targetIds);
      } else {
        // Filial: traz apenas dados da própria filial
        q = q.eq("empresa_id", XEmpresaId);
      }

      if (XNrMovimento) {
        const nrVal = parseInt(XNrMovimento, 10);
        if (!isNaN(nrVal)) {
          const { data: movs, error: movErr } = await supabase
            .from("movimento")
            .select("movimento_id")
            .eq("nr_movimento", nrVal);
          
          if (!movErr && movs && movs.length > 0) {
            const mIds = movs.map(m => m.movimento_id);
            q = q.in("movimento_id", mIds);
          } else {
            q = q.in("movimento_id", [-1]);
          }
        } else {
          q = q.in("movimento_id", [-1]);
        }
      }

      if (XClienteId) q = q.eq("cadastro_id", Number(XClienteId));
      if (XNrTitulo.trim()) {
        q = q.ilike("documento", `%${XNrTitulo.trim()}%`);
      }
      if (XSituacao && XSituacao !== "TODAS") q = q.eq("situacao", XSituacao);
      if (XPlanoId && XPlanoId !== "TODOS") q = q.eq("plano_id", Number(XPlanoId));

      // Filtro por Data
      if (XTpData === "E") {
        if (XDtInicial) q = q.gte("dt_emissao", XDtInicial);
        if (XDtFinal) q = q.lte("dt_emissao", XDtFinal);
      } else if (XTpData === "V") {
        if (XDtInicial) q = q.gte("dt_vencto", XDtInicial);
        if (XDtFinal) q = q.lte("dt_vencto", XDtFinal);
      } else if (XTpData === "B") {
        if (XDtInicial || XDtFinal) {
          let bQuery = supabase
            .from("financeiro_baixa")
            .select("financeiro_id");
          if (XDtInicial) bQuery = bQuery.gte("dt_pagamento", XDtInicial);
          if (XDtFinal) bQuery = bQuery.lte("dt_pagamento", XDtFinal);
          const { data: bData, error: bErr } = await bQuery;
          if (bErr) throw bErr;
          const ids = (bData ?? []).map(b => b.financeiro_id);
          q = q.in("financeiro_id", ids.length > 0 ? ids : [-1]);
        }
      }

      const { data, error } = await q;
      if (error) throw error;

      const viewData = (data as unknown as IFinanceiroView[]) ?? [];

      const empIds = Array.from(new Set(viewData.map((r) => r.empresa_id).filter(Boolean))) as number[];
      const cadIds = Array.from(new Set(viewData.map((r) => r.cadastro_id).filter(Boolean))) as number[];
      const planoIds = Array.from(new Set(viewData.map((r) => r.plano_id).filter(Boolean))) as number[];
      const financeiroIds = Array.from(new Set(viewData.map((r) => r.financeiro_id).filter(Boolean))) as number[];

      const [empRes, cadRes, planoRes, baixaRes, meioRes] = await Promise.all([
        empIds.length
          ? supabase.from("empresa").select("empresa_id, razao_social").in("empresa_id", empIds)
          : Promise.resolve({ data: [] as { empresa_id: number; razao_social: string }[], error: null }),
        cadIds.length
          ? supabase.from("cadastro").select("cadastro_id, razao_social").in("cadastro_id", cadIds)
          : Promise.resolve({ data: [] as { cadastro_id: number; razao_social: string }[], error: null }),
        planoIds.length
          ? supabase.from("plano_conta").select("plano_conta_id, nome").in("plano_conta_id", planoIds)
          : Promise.resolve({ data: [] as { plano_conta_id: number; nome: string }[], error: null }),
        financeiroIds.length
          ? supabase.from("financeiro_baixa").select("financeiro_id, dt_pagamento").in("financeiro_id", financeiroIds)
          : Promise.resolve({ data: [] as { financeiro_id: number; dt_pagamento: string }[], error: null }),
        supabase.from("meio_pagamento").select("codigo, descricao")
      ]);
      const empMap = new Map<number, string>((empRes.data ?? []).map((e) => [e.empresa_id, e.razao_social]));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mpMap = new Map<string, string>((meioRes.data ?? []).map((m: any) => [m.codigo, m.descricao]));
      const cadMap = new Map<number, string>((cadRes.data ?? []).map((c) => [c.cadastro_id, c.razao_social]));
      const planoMap = new Map<number, string>((planoRes.data ?? []).map((p) => [p.plano_conta_id, p.nome]));

      const baixaMap = new Map<number, string>();
      for (const b of baixaRes.data ?? []) {
        const existing = baixaMap.get(b.financeiro_id);
        if (!existing || new Date(b.dt_pagamento) > new Date(existing)) {
          baixaMap.set(b.financeiro_id, b.dt_pagamento);
        }
      }

      const rows: IRow[] = viewData.map((r) => ({
        empresa_id: r.empresa_id,
        financeiro_id: r.financeiro_id,
        empresa: empMap.get(r.empresa_id || 0) ?? "",
        titulo: r.documento,
        cliente: `${r.cadastro_id ?? ""} - ${cadMap.get(r.cadastro_id || 0) ?? ""}`,
        plano_conta: r.plano_id ? planoMap.get(r.plano_id || 0) ?? "" : "",
        meio_pagamento: r.tp_documento_id ? mpMap.get(r.tp_documento_id) ?? r.tp_documento_id : "-",
        vl_a_pagar: r.vl_a_pagar,
        vl_pago: r.vl_pago,
        vl_titulo: r.vl_titulo,
        dt_emissao: r.dt_emissao,
        dt_vencto: r.dt_vencto,
        dt_baixa: r.financeiro_id ? baixaMap.get(r.financeiro_id) ?? null : null,
        dias_atraso: r.dias_atraso,
        situacao: r.situacao,
      }));
      setXRows(rows);
      setXHasLoaded(true);
    } catch (e) {
      console.error("Erro ao carregar títulos:", e);
    } finally {
      setXLoading(false);
    }
  }, [XClienteId, XNrMovimento, XTpData, XDtInicial, XDtFinal, XSituacao, XPlanoId, XEmpresaId, XEmpresaMatrizId, XEmpresas]);

  // Atualiza a grade automaticamente quando algo mudar no financeiro ou ao reativar a aba (apenas após a primeira carga manual)
  useEffect(() => {
    const handler = () => { if (XHasLoaded) loadGrid(); };
    const onVis = () => { if (document.visibilityState === "visible" && XHasLoaded) loadGrid(); };
    window.addEventListener("financeiro:baixa-changed", handler);
    window.addEventListener("financeiro:changed", handler);
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("financeiro:baixa-changed", handler);
      window.removeEventListener("financeiro:changed", handler);
      window.removeEventListener("focus", handler);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadGrid, XHasLoaded]);

  const handleOpenAction = useCallback(async (type: "BAIXAR" | "ESTORNAR" | "CANCELAR", row: IRow) => {
    if (!row.financeiro_id) return;
    setXActionLoading(true);
    try {
      if (type === "BAIXAR") {
        const todayStr = new Date().toLocaleDateString("sv").substring(0, 10);
        const { data: aberts, error: abertErr } = await supabase
          .from("caixa_abertura")
          .select("caixa_abertura_id, funcionario_id, dt_abertura")
          .eq("empresa_id", XEmpresaId)
          .eq("status", "A")
          .eq("dt_abertura", todayStr);

        if (abertErr) throw abertErr;

        const activeCaixas = aberts || [];
        if (activeCaixas.length === 0) {
          toast.error("Não existe caixa aberto!");
          setXActionType(null);
          setXActionRow(null);
          return;
        }

        // Fetch employee names
        const ids = Array.from(new Set(activeCaixas.map((r) => r.funcionario_id))).filter(Boolean);
        let nomes: Record<number, string> = {};
        if (ids.length > 0) {
          const { data: funcs } = await supabase
            .from("funcionario")
            .select("funcionario_id, nome")
            .in("funcionario_id", ids);
          if (funcs) {
            nomes = Object.fromEntries(funcs.map((f) => [f.funcionario_id, f.nome]));
          }
        }

        const lista = activeCaixas.map((r) => ({
          caixa_abertura_id: r.caixa_abertura_id,
          funcionario_id: r.funcionario_id,
          funcionario_nome: nomes[r.funcionario_id] || `Funcionário #${r.funcionario_id}`
        }));

        setXCaixas(lista);
        setXBaixaFuncionarioId(lista[0].funcionario_id);
        setXBaixaCaixaAberturaId(lista[0].caixa_abertura_id);
      }

      const { data: fin, error } = await supabase
        .from("financeiro")
        .select("*")
        .eq("financeiro_id", row.financeiro_id)
        .single();
      
      if (error) throw error;
      
      setXActionRow(row);
      setXActionType(type);
      
      // Initialize form states
      setXBaixaDtPagamento(toIsoDate(new Date()));
      const vlAberto = fin.vl_a_pagar ?? row.vl_a_pagar ?? 0;
      setXBaixaVlPagoStr(maskMoney((vlAberto * 100).toFixed(0)));
      setXBaixaVlDescontoStr("0,00");
      setXBaixaVlJurosStr("0,00");
      setXBaixaPortadorId(fin.portador_id || 0);
      setXBaixaPlanoId(fin.plano_id || fin.planoconta_id || 0);
      setXBaixaMeioPagamentoId(fin.tp_documento_id ? String(fin.tp_documento_id) : "");
      
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao carregar dados do título: " + errMsg);
    } finally {
      setXActionLoading(false);
    }
  }, [XEmpresaId]);

  const handleVlPagoChange = (valStr: string) => {
    const formatted = maskMoney(valStr);
    setXBaixaVlPagoStr(formatted);

    const valNum = parseMoneyToFloat(formatted);
    const vlRestante = XActionRow?.vl_a_pagar ?? 0;

    if (valNum > vlRestante) {
      const diff = valNum - vlRestante;
      setXBaixaVlJurosStr(maskMoney((diff * 100).toFixed(0)));
      setXBaixaVlDescontoStr("0,00");
    } else {
      setXBaixaVlDescontoStr("0,00");
      setXBaixaVlJurosStr("0,00");
    }
  };

  const handleDescontoChange = (valStr: string) => {
    const formatted = maskMoney(valStr);
    setXBaixaVlDescontoStr(formatted);

    const descNum = parseMoneyToFloat(formatted);
    const vlRestante = XActionRow?.vl_a_pagar ?? 0;
    const newPago = Math.max(0, vlRestante - descNum);

    setXBaixaVlPagoStr(maskMoney((newPago * 100).toFixed(0)));
    setXBaixaVlJurosStr("0,00");
  };

  const handleJurosChange = (valStr: string) => {
    const formatted = maskMoney(valStr);
    setXBaixaVlJurosStr(formatted);

    const jurosNum = parseMoneyToFloat(formatted);
    const vlRestante = XActionRow?.vl_a_pagar ?? 0;
    const newPago = vlRestante + jurosNum;

    setXBaixaVlPagoStr(maskMoney((newPago * 100).toFixed(0)));
    setXBaixaVlDescontoStr("0,00");
  };

  const handleDtPagamentoChange = (val: string) => {
    const parts = val.split("-");
    if (parts[0] && parts[0].length > 4) {
      parts[0] = parts[0].substring(0, 4);
    }
    setXBaixaDtPagamento(parts.join("-"));
  };

  const executeAction = async () => {
    if (!XActionRow || !XActionType) return;
    setXActionLoading(true);
    try {
      const financeiro_id = XActionRow.financeiro_id;
      const empresa_id = XActionRow.empresa_id;

      if (XActionType === "BAIXAR") {
        // Insert into financeiro_baixa
        const { error: insErr } = await supabase
          .from("financeiro_baixa")
          .insert({
            empresa_id,
            financeiro_id,
            planoconta_id: XBaixaPlanoId,
            plano_id: XBaixaPlanoId,
            vl_pago: parseMoneyToFloat(XBaixaVlPagoStr),
            vl_desconto: parseMoneyToFloat(XBaixaVlDescontoStr),
            vl_juros: parseMoneyToFloat(XBaixaVlJurosStr),
            dt_pagamento: XBaixaDtPagamento,
            cadastro_id: parseInt(XActionRow.cliente.split(" - ")[0], 10) || 0,
            tp_conta: "R",
            funcionario_id: XBaixaFuncionarioId
          });
        
        if (insErr) throw insErr;

        // If cash (Dinheiro = "01"): update cash register balance + insert caixa_movimento + insert caixa_movimento_item
        if (XBaixaMeioPagamentoId === "01" && XBaixaCaixaAberturaId) {
          const vlPago = parseMoneyToFloat(XBaixaVlPagoStr);
          
          // 1. Get current balance
          const { data: cxData, error: cxErr } = await supabase
            .from("caixa_abertura")
            .select("vl_fechamento")
            .eq("caixa_abertura_id", XBaixaCaixaAberturaId)
            .single();
            
          if (!cxErr && cxData) {
            const currentVal = Number(cxData.vl_fechamento ?? 0);
            
            // 2. Update balance
            const { error: updCxErr } = await supabase
              .from("caixa_abertura")
              .update({ vl_fechamento: currentVal + vlPago })
              .eq("caixa_abertura_id", XBaixaCaixaAberturaId);
              
            if (updCxErr) throw updCxErr;
          }
          
          // 3. Insert caixa_movimento
          const { data: newCm, error: errCm } = await supabase
            .from("caixa_movimento")
            .insert({
              empresa_id,
              colaborador_id: XBaixaFuncionarioId,
              funcionario_id: XBaixaFuncionarioId,
              dt_movimento: XBaixaDtPagamento,
              tp_movimento: "V", // V = Venda/Recebimento
              tp_operacao: "E", // E = Entrada
              historico: `RECEBIMENTO TITULO ${XActionRow.titulo || XActionRow.documento || ""}`,
              vl_movimento: vlPago,
              excluido: false,
              caixa_abertura_id: XBaixaCaixaAberturaId
            })
            .select("caixa_movimento_id")
            .single();
            
          if (errCm) throw errCm;
          
          if (newCm) {
            // 4. Insert caixa_movimento_item
            const { error: errCmi } = await supabase
              .from("caixa_movimento_item")
              .insert({
                empresa_id,
                caixa_movimento_id: newCm.caixa_movimento_id,
                vl_recebido: vlPago,
                excluido: false,
                meio_pagamento_id: 1, // 1 = Dinheiro
                plano_conta_id: XBaixaPlanoId
              });
              
            if (errCmi) throw errCmi;
          }
        }

        // Query all active financeiro_baixa records for this title to sum values
        const { data: bxs, error: qErr } = await supabase
          .from("financeiro_baixa")
          .select("vl_pago, vl_desconto, vl_juros")
          .eq("empresa_id", empresa_id)
          .eq("financeiro_id", financeiro_id);
        
        if (qErr) throw qErr;

        const totalPaid = (bxs ?? []).reduce((s, b) => s + Number(b.vl_pago || 0), 0);
        const totalDesc = (bxs ?? []).reduce((s, b) => s + Number(b.vl_desconto || 0), 0);
        const totalJuros = (bxs ?? []).reduce((s, b) => s + Number(b.vl_juros || 0), 0);

        // Fetch original title to get vl_titulo
        const { data: fin, error: finErr } = await supabase
          .from("financeiro")
          .select("vl_titulo")
          .eq("financeiro_id", financeiro_id)
          .single();
        
        if (finErr) throw finErr;

        const vlTit = Number(fin.vl_titulo ?? 0);
        const novoStatus = (totalPaid + totalDesc) > 0 && (totalPaid + totalDesc) >= vlTit - 0.0001 ? "B" : "A";

        // Update public.financeiro
        const { error: updErr } = await supabase
          .from("financeiro")
          .update({
            vl_pago: totalPaid,
            vl_desconto: totalDesc,
            vl_adicional: totalJuros,
            status: novoStatus,
            portador_id: XBaixaPortadorId,
            plano_id: XBaixaPlanoId,
            planoconta_id: XBaixaPlanoId,
            tp_documento_id: XBaixaMeioPagamentoId || null
          })
          .eq("financeiro_id", financeiro_id);

        if (updErr) throw updErr;

        setXSuccessMessage("Título baixado com sucesso!");

      } else if (XActionType === "ESTORNAR") {
        // Delete from financeiro_baixa
        const { error: delErr } = await supabase
          .from("financeiro_baixa")
          .delete()
          .eq("empresa_id", empresa_id)
          .eq("financeiro_id", financeiro_id);
        
        if (delErr) throw delErr;

        // Update public.financeiro setting vl_pago to 0, status to "A" (Aberto), and clearing plano_id / planoconta_id
        const { error: updErr } = await supabase
          .from("financeiro")
          .update({
            vl_pago: 0,
            status: "A",
            plano_id: 0,
            planoconta_id: 0
          })
          .eq("financeiro_id", financeiro_id);

        if (updErr) throw updErr;

        setXSuccessMessage("Título estornado com sucesso!");

      } else if (XActionType === "CANCELAR") {
        // Update public.financeiro setting status to "C" (Cancelado)
        const { error: updErr } = await supabase
          .from("financeiro")
          .update({
            status: "C"
          })
          .eq("financeiro_id", financeiro_id);

        if (updErr) throw updErr;

        setXSuccessMessage("Título cancelado com sucesso!");
      }

      // Close confirm dialog only (success dialog is now visible)
      setXConfirmOpen(false);

    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      toast.error("Erro ao executar ação: " + errMsg);
    } finally {
      setXActionLoading(false);
    }
  };

  const handleSuccessOk = () => {
    setXSuccessMessage("");
    setXActionType(null);
    setXActionRow(null);
    loadGrid();
  };

  const openTitulo = useCallback((row: IRow) => {
    if (!row.financeiro_id) return;
    openTab({
      title: `Conta a Receber ${row.titulo ?? ""}`,
      component: "conta-receber-detalhe",
      params: { empresa_id: row.empresa_id, financeiro_id: row.financeiro_id },
    });
  }, [openTab]);

  const rowColor = (sit: string | null | undefined) => {
    const s = (sit ?? "").toUpperCase();
    if (s === "BAIXADO") return "text-emerald-600 dark:text-emerald-400";
    if (s === "VENCIDO") return "text-red-600 dark:text-red-400";
    if (s === "CANCELADO") return "text-zinc-400 dark:text-zinc-500";
    if (s === "PAGTO PARCIAL" || s === "PAGAMENTO PARCIAL") return "text-[#0033ff] dark:text-[#4d88ff] font-semibold";
    return "";
  };

  const XCols: IGridColumn[] = useMemo(() => [
    { key: "empresa", label: "Empresa", width: "1.2fr",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.empresa}</span> },
    { key: "titulo", label: "Título", width: "120px",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.titulo}</span> },
    { key: "cliente", label: "Cliente", width: "2fr",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.cliente}</span> },
    { key: "meio_pagamento", label: "Meio Pagamento", width: "150px",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.meio_pagamento}</span> },
    { key: "plano_conta", label: "Plano de Contas", width: "1.5fr",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.plano_conta}</span> },
    { key: "vl_titulo", label: "Vlr. Título", width: "110px", align: "right",
      getValue: (r: IRow) => Number(r.vl_titulo ?? 0),
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtMoney(r.vl_titulo)}</span> },
    { key: "vl_a_pagar", label: "Vlr. a Pagar", width: "110px", align: "right",
      getValue: (r: IRow) => Number(r.vl_a_pagar ?? 0),
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtMoney(r.vl_a_pagar)}</span> },
    { key: "vl_pago", label: "Vlr. Pago", width: "110px", align: "right",
      getValue: (r: IRow) => Number(r.vl_pago ?? 0),
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtMoney(r.vl_pago)}</span> },
    { key: "dt_emissao", label: "Dt. Emissão", width: "100px", align: "center",
      getValue: (r: IRow) => r.dt_emissao ?? "",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtDate(r.dt_emissao)}</span> },
    { key: "dt_vencto", label: "Dt. Vencto", width: "100px", align: "center",
      getValue: (r: IRow) => r.dt_vencto ?? "",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtDate(r.dt_vencto)}</span> },
    { key: "dt_baixa", label: "Dt. Baixa", width: "100px", align: "center",
      getValue: (r: IRow) => r.dt_baixa ?? "",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{fmtDate(r.dt_baixa)}</span> },
    { key: "dias_atraso", label: "Atraso", width: "70px", align: "right",
      render: (r: IRow) => <span className={rowColor(r.situacao)}>{r.dias_atraso ?? 0}</span> },
    { key: "situacao", label: "Situação", width: "120px",
      render: (r: IRow) => <span className={`font-semibold ${rowColor(r.situacao)}`}>{r.situacao}</span> },
    {
      key: "acoes",
      label: "Ações",
      width: "120px",
      align: "center",
      render: (r: IRow) => {
        const isAberto = r.situacao !== "BAIXADO" && r.situacao !== "CANCELADO";
        const isBaixado = r.situacao === "BAIXADO";
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-[11px] bg-primary text-primary-foreground px-2 py-1 rounded border border-border hover:opacity-90 transition-opacity font-bold uppercase shadow-sm">
                Opções
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card border border-border">
              <DropdownMenuItem
                disabled={!isAberto}
                onClick={(e) => { e.stopPropagation(); handleOpenAction("BAIXAR", r); }}
                className="flex items-center gap-2 cursor-pointer text-xs"
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Baixar
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!isBaixado}
                onClick={(e) => { e.stopPropagation(); handleOpenAction("ESTORNAR", r); }}
                className="flex items-center gap-2 cursor-pointer text-xs"
              >
                <RotateCcw className="w-4 h-4 text-amber-500" />
                Estornar
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!isAberto}
                onClick={(e) => { e.stopPropagation(); handleOpenAction("CANCELAR", r); }}
                className="flex items-center gap-2 text-rose-500 hover:text-rose-600 cursor-pointer text-xs focus:text-rose-500"
              >
                <XCircle className="w-4 h-4 text-rose-500" />
                Cancelar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    }
  ], [handleOpenAction]);

  const isDateRangeInvalid = useMemo(() => {
    if (!XDtInicial || !XDtFinal) return false;
    const year1 = parseInt(XDtInicial.substring(0, 4), 10);
    const year2 = parseInt(XDtFinal.substring(0, 4), 10);
    if (year1 < 1900 || year2 < 1900) return false;
    return XDtInicial > XDtFinal;
  }, [XDtInicial, XDtFinal]);

  const clearFilters = () => {
    setXClienteId(""); setXClienteNome(""); setXNrMovimento(""); setXNrTitulo(""); setXTpData(""); setXDtInicial(""); setXDtFinal(""); setXSituacao(""); setXPlanoId("");
    setXRows([]); setXHasLoaded(false);
  };

  return (
    <div className="p-3 h-full overflow-auto" onKeyDown={handleKeyDown}>
      <div className="mb-2">
        <h2 className="text-base font-semibold">Gerenciador de Títulos</h2>
      </div>

      {/* Filtros */}
      <div className="border border-border rounded-md p-3 mb-3 bg-card">
        <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
          <FilterIcon size={12} /> Filtros
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente</label>
            <div className="flex gap-1">
              <input
                readOnly
                value={XClienteNome}
                placeholder="Enter para pesquisar..."
                className="flex-1 border border-border rounded px-2 py-1 text-sm bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
                className="px-2 py-1 border border-border rounded bg-card hover:bg-accent flex items-center justify-center"
                title="Pesquisar cliente"
              >
                <Search className="w-4 h-4" />
              </button>
              {XClienteId && (
                <button
                  type="button"
                  onClick={() => {
                    setXClienteId("");
                    setXClienteNome("");
                  }}
                  className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                  title="Limpar"
                >×</button>
              )}
            </div>
          </div>
          <div className="md:col-span-1 min-w-[100px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nº Título</label>
            <input
              type="text"
              value={XNrTitulo}
              onChange={(e) => setXNrTitulo(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="md:col-span-1 min-w-[100px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nº Pedido</label>
            <input
              type="text"
              value={XNrMovimento}
              onChange={(e) => setXNrMovimento(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div className="md:col-span-1 min-w-[110px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Data</label>
            <select
              value={XTpData}
              onChange={(e) => {
                const val = e.target.value;
                setXTpData(val);
                if (val === "") {
                  setXDtInicial("");
                  setXDtFinal("");
                }
              }}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value=""></option>
              <option value="E">Emissão</option>
              <option value="V">Vencimento</option>
              <option value="B">Baixa</option>
            </select>
          </div>
          <div className="md:col-span-1 min-w-[120px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dt. Inicial</label>
            <input
              type="date"
              disabled={XTpData === ""}
              value={XDtInicial}
              max="9999-12-31"
              onChange={(e) => setXDtInicial(e.target.value)}
              className={`w-full border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:bg-secondary/50 ${
                isDateRangeInvalid ? "border-destructive focus:ring-destructive" : "border-border"
              }`}
            />
          </div>
          <div className="md:col-span-1 min-w-[120px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Dt. Final</label>
            <input
              type="date"
              disabled={XTpData === ""}
              value={XDtFinal}
              max="9999-12-31"
              onChange={(e) => setXDtFinal(e.target.value)}
              className={`w-full border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:bg-secondary/50 ${
                isDateRangeInvalid ? "border-destructive focus:ring-destructive" : "border-border"
              }`}
            />
          </div>
          <div className="md:col-span-1 min-w-[110px]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Situação</label>
            <select
              value={XSituacao}
              onChange={(e) => setXSituacao(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value=""></option>
              <option value="TODAS">Todas</option>
              {SITUACOES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Plano de Contas</label>
            <select
              value={XPlanoId}
              onChange={(e) => setXPlanoId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value=""></option>
              <option value="TODOS">Todos</option>
              {XPlanos.map(p => (
                <option key={p.plano_id} value={p.plano_id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              onClick={loadGrid}
              disabled={XLoading}
              className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1 h-9"
            >
              <RefreshCw size={12} className={XLoading ? "animate-spin" : ""} /> Aplicar
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent h-9"
            >Limpar</button>
          </div>
        </div>
      </div>

      <DataGrid
        columns={XCols}
        data={XRows}
        selectedIdx={XSelectedIdx}
        onRowClick={(_r, i) => setXSelectedIdx(i)}
        onRowDoubleClick={(r) => openTitulo(r as IRow)}
        exportTitle="Gerenciador de Títulos a Receber"
        maxHeight="calc(100vh - 320px)"
        toolbarLeft={
          <>
            <button
              onClick={loadGrid}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
              title="Atualizar"
            >
              <RefreshCw size={14} className={XLoading ? "animate-spin" : ""} /> Atualizar
            </button>
          </>
        }
      />

      <ClienteSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        onSelect={(cliente) => {
          setXClienteId(cliente.cadastro_id.toString());
          setXClienteNome(cliente.razao_social || cliente.nome_fantasia || cliente.cadastro_id.toString());
        }}
        empresaId={Number(XEmpresaId)}
      />

      {XShowAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-lg p-5 max-w-sm w-full shadow-lg mx-4">
            <h3 className="text-lg font-semibold text-destructive mb-2">Aviso</h3>
            <p className="text-sm text-foreground mb-4">{XAlertMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setXShowAlert(false)}
                className="px-4 py-2 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {XActionType && XActionRow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-muted/30 border-b border-border px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                {XActionType === "BAIXAR" && (
                  <>
                    <CheckCircle className="w-5 h-5 text-emerald-500 animate-pulse" />
                    <span>Baixar Título</span>
                  </>
                )}
                {XActionType === "ESTORNAR" && (
                  <>
                    <RotateCcw className="w-5 h-5 text-amber-500 animate-pulse" />
                    <span>Estornar Título</span>
                  </>
                )}
                {XActionType === "CANCELAR" && (
                  <>
                    <XCircle className="w-5 h-5 text-rose-500 animate-pulse" />
                    <span>Cancelar Título</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => { setXActionType(null); setXActionRow(null); }}
                className="text-muted-foreground hover:text-foreground text-lg font-medium"
              >
                &times;
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Dados do Título (Disabled/Read-only) */}
              <div className="bg-muted/20 border border-border/60 rounded-lg p-3 grid grid-cols-2 gap-3 text-xs">
                <div className="col-span-2">
                  <span className="block text-muted-foreground font-medium mb-0.5">Cliente</span>
                  <span className="font-semibold">{XActionRow.cliente}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium mb-0.5">Título / Doc</span>
                  <span className="font-semibold">{XActionRow.titulo || "-"}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium mb-0.5">Vencimento</span>
                  <span className="font-semibold">{fmtDate(XActionRow.dt_vencto)}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium mb-0.5">Valor Aberto</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">R$ {fmtMoney(XActionRow.vl_a_pagar)}</span>
                </div>
                <div>
                  <span className="block text-muted-foreground font-medium mb-0.5">Valor Pago</span>
                  <span className="font-semibold">R$ {fmtMoney(XActionRow.vl_pago)}</span>
                </div>
              </div>

              {/* Formulário Editável apenas para Baixar */}
              {XActionType === "BAIXAR" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Data de Pagamento</label>
                    <input
                      type="date"
                      value={XBaixaDtPagamento}
                      onChange={(e) => handleDtPagamentoChange(e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Valor Pago (R$)</label>
                    <input
                      ref={XInputVlPagoRef}
                      type="text"
                      value={XBaixaVlPagoStr}
                      onChange={(e) => handleVlPagoChange(e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-right"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Desconto (R$)</label>
                    <input
                      type="text"
                      value={XBaixaVlDescontoStr}
                      onChange={(e) => handleDescontoChange(e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-right"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Acréscimos / Juros (R$)</label>
                    <input
                      type="text"
                      value={XBaixaVlJurosStr}
                      onChange={(e) => handleJurosChange(e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-right"
                      placeholder="0,00"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Meio de Pagamento</label>
                    <select
                      value={XBaixaMeioPagamentoId}
                      onChange={(e) => setXBaixaMeioPagamentoId(e.target.value)}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value="">Selecione...</option>
                      {XMeiosPagamento.map((m) => (
                        <option key={m.codigo} value={m.codigo}>
                          {m.descricao}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Portador</label>
                    <select
                      value={XBaixaPortadorId}
                      onChange={(e) => setXBaixaPortadorId(Number(e.target.value))}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value={0}>Selecione...</option>
                      {XPortadores.map((p) => (
                        <option key={p.portador_id} value={p.portador_id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Plano de Contas</label>
                    <select
                      value={XBaixaPlanoId}
                      onChange={(e) => setXBaixaPlanoId(Number(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          XSelectCaixaRef.current?.focus();
                        }
                      }}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      <option value={0}>Selecione...</option>
                      {XPlanos.map((p) => (
                        <option key={p.plano_id} value={p.plano_id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Caixa <span className="text-destructive">*</span></label>
                    <select
                      ref={XSelectCaixaRef}
                      value={XBaixaCaixaAberturaId}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setXBaixaCaixaAberturaId(val);
                        const sel = XCaixas.find((c) => c.caixa_abertura_id === val);
                        if (sel) {
                          setXBaixaFuncionarioId(sel.funcionario_id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          XBtnConfirmarRef.current?.focus();
                        }
                      }}
                      className="w-full border border-border rounded px-3 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                    >
                      {XCaixas.map((c) => (
                        <option key={c.caixa_abertura_id} value={c.caixa_abertura_id}>
                          {c.caixa_abertura_id} - {c.funcionario_nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Mensagem de alerta/instruções para Estornar */}
              {XActionType === "ESTORNAR" && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                  Ao estornar o título, todos os pagamentos baixados serão deletados. A data de baixa será limpa e o status do título retornará para "A Vencer".
                </div>
              )}

              {/* Mensagem de alerta/instruções para Cancelar */}
              {XActionType === "CANCELAR" && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs text-rose-700 dark:text-rose-300">
                  Deseja prosseguir com o cancelamento deste título? O status será alterado de forma definitiva para "Cancelado".
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="border-t border-border px-5 py-4 bg-muted/10 flex items-center justify-end gap-2">
              {XActionType === "BAIXAR" && (
                <button
                  ref={XBtnConfirmarRef}
                  type="button"
                  onClick={() => {
                    if (parseMoneyToFloat(XBaixaVlPagoStr) <= 0) {
                      toast.error("O valor pago deve ser maior que zero.");
                      return;
                    }
                    if (!XBaixaPortadorId) {
                      toast.error("Selecione o portador.");
                      return;
                    }
                    if (!XBaixaPlanoId) {
                      toast.error("Selecione o plano de contas.");
                      return;
                    }
                    if (!XBaixaCaixaAberturaId) {
                      toast.error("Selecione o caixa.");
                      return;
                    }
                    setXConfirmOpen(true);
                  }}
                  className="px-4 py-2 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1.5 focus:ring-2 focus:ring-ring outline-none"
                  disabled={XActionLoading}
                >
                  <CheckCircle className="w-4 h-4" /> Confirmar Baixa
                </button>
              )}

              {XActionType === "ESTORNAR" && (
                <button
                  ref={XBtnConfirmarRef}
                  type="button"
                  onClick={() => setXConfirmOpen(true)}
                  className="px-4 py-2 rounded text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all flex items-center gap-1.5 focus:ring-2 focus:ring-ring outline-none"
                  disabled={XActionLoading}
                >
                  <RotateCcw className="w-4 h-4" /> Confirmar Estorno
                </button>
              )}

              {XActionType === "CANCELAR" && (
                <button
                  ref={XBtnConfirmarRef}
                  type="button"
                  onClick={() => setXConfirmOpen(true)}
                  className="px-4 py-2 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-all flex items-center gap-1.5 focus:ring-2 focus:ring-ring outline-none"
                  disabled={XActionLoading}
                >
                  <XCircle className="w-4 h-4" /> Confirmar Cancelamento
                </button>
              )}

              <button
                type="button"
                onClick={() => { setXActionType(null); setXActionRow(null); }}
                className="px-4 py-2 border border-border rounded text-xs font-medium bg-card hover:bg-accent text-foreground transition-all"
                disabled={XActionLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Double confirmation modal */}
      {XConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-100">
            <h3 className="text-base font-bold text-foreground mb-2">Confirmação</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Deseja realmente realizar esta ação de{" "}
              <span className="font-bold text-foreground uppercase">
                {XActionType === "BAIXAR" && "Baixa"}
                {XActionType === "ESTORNAR" && "Estorno"}
                {XActionType === "CANCELAR" && "Cancelamento"}
              </span>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                ref={XBtnSimRef}
                onClick={executeAction}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow transition-all focus:ring-2 focus:ring-ring outline-none"
                disabled={XActionLoading}
              >
                {XActionLoading ? "Processando..." : "Sim"}
              </button>
              <button
                onClick={() => setXConfirmOpen(false)}
                className="px-3.5 py-1.5 border border-border rounded text-xs font-medium hover:bg-accent text-foreground transition-all"
                disabled={XActionLoading}
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success alert modal */}
      {XSuccessMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-100 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-foreground mb-2">Sucesso</h3>
            <p className="text-xs text-muted-foreground mb-5">{XSuccessMessage}</p>
            <div className="flex justify-center">
              <button
                ref={XBtnSuccessOkRef}
                onClick={handleSuccessOk}
                className="px-6 py-2 rounded text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 shadow transition-all focus:ring-2 focus:ring-ring outline-none"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultaTitulosReceberForm;
