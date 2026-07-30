import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Search, ArrowLeft, ArrowRight, RotateCcw, Check, FileText, Package, Send } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";

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
  origem_item: any; // raw row
}

const CFOP_DEVOLUCAO_MAP: Record<string, string> = {
  "1102": "5202", "1101": "5201", "1403": "5411", "1556": "5556",
  "2102": "6202", "2101": "6201", "2403": "6411", "2556": "6556",
};

const cfopDevolucaoSugerido = (cfopEntrada: string): string => {
  if (!cfopEntrada) return "5202";
  if (CFOP_DEVOLUCAO_MAP[cfopEntrada]) return CFOP_DEVOLUCAO_MAP[cfopEntrada];
  // Heurística: 1xxx -> 5xxx (UF), 2xxx -> 6xxx (outra UF)
  const first = cfopEntrada[0];
  if (first === "1") return "5" + cfopEntrada.substring(1);
  if (first === "2") return "6" + cfopEntrada.substring(1);
  return "5202";
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

interface DevolucaoNfeEntradaFormProps {
  initialNfeId?: number;
}

const DevolucaoNfeEntradaForm: React.FC<DevolucaoNfeEntradaFormProps> = ({ initialNfeId }) => {
  const { XEmpresaId, openTab } = useAppContext();
  const [XStep, setXStep] = useState<1 | 2 | 3>(1);

  // Step 1 — Pesquisa NF-e origem
  const [XBusca, setXBusca] = useState("");
  const [XDtIni, setXDtIni] = useState(new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().substring(0, 10));
  const [XDtFim, setXDtFim] = useState(new Date().toISOString().substring(0, 10));
  const [XLoading, setXLoading] = useState(false);
  const [XResultados, setXResultados] = useState<any[]>([]);
  const [XSelecionada, setXSelecionada] = useState<any | null>(null);

  // Step 2 — Itens
  const [XDepositos, setXDepositos] = useState<{ deposito_id: number; nome: string }[]>([]);
  const [XDepositoId, setXDepositoId] = useState<number | null>(null);
  const [XItens, setXItens] = useState<IItemDevolucao[]>([]);
  const [XNatOp, setXNatOp] = useState("Devolução de Mercadoria");
  const [XGerando, setXGerando] = useState(false);
  const [XNovoNfeId, setXNovoNfeId] = useState<number | null>(null);

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
  }, [XEmpresaId]);

  // ------- Etapa 1
  const buscarNotas = async () => {
    setXLoading(true);
    setXResultados([]);
    try {
      let q = db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id,nr_nota,serie,dt_emissao,dt_entrada,vl_total_nf,chave_nfe,cadastro_id,st_nf,modelo,tp_nf,cadastro:cadastro_id(razao_social,cnpj)")
        .eq("empresa_id", XEmpresaId)
        .eq("tp_nf", 0)
        .eq("excluido", false)
        .gte("dt_emissao", XDtIni)
        .lte("dt_emissao", XDtFim)
        .order("dt_emissao", { ascending: false })
        .limit(200);
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

  useEffect(() => {
    if (XStep === 1 && XEmpresaId && !initialNfeId) buscarNotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [XStep, XEmpresaId]);

  // Pré-carregamento via prop
  useEffect(() => {
    if (!initialNfeId || !XEmpresaId) return;
    (async () => {
      const { data, error } = await db.from("fiscal_nfe_cabecalho")
        .select("nfe_cabecalho_id,nr_nota,serie,dt_emissao,dt_entrada,vl_total_nf,chave_nfe,cadastro_id,st_nf,modelo,tp_nf,cadastro:cadastro_id(razao_social,cnpj)")
        .eq("nfe_cabecalho_id", initialNfeId)
        .maybeSingle();
      if (error || !data) { toast.error("NF-e de origem não encontrada."); return; }
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

      const itensSemCfopEntrada = (itens || []).filter((it: any) => !it.cfop_entrada);
      if (itensSemCfopEntrada.length > 0) {
        const itensStr = itensSemCfopEntrada.map((it: any) => `#${it.nr_item} (${it.nm_produto || "Sem Descrição"})`).join(", ");
        toast.error(`Não é possível realizar a devolução. O(s) item(ns) ${itensStr} está(ão) sem CFOP de entrada informado na nota de origem.`);
        return;
      }

      // Query database for cfop_correspondente of the items' CFOPs
      const uniqueCfops = Array.from(new Set((itens || []).map((it: any) => it.cfop_entrada).filter(Boolean))) as string[];
      let cfopMap: Record<string, string> = {};
      let missingCfops: string[] = [];
      
      if (uniqueCfops.length > 0) {
        const { data: cfopData } = await db.from("cfop")
          .select("cd_cfop, cfop_correspondente")
          .in("cd_cfop", uniqueCfops)
          .eq("excluido", false);
          
        const foundCfops = new Map<string, string>();
        if (cfopData) {
          cfopData.forEach((row: any) => {
            if (row.cfop_correspondente) {
              foundCfops.set(row.cd_cfop, row.cfop_correspondente);
              cfopMap[row.cd_cfop] = row.cfop_correspondente;
            }
          });
        }
        
        uniqueCfops.forEach(cfop => {
          if (!foundCfops.has(cfop)) {
            missingCfops.push(cfop);
          }
        });
      }

      if (missingCfops.length > 0) {
        toast.error(`Não é possível realizar a devolução. O(s) CFOP(s): ${missingCfops.join(", ")} não possui(em) CFOP correspondente cadastrado. Por favor, acesse a tela de cadastro de CFOP e configure-os.`);
        return;
      }

      const list: IItemDevolucao[] = (itens || []).map((it: any) => {
        const cfopKey = it.cfop_entrada;
        return {
          nfe_item_id: it.nfe_item_id,
          produto_id: it.produto_id,
          cd_produto: it.cd_prod_fornec || (it.produto_id ? String(it.produto_id) : ""),
          nm_produto: it.nm_produto || "",
          unidade: it.unidade || "UN",
          qt_origem: Number(it.qt_entrada || 0),
          qt_devolver: 0,
          vl_unit: Number(it.vl_unit || 0),
          vl_total_origem: Number(it.vl_total || 0),
          cfop_origem: cfopKey,
          cfop_devolucao: cfopMap[cfopKey] || cfopDevolucaoSugerido(cfopKey),
          ncm: it.ncm || "",
          gtin: it.gtin || "",
          origem_item: it,
        };
      });
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

  const totalDevolucao = useMemo(
    () => XItens.reduce((s, it) => s + it.qt_devolver * it.vl_unit, 0),
    [XItens]
  );

  // ------- Etapa 3 - gerar NF-e devolução
  const gerarDevolucao = async () => {
    const itensValidos = XItens.filter(it => it.qt_devolver > 0);
    if (!itensValidos.length) { toast.error("Informe a quantidade a devolver em pelo menos 1 item."); return; }
    if (!XDepositoId) { toast.error("Selecione o depósito."); return; }
    if (!XSelecionada?.cadastro_id) { toast.error("NF-e de origem sem fornecedor."); return; }
    if (!confirm(`Confirma a geração da NF-e de DEVOLUÇÃO para ${itensValidos.length} item(s) — Total R$ ${totalDevolucao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}?`)) return;

    setXGerando(true);
    try {
      const obs = `Devolução referente à NF-e nº ${XSelecionada.nr_nota}/${XSelecionada.serie} — Chave: ${XSelecionada.chave_nfe || "-"}`;
      const vlProduto = itensValidos.reduce((s, it) => s + it.qt_devolver * it.vl_unit, 0);

      // Calcular rateio proporcional dos impostos e despesas
      let sumBc = 0;
      let sumIcms = 0;
      let sumIcmsSt = 0;
      let sumBcSt = 0;
      let sumIpi = 0;
      let sumPis = 0;
      let sumCofins = 0;
      let sumIbs = 0;
      let sumCbs = 0;
      let sumIs = 0;
      let sumDesconto = 0;
      let sumFrete = 0;
      let sumSeguro = 0;
      let sumOutro = 0;

      itensValidos.forEach(it => {
        const o = it.origem_item;
        const fator = it.qt_devolver / Math.max(1e-9, it.qt_origem);
        sumBc += Number(o.vl_bc || 0) * fator;
        sumIcms += Number(o.vl_icms || 0) * fator;
        sumIcmsSt += Number(o.vl_icms_st || 0) * fator;
        sumBcSt += Number(o.vl_bc_st || 0) * fator;
        sumIpi += Number(o.vl_ipi || 0) * fator;
        sumPis += Number(o.vl_pis || 0) * fator;
        sumCofins += Number(o.vl_cofins || 0) * fator;
        sumIbs += Number(o.vl_ibs || 0) * fator;
        sumCbs += Number(o.vl_cbs || 0) * fator;
        sumIs += Number(o.vl_is || 0) * fator;
        sumDesconto += Number(o.vl_desconto || 0) * fator;
        sumFrete += Number(o.vl_frete || 0) * fator;
        sumSeguro += Number(o.vl_seguro || 0) * fator;
        sumOutro += Number(o.vl_outro || 0) * fator;
      });

      const vlTotalNf = vlProduto + sumIpi + sumIcmsSt + sumFrete + sumSeguro + sumOutro - sumDesconto;

      const { data: novo, error: eCab } = await db.from("fiscal_nfe_cabecalho").insert({
        empresa_id: XEmpresaId,
        cadastro_id: XSelecionada.cadastro_id,
        deposito_id: XDepositoId,
        origem_inclusao: "M",
        st_nf: "A",
        tp_nf: 1,           // saída
        fin_nfe: 4,         // devolução
        tp_emis: 1,
        modelo: XSelecionada.modelo || "55",
        nat_op: XNatOp,
        nr_nota: "",
        serie: XSelecionada.serie || "1",
        chave_nfe: "",
        nr_protocolo: "",
        dt_emissao: new Date().toISOString().substring(0, 10),
        dt_saida: new Date().toISOString().substring(0, 10),
        vl_produto: vlProduto,
        vl_desconto: sumDesconto, 
        vl_frete: sumFrete, 
        vl_seguro: sumSeguro, 
        vl_despesa: 0, 
        vl_outro: sumOutro,
        vl_ipi: sumIpi, 
        vl_icms: sumIcms, 
        vl_icms_st: sumIcmsSt, 
        vl_pis: sumPis, 
        vl_cofins: sumCofins,
        vl_ibs: sumIbs, 
        vl_cbs: sumCbs, 
        vl_is: sumIs, 
        vl_bc: sumBc,
        vl_total_nf: vlTotalNf,
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
        const fator = it.qt_devolver / Math.max(1e-9, it.qt_origem);
        return {
          nfe_cabecalho_id: novoId,
          empresa_id: XEmpresaId,
          produto_id: it.produto_id,
          nr_item: idx + 1,
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
          vl_total: Number(o.vl_total || 0) * fator,
          vl_desconto: Number(o.vl_desconto || 0) * fator,
          vl_frete: Number(o.vl_frete || 0) * fator,
          vl_seguro: Number(o.vl_seguro || 0) * fator,
          vl_outro: Number(o.vl_outro || 0) * fator,
          
          // impostos e bases de cálculo rateados proporcionalmente
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
          
          vl_bc_pis: Number(o.vl_bc_pis || o.vl_bc || 0) * fator,
          vl_bc_cofins: Number(o.vl_bc_cofins || o.vl_bc || 0) * fator,
          vl_bc_ipi: Number(o.vl_bc_ipi || o.vl_bc || 0) * fator,
          vl_cred_sn: Number(o.vl_cred_sn || 0) * fator,
          vl_fcp: Number(o.vl_fcp || 0) * fator,
          vl_icms_deson: Number(o.vl_icms_deson || 0) * fator,
          
          mod_bc: o.mod_bc,
          mod_bc_st: o.mod_bc_st,
          pc_red_bc: Number(o.pc_red_bc || 0),
          pc_red_bc_st: Number(o.pc_red_bc_st || 0),
          pc_cred_sn: Number(o.pc_cred_sn || 0),
          pc_fcp: Number(o.pc_fcp || 0),
          
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
          cst_pis: o.cst_pis || "",
          cst_cofins: o.cst_cofins || "",
          cst_ibs: o.cst_ibs || "",
          cst_cbs: o.cst_cbs || "",
          cst_is: o.cst_is || "",
          excluido: false,
        };
      });

      const { error: eIt } = await db.from("fiscal_nfe_item").insert(itensPayload);
      if (eIt) throw eIt;

      setXNovoNfeId(novoId);
      setXStep(3);
      toast.success(`NF-e de devolução gerada (ID #${novoId}). Abrindo formulário...`);
      // Abre automaticamente a NF-e gerada já populada, pronta para transmissão
      setTimeout(() => {
        openTab({ title: `Devolução NF-e #${novoId}`, component: "nfe-form", params: { nfe_cabecalho_id: novoId } });
      }, 300);
    } catch (e: any) {
      toast.error("Falha ao gerar devolução: " + e.message);
    } finally {
      setXGerando(false);
    }
  };

  const abrirNotaGerada = () => {
    if (!XNovoNfeId) return;
    openTab({ title: `Devolução NF-e #${XNovoNfeId}`, component: "nfe-form", params: { nfe_cabecalho_id: XNovoNfeId } });
  };

  const reiniciar = () => {
    setXStep(1); setXBusca(""); setXSelecionada(null); setXItens([]); setXNovoNfeId(null);
  };

  // ---------- UI ----------
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
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary"><RotateCcw className="w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">Devolução de Notas Fiscais de Entrada</h2>
            <p className="text-xs text-muted-foreground">Assistente em 3 etapas — gera NF-e de devolução de compra</p>
          </div>
        </div>
        <button onClick={reiniciar} className="text-xs font-bold px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors">
          REINICIAR
        </button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 bg-card p-3 rounded-xl border border-border shadow-sm">
        <StepBadge n={1} label="Selecionar NF-e Origem" icon={<FileText className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={2} label="Itens a Devolver" icon={<Package className="w-3.5 h-3.5" />} />
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <StepBadge n={3} label="Conferir e Enviar" icon={<Send className="w-3.5 h-3.5" />} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 bg-card rounded-xl border border-border shadow-sm overflow-hidden p-4 flex flex-col">
        {XStep === 1 && (
          <div className="flex flex-col gap-3 h-full">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={XBusca}
                  onChange={e => setXBusca(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && buscarNotas()}
                  placeholder="Nº da nota ou parte da chave de acesso..."
                  className="w-full pl-9 pr-3 py-2 border border-border rounded-md text-sm bg-background"
                />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Início</label>
                <input type="date" value={XDtIni} onChange={e => setXDtIni(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded-md bg-background" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Fim</label>
                <input type="date" value={XDtFim} onChange={e => setXDtFim(e.target.value)} className="px-2 py-1.5 text-sm border border-border rounded-md bg-background" />
              </div>
              <button onClick={buscarNotas} disabled={XLoading} className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-bold hover:opacity-90 disabled:opacity-50">
                {XLoading ? "BUSCANDO..." : "BUSCAR"}
              </button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-1">Nota</div>
                <div className="col-span-1 text-center">Série</div>
                <div className="col-span-2">Emissão</div>
                <div className="col-span-5">Fornecedor</div>
                <div className="col-span-1 text-center">Status</div>
                <div className="col-span-2 text-right">Valor</div>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {XLoading && <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Carregando...</div>}
                {!XLoading && XResultados.length === 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground italic">Nenhuma NF-e de entrada localizada no período.</div>
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
                    <div className="col-span-1 text-center text-[10px] font-bold uppercase">{r.st_nf}</div>
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
            {/* Resumo da origem + parâmetros */}
            <div className="grid grid-cols-12 gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="col-span-2">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">NF-e Origem</label>
                <div className="text-sm font-bold">{XSelecionada.nr_nota}/{XSelecionada.serie}</div>
              </div>
              <div className="col-span-5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Fornecedor</label>
                <div className="text-sm truncate">{XSelecionada.cadastro?.razao_social}</div>
              </div>
              <div className="col-span-3">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Depósito (saída) <span className="text-destructive">*</span></label>
                <select value={XDepositoId ?? ""} onChange={e => setXDepositoId(e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1.5 border border-border rounded-md text-sm bg-background">
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

            {/* Grid itens */}
            <div className="border border-border rounded-lg overflow-hidden flex-1 flex flex-col">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b">
                <div className="col-span-1">Cód.</div>
                <div className="col-span-4">Descrição</div>
                <div className="col-span-1 text-center">Und</div>
                <div className="col-span-1 text-right">Qt. Origem</div>
                <div className="col-span-2 text-right">Qt. a Devolver</div>
                <div className="col-span-1 text-center">CFOP Orig.</div>
                <div className="col-span-1 text-center">CFOP Dev.</div>
                <div className="col-span-1 text-right">Vl. Unit.</div>
              </div>
              <div className="overflow-y-auto flex-1">
                {XItens.map((it, idx) => (
                  <div key={it.nfe_item_id} className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b last:border-0 ${idx % 2 ? "bg-muted/20" : ""}`}>
                    <div className="col-span-1 font-mono text-xs truncate">{it.cd_produto}</div>
                    <div className="col-span-4 truncate text-xs text-blue-800 dark:text-blue-300 font-medium">{it.nm_produto}</div>
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
                    <div className="col-span-1 text-center font-mono text-xs">{it.cfop_origem}</div>
                    <div className="col-span-1 text-center">
                      <input value={it.cfop_devolucao} onChange={e => setCfop(idx, e.target.value)} className="w-full text-center px-1 py-1 text-xs border border-border rounded font-mono" />
                    </div>
                    <div className="col-span-1 text-right font-mono text-xs">{it.vl_unit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setXStep(1)} className="flex items-center gap-1 px-3 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80">
                <ArrowLeft className="w-3.5 h-3.5" /> VOLTAR
              </button>
              <button onClick={gerarDevolucao} disabled={XGerando} className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 shadow-sm">
                {XGerando ? "GERANDO..." : <>GERAR NF-e DE DEVOLUÇÃO <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        )}

        {XStep === 3 && XNovoNfeId && (
          <div className="flex flex-col items-center justify-center gap-4 h-full text-center">
            <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
              <Check className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold">NF-e de devolução criada com sucesso</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              A nota foi aberta em uma nova aba, pronta para conferência e <span className="font-bold">envio à SEFAZ</span> através do botão <span className="font-bold">"Enviar SEFAZ"</span> na barra de ferramentas.
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={reiniciar} className="px-4 py-2 text-xs font-bold bg-secondary rounded-md hover:bg-secondary/80">
                NOVA DEVOLUÇÃO
              </button>
              <button onClick={abrirNotaGerada} className="flex items-center gap-1 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 shadow-sm">
                ABRIR NF-e GERADA <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevolucaoNfeEntradaForm;
