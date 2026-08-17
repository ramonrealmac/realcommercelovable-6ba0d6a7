import React, { useEffect, useState, useCallback, useMemo } from "react";
import { HandCoins, RefreshCw, Search, CheckCircle, Info, CreditCard, Filter, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

interface IPortadorOpt { portador_id: number; nome: string; }
interface IOperadoraOpt { operadora_id: number; razao: string; }
interface ITaxaOpt { operadora_id: number; parcela: string; taxa_cartao: number; taxa_antecipacao: number; }

interface IOpenTitle {
  financeiro_id: number;
  documento: string | null;
  parcela: number | null;
  dt_emissao: string | null;
  dt_vencto: string | null;
  vl_titulo: number | null;
  vl_pago: number | null;
  vl_despesa: number | null;
  portador_id: number | null;
  plano_id: number | null;
  planoconta_id: number | null;
  cadastro_id: number | null;
  cadastro?: { razao_social: string | null; nome_fantasia: string | null; } | null;
}

const fmtMoney = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const db = supabase as any;

const BaixaCartaoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();

  // Opções carregadas do banco
  const [XPortadores, setXPortadores] = useState<IPortadorOpt[]>([]);
  const [XOperadoras, setXOperadoras] = useState<IOperadoraOpt[]>([]);
  const [XTaxas, setXTaxas] = useState<ITaxaOpt[]>([]);

  // Filtros
  const [XPortadorId, setXPortadorId] = useState<string>("");
  const [XOperadoraId, setXOperadoraId] = useState<string>("");
  const [XTipoData, setXTipoData] = useState<string>(""); // "", "EMISSAO", "VENCIMENTO"
  const [XDtInicial, setXDtInicial] = useState<string>("");
  const [XDtFinal, setXDtFinal] = useState<string>("");

  // Parâmetros de Baixa
  const [XTipoBaixa, setXTipoBaixa] = useState<"normal" | "antecipacao">("normal");

  // Títulos e Seleções
  const [XOpenTitles, setXOpenTitles] = useState<IOpenTitle[]>([]);
  const [XSelectedIds, setXSelectedIds] = useState<number[]>([]);

  // Loadings
  const [XLoading, setXLoading] = useState(false);
  const [XFetchingTitles, setXFetchingTitles] = useState(false);

  // Inicializa datas com o mês corrente
  useEffect(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setXDtInicial(toIsoDate(primeiroDia));
    setXDtFinal(toIsoDate(ultimoDia));
  }, []);

  // Carrega listas iniciais (portadores, operadoras e taxas)
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      try {
        const [portRes, operRes, taxasRes] = await Promise.all([
          db.from("portador")
            .select("portador_id, cd_portador, nome")
            .eq("empresa_id", XEmpresaId)
            .eq("excluido", false)
            .eq("ativo", "S")
            .order("nome"),
          db.from("operadora")
            .select("operadora_id, razao")
            .eq("empresa_id", XEmpresaId)
            .order("razao"),
          db.from("operadora_taxa")
            .select("operadora_id, parcela, taxa_cartao, taxa_antecipacao")
            .eq("empresa_id", XEmpresaId)
            .eq("excluido", false)
        ]);

        if (portRes.data) {
          setXPortadores(portRes.data.map((p: any) => ({
            portador_id: Number(p.portador_id),
            nome: p.cd_portador ? `${p.cd_portador} - ${p.nome}` : p.nome
          })));
        }
        if (operRes.data) {
          setXOperadoras(operRes.data.map((o: any) => ({
            operadora_id: Number(o.operadora_id),
            razao: o.razao
          })));
        }
        if (taxasRes.data) {
          setXTaxas(taxasRes.data.map((t: any) => ({
            operadora_id: Number(t.operadora_id),
            parcela: String(t.parcela),
            taxa_cartao: Number(t.taxa_cartao || 0),
            taxa_antecipacao: Number(t.taxa_antecipacao || 0)
          })));
        }
      } catch (err) {
        console.error("Erro ao carregar combos:", err);
        toast.error("Erro ao carregar dados de portadores/operadoras.");
      }
    })();
  }, [XEmpresaId]);

  // Pesquisar títulos
  const handlePesquisar = async () => {
    if (!XPortadorId) {
      toast.error("Selecione o portador.");
      return;
    }
    if (!XOperadoraId) {
      toast.error("Selecione a operadora.");
      return;
    }

    setXFetchingTitles(true);
    setXSelectedIds([]);
    try {
      // 0. Verificar tipo de antecipação da operadora (NÃO carregar se for AUTOMÁTICA)
      const { data: opData } = await db
        .from("operadora")
        .select("tipo_antecipacao")
        .eq("operadora_id", Number(XOperadoraId))
        .maybeSingle();

      const tipoAntecipacao = (opData?.tipo_antecipacao || "SEM ANTECIPAÇÃO").toUpperCase();
      if (tipoAntecipacao === "AUTOMÁTICA") {
        toast.info("Operadoras com Antecipação Automática já têm seus títulos baixados automaticamente no Caixa.");
        setXOpenTitles([]);
        setXFetchingTitles(false);
        return;
      }

      // 1. Obter movimento_ids correspondentes à operadora selecionada
      const { data: mpRows, error: mpErr } = await db
        .from("movimento_pagamento")
        .select("movimento_id")
        .eq("operadora_id", Number(XOperadoraId))
        .eq("excluido", false);

      if (mpErr) throw mpErr;

      if (!mpRows || mpRows.length === 0) {
        setXOpenTitles([]);
        setXFetchingTitles(false);
        return;
      }

      const movIds = mpRows.map((r: any) => r.movimento_id).filter(Boolean);

      // 2. Buscar títulos na financeiro relacionados aos movimentos
      let finQuery = db
        .from("financeiro")
        .select(`
          financeiro_id,
          documento,
          parcela,
          dt_emissao,
          dt_vencto,
          vl_titulo,
          vl_pago,
          vl_despesa,
          portador_id,
          plano_id,
          planoconta_id,
          cadastro_id,
          observacao1
        `)
        .eq("empresa_id", XEmpresaId)
        .eq("tp_conta", "R")
        .eq("status", "A")
        .eq("ativo", "S")
        .eq("portador_id", Number(XPortadorId))
        .in("movimento_id", movIds)
        .not("observacao1", "ilike", "%ANTECIPAÇÃO AUTOMÁTICA%");

      // Filtros de data se houver tipo selecionado
      if (XTipoData === "EMISSAO") {
        if (XDtInicial && String(XDtInicial).trim() !== "") finQuery = finQuery.gte("dt_emissao", XDtInicial);
        if (XDtFinal && String(XDtFinal).trim() !== "") finQuery = finQuery.lte("dt_emissao", XDtFinal);
      } else if (XTipoData === "VENCIMENTO") {
        if (XDtInicial && String(XDtInicial).trim() !== "") finQuery = finQuery.gte("dt_vencto", XDtInicial);
        if (XDtFinal && String(XDtFinal).trim() !== "") finQuery = finQuery.lte("dt_vencto", XDtFinal);
      }

      const { data: finRows, error: finErr } = await finQuery;
      if (finErr) throw finErr;

      // Buscar nomes dos clientes na tabela cadastro sem depender de relacionamento PostgREST
      const cadIds = Array.from(new Set((finRows || []).map((r: any) => r.cadastro_id).filter(Boolean)));
      
      let cadMap: Record<number, { razao_social: string | null; nome_fantasia: string | null }> = {};
      if (cadIds.length > 0) {
        const { data: cadRows } = await db
          .from("cadastro")
          .select("cadastro_id, razao_social, nome_fantasia")
          .in("cadastro_id", cadIds);
          
        if (cadRows) {
          cadRows.forEach((c: any) => {
            cadMap[c.cadastro_id] = {
              razao_social: c.razao_social,
              nome_fantasia: c.nome_fantasia
            };
          });
        }
      }

      const formattedTitles = (finRows || []).map((t: any) => ({
        ...t,
        cadastro: cadMap[t.cadastro_id] || null
      }));

      setXOpenTitles(formattedTitles as IOpenTitle[]);
      setXSelectedIds(formattedTitles.map((t: any) => t.financeiro_id));

    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar títulos: " + (err.message || String(err)));
    } finally {
      setXFetchingTitles(false);
    }
  };

  // Computa as taxas e valores calculados de despesa e líquido para cada linha
  const titlesWithCalculations = useMemo(() => {
    return XOpenTitles.map(t => {
      const numParcela = Math.max(1, Number(t.parcela || 1));

      const matchingTaxa = XTaxas.find(x =>
        x.operadora_id === Number(XOperadoraId) &&
        String(x.parcela) === String(numParcela)
      );

      const taxaCartao = matchingTaxa ? matchingTaxa.taxa_cartao : 0;
      const taxaAntecipacaoMensal = matchingTaxa ? matchingTaxa.taxa_antecipacao : 0;

      // Se for antecipação, calcula proporcional ao prazo da parcela (ex: 1x = 1 mês, 2x = 2 meses, 3x = 3 meses)
      const taxaAntecipacaoAplicada = XTipoBaixa === "antecipacao"
        ? Number((taxaAntecipacaoMensal * numParcela).toFixed(4))
        : 0;

      const taxaAplicada = Number((taxaCartao + taxaAntecipacaoAplicada).toFixed(4));

      const vlTitulo = Number(t.vl_titulo || 0);
      const vlDespesaOperadora = Number((vlTitulo * (taxaCartao / 100)).toFixed(2));
      const vlDespesaAntecipacao = Number((vlTitulo * (taxaAntecipacaoAplicada / 100)).toFixed(2));
      const vlDespesa = Number((vlDespesaOperadora + vlDespesaAntecipacao).toFixed(2));
      const vlLiquido = Number((vlTitulo - vlDespesa).toFixed(2));

      return {
        ...t,
        taxa_cartao: taxaCartao,
        taxa_antecipacao: taxaAntecipacaoMensal,
        taxa_antecipacao_efetiva: taxaAntecipacaoAplicada,
        taxa_aplicada: taxaAplicada,
        vl_despesa_calc: vlDespesa,
        vl_liquido_calc: vlLiquido
      };
    });
  }, [XOpenTitles, XTaxas, XOperadoraId, XTipoBaixa]);

  // Totais selecionados no rodapé
  const selectedCalculationsSummary = useMemo(() => {
    const selectedRows = titlesWithCalculations.filter(t => XSelectedIds.includes(t.financeiro_id));
    const totalBruto = selectedRows.reduce((acc, row) => acc + Number(row.vl_titulo || 0), 0);
    const totalDespesa = selectedRows.reduce((acc, row) => acc + row.vl_despesa_calc, 0);
    const totalLiquido = selectedRows.reduce((acc, row) => acc + row.vl_liquido_calc, 0);

    return {
      count: selectedRows.length,
      totalBruto,
      totalDespesa,
      totalLiquido
    };
  }, [titlesWithCalculations, XSelectedIds]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setXSelectedIds(XOpenTitles.map(t => t.financeiro_id));
    } else {
      setXSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setXSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const limpar = () => {
    setXPortadorId("");
    setXOperadoraId("");
    setXTipoData("");
    setXOpenTitles([]);
    setXSelectedIds([]);
  };

  // Processa a baixa em lote
  const handleConfirmarBaixa = async () => {
    if (XSelectedIds.length === 0) return;
    if (!confirm(`Confirma a baixa de ${XSelectedIds.length} título(s) selecionado(s)?`)) return;

    setXLoading(true);
    try {
      // 1. Obter o próximo ID da tabela de baixas
      const { data: maxRow } = await db
        .from("financeiro_baixa")
        .select("financeiro_baixa_id")
        .order("financeiro_baixa_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextBaixaId = ((maxRow?.financeiro_baixa_id as number) ?? 0) + 1;

      const selectedRows = titlesWithCalculations.filter(t => XSelectedIds.includes(t.financeiro_id));

      // 2. Executa as atualizações de baixa para cada título
      for (const row of selectedRows) {
        // Gravar na tabela financeiro_baixa (o vl_pago é o líquido e o vl_despesa é a taxa calculada)
        const { error: insErr } = await db
          .from("financeiro_baixa")
          .insert({
            financeiro_baixa_id: nextBaixaId,
            empresa_id: XEmpresaId,
            financeiro_id: row.financeiro_id,
            documento: row.documento ? String(row.documento).trim() : null,
            dt_pagamento: toIsoDate(new Date()),
            vl_pago: row.vl_liquido_calc,
            vl_despesa: row.vl_despesa_calc,
            recibo: "CARTAO",
            tipo_pag_rec_id: 3, // Cartão
            observacao: `Baixa de Cartão (${XTipoBaixa === "antecipacao" ? "Antecipação" : "Normal"}) - Tarifa: ${row.taxa_aplicada}%`,
            plano_id: row.plano_id,
            planoconta_id: row.planoconta_id,
            tp_conta: "R",
            cadastro_id: row.cadastro_id,
          });

        if (insErr) throw insErr;
        nextBaixaId++;

        // Atualizar o título na tabela financeiro (status = 'B' e preencher vl_pago líquido e vl_despesa)
        const { error: updErr } = await db
          .from("financeiro")
          .update({
            vl_pago: row.vl_liquido_calc,
            vl_despesa: row.vl_despesa_calc,
            status: "B",
            dt_alteracao: new Date().toISOString()
          })
          .eq("empresa_id", XEmpresaId)
          .eq("financeiro_id", row.financeiro_id);

        if (updErr) throw updErr;
      }

      toast.success("Baixas de cartões processadas com sucesso!");
      window.dispatchEvent(new CustomEvent("financeiro:baixa-changed"));

      // Recarrega os títulos do grid
      await handlePesquisar();

    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar as baixas de cartões: " + (err.message || String(err)));
    } finally {
      setXLoading(false);
    }
  };

  const isDateDisabled = XTipoData === "";

  return (
    <div className="p-4 h-full flex flex-col overflow-hidden bg-background">
      <div className="mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-primary">
          <CreditCard className="w-6 h-6 text-emerald-500" /> Baixa Cartão
        </h2>
        <p className="text-xs text-muted-foreground">
          Filtre por portador, operadora e datas na barra lateral para carregar os títulos e processar a baixa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* Painel lateral de Filtros e Dados da Baixa (4 colunas) */}
        <div className="lg:col-span-4 border border-border rounded-lg p-4 bg-card flex flex-col justify-between overflow-y-auto shadow-sm">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold border-b border-border pb-2 text-card-foreground">Dados da Baixa</h3>

            {/* Portador */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Portador</label>
              <select
                value={XPortadorId}
                onChange={e => setXPortadorId(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {XPortadores.map(p => (
                  <option key={p.portador_id} value={p.portador_id}>{p.nome}</option>
                ))}
              </select>
            </div>

            {/* Operadora */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Operadora</label>
              <select
                value={XOperadoraId}
                onChange={e => setXOperadoraId(e.target.value)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Selecione...</option>
                {XOperadoras.map(o => (
                  <option key={o.operadora_id} value={o.operadora_id}>{o.razao}</option>
                ))}
              </select>
            </div>

            {/* Sub-card de Filtros de Data */}
            <div className="border border-border rounded-md p-3 bg-secondary/15 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 border-b border-border pb-1">
                <Filter size={14} className="text-emerald-500" /> Período das Datas
              </h4>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Data</label>
                <select
                  value={XTipoData}
                  onChange={e => setXTipoData(e.target.value)}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-background font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">(Nenhuma)</option>
                  <option value="EMISSAO">Emissão</option>
                  <option value="VENCIMENTO">Vencimento</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Dt Inicial</label>
                  <input
                    type="date"
                    value={XDtInicial}
                    onChange={e => setXDtInicial(e.target.value)}
                    disabled={isDateDisabled}
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background disabled:opacity-50 disabled:bg-muted font-medium focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Dt Final</label>
                  <input
                    type="date"
                    value={XDtFinal}
                    onChange={e => setXDtFinal(e.target.value)}
                    disabled={isDateDisabled}
                    className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-background disabled:opacity-50 disabled:bg-muted font-medium focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>

            {/* Tipo de Baixa */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Tipo de Baixa</label>
              <select
                value={XTipoBaixa}
                onChange={e => setXTipoBaixa(e.target.value as any)}
                className="w-full border border-border rounded px-3 py-2 text-sm bg-background font-medium focus:ring-2 focus:ring-primary/20"
              >
                <option value="normal">Normal (Taxa padrão)</option>
                <option value="antecipacao">Antecipação (Taxa + Antecipação)</option>
              </select>
              <span className="text-[10px] text-muted-foreground mt-1.5 block leading-relaxed bg-secondary/30 p-2 rounded border border-border/40">
                {XTipoBaixa === "normal"
                  ? "Aplica apenas a taxa padrão da operadora do cartão."
                  : "Aplica a taxa padrão somada à taxa de antecipação contratada."}
              </span>
            </div>

            {/* Botão Pesquisar */}
            <button
              type="button"
              onClick={handlePesquisar}
              disabled={XFetchingTitles}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded hover:opacity-95 flex items-center justify-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              {XFetchingTitles ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Pesquisar Títulos
            </button>
          </div>

          {/* Botões do Rodapé da Barra Lateral */}
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
              disabled={XLoading || XSelectedIds.length === 0}
              className="flex-1 py-2.5 text-xs font-semibold rounded bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
            >
              {XLoading ? <RefreshCw size={14} className="animate-spin" /> : <HandCoins size={14} />}
              Confirmar Baixa ({XSelectedIds.length})
            </button>
          </div>
        </div>

        {/* Tabela dos títulos (8 colunas) */}
        <div className="lg:col-span-8 border border-border rounded-lg bg-card flex flex-col overflow-hidden shadow-sm">
          <div className="p-3 border-b border-border bg-card/50 flex justify-between items-center flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-card-foreground">Grade de Títulos em Aberto</h3>
            {XOpenTitles.length > 0 && (
              <span className="text-xs text-muted-foreground font-medium bg-secondary px-2.5 py-1 rounded-full">
                {XOpenTitles.length} título(s) em aberto
              </span>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {XOpenTitles.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <Info className="w-8 h-8 mb-2 text-muted-foreground/60" />
                <p className="text-sm font-medium">Nenhum título em aberto!</p>
                <p className="text-xs text-center max-w-sm">Preencha o portador e operadora na barra lateral para carregar os títulos a receber.</p>
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
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-center">Vencimento</th>
                    <th className="p-3 text-center">Parc</th>
                    <th className="p-3 text-right">Vlr. Bruto</th>
                    <th className="p-3 text-center">Taxa (%)</th>
                    <th className="p-3 text-right">Vlr. Taxa</th>
                    <th className="p-3 text-right">Vlr. Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {titlesWithCalculations.map((t, idx) => {
                    const isSelected = XSelectedIds.includes(t.financeiro_id);

                    return (
                      <tr
                        key={t.financeiro_id}
                        className={`hover:bg-accent/40 cursor-pointer transition-colors ${isSelected ? "bg-accent/15" : ""} ${idx % 2 === 0 ? "bg-card" : "bg-card/50"}`}
                        onClick={() => handleToggleSelect(t.financeiro_id)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(t.financeiro_id)}
                            className="rounded border-border focus:ring-primary accent-primary w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-semibold text-card-foreground">
                          {t.documento || "-"}
                        </td>
                        <td className="p-3 max-w-[150px] truncate text-muted-foreground" title={t.cadastro?.razao_social || ""}>
                          {t.cadastro?.nome_fantasia || t.cadastro?.razao_social || "Consumidor"}
                        </td>
                        <td className="p-3 text-center text-muted-foreground">
                          {fmtDate(t.dt_vencto)}
                        </td>
                        <td className="p-3 text-center font-medium">
                          {t.parcela || 1}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {fmtMoney(t.vl_titulo)}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-600">
                          {t.taxa_aplicada.toFixed(2)}%
                        </td>
                        <td className="p-3 text-right font-medium text-rose-500">
                          {fmtMoney(t.vl_despesa_calc)}
                        </td>
                        <td className="p-3 text-right font-bold text-emerald-600">
                          {fmtMoney(t.vl_liquido_calc)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Resumo do Rodapé do Grid */}
          {XSelectedIds.length > 0 && (
            <div className="bg-secondary/30 border-t border-border p-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-semibold select-none text-muted-foreground">
              <div>
                Selecionados: <strong className="text-foreground text-sm">{selectedCalculationsSummary.count}</strong>
              </div>
              <div className="text-right">
                Total Bruto: <strong className="text-foreground text-sm">{fmtMoney(selectedCalculationsSummary.totalBruto)}</strong>
              </div>
              <div className="text-right text-rose-500">
                Total Taxas: <strong className="text-sm">{fmtMoney(selectedCalculationsSummary.totalDespesa)}</strong>
              </div>
              <div className="text-right text-emerald-600">
                Total Líquido: <strong className="text-sm">{fmtMoney(selectedCalculationsSummary.totalLiquido)}</strong>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BaixaCartaoForm;
