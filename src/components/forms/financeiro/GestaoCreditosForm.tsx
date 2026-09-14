import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import FormDateField from "@/components/shared/FormDateField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import ClienteSearchDialog, { IClienteRow } from "@/components/forms/pedido/ClienteSearchDialog";
import { 
  Search, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Filter, 
  Check, 
  Wallet,
  Users,
  RotateCcw
} from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface IParceiroRow {
  cadastro_id: number;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
}

interface IExtratoMovimentoRow {
  credito_movimento_id: number;
  tp_movimento: "C" | "D";
  vl_movimento: number;
  vl_saldo_anterior: number;
  vl_saldo_posterior: number;
  origem_movimento: string;
  historico: string;
  dt_movimento: string;
  usuario_id: string;
}

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateBR = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(dateStr);
  }
};

const toCleanIsoDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const clean = dateStr.trim();
  if (clean.includes("/")) {
    const parts = clean.split("/");
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
  }
  return clean.substring(0, 10);
};

const getNextDayIso = (dateStr: string): string => {
  const cleanIso = toCleanIsoDate(dateStr);
  if (!cleanIso) return "";
  const parts = cleanIso.split("-");
  if (parts.length === 3) {
    const yyyy = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1;
    const dd = parseInt(parts[2], 10);
    if (!isNaN(yyyy) && !isNaN(mm) && !isNaN(dd)) {
      const d = new Date(yyyy, mm, dd);
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  return cleanIso;
};

const GestaoCreditosForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  
  // Identificação da Empresa Capa
  const empMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaId);
  const empLabel = empMatriz ? `${empMatriz.empresa_id} - ${empMatriz.identificacao}` : String(XEmpresaId || "");

  // 1. CAPA: Empresa, Tipo Parceiro, Nome Parceiro
  const [tpParceiro, setTpParceiro] = useState<"CLIENTE" | "FORNECEDOR">("CLIENTE");
  const [parceiroSel, setParceiroSel] = useState<IParceiroRow | null>(null);

  // Modal de busca padrão do sistema (igual a tela de Pedidos)
  const [searchParceiroOpen, setSearchParceiroOpen] = useState(false);

  // Saldo Disponível Atual do Parceiro & Saldo Anterior do Período
  const [saldoAtual, setSaldoAtual] = useState<number>(0);
  const [saldoAnterior, setSaldoAnterior] = useState<number>(0);

  // 2. GRID CONTA CORRENTE + FILTROS
  const [dtIni, setDtIni] = useState("");
  const [dtFim, setDtFim] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "C" | "D">("TODOS");

  const [movimentos, setMovimentos] = useState<IExtratoMovimentoRow[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // 3. CRUD MANUAL: Form de Inclusão Manual de Crédito/Débito
  const [formManual, setFormManual] = useState({
    tp_movimento: "C" as "C" | "D",
    vl_movimento: 0,
    historico: "",
  });
  const [salvandoManual, setSalvandoManual] = useState(false);

  // Cálculos dinâmicos da linha de totais
  const totalEntradas = useMemo(() => {
    return movimentos
      .filter(m => m.tp_movimento === "C")
      .reduce((acc, m) => acc + Number(m.vl_movimento || 0), 0);
  }, [movimentos]);

  const totalSaidas = useMemo(() => {
    return movimentos
      .filter(m => m.tp_movimento === "D")
      .reduce((acc, m) => acc + Number(m.vl_movimento || 0), 0);
  }, [movimentos]);

  const saldoFinalCalculado = useMemo(() => {
    return saldoAnterior + totalEntradas - totalSaidas;
  }, [saldoAnterior, totalEntradas, totalSaidas]);

  // Limpar parceiro ao trocar o tipo
  const handleTrocaTipoParceiro = (novoTipo: "CLIENTE" | "FORNECEDOR") => {
    setTpParceiro(novoTipo);
    setParceiroSel(null);
    setSaldoAtual(0);
    setSaldoAnterior(0);
    setMovimentos([]);
  };

  // Carregar Saldo e Extrato (Últimos 100 lançamentos por padrão) quando selecionar o parceiro ou mudar tipo/empresa
  useEffect(() => {
    if (parceiroSel && XEmpresaId) {
      carregarSaldoEExtratoComParametros(dtIni, dtFim, filtroTipo, false);
    } else {
      setSaldoAtual(0);
      setSaldoAnterior(0);
      setMovimentos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parceiroSel, tpParceiro, XEmpresaId]);

  const carregarSaldoEExtratoComParametros = async (
    ini: string,
    fim: string,
    tipo: "TODOS" | "C" | "D",
    usarFiltroData: boolean = false
  ) => {
    if (!parceiroSel || !XEmpresaId) return;
    setLoadingGrid(true);
    try {
      const cadId = Number(parceiroSel.cadastro_id);
      const empId = Number(XEmpresaId);

      // 1. Carregar Saldo Atual do Parceiro
      const { data: saldoData } = await db.from("cadastro_credito_saldo")
        .select("vl_saldo_atual")
        .eq("empresa_id", empId)
        .eq("cadastro_id", cadId)
        .eq("tp_parceiro", tpParceiro)
        .eq("excluido", false)
        .maybeSingle();

      if (saldoData && saldoData.vl_saldo_atual !== undefined && saldoData.vl_saldo_atual !== null) {
        setSaldoAtual(Number(saldoData.vl_saldo_atual));
      } else {
        const { data: ultMov } = await db.from("cadastro_credito_movimento")
          .select("vl_saldo_posterior")
          .eq("empresa_id", empId)
          .eq("cadastro_id", cadId)
          .eq("tp_parceiro", tpParceiro)
          .eq("excluido", false)
          .order("credito_movimento_id", { ascending: false })
          .limit(1)
          .maybeSingle();

        setSaldoAtual(Number(ultMov?.vl_saldo_posterior || 0));
      }

      // 2. Carregar Movimentações da Conta Corrente (Últimos 100 lançamentos por padrão)
      let query = db.from("cadastro_credito_movimento")
        .select("credito_movimento_id, tp_movimento, vl_movimento, vl_saldo_anterior, vl_saldo_posterior, origem_movimento, historico, dt_movimento, usuario_id")
        .eq("empresa_id", empId)
        .eq("cadastro_id", cadId)
        .eq("tp_parceiro", tpParceiro)
        .eq("excluido", false);

      const cleanIni = toCleanIsoDate(ini);
      const cleanFim = toCleanIsoDate(fim);

      if (usarFiltroData) {
        if (cleanIni) {
          query = query.gte("dt_movimento", `${cleanIni}T00:00:00`);
        }
        if (cleanFim) {
          const nextFim = getNextDayIso(cleanFim);
          query = query.lt("dt_movimento", `${nextFim}T00:00:00`);
        }
      }

      if (tipo !== "TODOS") {
        query = query.eq("tp_movimento", tipo);
      }

      query = query.order("credito_movimento_id", { ascending: false }).limit(100);

      const { data: movsData, error: movsErr } = await query;
      if (movsErr) throw movsErr;

      const listaMovs: IExtratoMovimentoRow[] = movsData || [];
      setMovimentos(listaMovs);

      // 3. Carregar ou Calcular o Saldo Anterior do Período/Seleção
      let calcSaldoAnt = 0;
      if (usarFiltroData && cleanIni) {
        // Busca o saldo posterior da última movimentação ocorrida ANTES da data inicial do filtro
        const { data: movAnt } = await db.from("cadastro_credito_movimento")
          .select("vl_saldo_posterior")
          .eq("empresa_id", empId)
          .eq("cadastro_id", cadId)
          .eq("tp_parceiro", tpParceiro)
          .eq("excluido", false)
          .lt("dt_movimento", `${cleanIni}T00:00:00`)
          .order("credito_movimento_id", { ascending: false })
          .limit(1)
          .maybeSingle();

        calcSaldoAnt = Number(movAnt?.vl_saldo_posterior || 0);
      } else {
        // Sem filtro de data inicial especifico: pega o vl_saldo_anterior da movimentação mais antiga da lista carregada
        if (listaMovs.length > 0) {
          const oldestMov = listaMovs[listaMovs.length - 1];
          calcSaldoAnt = Number(oldestMov.vl_saldo_anterior || 0);
        } else {
          calcSaldoAnt = 0;
        }
      }

      setSaldoAnterior(calcSaldoAnt);
    } catch (err: any) {
      toast.error("Erro ao carregar conta corrente do parceiro: " + (err.message || String(err)));
    } finally {
      setLoadingGrid(false);
    }
  };

  const carregarSaldoEExtrato = (usarFiltroData: boolean = false) => {
    return carregarSaldoEExtratoComParametros(dtIni, dtFim, filtroTipo, usarFiltroData);
  };

  // Limpar os Filtros do Extrato
  const limparFiltros = () => {
    setDtIni("");
    setDtFim("");
    setFiltroTipo("TODOS");
    carregarSaldoEExtratoComParametros("", "", "TODOS", false);
  };

  // 3. Salvar Lançamento Manual no CRUD
  const salvarLancamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parceiroSel) {
      toast.error("Selecione um parceiro na capa antes de incluir lançamentos.");
      return;
    }

    if (formManual.vl_movimento <= 0) {
      toast.error("Informe um valor maior que zero para o lançamento.");
      return;
    }

    if (!formManual.historico.trim()) {
      toast.error("Informe o histórico / justificativa do lançamento manual.");
      return;
    }

    setSalvandoManual(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data, error } = await db.rpc("fu_registrar_movimento_credito", {
        _empresa_id: Number(XEmpresaId),
        _cadastro_id: Number(parceiroSel.cadastro_id),
        _tp_parceiro: tpParceiro,
        _tp_movimento: formManual.tp_movimento,
        _vl_movimento: formManual.vl_movimento,
        _origem_movimento: "LANCAMENTO_MANUAL",
        _historico: `[AJUSTE MANUAL] ${formManual.historico.trim()}`,
        _usuario_id: userId,
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Lançamento efetuado com sucesso! Novo saldo: R$ ${fmt(data.vl_saldo_posterior)}`);
      
      // Atualiza o saldo imediato
      if (data?.vl_saldo_posterior !== undefined) {
        setSaldoAtual(Number(data.vl_saldo_posterior));
      }

      // Limpar formulário manual e recarregar a grid instantaneamente
      setFormManual({
        tp_movimento: "C",
        vl_movimento: 0,
        historico: "",
      });

      await carregarSaldoEExtrato(false);
    } catch (err: any) {
      toast.error("Erro ao salvar lançamento manual: " + (err.message || String(err)));
    } finally {
      setSalvandoManual(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500 p-4 md:p-6">
      {/* Cabeçalho da Tela estilo Tabela de Preços */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Gestão de Créditos</h2>
            <p className="text-xs text-muted-foreground">Controle de conta corrente de créditos por parceiro</p>
          </div>
        </div>
      </div>

      {/* 1. CAPA: Empresa + Tipo Parceiro + Nome Parceiro (Estilo Tabela de Preços) */}
      <div className="bg-secondary/10 p-3 rounded-lg border border-border/60 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Empresa — desabilitado */}
          <div className="w-64 shrink-0">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Empresa</label>
            <input
              type="text"
              value={empLabel}
              readOnly
              disabled
              className="w-full border border-border rounded px-2.5 py-1.5 text-sm bg-secondary/50 text-muted-foreground cursor-not-allowed font-medium"
            />
          </div>

          {/* Tipo de Parceiro */}
          <div className="w-48 shrink-0">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo de Parceiro *</label>
            <select
              value={tpParceiro}
              onChange={e => handleTrocaTipoParceiro(e.target.value as "CLIENTE" | "FORNECEDOR")}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card font-semibold outline-none focus:ring-2 focus:ring-primary/30 h-[34px]"
            >
              <option value="CLIENTE">CLIENTE (Passivo)</option>
              <option value="FORNECEDOR">FORNECEDOR (Ativo)</option>
            </select>
          </div>

          {/* Nome / Seleção do Parceiro */}
          <div className="flex-1 min-w-[280px]">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Parceiro ({tpParceiro}) <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={parceiroSel ? `${parceiroSel.razao_social} ${parceiroSel.cnpj ? `(${formatCPFCNPJ(parceiroSel.cnpj)})` : ""}` : ""}
                placeholder={`Clique para selecionar um ${tpParceiro.toLowerCase()}...`}
                onClick={() => setSearchParceiroOpen(true)}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card cursor-pointer font-medium hover:border-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setSearchParceiroOpen(true)}
                className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded hover:opacity-90 flex items-center gap-1.5 h-[34px] shrink-0"
              >
                <Search className="w-3.5 h-3.5" /> PROCURAR
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Se não houver parceiro selecionado */}
      {!parceiroSel ? (
        <div className="flex-1 bg-card rounded-xl border border-border p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold">Nenhum Parceiro Selecionado</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Selecione o parceiro na capa acima para carregar sua conta corrente de créditos e realizar lançamentos manuais.
          </p>
          <button
            onClick={() => setSearchParceiroOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:opacity-90"
          >
            SELECIONAR PARCEIRO
          </button>
        </div>
      ) : (
        <>
          {/* 3. CRUD MANUAL: Formulário de Inclusão Manual de Crédito / Débito */}
          <form onSubmit={salvarLancamentoManual} className="bg-card p-3 rounded-lg border border-border space-y-2 shadow-sm">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-tight flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-primary" /> Lançamento Manual na Conta Corrente
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {/* Tipo Movimento */}
              <div className="w-56 shrink-0">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Tipo de Movimentação</label>
                <select
                  value={formManual.tp_movimento}
                  onChange={e => setFormManual(prev => ({ ...prev, tp_movimento: e.target.value as "C" | "D" }))}
                  className="w-full border border-border rounded px-2 py-1.5 text-xs bg-background font-bold h-[34px]"
                >
                  <option value="C">CONCEDER CRÉDITO (ENTRADA +)</option>
                  <option value="D">UTILIZAR / ABATER DÉBITO (SAÍDA -)</option>
                </select>
              </div>

              {/* Valor */}
              <div className="w-36 shrink-0">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Valor (R$) *</label>
                <CurrencyInput
                  value={formManual.vl_movimento}
                  onChange={v => setFormManual(prev => ({ ...prev, vl_movimento: v }))}
                  className="w-full text-right font-mono font-bold text-xs h-[34px]"
                />
              </div>

              {/* Histórico / Justificativa */}
              <div className="flex-1 min-w-[220px]">
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Histórico / Justificativa *</label>
                <input
                  type="text"
                  required
                  value={formManual.historico}
                  onChange={e => setFormManual(prev => ({ ...prev, historico: e.target.value }))}
                  placeholder="Motivo da concessão ou abatimento manual..."
                  className="w-full border border-border rounded px-3 py-1.5 text-xs bg-background h-[34px]"
                />
              </div>

              {/* Botão de Inclusão */}
              <button
                type="submit"
                disabled={salvandoManual}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded shadow-sm flex items-center gap-1.5 h-[34px] shrink-0 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {salvandoManual ? "SALVANDO..." : "INCLUIR MOVIMENTO"}
              </button>
            </div>
          </form>

          {/* 2. GRID CONTA CORRENTE + FILTROS */}
          <div className="bg-card rounded-xl border border-border p-3 flex-1 flex flex-col space-y-3 overflow-hidden shadow-sm">
            {/* Barra de Filtros do Extrato */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-muted/20 p-2.5 rounded-lg border border-border/60">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase">
                  <Filter className="w-3.5 h-3.5" /> Filtros:
                </div>

                <div className="w-36">
                  <FormDateField
                    label="Data Inicial"
                    value={dtIni}
                    onChange={v => setDtIni(v || "")}
                  />
                </div>

                <div className="w-36">
                  <FormDateField
                    label="Data Final"
                    value={dtFim}
                    onChange={v => setDtFim(v || "")}
                  />
                </div>

                <div className="w-40">
                  <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Operação</label>
                  <select
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value as any)}
                    className="w-full text-xs border border-border rounded px-2 py-1 bg-background font-semibold h-[30px]"
                  >
                    <option value="TODOS">Todas</option>
                    <option value="C">Entradas (+)</option>
                    <option value="D">Saídas (-)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => carregarSaldoEExtrato(true)}
                  disabled={loadingGrid}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 self-end h-[30px]"
                >
                  {loadingGrid ? "FILTRANDO..." : "FILTRAR"}
                </button>

                <button
                  type="button"
                  onClick={limparFiltros}
                  disabled={loadingGrid}
                  className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded text-xs font-bold self-end h-[30px] flex items-center gap-1 border border-border"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> LIMPAR
                </button>
              </div>

              <div className="text-xs text-muted-foreground font-semibold">
                Lançamentos carregados: <strong className="text-foreground font-mono">{movimentos.length}</strong>
              </div>
            </div>

            {/* Grid da Conta Corrente */}
            <div className="border border-border rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-2">Data / Hora</div>
                <div className="col-span-2">Origem</div>
                <div className="col-span-1 text-center">Tipo</div>
                <div className="col-span-2 text-right">Valor (R$)</div>
                <div className="col-span-2 text-right">Saldo Resultante</div>
                <div className="col-span-3">Histórico / Observação</div>
              </div>

              <div className="overflow-y-auto flex-1 divide-y divide-border">
                {loadingGrid && (
                  <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                    Carregando extrato de conta corrente...
                  </div>
                )}

                {!loadingGrid && movimentos.length === 0 && (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">
                    Nenhuma movimentação registrada no período para este parceiro.
                  </div>
                )}

                {!loadingGrid && movimentos.map((m, idx) => (
                  <div
                    key={m.credito_movimento_id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-muted/30 transition-colors ${
                      idx % 2 ? "bg-muted/10" : ""
                    }`}
                  >
                    <div className="col-span-2 font-mono text-muted-foreground">
                      {formatDateBR(m.dt_movimento)}
                    </div>

                    <div className="col-span-2 font-semibold uppercase text-[11px] truncate" title={m.origem_movimento}>
                      {m.origem_movimento}
                    </div>

                    <div className="col-span-1 text-center">
                      {m.tp_movimento === "C" ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <ArrowUpRight className="w-3 h-3" /> ENTRADA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          <ArrowDownLeft className="w-3 h-3" /> SAÍDA
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-right font-mono font-bold">
                      <span className={m.tp_movimento === "C" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {m.tp_movimento === "C" ? "+" : "-"} R$ {fmt(m.vl_movimento)}
                      </span>
                    </div>

                    <div className="col-span-2 text-right font-mono font-semibold">
                      R$ {fmt(m.vl_saldo_posterior)}
                    </div>

                    <div className="col-span-3 truncate text-muted-foreground text-[11px]" title={m.historico}>
                      {m.historico}
                    </div>
                  </div>
                ))}
              </div>

              {/* 4. NO FINAL DA GRID: SALDO ANTERIOR, TOTAL ENTRADA, TOTAL SAÍDAS, SALDO DISPONÍVEL */}
              <div className="bg-muted/30 p-3 border-t-2 border-primary/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Saldo Anterior */}
                <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded border border-border shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-muted-foreground">Saldo Anterior:</span>
                  <span className="font-mono font-bold text-foreground">R$ {fmt(saldoAnterior)}</span>
                </div>

                {/* Total Entradas */}
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded border border-emerald-200 dark:border-emerald-800 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" /> (+) Total Entradas:
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">R$ {fmt(totalEntradas)}</span>
                </div>

                {/* Total Saídas */}
                <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 rounded border border-rose-200 dark:border-rose-800 shadow-xs">
                  <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-300 flex items-center gap-1">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-600" /> (-) Total Saídas:
                  </span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-300">R$ {fmt(totalSaidas)}</span>
                </div>

                {/* Saldo Disponível / Final */}
                <div className="flex items-center gap-2.5 bg-emerald-100 dark:bg-emerald-900/50 px-4 py-1.5 rounded-lg border-2 border-emerald-500 shadow-sm ml-auto">
                  <Wallet className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                  <span className="text-xs font-extrabold uppercase text-emerald-900 dark:text-emerald-100 tracking-tight">
                    (=) SALDO DISPONÍVEL DO {tpParceiro}:
                  </span>
                  <span className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-300">
                    R$ {fmt(saldoFinalCalculado)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================== */}
      {/* DIÁLOGO PADRÃO DE PESQUISA DE CLIENTE/FORNECEDOR (IGUAL A TELA DE PEDIDOS) */}
      {/* ================================================== */}
      {searchParceiroOpen && (
        <ClienteSearchDialog
          open={searchParceiroOpen}
          onClose={() => setSearchParceiroOpen(false)}
          onSelect={(c: IClienteRow) => {
            setParceiroSel({
              cadastro_id: c.cadastro_id,
              razao_social: c.razao_social || `Parceiro #${c.cadastro_id}`,
              nome_fantasia: c.nome_fantasia || "",
              cnpj: c.cnpj || "",
            });
            setSearchParceiroOpen(false);
          }}
          empresaId={XEmpresaId}
          tipo={tpParceiro === "CLIENTE" ? "cliente" : "fornecedor"}
        />
      )}
    </div>
  );
};

export default GestaoCreditosForm;
