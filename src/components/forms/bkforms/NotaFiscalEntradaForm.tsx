import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import NfeXmlImporter from "./nfe/NfeXmlImporter";
import NfeItensTab from "./nfe/NfeItensTab";
import FornecedorCheckDialog from "./nfe/FornecedorCheckDialog";
import NfeProdutosVinculoList from "./nfe/NfeProdutosVinculoList";
import type { INfeCabecalho, INfeDadosXml, INfeXmlItem, TNfeSt, INfeXmlEmitente } from "./nfe/types";
import { NFE_ST_LABELS } from "./nfe/types";
import { Search, ClipboardCheck, Activity } from "lucide-react";
import { acbrService } from "@/services/acbrService";
import { formatCPFCNPJ } from "@/lib/validators";
import { setPendingSupplier } from "@/utils/nfePendingStore";

const db = supabase as any;

interface IFornecedorInfo { id: number; cnpj: string; razao: string; }

const XGridCols: IGridColumn[] = [
  { key: "nfe_cabecalho_id", label: "Nº", width: "70px", align: "right" },
  { key: "nr_nota",   label: "Nota",    width: "100px" },
  { key: "serie",     label: "Série",   width: "60px", align: "center" },
  { key: "dt_entrada",label: "Entrada", width: "110px", render: r => r.dt_entrada ? new Date(r.dt_entrada).toLocaleDateString("pt-BR") : "" },
  { key: "_forn",     label: "Fornecedor", width: "2fr", getValue: (r: any) => r._forn_razao || "", render: (r: any) => r._forn_razao || (r.cadastro_id ? `#${r.cadastro_id}` : "") },
  { key: "st_nf",     label: "Status",  width: "110px", render: r => NFE_ST_LABELS[r.st_nf as TNfeSt] || r.st_nf },
  { key: "vl_total_nf",label: "Total",  width: "120px", align: "right", render: r => Number(r.vl_total_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
];

const XDefault: Partial<INfeCabecalho> = {
  tp_entrada: "M", st_nf: "A",
  nr_nota: "", serie: "1", chave_nfe: "", nr_protocolo: "",
  vl_produtos: 0, vl_desconto: 0, vl_frete: 0, vl_seguro: 0,
  vl_despesa: 0, vl_ipi: 0, vl_icms_st: 0, vl_total_nf: 0,
  obs_nf: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_entrada: new Date().toISOString().substring(0, 10),
};

const NotaFiscalEntradaForm: React.FC = () => {
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
  // Itens prontos para inserção no nfe_item após salvar o cabeçalho
  const XPendingNfeItens   = useRef<{ item: INfeXmlItem; produto_id: number | null; fator_conversao: number }[]>([]);

  const handleConsultarSefaz = async () => {
    try {
      const resp = await acbrService.consultarStatus();
      alert(resp);
    } catch (e) {
      // Erro já tratado no serviço
    }
  };

  // Misc
  const XRefreshRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const loadDeps = async () => {
      const { data } = await db.from("deposito").select("deposito_id,nome")
        .eq("excluido", false).order("nome");
      setXDepositos(data || []);
    };
    loadDeps();
  }, [XEmpresaId]);

  const ensureFornInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XFornCacheRef.current[id]);
    if (!faltando.length) return;
    const { data } = await db.from("cadastro")
      .select("cadastro_id,cnpj,razao_social")
      .in("cadastro_id", faltando);
    if (data) {
      setXFornCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cnpj: c.cnpj || "", razao: c.razao_social || "" };
        }
        return next;
      });
    }
  }, []);

  // ── Escrituração ─────────────────────────────────────────────
  const escriturar = useCallback(async (cabId: number, depositoId: number | null, rec: INfeCabecalho) => {
    if (!depositoId) { toast.error("Selecione o Depósito antes de escriturar."); return; }
    if (!confirm("Confirma a escrituração desta NF-e? O estoque e custos dos produtos serão atualizados.")) return;

    const { data: itens } = await db.from("nfe_item")
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

      // Atualiza estoque
      const { data: est } = await db.from("estoque")
        .select("estoque_id,estoque_fisico")
        .eq("produto_id", item.produto_id)
        .eq("deposito_id", depositoId)
        .eq("excluido", false)
        .maybeSingle();
      if (est) {
        await db.from("estoque").update({
          estoque_fisico: Number(est.estoque_fisico || 0) + qtEstoque,
          updated_at: new Date().toISOString(),
        }).eq("estoque_id", est.estoque_id);
      } else {
        await db.from("estoque").insert({
          produto_id: item.produto_id, empresa_id: XEmpresaId,
          deposito_id: depositoId,
          estoque_fisico: qtEstoque,
          estoque_reservado: 0, estoque_disponivel: qtEstoque,
          estoque_minimo: 0, estoque_padrao: 0,
        });
      }

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
        await db.from("produto_fornecedor").upsert({
          empresa_id:     XEmpresaId,
          produto_id:     item.produto_id,
          cadastro_id:    rec.cadastro_id,
          cd_prod_fornec: item.cd_prod_fornec,
          nm_prod_fornec: item.nm_produto || "",
          excluido:       false,
        }, { onConflict: "empresa_id,cadastro_id,cd_prod_fornec", ignoreDuplicates: false });
      }
    }

    await db.from("nfe_cabecalho").update({
      st_nf: "E", updated_at: new Date().toISOString(),
    }).eq("nfe_cabecalho_id", cabId);

    toast.success("NF-e escriturada com sucesso! Estoque e custos atualizados.");
    if (XRefreshRef.current) await XRefreshRef.current();
  }, [XEmpresaId]);

  // ── Importação XML ────────────────────────────────────────────
  const processarXmlImportado = useCallback(async (dados: INfeDadosXml, _setField: (k: any, v: any) => void, setRecord: (r: any) => void) => {
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

    // Armazena callbacks para usar após confirmação dos produtos
    XPendingSetRecord.current = setRecord;
    XPendingXmlDados.current  = dados;

    setXCadastroIdXml(cadastroId);
    setXFornCache(prev => ({ ...prev, [cadastroId]: { id: cadastroId, cnpj: cnpjLimpo, razao: dados.emitente.razao_social } }));
    setXProdItens(dados.itens);
    setXProdListOpen(true);

    toast.info(`XML lido. ${dados.itens.length} item(s) — verifique os vínculos de produtos.`);
  }, [XEmpresaMatrizId]);

  // Chamado quando o usuário confirma a lista de vínculos
  const handleProdutosConfirmados = useCallback(async (
    vinculos: { nrItem: number; produto_id: number | null; fator_conversao: number }[]
  ) => {
    setXProdListOpen(false);
    const dados    = XPendingXmlDados.current;
    const setRecord= XPendingSetRecord.current;
    const cadastroId = XCadastroIdXml;
    if (!dados || !setRecord || !cadastroId) return;

    // Aplica dados do cabeçalho ao formulário
    setRecord((prev: any) => ({
      ...prev,
      tp_entrada: "X",
      cadastro_id: cadastroId,
      nr_nota:     dados.nr_nota,
      serie:       dados.serie,
      dt_emissao:  dados.dt_emissao,
      dt_entrada:  new Date().toISOString().substring(0, 10),
      dt_saida:    dados.dt_saida,
      chave_nfe:   dados.chave_nfe,
      nr_protocolo:dados.nr_protocolo,
      vl_produtos: dados.vl_produtos,
      vl_desconto: dados.vl_desconto,
      vl_frete:    dados.vl_frete,
      vl_seguro:   dados.vl_seguro,
      vl_despesa:  dados.vl_despesa,
      vl_ipi:      dados.vl_ipi,
      vl_icms_st:  dados.vl_icms_st,
      vl_total_nf: dados.vl_total_nf,
      obs_nf:      dados.obs_nf,
      xml_nf:      dados.xmlRaw,
    }));

    // Monta e armazena itens prontos para inserção após o save do cabeçalho
    const vinculoMap: Record<number, { produto_id: number | null; fator: number }> = {};
    for (const v of vinculos) vinculoMap[v.nrItem] = { produto_id: v.produto_id, fator: v.fator_conversao };

    XPendingNfeItens.current = dados.itens.map(item => ({
      item,
      produto_id:      vinculoMap[item.nr_item]?.produto_id ?? null,
      fator_conversao: vinculoMap[item.nr_item]?.fator ?? 1,
    }));

    XPendingSetRecord.current = null;
    XPendingXmlDados.current  = null;

    const vinculados = vinculos.filter(v => v.produto_id).length;
    toast.success(`XML carregado: ${dados.itens.length} item(s), ${vinculados} vinculado(s). Salve a NF-e para gravar os itens.`);
  }, [XCadastroIdXml]);


  const gridCols = useMemo(() => XGridCols.map(c =>
    c.key === "_forn" ? { ...c, getValue: (r: any) => XFornCache[r.cadastro_id]?.razao || "" } : c
  ), [XFornCache]);

  const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const fmtInput = (v: any) => {
    if (v === 0 || v === "0") return "";
    return String(v).replace(".", ",");
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
          XTableName: "nfe_cabecalho",
          XPrimaryKey: "nfe_cabecalho_id",
          XTitle: "Entrada NF-e",
          XDefaultRecord: { ...XDefault, empresa_id: XEmpresaId } as any,
          XEmpresaId,
          XSelectCols: "*",
          XOrderBy: "nfe_cabecalho_id",
          XSoftDelete: false,
          XOnAfterLoad: (rows: any[]) => {
            const ids = [...new Set(rows.map(r => r.cadastro_id).filter(Boolean))] as number[];
            if (ids.length) ensureFornInfo(ids);
          },
          XOnBeforeSave: (rec) => {
            if (!rec.nr_nota?.trim()) throw new Error("Informe o número da Nota Fiscal.");
            if (!rec.dt_entrada) throw new Error("Informe a Data de Entrada.");
            if (!rec.deposito_id) throw new Error("Informe o Depósito de Entrada.");
            return { ...rec, empresa_id: rec.empresa_id || XEmpresaId };
          },
          XOnAfterSave: async (rec: any, mode) => {
            if (mode === "insert" && XPendingNfeItens.current.length > 0) {
              const cabId = rec.nfe_cabecalho_id;
              const itensParaInserir = XPendingNfeItens.current;
              XPendingNfeItens.current = [];

              // Insere itens no nfe_item
              const payloads = itensParaInserir.map(({ item, produto_id }) => ({
                nfe_cabecalho_id: cabId,
                empresa_id:       XEmpresaId,
                produto_id:       produto_id || null,
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
                vl_pis:           Number(item.vl_pis || 0),
                pc_pis:           Number(item.pc_pis || 0),
                vl_cofins:        Number(item.vl_cofins || 0),
                pc_cofins:        Number(item.pc_cofins || 0),
                vl_fcp_st:        Number(item.vl_fcp_st || 0),
                pc_fcp_st:        Number(item.pc_fcp_st || 0),
                cst_icms:         item.cst_icms || "",
                cst_ipi:          item.cst_ipi || "",
                cst_pis:          item.cst_pis || "",
                cst_cofins:       item.cst_cofins || "",
                pc_mva:           Number(item.pc_mva || 0),
                vl_bc_st:         Number(item.vl_bc_st || 0),
              }));

              const { error: errItens } = await db.from("nfe_item").insert(payloads);
              if (errItens) {
                toast.error("Erro ao gravar itens: " + errItens.message);
              } else {
                // Upsert produto_fornecedor para os itens vinculados
                for (const { item, produto_id, fator_conversao } of itensParaInserir) {
                  if (produto_id && item.cd_prod_fornec && rec.cadastro_id) {
                    await db.from("produto_fornecedor").upsert({
                      empresa_id:     XEmpresaId,
                      produto_id,
                      cadastro_id:    rec.cadastro_id,
                      cd_prod_fornec: item.cd_prod_fornec,
                      nm_prod_fornec: item.nm_produto || "",
                      fator_conversao,
                      excluido:       false,
                    }, { onConflict: "empresa_id,cadastro_id,cd_prod_fornec", ignoreDuplicates: false });
                  }
                }
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
                  podeEditar={st === "A"}
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
                      <label className="text-xs text-muted-foreground">Chave NF-e (44 dígitos)</label>
                      <input readOnly={ro} value={record.chave_nfe ?? ""} onChange={e => setField("chave_nfe" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Nº Protocolo</label>
                      <input readOnly={ro} value={record.nr_protocolo ?? ""} onChange={e => setField("nr_protocolo" as any, e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Tp. Entrada</label>
                      <input readOnly value={record.tp_entrada === "X" ? "XML" : "Manual"} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Observações da NF-e</label>
                    <textarea readOnly={ro} value={record.obs_nf ?? ""} onChange={e => setField("obs_nf" as any, e.target.value)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]" />
                  </div>
                </div>
              );
            },
          },
        ]}
        renderCadastro={({ record, setField, setRecord, mode, isEditing, currentRecord }) => {
          const ro = !isEditing;
          const stAtual = (record.st_nf || "A") as TNfeSt;
          const cabId = currentRecord?.nfe_cabecalho_id || null;

          return (
            <div className="space-y-4">
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
                  <input readOnly value={NFE_ST_LABELS[stAtual] || stAtual} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary" />
                </div>
                <div className="col-span-2 flex gap-2 items-end">
                  {isEditing && (
                    <div className="flex gap-2">
                      <NfeXmlImporter
                        disabled={ro}
                        onImported={(dados) => processarXmlImportado(dados, setField, setRecord)}
                      />
                      <button 
                        type="button" 
                        onClick={handleConsultarSefaz}
                        className="flex items-center gap-1 px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/80"
                        title="Consultar Status SEFAZ"
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Status SEFAZ
                      </button>
                    </div>
                  )}
                  {cabId && stAtual === "A" && !isEditing && (
                    <button
                      type="button"
                      onClick={() => escriturar(cabId, record.deposito_id || null, record as INfeCabecalho)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                    >
                      <ClipboardCheck className="w-4 h-4" /> Escriturar
                    </button>
                  )}
                </div>
              </div>

              {/* Linha 2: Fornecedor + Depósito */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-8">
                  <label className="text-xs text-muted-foreground">Fornecedor <span className="text-destructive">*</span></label>
                  <div className="flex gap-1">
                    <input
                      readOnly
                      value={record.cadastro_id ? (XFornCache[record.cadastro_id]?.razao || `#${record.cadastro_id}`) : ""}
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
                          let q = db.from("cadastro").select("cadastro_id,cnpj,razao_social")
                            .eq("empresa_id", XEmpresaMatrizId).eq("excluido", false)
                            .eq("st_fornecedor", "S");
                          if (digits.length >= 8) q = q.ilike("cnpj", `%${digits}%`);
                          else q = q.ilike("razao_social", `%${val}%`);
                          const { data } = await q.limit(10);
                          if (!data?.length) { toast.warning("Nenhum fornecedor encontrado."); return; }
                          const opcoes = data.map((c: any) => `${c.cadastro_id} — ${formatCPFCNPJ(c.cnpj)} — ${c.razao_social}`).join("\n");
                          const escolha = prompt(`Escolha (informe o código):\n${opcoes}`);
                          if (!escolha) return;
                          const id = parseInt(escolha);
                          if (!id) return;
                          const found = data.find((c: any) => c.cadastro_id === id);
                          if (found) {
                            setXFornCache(prev => ({ ...prev, [id]: { id, cnpj: found.cnpj, razao: found.razao_social } }));
                            setField("cadastro_id" as any, id);
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
                <div className="col-span-4">
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
              </div>

              {/* Linha 3: Totais */}
              <div className="border border-border rounded p-3 bg-card">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Totais da Nota</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {[
                    { label: "Produtos",  key: "vl_produtos"  },
                    { label: "Desconto",  key: "vl_desconto"  },
                    { label: "Frete",     key: "vl_frete"     },
                    { label: "Seguro",    key: "vl_seguro"    },
                    { label: "Despesa",   key: "vl_despesa"   },
                    { label: "IPI",       key: "vl_ipi"       },
                    { label: "ICMS-ST",   key: "vl_icms_st"   },
                  ].map(f => (
                    <div key={f.key} className="flex flex-col">
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <input
                        type="text"
                        readOnly={ro}
                        value={ro ? fmt2(Number((record as any)[f.key] || 0)) : fmtInput((record as any)[f.key] || 0)}
                        onBlur={() => handleBlur(f.key, record, setField)}
                        onChange={e => {
                          const val = e.target.value.replace(/\./g, "").replace(",", ".");
                          setField(f.key as any, val);
                        }}
                        className={`w-full border border-border rounded px-2 py-1 text-sm text-right ${ro ? "bg-secondary" : "bg-card"}`}
                      />
                    </div>
                  ))}
                  <div className="col-span-2 lg:col-span-1 flex flex-col justify-end">
                    <label className="text-xs font-bold text-primary">TOTAL NOTA</label>
                    <input
                      readOnly
                      value={fmt2(Number(record.vl_total_nf || 0))}
                      className="w-full border border-primary/30 rounded px-2 py-1 text-sm font-bold text-right bg-primary/5 text-primary"
                    />
                  </div>
                </div>
              </div>

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

      {/* Lista em lote: Vínculo de produtos */}
      <NfeProdutosVinculoList
        open={XProdListOpen}
        itens={XProdItens}
        cadastroId={XCadastroIdXml || 0}
        empresaId={XEmpresaId}
        empresaMatrizId={XEmpresaMatrizId}
        onConfirmar={handleProdutosConfirmados}
        onCancelar={() => { setXProdListOpen(false); setXDadosXml(null); toast.info("Vínculo de produtos cancelado."); }}
      />
    </>
  );
};

export default NotaFiscalEntradaForm;
