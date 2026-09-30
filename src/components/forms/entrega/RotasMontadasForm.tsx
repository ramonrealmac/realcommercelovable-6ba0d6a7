/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { 
  RefreshCw, 
  Route, 
  DollarSign,
  FileText,
  ClipboardList,
  Truck,
  User,
  Search,
  Eraser,
  CheckCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { type IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";

const db = supabase as any;

interface IRouteRow {
  entrega_id: number;
  cd_entrega: number;
  dt_inicio: string;
  dt_fim: string | null;
  rota: string;
  observacoes: string | null;
  status: string;
  veiculo_id: number | null;
  motorista_id: number | null;
  placa?: string | null;
  veiculoDesc?: string | null;
  motoristaNome?: string | null;
}

interface IRouteStopRow {
  entrega_item_id: number;
  entrega_id: number;
  movimento_id: number;
  status_entrega: string;
  ordem_sequencia: number;
  nr_movimento?: number;
  dt_emissao?: string | null;
  vl_movimento?: number | null;
  st_pedido?: string | null;
  faturado?: string | null;
  cadastro_id?: number | null;
  tabela_preco_id?: number | null;
  tp_preco_padrao?: string | null;
  tp_operacao_id?: number | null;
  gera_nf?: string | null;
  nr_nota?: string | number | null;
  clienteNome?: string;
  clienteCpfCnpj?: string | null;
  cidade?: string;
  uf?: string;
}

const fmtMoney = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RotasMontadasForm: React.FC = () => {
  const { XEmpresaId, openTab } = useAppContext();
  const { handleKeyDown } = useEnterTraversal();

  // Filters State for Master Grid
  const [XFilterCdEntrega, setXFilterCdEntrega] = useState<string>("");
  const [XFilterRota, setXFilterRota] = useState<string>("");
  const [XFilterStatus, setXFilterStatus] = useState<"PENDENTES" | "CONCLUIDAS" | "TODAS" | "">("");
  const [XFilterTipoData, setXFilterTipoData] = useState<"EMISSAO" | "CONCLUSAO" | "">("");
  const [XFilterDtInicial, setXFilterDtInicial] = useState<string>("");
  const [XFilterDtFinal, setXFilterDtFinal] = useState<string>("");

  // Master Grid State (Minutas)
  const [XRoutes, setXRoutes] = useState<IRouteRow[]>([]);
  const [XActiveIdx, setXActiveIdx] = useState<number | null>(null);
  const [XLoadingMaster, setXLoadingMaster] = useState<boolean>(false);

  // Detail Grid State (Pedidos da Minuta)
  const [XStops, setXStops] = useState<IRouteStopRow[]>([]);

  // State for Minuta Concluída Modal
  const [XMinutaConcluidaModal, setXMinutaConcluidaModal] = useState<{ open: boolean; cdEntrega: number; msg?: string } | null>(null);

  // State for batch operation loading flags
  const [XBaixandoCaixa, setXBaixandoCaixa] = useState<boolean>(false);
  const [XEmitindoNfe, setXEmitindoNfe] = useState<boolean>(false);

  // Selected Route Record
  const XSelectedRoute = useMemo(() => {
    if (XActiveIdx !== null && XActiveIdx < XRoutes.length) {
      return XRoutes[XActiveIdx];
    }
    return null;
  }, [XActiveIdx, XRoutes]);

  // Load stops / items for a selected route (strictly ordered by ordem_sequencia ASC)
  const loadRouteDetails = useCallback(async (entregaId: number) => {
    try {
      const { data: stopData, error: stopErr } = await db.from("entrega_item")
        .select("entrega_item_id, entrega_id, movimento_id, status_entrega, ordem_sequencia")
        .eq("entrega_id", entregaId)
        .eq("excluido", false)
        .order("ordem_sequencia", { ascending: true });

      if (stopErr) throw stopErr;

      const stops: IRouteStopRow[] = stopData || [];

      // Fetch order details for the stops
      const movIds = stops.map(s => s.movimento_id);
      if (movIds.length > 0) {
        const { data: movRes, error: movErr } = await db.from("movimento")
          .select("movimento_id, nr_movimento, dt_emissao, vl_movimento, cadastro_id, st_pedido, faturado, tabela_preco_id, tp_preco_padrao, tp_operacao_id")
          .in("movimento_id", movIds);

        if (movErr) throw movErr;

        const movMap = new Map<number, any>((movRes || []).map((m: any) => [m.movimento_id, m]));

        // Fetch client details including Cidade and UF
        const cadIds = Array.from(new Set((movRes || []).map((m: any) => m.cadastro_id).filter(Boolean)));
        let cadMap = new Map<number, any>();
        if (cadIds.length > 0) {
          const { data: cadRes } = await db.from("cadastro")
            .select("cadastro_id, cnpj, razao_social, endereco_cidade_id, cidade:endereco_cidade_id(descricao, estado_id)")
            .in("cadastro_id", cadIds);
          cadMap = new Map<number, any>((cadRes || []).map((c: any) => [c.cadastro_id, c]));
        }

        // Fetch tp_operacao details (gera_nf)
        const tpOpIds = Array.from(new Set((movRes || []).map((m: any) => m.tp_operacao_id).filter(Boolean)));
        let tpOpMap = new Map<number, any>();
        if (tpOpIds.length > 0) {
          const { data: tpOpRes } = await db.from("tp_operacao")
            .select("tp_operacao_id, gera_nf, descricao")
            .in("tp_operacao_id", tpOpIds);
          tpOpMap = new Map<number, any>((tpOpRes || []).map((t: any) => [t.tp_operacao_id, t]));
        }

        // Fetch fiscal NF-e cabecalho details (nr_nota, st_nf)
        let nfeCabMap = new Map<number, any>();
        const { data: nfeCabRes } = await db.from("fiscal_nfe_cabecalho")
          .select("movimento_id, nr_nota, st_nf")
          .in("movimento_id", movIds)
          .eq("excluido", false);
        if (nfeCabRes) {
          (nfeCabRes || []).forEach((n: any) => {
            if (n.movimento_id) nfeCabMap.set(Number(n.movimento_id), n);
          });
        }

        stops.forEach(s => {
          if (movMap.has(s.movimento_id)) {
            const m = movMap.get(s.movimento_id);
            s.nr_movimento = m.nr_movimento;
            s.dt_emissao = m.dt_emissao;
            s.vl_movimento = m.vl_movimento;
            s.st_pedido = m.st_pedido;
            s.faturado = m.faturado;
            s.cadastro_id = m.cadastro_id;
            s.tabela_preco_id = m.tabela_preco_id;
            s.tp_preco_padrao = m.tp_preco_padrao;
            s.tp_operacao_id = m.tp_operacao_id;

            if (m.tp_operacao_id && tpOpMap.has(m.tp_operacao_id)) {
              s.gera_nf = tpOpMap.get(m.tp_operacao_id).gera_nf;
            }

            if (nfeCabMap.has(s.movimento_id)) {
              const nfe = nfeCabMap.get(s.movimento_id);
              s.nr_nota = nfe.nr_nota;
            }

            if (m.cadastro_id && cadMap.has(m.cadastro_id)) {
              const c = cadMap.get(m.cadastro_id);
              s.clienteNome = c.razao_social;
              s.clienteCpfCnpj = c.cnpj;
              s.cidade = c.cidade?.descricao || "";
              s.uf = c.cidade?.estado_id || "";
            }
          }
        });
      }

      setXStops(stops);
    } catch (e: any) {
      console.error("Erro ao carregar detalhes da minuta:", e);
      toast.error("Erro ao carregar detalhes da minuta: " + e.message);
    }
  }, []);

  // Load minutas (including Motorista and Veiculo lookup)
  const loadRoutes = useCallback(async () => {
    if (!XEmpresaId) return;

    // 1. Validação: verificar se pelo menos um filtro foi informado
    const hasAnyFilter = 
      Boolean(XFilterTipoData) || 
      Boolean(XFilterDtInicial) || 
      Boolean(XFilterDtFinal) || 
      Boolean(XFilterStatus) || 
      Boolean(XFilterCdEntrega.trim()) || 
      Boolean(XFilterRota.trim());

    if (!hasAnyFilter) {
      toast.warning("Informe pelo menos um filtro para realizar a pesquisa.");
      return;
    }

    // 2. Validação: se for digitado datas sem ser escolhido o tipo de data
    if ((XFilterDtInicial || XFilterDtFinal) && !XFilterTipoData) {
      toast.warning("Selecione o Tipo de Data ao informar o período de datas.");
      return;
    }

    // 3. Validação: se escolher um tipo de data e não digitar as datas
    if (XFilterTipoData && !XFilterDtInicial && !XFilterDtFinal) {
      toast.warning("Informe a Data Inicial ou Data Final ao selecionar o Tipo de Data.");
      return;
    }

    setXLoadingMaster(true);
    setXActiveIdx(null);
    setXStops([]);
    try {
      let query = db.from("entrega")
        .select("entrega_id, cd_entrega, dt_inicio, dt_fim, rota, observacoes, status, veiculo_id, motorista_id")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false);

      if (XFilterTipoData && (XFilterDtInicial || XFilterDtFinal)) {
        const dateCol = XFilterTipoData === "CONCLUSAO" ? "dt_fim" : "dt_inicio";

        if (XFilterDtInicial) {
          query = query.gte(dateCol, `${XFilterDtInicial}T00:00:00`);
        }
        if (XFilterDtFinal) {
          query = query.lte(dateCol, `${XFilterDtFinal}T23:59:59`);
        }
      }

      query = query.order("cd_entrega", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      let allRoutes: IRouteRow[] = data || [];

      // Aplica filtro de Status na memória
      if (XFilterStatus === "PENDENTES") {
        allRoutes = allRoutes.filter(r => r.status !== "Concluida");
      } else if (XFilterStatus === "CONCLUIDAS") {
        allRoutes = allRoutes.filter(r => r.status === "Concluida");
      }

      // Aplica filtro de Nº Minuta na memória
      if (XFilterCdEntrega.trim()) {
        allRoutes = allRoutes.filter(r => String(r.cd_entrega).includes(XFilterCdEntrega.trim()));
      }

      // Aplica filtro de Rota na memória
      if (XFilterRota.trim()) {
        const term = XFilterRota.trim().toLowerCase();
        allRoutes = allRoutes.filter(r => r.rota && r.rota.toLowerCase().includes(term));
      }

      // Verifica o status dos pedidos de cada minuta para ocultar as que já foram 100% baixadas e faturadas
      const entregaIds = allRoutes.map(r => r.entrega_id);
      let activeMinutas = allRoutes;

      if (entregaIds.length > 0) {
        const { data: itemsRes } = await db.from("entrega_item")
          .select("entrega_id, movimento_id, movimento:movimento_id(st_pedido, faturado, tp_operacao_id, tp_operacao:tp_operacao_id(gera_nf))")
          .in("entrega_id", entregaIds)
          .eq("excluido", false);

        const allMovIds = Array.from(new Set((itemsRes || []).map((it: any) => it.movimento_id).filter(Boolean))) as number[];

        let nfeMovSet = new Set<number>();
        if (allMovIds.length > 0) {
          const { data: nfeCabs } = await db.from("fiscal_nfe_cabecalho")
            .select("movimento_id")
            .in("movimento_id", allMovIds)
            .eq("excluido", false);

          nfeMovSet = new Set((nfeCabs || []).map((n: any) => Number(n.movimento_id)).filter(Boolean));
        }

        const statusMap = new Map<number, { total: number; concluidos: number }>();
        (itemsRes || []).forEach((it: any) => {
          const eId = it.entrega_id;
          if (!statusMap.has(eId)) statusMap.set(eId, { total: 0, concluidos: 0 });
          const info = statusMap.get(eId)!;
          info.total++;
          const m = Array.isArray(it.movimento) ? it.movimento[0] : it.movimento;
          const temNfeGerada = nfeMovSet.has(Number(it.movimento_id));
          const tpOp = m ? (Array.isArray(m.tp_operacao) ? m.tp_operacao[0] : m.tp_operacao) : null;
          const geraNf = tpOp ? tpOp.gera_nf : "S";

          // Um pedido é considerado concluído na minuta se:
          // 1. Está baixado no caixa (st_pedido = 'R') AND
          // 2. Não gera NF-e (gera_nf = 'N') OU já tem NF-e gerada OU está marcado como faturado = 'S'
          if (m && m.st_pedido === "R" && (geraNf === "N" || temNfeGerada || m.faturado === "S")) {
            info.concluidos++;
          }
        });

        // Atualiza status = 'Concluida' e dt_fim no banco de dados para minutas cujas emissões foram todas iniciadas/concluídas
        const minutasConcluidasIds = allRoutes
          .filter(r => {
            const info = statusMap.get(r.entrega_id);
            return info && info.total > 0 && info.concluidos === info.total && r.status !== "Concluida";
          })
          .map(r => r.entrega_id);

        if (minutasConcluidasIds.length > 0) {
          db.from("entrega")
            .update({ status: "Concluida", dt_fim: new Date().toISOString() })
            .in("entrega_id", minutasConcluidasIds)
            .then(({ error }: any) => {
              if (error) console.error("Erro ao atualizar status da entrega:", error);
            });
        }

        // Atualiza o atributo local status da minuta
        allRoutes.forEach(r => {
          const info = statusMap.get(r.entrega_id);
          if (info && info.total > 0 && info.concluidos === info.total) {
            r.status = "Concluida";
          }
        });
      }

      // Fetch driver and vehicle names for all minutas
      const motIds = Array.from(new Set(allRoutes.map(r => r.motorista_id).filter(Boolean)));
      const veicIds = Array.from(new Set(allRoutes.map(r => r.veiculo_id).filter(Boolean)));

      let motMap = new Map<number, any>();
      if (motIds.length > 0) {
        const { data: motRes } = await db.from("cadastro_motorista")
          .select("motorista_id, nome")
          .in("motorista_id", motIds);
        motMap = new Map<number, any>((motRes || []).map((m: any) => [m.motorista_id, m]));
      }

      let veicMap = new Map<number, any>();
      if (veicIds.length > 0) {
        const { data: veicRes } = await db.from("cadastro_veiculo")
          .select("veiculo_id, placa, descricao")
          .in("veiculo_id", veicIds);
        veicMap = new Map<number, any>((veicRes || []).map((v: any) => [v.veiculo_id, v]));
      }

      allRoutes.forEach(r => {
        if (r.motorista_id && motMap.has(r.motorista_id)) {
          r.motoristaNome = motMap.get(r.motorista_id).nome;
        }
        if (r.veiculo_id && veicMap.has(r.veiculo_id)) {
          const v = veicMap.get(r.veiculo_id);
          r.placa = v.placa;
          r.veiculoDesc = v.descricao;
        }
      });

      setXRoutes(allRoutes);
      if (allRoutes.length === 0) {
        toast.info("Nenhuma minuta encontrada com os filtros informados.");
      }
    } catch (e: any) {
      console.error("Erro ao carregar minutas de carga:", e);
      toast.error("Erro ao carregar minutas: " + e.message);
    } finally {
      setXLoadingMaster(false);
    }
  }, [XEmpresaId, XFilterTipoData, XFilterDtInicial, XFilterDtFinal, XFilterStatus, XFilterCdEntrega, XFilterRota]);

  const handleClearFiltersAndGrids = () => {
    setXFilterCdEntrega("");
    setXFilterRota("");
    setXFilterStatus("");
    setXFilterTipoData("");
    setXFilterDtInicial("");
    setXFilterDtFinal("");
    setXRoutes([]);
    setXStops([]);
    setXActiveIdx(null);
  };

  const handleKeyDownFilterPanel = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.getAttribute("data-last-filter") === "true") {
        e.preventDefault();
        loadRoutes();
      } else {
        handleKeyDown(e);
      }
    }
  };

  const handleRowClick = (row: any, idx: number) => {
    setXActiveIdx(idx);
    loadRouteDetails(row.entrega_id);
  };

  // Check if all orders in minuta have their baixa finalized (st_pedido === 'R')
  const allBaixados = useMemo(() => {
    if (!XSelectedRoute || XStops.length === 0) return false;
    return XStops.every(s => s.st_pedido === "R");
  }, [XSelectedRoute, XStops]);

  // Check if there are any orders in the selected minuta that require NF-e emission
  const temPedidoParaEmitirNfe = useMemo(() => {
    if (!allBaixados || XStops.length === 0) return false;
    return XStops.some(s => s.gera_nf !== "N" && s.faturado !== "S" && !s.nr_nota);
  }, [allBaixados, XStops]);

  // Action: Baixar Caixa em LOOP automático para todos os pedidos pendentes da minuta
  const handleBaixarCaixaLoop = async () => {
    if (!XSelectedRoute || XStops.length === 0) {
      toast.warning("Selecione uma minuta com pedidos.");
      return;
    }

    const pendentes = XStops.filter(s => s.st_pedido !== "R");
    if (pendentes.length === 0) {
      toast.info("Todos os pedidos desta minuta já foram baixados no caixa.");
      return;
    }

    setXBaixandoCaixa(true);
    const tId = toast.loading(`Iniciando baixa no caixa (${pendentes.length} pedido(s))...`);

    let sucessos = 0;
    const errosList: string[] = [];

    try {
      const { data: userDataRpc } = await supabase.auth.getUser();
      const userIdRpc = userDataRpc?.user?.id;
      const dtHoje = new Date().toISOString().substring(0, 10);

      // 1. Verifica se existem funcionários com permissão de Caixa (caixa = 'S') na empresa
      const { data: funcCaixas, error: funcErr } = await db.from("funcionario")
        .select("funcionario_id, nome, caixa")
        .eq("empresa_id", XEmpresaId)
        .eq("caixa", "S");

      if (funcErr) {
        toast.error("Erro ao verificar permissões de caixa: " + funcErr.message, { id: tId });
        setXBaixandoCaixa(false);
        return;
      }

      if (!funcCaixas || funcCaixas.length === 0) {
        toast.error("Você não tem permissão de Caixa.", { id: tId });
        setXBaixandoCaixa(false);
        return;
      }

      // 2. Verifica se o funcionário/caixa possui um Caixa Aberto (status = 'A')
      const funcIds = funcCaixas.map((f: any) => f.funcionario_id);

      const { data: openCaixas, error: abertErr } = await db.from("caixa_abertura")
        .select("caixa_abertura_id, funcionario_id")
        .eq("empresa_id", XEmpresaId)
        .in("funcionario_id", funcIds)
        .eq("status", "A")
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);

      if (abertErr) {
        toast.error("Erro ao verificar caixa aberto: " + abertErr.message, { id: tId });
        setXBaixandoCaixa(false);
        return;
      }

      if (!openCaixas || openCaixas.length === 0) {
        toast.error("Você não possui um Caixa Aberto para efetuar baixas.", { id: tId });
        setXBaixandoCaixa(false);
        return;
      }

      const caixaAberturaId = openCaixas[0].caixa_abertura_id;
      const funcionarioCaixaId = openCaixas[0].funcionario_id;

      for (let i = 0; i < pendentes.length; i++) {
        const stop = pendentes[i];
        const nrPed = stop.nr_movimento || stop.movimento_id;

        toast.loading(`Baixando caixa do Pedido #${nrPed} (${i + 1}/${pendentes.length})...`, { id: tId });

        try {
          // 1. Busca os pagamentos pré-lançados do movimento
          const { data: mpData, error: mpErr } = await db.from("movimento_pagamento")
            .select("movimento_pagamento_id, condicao_id, tp_pagamento, vl_pagamento, nr_autorizacao, bandeira_id, operadora_id, n_parcelas, portador_id")
            .eq("movimento_id", stop.movimento_id)
            .eq("excluido", false);

          let pagamentos: any[] = [];

          if (!mpErr && mpData && mpData.length > 0) {
            pagamentos = mpData.map((mp: any) => ({
              uid: `auto_${mp.movimento_pagamento_id}`,
              condicao_id: mp.condicao_id || 1,
              condicao_descricao: mp.tp_pagamento || "À Vista",
              bandeira_id: mp.bandeira_id || null,
              operadora_id: mp.operadora_id || null,
              numero_autoriza: mp.nr_autorizacao || "",
              qt_parcela: Number(mp.n_parcelas || 1),
              vl_parcela: Number(mp.vl_pagamento || stop.vl_movimento || 0),
              vl_recebido: Number(mp.vl_pagamento || stop.vl_movimento || 0),
              portador_id: mp.portador_id || null,
            }));
          } else {
            // Se não houver movimento_pagamento pré-lançado, busca a condição do movimento ou usa condição 1 (À Vista)
            const { data: movRes } = await db.from("movimento")
              .select("condicao_id, vl_movimento")
              .eq("movimento_id", stop.movimento_id)
              .single();

            const condId = movRes?.condicao_id || 1;
            const totalMov = Number(movRes?.vl_movimento || stop.vl_movimento || 0);

            pagamentos = [{
              uid: `auto_${Date.now()}_${i}`,
              condicao_id: condId,
              condicao_descricao: "À Vista",
              bandeira_id: null,
              operadora_id: null,
              numero_autoriza: "",
              qt_parcela: 1,
              vl_parcela: totalMov,
              vl_recebido: totalMov,
              portador_id: null,
            }];
          }

          // 2. Executa a rotina oficial de recebimento no caixa (RPC fu_pdv_registrar_recebimento_venda)
          const { data: rpcRes, error: rpcErr } = await db.rpc("fu_pdv_registrar_recebimento_venda", {
            _empresa_id: XEmpresaId,
            _movimento_id: stop.movimento_id,
            _caixa_abertura_id: caixaAberturaId,
            _funcionario_caixa_id: funcionarioCaixaId,
            _dt_movimento: dtHoje,
            _tp_operacao_caixa: "0",
            _centro_custo_caixa: 0,
            _pagamentos: pagamentos,
            _usuario_id: userIdRpc,
          });

          if (rpcErr) throw new Error(rpcErr.message);
          if (rpcRes?.error) throw new Error(rpcRes.error);

          sucessos++;
        } catch (pedErr: any) {
          console.error(`Erro ao baixar Pedido #${nrPed}:`, pedErr);
          errosList.push(`Pedido #${nrPed}: ${pedErr.message || "Erro ao registrar no caixa"}`);
        }
      }

      await loadRouteDetails(XSelectedRoute.entrega_id);
      await loadRoutes();

      // Verifica se após as baixas no caixa todos os pedidos da minuta foram concluídos
      const { data: updatedStops } = await db.from("entrega_item")
        .select("movimento_id, movimento:movimento_id(st_pedido, faturado, tp_operacao_id, tp_operacao:tp_operacao_id(gera_nf))")
        .eq("entrega_id", XSelectedRoute.entrega_id)
        .eq("excluido", false);

      let allDone = true;
      (updatedStops || []).forEach((it: any) => {
        const m = Array.isArray(it.movimento) ? it.movimento[0] : it.movimento;
        const tpOp = m ? (Array.isArray(m.tp_operacao) ? m.tp_operacao[0] : m.tp_operacao) : null;
        const geraNf = tpOp ? tpOp.gera_nf : "S";

        if (!m || m.st_pedido !== "R" || (geraNf !== "N" && m.faturado !== "S")) {
          allDone = false;
        }
      });

      if (allDone && updatedStops && updatedStops.length > 0) {
        await db.from("entrega")
          .update({ status: "Concluida", dt_fim: new Date().toISOString() })
          .eq("entrega_id", XSelectedRoute.entrega_id);

        setXMinutaConcluidaModal({
          open: true,
          cdEntrega: XSelectedRoute.cd_entrega,
          msg: `A Minuta de Cargas Montadas Nº ${XSelectedRoute.cd_entrega} foi concluída com sucesso! Todos os pedidos foram baixados no caixa e finalizados.`
        });
      }

      if (errosList.length === 0) {
        toast.success(`Todos os ${sucessos} pedido(s) da Minuta ${XSelectedRoute.cd_entrega} foram baixados no caixa com sucesso!`, { id: tId });
      } else if (sucessos > 0) {
        toast.warning(`${sucessos} pedido(s) baixados no caixa. ${errosList.length} pedido(s) apresentaram erro:\n${errosList.join("\n")}`, { id: tId, duration: 8000 });
      } else {
        toast.error(`Falha ao baixar os pedidos no caixa:\n${errosList.join("\n")}`, { id: tId, duration: 8000 });
      }
    } catch (e: any) {
      console.error("Erro durante baixa em lote no caixa:", e);
      toast.error("Erro na baixa dos pedidos: " + e.message, { id: tId });
    } finally {
      setXBaixandoCaixa(false);
    }
  };

  // Action: Emitir NF-e em LOOP automático para todos os pedidos da minuta
  const handleEmitirNfeLoop = async () => {
    if (!XSelectedRoute || XStops.length === 0) return;

    setXEmitindoNfe(true);
    const tId = toast.loading(`Iniciando emissão de NF-e (${XStops.length} pedido(s))...`);

    let sucessos = 0;
    let ignorados = 0;
    const errosList: string[] = [];
    const ignoradosList: string[] = [];

    try {
      // Busca ID numérico do funcionário caixa para obter nfe_config_item
      const { data: funcCaixas } = await db.from("funcionario")
        .select("funcionario_id")
        .eq("empresa_id", XEmpresaId)
        .eq("caixa", "S");

      const funcIds = (funcCaixas || []).map((f: any) => f.funcionario_id);

      const { data: openCaixas } = await db.from("caixa_abertura")
        .select("funcionario_id")
        .eq("empresa_id", XEmpresaId)
        .in("funcionario_id", funcIds.length > 0 ? funcIds : [0])
        .eq("status", "A")
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);

      const funcionarioCaixaId = openCaixas?.[0]?.funcionario_id || funcIds[0] || 0;

      if (!funcionarioCaixaId) {
        toast.error("Funcionário/Caixa não localizado para emissão fiscal.", { id: tId });
        setXEmitindoNfe(false);
        return;
      }

      for (let i = 0; i < XStops.length; i++) {
        const stop = XStops[i];
        const nrPed = stop.nr_movimento || stop.movimento_id;

        try {
          // 0.1 Se o pedido já está faturado, pula para o próximo
          if (stop.faturado === "S") {
            ignorados++;
            ignoradosList.push(`Pedido #${nrPed}: Já faturado`);
            continue;
          }

          // 0.2 Verifica se o tipo de operação permite gerar NF
          if (stop.movimento_id) {
            const { data: movOp } = await db.from("movimento")
              .select("tp_operacao_id")
              .eq("movimento_id", stop.movimento_id)
              .maybeSingle();

            if (movOp?.tp_operacao_id) {
              const { data: tpOp } = await db.from("tp_operacao")
                .select("gera_nf, descricao")
                .eq("tp_operacao_id", movOp.tp_operacao_id)
                .maybeSingle();

              if (tpOp && tpOp.gera_nf === "N") {
                ignorados++;
                ignoradosList.push(`Pedido #${nrPed}: Operação '${tpOp.descricao || "Sem Nota"}' (Gerar Nota = NÃO)`);
                continue; // Pula para a próxima nota sem interromper!
              }
            }
          }

          toast.loading(`Gerando NF-e (${i + 1}/${XStops.length}) - Pedido #${nrPed}...`, { id: tId });

          // 1. Gera cabeçalho, itens, pagamentos e insere evento PENDENTE no banco de dados
          const res = await fiscalEmissaoService.gerarDocumentoFiscalFromMovimento(
            stop.movimento_id,
            "NFE",
            XEmpresaId,
            funcionarioCaixaId
          );

          if (!res.success || !res.fiscal_evento_id) {
            throw new Error(res.message || "Falha ao gerar documento fiscal no banco de dados.");
          }

          // 2. Transmite e aguarda autorização da SEFAZ via fiscal worker
          toast.loading(`Aguardando autorização SEFAZ para o Pedido #${nrPed} (${i + 1}/${XStops.length})...`, { id: tId });
          const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
            empresaId: XEmpresaId,
          });

          if (!ret.success) {
            throw new Error(ret.mensagem || "Rejeição SEFAZ ou erro de comunicação com o fiscal worker.");
          }

          // 3. Atualiza o status do movimento para faturado = 'S'
          await db.from("movimento")
            .update({ faturado: "S" })
            .eq("movimento_id", stop.movimento_id);

          sucessos++;
        } catch (pedErr: any) {
          console.error(`Erro ao emitir NF-e do Pedido #${nrPed}:`, pedErr);
          errosList.push(`Pedido #${nrPed}: ${pedErr.message || "Erro desconhecido"}`);
          // Continua obrigatoriamente para a próxima nota do lote sem travar a execução!
        }
      }

      await loadRouteDetails(XSelectedRoute.entrega_id);
      await loadRoutes();

      if (errosList.length === 0) {
        let msg = `${sucessos} NF-e(s) emitida(s) com sucesso na Minuta ${XSelectedRoute.cd_entrega}!`;
        if (ignorados > 0) {
          msg += ` (${ignorados} pedido(s) ignorado(s) pois já estavam faturados ou configurados sem emissão fiscal).`;
        }
        toast.success(msg, { id: tId, duration: 6000 });
      } else if (sucessos > 0) {
        toast.warning(`Processamento de lote concluído! ${sucessos} NF-e(s) emitida(s) com sucesso.\n${errosList.length} pedido(s) apresentaram rejeição/erro e foram ignorados para dar prosseguimento às demais:\n${errosList.join("\n")}`, { id: tId, duration: 10000 });
      } else {
        toast.error(`Emissão em lote finalizada. Todos os pedidos da minuta foram processados, mas ocorreram rejeições em ${errosList.length} pedido(s) (nenhum travamento ocorreu):\n${errosList.join("\n")}`, { id: tId, duration: 10000 });
      }
    } catch (e: any) {
      console.error("Erro ao emitir NF-e em lote:", e);
      toast.error("Erro na emissão de NF-e: " + (e.message || "Falha ao comunicar com servidor fiscal"), { id: tId });
    } finally {
      setXEmitindoNfe(false);
    }
  };

  // Master Grid Columns (Minutas)
  const XCols: IGridColumn[] = useMemo(() => [
    { key: "cd_entrega", label: "Número da Minuta", width: "120px", align: "right" },
    { key: "rota", label: "Rota", width: "1fr" },
    {
      key: "status",
      label: "Status",
      width: "95px",
      align: "center",
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          r.status === "Concluida"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
            : "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
        }`}>
          {r.status === "Concluida" ? "Concluída" : "Pendente"}
        </span>
      )
    },
  ], []);

  // Stops Subgrid Columns (Pedidos da Minuta)
  const XStopCols: IGridColumn[] = useMemo(() => [
    { key: "ordem_sequencia", label: "Parada", width: "70px", align: "center", render: (r: any) => r.ordem_sequencia },
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "clienteNome", label: "Cliente", width: "1.5fr" },
    { key: "cidade", label: "Cidade", width: "120px", render: (r: any) => r.cidade ?? "" },
    { key: "uf", label: "UF", width: "50px", align: "center", render: (r: any) => r.uf ?? "" },
    { key: "vl_movimento", label: "Valor Total", width: "110px", align: "right", render: (r: any) => fmtMoney(r.vl_movimento) },
    { 
      key: "st_pedido", label: "Status Caixa", width: "130px", align: "center",
      render: (r: any) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
          r.st_pedido === "R" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400" :
          "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
        }`}>
          {r.st_pedido === "R" ? "RECEBIDO CAIXA" : "PENDENTE CAIXA"}
        </span>
      )
    },
    {
      key: "status_fiscal", label: "Status Fiscal", width: "155px", align: "center",
      render: (r: any) => {
        if (r.gera_nf === "N") {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              SEM NOTA FISCAL
            </span>
          );
        }
        if (r.faturado === "S" || r.nr_nota) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
              {r.nr_nota ? `NF-E Nº ${r.nr_nota}` : "NF-E EMITIDA"}
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400">
            PENDENTE EMISSÃO
          </span>
        );
      }
    },
  ], []);

  return (
    <div className="p-4 h-full overflow-auto space-y-4 bg-background">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Cargas Montadas</h2>
          <p className="text-xs text-muted-foreground">Consulte as minutas de carga, dê baixa nos pedidos pelo caixa e emita as NF-e(s).</p>
        </div>
        <button
          onClick={loadRoutes}
          disabled={XLoadingMaster}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-all"
        >
          <RefreshCw size={13} className={XLoadingMaster ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* MASTER-DETAIL LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        
        {/* Left Side: Master Minutas List (2/5 cols) */}
        <div className="xl:col-span-2 flex flex-col gap-2">
          {/* Header Filters */}
          <div 
            className="bg-muted/30 p-2.5 rounded border border-border flex flex-col gap-2"
            onKeyDown={handleKeyDownFilterPanel}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Tipo Data</label>
                <select
                  value={XFilterTipoData}
                  onChange={(e) => setXFilterTipoData(e.target.value as "EMISSAO" | "CONCLUSAO" | "")}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring font-semibold"
                >
                  <option value=""></option>
                  <option value="EMISSAO">EMISSÃO</option>
                  <option value="CONCLUSAO">CONCLUSÃO</option>
                </select>
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Dt. Inicial</label>
                <input
                  type="date"
                  value={XFilterDtInicial}
                  onChange={(e) => setXFilterDtInicial(e.target.value)}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Dt. Final</label>
                <input
                  type="date"
                  value={XFilterDtFinal}
                  onChange={(e) => setXFilterDtFinal(e.target.value)}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Status</label>
                <select
                  value={XFilterStatus}
                  onChange={(e) => setXFilterStatus(e.target.value as any)}
                  className="border border-border rounded px-1.5 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring font-semibold"
                >
                  <option value=""></option>
                  <option value="PENDENTES">Pendentes</option>
                  <option value="CONCLUIDAS">Concluídas</option>
                  <option value="TODAS">Todas</option>
                </select>
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Nº Minuta</label>
                <input
                  type="text"
                  placeholder="Nº Minuta..."
                  value={XFilterCdEntrega}
                  onChange={(e) => setXFilterCdEntrega(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[10px] text-muted-foreground font-semibold">Rota</label>
                <input
                  type="text"
                  placeholder="Rota..."
                  data-last-filter="true"
                  value={XFilterRota}
                  onChange={(e) => setXFilterRota(e.target.value)}
                  className="border border-border rounded px-2 py-1 text-xs bg-card outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            {/* Action Buttons: Filtrar e Limpar */}
            <div className="flex justify-end gap-2 pt-1 border-t border-border/50">
              <button
                type="button"
                onClick={loadRoutes}
                disabled={XLoadingMaster}
                data-focusable="true"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                <Search size={13} className={XLoadingMaster ? "animate-spin" : ""} />
                Filtrar
              </button>
              <button
                type="button"
                onClick={handleClearFiltersAndGrids}
                data-focusable="true"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-border bg-card hover:bg-accent text-foreground transition-all"
              >
                <Eraser size={13} />
                Limpar
              </button>
            </div>
          </div>

          {/* Master Grid */}
          <div className="flex-1 bg-card border border-border rounded-lg shadow-sm overflow-hidden min-h-[350px]">
            <DataGrid
              columns={XCols}
              data={XRoutes}
              selectedIdx={XActiveIdx}
              onRowClick={(row, idx) => handleRowClick(row, idx)}
              maxHeight="calc(100vh - 250px)"
              exportTitle="Relatorio de Minutas de Cargas Montadas"
            />
          </div>
        </div>

        {/* Right Side: Pedidos da Minuta & Action Buttons (3/5 cols) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {XSelectedRoute ? (
            <>
              {/* Minuta Header Info: Veiculo and Motorista */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-card border border-border rounded-lg shadow-sm text-xs">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Truck size={14} className="text-primary" />
                    <span className="text-muted-foreground">Veículo:</span> {XSelectedRoute.placa ? `${XSelectedRoute.placa}${XSelectedRoute.veiculoDesc ? ` - ${XSelectedRoute.veiculoDesc}` : ""}` : "Não informado"}
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <User size={14} className="text-primary" />
                    <span className="text-muted-foreground">Motorista:</span> {XSelectedRoute.motoristaNome || "Não informado"}
                  </span>
                </div>
              </div>

              {/* Detail Grid: Pedidos da Minuta */}
              <div className="flex-1 border border-border rounded-lg bg-card shadow-sm overflow-hidden flex flex-col min-h-[350px]">
                <div className="p-3 border-b border-border bg-secondary/20 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <ClipboardList size={14} className="text-primary" /> Pedidos da Minuta (Minuta {XSelectedRoute.cd_entrega} - {XSelectedRoute.rota})
                  </span>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {XStops.length} pedido(s)
                  </span>
                </div>
                <div className="flex-1 overflow-auto">
                  <DataGrid
                    columns={XStopCols}
                    data={XStops}
                    maxHeight="calc(100vh - 360px)"
                    exportTitle={`Pedidos da Minuta ${XSelectedRoute.cd_entrega}`}
                  />
                </div>
              </div>

              {/* Action Buttons Panel */}
              <div className="flex gap-3 justify-end p-3 border border-border rounded-lg bg-card shadow-sm">
                <button
                  onClick={handleBaixarCaixaLoop}
                  disabled={XStops.length === 0 || allBaixados || XBaixandoCaixa}
                  title={allBaixados ? "Todos os pedidos desta minuta já foram baixados no caixa" : "Baixar Caixa em lote para os pedidos pendentes"}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {XBaixandoCaixa ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Baixando Caixa...
                    </>
                  ) : (
                    <>
                      <DollarSign size={15} /> Baixar Caixa
                    </>
                  )}
                </button>

                <button
                  onClick={handleEmitirNfeLoop}
                  disabled={!temPedidoParaEmitirNfe || XEmitindoNfe}
                  title={
                    !allBaixados 
                      ? "Habilitado apenas quando todos os pedidos da minuta estiverem baixados no caixa" 
                      : !temPedidoParaEmitirNfe
                      ? "Esta minuta não contém pedidos pendentes de emissão fiscal (gera_nf = N ou já faturados)"
                      : "Emitir NF-e em lote para os pedidos"
                  }
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded bg-primary hover:bg-primary/95 text-primary-foreground shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {XEmitindoNfe ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" /> Emitindo NF-e...
                    </>
                  ) : (
                    <>
                      <FileText size={15} /> Emitir NF-e
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    if (!XSelectedRoute) return;
                    openTab({
                      title: `MDF-e — Minuta #${XSelectedRoute.cd_entrega}`,
                      component: "mdfe-form",
                      params: { minuta_id: XSelectedRoute.entrega_id }
                    });
                  }}
                  disabled={!XSelectedRoute}
                  title="Gerar Manifesto MDF-e a partir desta Minuta"
                  className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded bg-amber-600 hover:bg-amber-700 text-white shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Truck size={15} /> Gerar MDF-e
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-card h-96 text-center text-muted-foreground">
              <Route size={36} className="opacity-30 mb-3" />
              <p className="text-sm font-semibold">Nenhuma Minuta Selecionada</p>
              <p className="text-xs max-w-[240px] mt-1">Selecione uma minuta de carga na listagem ao lado para visualizar os pedidos e efetuar a baixa no caixa ou a emissão de NF-e.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal Alerta Minuta Concluída */}
      {XMinutaConcluidaModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border border-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 text-center transform animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Minuta de Carga Concluída!</h3>
              <p className="text-xs text-muted-foreground mt-2">
                {XMinutaConcluidaModal.msg}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setXMinutaConcluidaModal(null)}
                className="w-full py-2 px-4 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow"
              >
                OK, Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RotasMontadasForm;
