import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import NfeXmlImporter from "./NfeXmlImporter";
import NfeItensTab from "./NfeItensTab";
import FornecedorCheckDialog from "./FornecedorCheckDialog";
import type { INfeCabecalho, INfeDadosXml, INfeXmlItem, TNfeSt, INfeXmlEmitente } from "./types";
import { NFE_ST_LABELS } from "./types";
import { Search, ClipboardCheck, Activity, Upload, RotateCcw, Trash2 } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { provedorService } from "@/services/provedorService";
import { formatCPFCNPJ } from "@/lib/validators";
import { setPendingSupplier } from "@/utils/nfePendingStore";
import { parseNfeXml } from "./NfeXmlParser";
import type { TFormMode } from "@/hooks/useCrudController";

const db = supabase as any;

interface IFornecedorInfo { id: number; cnpj: string; razao: string; cd_cadastro?: number | null; }

const getStatusLabel = (st: string) => {
  if (st === "E") return "Escriturado";
  if (st === "P") return "Pendente";
  if (st === "A") return "Aberto";
  return NFE_ST_LABELS[st as TNfeSt] || st;
};

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "Nº", width: "70px", align: "right" },
  { key: "nr_nota",   label: "Nota",    width: "100px" },
  { key: "serie",     label: "Série",   width: "60px", align: "center" },
  { key: "dt_entrada",label: "Entrada", width: "110px", render: r => r.dt_entrada ? new Date(r.dt_entrada).toLocaleDateString("pt-BR") : "" },
  { key: "_forn",     label: "Fornecedor", width: "2fr", getValue: (r: any) => r._forn_razao || "", render: (r: any) => r._forn_razao || (r.cadastro_id ? `#${r.cadastro_id}` : "") },
  { key: "st_nf",     label: "Status",  width: "110px", render: r => getStatusLabel(r.st_nf) },
  { key: "vl_total_nf",label: "Total",  width: "120px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
];

const XDefault: Partial<INfeCabecalho> = {
  origem_inclusao: "M", st_nf: "P",
  tp_nf: 0, fin_nfe: 1, tp_emis: 1, modelo: "55", nat_op: "Entrada de Mercadoria",
  nr_nota: "", serie: "1", chave_nfe: "", nr_protocolo: "",
  vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_seguro: 0,
  vl_despesa: 0, vl_ipi: 0, vl_icms: 0, vl_icms_st: 0,
  vl_pis: 0, vl_cofins: 0, vl_ibs: 0, vl_cbs: 0, vl_is: 0,
  vl_total_nf: 0,
  obs_nf: "",
  obs_fisco: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_entrada: new Date().toISOString().substring(0, 10),
};

const salvarVinculoProdutoFornecedor = async (
  empresaId: number,
  cadastroId: number,
  produtoId: number,
  cdProdFornec: string,
  nmProdFornec: string,
  fatorConversao: number
) => {
  if (!produtoId || !cdProdFornec || !cadastroId) return;
  const { data: existing } = await db.from("produto_fornecedor")
    .select("produto_fornecedor_id")
    .eq("empresa_id", empresaId)
    .eq("cadastro_id", cadastroId)
    .eq("cd_prod_fornec", cdProdFornec)
    .eq("excluido", false)
    .maybeSingle();

  if (existing) {
    await db.from("produto_fornecedor").update({
      produto_id: produtoId,
      nm_prod_fornec: nmProdFornec || "",
      fator_conversao: fatorConversao,
      updated_at: new Date().toISOString(),
    }).eq("produto_fornecedor_id", existing.produto_fornecedor_id);
  } else {
    await db.from("produto_fornecedor").insert({
      empresa_id:     empresaId,
      produto_id:     produtoId,
      cadastro_id:    cadastroId,
      cd_prod_fornec: cdProdFornec,
      nm_prod_fornec: nmProdFornec || "",
      fator_conversao: fatorConversao,
      excluido:       false,
    });
  }
};

interface NfeTotalsCardProps {
  record: any;
  ro: boolean;
  setField: any;
  handleBlur: any;
  fmt2: any;
  fmtInput: any;
  XXmlItens: INfeXmlItem[];
}

const NfeTotalsCard: React.FC<NfeTotalsCardProps> = ({
  record,
  ro,
  setField,
  handleBlur,
  fmt2,
  fmtInput,
  XXmlItens,
}) => {
  const [XQtItens, setXQtItens] = useState(0);
  const cabId = record?.nfe_cabecalho_id || null;

  useEffect(() => {
    const loadQtItens = async () => {
      if (!cabId) {
        setXQtItens(XXmlItens.length);
        return;
      }
      try {
        const { count, error } = await supabase.from("fiscal_nfe_item")
          .select("*", { count: "exact", head: true })
          .eq("nfe_cabecalho_id", cabId)
          .eq("excluido", false);
        if (!error) {
          setXQtItens(count || 0);
        }
      } catch (e) {
        console.warn("Erro ao carregar quantidade de itens:", e);
      }
    };
    loadQtItens();
  }, [cabId, XXmlItens]);

  return (
    <div className="border border-border rounded-xl p-4 bg-card shadow-sm space-y-4">
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Totais da Nota
        </p>

        {/* Linha 1: Qtd Itens, Descontos, Custos e Total dos Produtos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end mb-4 pb-4 border-b border-border/50">
          <div className="flex flex-col">
            <label className="text-xs text-muted-foreground font-medium mb-1">Qtd. Itens</label>
            <input
              type="text"
              readOnly
              value={XQtItens}
              className="w-full border border-border rounded px-2.5 py-1.5 text-sm text-right bg-secondary font-semibold outline-none"
            />
          </div>
          {[
            { label: "Desconto",     key: "vl_desconto" },
            { label: "Frete",        key: "vl_frete"    },
            { label: "Seguro",       key: "vl_seguro"   },
            { label: "Despesa",      key: "vl_despesa"  },
          ].map(f => (
            <div key={f.key} className="flex flex-col">
              <label className="text-xs text-muted-foreground font-medium mb-1">{f.label}</label>
              <input
                type="text"
                readOnly={ro}
                value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                onBlur={() => handleBlur(f.key, record, setField)}
                onChange={e => {
                  const val = e.target.value.replace(/\./g, "").replace(",", ".");
                  setField(f.key as any, val);
                }}
                className={`w-full border border-border rounded px-2.5 py-1.5 text-sm text-right outline-none transition-colors focus:border-primary ${ro ? "bg-secondary text-muted-foreground" : "bg-card"}`}
              />
            </div>
          ))}
          <div className="flex flex-col justify-end">
            <label className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Total Produtos</label>
            <input
              type="text"
              readOnly
              value={fmt2(Number(record.vl_produto || 0))}
              className="w-full border border-primary/20 rounded px-2.5 py-1.5 text-sm font-bold text-right bg-primary/5 text-primary outline-none"
            />
          </div>
        </div>

        {/* Linha 2: Impostos e Total da Nota */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-3 items-end">
          {[
            { label: "ICMS",         key: "vl_icms"     },
            { label: "ICMS-ST",      key: "vl_icms_st"  },
            { label: "IPI",          key: "vl_ipi"      },
            { label: "PIS",          key: "vl_pis"      },
            { label: "COFINS",       key: "vl_cofins"   },
            { label: "IBS",          key: "vl_ibs"      },
            { label: "CBS",          key: "vl_cbs"      },
            { label: "IS",           key: "vl_is"       },
          ].map(f => (
            <div key={f.key} className="flex flex-col">
              <label className="text-xs text-muted-foreground font-medium mb-1">{f.label}</label>
              <input
                type="text"
                readOnly={ro}
                value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                onBlur={() => handleBlur(f.key, record, setField)}
                onChange={e => {
                  const val = e.target.value.replace(/\./g, "").replace(",", ".");
                  setField(f.key as any, val);
                }}
                className={`w-full border border-border rounded px-2.5 py-1.5 text-sm text-right outline-none transition-colors focus:border-primary ${ro ? "bg-secondary text-muted-foreground" : "bg-card"}`}
              />
            </div>
          ))}
          <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
            <label className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-1">Total Nota</label>
            <input
              readOnly
              value={fmt2(Number(record.vl_total_nf || 0))}
              className="w-full border border-emerald-500/20 rounded px-2.5 py-1.5 text-sm font-bold text-right bg-emerald-500/5 text-emerald-600 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface NotaFiscalEntradaFormProps {
  initialMode?: TFormMode;
}

const NotaFiscalEntradaForm: React.FC<NotaFiscalEntradaFormProps> = ({ initialMode }) => {
  const { XEmpresaId, XEmpresaMatrizId, openTab, closeTab, XTabs } = useAppContext();



  // Lookups
  const [XFornCache, setXFornCache]       = useState<Record<number, IFornecedorInfo>>({});
  const [XDepositos, setXDepositos]        = useState<{ deposito_id: number; nome: string }[]>([]);
  const XFornCacheRef = useRef<Record<number, IFornecedorInfo>>(XFornCache);
  useEffect(() => { XFornCacheRef.current = XFornCache; }, [XFornCache]);

  // XML import state
  const [XDadosXml, setXDadosXml]           = useState<INfeDadosXml | null>(null);
  const [XFornDialog, setXFornDialog]        = useState(false);
  const [XFornEmit, setXFornEmit]            = useState<INfeXmlEmitente | null>(null);
  const [XProdListOpen, setXProdListOpen]    = useState(false);
  const [XProdItens, setXProdItens]          = useState<INfeXmlItem[]>([]);
  const [XCadastroIdXml, setXCadastroIdXml]  = useState<number | null>(null);
  // Callback para aplicar vínculos após confirmação do lote
  const XPendingSetRecord  = useRef<((r: any) => void) | null>(null);
  const XPendingXmlDados   = useRef<INfeDadosXml | null>(null);
  // Itens prontos para inserção no fiscal_nfe_item após salvar o cabeçalho
  const [XXmlItens, setXXmlItens] = useState<INfeXmlItem[]>([]);

  const handleConsultarSefaz = async () => {
    try {
      const resp = await provedorService.consultarStatus(XEmpresaId);
      alert(resp);
    } catch (e) {
      // Erro já tratado no serviço
    }
  };

  // Misc
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const XItemsRef = useRef<any[]>([]);

  useEffect(() => {
    const loadDeps = async () => {
      if (!XEmpresaId) return;
      const { data } = await db.from("deposito").select("deposito_id,nome")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false).order("nome");
      setXDepositos(data || []);
    };
    loadDeps();
  }, [XEmpresaId]);

  const ensureFornInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XFornCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("cadastro")
      .select("cadastro_id,cd_cadastro,cnpj,razao_social")
      .in("cadastro_id", faltando);
    if (data) {
      setXFornCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cd_cadastro: c.cd_cadastro, cnpj: c.cnpj || "", razao: c.razao_social || "" };
        }
        return next;
      });
    }
  }, []);

  // ── Escrituração ─────────────────────────────────────────────
  const escriturar = useCallback(async (cabId: number, depositoId: number | null, rec: INfeCabecalho, setRecord?: any) => {
    if (!depositoId) { toast.error("Selecione o Depósito antes de escriturar."); return; }
    if (!confirm("Confirma a escrituração desta NF-e? O estoque e custos dos produtos serão atualizados.")) return;

    const { data: itens } = await db.from("fiscal_nfe_item")
      .select("*").eq("nfe_cabecalho_id", cabId).eq("excluido", false);

    for (const item of (itens || [])) {
      if (!item.produto_id) continue;
      // Busca fator de conversão cadastrado para este item do fornecedor
      const { data: vinculo } = await db.from("produto_fornecedor")
        .select("fator_conversao")
        .eq("empresa_id", XEmpresaId)
        .eq("produto_id", item.produto_id)
        .eq("cadastro_id", rec.cadastro_id)
        .maybeSingle();
      const fator = Number(vinculo?.fator_conversao || 1);
      const qtEstoque = Number(item.qt_entrada || 0) * fator;

      // Garantir que existe o registro mestre na tabela estoque com saldo zero
      const { data: est } = await db.from("estoque")
        .select("estoque_id")
        .eq("produto_id", item.produto_id)
        .eq("deposito_id", depositoId)
        .eq("excluido", false)
        .maybeSingle();

      if (!est) {
        await db.from("estoque").insert({
          produto_id: item.produto_id,
          empresa_id: XEmpresaId,
          deposito_id: depositoId,
          estoque_fisico: 0,
          estoque_reservado: 0,
          estoque_minimo: 0,
          estoque_padrao: 0,
        });
      }

      // Gravar a movimentação no estoque_log, acionando a trigger que atualiza o estoque físico
      await db.from("estoque_log").insert({
        empresa_id: XEmpresaId,
        produto_id: item.produto_id,
        deposito_id: depositoId,
        qt_movimento: qtEstoque,
        usuario: null, // Deixa a trigger capturar via claims do JWT ou assume o padrão 'SISTEMA'
        operacao: "ENTRADA",
        origem: "NOTA_FISCAL_ENTRADA",
        nr_doc: String(rec.nr_nota || ""),
      });

      // Atualiza custos e impostos do produto
      const vl_compra = Number(item.vl_unit || 0);
      if (vl_compra > 0) {
        await db.from("produto").update({
          vl_compra,
          pc_ipi:    Number(item.pc_ipi || 0),
          vl_ipi:    Number(item.vl_ipi || 0),
          pc_icms_cred: Number(item.pc_icms || 0),
          pc_st_trib:   Number(item.pc_icms_st || 0),
          vl_st:        Number(item.vl_icms_st || 0),
          pc_pis:       Number(item.pc_pis || 0),
          vl_pis:       Number(item.vl_pis || 0),
          pc_cofins:    Number(item.pc_cofins || 0),
          vl_cofins:    Number(item.vl_cofins || 0),
          updated_at: new Date().toISOString(),
        }).eq("produto_id", item.produto_id);
      }
      // Grava vínculo produto_fornecedor (para reconhecimento automático em futuras NF-e)
      if (rec.cadastro_id && item.cd_prod_fornec) {
        await salvarVinculoProdutoFornecedor(
          XEmpresaId,
          rec.cadastro_id,
          item.produto_id,
          item.cd_prod_fornec,
          item.nm_produto || "",
          fator
        );
      }
    }

    await db.from("fiscal_nfe_cabecalho").update({
      st_nf: "E", updated_at: new Date().toISOString(),
    }).eq("nfe_cabecalho_id", cabId);

    if (setRecord) {
      setRecord((prev: any) => ({
        ...prev,
        st_nf: "E"
      }));
    }

    toast.success("NF-e escriturada com sucesso! Estoque e custos atualizados.");
    if (XRefreshRef.current) await XRefreshRef.current();
  }, [XEmpresaId]);

  const estornar = useCallback(async (cabId: number, record: INfeCabecalho, setRecord?: any) => {
    if (record.st_nf !== "E") {
      toast.error("Esta nota fiscal não está escriturada.");
      return;
    }
    if (!confirm(`Deseja realmente estornar a escrituração da NF-e nº ${record.nr_nota}? Esta ação irá reverter a movimentação de estoque dos produtos.`)) return;

    try {
      // 1. Obter itens da nota fiscal
      const { data: itens, error: errItens } = await db.from("fiscal_nfe_item")
        .select("*")
        .eq("nfe_cabecalho_id", cabId)
        .eq("excluido", false);

      if (errItens) throw errItens;
      if (!itens || itens.length === 0) {
        toast.error("Nenhum item encontrado nesta nota fiscal.");
        return;
      }

      // 2. Inserir logs reversos no estoque_log para cada item
      for (const item of itens) {
        if (!item.produto_id || !record.deposito_id) continue;

        // Busca fator de conversão
        const { data: vinculo } = await db.from("produto_fornecedor")
          .select("fator_conversao")
          .eq("empresa_id", XEmpresaId)
          .eq("produto_id", item.produto_id)
          .eq("cadastro_id", record.cadastro_id)
          .maybeSingle();
        const fator = Number(vinculo?.fator_conversao || 1);
        const qtEstoque = Number(item.qt_entrada || 0) * fator;

        // Inserir log reverso no estoque_log (quantidade negativa)
        const { error: errEstoqueLog } = await db.from("estoque_log").insert({
          empresa_id: XEmpresaId,
          produto_id: item.produto_id,
          deposito_id: record.deposito_id,
          qt_movimento: -qtEstoque,
          usuario: null,
          operacao: "ESTORNO",
          origem: "NOTA_FISCAL_ENTRADA",
          nr_doc: String(record.nr_nota || ""),
        });

        if (errEstoqueLog) throw errEstoqueLog;
      }

      // 3. Atualizar status do cabeçalho de volta para "P" (Pendente)
      const { error: errUpdate } = await db.from("fiscal_nfe_cabecalho")
        .update({
          st_nf: "P",
          updated_at: new Date().toISOString()
        })
        .eq("nfe_cabecalho_id", cabId);

      if (errUpdate) throw errUpdate;

      if (setRecord) {
        setRecord((prev: any) => ({
          ...prev,
          st_nf: "P"
        }));
      }

      toast.success("Escrituração estornada com sucesso! Estoque atualizado.");
      if (XRefreshRef.current) await XRefreshRef.current();
    } catch (e: any) {
      toast.error("Erro ao estornar: " + e.message);
    }
  }, [XEmpresaId]);

  // ── Importação XML ────────────────────────────────────────────
  const preencherVinculosAutomaticos = async (cadastroId: number, itens: INfeXmlItem[]) => {
    try {
      const { data: pfList } = await db.from("produto_fornecedor")
        .select("produto_id, cd_prod_fornec")
        .eq("empresa_id", XEmpresaId)
        .eq("cadastro_id", cadastroId)
        .eq("excluido", false);
        
      const map: Record<string, number> = {};
      (pfList || []).forEach((pf: any) => {
        if (pf.cd_prod_fornec) {
          map[pf.cd_prod_fornec] = pf.produto_id;
        }
      });
      
      const prodIds = (pfList || []).map((pf: any) => pf.produto_id).filter(Boolean);
      const { data: prodNames } = prodIds.length > 0
        ? await db.from("produto").select("produto_id, nome, cd_produto").in("produto_id", prodIds)
        : { data: [] };
        
      const nameMap: Record<number, string> = {};
      const codeMap: Record<number, string> = {};
      (prodNames || []).forEach((p: any) => {
        nameMap[p.produto_id] = p.nome;
        codeMap[p.produto_id] = p.cd_produto ? String(p.cd_produto) : "";
      });
      
      return itens.map(item => {
        const pId = map[item.cd_prod_fornec] || null;
        return {
          ...item,
          produto_id: pId,
          _produto_nome: pId ? (nameMap[pId] || `#${pId}`) : null,
          _produto_codigo: pId ? (codeMap[pId] || "") : null
        };
      });
    } catch (e) {
      console.warn("Erro ao preencher vínculos automáticos:", e);
      return itens;
    }
  };

  const processarXmlImportado = useCallback(async (dados: INfeDadosXml, _setField: (k: any, v: any) => void, setRecord: (r: any) => void) => {
    // Valida se o CNPJ do destinatário bate com o CNPJ da empresa logada
    try {
      const { data: empData } = await db
        .from("empresa")
        .select("cnpj")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();

      const empCnpj = empData?.cnpj?.replace(/\D/g, "") || "";
      const destCnpj = dados.destinatario_cnpj?.replace(/\D/g, "") || "";

      if (destCnpj && empCnpj && destCnpj !== empCnpj) {
        toast.error(`Importação de XML bloqueada: Esta NF-e foi destinada ao CNPJ ${formatCPFCNPJ(destCnpj)}, mas a empresa ativa logada possui o CNPJ ${formatCPFCNPJ(empCnpj)}.`);
        return;
      }
    } catch (e: any) {
      console.error("Erro ao validar CNPJ da empresa na importação de XML:", e);
    }

    setXDadosXml(dados);

    // Verifica fornecedor
    const cnpjLimpo = dados.emitente.cnpj.replace(/\D/g, "");
    const { data: fornRows } = await db.from("cadastro")
      .select("cadastro_id,razao_social,cnpj")
      .eq("empresa_id", XEmpresaMatrizId)
      .eq("cnpj", cnpjLimpo)
      .eq("excluido", false)
      .limit(1);

    const cadastroId: number | null = fornRows?.[0]?.cadastro_id || null;

    if (!cadastroId) {
      setXFornEmit(dados.emitente);
      setXFornDialog(true);
      return;
    }

    setXCadastroIdXml(cadastroId);
    setXFornCache(prev => ({ ...prev, [cadastroId]: { id: cadastroId, cnpj: cnpjLimpo, razao: dados.emitente.razao_social } }));

    // Realiza o vínculo de produtos automático a partir da tabela produto_fornecedor
    const itensComVinculos = await preencherVinculosAutomaticos(cadastroId, dados.itens);
    setXXmlItens(itensComVinculos);

    // Aplica os dados do cabeçalho diretamente na tela/formulário sem modais!
    setRecord((prev: any) => ({
      ...prev,
      origem_inclusao: "X",
      tp_nf: 0,
      fin_nfe: dados.fin_nfe || 1,
      tp_emis: 1,
      modelo: "55",
      cadastro_id: cadastroId,
      nr_nota:     dados.nr_nota,
      serie:       dados.serie,
      dt_emissao:  dados.dt_emissao,
      dt_entrada:  new Date().toISOString().substring(0, 10),
      dt_saida:    dados.dt_saida,
      chave_nfe:   dados.chave_nfe,
      nr_protocolo:dados.nr_protocolo,
      vl_produto: dados.vl_produto,
      vl_desconto: dados.vl_desconto,
      vl_frete:    dados.vl_frete,
      vl_seguro:   dados.vl_seguro,
      vl_despesa:  dados.vl_despesa,
      vl_ipi:      dados.vl_ipi,
      vl_icms:     dados.vl_icms || 0,
      vl_icms_st:  dados.vl_icms_st,
      vl_pis:      dados.vl_pis || 0,
      vl_cofins:   dados.vl_cofins || 0,
      vl_ibs:      dados.vl_ibs || 0,
      vl_cbs:      dados.vl_cbs || 0,
      vl_is:       dados.vl_is || 0,
      vl_total_nf: dados.vl_total_nf,
      obs_nf:      dados.obs_nf,
      obs_fisco:   dados.obs_fisco || "",
      xml_nf:      dados.xmlRaw,
    }));

    toast.success(`XML carregado com sucesso: ${dados.itens.length} item(s) importado(s). Verifique os produtos na aba 'Itens da NF-e'.`);
  }, [XEmpresaMatrizId, XEmpresaId]);






  const gridCols = useMemo(() => XGridCols.map(c =>
    c.key === "_forn" ? { 
      ...c, 
      getValue: (r: any) => XFornCache[r.cadastro_id]?.razao || "",
      render: (r: any) => r._forn_razao || (r.cadastro_id ? (XFornCache[r.cadastro_id]?.razao || `#${XFornCache[r.cadastro_id]?.cd_cadastro ?? r.cadastro_id}`) : "")
    } : c
  ), [XFornCache]);

  const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInput = (v: any) => {
    if (v === undefined || v === null || v === "" || v === 0 || v === "0") return "";
    return Number(v).toFixed(2).replace(".", ",");
  };

  const parseNum = (v: any) => {
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const handleBlur = (key: string, record: any, setField: any) => {
    const current = record[key];
    if (current === undefined || current === null || current === "") return;
    const val = parseNum(current);
    setField(key, val.toFixed(2).replace(".", ","));
  };

  return (
    <>
      <StandardCrudForm<INfeCabecalho>
        config={{
          XTableName: "fiscal_nfe_cabecalho",
          XPrimaryKey: "nfe_cabecalho_id",
          XTitle: "Entrada NF-e",
          XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
          XEmpresaId,
          XSelectCols: "*",
          XOrderBy: "nfe_cabecalho_id",
          XSoftDelete: false,
          XInitialMode: initialMode,
          XResetModeOnSelect: true,
          XConfirmDiscardOnSelect: true,
          XApplyFilter: (q) => q.eq("tp_nf", 0).eq("empresa_id", XEmpresaId),
          XCanEdit: (rec) => rec.st_nf !== "E" && rec.st_nf !== "C",
          XOnDelete: async (rec) => {
            if (rec.st_nf !== "P") {
              throw new Error("Somente notas fiscais com status Pendente podem ser excluídas.");
            }
            await db.from("fiscal_nfe_item").delete().eq("nfe_cabecalho_id", rec.nfe_cabecalho_id);
            await db.from("fiscal_nfe_referenciada").delete().eq("nfe_cabecalho_id", rec.nfe_cabecalho_id);
            const { error } = await db.from("fiscal_nfe_cabecalho")
              .delete()
              .eq("nfe_cabecalho_id", rec.nfe_cabecalho_id);
            if (error) throw error;
          },
          XOnAfterLoad: (rows: any[]) => {
            const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
            if (ids.length) ensureFornInfo(ids);
          },
          XOnBeforeSave: (rec) => {
            if (!rec.nr_nota?.trim()) throw new Error("Informe o número da Nota Fiscal.");
            if (!rec.dt_entrada) throw new Error("Informe a Data de Entrada.");
            if (!rec.deposito_id) throw new Error("Informe o Depósito de Entrada.");
            if (rec.chave_nfe) {
              const cleanChave = String(rec.chave_nfe).replace(/\D/g, "");
              if (cleanChave.length > 0 && cleanChave.length !== 44) {
                throw new Error("A Chave de Acesso da NF-e deve conter exatamente 44 dígitos numéricos.");
              }
            }

            const currentItens = XItemsRef.current || [];
            const activeItens = currentItens.length > 0 ? currentItens : XXmlItens;
            for (let i = 0; i < activeItens.length; i++) {
              const item = activeItens[i];
              const lineNum = item.nr_item || (i + 1);
              const label = `Item ${lineNum} (${item.nm_produto || "Sem Descrição"})`;
              if (!item.produto_id) {
                throw new Error(`Validação de Item: O ${label} não possui Produto interno vinculado.`);
              }
              if (!item.cfop_entrada) {
                throw new Error(`Validação de Item: O ${label} não possui CFOP de entrada informado.`);
              }
            }

            return { 
              ...rec, 
              empresa_id: rec.empresa_id || XEmpresaId,
              st_nf: rec.st_nf === "E" ? "E" : "P"
            };
          },
          XOnAfterSave: async (rec: any, mode) => {
            if (mode === "insert" && XXmlItens.length > 0) {
              const cabId = rec.nfe_cabecalho_id;
              const itensParaInserir = XXmlItens;

              // Insere itens no fiscal_nfe_item
              const payloads = itensParaInserir.map((item) => ({
                nfe_cabecalho_id: cabId,
                empresa_id:       XEmpresaId,
                produto_id:       item.produto_id || null,
                cfop_entrada:     item.cfop_entrada || null,
                nr_item:          item.nr_item,
                cd_prod_fornec:   item.cd_prod_fornec,
                nm_produto:       (item.nm_produto || "").toUpperCase(),
                ncm:              item.ncm,
                cfop:             item.cfop,
                unidade:          (item.unidade || "").toUpperCase(),
                gtin:             item.gtin,
                qt_entrada:       Number(item.qt_entrada || 0),
                vl_unit:          Number(item.vl_unit || 0),
                vl_desconto:      Number(item.vl_desconto || 0),
                vl_total:         Number(item.vl_total || 0),
                vl_ipi:           Number(item.vl_ipi || 0),
                pc_ipi:           Number(item.pc_ipi || 0),
                vl_icms_st:       Number(item.vl_icms_st || 0),
                pc_icms_st:       Number(item.pc_icms_st || 0),
                pc_icms:          Number(item.pc_icms || 0),
                vl_icms:          Number(item.vl_icms || 0),
                vl_bc:            Number(item.vl_bc || 0),
                vl_fcp:           Number(item.vl_fcp || 0),
                pc_fcp:           Number(item.pc_fcp || 0),
                vl_cred_sn:       Number(item.vl_cred_sn || 0),
                pc_cred_sn:       Number(item.pc_cred_sn || 0),
                pc_red_bc:        Number(item.pc_red_bc || 0),
                pc_red_bc_st:     Number(item.pc_red_bc_st || 0),
                vl_icms_deson:    Number(item.vl_icms_deson || 0),
                vl_pis:           Number(item.vl_pis || 0),
                pc_pis:           Number(item.pc_pis || 0),
                vl_cofins:        Number(item.vl_cofins || 0),
                pc_cofins:        Number(item.pc_cofins || 0),
                vl_fcp_st:        Number(item.vl_fcp_st || 0),
                pc_fcp_st:        Number(item.pc_fcp_st || 0),
                vl_ibs:           Number(item.vl_ibs || 0),
                pc_ibs:           Number(item.pc_ibs || 0),
                vl_cbs:           Number(item.vl_cbs || 0),
                pc_cbs:           Number(item.pc_cbs || 0),
                vl_is:            Number(item.vl_is || 0),
                pc_is:            Number(item.pc_is || 0),
                cst_icms:         item.cst_icms || "",
                cst_ipi:          item.cst_ipi || "",
                cst_pis:          item.cst_pis || "",
                cst_cofins:       item.cst_cofins || "",
                cst_ibs:          item.cst_ibs || "",
                cst_cbs:          item.cst_cbs || "",
                cst_is:           item.cst_is || "",
                pc_mva:           Number(item.pc_mva || 0),
                vl_bc_st:         Number(item.vl_bc_st || 0),
              }));

              const { error: errItens } = await db.from("fiscal_nfe_item").insert(payloads);
              if (errItens) {
                toast.error("Erro ao gravar itens: " + errItens.message);
              } else {
                // Gravar os vínculos para os itens vinculados
                for (const item of itensParaInserir) {
                  if (item.produto_id && item.cd_prod_fornec && rec.cadastro_id) {
                    await salvarVinculoProdutoFornecedor(
                      XEmpresaId,
                      rec.cadastro_id,
                      item.produto_id,
                      item.cd_prod_fornec,
                      item.nm_produto || "",
                      1
                    );
                  }
                }
                setXXmlItens([]);
                toast.success(`${payloads.length} item(s) gravado(s) na NF-e.`);
              }
            }
          },
        }}
        XGridCols={gridCols}
        XExportTitle="Entradas NF-e"
        XAfterInsertTab="itens"
        XRefreshRef={XRefreshRef}
        XExtraTabs={[
          {
            key: "itens", label: "Itens da NF-e",
            render: ({ record, currentRecord }) => {
              const id = (currentRecord || record)?.nfe_cabecalho_id || null;
              const st = (currentRecord || record)?.st_nf || "A";
              return (
                <NfeItensTab
                  nfeCabecalhoId={id}
                  empresaId={XEmpresaId}
                  podeEditar={st === "P" || st === "A"}
                  itensImportados={id ? undefined : XXmlItens}
                  onItensImportadosChanged={id ? undefined : setXXmlItens}
                  onItensChanged={(itens) => { XItemsRef.current = itens; }}
                  finNfe={(currentRecord || record)?.fin_nfe}
                />
              );
            },
          },
          {
            key: "adicionais", label: "Dados Adicionais",
            render: ({ record, setField, isEditing }) => {
              const ro = !isEditing;
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">Nº Protocolo</label>
                      <input readOnly={ro} value={record.nr_protocolo ?? ""} onChange={e => setField("nr_protocolo" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">Origem Inclusão</label>
                      <input readOnly value={record.origem_inclusao === "X" ? "XML" : "Manual"} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-1 block">Observações da NF-e (Contribuinte/Cliente)</label>
                      <textarea readOnly={ro} value={record.obs_nf ?? ""} onChange={e => setField("obs_nf" as any, e.target.value)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[80px]" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-1 block">Observações da NF-e (Fisco)</label>
                      <textarea readOnly={ro} value={record.obs_fisco ?? ""} onChange={e => setField("obs_fisco" as any, e.target.value)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[80px]" />
                    </div>
                  </div>
                </div>
              );
            },
          },
        ]}
        renderCadastro={({ record, setField, setRecord, mode, isEditing, currentRecord }) => {
          const ro = !isEditing;
          const stAtual = (record.st_nf || "P") as TNfeSt;
          const cabId = currentRecord?.nfe_cabecalho_id || null;

          return (
            <div className="space-y-4">
              {/* Importação e Chave da NF-e (apenas se em edição) */}
              {isEditing && (
                <div className="border border-border rounded-xl p-4 bg-muted/10 shadow-inner">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-[380px] max-w-full">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                        Chave de Acesso da NF-e (44 dígitos)
                      </label>
                      <input
                        type="text"
                        maxLength={44}
                        placeholder="Insira os 44 números da chave de acesso"
                        value={record.chave_nfe ?? ""}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, "");
                          setField("chave_nfe" as any, val);
                        }}
                        className="w-full border border-border focus:border-primary focus:ring-1 focus:ring-primary rounded px-3 py-1.5 text-sm font-mono tracking-wider outline-none bg-card"
                      />
                      {record.chave_nfe && record.chave_nfe.length !== 44 && (
                        <span className="text-[10px] text-destructive font-bold mt-1 block">
                          A chave deve conter exatamente 44 dígitos (atualmente possui {record.chave_nfe.length}).
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <NfeXmlImporter
                        disabled={ro}
                        empresaId={XEmpresaId}
                        onImported={(dados) => processarXmlImportado(dados, setField, setRecord)}
                      />
                      <button 
                        type="button" 
                        onClick={handleConsultarSefaz}
                        className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-secondary-foreground font-bold rounded text-xs uppercase tracking-wider hover:bg-secondary/80 transition-all h-9 shadow-sm"
                        title="Consultar Status SEFAZ"
                      >
                        <Activity className="w-4 h-4" />
                        Status SEFAZ
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Linha 1: Número, Série, Datas, Status, botão Importar */}
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Cód.</label>
                  <input readOnly value={record.nfe_cabecalho_id ?? (mode === "insert" ? "(Novo)" : "")} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Nº Nota <span className="text-destructive">*</span></label>
                  <input readOnly={ro} value={record.nr_nota ?? ""} onChange={e => setField("nr_nota" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                </div>
                <div className="col-span-1">
                  <label className="text-xs text-muted-foreground">Série</label>
                  <input readOnly={ro} value={record.serie ?? ""} onChange={e => setField("serie" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Dt. Emissão</label>
                  <input type="date" readOnly={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Dt. Entrada <span className="text-destructive">*</span></label>
                  <input type="date" readOnly={ro} value={(record.dt_entrada || "").toString().substring(0, 10)} onChange={e => setField("dt_entrada" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <input readOnly value={getStatusLabel(stAtual)} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                </div>
                <div className="col-span-2 flex gap-2 items-end">
                  {cabId && (stAtual === "P" || stAtual === "A") && !isEditing && (
                    <button
                      type="button"
                      onClick={() => escriturar(cabId, record.deposito_id || null, record as INfeCabecalho, setRecord)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                    >
                      <ClipboardCheck className="w-4 h-4" /> Escriturar
                    </button>
                  )}
                  {cabId && stAtual === "E" && !isEditing && (
                    <button
                      type="button"
                      onClick={() => estornar(cabId, record as INfeCabecalho, setRecord)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Estornar
                    </button>
                  )}
                </div>
              </div>

              {/* Linha 2: Fornecedor + Depósito + Finalidade */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="text-xs text-muted-foreground">Fornecedor <span className="text-destructive">*</span></label>
                  <div className="flex gap-1">
                    <input
                      readOnly
                      value={record.cadastro_id ? (XFornCache[record.cadastro_id]?.razao || `#${XFornCache[record.cadastro_id]?.cd_cadastro ?? record.cadastro_id}`) : ""}
                      placeholder="Selecione o fornecedor..."
                      className="flex-1 border border-border rounded px-2 py-1 text-sm bg-secondary"
                    />
                    {isEditing && (
                      <button
                        type="button"
                        onClick={async () => {
                          const val = prompt("Digite o CNPJ ou parte da Razão Social:");
                          if (!val) return;
                          const digits = val.replace(/\D/g, "");
                          let q = db.from("cadastro").select("cadastro_id,cd_cadastro,cnpj,razao_social")
                            .eq("empresa_id", XEmpresaMatrizId).eq("excluido", false)
                            .eq("st_fornecedor", "S");
                          if (/^\d+$/.test(val) && val.length < 8) {
                            q = q.eq("cd_cadastro", parseInt(val));
                          } else if (digits.length >= 8) {
                            q = q.ilike("cnpj", `%${digits}%`);
                          } else {
                            q = q.ilike("razao_social", `%${val}%`);
                          }
                          const { data } = await q.limit(10);
                          if (!data?.length) { toast.warning("Nenhum fornecedor encontrado."); return; }
                          const opcoes = data.map((c: any) => `${c.cd_cadastro ?? c.cadastro_id} — ${formatCPFCNPJ(c.cnpj)} — ${c.razao_social}`).join("\n");
                          const escolha = prompt(`Escolha (informe o código):\n${opcoes}`);
                          if (!escolha) return;
                          const id = parseInt(escolha);
                          if (!id) return;
                          const found = data.find((c: any) => c.cd_cadastro === id || c.cadastro_id === id);
                          if (found) {
                            setXFornCache(prev => ({ ...prev, [found.cadastro_id]: { id: found.cadastro_id, cd_cadastro: found.cd_cadastro, cnpj: found.cnpj, razao: found.razao_social } }));
                            setField("cadastro_id" as any, found.cadastro_id);
                          }
                        }}
                        className="px-2 py-1 border border-border rounded bg-card hover:bg-accent"
                        title="Pesquisar fornecedor"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-muted-foreground">Depósito de Entrada <span className="text-destructive">*</span></label>
                  <select
                    disabled={ro}
                    value={record.deposito_id ?? ""}
                    onChange={e => setField("deposito_id" as any, e.target.value ? Number(e.target.value) : null as any)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card"
                  >
                    <option value="">— Selecione —</option>
                    {XDepositos.map(d => <option key={d.deposito_id} value={d.deposito_id}>{d.nome}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-xs text-muted-foreground">Finalidade da NF-e <span className="text-destructive">*</span></label>
                  <select
                    disabled={ro}
                    value={record.fin_nfe ?? 1}
                    onChange={e => setField("fin_nfe" as any, e.target.value ? Number(e.target.value) : 1)}
                    className="w-full border border-border rounded px-2 py-1 text-sm bg-card"
                  >
                    <option value={1}>1 - Normal</option>
                    <option value={2}>2 - Complementar</option>
                    <option value={3}>3 - Ajuste</option>
                    <option value={4}>4 - Devolução</option>
                  </select>
                </div>
              </div>

              <NfeTotalsCard
                record={record}
                ro={ro}
                setField={setField}
                handleBlur={handleBlur}
                fmt2={fmt2}
                fmtInput={fmtInput}
                XXmlItens={XXmlItens}
              />

            </div>
          );
        }}
      />

      {/* Modal: Fornecedor não encontrado */}
      <FornecedorCheckDialog
        open={XFornDialog}
        emitente={XFornEmit}
        onCancelar={() => { setXFornDialog(false); setXDadosXml(null); toast.info("Importação cancelada."); }}
        onCadastrar={() => {
          setXFornDialog(false);
          if (!XFornEmit) return;
          // Salva dados no store para o FornecedorTransportadorForm pré-preencher
          setPendingSupplier({
            cnpj:               XFornEmit.cnpj,
            razao_social:       XFornEmit.razao_social,
            nome_fantasia:      XFornEmit.nome_fantasia,
            inscricao_estadual: XFornEmit.inscricao_estadual,
            endereco_logradouro:XFornEmit.endereco_logradouro,
            endereco_numero:    XFornEmit.endereco_numero,
            endereco_bairro:    XFornEmit.endereco_bairro,
            endereco_cep:       XFornEmit.endereco_cep,
            endereco_cidade:    XFornEmit.endereco_cidade,
            endereco_uf:        XFornEmit.endereco_uf,
            fone:               XFornEmit.fone,
            email:              XFornEmit.email,
          });
          // Fecha aba existente (se aberta) para forçar remontagem com dados do XML
          const existingTab = XTabs.find(t => t.component === "fornecedores-transportadores");
          if (existingTab) closeTab(existingTab.id);
          openTab({
            title: "Fornecedores/Transportadores",
            component: "fornecedores-transportadores",
          });
          toast.info("Preencha os dados do fornecedor e salve. Após, reimporte o XML.");
          setXDadosXml(null);
        }}
      />
    </>
  );
};

export default NotaFiscalEntradaForm;

