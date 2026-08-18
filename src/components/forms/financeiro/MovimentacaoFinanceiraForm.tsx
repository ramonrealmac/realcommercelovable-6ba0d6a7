import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  BarChart3, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowRightLeft, 
  Search, 
  Filter as FilterIcon, 
  RefreshCw, 
  Wallet, 
  AlignLeft, 
  Eye, 
  FileText,
  DollarSign,
  Receipt,
  Lock,
  History
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import RpbFormReportsButton from "@/report-builder/components/executor/RpbFormReportsButton";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";

const db = supabase as any;

interface IFinanceiroConsolidadoRow {
  financeiro_consolidado_id: string;
  empresa_id: number;
  centro_custo_id: number | null;
  portador_id: number | null;
  plano_conta_id: number | null;
  data_ocorrencia: string;
  data_competencia: string | null;
  data_baixa: string | null;
  valor: number;
  historico: string | null;
  usuario_id: string | null;
  origem: string; // 'R' | 'P' | 'M' | 'C'
  id_da_origem: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields & Extrato Conta Corrente
  portador_nome?: string;
  plano_conta_nome?: string;
  plano_conta_codigo?: string;
  saldo_acumulado?: number;
}

interface IPortadorOpt {
  portador_id: number;
  nome: string;
}

interface IPlanoContaOpt {
  plano_conta_id: number;
  conta: string;
  nome: string;
}

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "—";
  const str = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [datePart] = str.split("T");
    const [year, month, day] = datePart.split("-");
    if (year && month && day) {
      return `${day}/${month}/${year.slice(-4)}`;
    }
  }
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-4);
  return `${day}/${month}/${year}`;
};

const fmtDateTime = (v: string | null | undefined) => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-4);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

// Retorna o dia imediatamente anterior a uma data no formato YYYY-MM-DD
const getPreviousDay = (isoDateStr: string) => {
  if (!isoDateStr) return "";
  const [year, month, day] = isoDateStr.split("-").map(Number);
  if (!year || !month || !day) return "";
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() - 1);
  const prevYear = d.getFullYear();
  const prevMonth = String(d.getMonth() + 1).padStart(2, "0");
  const prevDay = String(d.getDate()).padStart(2, "0");
  return `${prevYear}-${prevMonth}-${prevDay}`;
};

const MovimentacaoFinanceiraForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Refs para controle explícito de foco e navegação (ENTER / Alt+ArrowDown)
  const dtInicioRef = useRef<HTMLInputElement>(null);
  const dtFimRef = useRef<HTMLInputElement>(null);
  const origemSelectRef = useRef<HTMLSelectElement>(null);
  const portadorSelectRef = useRef<HTMLSelectElement>(null);
  const planoContaSelectRef = useRef<HTMLSelectElement>(null);
  const btnFiltrarRef = useRef<HTMLButtonElement>(null);

  // Foco inicial automático em Data Início ao abrir a tela
  useEffect(() => {
    const timer = setTimeout(() => {
      dtInicioRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Função para resolver a empresa ativa dinamicamente
  const getActiveEmpresaId = useCallback(() => {
    if (XEmpresaId && XEmpresaId > 0) return XEmpresaId;
    try {
      const saved = localStorage.getItem("XEmpresaId");
      if (saved && Number(saved) > 0) return Number(saved);
    } catch {}
    return 5;
  }, [XEmpresaId]);

  // Estados de Filtros - Inicia limpo com campos e combos em branco
  const [XDnInicio, setXDnInicio] = useState<string>("");
  const [XDnFim, setXDnFim] = useState<string>("");
  const [XOrigemFilter, setXOrigemFilter] = useState<string>("");
  const [XPortadorFilter, setXPortadorFilter] = useState<string>("");
  const [XPlanoContaFilter, setXPlanoContaFilter] = useState<string>("");
  const [XBuscaText, setXBuscaText] = useState<string>("");

  // Listas auxiliares para combos
  const [XPortadores, setXPortadores] = useState<IPortadorOpt[]>([]);
  const [XPlanosConta, setXPlanosConta] = useState<IPlanoContaOpt[]>([]);

  // Estado de Dados, Saldo Anterior e Pesquisa
  const [XRows, setXRows] = useState<IFinanceiroConsolidadoRow[]>([]);
  const [XSaldoAnterior, setXSaldoAnterior] = useState<number>(0);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XLoading, setXLoading] = useState<boolean>(false);
  const [XHasSearched, setXHasSearched] = useState<boolean>(false); // A tela abre limpa; só popula ao filtrar

  // Modal de Detalhes
  const [XDetailModal, setXDetailModal] = useState<{
    open: boolean;
    row: IFinanceiroConsolidadoRow | null;
  }>({ open: false, row: null });

  // Carrega opções dos combos dinamicamente (Portadores e Planos de Contas)
  useEffect(() => {
    async function loadAuxData() {
      const empId = getActiveEmpresaId();
      if (!empId) return;

      const [{ data: ports }, { data: planos }] = await Promise.all([
        db.from("portador").select("portador_id, nome").eq("empresa_id", empId).eq("excluido", false).order("nome"),
        db.from("plano_conta").select("plano_conta_id, conta, nome").eq("empresa_id", empId).eq("excluido", false).order("conta")
      ]);

      if (ports) setXPortadores(ports);
      if (planos) setXPlanosConta(planos);
    }

    loadAuxData();
  }, [XEmpresaId, getActiveEmpresaId]);

  // Carrega movimentações e calcula o Saldo Anterior SOMENTE quando acionado (Clique em Filtrar ou Enter)
  const carregarMovimentacoes = useCallback(async () => {
    if (XDnInicio && XDnFim && XDnInicio > XDnFim) {
      toast.error("A Data Início não pode ser maior que a Data Fim.");
      dtInicioRef.current?.focus();
      return;
    }

    const empId = getActiveEmpresaId();
    if (!empId) return;

    setXLoading(true);
    setXHasSearched(true); // Marca que o usuário clicou em filtrar
    try {
      const pPortador = XPortadorFilter !== "TODOS" && XPortadorFilter !== "" ? Number(XPortadorFilter) : null;
      const pPlano = XPlanoContaFilter !== "TODOS" && XPlanoContaFilter !== "" ? Number(XPlanoContaFilter) : null;

      // 1. Cálculo Dinâmico do Saldo Anterior até o dia anterior a XDnInicio
      let saldoAnt = 0;
      if (XDnInicio) {
        const { data: rpcRes, error: rpcErr } = await db.rpc("fn_get_saldo_anterior_consolidado", {
          p_empresa_id: empId,
          p_dt_inicio: XDnInicio,
          p_portador_id: pPortador,
          p_plano_conta_id: pPlano
        });

        if (!rpcErr && rpcRes !== null && rpcRes !== undefined) {
          saldoAnt = Number(rpcRes) || 0;
        } else {
          // Fallback de consulta direta se RPC indisponível
          let qAnt = db
            .from("financeiro_consolidado")
            .select("origem, valor")
            .eq("empresa_id", empId)
            .lt("data_ocorrencia", XDnInicio);
          if (pPortador) qAnt = qAnt.eq("portador_id", pPortador);
          if (pPlano) qAnt = qAnt.eq("plano_conta_id", pPlano);

          const { data: antData } = await qAnt;
          if (antData) {
            saldoAnt = antData.reduce((acc: number, item: any) => {
              const val = Number(item.valor) || 0;
              if (item.origem === 'R') return acc + val;
              if (item.origem === 'P') return acc - val;
              if (item.origem === 'C') return acc + val;
              return acc + val;
            }, 0);
          }
        }
      }
      setXSaldoAnterior(saldoAnt);

      // 2. Consulta dos lançamentos no período selecionado
      let query = db
        .from("financeiro_consolidado")
        .select("*")
        .eq("empresa_id", empId)
        .order("data_ocorrencia", { ascending: true })
        .order("created_at", { ascending: true })
        .range(0, 9999);

      if (XDnInicio) query = query.gte("data_ocorrencia", XDnInicio);
      if (XDnFim) query = query.lte("data_ocorrencia", XDnFim);
      if (XOrigemFilter !== "TODOS" && XOrigemFilter !== "") query = query.eq("origem", XOrigemFilter);
      if (XPortadorFilter !== "TODOS" && XPortadorFilter !== "") query = query.eq("portador_id", pPortador);
      if (XPlanoContaFilter !== "TODOS" && XPlanoContaFilter !== "") query = query.eq("plano_conta_id", pPlano);

      const { data, error } = await query;
      if (error) throw error;

      // Mapeia dinamicamente os nomes dos portadores e planos de conta
      const portMap = new Map(XPortadores.map((p) => [p.portador_id, p.nome]));
      const planoMap = new Map(XPlanosConta.map((pc) => [pc.plano_conta_id, { conta: pc.conta, nome: pc.nome }]));

      const mapped = (data || []).map((row: any) => {
        const pNome = row.portador_id ? portMap.get(row.portador_id) : undefined;
        const pcObj = row.plano_conta_id ? planoMap.get(row.plano_conta_id) : undefined;
        return {
          ...row,
          portador_nome: pNome || (row.portador_id ? `Portador #${row.portador_id}` : "—"),
          plano_conta_nome: pcObj ? `${pcObj.conta} - ${pcObj.nome}` : (row.plano_conta_id ? `Plano #${row.plano_conta_id}` : "—"),
          plano_conta_codigo: pcObj?.conta,
        };
      });

      // 3. Cálculo Cronológico do Saldo Acumulado Movimento a Movimento (Conta Corrente)
      let runningBalance = saldoAnt;
      const mappedWithRunningBalance = mapped.map((r) => {
        const v = Number(r.valor) || 0;
        if (r.origem === "R") {
          runningBalance += v;
        } else if (r.origem === "P") {
          runningBalance -= v;
        } else if (r.origem === "C") {
          runningBalance += v;
        } else {
          runningBalance += v;
        }
        return {
          ...r,
          saldo_acumulado: r.vl_saldo_acumulado !== undefined && r.vl_saldo_acumulado !== null ? Number(r.vl_saldo_acumulado) : runningBalance
        };
      });

      // Exibe na ordem decrescente (mais recentes primeiro no extrato) com o saldo acumulado preservado
      const rowsDesc = [...mappedWithRunningBalance].reverse();
      setXRows(rowsDesc);
    } catch (e: any) {
      console.error("Erro ao carregar movimentações consolidadas:", e);
      toast.error("Erro ao carregar movimentações: " + (e.message || "Falha de conexão"));
    } finally {
      setXLoading(false);
    }
  }, [getActiveEmpresaId, XDnInicio, XDnFim, XOrigemFilter, XPortadorFilter, XPlanoContaFilter, XPortadores, XPlanosConta]);

  // Realtime subscription: atualiza somente se o usuário já tiver filtrado
  useEffect(() => {
    if (!XHasSearched) return;

    const empId = getActiveEmpresaId();
    if (!empId) return;

    const channel = db
      .channel(`consolidado_realtime_${empId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "financeiro_consolidado",
        filter: `empresa_id=eq.${empId}`
      }, () => {
        carregarMovimentacoes();
      })
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [XHasSearched, carregarMovimentacoes, getActiveEmpresaId]);

  // Filtro secundário de pesquisa em texto (client-side)
  const XFilteredRows = useMemo(() => {
    if (!XBuscaText.trim()) return XRows;
    const term = XBuscaText.toLowerCase();
    return XRows.filter((r) =>
      (r.historico && r.historico.toLowerCase().includes(term)) ||
      (r.portador_nome && r.portador_nome.toLowerCase().includes(term)) ||
      (r.plano_conta_nome && r.plano_conta_nome.toLowerCase().includes(term)) ||
      String(r.valor).includes(term) ||
      (r.id_da_origem && String(r.id_da_origem).includes(term))
    );
  }, [XRows, XBuscaText]);

  // Cálculo dos KPIs / Totais Consolidados de Conta Corrente
  const XKpis = useMemo(() => {
    let totalEntradas = 0;
    let totalSaidas = 0;
    let countEntradas = 0;
    let countSaidas = 0;

    for (const r of XFilteredRows) {
      const v = Number(r.valor) || 0;
      if (r.origem === "R") {
        totalEntradas += v;
        countEntradas++;
      } else if (r.origem === "P") {
        totalSaidas += v;
        countSaidas++;
      } else if (r.origem === "C") {
        if (v >= 0) {
          totalEntradas += v;
          if (v > 0) countEntradas++;
        } else {
          totalSaidas += Math.abs(v);
          countSaidas++;
        }
      }
    }

    const saldoConsolidado = XSaldoAnterior + totalEntradas - totalSaidas;

    return {
      totalEntradas,
      totalSaidas,
      saldoConsolidado,
      countEntradas,
      countSaidas,
      totalRegistros: XFilteredRows.length,
    };
  }, [XFilteredRows, XSaldoAnterior]);

  // Clique em Limpar Filtros: limpa tudo e joga o foco na data início
  const handleLimparFiltros = () => {
    setXDnInicio("");
    setXDnFim("");
    setXOrigemFilter("");
    setXPortadorFilter("");
    setXPlanoContaFilter("");
    setXBuscaText("");
    setXRows([]);
    setXSaldoAnterior(0);
    setXHasSearched(false);
    setTimeout(() => {
      dtInicioRef.current?.focus();
    }, 50);
  };

  const getOrigemBadge = useCallback((origem: string) => {
    switch (origem) {
      case "R":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold flex items-center gap-1 text-[10px]">
            <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
            ENTRADA (RECEBIMENTO)
          </Badge>
        );
      case "P":
        return (
          <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold flex items-center gap-1 text-[10px]">
            <ArrowUpFromLine className="w-3 h-3 text-rose-600" />
            SAÍDA (PAGAMENTO)
          </Badge>
        );
      case "C":
        return (
          <Badge className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold flex items-center gap-1 text-[10px]">
            <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            FECHAMENTO DE CAIXA
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold flex items-center gap-1 text-[10px]">
            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
            MOVIMENTAÇÃO
          </Badge>
        );
    }
  }, []);

  // Definição das colunas do Extrato de Conta Corrente no DataGrid
  const XCols: IGridColumn[] = useMemo(() => [
    {
      key: "data_ocorrencia",
      label: "Data Ocorrência",
      width: "120px",
      align: "center",
      getValue: (r: IFinanceiroConsolidadoRow) => r.data_ocorrencia ?? "",
      render: (r: IFinanceiroConsolidadoRow) => <span>{fmtDate(r.data_ocorrencia)}</span>
    },
    {
      key: "origem",
      label: "Origem",
      width: "180px",
      render: (r: IFinanceiroConsolidadoRow) => getOrigemBadge(r.origem)
    },
    {
      key: "historico",
      label: "Histórico / Descrição",
      width: "2.2fr",
      render: (r: IFinanceiroConsolidadoRow) => (
        <span className="font-medium text-foreground truncate block" title={r.historico || "—"}>
          {r.historico || "—"}
        </span>
      )
    },
    {
      key: "portador_nome",
      label: "Portador (Conta/Caixa)",
      width: "1.4fr",
      render: (r: IFinanceiroConsolidadoRow) => (
        <span className="text-muted-foreground truncate block">{r.portador_nome || "—"}</span>
      )
    },
    {
      key: "plano_conta_nome",
      label: "Plano de Contas",
      width: "1.6fr",
      render: (r: IFinanceiroConsolidadoRow) => (
        <span className="text-muted-foreground truncate block">{r.plano_conta_nome || "—"}</span>
      )
    },
    {
      key: "valor",
      label: "Valor Movimento",
      width: "125px",
      align: "right",
      getValue: (r: IFinanceiroConsolidadoRow) => Number(r.valor ?? 0),
      render: (r: IFinanceiroConsolidadoRow) => {
        const isEntrada = r.origem === "R" || (r.origem === "C" && Number(r.valor) >= 0);
        const isSaida = r.origem === "P" || (r.origem === "C" && Number(r.valor) < 0);
        return (
          <span className={`font-bold text-xs ${isEntrada ? "text-emerald-600 dark:text-emerald-400" : isSaida ? "text-rose-600 dark:text-rose-400" : ""}`}>
            {isSaida ? `- ${fmtMoney(r.valor)}` : fmtMoney(r.valor)}
          </span>
        );
      }
    },
    {
      key: "saldo_acumulado",
      label: "Saldo Acumulado",
      width: "135px",
      align: "right",
      getValue: (r: IFinanceiroConsolidadoRow) => Number(r.saldo_acumulado ?? 0),
      render: (r: IFinanceiroConsolidadoRow) => {
        const v = Number(r.saldo_acumulado ?? 0);
        return (
          <span className={`font-bold text-xs ${v >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {fmtMoney(v)}
          </span>
        );
      }
    },
    {
      key: "acoes",
      label: "Ações",
      width: "75px",
      align: "center",
      render: (r: IFinanceiroConsolidadoRow) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setXDetailModal({ open: true, row: r });
          }}
          className="p-1 text-muted-foreground hover:text-primary transition-colors rounded hover:bg-accent"
          title="Ver Detalhes"
        >
          <Eye className="w-4 h-4" />
        </button>
      )
    }
  ], [getOrigemBadge]);

  // Data do dia anterior para exibição no card de Saldo Anterior
  const dataAnteriorLabel = useMemo(() => {
    if (!XDnInicio) return "Início do Histórico";
    const prevIso = getPreviousDay(XDnInicio);
    return `Saldo em ${fmtDate(prevIso)}`;
  }, [XDnInicio]);

  return (
    <div className="p-3 min-h-screen lg:h-full lg:flex lg:flex-col lg:overflow-hidden bg-background">
      {/* ── Topo: Título & Relatórios ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Extrato de Conta Corrente / Movimentações Consolidadas
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <RpbFormReportsButton formId="movimentacao-financeira" formTitle="Movimentações Financeiras" />
        </div>
      </div>

      {/* ── Cards de KPIs / Extrato de Conta Corrente ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3 shrink-0">
        {/* Card 1: Saldo Anterior */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Saldo Anterior
            </span>
            <p className={`text-base font-extrabold mt-0.5 ${
              XSaldoAnterior >= 0 
                ? "text-blue-600 dark:text-blue-400" 
                : "text-rose-600 dark:text-rose-400"
            }`}>
              {XHasSearched ? fmtMoney(XSaldoAnterior) : fmtMoney(0)}
            </p>
            <span className="text-[10px] text-muted-foreground font-medium">
              {XHasSearched ? dataAnteriorLabel : "Informe os filtros"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
            <History className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Total Entradas no Período */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Entradas
            </span>
            <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {XHasSearched ? fmtMoney(XKpis.totalEntradas) : fmtMoney(0)}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {XHasSearched ? `${XKpis.countEntradas} entrada(s) no período` : "Informe os filtros"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
            <ArrowDownToLine className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Total Saídas no Período */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Total Saídas
            </span>
            <p className="text-base font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
              {XHasSearched ? fmtMoney(XKpis.totalSaidas) : fmtMoney(0)}
            </p>
            <span className="text-[10px] text-muted-foreground">
              {XHasSearched ? `${XKpis.countSaidas} saída(s) no período` : "Informe os filtros"}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
            <ArrowUpFromLine className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Saldo Consolidado Atual */}
        <div className="bg-card border border-border rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Saldo Consolidado
            </span>
            <p className={`text-base font-extrabold mt-0.5 ${
              XKpis.saldoConsolidado >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-rose-600 dark:text-rose-400"
            }`}>
              {XHasSearched ? fmtMoney(XKpis.saldoConsolidado) : fmtMoney(0)}
            </p>
            <span className="text-[10px] text-muted-foreground">Anterior + Entradas - Saídas</span>
          </div>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            XKpis.saldoConsolidado >= 0 ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600"
          }`}>
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* ── Painel de Filtros de Pesquisa ── */}
      <div className="border border-border rounded-md p-3 mb-3 bg-card shrink-0">
        <div className="flex items-center gap-2 mb-2 text-[9px] uppercase font-bold tracking-wider text-muted-foreground">
          <FilterIcon size={12} /> Filtros do Extrato
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          {/* 1. Data Início -> ENTER -> vai para Data Fim */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">Data Início</label>
            <input
              ref={dtInicioRef}
              type="date"
              value={XDnInicio}
              onChange={(e) => setXDnInicio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  dtFimRef.current?.focus();
                }
              }}
              className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            />
          </div>

          {/* 2. Data Fim -> ENTER -> vai para Combo Tipo de Movimento */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">Data Fim</label>
            <input
              ref={dtFimRef}
              type="date"
              value={XDnFim}
              onChange={(e) => setXDnFim(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  origemSelectRef.current?.focus();
                }
              }}
              className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            />
          </div>

          {/* 3. Tipo de Movimento -> Alt+Down abre combo | ENTER -> vai para Combo Portador */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">Tipo de Movimento</label>
            <select
              ref={origemSelectRef}
              value={XOrigemFilter}
              onChange={(e) => setXOrigemFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    (origemSelectRef.current as any)?.showPicker?.();
                  } catch {}
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  portadorSelectRef.current?.focus();
                }
              }}
              className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            >
              <option value=""></option>
              <option value="TODOS">Todos</option>
              <option value="R">Entradas (Recebimentos)</option>
              <option value="P">Saídas (Pagamentos)</option>
              <option value="C">Fechamentos de Caixa</option>
              <option value="M">Outras Movimentações</option>
            </select>
          </div>

          {/* 4. Portador -> Alt+Down abre combo | ENTER -> vai para Combo Plano de Contas */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">Portador (Conta/Caixa)</label>
            <select
              ref={portadorSelectRef}
              value={XPortadorFilter}
              onChange={(e) => setXPortadorFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    (portadorSelectRef.current as any)?.showPicker?.();
                  } catch {}
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  planoContaSelectRef.current?.focus();
                }
              }}
              className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            >
              <option value=""></option>
              <option value="TODOS">Todos</option>
              {XPortadores.map((p) => (
                <option key={p.portador_id} value={p.portador_id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Plano de Contas -> Alt+Down abre combo | ENTER -> vai para Botão Filtrar */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-0.5">Plano de Contas</label>
            <select
              ref={planoContaSelectRef}
              value={XPlanoContaFilter}
              onChange={(e) => setXPlanoContaFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    (planoContaSelectRef.current as any)?.showPicker?.();
                  } catch {}
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  btnFiltrarRef.current?.focus();
                }
              }}
              className="w-full border border-border rounded px-1.5 py-0.5 text-[11px] bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            >
              <option value=""></option>
              <option value="TODOS">Todos</option>
              {XPlanosConta.map((pc) => (
                <option key={pc.plano_conta_id} value={pc.plano_conta_id}>
                  {pc.conta} - {pc.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha de busca rápida e ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-border/40">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2" />
            <input
              type="text"
              value={XBuscaText}
              onChange={(e) => setXBuscaText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  carregarMovimentacoes();
                }
              }}
              placeholder="Pesquisar no histórico, portador ou plano de contas..."
              className="w-full pl-8 pr-3 py-1 text-[11px] border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-7"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLimparFiltros}
              className="px-2.5 py-0.5 text-[11px] border border-border rounded hover:bg-accent h-7"
            >
              Limpar Filtros
            </button>
            <button
              ref={btnFiltrarRef}
              onClick={carregarMovimentacoes}
              disabled={XLoading}
              className="px-3 py-0.5 text-[11px] rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5 h-7 font-bold uppercase tracking-wide"
            >
              <FilterIcon size={12} />
              Filtrar Extrato
            </button>
          </div>
        </div>
      </div>

      {/* ── Grid Principal de Dados (DataGrid Extrato de Conta Corrente) ── */}
      <div className="flex-1 min-h-[380px] lg:min-h-0 flex flex-col">
        {!XHasSearched ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground bg-card border border-border rounded-xl">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FilterIcon className="w-6 h-6" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold text-foreground">Defina os filtros de pesquisa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o período e os parâmetros desejados acima e clique em <strong className="text-foreground">Filtrar Extrato</strong> para consultar as movimentações financeiras.
              </p>
            </div>
          </div>
        ) : (
          <DataGrid
            columns={XCols}
            data={XFilteredRows}
            loading={XLoading}
            selectedIdx={XSelectedIdx}
            onRowClick={(_r, i) => setXSelectedIdx(i)}
            onRowDoubleClick={(r) => setXDetailModal({ open: true, row: r as IFinanceiroConsolidadoRow })}
            exportTitle="Extrato de Conta Corrente"
            minWidth="1250px"
            maxHeight="100%"
            toolbarLeft={
              <>
                <button
                  onClick={carregarMovimentacoes}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
                  title="Atualizar"
                >
                  <RefreshCw size={14} className={XLoading ? "animate-spin" : ""} /> Atualizar
                </button>
                <RpbFormReportsButton 
                  nmForm="movimentacao-financeira" 
                  currentRecord={XSelectedIdx !== null && XFilteredRows[XSelectedIdx] ? (XFilteredRows[XSelectedIdx] as Record<string, any>) : undefined} 
                />
              </>
            }
          />
        )}
      </div>

      {/* ── Modal de Detalhes da Movimentação ── */}
      <Dialog
        open={XDetailModal.open}
        onOpenChange={(o) => !o && setXDetailModal({ open: false, row: null })}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              Detalhes do Lançamento Consolidado
            </DialogTitle>
          </DialogHeader>

          {XDetailModal.row && (
            <div className="space-y-4 py-2 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                <span className="font-semibold text-muted-foreground">Tipo de Movimentação</span>
                {getOrigemBadge(XDetailModal.row.origem)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Valor Movimento</span>
                  <p className={`text-base font-extrabold mt-0.5 ${
                    XDetailModal.row.origem === "R" 
                      ? "text-emerald-600" 
                      : XDetailModal.row.origem === "P" 
                        ? "text-rose-600" 
                        : XDetailModal.row.origem === "C" 
                          ? "text-amber-600 dark:text-amber-400" 
                          : "text-foreground"
                  }`}>
                    {fmtMoney(XDetailModal.row.valor)}
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Saldo Acumulado</span>
                  <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {fmtMoney(XDetailModal.row.saldo_acumulado)}
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Data da Ocorrência</span>
                  <p className="text-sm font-bold text-foreground mt-0.5">
                    {fmtDate(XDetailModal.row.data_ocorrencia)}
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Competência</span>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {XDetailModal.row.data_competencia || "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Portador</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {XDetailModal.row.portador_nome}
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Plano de Contas</span>
                  <p className="text-xs font-semibold text-foreground mt-0.5">
                    {XDetailModal.row.plano_conta_nome}
                  </p>
                </div>

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Histórico / Descrição</span>
                  <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">
                    {XDetailModal.row.historico || "Nenhum histórico informado."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border">
                <span>ID Origem: {XDetailModal.row.id_da_origem || "—"}</span>
                <span className="text-right">ID Consolidado: #{XDetailModal.row.financeiro_consolidado_id.substring(0, 8)}...</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <button
              onClick={() => setXDetailModal({ open: false, row: null })}
              className="px-4 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MovimentacaoFinanceiraForm;
