import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  BarChart3, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  ArrowRightLeft, 
  Search, 
  Filter as FilterIcon, 
  RefreshCw, 
  Calendar, 
  Wallet, 
  AlignLeft, 
  Eye, 
  FileText,
  DollarSign,
  Building2,
  Receipt
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import RpbFormReportsButton from "@/report-builder/components/executor/RpbFormReportsButton";

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
  origem: string; // 'R' | 'P' | 'M'
  id_da_origem: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  portador_nome?: string;
  plano_conta_nome?: string;
  plano_conta_codigo?: string;
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

const MovimentacaoFinanceiraForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Refs para controle de navegação por teclado (ENTER e Alt+ArrowDown)
  const dtInicioRef = useRef<HTMLInputElement>(null);
  const dtFimRef = useRef<HTMLInputElement>(null);
  const origemSelectRef = useRef<HTMLSelectElement>(null);
  const portadorSelectRef = useRef<HTMLSelectElement>(null);
  const planoContaSelectRef = useRef<HTMLSelectElement>(null);
  const btnFiltrarRef = useRef<HTMLButtonElement>(null);

  // Função auxiliar para resolver o ID da empresa ativa
  const getActiveEmpresaId = useCallback(() => {
    if (XEmpresaId && XEmpresaId > 0) return XEmpresaId;
    try {
      const saved = localStorage.getItem("XEmpresaId");
      if (saved && Number(saved) > 0) return Number(saved);
    } catch {}
    return 5;
  }, [XEmpresaId]);

  // Datas padrão: Primeiro dia do mês atual até hoje
  const getDefaultDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const isoFirst = `${year}-${month}-01`;
    const day = String(now.getDate()).padStart(2, "0");
    const isoToday = `${year}-${month}-${day}`;
    return { dtIni: isoFirst, dtFim: isoToday };
  };

  const { dtIni: defaultDtIni, dtFim: defaultDtFim } = getDefaultDates();

  // Estados de Filtros
  const [XDnInicio, setXDnInicio] = useState<string>(defaultDtIni);
  const [XDnFim, setXDnFim] = useState<string>(defaultDtFim);
  const [XOrigemFilter, setXOrigemFilter] = useState<string>("TODOS");
  const [XPortadorFilter, setXPortadorFilter] = useState<string>("TODOS");
  const [XPlanoContaFilter, setXPlanoContaFilter] = useState<string>("TODOS");
  const [XBuscaText, setXBuscaText] = useState<string>("");

  // Listas auxiliares para combos
  const [XPortadores, setXPortadores] = useState<IPortadorOpt[]>([]);
  const [XPlanosConta, setXPlanosConta] = useState<IPlanoContaOpt[]>([]);

  // Estado de Dados
  const [XRows, setXRows] = useState<IFinanceiroConsolidadoRow[]>([]);
  const [XLoading, setXLoading] = useState<boolean>(false);
  const [XHasSearched, setXHasSearched] = useState<boolean>(false);

  // Modal de Detalhes
  const [XDetailModal, setXDetailModal] = useState<{
    open: boolean;
    row: IFinanceiroConsolidadoRow | null;
  }>({ open: false, row: null });

  // Carrega opções dos combos (Portadores e Planos de Contas)
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

  // Carrega os registros de movimentação financeira consolidada
  const carregarMovimentacoes = useCallback(async () => {
    // Validação: ao menos um filtro informado
    const temFiltroData = Boolean(XDnInicio || XDnFim);
    const temFiltroOrigem = XOrigemFilter !== "TODOS";
    const temFiltroPortador = XPortadorFilter !== "TODOS";
    const temFiltroPlano = XPlanoContaFilter !== "TODOS";
    const temFiltroBusca = Boolean(XBuscaText.trim());

    if (!temFiltroData && !temFiltroOrigem && !temFiltroPortador && !temFiltroPlano && !temFiltroBusca) {
      toast.error("Ao menos 1 filtro deve ser preenchido para realizar a pesquisa.");
      dtInicioRef.current?.focus();
      return;
    }

    // Validação de intervalo de datas
    if (XDnInicio && XDnFim && XDnInicio > XDnFim) {
      toast.error("A Data Início não pode ser maior que a Data Fim.");
      dtInicioRef.current?.focus();
      return;
    }

    const empId = getActiveEmpresaId();
    if (!empId) return;

    setXLoading(true);
    setXHasSearched(true);
    try {
      let query = db
        .from("financeiro_consolidado")
        .select("*")
        .eq("empresa_id", empId)
        .order("data_ocorrencia", { ascending: false })
        .order("created_at", { ascending: false });

      if (XDnInicio) query = query.gte("data_ocorrencia", XDnInicio);
      if (XDnFim) query = query.lte("data_ocorrencia", XDnFim);
      if (XOrigemFilter !== "TODOS") query = query.eq("origem", XOrigemFilter);
      if (XPortadorFilter !== "TODOS") query = query.eq("portador_id", Number(XPortadorFilter));
      if (XPlanoContaFilter !== "TODOS") query = query.eq("plano_conta_id", Number(XPlanoContaFilter));

      const { data, error } = await query;
      if (error) throw error;

      // Mapeia os dados com os nomes dos portadores e planos de conta
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

      setXRows(mapped);
    } catch (e: any) {
      console.error("Erro ao carregar movimentações consolidadas:", e);
      toast.error("Erro ao carregar movimentações: " + (e.message || "Falha de conexão"));
    } finally {
      setXLoading(false);
    }
  }, [getActiveEmpresaId, XDnInicio, XDnFim, XOrigemFilter, XPortadorFilter, XPlanoContaFilter, XPortadores, XPlanosConta]);

  // Inscreve no Supabase Realtime apenas se o usuário já tiver clicado em Filtrar
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
  }, [XHasSearched, carregarMovimentacoes, XEmpresaId, getActiveEmpresaId]);

  // Filtro secundário via texto no histórico (client-side)
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

  // Cálculo dos KPIs / Totais
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
      }
    }

    const saldo = totalEntradas - totalSaidas;

    return {
      totalEntradas,
      totalSaidas,
      saldo,
      countEntradas,
      countSaidas,
      totalRegistros: XFilteredRows.length,
    };
  }, [XFilteredRows]);

  const handleLimparFiltros = () => {
    setXDnInicio("");
    setXDnFim("");
    setXOrigemFilter("TODOS");
    setXPortadorFilter("TODOS");
    setXPlanoContaFilter("TODOS");
    setXBuscaText("");
    setXRows([]);
    setXHasSearched(false);
    setTimeout(() => {
      dtInicioRef.current?.focus();
    }, 50);
  };

  const getOrigemBadge = (origem: string) => {
    switch (origem) {
      case "R":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold flex items-center gap-1">
            <ArrowDownToLine className="w-3 h-3 text-emerald-600" />
            ENTRADA (RECEBIMENTO)
          </Badge>
        );
      case "P":
        return (
          <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-bold flex items-center gap-1">
            <ArrowUpFromLine className="w-3 h-3 text-rose-600" />
            SAÍDA (PAGAMENTO)
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 font-bold flex items-center gap-1">
            <ArrowRightLeft className="w-3 h-3 text-blue-600" />
            MOVIMENTAÇÃO
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto w-full">
      {/* ── Topo: Título & Relatórios ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Movimentações Financeiras Consolidadas</h2>
            <p className="text-xs text-muted-foreground">
              Extrato consolidado de entradas, saídas e movimentações de caixa/bancos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RpbFormReportsButton formId="movimentacao-financeira" formTitle="Movimentações Financeiras" />
        </div>
      </div>

      {/* ── Cards de KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Entradas */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Entradas
            </span>
            <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {fmtMoney(XKpis.totalEntradas)}
            </p>
            <span className="text-[11px] text-muted-foreground">{XKpis.countEntradas} lançamento(s)</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
        </div>

        {/* Saídas */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Saídas
            </span>
            <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
              {fmtMoney(XKpis.totalSaidas)}
            </p>
            <span className="text-[11px] text-muted-foreground">{XKpis.countSaidas} lançamento(s)</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
            <ArrowUpFromLine className="w-5 h-5" />
          </div>
        </div>

        {/* Saldo Consolidado */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Saldo Consolidado
            </span>
            <p className={`text-lg font-extrabold mt-0.5 ${
              XKpis.saldo >= 0 
                ? "text-emerald-600 dark:text-emerald-400" 
                : "text-rose-600 dark:text-rose-400"
            }`}>
              {fmtMoney(XKpis.saldo)}
            </p>
            <span className="text-[11px] text-muted-foreground">Entradas - Saídas</span>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            XKpis.saldo >= 0 ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600" : "bg-rose-100 dark:bg-rose-950/40 text-rose-600"
          }`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Lançamentos */}
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Lançamentos
            </span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              {XKpis.totalRegistros}
            </p>
            <span className="text-[11px] text-muted-foreground">Registros exibidos</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Painel de Filtros Avançados ── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <FilterIcon className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Filtros de Pesquisa</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Data Início */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Data Início</label>
            <input
              ref={dtInicioRef}
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={XDnInicio}
              onChange={(e) => setXDnInicio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dtFimRef.current?.focus();
                }
              }}
              className="border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Data Fim */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Data Fim</label>
            <input
              ref={dtFimRef}
              type="date"
              min="2000-01-01"
              max="2099-12-31"
              value={XDnFim}
              onChange={(e) => setXDnFim(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  origemSelectRef.current?.focus();
                }
              }}
              className="border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Tipo / Origem */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Tipo de Movimento</label>
            <select
              ref={origemSelectRef}
              value={XOrigemFilter}
              onChange={(e) => setXOrigemFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  origemSelectRef.current?.showPicker?.();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  portadorSelectRef.current?.focus();
                }
              }}
              className="border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="R">Entradas (Recebimentos)</option>
              <option value="P">Saídas (Pagamentos)</option>
              <option value="M">Outras Movimentações</option>
            </select>
          </div>

          {/* Portador */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Portador (Conta/Caixa)</label>
            <select
              ref={portadorSelectRef}
              value={XPortadorFilter}
              onChange={(e) => setXPortadorFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  portadorSelectRef.current?.showPicker?.();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  planoContaSelectRef.current?.focus();
                }
              }}
              className="border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="TODOS">Todos os Portadores</option>
              {XPortadores.map((p) => (
                <option key={p.portador_id} value={p.portador_id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Plano de Conta */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Plano de Contas</label>
            <select
              ref={planoContaSelectRef}
              value={XPlanoContaFilter}
              onChange={(e) => setXPlanoContaFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.altKey && e.key === "ArrowDown") {
                  e.preventDefault();
                  planoContaSelectRef.current?.showPicker?.();
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  btnFiltrarRef.current?.focus();
                }
              }}
              className="border border-border rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="TODOS">Todos os Planos</option>
              {XPlanosConta.map((pc) => (
                <option key={pc.plano_conta_id} value={pc.plano_conta_id}>
                  {pc.conta} - {pc.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha de busca rápida e ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={XBuscaText}
              onChange={(e) => setXBuscaText(e.target.value)}
              placeholder="Pesquisar no histórico, portador ou plano de contas..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLimparFiltros}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors"
            >
              Limpar Filtros
            </button>
            <button
              ref={btnFiltrarRef}
              onClick={carregarMovimentacoes}
              disabled={XLoading}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <FilterIcon className="w-3.5 h-3.5" />
              Filtrar
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabela de Dados Consolidados ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {!XHasSearched ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FilterIcon className="w-6 h-6" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold text-foreground">Defina os filtros de pesquisa</p>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione o período e os parâmetros desejados acima e clique em <strong className="text-foreground">Filtrar</strong> para consultar as movimentações financeiras.
              </p>
            </div>
          </div>
        ) : XLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">Carregando movimentações consolidadas...</span>
          </div>
        ) : XFilteredRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma movimentação financeira consolidada encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Data Ocorrência</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Origem</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Histórico / Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Portador</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Plano de Contas</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Valor</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody>
                {XFilteredRows.map((r, idx) => {
                  const isEntrada = r.origem === "R";
                  const isSaida = r.origem === "P";

                  return (
                    <tr
                      key={r.financeiro_consolidado_id}
                      onClick={() => setXDetailModal({ open: true, row: r })}
                      className={`border-t border-border/60 cursor-pointer hover:bg-primary/5 transition-colors ${
                        idx % 2 === 1 ? "bg-muted/20" : ""
                      }`}
                    >
                      {/* Data */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">
                        {fmtDate(r.data_ocorrencia)}
                      </td>

                      {/* Origem */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {getOrigemBadge(r.origem)}
                      </td>

                      {/* Histórico */}
                      <td className="px-3 py-2.5 text-foreground max-w-sm truncate" title={r.historico || ""}>
                        {r.historico || "—"}
                      </td>

                      {/* Portador */}
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <span>{r.portador_nome}</span>
                        </div>
                      </td>

                      {/* Plano de Contas */}
                      <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <AlignLeft className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                          <span>{r.plano_conta_nome}</span>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                        <span className={isEntrada ? "text-emerald-600 dark:text-emerald-400" : isSaida ? "text-rose-600 dark:text-rose-400" : "text-foreground"}>
                          {isEntrada ? "+ " : isSaida ? "- " : ""}
                          {fmtMoney(r.valor)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setXDetailModal({ open: true, row: r });
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              Detalhes da Movimentação Consolidada
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
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Valor</span>
                  <p className={`text-base font-extrabold mt-0.5 ${
                    XDetailModal.row.origem === "R" ? "text-emerald-600" : XDetailModal.row.origem === "P" ? "text-rose-600" : "text-foreground"
                  }`}>
                    {fmtMoney(XDetailModal.row.valor)}
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

                <div className="bg-card p-2.5 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Data da Baixa</span>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {fmtDateTime(XDetailModal.row.data_baixa)}
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
