import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import NfeItensTab from "./NfeItensTab";
import NfePagamentoTab from "./NfePagamentoTab";
import type { INfeCabecalho, TNfeSt } from "./types";
import { NFE_ST_LABELS } from "./types";
import { Search, Send, Printer, AlertCircle, Copy, Download, Check, FileCode, CheckCircle2, XCircle } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import { formatNumericInput } from "@/utils/formNavigation";
import ClienteSearchDialog, { IClienteRow } from "../pedido/ClienteSearchDialog";
import FiscalProgressDialog from "@/components/fiscal/FiscalProgressDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const db = supabase as any;

interface IClienteInfo { id: number; cnpj: string; razao: string; cd_cadastro?: number | null; }
interface IVendedorInfo { id: number; nome: string; cd_funcionario?: number | null; }

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "ID",      width: "60px",  align: "right" },
  { key: "pedido_id",        label: "Pedido",  width: "80px",  align: "right" },
  { key: "tp_nf",            label: "Tipo",    width: "70px",  render: r => r.tp_nf === 0 ? "Entrada" : "Saída" },
  { key: "nr_nota",          label: "Nota",    width: "90px",  render: (r: any) => r.nr_nota ? <span className="font-semibold">{r.nr_nota}</span> : <span className="text-muted-foreground text-[10px] italic">(Pendente)</span> },
  { key: "serie",            label: "Série",   width: "50px",  align: "center" },
  { key: "modelo",           label: "Mod.",    width: "50px",  align: "center" },
  { key: "dt_emissao",       label: "Emissão", width: "100px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  { key: "nat_op",           label: "Natureza da Operação", width: "180px", getValue: (r: any) => r.nat_op || "", render: (r: any) => <span className="truncate block" title={r.nat_op || ""}>{r.nat_op || ""}</span> },
  { key: "_dest",            label: "Cliente/Fornecedor", width: "2fr", getValue: (r: any) => r._dest_razao || "", render: (r: any) => r._dest_razao || (r.cadastro_id ? `#${r.cadastro_id}` : "") },
  { 
    key: "st_nf", 
    label: "Status", 
    width: "100px", 
    render: r => {
      const label = NFE_ST_LABELS[r.st_nf as TNfeSt] || r.st_nf;
      const colors: any = {
        "A": "bg-green-100 text-green-700",
        "E": "bg-blue-100 text-blue-700",
        "P": "bg-gray-100 text-gray-600",
        "C": "bg-red-100 text-red-700",
        "D": "bg-orange-100 text-orange-700",
        "R": "bg-red-100 text-red-700",
      };
      return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors[r.st_nf] || "bg-gray-100 text-gray-600"}`}>
          {label}
        </span>
      );
    }
  },
  { key: "vl_total_nf",      label: "Total",   width: "110px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "chave_nfe",        label: "Chave de Acesso", width: "300px", render: r => <span className="font-mono text-[10px]">{r.chave_nfe}</span> },
];

const XDefault: Partial<INfeCabecalho> = {
  origem_inclusao: "M",
  st_nf: "P",
  tp_nf: 1, // 1 = saída
  fin_nfe: 1,
  tp_emis: 1,
  modelo: "55",
  tp_operacao_id: null,
  nat_op: "",
  funcionario_id: null,
  nr_nota: "",
  serie: "1",
  chave_nfe: "",
  nr_protocolo: "",
  vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_seguro: 0, vl_despesa: 0,
  vl_ipi: 0, vl_icms_st: 0, vl_pis: 0, vl_cofins: 0,
  vl_ibs: 0, vl_cbs: 0, vl_is: 0, vl_total_nf: 0,
  obs_nf: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_saida: new Date().toISOString().substring(0, 10),
};

const OutrasNotasForm: React.FC<{ initialId?: number }> = ({ initialId }) => {
  const { XEmpresaId } = useAppContext();

  const [XAutoInsertItem, setXAutoInsertItem] = useState(false);

  const [XClienteCache, setXClienteCache] = useState<Record<number, IClienteInfo>>({});
  const [XVendedorCache, setXVendedorCache] = useState<Record<number, IVendedorInfo>>({});
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);
  const [XTpOperacoes, setXTpOperacoes] = useState<{
    id: number;
    descricao: string;
    tp_movimento: string;
    gera_nf: string | boolean;
    gera_pedido: string;
    altera_estoque: string;
  }[]>([]);
  const XTpOperacoesRef = useRef(XTpOperacoes);
  useEffect(() => { XTpOperacoesRef.current = XTpOperacoes; }, [XTpOperacoes]);
  const [XProg, setXProg] = useState<{ open: boolean; titulo: string; total: number; restante: number }>({
    open: false,
    titulo: "",
    total: 60,
    restante: 60,
  });
  const [XSefazErroModal, setXSefazErroModal] = useState<{ open: boolean; cStat?: string | number | null; motivo?: string | null; detalhe?: string | null }>({
    open: false,
  });
  
  const XClienteCacheRef = useRef<Record<number, IClienteInfo>>(XClienteCache);
  useEffect(() => { XClienteCacheRef.current = XClienteCache; }, [XClienteCache]);

  const XVendedorCacheRef = useRef<Record<number, IVendedorInfo>>(XVendedorCache);
  useEffect(() => { XVendedorCacheRef.current = XVendedorCache; }, [XVendedorCache]);

  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTipo, setXSearchTipo] = useState<"cliente" | "fornecedor" | "todos">("todos");
  const [XSearchTarget, setXSearchTarget] = useState<((c: IClienteRow) => void) | null>(null);

  const [XVendedorSearchOpen, setXVendedorSearchOpen] = useState(false);
  const [XVendedorSearchTarget, setXVendedorSearchTarget] = useState<((v: IVendedorRow) => void) | null>(null);

  const [XMovimentoCache, setXMovimentoCache] = useState<Record<number, number>>({});
  const XMovimentoCacheRef = useRef<Record<number, number>>(XMovimentoCache);
  useEffect(() => { XMovimentoCacheRef.current = XMovimentoCache; }, [XMovimentoCache]);

  const ensureMovimentoInfo = useCallback(async (movIds: number[]) => {
    const faltando = movIds.filter(id => id && !XMovimentoCacheRef.current[id]);
    if (!faltando.length) return;
    try {
      const { data } = await db.from("movimento")
        .select("movimento_id, nr_movimento")
        .in("movimento_id", faltando);
      if (data) {
        setXMovimentoCache(prev => {
          const next = { ...prev };
          for (const m of data as any[]) {
            if (m.movimento_id) next[m.movimento_id] = m.nr_movimento;
          }
          return next;
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar dados do movimento:", e);
    }
  }, []);

  const destinatarioInputRef = useRef<HTMLInputElement>(null);
  const vendedorInputRef = useRef<HTMLInputElement>(null);
  const XVendorSelectedRef = useRef<number | null>(null);

  const { handleKeyDown } = useEnterTraversal();

  const handleSearchDestinatario = (rec: any, setF: (k: string, v: any) => void) => {
    setXSearchTipo("todos");
    setXSearchTarget(() => (c: IClienteRow) => {
      setXClienteCache(prev => ({
        ...prev,
        [c.cadastro_id]: {
          id: c.cadastro_id,
          cd_cadastro: c.cd_cadastro,
          cnpj: c.cnpj || "",
          razao: c.razao_social || "",
          fantasia: c.nome_fantasia || ""
        }
      }));
      setF("cadastro_id", c.cadastro_id as any);
      setXSearchOpen(false);
    });
    setXSearchOpen(true);
  };

  const handleSaveAndGoToItens = async (
    onSalvar?: () => Promise<any>,
    setInnerTab?: (t: string) => void
  ) => {
    setXAutoInsertItem(true);
    if (onSalvar) {
      await onSalvar();
    }
    if (setInnerTab) {
      setInnerTab("itens");
    }
  };

  const handleSearchVendedor = (
    rec: any,
    setField: (k: string, v: any) => void,
    setRecord?: any,
    onSalvar?: () => Promise<any>,
    setInnerTab?: (t: string) => void
  ) => {
    setXVendedorSearchTarget(() => async (v: IVendedorRow) => {
      XVendorSelectedRef.current = v.cadastro_id;
      setXVendedorCache(prev => ({
        ...prev,
        [v.cadastro_id]: {
          id: v.cadastro_id,
          cd_funcionario: v.cd_cadastro,
          nome: v.razao_social || v.nome_fantasia || ""
        }
      }));
      if (setRecord) {
        setRecord((prev: any) => ({ ...prev, funcionario_id: v.cadastro_id }));
      } else {
        setField("funcionario_id", v.cadastro_id as any);
      }
      setXVendedorSearchOpen(false);
      setTimeout(async () => {
        await handleSaveAndGoToItens(onSalvar, setInnerTab);
      }, 150);
    });
    setXVendedorSearchOpen(true);
  };

  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const carregarTpOperacoes = useCallback(async (empresaId: number) => {
    if (!empresaId) return;
    try {
      const { data, error } = await db.from("tp_operacao")
        .select("tp_operacao_id, descricao, tp_movimento, gera_nf, gera_pedido, altera_estoque, excluido")
        .eq("empresa_id", empresaId)
        .eq("excluido", false)
        .order("descricao");

      if (error) {
        console.warn("Aviso ao carregar tp_operacao:", error);
        return;
      }

      if (data) {
        setXTpOperacoes(data.map((t: any) => ({
          id: t.tp_operacao_id,
          descricao: t.descricao,
          tp_movimento: String(t.tp_movimento || "").toUpperCase().trim(),
          gera_nf: t.gera_nf,
          gera_pedido: t.gera_pedido,
          altera_estoque: t.altera_estoque,
        })));
      }
    } catch (e) {
      console.warn("Erro ao buscar tp_operacao:", e);
    }
  }, []);

  const ensureTpOperacoesInfo = useCallback(async (opIds: number[]) => {
    const faltando = opIds.filter(id => id && !XTpOperacoesRef.current.some(o => String(o.id) === String(id)));
    if (!faltando.length) return;
    try {
      const { data } = await db.from("tp_operacao")
        .select("tp_operacao_id, descricao, tp_movimento, gera_nf, gera_pedido, altera_estoque")
        .in("tp_operacao_id", faltando);
      if (data && data.length) {
        setXTpOperacoes(prev => {
          const existentes = new Set(prev.map(p => String(p.id)));
          const novos = data.filter((t: any) => !existentes.has(String(t.tp_operacao_id))).map((t: any) => ({
            id: t.tp_operacao_id,
            descricao: t.descricao,
            tp_movimento: String(t.tp_movimento || "").toUpperCase().trim(),
            gera_nf: t.gera_nf,
            gera_pedido: t.gera_pedido,
            altera_estoque: t.altera_estoque,
          }));
          return [...prev, ...novos];
        });
      }
    } catch (e) {
      console.warn("Erro ao buscar dados de tp_operacao:", e);
    }
  }, []);

  useEffect(() => {
    db.from("deposito").select("deposito_id,nome").eq("excluido", false).order("nome")
      .then(({ data }: any) => setXDepositos(data || []));

    if (XEmpresaId) {
      carregarTpOperacoes(XEmpresaId);
    }
  }, [XEmpresaId, carregarTpOperacoes]);

  const ensureClienteInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XClienteCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("cadastro")
      .select("cadastro_id,cd_cadastro,cnpj,razao_social")
      .in("cadastro_id", faltando);
    if (data) {
      setXClienteCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cd_cadastro: c.cd_cadastro, cnpj: c.cnpj || "", razao: c.razao_social || "" };
        }
        return next;
      });
    }
  }, []);

  const ensureVendedorInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XVendedorCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("funcionario")
      .select("funcionario_id,cd_funcionario,nome")
      .in("funcionario_id", faltando);
    if (data) {
      setXVendedorCache(prev => {
        const next = { ...prev };
        for (const v of data as any[]) {
          next[v.funcionario_id] = { id: v.funcionario_id, cd_funcionario: v.cd_funcionario, nome: v.nome || "" };
        }
        return next;
      });
    }
  }, []);

  const gridCols = useMemo(() => XGridCols.map(c => {
    if (c.key === "_dest") {
      return { 
        ...c, 
        getValue: (r: any) => XClienteCache[r.cadastro_id]?.razao || "",
        render: (r: any) => r._dest_razao || (r.cadastro_id ? (XClienteCache[r.cadastro_id]?.razao || `#${XClienteCache[r.cadastro_id]?.cd_cadastro ?? r.cadastro_id}`) : "")
      };
    }
    if (c.key === "pedido_id") {
      return {
        ...c,
        getValue: (r: any) => (r.movimento_id ? XMovimentoCache[r.movimento_id] : null) || r.pedido_id || r.movimento_id || "",
        render: (r: any) => {
          const num = (r.movimento_id ? XMovimentoCache[r.movimento_id] : null) || r.pedido_id || r.movimento_id || "";
          return num ? <span className="font-medium">{num}</span> : <span className="text-muted-foreground">-</span>;
        }
      };
    }
    if (c.key === "nat_op") {
      return {
        ...c,
        getValue: (r: any) => r.nat_op || (r.tp_operacao_id ? (XTpOperacoes.find(o => String(o.id) === String(r.tp_operacao_id))?.descricao || "") : ""),
        render: (r: any) => {
          const desc = r.nat_op || (r.tp_operacao_id ? (XTpOperacoes.find(o => String(o.id) === String(r.tp_operacao_id))?.descricao || "") : "");
          return <span className="truncate block" title={desc}>{desc}</span>;
        }
      };
    }
    return c;
  }), [XClienteCache, XMovimentoCache, XTpOperacoes]);

  const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInput = (v: any) => {
    if (v === undefined || v === null || v === "") return "0,00";
    if (typeof v === "number") {
      return v.toFixed(2).replace(".", ",");
    }
    return String(v).replace(".", ",");
  };
  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : n;
  };
  const handleBlur = (key: string, record: any, setField: any) => {
    const current = record[key];
    if (current === undefined || current === null || current === "") return;
    setField(key, parseNum(current).toFixed(2).replace(".", ","));
  };

  const handleEmitirDanfe = async (currentRecord: any) => {
    if (!currentRecord?.nfe_cabecalho_id) return;
    const tid = toast.loading("Gerando DANFE...");
    try {
      const res = await fiscalEmissaoService.imprimirDocumento(
        currentRecord.nfe_cabecalho_id,
        currentRecord.empresa_id || XEmpresaId
      );
      toast.dismiss(tid);
      if (res.success && res.pdf_base64) {
        const binaryString = atob(res.pdf_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        toast.success("DANFE gerado com sucesso.");
      } else {
        toast.error(res.message || "Falha ao gerar PDF do DANFE.");
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error("Erro ao emitir DANFE: " + e.message);
    }
  };

  const handleEnviarSefaz = async (currentRecord: any, refresh?: () => Promise<void>) => {
    if (!currentRecord?.nfe_cabecalho_id) {
      toast.error("Salve a nota fiscal antes de transmitir à SEFAZ.");
      return;
    }
    const targetEmpresaId = currentRecord.empresa_id || XEmpresaId;
    const targetMod = String(currentRecord.modelo || "55");
    const targetSer = String(currentRecord.serie || "1");

    // 1. Gera o número oficial da nota fiscal SOMENTE NO ENVIO SEFAZ se ainda não tiver
    let nrNotaTransmitir = currentRecord.nr_nota ? String(currentRecord.nr_nota).trim() : "";
    if (!nrNotaTransmitir || nrNotaTransmitir === "0") {
      try {
        const { data: ci, error: errCi } = await db
          .from("fiscal_config_item")
          .select("fiscal_config_item_id, sequencia")
          .eq("empresa_id", targetEmpresaId)
          .eq("modelo", targetMod)
          .eq("serie", targetSer)
          .maybeSingle();

        if (errCi || !ci) {
          toast.error(`Configuração fiscal não encontrada para Empresa ${targetEmpresaId}, Modelo ${targetMod}, Série ${targetSer}.`);
          return;
        }

        const proximoSequencial = Number(ci.sequencia || 1);
        nrNotaTransmitir = String(proximoSequencial);

        // Atribui o número da nota no banco
        await db.from("fiscal_nfe_cabecalho")
          .update({ nr_nota: nrNotaTransmitir })
          .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id);

        // Incrementa a sequência da série
        await db.from("fiscal_config_item")
          .update({ sequencia: proximoSequencial + 1 })
          .eq("fiscal_config_item_id", ci.fiscal_config_item_id);

        currentRecord.nr_nota = nrNotaTransmitir;
        toast.info(`Número fiscal nº ${nrNotaTransmitir} gerado da sequência da Série ${targetSer}.`);
      } catch (eSeq: any) {
        toast.error("Erro ao gerar sequencial fiscal: " + eSeq.message);
        return;
      }
    }

    if (!confirm(`Enviar NF-e #${nrNotaTransmitir} para a SEFAZ via fiscal-worker?`)) return;

    // 2. Sincroniza o movimento/pedido interno antes de transmitir
    try {
      await db.rpc("fu_sincronizar_movimento_outras_notas", {
        p_nfe_cabecalho_id: currentRecord.nfe_cabecalho_id
      });
    } catch (eSync) {
      console.warn("Aviso na sincronização prévia de movimento:", eSync);
    }

    // 3. Abre diálogo de progresso com contagem regressiva
    const totalSeg = (await fiscalEmissaoService.obterTimeoutFiscalSeg(targetEmpresaId)) || 60;
    setXProg({
      open: true,
      titulo: `Transmitindo NF-e #${nrNotaTransmitir} à SEFAZ...`,
      total: totalSeg,
      restante: totalSeg,
    });

    try {
      // 3. Enfileira o comando para o fiscal-worker
      const res = await fiscalEmissaoService.retransmitirDocumento(
        currentRecord.nfe_cabecalho_id,
        targetEmpresaId
      );

      if (!res.success || !res.fiscal_evento_id) {
        setXProg(p => ({ ...p, open: false }));
        toast.error("Falha ao enfileirar: " + (res.message || "Erro desconhecido"));
        setXSefazErroModal({
          open: true,
          cStat: "VALIDAÇÃO",
          motivo: res.message || "Erro prévio de validação antes da transmissão.",
        });
        return;
      }

      // 4. Aguarda processamento do fiscal-worker em tempo real
      const ret = await fiscalEmissaoService.aguardarEvento(res.fiscal_evento_id, {
        empresaId: targetEmpresaId,
        timeoutMs: totalSeg * 1000,
        onTick: (s) => setXProg(p => ({ ...p, restante: s })),
      });

      setXProg(p => ({ ...p, open: false }));

      // 5. Busca dados atualizados da nota no banco
      const { data: cabUpdated } = await db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id, nr_nota, serie, st_nf, c_stat, x_motivo, chave_nfe, nr_protocolo, recibo_sefaz, xml_nf, dt_cancelamento, protocolo_cancelamento, motivo_cancelamento, movimento_id, pedido_id")
        .eq("nfe_cabecalho_id", currentRecord.nfe_cabecalho_id)
        .maybeSingle();

      if (cabUpdated) {
        Object.assign(currentRecord, cabUpdated);
      }

      if (refresh) await refresh();
      else if (XRefreshRef.current) await XRefreshRef.current();

      const stNf = cabUpdated?.st_nf || (ret.success ? "A" : "R");

      // 6. Trata retorno oficial da SEFAZ
      if (stNf === "A") {
        toast.success("Nota Fiscal AUTORIZADA com sucesso pela SEFAZ!");

        // Atualiza e avança o sequencial em fiscal_config_item
        const nrEmitido = Number(cabUpdated?.nr_nota || currentRecord.nr_nota);
        if (nrEmitido) {
          const modEmitido = String(currentRecord.modelo || "55");
          const serEmitida = String(currentRecord.serie || "1");
          const { data: ci } = await db
            .from("fiscal_config_item")
            .select("fiscal_config_item_id, sequencia")
            .eq("empresa_id", targetEmpresaId)
            .eq("modelo", modEmitido)
            .eq("serie", serEmitida)
            .maybeSingle();
          if (ci && Number(ci.sequencia) <= nrEmitido) {
            await db
              .from("fiscal_config_item")
              .update({ sequencia: nrEmitido + 1 })
              .eq("fiscal_config_item_id", ci.fiscal_config_item_id);
            buscarProximoSequencial(targetEmpresaId, modEmitido, serEmitida).then(nr => {
              if (nr) setXProximoNrNota(nr);
            });
          }
        }

        // Gera DANFE automaticamente
        const tidDanfe = toast.loading("Gerando DANFE em PDF...");
        try {
          const impRes = await fiscalEmissaoService.imprimirDocumento(
            currentRecord.nfe_cabecalho_id,
            targetEmpresaId
          );
          toast.dismiss(tidDanfe);
          if (impRes.success && impRes.pdf_base64) {
            const binaryString = atob(impRes.pdf_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            toast.success("DANFE emitido e aberto em nova aba.");
          }
        } catch (eImp: any) {
          toast.dismiss(tidDanfe);
          console.warn("Aviso na geração do DANFE:", eImp.message);
        }
      } else {
        // Erro ou Rejeição da SEFAZ
        const cStat = cabUpdated?.c_stat || ret.resposta?.c_stat || ret.resposta?.CStat || ret.status || "";
        const motivo = cabUpdated?.x_motivo || ret.mensagem || ret.resposta?.x_motivo || ret.resposta?.Msg || "Rejeição não especificada pela SEFAZ";
        
        let dica = "";
        if (String(cStat) === "539" || String(cStat) === "204") {
          dica = `A numeração de nota fiscal (${cabUpdated?.nr_nota || currentRecord.nr_nota}) já foi utilizada anteriormente na SEFAZ. Clique em 'Editar' e use o botão '⚡ Próximo livre' ao lado de Nº Nota para avançar para o próximo sequencial da série.`;
        }

        toast.error(`Rejeição SEFAZ: ${motivo}`);
        setXSefazErroModal({
          open: true,
          cStat,
          motivo,
          detalhe: dica,
        });
      }
    } catch (e: any) {
      setXProg(p => ({ ...p, open: false }));
      toast.error("Erro: " + e.message);
      setXSefazErroModal({
        open: true,
        cStat: "ERRO",
        motivo: e.message,
      });
      if (refresh) await refresh();
      else if (XRefreshRef.current) await XRefreshRef.current();
    }
  };

  return (
    <>
      <StandardCrudForm<INfeCabecalho>
      config={{
        XTableName: "fiscal_nfe_cabecalho",
        XPrimaryKey: "nfe_cabecalho_id",
        XTitle: "Outras Notas",
        XDefaultRecord: { 
          ...XDefault, 
          empresa_id: XEmpresaId,
          nr_nota: "",
        } as any,
        XEmpresaId,
        XSelectCols: "*",
        XOrderBy: "nfe_cabecalho_id",
        XSoftDelete: false,
        XKeepEditAfterInsert: true,
        XApplyFilter: (q) => q, 
        XCanEdit: (rec: any) => !["A", "C", "D"].includes(String(rec.st_nf)),
        XOnAfterLoad: (rows: any[]) => {
          const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
          if (ids.length) ensureClienteInfo(ids);
          const vIds = [...new Set(rows.map(r => r.funcionario_id).filter(Boolean))] as number[];
          if (vIds.length) ensureVendedorInfo(vIds);
          const movIds = [...new Set(rows.map(r => r.movimento_id).filter(Boolean))] as number[];
          if (movIds.length) ensureMovimentoInfo(movIds);
          const opIds = [...new Set(rows.map(r => r.tp_operacao_id).filter(Boolean))] as number[];
          if (opIds.length) ensureTpOperacoesInfo(opIds);
        },
        XOnBeforeSave: (rec: any) => {
          if (rec.tp_nf === undefined || rec.tp_nf === null) rec.tp_nf = 1;
          delete rec.chaves_ref;
          delete rec.chave_ref;
          delete rec.vl_bc_st;
          delete rec._dest;
          delete rec._dest_razao;
          if (XVendorSelectedRef.current !== undefined && XVendorSelectedRef.current !== null) {
            rec.funcionario_id = XVendorSelectedRef.current;
          }

          const targetEmpId = rec.empresa_id || XEmpresaId;
          
          // O número da nota fiscal é gerado SOMENTE no envio à SEFAZ. Se vazio ou 0, mantém vazio.
          if (!rec.nr_nota || String(rec.nr_nota).trim() === "0") {
            rec.nr_nota = "";
          }

          const numericTotalKeys = [
            "vl_produto", "vl_desconto", "vl_frete", "vl_seguro", "vl_despesa", "vl_outro",
            "vl_bc", "vl_icms", "vl_icms_deson", "vl_icms_st", "vl_fcp", "vl_fcp_st",
            "vl_fcp_st_ret", "vl_ipi", "vl_ipi_devol", "vl_ii", "vl_pis", "vl_cofins",
            "vl_ibs", "vl_cbs", "vl_is", "vl_total_nf"
          ];
          for (const k of numericTotalKeys) {
            if (rec[k] !== undefined && rec[k] !== null && rec[k] !== "") {
              rec[k] = parseNum(rec[k]);
            } else if (rec[k] === "") {
              rec[k] = 0;
            }
          }
          return { ...rec, empresa_id: targetEmpId };
        },
        XOnAfterSave: async (rec: any, mode: any) => {
          if (rec?.nfe_cabecalho_id && rec?.tp_operacao_id) {
            try {
              await db.rpc("fu_sincronizar_movimento_outras_notas", {
                p_nfe_cabecalho_id: rec.nfe_cabecalho_id
              });
              if (XRefreshRef.current) {
                await XRefreshRef.current();
              }
            } catch (e) {
              console.error("Erro ao sincronizar pedido em Outras Notas:", e);
            }
          }
          if (rec?.nfe_cabecalho_id && Number(rec.fin_nfe) === 4) {
            try {
              const { data: pagData } = await db.from("fiscal_nfe_pagamento")
                .select("nfe_pagamento_id, t_pag, v_pag")
                .eq("nfe_cabecalho_id", rec.nfe_cabecalho_id);

              if (!pagData || pagData.length === 0) {
                await db.from("fiscal_nfe_pagamento").insert({
                  nfe_cabecalho_id: rec.nfe_cabecalho_id,
                  t_pag: "90",
                  v_pag: 0,
                  tp_integra: 2,
                });
              } else if (pagData.length === 1 && (pagData[0].t_pag !== "90" || Number(pagData[0].v_pag) !== 0)) {
                await db.from("fiscal_nfe_pagamento").update({
                  t_pag: "90",
                  v_pag: 0,
                  tp_integra: 2,
                  cnpj_credenciadora: null,
                  c_aut: null,
                }).eq("nfe_pagamento_id", pagData[0].nfe_pagamento_id);
              }
            } catch (eP) {
              console.warn("Aviso ao garantir pagamento 90 em devolução:", eP);
            }
          }
        },
      }}
      XGridCols={gridCols}
      XExportTitle="Outras Notas"
      XAfterInsertTab="itens"
      XRefreshRef={XRefreshRef}
      XInitialId={initialId}
      XToolbarExtras={({ currentRecord, isEditing, refresh }) => {
        if (!currentRecord || isEditing) return null;
        const st = String(currentRecord.st_nf || "P").toUpperCase();
        const foiEmitida = st === "A";
        const podeEnviar = !foiEmitida && st !== "C";

        if (foiEmitida) {
          return (
            <button
              type="button"
              onClick={() => handleEmitirDanfe(currentRecord)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm"
              title="Visualizar e Imprimir DANFE em PDF"
            >
              <Printer className="w-3.5 h-3.5" /> EMITIR DANFE
            </button>
          );
        }

        if (podeEnviar) {
          return (
            <button
              type="button"
              onClick={() => handleEnviarSefaz(currentRecord, refresh)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#eab308] hover:bg-[#ca8a04] text-white rounded shadow-sm transition-colors"
              title="Cria evento PENDENTE no fiscal_evento para que o fiscal-worker transmita a NF-e à SEFAZ"
            >
              <Send className="w-3.5 h-3.5" /> ENVIAR SEFAZ
            </button>
          );
        }

        return null;
      }}
      XExtraTabs={[
        {
          key: "itens", label: "Itens da NF-e",
          render: ({ record, currentRecord, isEditing, setRecord }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const finNfe = Number((currentRecord || record)?.fin_nfe || 1);
            const podeEditar = !!isEditing && !["A", "E", "C", "D"].includes(String(st));
            return (
              <NfeItensTab 
                nfeCabecalhoId={id} 
                empresaId={XEmpresaId} 
                podeEditar={podeEditar} 
                hideVinculo={true}
                finNfe={finNfe} 
                onRefreshCabecalho={async (totais?: any) => {
                  if (totais && setRecord) {
                    setRecord((prev: any) => ({ ...prev, ...totais }));
                  } else if (id && setRecord) {
                    const { data: fresh } = await db.from("fiscal_nfe_cabecalho")
                      .select("*")
                      .eq("nfe_cabecalho_id", id)
                      .maybeSingle();
                    if (fresh) {
                      setRecord((prev: any) => ({ ...prev, ...fresh }));
                    }
                  }
                  if (id) {
                    try {
                      await db.rpc("fu_sincronizar_movimento_outras_notas", {
                        p_nfe_cabecalho_id: id
                      });
                    } catch (e) {
                      console.warn("Sincronização de movimento em background:", e);
                    }
                  }
                  await XRefreshRef.current?.();
                }}
                autoInsert={XAutoInsertItem}
                onAutoInsertHandled={() => setXAutoInsertItem(false)}
              />
            );
          },
        },
        {
          key: "pagamentos", label: "Pagamentos",
          render: ({ record, currentRecord, isEditing }) => {
            const id = (currentRecord || record)?.nfe_cabecalho_id || null;
            const st = (currentRecord || record)?.st_nf || "A";
            const finNfe = Number((currentRecord || record)?.fin_nfe || 1);
            const podeEditar = !!isEditing && !["A", "E", "C", "D"].includes(String(st));
            return <NfePagamentoTab nfeCabecalhoId={id} podeEditar={podeEditar} finNfe={finNfe} />;
          },
        },
        {
          key: "adicionais", label: "Dados Adicionais",
          render: ({ record, currentRecord, setField, isEditing }) => {
            const ro = !isEditing;
            const r = currentRecord || record;
            const st = String(r.st_nf || "P").toUpperCase();
            const chave = String(r.chave_nfe || "").trim();
            const xml = String(r.xml_nf || "").trim();

            const handleCopiarChave = () => {
              if (!chave) {
                toast.error("Nenhuma chave de acesso disponível.");
                return;
              }
              navigator.clipboard.writeText(chave);
              toast.success("Chave da NF-e copiada para a área de transferência!");
            };

            const handleCopiarXml = () => {
              if (!xml) {
                toast.error("Nenhum XML disponível.");
                return;
              }
              navigator.clipboard.writeText(xml);
              toast.success("XML copiado para a área de transferência!");
            };

            const handleDownloadXml = () => {
              if (!xml) {
                toast.error("Nenhum XML disponível para download.");
                return;
              }
              const blob = new Blob([xml], { type: "text/xml;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `NFe_${chave || r.nr_nota || r.nfe_cabecalho_id}.xml`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.success("Download do XML iniciado!");
            };

            return (
              <div className="space-y-4">
                {/* Cabeçalho de Status SEFAZ */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${st === "A" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : st === "R" ? "bg-destructive/10 text-destructive border border-destructive/20" : st === "C" ? "bg-red-500/10 text-red-600 border border-red-500/20" : "bg-muted text-muted-foreground"}`}>
                      {st === "A" ? <CheckCircle2 className="w-5 h-5" /> : st === "R" || st === "C" ? <XCircle className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide">
                          Status Fiscal:
                        </span>
                        <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${st === "A" ? "bg-emerald-600 text-white" : st === "R" ? "bg-destructive text-destructive-foreground" : st === "C" ? "bg-red-600 text-white" : "bg-secondary text-foreground"}`}>
                          {st === "A" ? "Autorizada SEFAZ" : st === "R" ? "Rejeitada" : st === "C" ? "Cancelada" : "Pendente"}
                        </span>
                        {r.c_stat && (
                          <span className="text-xs font-mono text-muted-foreground">
                            (cStat {r.c_stat})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.x_motivo || (st === "A" ? "Documento fiscal autorizado com sucesso." : "Aguardando envio ou consulta à SEFAZ.")}
                      </p>
                    </div>
                  </div>

                  {/* Ações rápidas da Aba Dados Adicionais */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopiarChave}
                      disabled={!chave}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md bg-card hover:bg-accent text-foreground disabled:opacity-50 transition-colors shadow-sm"
                      title="Copiar Chave de 44 dígitos"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copiar Chave
                    </button>
                    <button
                      type="button"
                      onClick={handleCopiarXml}
                      disabled={!xml}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md bg-card hover:bg-accent text-foreground disabled:opacity-50 transition-colors shadow-sm"
                      title="Copiar texto XML"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" /> Copiar XML
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadXml}
                      disabled={!xml}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                      title="Baixar arquivo XML da nota"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar XML
                    </button>
                  </div>
                </div>

                {/* Chave, Protocolo e Recibo */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Chave de Acesso da NF-e (44 dígitos)</label>
                      {chave && (
                        <button
                          type="button"
                          onClick={handleCopiarChave}
                          className="text-[11px] text-primary hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      )}
                    </div>
                    <input
                      readOnly={ro}
                      value={record.chave_nfe ?? ""}
                      onChange={e => setField("chave_nfe" as any, e.target.value as any)}
                      placeholder="Chave gerada pela SEFAZ após autorização"
                      className="w-full border border-border rounded px-2.5 py-1.5 text-xs font-mono bg-card"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Nº Protocolo</label>
                    <input
                      readOnly={ro}
                      value={record.nr_protocolo ?? ""}
                      onChange={e => setField("nr_protocolo" as any, e.target.value as any)}
                      placeholder="Protocolo de autorização"
                      className="w-full border border-border rounded px-2.5 py-1.5 text-xs font-mono bg-card"
                    />
                  </div>

                  <div className="col-span-6 md:col-span-3">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Recibo SEFAZ</label>
                    <input
                      readOnly
                      value={record.recibo_sefaz ?? ""}
                      placeholder="Recibo do lote SEFAZ"
                      className="w-full border border-border rounded px-2.5 py-1.5 text-xs font-mono bg-secondary text-muted-foreground"
                    />
                  </div>
                </div>

                {/* Retorno Detalhado SEFAZ */}
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3 md:col-span-2">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Código cStat</label>
                    <input
                      readOnly
                      value={record.c_stat ?? ""}
                      className="w-full border border-border rounded px-2.5 py-1.5 text-xs font-mono font-bold text-center bg-secondary"
                    />
                  </div>

                  <div className="col-span-9 md:col-span-10">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Mensagem SEFAZ (xMotivo)</label>
                    <input
                      readOnly
                      value={record.x_motivo ?? ""}
                      className="w-full border border-border rounded px-2.5 py-1.5 text-xs bg-secondary text-foreground"
                    />
                  </div>
                </div>

                {/* Observações da NF-e */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1">Informações Adicionais de Interesse do Fisco / Observações (infAdic)</label>
                  <textarea
                    readOnly={ro}
                    value={record.obs_nf ?? ""}
                    onChange={e => setField("obs_nf" as any, e.target.value as any)}
                    rows={3}
                    placeholder="Informações complementares que constarão no rodapé do DANFE e no XML..."
                    className="w-full border border-border rounded px-3 py-2 text-xs bg-card resize-y"
                  />
                </div>

                {/* Cancelamento se houver */}
                {((record as any).dt_cancelamento || (record as any).protocolo_cancelamento || (record as any).motivo_cancelamento) && (
                  <div className="border border-destructive/30 rounded-lg p-3 bg-destructive/5 space-y-2">
                    <p className="text-xs font-bold text-destructive uppercase tracking-wide flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Dados do Cancelamento
                    </p>
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-12 sm:col-span-3">
                        <label className="text-[11px] text-muted-foreground block font-medium">Data / Hora Cancelamento</label>
                        <input
                          readOnly
                          value={(record as any).dt_cancelamento ? new Date((record as any).dt_cancelamento).toLocaleString("pt-BR") : ""}
                          className="w-full border border-border rounded px-2 py-1 text-xs bg-secondary"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-3">
                        <label className="text-[11px] text-muted-foreground block font-medium">Protocolo Cancelamento</label>
                        <input
                          readOnly
                          value={(record as any).protocolo_cancelamento ?? ""}
                          className="w-full border border-border rounded px-2 py-1 text-xs bg-secondary font-mono"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-6">
                        <label className="text-[11px] text-muted-foreground block font-medium">Motivo Cancelamento</label>
                        <input
                          readOnly={ro}
                          value={(record as any).motivo_cancelamento ?? ""}
                          onChange={e => setField("motivo_cancelamento" as any, e.target.value as any)}
                          className="w-full border border-border rounded px-2 py-1 text-xs bg-secondary"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Pré-visualização do XML com ações */}
                <div className="border border-border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wide">XML do Documento Fiscal</span>
                      {xml && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({(xml.length / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                    {xml ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopiarXml}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar XML
                        </button>
                        <span className="text-muted-foreground">|</span>
                        <button
                          type="button"
                          onClick={handleDownloadXml}
                          className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" /> Baixar XML (.xml)
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Nenhum XML gerado ainda</span>
                    )}
                  </div>
                  <textarea
                    readOnly
                    value={xml || "O XML da NF-e será exibido aqui assim que a nota for gerada ou autorizada pela SEFAZ."}
                    className={`w-full border border-border rounded-md px-3 py-2 text-[11px] font-mono min-h-[140px] ${xml ? "bg-secondary/40 text-foreground" : "bg-secondary/20 text-muted-foreground italic"}`}
                  />
                </div>
              </div>
            );
          },
        },
      ]}
      renderCadastro={({ record, setField, setRecord, mode, isEditing, onSalvar, setInnerTab, handleEditar }) => {
        const ro = !isEditing;
        const stAtual = (record.st_nf || "A") as TNfeSt;

        if (record?.funcionario_id) {
          XVendorSelectedRef.current = record.funcionario_id;
          if (!XVendedorCache[record.funcionario_id]) {
            ensureVendedorInfo([record.funcionario_id]);
          }
        }

        return (
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground font-medium">Nº Pedido</label>
                <input 
                  readOnly 
                  value={
                    (record.movimento_id && XMovimentoCache[record.movimento_id]) 
                      ? XMovimentoCache[record.movimento_id] 
                      : ((record as any).pedido_id ?? (record as any).movimento_id ?? "")
                  } 
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right font-bold text-foreground" 
                  title={`Número oficial do pedido (${record.movimento_id ? `Movimento #${record.movimento_id}` : 'Sem movimento'})`} 
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Tipo de Nota</label>
                <select 
                  disabled={ro} 
                  value={record.tp_nf ?? 1} 
                  onChange={e => {
                    const novoTp = Number(e.target.value);
                    setField("tp_nf" as any, novoTp as any);
                    const prefixoNovo = novoTp === 0 ? "E" : "S";
                    const opAtual = XTpOperacoes.find(o => String(o.id) === String(record.tp_operacao_id));
                    const opCompativel = opAtual && 
                      opAtual.tp_movimento.toUpperCase().startsWith(prefixoNovo) &&
                      (String(opAtual.gera_nf || "").toUpperCase() === "S" || opAtual.gera_nf === true);
                    if (!opCompativel) {
                      setField("tp_operacao_id" as any, null as any);
                      setField("nat_op" as any, "" as any);
                    }
                  }} 
                  className="w-full border border-border rounded px-2 py-1 text-sm font-medium"
                >
                  <option value={1}>1 - Saída</option>
                  <option value={0}>0 - Entrada</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Origem</label>
                <input readOnly value={record.origem_inclusao === "X" ? "XML" : "Manual"} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-center" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Modelo</label>
                <select disabled={ro} value={record.modelo ?? 55} onChange={e => setField("modelo" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={55}>55</option>
                  <option value={65}>65</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Nº Nota</span>
                  {!record.nr_nota && (
                    <span className="text-[10px] text-muted-foreground italic font-normal">(gerado no envio)</span>
                  )}
                </label>
                <input 
                  readOnly={ro} 
                  type="text" 
                  placeholder="(Gerado ao enviar SEFAZ)"
                  value={record.nr_nota ?? ""} 
                  onChange={e => setField("nr_nota" as any, e.target.value as any)} 
                  className="w-full border border-border rounded px-2 py-1 text-sm font-semibold" 
                  title="O número oficial é gerado e incrementado automaticamente a partir da série oficial no momento do envio à SEFAZ."
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Série</label>
                <input readOnly={ro} type="number" value={record.serie || ""} onChange={e => setField("serie" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" readOnly={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">{Number(record.tp_nf) === 0 ? "Dt. Entrada" : "Dt. Saída"}</label>
                <input 
                  type="date" 
                  readOnly={ro} 
                  value={((Number(record.tp_nf) === 0 ? (record as any).dt_entrada : record.dt_saida) || "").toString().substring(0, 10)} 
                  onChange={e => {
                    if (Number(record.tp_nf) === 0) setField("dt_entrada" as any, e.target.value as any);
                    else setField("dt_saida" as any, e.target.value as any);
                  }} 
                  className="w-full border border-border rounded px-2 py-1 text-sm" 
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly value={NFE_ST_LABELS[stAtual] || stAtual} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted-foreground font-medium">
                    Natureza da Operação {Number(record.tp_nf) === 0 ? "(Entrada)" : "(Saída)"} <span className="text-destructive">*</span>
                  </label>
                  {isEditing && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => carregarTpOperacoes(record.empresa_id || XEmpresaId)}
                      className="text-[10px] text-primary hover:underline font-normal"
                      title="Atualizar lista de naturezas da operação"
                    >
                      ↻ Atualizar
                    </button>
                  )}
                </div>
                {(() => {
                  const isEntrada = Number(record.tp_nf) === 0;
                  const prefixoEsperado = isEntrada ? "E" : "S";

                  // Popula a combo automaticamente com os tipos de operação que começam com E (0 - Entrada) ou S (1 - Saída) e possuem emitir nota = sim (gera_nf = 'S')
                  const operacoesFiltradas = XTpOperacoes.filter(op =>
                    (String(op.gera_nf || "").toUpperCase() === "S" || op.gera_nf === true) &&
                    op.tp_movimento.toUpperCase().startsWith(prefixoEsperado)
                  );

                  // Localiza operação vinculada por ID ou pela descrição (case-insensitive)
                  const matchedOp = (record.tp_operacao_id && XTpOperacoes.find(o => String(o.id) === String(record.tp_operacao_id)))
                    || (record.nat_op && XTpOperacoes.find(o => o.descricao.trim().toLowerCase() === String(record.nat_op).trim().toLowerCase()));

                  const operacoesExibir = [...operacoesFiltradas];
                  if (matchedOp && !operacoesExibir.some(o => String(o.id) === String(matchedOp.id))) {
                    if (ro || matchedOp.tp_movimento.toUpperCase().startsWith(prefixoEsperado)) {
                      operacoesExibir.push(matchedOp);
                    }
                  }

                  // Se a nota carregada na aba localizar possui nat_op gravada e ela não consta em operacoesExibir, inclui para garantir exibição
                  const natOpTexto = String(record.nat_op || "").trim();
                  if (!matchedOp && natOpTexto && (ro || record.nfe_cabecalho_id)) {
                    operacoesExibir.push({
                      id: `nat_${natOpTexto}` as any,
                      descricao: natOpTexto,
                      tp_movimento: prefixoEsperado,
                      gera_nf: "S",
                      gera_pedido: "N",
                      altera_estoque: "N",
                    });
                  }

                  const valorSelecionado = matchedOp && (ro || matchedOp.tp_movimento.toUpperCase().startsWith(prefixoEsperado))
                    ? String(matchedOp.id)
                    : (natOpTexto && (ro || record.nfe_cabecalho_id) ? `nat_${natOpTexto}` : "");

                  return (
                    <select
                      disabled={ro}
                      value={valorSelecionado}
                      onFocus={() => {
                        if (isEditing) carregarTpOperacoes(record.empresa_id || XEmpresaId);
                      }}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setField("tp_operacao_id" as any, null as any);
                          setField("nat_op" as any, "" as any);
                          return;
                        }
                        const sel = operacoesExibir.find(o => String(o.id) === String(val));
                        if (sel) {
                          const isCustom = String(sel.id).startsWith("nat_");
                          setField("tp_operacao_id" as any, isCustom ? null : Number(sel.id) as any);
                          setField("nat_op" as any, sel.descricao as any);
                        }
                      }}
                      className="w-full border border-border rounded px-2 py-1 text-sm bg-background font-medium"
                    >
                      <option value="">— Selecione a Natureza da Operação —</option>
                      {operacoesExibir.map(op => (
                        <option key={String(op.id)} value={String(op.id)}>
                          {op.descricao}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground font-medium">Finalidade NF-e</label>
                <select 
                  disabled={ro} 
                  value={record.fin_nfe ?? 1} 
                  onChange={async e => {
                    const novoFin = Number(e.target.value);
                    setField("fin_nfe" as any, novoFin as any);
                    if (novoFin === 4 && record.nfe_cabecalho_id) {
                      try {
                        const { data: pagData } = await db.from("fiscal_nfe_pagamento")
                          .select("nfe_pagamento_id, t_pag, v_pag")
                          .eq("nfe_cabecalho_id", record.nfe_cabecalho_id);

                        if (!pagData || pagData.length === 0) {
                          await db.from("fiscal_nfe_pagamento").insert({
                            nfe_cabecalho_id: record.nfe_cabecalho_id,
                            t_pag: "90",
                            v_pag: 0,
                            tp_integra: 2,
                          });
                        } else if (pagData.length === 1 && (pagData[0].t_pag !== "90" || Number(pagData[0].v_pag) !== 0)) {
                          await db.from("fiscal_nfe_pagamento").update({
                            t_pag: "90",
                            v_pag: 0,
                            tp_integra: 2,
                            cnpj_credenciadora: null,
                            c_aut: null,
                          }).eq("nfe_pagamento_id", pagData[0].nfe_pagamento_id);
                        }
                      } catch (eP) {
                        console.warn("Erro ao configurar pagamento 90:", eP);
                      }
                    }
                  }} 
                  className="w-full border border-border rounded px-2 py-1 text-sm font-medium"
                >
                  <option value={1}>1 - NF-e normal</option>
                  <option value={4}>4 - NF-e de devolução ou retorno</option>
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground font-medium">Tipo Emissão</label>
                <select disabled={ro} value={record.tp_emis ?? 1} onChange={e => setField("tp_emis" as any, Number(e.target.value) as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value={1}>1 - Normal</option>
                  <option value={2}>2 - Contingência FS-IA</option>
                  <option value={4}>4 - Contingência EPEC</option>
                  <option value={9}>9 - Contingência off-line NFC-e</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12">
                <label className="text-xs text-muted-foreground font-medium">Cliente/Fornecedor <span className="text-destructive">*</span></label>
                <div className="flex gap-1">
                  <input
                    ref={destinatarioInputRef}
                    readOnly={!isEditing}
                    value={record.cadastro_id ? (XClienteCache[record.cadastro_id]?.razao || `#${XClienteCache[record.cadastro_id]?.cd_cadastro ?? record.cadastro_id}`) : ""}
                    placeholder="Pressione Enter para pesquisar cliente ou fornecedor..."
                    className="flex-1 border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none cursor-pointer"
                    data-lookup="true"
                    data-required="true"
                    data-lookup-key="destinatario"
                    onKeyDown={async (e) => {
                      if (!isEditing) return;
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!record.cadastro_id) {
                          handleSearchDestinatario(record, setField);
                        } else {
                          await handleSaveAndGoToItens(onSalvar, setInnerTab);
                        }
                      }
                    }}
                  />
                  {isEditing && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleSearchDestinatario(record, setField)}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent"
                      title="Pesquisar cliente ou fornecedor"
                      data-lookup-trigger="true"
                      data-lookup-key="destinatario"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  )}
                  {record.cadastro_id && isEditing && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setField("cadastro_id", null as any)}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                      title="Limpar"
                    >×</button>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-border rounded p-3 bg-card">
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide font-bold">Totais da Nota Fiscal</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
                {[
                  { label: "Produtos", key: "vl_produto" },
                  { label: "Desconto", key: "vl_desconto" },
                  { label: "Frete",    key: "vl_frete"    },
                  { label: "Seguro",   key: "vl_seguro"   },
                  { label: "Despesa",  key: "vl_despesa"  },
                  { label: "Outros",   key: "vl_outro"    },
                  { label: "Base Cálc.", key: "vl_bc"     },
                  { label: "ICMS",     key: "vl_icms"     },
                  { label: "ICMS Deson.", key: "vl_icms_deson" },
                  { label: "ICMS-ST",  key: "vl_icms_st"  },
                  { label: "FCP",      key: "vl_fcp"      },
                  { label: "FCP-ST",   key: "vl_fcp_st"   },
                  { label: "FCP-ST Ret.", key: "vl_fcp_st_ret" },
                  { label: "IPI",      key: "vl_ipi"      },
                  { label: "IPI Devol.", key: "vl_ipi_devol" },
                  { label: "II",       key: "vl_ii"       },
                  { label: "PIS",      key: "vl_pis"      },
                  { label: "COFINS",   key: "vl_cofins"   },
                  { label: "IBS",      key: "vl_ibs"      },
                  { label: "CBS",      key: "vl_cbs"      },
                  { label: "IS",       key: "vl_is"       },
                ].map(f => (
                  <div key={f.key} className="flex flex-col gap-1">
                    <label className="text-[10px] text-muted-foreground uppercase font-semibold">{f.label}</label>
                    <input
                      type="text"
                      readOnly={ro}
                      value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                      onBlur={() => handleBlur(f.key, record, setField)}
                      onChange={e => {
                        const val = formatNumericInput(e.target.value, 2);
                        setField(f.key as any, val as any);
                      }}
                      className={`w-full border border-border rounded px-2 py-1.5 text-xs text-right font-mono ${ro ? "bg-secondary/50" : "bg-card"}`}
                    />
                  </div>
                ))}
                <div className="col-span-2 lg:col-span-1 flex flex-col justify-end">
                  <label className="text-xs font-black text-primary uppercase">TOTAL NOTA</label>
                  <input
                    readOnly
                    value={fmt2(Number(record.vl_total_nf || 0))}
                    className="w-full border-2 border-primary/40 rounded px-2 py-1.5 text-sm font-black text-right bg-primary/10 text-primary font-mono shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    />
      <ClienteSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        empresaId={XEmpresaId}
        tipo="todos"
        titulo="Pesquisar Cliente / Fornecedor"
        onSelect={(c) => XSearchTarget?.(c)}
      />

      <FiscalProgressDialog
        open={XProg.open}
        titulo={XProg.titulo}
        descricao="Aguardando assinatura digital, transmissão e autorização da SEFAZ via Fiscal Worker."
        segundosTotais={XProg.total}
        segundosRestantes={XProg.restante}
      />

      <Dialog open={XSefazErroModal.open} onOpenChange={open => setXSefazErroModal(p => ({ ...p, open }))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Retorno SEFAZ / Rejeição
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            {XSefazErroModal.cStat && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs uppercase px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                  Status SEFAZ: {XSefazErroModal.cStat}
                </span>
              </div>
            )}
            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-md text-destructive font-mono text-xs whitespace-pre-wrap leading-relaxed">
              {XSefazErroModal.motivo}
            </div>
            {XSefazErroModal.detalhe && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs leading-relaxed">
                <strong className="block mb-1">Como resolver:</strong>
                {XSefazErroModal.detalhe}
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setXSefazErroModal(p => ({ ...p, open: false }))}
              className="px-4 py-2 text-xs font-bold bg-secondary rounded hover:bg-secondary/80"
            >
              FECHAR
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OutrasNotasForm;
