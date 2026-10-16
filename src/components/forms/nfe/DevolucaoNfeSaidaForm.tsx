import React, { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Search, ArrowLeft, ArrowRight, RotateCcw, Check, FileText, Package, Send, Printer } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";

const db = supabase as any;

interface IItemDevolucao {
  nfe_item_id: number;
  produto_id: number | null;
  cd_produto: string;
  nm_produto: string;
  unidade: string;
  qt_origem: number;
  qt_devolver: number;
  vl_unit: number;
  vl_total_origem: number;
  cfop_origem: string;
  cfop_devolucao: string;
  ncm: string;
  gtin: string;
  deposito_id?: number | null;
  origem_item: any;
}

// Mapa específico saída → entrada (devolução de venda)
const CFOP_DEVOLUCAO_MAP: Record<string, string> = {
  "5101": "1201", "5102": "1202", "5202": "1202", "5411": "1411", "5556": "1556",
  "6101": "2201", "6102": "2202", "6202": "2202", "6411": "2411", "6556": "2556",
};

const cfopDevolucaoSugerido = (cfopSaida: string): string => {
  if (!cfopSaida) return "1202";
  if (CFOP_DEVOLUCAO_MAP[cfopSaida]) return CFOP_DEVOLUCAO_MAP[cfopSaida];
  // Heurística: 5xxx -> 1xxx (UF), 6xxx -> 2xxx (outra UF)
  const first = cfopSaida[0];
  if (first === "5") return "1" + cfopSaida.substring(1);
  if (first === "6") return "2" + cfopSaida.substring(1);
  return "1202";
};

const maskMoney = (value: string | number): string => {
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "";
  const numValue = parseInt(cleanValue, 10) / 100;
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoneyToFloat = (val: string): number => {
  const clean = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

interface DevolucaoNfeSaidaFormProps {
  initialNfeId?: number;
}

const DevolucaoNfeSaidaForm: React.FC<DevolucaoNfeSaidaFormProps> = ({ initialNfeId }) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XStep, setXStep] = useState<1 | 2 | 3>(1);

  // Refs para navegação com Enter
  const buscaRef = useRef<HTMLInputElement>(null);
  const dtIniRef = useRef<HTMLInputElement>(null);
  const dtFimRef = useRef<HTMLInputElement>(null);
  const buscarBtnRef = useRef<HTMLButtonElement>(null);

  // Step 1
  const [XBusca, setXBusca] = useState("");
  const [XDtIni, setXDtIni] = useState("");
  const [XDtFim, setXDtFim] = useState("");
  const [XLoading, setXLoading] = useState(false);
  const [XResultados, setXResultados] = useState<any[]>([]);

  // Step 2
  const [XSelecionada, setXSelecionada] = useState<any | null>(null);
  const [XItens, setXItens] = useState<IItemDevolucao[]>([]);
  const [XDepositos, setXDepositos] = useState<any[]>([]);
  const [XDepositoId, setXDepositoId] = useState<number | null>(null);
  const [XNatOp, setXNatOp] = useState("DEVOLUCAO DE VENDA DE MERCADORIA");

  // Step 3
  const [XGerando, setXGerando] = useState(false);
  const [XNovoNfeId, setXNovoNfeId] = useState<number | null>(null);
  const [XTransmitida, setXTransmitida] = useState(false);
  const [XTpOperacaoEdId, setXTpOperacaoEdId] = useState<number | null>(null);
  const [XGeradoMovimento, setXGeradoMovimento] = useState<{ movimento_id: number; nr_movimento: number } | null>(null);
  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number; restante: number }>({
    open: false,
    titulo: "",
    total: 60,
    restante: 60,
  });

  useEffect(() => {
    if (!XEmpresaId) return;
    db.from("deposito")
      .select("deposito_id,nome")
      .eq("empresa_id", XEmpresaId)
      .eq("excluido", false)
      .order("nome")
      .then(({ data }: any) => {
        setXDepositos(data || []);
        if (data?.length === 1) setXDepositoId(data[0].deposito_id);
      });

    // Busca tipo de operacao ED (Entrada Devolução)
    db.from("tp_operacao")
      .select("tp_operacao_id,descricao")
      .eq("empresa_id", XEmpresaId)
      .eq("tp_movimento", "ED")
      .eq("excluido", false)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.tp_operacao_id) {
          setXTpOperacaoEdId(Number(data.tp_operacao_id));
        }
      });
  }, [XEmpresaId]);

  // ------- Etapa 1
  const buscarNotas = async () => {
    if (!XBusca.trim() && !XDtIni.trim() && !XDtFim.trim()) {
      toast.warning("Informe pelo menos um filtro para realizar a busca.");
      return;
    }
    setXLoading(true);
    setXResultados([]);
    try {
      let q = db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id,nr_nota,serie,dt_emissao,dt_saida,vl_total_nf,chave_nfe,cadastro_id,st_nf,modelo,tp_nf,fin_nfe,movimento_id,pedido_id,cadastro:cadastro_id(razao_social,cnpj)")
        .eq("empresa_id", XEmpresaId)
        .eq("tp_nf", 1)
        .in("st_nf", ["A", "E", "1"]) // Apenas notas fiscais autorizadas/enviadas
        .neq("fin_nfe", 4) // não permitir devolver uma devolução
        .eq("excluido", false);

      if (XDtIni && String(XDtIni).trim() !== "") {
        q = q.gte("dt_emissao", XDtIni);
      }
      if (XDtFim && String(XDtFim).trim() !== "") {
        q = q.lte("dt_emissao", XDtFim);
      }

      q = q.order("dt_emissao", { ascending: false }).limit(200);
      const t = XBusca.trim();
      if (t) {
        if (/^\d+$/.test(t)) q = q.eq("nr_nota", t);
        else q = q.ilike("chave_nfe", `%${t}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      setXResultados(data || []);
    } catch (e: any) {
      toast.error("Erro ao buscar: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const limparFiltros = () => {
    setXBusca("");
    setXDtIni("");
    setXDtFim("");
    setXResultados([]);
    buscaRef.current?.focus();
  };

  // Pré-carregamento via prop (vindo do Gerenciador Fiscal)
  useEffect(() => {
    if (!initialNfeId || !XEmpresaId) return;
    (async () => {
      const { data, error } = await db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id,nr_nota,serie,dt_emissao,dt_saida,vl_total_nf,chave_nfe,cadastro_id,st_nf,modelo,tp_nf,fin_nfe,movimento_id,pedido_id,cadastro:cadastro_id(razao_social,cnpj)")
        .eq("nfe_cabecalho_id", initialNfeId)
        .maybeSingle();
      if (error || !data) { toast.error("NF-e de origem não encontrada."); return; }
      if (!["A", "E", "1"].includes(String(data.st_nf))) {
        toast.error(`A nota ${data.nr_nota || initialNfeId} não está autorizada e não pode ser devolvida.`);
        return;
      }
      await selecionarNota(data);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNfeId, XEmpresaId]);

  const selecionarNota = async (nfe: any) => {
    setXLoading(true);
    try {
      const { data: itens, error } = await db.from("fiscal_nfe_item")
        .select("*")
        .eq("nfe_cabecalho_id", nfe.nfe_cabecalho_id)
        .eq("excluido", false)
        .order("nr_item");
      if (error) throw error;

      // Consulta se algum dos itens já foi devolvido em notas fiscais com status autorizado ('A')
      const itemIds = (itens || []).map((it: any) => it.nfe_item_id).filter(Boolean);
      let jaDevolvidoPorItem: Record<number, number> = {};

      if (itemIds.length > 0) {
        const { data: itensDevolvidos } = await db.from("fiscal_nfe_item")
          .select("nfe_item_origem_id, qt_entrada, fiscal_nfe_cabecalho!inner(st_nf)")
          .in("nfe_item_origem_id", itemIds)
          .eq("excluido", false)
          .eq("fiscal_nfe_cabecalho.st_nf", "A");

        if (itensDevolvidos) {
          for (const dev of itensDevolvidos) {
            const origId = dev.nfe_item_origem_id;
            if (origId) {
              jaDevolvidoPorItem[origId] = (jaDevolvidoPorItem[origId] || 0) + Number(dev.qt_entrada || 0);
            }
          }
        }
      }

      const list: IItemDevolucao[] = [];
      for (const it of (itens || [])) {
        const qtOrig = Number(it.qt_entrada || 0);
        const qtDevolvida = jaDevolvidoPorItem[it.nfe_item_id] || 0;
        const qtDisponivel = Math.max(0, qtOrig - qtDevolvida);

        // Se o item já foi devolvido em nota autorizada, não deve mais aparecer disponível
        if (qtDisponivel <= 0.0001) {
          continue;
        }

        list.push({
          nfe_item_id: it.nfe_item_id,
          produto_id: it.produto_id,
          cd_produto: it.cd_prod_fornec || (it.produto_id ? String(it.produto_id) : ""),
          nm_produto: it.nm_produto || "",
          unidade: it.unidade || "UN",
          qt_origem: qtDisponivel,
          qt_devolver: 0,
          vl_unit: Number(it.vl_unit || 0),
          vl_total_origem: Number(it.vl_unit || 0) * qtDisponivel,
          cfop_origem: it.cfop || "",
          cfop_devolucao: cfopDevolucaoSugerido(it.cfop || ""),
          ncm: it.ncm || "",
          gtin: it.gtin || "",
          deposito_id: it.deposito_id || XDepositoId || (XDepositos.length > 0 ? XDepositos[0].deposito_id : null),
          origem_item: it,
        });
      }

      if (list.length === 0) {
        toast.warning("Todos os itens desta NF-e já foram devolvidos em notas autorizadas.");
        return;
      }

      setXSelecionada(nfe);
      setXItens(list);
      setXStep(2);
    } catch (e: any) {
      toast.error("Erro ao carregar itens: " + e.message);
    } finally {
      setXLoading(false);
    }
  };

  const setQt = (idx: number, v: string) => {
    const formatted = maskMoney(v);
    const n = parseMoneyToFloat(formatted);
    setXItens(prev => prev.map((it, i) => i === idx ? { ...it, qt_devolver: Math.max(0, Math.min(n, it.qt_origem)) } : it));
  };
  const setCfop = (idx: number, v: string) => {
    setXItens(prev => prev.map((it, i) => i === idx ? { ...it, cfop_devolucao: v.replace(/\D/g, "").substring(0, 4) } : it));
  };
  const setDeposito = (idx: number, depId: number) => {
    setXItens(prev => prev.map((it, i) => i === idx ? { ...it, deposito_id: depId } : it));
  };

  const totalDevolucao = useMemo(
    () => XItens.reduce((s, it) => s + it.qt_devolver * it.vl_unit, 0),
    [XItens]
  );

  // Transmissão para a SEFAZ com cronômetro em tempo real
  const transmitirSefaz = async (nfeId: number, nrNota?: string, segPreConfigurado?: number) => {
    const targetEmpresaId = XSelecionada?.empresa_id || XEmpresaId;
    const totalSeg = segPreConfigurado || (await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId)) || 60;
    setXProg({
      open: true,
      titulo: `Transmitindo NF-e #${nrNota || nfeId} à SEFAZ...`,
      total: totalSeg,
      restante: totalSeg,
    });

    try {
      const res = await fiscalEmissaoService.retransmitirDocumento(nfeId, targetEmpresaId);
      if (!res.success || !res.fiscal_evento_id) {
        setXProg(p => ({ ...p, open: false }));
        setXStep(3);
        toast.error("Falha ao enfileirar: " + (res.message || "Erro desconhecido"));
        return;
      }

      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
        empresaId: targetEmpresaId,
        timeoutMs: totalSeg * 1000,
        onTick: (s) => setXProg(p => ({ ...p, restante: s })),
      });
      setXProg(p => ({ ...p, open: false }));
      setXStep(3);

      const { data: updatedCab } = await db.from("fiscal_nfe_cabecalho")
        .select("st_nf, nr_nota, serie, c_stat, x_motivo, movimento_id, movimento:movimento_id(nr_movimento)")
        .eq("nfe_cabecalho_id", nfeId)
        .maybeSingle();

      const stNf = updatedCab?.st_nf || (ret.success ? "A" : "R");
      if (stNf === "A") {
        setXTransmitida(true);
        if (updatedCab?.movimento_id) {
          setXGeradoMovimento({
            movimento_id: Number(updatedCab.movimento_id),
            nr_movimento: Number((updatedCab.movimento as any)?.nr_movimento || updatedCab.movimento_id),
          });
        }
        toast.success("Nota Fiscal de Devolução AUTORIZADA pela SEFAZ com sucesso!");
        try {
          const impRes = await fiscalEmissaoService.imprimirDocumento(nfeId, targetEmpresaId);
          if (impRes.success && impRes.pdf_base64) {
            const binaryString = atob(impRes.pdf_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
          }
        } catch {}
      } else {
        setXTransmitida(false);
        toast.error("Retorno SEFAZ: " + (ret.mensagem || ret.resposta?.x_motivo || "Não autorizada"));
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      setXStep(3);
      toast.error("Erro na transmissão: " + e.message);
    }
  };

  // ------- Etapa 3 - gerar NF-e devolução (entrada)
  const gerarDevolucao = async () => {
    let itensValidos = XItens.filter(it => it.qt_devolver > 0);
    if (!itensValidos.length) {
      // Se o usuário não informou quantidade manualmente, assume devolver todos os itens disponíveis
      itensValidos = XItens.map(it => ({ ...it, qt_devolver: it.qt_origem }));
      setXItens(itensValidos);
    }
    if (!itensValidos.length) {
      toast.error("Nenhum item disponível para devolução.");
      return;
    }

    const defaultDepId = itensValidos[0]?.deposito_id || XDepositoId || (XDepositos.length > 0 ? XDepositos[0].deposito_id : null);
    itensValidos = itensValidos.map(it => ({
      ...it,
      deposito_id: it.deposito_id || defaultDepId,
    }));

    if (!XSelecionada?.cadastro_id) {
      toast.error("NF-e de origem sem cliente vinculado.");
      return;
    }

    setXGerando(true);
    const targetEmpresaId = XSelecionada?.empresa_id || XEmpresaId;
    let totalSeg = 60;

    // Abre o temporizador padrão imediatamente (idêntico ao Caixa)
    setXProg({
      open: true,
      titulo: "Transmitindo NF-e de Devolução à SEFAZ...",
      total: 60,
      restante: 60,
    });

    try {
      totalSeg = (await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId)) || 60;
      setXProg(p => ({ ...p, total: totalSeg, restante: totalSeg }));

      const obs = `Devolução referente à NF-e de venda nº ${XSelecionada.nr_nota}/${XSelecionada.serie} — Chave: ${XSelecionada.chave_nfe || "-"}`;
      const vlProduto = itensValidos.reduce((s, it) => s + it.qt_devolver * it.vl_unit, 0);

      // Busca sequência da empresa/modelo
      let nrNotaDev = "";
      const { data: cfgItens } = await db
        .from("fiscal_config_item")
        .select("*")
        .eq("empresa_id", XEmpresaId)
        .eq("modelo", XSelecionada.modelo || "55")
        .eq("serie", XSelecionada.serie || "1");
      const cfgItem = cfgItens?.[0];
      if (cfgItem) {
        nrNotaDev = String(cfgItem.sequencia || 1);
        await db
          .from("fiscal_config_item")
          .update({ sequencia: Number(cfgItem.sequencia || 1) + 1 })
          .eq("fiscal_config_item_id", cfgItem.fiscal_config_item_id);
      }

      const { data: novo, error: eCab } = await db.from("fiscal_nfe_cabecalho").insert({
        empresa_id: XEmpresaId,
        cadastro_id: XSelecionada.cadastro_id,
        deposito_id: defaultDepId,
        tp_operacao_id: XTpOperacaoEdId || 6,
        origem_inclusao: "M",
        st_nf: "P",
        tp_nf: 0,           // entrada (mercadoria retornando)
        fin_nfe: 4,         // devolução
        tp_emis: 1,
        modelo: XSelecionada.modelo || "55",
        nat_op: XNatOp,
        nr_nota: nrNotaDev,
        serie: XSelecionada.serie || "1",
        chave_nfe: "",
        nr_protocolo: "",
        dt_emissao: new Date().toISOString().substring(0, 10),
        dt_entrada: new Date().toISOString().substring(0, 10),
        vl_produto: vlProduto,
        vl_desconto: 0, vl_frete: 0, vl_seguro: 0, vl_despesa: 0, vl_outro: 0,
        vl_ipi: 0, vl_icms: 0, vl_icms_st: 0, vl_pis: 0, vl_cofins: 0,
        vl_ibs: 0, vl_cbs: 0, vl_is: 0, vl_bc: 0,
        vl_total_nf: vlProduto,
        obs_nf: obs,
        excluido: false,
      }).select("nfe_cabecalho_id").single();
      if (eCab) throw eCab;

      const novoId = novo.nfe_cabecalho_id;
      if (XSelecionada.chave_nfe) {
        await db.from("fiscal_nfe_referenciada").insert({
          nfe_cabecalho_id: novoId,
          chave_ref: XSelecionada.chave_nfe
        });
      }

      const itensPayload = itensValidos.map((it, idx) => {
        const o = it.origem_item;
        const fator = it.qt_devolver / Math.max(1e-9, Number(o?.qt_entrada || it.qt_origem));
        return {
          nfe_cabecalho_id: novoId,
          empresa_id: XEmpresaId,
          deposito_id: it.deposito_id || defaultDepId,
          produto_id: it.produto_id,
          nr_item: idx + 1,
          nfe_item_origem_id: o?.nfe_item_id || null,
          nr_item_origem: Number(o?.nr_item || 1),
          chave_ref_item: String(XSelecionada.chave_nfe || "").replace(/\D/g, ""),
          cd_prod_fornec: it.cd_produto,
          nm_produto: it.nm_produto,
          ncm: it.ncm,
          cfop: it.cfop_devolucao,
          unidade: it.unidade,
          gtin: it.gtin || "SEM GTIN",
          origem: o.origem ?? 0,
          csosn: o.csosn || "",
          cest: o.cest || "",
          c_enq: o.c_enq || "999",
          qt_entrada: it.qt_devolver,
          qt_tributavel: it.qt_devolver,
          vl_unit: it.vl_unit,
          vl_unit_tributavel: it.vl_unit,
          vl_desconto: 0,
          vl_total: it.qt_devolver * it.vl_unit,
          vl_frete: 0, vl_seguro: 0, vl_outro: 0,
          vl_bc: Number(o.vl_bc || 0) * fator,
          vl_icms: Number(o.vl_icms || 0) * fator,
          vl_icms_st: Number(o.vl_icms_st || 0) * fator,
          vl_bc_st: Number(o.vl_bc_st || 0) * fator,
          vl_ipi: Number(o.vl_ipi || 0) * fator,
          vl_pis: Number(o.vl_pis || 0) * fator,
          vl_cofins: Number(o.vl_cofins || 0) * fator,
          vl_fcp_st: Number(o.vl_fcp_st || 0) * fator,
          vl_ibs: Number(o.vl_ibs || 0) * fator,
          vl_cbs: Number(o.vl_cbs || 0) * fator,
          vl_is: Number(o.vl_is || 0) * fator,
          pc_icms: Number(o.pc_icms || 0),
          pc_icms_st: Number(o.pc_icms_st || 0),
          pc_ipi: Number(o.pc_ipi || 0),
          pc_pis: Number(o.pc_pis || 0),
          pc_cofins: Number(o.pc_cofins || 0),
          pc_fcp_st: Number(o.pc_fcp_st || 0),
          pc_ibs: Number(o.pc_ibs || 0),
          pc_cbs: Number(o.pc_cbs || 0),
          pc_is: Number(o.pc_is || 0),
          pc_mva: Number(o.pc_mva || 0),
          cst_icms: o.cst_icms || "",
          cst_ipi: o.cst_ipi || "",
          cst_pis: o.cst_pis || "49",
          cst_cofins: o.cst_cofins || "49",
          cst_ibs: o.cst_ibs || "",
          cst_cbs: o.cst_cbs || "",
          cst_is: o.cst_is || "",
          excluido: false,
        };
      });

      const { error: eIt } = await db.from("fiscal_nfe_item").insert(itensPayload);
      if (eIt) throw eIt;

      // Gera o pedido / movimento ED vinculado imediatamente
      const origemMovId = XSelecionada?.movimento_id || XSelecionada?.pedido_id || null;
      try {
        const { data: rpcRes, error: eRpc } = await db.rpc("fu_gerar_movimento_devolucao_nfe", {
          p_nfe_cabecalho_id: novoId,
          p_movimento_origem_id: origemMovId ? Number(origemMovId) : null,
        });
        if (!eRpc && rpcRes?.movimento_id) {
          setXGeradoMovimento({
            movimento_id: Number(rpcRes.movimento_id),
            nr_movimento: Number(rpcRes.nr_movimento || rpcRes.movimento_id),
          });
        }
      } catch (err) {
        console.warn("Aviso ao gerar movimento ED preliminar:", err);
      }

      setXNovoNfeId(novoId);
      setXProg(p => ({
        ...p,
        titulo: `Transmitindo NF-e #${nrNotaDev || novoId} à SEFAZ...`,
      }));
      await transmitirSefaz(novoId, nrNotaDev, totalSeg);
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error("Falha ao gerar devolução: " + e.message);
    } finally {
      setXGerando(false);
    }
  };

  const abrirNotaGerada = () => {
    if (!XNovoNfeId) return;
    openTab({ title: `Devolução Venda NF-e #${XNovoNfeId}`, component: "nfe-form", params: { nfe_cabecalho_id: XNovoNfeId } });
  };

  const reiniciar = () => {
    setXStep(1); setXBusca(""); setXSelecionada(null); setXItens([]); setXNovoNfeId(null); setXGeradoMovimento(null);
  };

  const StepBadge: React.FC<{ n: number; label: string; icon: React.ReactNode }> = ({ n, label, icon }) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${XStep === n ? "bg-primary text-primary-foreground border-primary" : XStep > n ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300" : "bg-muted text-muted-foreground border-border"}`}>
      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-background/30 font-bold text-sm">
        {XStep > n ? <Check className="w-4 h-4" /> : n}
      </div>
      <div className="flex items-center gap-1 text-xs font-bold uppercase">{icon}{label}</div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary"><RotateCcw className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Devolução de Notas Fiscais de Saída</h2>
            <p className="text-xs text-muted-foreground">Assistente em 3 etapas — gera NF-e de devolução de venda (entrada)</p>
          </div>
        </div>
        <button onClick={reiniciar} className="text-xs font-bold px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors">
          REINICIAR
        </button>
      </div>

      <div className="flex items-center gap-2 bg-card p-3 rounded-xl border border-border shadow-sm">
        <StepBadge n={1} label="Selecionar NF-e Origem" icon={<FileText className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={2} label="Itens a Devolver" icon={<Package className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={3} label="Conferir e Enviar" icon={<Send className="w-3.5 h-3.5" />} />
      </div>

      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        {XStep === 1 && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  ref={buscaRef}
                  autoFocus
                  value={XBusca}
                  onChange={e => setXBusca(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dtIniRef.current?.focus();
                    }
                  }}
                  placeholder="Nº da nota ou parte da chave de acesso..."
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-background"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Início</label>
                <input 
                  ref={dtIniRef}
                  type="date" 
                  value={XDtIni} 
                  onChange={e => setXDtIni(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dtFimRef.current?.focus();
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background" 
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Fim</label>
                <input 
                  ref={dtFimRef}
                  type="date" 
                  value={XDtFim} 
                  onChange={e => setXDtFim(e.target.value)} 
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      buscarBtnRef.current?.focus();
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-border rounded-md bg-background" 
                />
              </div>
              <button 
                ref={buscarBtnRef}
                onClick={buscarNotas} 
                disabled={XLoading} 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                {XLoading ? "BUSCANDO..." : "BUSCAR"}
              </button>
              <button 
                onClick={limparFiltros} 
                disabled={XLoading} 
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50"
              >
                LIMPAR
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-1">Nota</div>
                <div className="col-span-1 text-center">Série</div>
                <div className="col-span-2">Emissão</div>
                <div className="col-span-5">Cliente</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-right">Valor</div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {XLoading && <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Carregando...</div>}
                {!XLoading && XResultados.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground italic">Nenhuma NF-e de saída localizada no período.</div>
                )}
                {!XLoading && XResultados.map((r, i) => (
                  <div key={r.nfe_cabecalho_id}
                    onClick={() => selecionarNota(r)}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0 cursor-pointer hover:bg-primary/5 ${i % 2 ? "bg-muted/20" : ""}`}>
                    <div className="col-span-1 font-bold text-blue-700 dark:text-blue-300">{r.nr_nota}</div>
                    <div className="col-span-1 text-center font-mono text-xs">{r.serie}</div>
                    <div className="col-span-2 text-xs">{r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "-"}</div>
                    <div className="col-span-5 truncate text-xs">
                      <span className="font-semibold">{r.cadastro?.razao_social || `#${r.cadastro_id || "-"}`}</span>
                      <span className="text-muted-foreground"> — {formatCPFCNPJ(r.cadastro?.cnpj || "")}</span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        {r.st_nf === "A" ? "Autorizada" : (r.st_nf === "C" ? "Cancelada" : (r.st_nf === "L" ? "Lançada" : (r.st_nf === "E" ? "Enviada" : r.st_nf)))}
                      </span>
                    </div>
                    <div className="col-span-2 text-right font-mono font-bold">
                      {Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">Clique em uma nota para carregar seus itens.</p>
          </div>
        )}

        {XStep === 2 && XSelecionada && (
          <div className="flex flex-col gap-3 h-full">
            <div className="grid grid-cols-12 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">NF-e Origem</label>
                <div className="text-sm font-bold">{XSelecionada.nr_nota}/{XSelecionada.serie}</div>
              </div>
              <div className="col-span-5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente</label>
                <div className="text-sm truncate">{XSelecionada.cadastro?.razao_social}</div>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Depósito (entrada) <span className="text-destructive">*</span></label>
                <select 
                  value={XDepositoId ?? ""} 
                  onChange={e => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    setXDepositoId(val);
                    if (val) {
                      setXItens(prev => prev.map(it => ({ ...it, deposito_id: val })));
                    }
                  }} 
                  className="w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background"
                >
                  <option value="">— Selecione —</option>
                  {XDepositos.map(d => <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Total Devolução</label>
                <div className="text-sm font-mono font-bold text-primary">R$ {totalDevolucao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="col-span-12">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Natureza da Operação</label>
                <input value={XNatOp} onChange={e => setXNatOp(e.target.value)} className="w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background" />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-1">Cód.</div>
                <div className="col-span-3">Descrição</div>
                <div className="col-span-1 text-center">Und</div>
                <div className="col-span-1 text-right">Qt. Origem</div>
                <div className="col-span-2 text-right">Qt. a Devolver</div>
                <div className="col-span-2 text-left">Depósito Entrada</div>
                <div className="col-span-1 text-center">CFOP Dev.</div>
                <div className="col-span-1 text-right">Vl. Unit.</div>
              </div>
              <div className="overflow-y-auto flex-1">
                {XItens.map((it, idx) => (
                  <div key={it.nfe_item_id} className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0 ${idx % 2 ? "bg-muted/20" : ""}`}>
                    <div className="col-span-1 font-mono text-xs truncate">{it.cd_produto}</div>
                    <div className="col-span-3 truncate text-xs text-blue-800 dark:text-blue-300 font-medium">{it.nm_produto}</div>
                    <div className="col-span-1 text-center text-xs">{it.unidade}</div>
                    <div className="col-span-1 text-right font-mono text-xs">{it.qt_origem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                    <div className="col-span-2 text-right">
                      <input
                        type="text"
                        value={it.qt_devolver === 0 ? "" : maskMoney(it.qt_devolver.toFixed(2))}
                        onChange={e => setQt(idx, e.target.value)}
                        placeholder="0,00"
                        className={`w-full text-right px-2 py-1 text-xs border rounded font-mono ${it.qt_devolver > 0 ? "border-primary bg-primary/5 font-bold" : "border-border bg-background"}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={it.deposito_id ?? ""}
                        onChange={e => setDeposito(idx, Number(e.target.value))}
                        className="w-full text-xs border border-border rounded px-1.5 py-1 bg-background font-medium"
                      >
                        <option value="">— Selecione —</option>
                        {XDepositos.map(d => (
                          <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 text-center">
                      <input value={it.cfop_devolucao} onChange={e => setCfop(idx, e.target.value)} className="w-full text-center px-1 py-1 text-xs border border-border rounded font-mono" />
                    </div>
                    <div className="col-span-1 text-right font-mono text-xs">{it.vl_unit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setXStep(1)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80">
                <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
              </button>
              <button 
                onClick={gerarDevolucao} 
                disabled={XGerando} 
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 shadow-sm tracking-wide"
                title="Gera e transmite à SEFAZ exibindo o cronômetro em tempo real"
              >
                {XGerando ? "PROCESSANDO..." : <>GERAR E ENVIAR À SEFAZ <Send className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        )}

        {XStep === 3 && XNovoNfeId && (
          <div className="flex flex-col items-center justify-center gap-4 h-full text-center">
            <div className={`p-4 rounded-full ${XTransmitida ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-primary/10 text-primary"}`}>
              {XTransmitida ? <Check className="w-12 h-12" /> : <Send className="w-12 h-12" />}
            </div>
            <h3 className="text-xl font-bold">
              {XTransmitida ? "NF-e de Devolução Autorizada na SEFAZ!" : "NF-e de Devolução Criada com Sucesso"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {XTransmitida 
                ? `A devolução foi transmitida, aprovada pela SEFAZ e o Pedido ED${XGeradoMovimento ? ` #${XGeradoMovimento.nr_movimento}` : ""} foi devidamente gerado e atualizado.`
                : `A devolução e o Pedido ED${XGeradoMovimento ? ` #${XGeradoMovimento.nr_movimento}` : ""} foram gerados. Clique no botão abaixo para enviar à SEFAZ ou abra o formulário completo.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <button onClick={reiniciar} className="px-4 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80">
                NOVA DEVOLUÇÃO
              </button>
              {!XTransmitida && (
                <button 
                  onClick={() => transmitirSefaz(XNovoNfeId)} 
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" /> ENVIAR PARA A SEFAZ AGORA
                </button>
              )}
              {XTransmitida && (
                <button
                  onClick={async () => {
                    const tid = toast.loading("Gerando DANFE...");
                    try {
                      const res = await fiscalEmissaoService.imprimirDocumento(XNovoNfeId, XEmpresaId);
                      toast.dismiss(tid);
                      if (res.success && res.pdf_base64) {
                        const binaryString = atob(res.pdf_base64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                        const blob = new Blob([bytes], { type: "application/pdf" });
                        const url = URL.createObjectURL(blob);
                        window.open(url, "_blank");
                      }
                    } catch (e: any) {
                      toast.dismiss(tid);
                      toast.error("Erro ao emitir DANFE: " + e.message);
                    }
                  }}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> IMPRIMIR DANFE
                </button>
              )}
              <button onClick={abrirNotaGerada} className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-muted hover:bg-muted/80 border border-border rounded-md shadow-sm">
                ABRIR NF-e GERADA <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {XGeradoMovimento && (
                <button 
                  onClick={() => {
                    openTab({
                      title: `Pedido ED #${XGeradoMovimento.nr_movimento}`,
                      component: "pedidos",
                      params: { movimento_id: XGeradoMovimento.movimento_id },
                    });
                  }}
                  className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-sm"
                >
                  <Package className="w-3.5 h-3.5" /> ABRIR PEDIDO ED (#{XGeradoMovimento.nr_movimento})
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <FiscalProgressDialog
        open={XProg.open}
        titulo={XProg.titulo}
        descricao="Aguardando resposta do Fiscal Worker / SEFAZ."
        segundosTotais={XProg.total}
        segundosRestantes={XProg.restante}
      />
    </div>
  );
};

export default DevolucaoNfeSaidaForm;
