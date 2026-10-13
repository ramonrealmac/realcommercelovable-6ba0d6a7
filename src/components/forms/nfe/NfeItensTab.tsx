// @ts-nocheck
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Link, Search, Key, Upload, Pencil, Trash2 } from "lucide-react";
import type { INfeItem, INfeXmlItem } from "./types";
import { useAppContext } from "@/contexts/AppContext";
import ProdutoSearchDialog from "../pedido/ProdutoSearchDialog";
import { parseNfeXml } from "./NfeXmlParser";
import { formatCPFCNPJ } from "@/lib/validators";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import { formatNumericInput } from "@/utils/formNavigation";

const db = supabase;
type XFieldValue = string | number | boolean | null | undefined;
type XFormItem = Partial<INfeItem> & Record<string, XFieldValue>;
type XItemRow = XFormItem & { nfe_item_id?: number; produto_id?: number | null; _produto_nome?: string | null };
type XPayload = Record<string, string | number | null>;
type XProdutoOption = { produto_id: number; nome: string; referencia?: string };
type XTextInputProps = { k: string; label: string; span?: number; digits?: boolean; max?: number; upper?: boolean; right?: boolean };
type XNumInputProps = { k: string; label: string; span?: number; readOnly?: boolean };

const parseNum = (XValue: unknown) => {
  if (XValue === undefined || XValue === null || XValue === "") return 0;
  if (typeof XValue === "number") return XValue;
  const XNormalized = String(XValue).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const XParsed = parseFloat(XNormalized);
  return isNaN(XParsed) ? 0 : XParsed;
};

const fmt = (XValue: unknown, XDecimals: number) => Number(parseNum(XValue) || 0).toLocaleString("pt-BR", {
  minimumFractionDigits: XDecimals,
  maximumFractionDigits: XDecimals,
});
const fmt2 = (XValue: unknown) => fmt(XValue, 2);
const fmt4 = (XValue: unknown) => fmt(XValue, 4);

interface NfeItensTabProps {
  nfeCabecalhoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  hideVinculo?: boolean;
  itensImportados?: INfeXmlItem[];
  onItensImportadosChanged?: (itens: INfeXmlItem[]) => void;
  onTotaisChanged?: (totais: { vl_total: number; vl_ipi: number; vl_icms_st: number }) => void;
  onRefreshCabecalho?: (totais?: any) => void;
  finNfe?: number;
  onItensChanged?: (itens: any[]) => void;
  autoInsert?: boolean;
  onAutoInsertHandled?: () => void;
}

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

const XPercentKeys = new Set([
  "pc_ipi", "pc_icms", "pc_icms_st", "pc_pis", "pc_cofins", "pc_fcp_st", "pc_ibs", "pc_cbs", "pc_is",
  "pc_mva", "pc_cred_sn", "pc_fcp", "pc_red_bc", "pc_red_bc_st", "pc_desconto", "pc_red_bc_ibs", "pc_red_bc_cbs",
  "pc_ibs_est", "pc_ibs_mun",
]);
const XQuantityKeys = new Set(["qt_entrada", "qt_tributavel"]);
const XIntKeys = new Set(["nr_item", "origem", "mod_bc", "mod_bc_st", "nr_item_origem"]);
const XValueKeys = new Set([
  "vl_unit", "vl_unit_liquido", "vl_unit_tributavel", "vl_desconto", "vl_total", "vl_ipi", "vl_icms_st", "vl_pis", "vl_cofins",
  "vl_fcp_st", "vl_ibs", "vl_cbs", "vl_is", "vl_bc", "vl_bc_st", "vl_bc_ipi", "vl_bc_pis", "vl_bc_cofins",
  "vl_cred_sn", "vl_fcp", "vl_frete", "vl_icms", "vl_icms_deson", "vl_outro", "vl_seguro",
  "vl_ibs_est", "vl_ibs_mun", "vl_bc_ibscbs",
]);
const XNumericKeys = new Set([...XPercentKeys, ...XQuantityKeys, ...XValueKeys]);

const XTextKeys = [
  "cd_prod_fornec", "nm_produto", "ncm", "cfop", "unidade", "gtin", "csosn", "cest", "c_enq",
  "cst_icms", "cst_ipi", "cst_pis", "cst_cofins", "cst_ibs", "cst_cbs", "cst_is", "cfop_entrada",
  "chave_ref_item",
];

const decimalsFor = (XKey: string) => {
  if (XKey === "pc_desconto") return 2;
  if (XPercentKeys.has(XKey)) return 4;
  if (XQuantityKeys.has(XKey)) return 4;
  if (XIntKeys.has(XKey)) return 0;
  return 2;
};

const fmtInput = (XValue: unknown, XKey: string) => {
  if (XValue === undefined || XValue === null || XValue === "") return "";
  if (XIntKeys.has(XKey)) return String(parseInt(String(XValue), 10) || 0);
  return parseNum(XValue).toFixed(decimalsFor(XKey)).replace(".", ",");
};

const onlyDigits = (XValue: unknown, XMax?: number) => {
  const XDigits = String(XValue ?? "").replace(/\D/g, "");
  return XMax ? XDigits.slice(0, XMax) : XDigits;
};

const emptyItem = (): XFormItem => ({
  nr_item: 0,
  cd_prod_fornec: "",
  nm_produto: "",
  ncm: "",
  cfop: "",
  unidade: "",
  gtin: "",
  origem: 0,
  csosn: "",
  cest: "",
  c_enq: "",
  qt_entrada: 0,
  qt_tributavel: 0,
  vl_unit: 0,
  vl_unit_tributavel: 0,
  pc_desconto: 0,
  vl_desconto: 0,
  vl_unit_liquido: 0,
  vl_frete: 0,
  vl_seguro: 0,
  vl_outro: 0,
  vl_total: 0,
  mod_bc: 3,
  vl_bc: 0,
  pc_red_bc: 0,
  vl_icms: 0,
  pc_fcp: 0,
  vl_fcp: 0,
  vl_icms_deson: 0,
  mod_bc_st: 0,
  vl_ipi: 0,
  vl_icms_st: 0,
  vl_pis: 0,
  vl_cofins: 0,
  vl_fcp_st: 0,
  vl_ibs: 0,
  vl_cbs: 0,
  vl_is: 0,
  vl_cred_sn: 0,
  pc_ipi: 0,
  pc_icms: 0,
  pc_icms_st: 0,
  pc_pis: 0,
  pc_cofins: 0,
  pc_fcp_st: 0,
  pc_ibs: 0,
  pc_cbs: 0,
  pc_is: 0,
  pc_mva: 0,
  pc_cred_sn: 0,
  pc_red_bc_st: 0,
  cst_icms: "",
  cst_ipi: "",
  cst_pis: "",
  cst_cofins: "",
  cst_ibs: "",
  cst_cbs: "",
  cst_is: "",
  clas_trib_id: "",
  pc_red_bc_ibs: 0,
  pc_red_bc_cbs: 0,
  pc_ibs_est: 0,
  vl_ibs_est: 0,
  pc_ibs_mun: 0,
  vl_ibs_mun: 0,
  vl_bc_ibscbs: 0,
  vl_bc_st: 0,
  vl_bc_ipi: 0,
  vl_bc_pis: 0,
  vl_bc_cofins: 0,
  produto_id: undefined,
  deposito_id: undefined,
  cfop_entrada: "",
  chave_ref_item: "",
  nr_item_origem: 0,
});

const formatItemForEdit = (XItem: XFormItem) => {
  const XFormatted: XFormItem = { ...XItem };
  const bcDefault = parseNum(XItem.vl_bc_ibscbs) || parseNum(XItem.vl_total) || parseNum(XItem.vl_bc);
  if (bcDefault > 0 && (!XItem.vl_bc_ibscbs || parseNum(XItem.vl_bc_ibscbs) === 0)) {
    XFormatted.vl_bc_ibscbs = bcDefault;
  }
  const vlu = parseNum(XItem.vl_unit);
  const qt = parseNum(XItem.qt_entrada);
  const vldTotal = parseNum(XItem.vl_desconto);
  const vlt = parseNum(XItem.vl_total);

  const descUnit = qt > 0 ? Math.round((vldTotal / qt + Number.EPSILON) * 100) / 100 : vldTotal;
  const vlrLiquido = qt > 0 ? Math.round((vlt / qt + Number.EPSILON) * 100) / 100 : Math.max(0, Math.round((vlu - descUnit + Number.EPSILON) * 100) / 100);

  XFormatted.vl_desconto = descUnit;
  XFormatted.vl_unit_liquido = vlrLiquido;

  [...XNumericKeys, ...XIntKeys].forEach((XKey) => {
    if (XFormatted[XKey] !== undefined && XFormatted[XKey] !== null) XFormatted[XKey] = fmtInput(XFormatted[XKey], XKey);
  });
  return XFormatted;
};

const NfeItensTab: React.FC<NfeItensTabProps> = ({
  nfeCabecalhoId,
  empresaId,
  podeEditar,
  hideVinculo = false,
  itensImportados,
  onItensImportadosChanged,
  onTotaisChanged,
  onRefreshCabecalho,
  finNfe,
  onItensChanged,
  autoInsert,
  onAutoInsertHandled,
}) => {
  const { XTabs, openTab, closeTab } = useAppContext();
  const [XItens, setXItens] = useState<XItemRow[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<XFormItem>(formatItemForEdit(emptyItem()));
  const [XProdutos, setXProdutos] = useState<{ produto_id: number; nome: string; referencia?: string; cd_produto?: number | null }[]>([]);
  const [XCfops, setXCfops] = useState<{ cd_cfop: string; descricao: string }[]>([]);
  const [XIcmsList, setXIcmsList] = useState<{ icms_cst_csosn: string; icms_descricao: string; icms_tipo?: string }[]>([]);
  const [XIpiList, setXIpiList] = useState<{ ipi_cst: string; ipi_descricao: string }[]>([]);
  const [XUnidades, setXUnidades] = useState<{ unidade_id: string; descricao: string }[]>([]);
  const [XIbsCbs, setXIbsCbs] = useState<{ ibscbs_id: number; ibscbs_cst: string; ibscbs_descricao: string }[]>([]);
  const [XClasTrib, setXClasTrib] = useState<{ clas_trib_id: string; grupo_ibscbs_id?: number | null; descricao: string }[]>([]);
  const [XTributoTab, setXTributoTab] = useState<"regras" | "icms" | "icms_st" | "ipi" | "pis_cofins" | "ibs_cbs" | "dfe_referenciado">("regras");


  const { handleKeyDown } = useEnterTraversal();

  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchItemNr, setXSearchItemNr] = useState<number | null>(null);
  const [XSearchFormOpen, setXSearchFormOpen] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);
  const unidadeSelectRef = useRef<HTMLSelectElement>(null);
  const salvarBtnRef = useRef<HTMLButtonElement>(null);

  const [XChavesRef, setXChavesRef] = useState<any[]>([]);
  const [XCabecalho, setXCabecalho] = useState<any>(null);
  const isDevolucao = Number(finNfe || XCabecalho?.fin_nfe) === 4;

  const handleNovo = useCallback(() => {
    setXMode("insert");
    setXF(formatItemForEdit({ ...emptyItem(), nr_item: XItens.length + 1 }));
    setXCurrentIdx(null);
  }, [XItens.length]);

  useEffect(() => {
    if (XMode === "insert" || XMode === "edit") {
      setTimeout(() => {
        productInputRef.current?.focus();
      }, 150);
    }
  }, [XMode]);

  useEffect(() => {
    if (podeEditar && XMode === "view") {
      setXMode("insert");
      setXF(formatItemForEdit({ ...emptyItem(), nr_item: XItens.length + 1 }));
    }
  }, [podeEditar, XMode, XItens.length]);

  const loadCabecalho = useCallback(async () => {
    if (!nfeCabecalhoId) {
      setXCabecalho(null);
      return;
    }
    const { data, error } = await db.from("fiscal_nfe_cabecalho")
      .select("*, cadastro:cadastro_id(cadastro_id, cnpj, razao_social)")
      .eq("nfe_cabecalho_id", nfeCabecalhoId)
      .maybeSingle();
    if (!error && data) {
      setXCabecalho(data);
    }
  }, [nfeCabecalhoId]);

  const loadChavesRef = useCallback(async () => {
    if (!nfeCabecalhoId) {
      setXChavesRef([]);
      return;
    }
    const { data, error } = await db.from("fiscal_nfe_referenciada")
      .select("*")
      .eq("nfe_cabecalho_id", nfeCabecalhoId)
      .order("nfe_referenciada_id");
    if (!error && data) {
      setXChavesRef(data);
    }
  }, [nfeCabecalhoId]);

  useEffect(() => {
    loadCabecalho();
    loadChavesRef();
    setXCurrentIdx(null);
    setXMode(podeEditar ? "insert" : "view");
    setXF(formatItemForEdit(emptyItem()));
  }, [nfeCabecalhoId, loadCabecalho, loadChavesRef, podeEditar]);

  const recalculateNfeTotals = async (cabId: number) => {
    if (!cabId) return null;
    const { data: itens, error: errItens } = await db.from("fiscal_nfe_item")
      .select("*")
      .eq("nfe_cabecalho_id", cabId)
      .eq("excluido", false);

    if (errItens) return null;

    let vl_produto = 0;
    let vl_desconto = 0;
    let vl_frete = 0;
    let vl_seguro = 0;
    let vl_outro = 0;
    let vl_ipi = 0;
    let vl_icms = 0;
    let vl_icms_st = 0;
    let vl_pis = 0;
    let vl_cofins = 0;
    let vl_ibs = 0;
    let vl_cbs = 0;
    let vl_is = 0;
    let vl_bc = 0;
    let vl_bc_st = 0;
    let vl_fcp = 0;
    let vl_fcp_st = 0;
    let vl_fcp_st_ret = 0;
    let vl_icms_deson = 0;
    let vl_ii = 0;
    let vl_ipi_devol = 0;

    for (const item of (itens || [])) {
      const qtItem = Number(item.qt_entrada || 0);
      const vluItem = Number(item.vl_unit || 0);
      const descItem = Number(item.vl_desconto || 0);
      const totalBrutoItem = qtItem > 0 && vluItem > 0
        ? Math.round((qtItem * vluItem + Number.EPSILON) * 100) / 100
        : Math.round((Number(item.vl_total || 0) + descItem + Number.EPSILON) * 100) / 100;

      vl_produto += totalBrutoItem;
      vl_desconto += descItem;
      vl_frete += Number(item.vl_frete || 0);
      vl_seguro += Number(item.vl_seguro || 0);
      vl_outro += Number(item.vl_outro || 0);
      vl_ipi += Number(item.vl_ipi || 0);
      vl_icms += Number(item.vl_icms || 0);
      vl_icms_st += Number(item.vl_icms_st || 0);
      vl_pis += Number(item.vl_pis || 0);
      vl_cofins += Number(item.vl_cofins || 0);
      vl_ibs += Number(item.vl_ibs || 0);
      vl_cbs += Number(item.vl_cbs || 0);
      vl_is += Number(item.vl_is || 0);
      vl_bc += Number(item.vl_bc || 0);
      vl_bc_st += Number(item.vl_bc_st || 0);
      vl_fcp += Number(item.vl_fcp || 0);
      vl_fcp_st += Number(item.vl_fcp_st || 0);
      vl_fcp_st_ret += Number(item.vl_fcp_st_ret || 0);
      vl_icms_deson += Number(item.vl_icms_deson || 0);
      vl_ii += Number(item.vl_ii || 0);
      vl_ipi_devol += Number(item.vl_ipi_devol || 0);
    }

    vl_produto = Math.round((vl_produto + Number.EPSILON) * 100) / 100;
    vl_desconto = Math.round((vl_desconto + Number.EPSILON) * 100) / 100;
    vl_frete = Math.round((vl_frete + Number.EPSILON) * 100) / 100;
    vl_seguro = Math.round((vl_seguro + Number.EPSILON) * 100) / 100;
    vl_outro = Math.round((vl_outro + Number.EPSILON) * 100) / 100;
    vl_ipi = Math.round((vl_ipi + Number.EPSILON) * 100) / 100;
    vl_icms = Math.round((vl_icms + Number.EPSILON) * 100) / 100;
    vl_icms_st = Math.round((vl_icms_st + Number.EPSILON) * 100) / 100;
    vl_pis = Math.round((vl_pis + Number.EPSILON) * 100) / 100;
    vl_cofins = Math.round((vl_cofins + Number.EPSILON) * 100) / 100;
    vl_ibs = Math.round((vl_ibs + Number.EPSILON) * 100) / 100;
    vl_cbs = Math.round((vl_cbs + Number.EPSILON) * 100) / 100;
    vl_is = Math.round((vl_is + Number.EPSILON) * 100) / 100;
    vl_bc = Math.round((vl_bc + Number.EPSILON) * 100) / 100;
    vl_bc_st = Math.round((vl_bc_st + Number.EPSILON) * 100) / 100;
    vl_fcp = Math.round((vl_fcp + Number.EPSILON) * 100) / 100;
    vl_fcp_st = Math.round((vl_fcp_st + Number.EPSILON) * 100) / 100;
    vl_fcp_st_ret = Math.round((vl_fcp_st_ret + Number.EPSILON) * 100) / 100;
    vl_icms_deson = Math.round((vl_icms_deson + Number.EPSILON) * 100) / 100;
    vl_ii = Math.round((vl_ii + Number.EPSILON) * 100) / 100;
    vl_ipi_devol = Math.round((vl_ipi_devol + Number.EPSILON) * 100) / 100;

    const vl_total_nf = Math.round(
      (vl_produto - vl_desconto + vl_frete + vl_seguro + vl_outro + vl_icms_st + vl_ipi + vl_ibs + vl_cbs + vl_is + Number.EPSILON) * 100
    ) / 100;

    const totalsPayload = {
      vl_produto,
      vl_desconto,
      vl_frete,
      vl_seguro,
      vl_despesa: vl_outro,
      vl_outro,
      vl_ipi,
      vl_icms,
      vl_icms_st,
      vl_pis,
      vl_cofins,
      vl_ibs,
      vl_cbs,
      vl_is,
      vl_bc,
      vl_fcp,
      vl_fcp_st,
      vl_fcp_st_ret,
      vl_icms_deson,
      vl_ii,
      vl_ipi_devol,
      vl_total_nf,
    };

    await db.from("fiscal_nfe_cabecalho").update({
      ...totalsPayload,
      updated_at: new Date().toISOString()
    }).eq("nfe_cabecalho_id", cabId);

    if (onTotaisChanged) {
      onTotaisChanged({ vl_total: vl_total_nf, vl_ipi, vl_icms_st });
    }

    return totalsPayload;
  };



  const handleRemoverChaveRef = async (idx: number) => {
    const item = XChavesRef[idx];
    if (item.nfe_referenciada_id) {
      if (!confirm("Excluir esta chave referenciada e todos os seus itens importados?")) return;

      // 1. Buscar o XML completo na base local para saber quais itens deletar
      const { data: nfeRec } = await db.from("fiscal_nfe_recebida")
        .select("xml_completo")
        .eq("chave_nfe", item.chave_ref)
        .maybeSingle();

      const xmlString = nfeRec?.xml_completo;
      if (xmlString) {
        const dados = parseNfeXml(xmlString);
        if (dados) {
          // Loop para deduzir ou excluir os itens da grid
          for (const xmlItem of dados.itens) {
            const existingItem = XItens.find(it => it.cd_prod_fornec === xmlItem.cd_prod_fornec && !it.excluido);
            if (existingItem) {
              const currentQty = Number(existingItem.qt_entrada) || 0;
              const newQty = currentQty - xmlItem.qt_entrada;
              
              if (newQty <= 0) {
                // Soft delete do item
                await db.from("fiscal_nfe_item")
                  .update({ excluido: true, updated_at: new Date().toISOString() })
                  .eq("nfe_item_id", existingItem.nfe_item_id);
              } else {
                // Deduz valores proporcionalmente
                const novelTotal = Math.round((newQty * (Number(existingItem.vl_unit) || 0) + Number.EPSILON) * 100) / 100;
                await db.from("fiscal_nfe_item").update({
                  qt_entrada: newQty,
                  qt_tributavel: newQty,
                  vl_total: novelTotal,
                  vl_desconto: Math.max(0, (Number(existingItem.vl_desconto) || 0) - (xmlItem.vl_desconto || 0)),
                  vl_frete: Math.max(0, (Number(existingItem.vl_frete) || 0) - (xmlItem.vl_frete || 0)),
                  vl_seguro: Math.max(0, (Number(existingItem.vl_seguro) || 0) - (xmlItem.vl_seguro || 0)),
                  vl_outro: Math.max(0, (Number(existingItem.vl_outro) || 0) - (xmlItem.vl_outro || 0)),
                  vl_icms: Math.max(0, (Number(existingItem.vl_icms) || 0) - (xmlItem.vl_icms || 0)),
                  vl_icms_st: Math.max(0, (Number(existingItem.vl_icms_st) || 0) - (xmlItem.vl_icms_st || 0)),
                  vl_ipi: Math.max(0, (Number(existingItem.vl_ipi) || 0) - (xmlItem.vl_ipi || 0)),
                  vl_pis: Math.max(0, (Number(existingItem.vl_pis) || 0) - (xmlItem.vl_pis || 0)),
                  vl_cofins: Math.max(0, (Number(existingItem.vl_cofins) || 0) - (xmlItem.vl_cofins || 0)),
                  updated_at: new Date().toISOString()
                }).eq("nfe_item_id", existingItem.nfe_item_id);
              }
            }
          }
        }
      }

      // 2. Excluir o vínculo da chave referenciada
      const { error } = await db.from("fiscal_nfe_referenciada")
        .delete()
        .eq("nfe_referenciada_id", item.nfe_referenciada_id);

      if (error) {
        toast.error("Erro ao excluir chave: " + error.message);
        return;
      }
      toast.success("Chave referenciada e seus itens removidos com sucesso.");
      
      // 3. Recalcular os totais da NF-e e recarregar os dados
      const updatedTotais = await recalculateNfeTotals(nfeCabecalhoId);
      await loadItens();
      if (onRefreshCabecalho) onRefreshCabecalho(updatedTotais);
    }
    setXChavesRef(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUploadXml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Selecione um arquivo XML de NF-e.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = ev.target?.result as string;
      await processXmlImport(content);
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const processXmlImport = async (xmlString: string) => {
    try {
      const dados = parseNfeXml(xmlString);
      if (!dados) {
        toast.error("Não foi possível interpretar o arquivo XML. Verifique se é uma NF-e válida.");
        return;
      }

      const keyRef = dados.chave_nfe;
      if (!keyRef || keyRef.length !== 44) {
        toast.error("Chave de acesso inválida no XML.");
        return;
      }

      if (!nfeCabecalhoId) {
        toast.error("Salve a NF-e antes de importar.");
        return;
      }

      // Verificar se a chave já está referenciada na grid
      if (XChavesRef.some(ch => ch.chave_ref === keyRef)) {
        toast.error(`A chave ${keyRef} já está referenciada nesta nota.`);
        return;
      }

      // Validar destinatário
      const { data: cabRec, error: cabErr } = await db.from("fiscal_nfe_cabecalho")
        .select("cadastro_id, cadastro:cadastro_id(cnpj, razao_social)")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .maybeSingle();

      if (cabErr || !cabRec) {
        toast.error("Erro ao verificar destinatário da NF-e.");
        return;
      }

      const cnpjDestXml = dados.emitente.cnpj.replace(/\D/g, "");
      const cnpjDestCab = cabRec.cadastro?.cnpj?.replace(/\D/g, "") || "";

      if (cnpjDestXml !== cnpjDestCab) {
        toast.error(
          `O XML não pertence à empresa destinatária selecionada.\nEmitente XML: ${formatCPFCNPJ(cnpjDestXml)} (${dados.emitente.razao_social})\nDestinatário NF-e: ${formatCPFCNPJ(cnpjDestCab)} (${cabRec.cadastro?.razao_social || "Não identificado"})`
        );
        return;
      }

      // 1. Salvar a chave referenciada no banco de dados
      const { data: newRef, error: refErr } = await db.from("fiscal_nfe_referenciada")
        .insert({ nfe_cabecalho_id: nfeCabecalhoId, chave_ref: keyRef })
        .select()
        .single();

      if (refErr) {
        toast.error("Erro ao salvar chave referenciada no banco: " + refErr.message);
        return;
      }

      // 2. Salvar ou atualizar o XML completo em fiscal_nfe_recebida para deleções futuras
      await db.from("fiscal_nfe_recebida").upsert({
        empresa_id: empresaId,
        chave_nfe: keyRef,
        cnpj_emitente: dados.emitente.cnpj,
        nm_emitente: dados.emitente.razao_social,
        dt_emissao: dados.dt_emissao,
        vl_total: dados.vl_total_nf,
        nr_nota: dados.nr_nota,
        serie: dados.serie,
        xml_completo: xmlString,
        st_download: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "chave_nfe" });

      // 3. Buscar o depósito padrão para os itens importados
      const { data: depData } = await db.from("deposito")
        .select("deposito_id")
        .eq("excluido", false)
        .order("nome")
        .limit(1);
      const defaultDepositoId = depData?.[0]?.deposito_id || null;

      toast.loading("Processando itens do XML...", { id: "import-xml" });
      
      let itensAdicionados = 0;
      let itensAtualizados = 0;

      for (const xmlItem of dados.itens) {
        const existingItem = XItens.find(item => item.cd_prod_fornec === xmlItem.cd_prod_fornec && !item.excluido);

        let produtoId = null;
        if (!existingItem?.produto_id) {
          const { data: pfVinc } = await db.from("produto_fornecedor")
            .select("produto_id")
            .eq("empresa_id", empresaId)
            .eq("cadastro_id", cabRec.cadastro_id)
            .eq("cd_prod_fornec", xmlItem.cd_prod_fornec)
            .eq("excluido", false)
            .maybeSingle();
          if (pfVinc) {
            produtoId = pfVinc.produto_id;
          }
        } else {
          produtoId = existingItem.produto_id;
        }

        if (existingItem) {
          const novaQtd = (Number(existingItem.qt_entrada) || 0) + xmlItem.qt_entrada;
          const novoTotal = Math.round((novaQtd * (Number(existingItem.vl_unit) || 0) + Number.EPSILON) * 100) / 100;
          
          await db.from("fiscal_nfe_item").update({
            qt_entrada: novaQtd,
            qt_tributavel: novaQtd,
            vl_total: novoTotal,
            vl_desconto: (Number(existingItem.vl_desconto) || 0) + (xmlItem.vl_desconto || 0),
            vl_frete: (Number(existingItem.vl_frete) || 0) + (xmlItem.vl_frete || 0),
            vl_seguro: (Number(existingItem.vl_seguro) || 0) + (xmlItem.vl_seguro || 0),
            vl_outro: (Number(existingItem.vl_outro) || 0) + (xmlItem.vl_outro || 0),
            vl_icms: (Number(existingItem.vl_icms) || 0) + (xmlItem.vl_icms || 0),
            vl_icms_st: (Number(existingItem.vl_icms_st) || 0) + (xmlItem.vl_icms_st || 0),
            vl_ipi: (Number(existingItem.vl_ipi) || 0) + (xmlItem.vl_ipi || 0),
            vl_pis: (Number(existingItem.vl_pis) || 0) + (xmlItem.vl_pis || 0),
            vl_cofins: (Number(existingItem.vl_cofins) || 0) + (xmlItem.vl_cofins || 0),
            updated_at: new Date().toISOString()
          }).eq("nfe_item_id", existingItem.nfe_item_id);

          itensAtualizados++;
        } else {
          const payload = {
            nfe_cabecalho_id: nfeCabecalhoId,
            empresa_id: empresaId,
            produto_id: produtoId,
            deposito_id: defaultDepositoId,
            nr_item: XItens.length + itensAdicionados + 1,
            cd_prod_fornec: xmlItem.cd_prod_fornec,
            nm_produto: xmlItem.nm_produto.toUpperCase(),
            ncm: xmlItem.ncm?.replace(/\D/g, "") || "",
            cfop: xmlItem.cfop?.replace(/\D/g, "") || "",
            unidade: xmlItem.unidade || "",
            gtin: xmlItem.gtin?.replace(/\D/g, "") || "",
            origem: xmlItem.origem || 0,
            csosn: xmlItem.csosn?.replace(/\D/g, "") || "",
            cest: xmlItem.cest?.replace(/\D/g, "") || "",
            qt_entrada: xmlItem.qt_entrada,
            qt_tributavel: xmlItem.qt_entrada,
            vl_unit: xmlItem.vl_unit,
            vl_unit_tributavel: xmlItem.vl_unit,
            vl_desconto: xmlItem.vl_desconto || 0,
            vl_total: xmlItem.vl_total,
            cst_icms: xmlItem.cst_icms || "",
            vl_bc: xmlItem.vl_bc || 0,
            pc_icms: xmlItem.pc_icms || 0,
            vl_icms: xmlItem.vl_icms || 0,
            pc_fcp: xmlItem.pc_fcp || 0,
            vl_fcp: xmlItem.vl_fcp || 0,
            mod_bc_st: xmlItem.vl_bc_st ? 4 : 0,
            pc_mva: xmlItem.pc_mva || 0,
            vl_bc_st: xmlItem.vl_bc_st || 0,
            pc_icms_st: xmlItem.pc_icms_st || 0,
            vl_icms_st: xmlItem.vl_icms_st || 0,
            cst_ipi: xmlItem.cst_ipi || "",
            vl_bc_ipi: xmlItem.vl_bc_ipi || 0,
            pc_ipi: xmlItem.pc_ipi || 0,
            vl_ipi: xmlItem.vl_ipi || 0,
            cst_pis: xmlItem.cst_pis || "",
            vl_bc_pis: xmlItem.vl_bc_pis || 0,
            pc_pis: xmlItem.pc_pis || 0,
            vl_pis: xmlItem.vl_pis || 0,
            cst_cofins: xmlItem.cst_cofins || "",
            vl_bc_cofins: xmlItem.vl_bc_cofins || 0,
            pc_cofins: xmlItem.pc_cofins || 0,
            vl_cofins: xmlItem.vl_cofins || 0,
          };
          await db.from("fiscal_nfe_item").insert(payload);
          itensAdicionados++;
        }
      }

      const updatedTotais = await recalculateNfeTotals(nfeCabecalhoId);
      toast.success(`Importação concluída: Chave ${keyRef} registrada. ${itensAdicionados} itens novos adicionados e ${itensAtualizados} somados.`, { id: "import-xml" });
      
      await loadChavesRef();
      await loadItens();
      if (onRefreshCabecalho) onRefreshCabecalho(updatedTotais);

    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar XML: " + err.message, { id: "import-xml" });
    }
  };

  const loadItens = useCallback(async () => {
    if (!nfeCabecalhoId) {
      if (itensImportados) {
        setXItens(itensImportados as any[]);
      } else {
        setXItens([]);
      }
      return;
    }
    const { data, error } = await db.from("fiscal_nfe_item").select("*").eq("nfe_cabecalho_id", nfeCabecalhoId).eq("excluido", false).order("nr_item");
    if (error) { toast.error("Erro ao carregar itens: " + error.message); return; }

    const rows: XItemRow[] = data || [];
    const prodIds = [...new Set(rows.map((r) => r.produto_id).filter(Boolean))];
    const prodNames: Record<number, string> = {};
    const prodCodes: Record<number, string> = {};
    if (prodIds.length > 0) {
      const { data: prods } = await db.from("produto").select("produto_id, nome, cd_produto").in("produto_id", prodIds);
      (prods || []).forEach((p: any) => {
        prodNames[p.produto_id] = p.nome;
        prodCodes[p.produto_id] = p.cd_produto ? String(p.cd_produto) : "";
      });
    }
    const enriched = rows.map((r) => ({
      ...r,
      _produto_nome: r.produto_id ? (prodNames[r.produto_id] || String(r.produto_id)) : null,
      _produto_codigo: r.produto_id ? (prodCodes[r.produto_id] || String(r.produto_id)) : null
    }));
    setXItens(enriched);

    if (onTotaisChanged) {
      const vl_total = enriched.reduce((a: number, i) => a + Number(i.vl_total || 0), 0);
      const vl_ipi = enriched.reduce((a: number, i) => a + Number(i.vl_ipi || 0), 0);
      const vl_icms_st = enriched.reduce((a: number, i) => a + Number(i.vl_icms_st || 0), 0);
      onTotaisChanged({ vl_total, vl_ipi, vl_icms_st });
    }
  }, [nfeCabecalhoId, onTotaisChanged, itensImportados]);

  useEffect(() => {
    const loadProdutos = async () => {
      const { data } = await db.from("produto").select("produto_id, nome, referencia, cd_produto").eq("excluido", false).order("nome").limit(500);
      setXProdutos(data || []);
    };
    loadProdutos();
  }, []);

  useEffect(() => {
    const loadCfops = async () => {
      const { data } = await db.from("cfop").select("cd_cfop, descricao").or("excluido.is.null,excluido.eq.false").order("cd_cfop");
      const seen = new Set<string>();
      setXCfops((data || []).filter((c: any) => !seen.has(c.cd_cfop) && seen.add(c.cd_cfop)));
    };
    loadCfops();
    db.from("icms").select("icms_cst_csosn, icms_descricao, icms_tipo").order("icms_cst_csosn")
      .then(({ data }: any) => setXIcmsList(data || []));
    db.from("ipi").select("ipi_cst, ipi_descricao").order("ipi_cst")
      .then(({ data }: any) => setXIpiList(data || []));
  }, []);

  useEffect(() => {
    const loadUnidades = async () => {
      const { data } = await db.from("unidade").select("unidade_id, descricao").eq("excluido", false).order("unidade_id");
      setXUnidades(data || []);
    };
    loadUnidades();
  }, []);

  useEffect(() => {
    const loadIbsCbs = async () => {
      const { data } = await db.from("ibscbs").select("ibscbs_id, ibscbs_cst, ibscbs_descricao").order("ibscbs_cst");
      setXIbsCbs(data || []);
    };
    loadIbsCbs();
  }, []);

  useEffect(() => {
    const loadClasTrib = async () => {
      const { data } = await db.from("clas_trib").select("clas_trib_id, grupo_ibscbs_id, descricao").order("clas_trib_id");
      setXClasTrib(data || []);
    };
    loadClasTrib();
  }, []);

  const filteredClasTrib = useMemo(() => {
    const currentCst = XF.cst_ibs || XF.cst_cbs;
    if (!currentCst) return XClasTrib;
    const selectedIbsCbs = XIbsCbs.find(i => i.ibscbs_cst === currentCst);
    if (!selectedIbsCbs || !selectedIbsCbs.ibscbs_id) return XClasTrib;
    const filtered = XClasTrib.filter(c => c.grupo_ibscbs_id === selectedIbsCbs.ibscbs_id);
    return filtered.length > 0 ? filtered : XClasTrib;
  }, [XClasTrib, XIbsCbs, XF.cst_ibs, XF.cst_cbs]);

  useEffect(() => { loadItens(); }, [loadItens]);

  useEffect(() => {
    if (!nfeCabecalhoId && itensImportados) {
      setXItens(itensImportados as any[]);
    }
  }, [nfeCabecalhoId, itensImportados]);

  useEffect(() => {
    if (onItensChanged) {
      onItensChanged(XItens);
    }
  }, [XItens, onItensChanged]);

  const handleUpdateItemField = async (item: XItemRow, key: string, val: any) => {
    const itemIndex = XItens.findIndex(it => it.nr_item === item.nr_item);
    if (itemIndex === -1) return;
    const targetItem = XItens[itemIndex];
    
    // Update local state first
    const newItens = [...XItens];
    newItens[itemIndex] = {
      ...targetItem,
      [key]: val
    };
    setXItens(newItens);
    
    if (onItensImportadosChanged) {
      onItensImportadosChanged(newItens as any[]);
    }
    
    // If it's a saved note, write to database
    if (nfeCabecalhoId && targetItem.nfe_item_id) {
      const { error } = await db.from("fiscal_nfe_item")
        .update({ [key]: val, updated_at: new Date().toISOString() })
        .eq("nfe_item_id", targetItem.nfe_item_id);
      if (error) {
        toast.error("Erro ao atualizar item: " + error.message);
      }
    }
  };

  const handleSelectProduto = async (p: any) => {
    if (XSearchItemNr === null) return;
    const itemIndex = XItens.findIndex(it => it.nr_item === XSearchItemNr);
    if (itemIndex === -1) return;
    const item = XItens[itemIndex];
    const searchId = p?.produto_id || p?.cd_produto;

    let prodData = p;
    if (searchId) {
      const { data: fullP } = await db.from("produto")
        .select("produto_id, cd_produto, nome, unidade_id, gtin, ncm, cest, tb_a_origem, preco_venda, grupo_icms_id")
        .or(`produto_id.eq.${searchId},cd_produto.eq.${searchId}`)
        .limit(1)
        .maybeSingle();
      if (fullP) prodData = fullP;
    }

    const produtoId = prodData?.produto_id || p?.produto_id;

    let ncmVal = prodData?.ncm !== null && prodData?.ncm !== undefined && String(prodData.ncm).trim() !== ""
      ? onlyDigits(prodData.ncm, 8)
      : (p?.ncm ? onlyDigits(p.ncm, 8) : (item.ncm ? onlyDigits(item.ncm, 8) : ""));

    if (!ncmVal && prodData?.grupo_icms_id) {
      const { data: gIcms } = await db.from("grupo_icms_item")
        .select("ncm")
        .eq("grupo_icms_id", prodData.grupo_icms_id)
        .not("ncm", "is", null)
        .limit(1)
        .maybeSingle();
      if (gIcms?.ncm) {
        ncmVal = onlyDigits(gIcms.ncm, 8);
      }
    }

    if (!ncmVal && produtoId) {
      const { data: pastItem } = await db.from("fiscal_nfe_item")
        .select("ncm")
        .eq("produto_id", Number(produtoId))
        .not("ncm", "is", null)
        .neq("ncm", "")
        .order("nfe_item_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pastItem?.ncm) {
        ncmVal = onlyDigits(pastItem.ncm, 8);
      }
    }

    const cestVal = prodData?.cest !== null && prodData?.cest !== undefined && String(prodData.cest).trim() !== ""
      ? onlyDigits(prodData.cest, 7)
      : (p?.cest ? onlyDigits(p.cest, 7) : (item.cest ? onlyDigits(item.cest, 7) : ""));
    const gtinVal = prodData?.gtin ? String(prodData.gtin) : (p?.gtin ? String(p.gtin) : (item.gtin || ""));

    const produtoNome = prodData?.nome || p?.nome || item.nm_produto;
    const produtoCodigo = prodData?.cd_produto ? String(prodData.cd_produto) : String(produtoId || "");

    if (nfeCabecalhoId) {
      const { error } = await db.from("fiscal_nfe_item")
        .update({ 
          produto_id: produtoId,
          gtin: gtinVal,
          ncm: ncmVal,
          cest: cestVal,
          unidade: prodData?.unidade_id || item.unidade || "UN",
          origem: prodData?.tb_a_origem !== undefined && prodData?.tb_a_origem !== null && prodData?.tb_a_origem !== "" ? Number(prodData.tb_a_origem) : item.origem
        })
        .eq("nfe_item_id", item.nfe_item_id);

      if (error) {
        toast.error("Erro ao atualizar vínculo: " + error.message);
        return;
      }

      const { data: cabRec } = await db.from("fiscal_nfe_cabecalho")
        .select("cadastro_id")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .maybeSingle();

      if (cabRec?.cadastro_id && item.cd_prod_fornec) {
        await salvarVinculoProdutoFornecedor(
          empresaId,
          cabRec.cadastro_id,
          produtoId,
          item.cd_prod_fornec,
          item.nm_produto || "",
          1
        );
      }

      toast.success("Produto vinculado com sucesso!");
      loadItens();
    } else {
      const newItens = [...XItens];
      newItens[itemIndex] = {
        ...item,
        produto_id: produtoId,
        gtin: gtinVal,
        ncm: ncmVal,
        cest: cestVal,
        unidade: prodData?.unidade_id || item.unidade || "UN",
        _produto_nome: produtoNome,
        _produto_codigo: produtoCodigo,
      };
      setXItens(newItens);
      if (onItensImportadosChanged) {
        onItensImportadosChanged(newItens as any[]);
      }
      toast.success("Produto selecionado!");
    }
    setXSearchOpen(false);
    setXSearchItemNr(null);
  };

  const handleCadastrarProduto = () => {
    const existingTab = XTabs.find(t => t.component === "produtos");
    if (existingTab) closeTab(existingTab.id);
    openTab({
      title: "Produtos",
      component: "produtos",
    });
    toast.info("Cadastre o produto no estoque. Em seguida, retorne para esta tela para associar o item.");
  };

  const set = (key: string, val: XFieldValue) => setXF(prev => ({ ...prev, [key]: val }));
  const recalcTotal = (f: Partial<INfeItem>) => {
    const qt = parseNum(f.qt_entrada);
    const vlu = parseNum(f.vl_unit);
    const descUnit = parseNum(f.vl_desconto);
    const vlrLiq = parseNum((f as any).vl_unit_liquido) || Math.max(0, vlu - descUnit);
    return Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;
  };

  const updateCalculatedFields = (prev: XFormItem, key: string, newFormattedVal?: string): XFormItem => {
    const next = { ...prev, ...(newFormattedVal !== undefined ? { [key]: newFormattedVal } : {}) };
    const qt = parseNum(next.qt_entrada);
    const vlu = parseNum(next.vl_unit);

    if (key === "pc_desconto") {
      const pcd = parseNum(next.pc_desconto);
      const descUnit = Math.round((vlu * (pcd / 100) + Number.EPSILON) * 100) / 100;
      const vlrLiq = Math.max(0, Math.round((vlu - descUnit + Number.EPSILON) * 100) / 100);
      const total = Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;
      next.vl_desconto = fmtInput(descUnit, "vl_desconto");
      next.vl_unit_liquido = fmtInput(vlrLiq, "vl_unit_liquido");
      next.vl_total = fmtInput(total, "vl_total");
    } else if (key === "vl_desconto") {
      const descUnit = parseNum(next.vl_desconto);
      const pcd = vlu > 0 ? (descUnit / vlu) * 100 : 0;
      const vlrLiq = Math.max(0, Math.round((vlu - descUnit + Number.EPSILON) * 100) / 100);
      const total = Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;
      next.pc_desconto = fmtInput(pcd, "pc_desconto");
      next.vl_unit_liquido = fmtInput(vlrLiq, "vl_unit_liquido");
      next.vl_total = fmtInput(total, "vl_total");
    } else if (key === "vl_unit_liquido") {
      const vlrLiq = parseNum(next.vl_unit_liquido);
      const descUnit = Math.max(0, Math.round((vlu - vlrLiq + Number.EPSILON) * 100) / 100);
      const pcd = vlu > 0 ? (descUnit / vlu) * 100 : 0;
      const total = Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;
      next.pc_desconto = fmtInput(pcd, "pc_desconto");
      next.vl_desconto = fmtInput(descUnit, "vl_desconto");
      next.vl_total = fmtInput(total, "vl_total");
    } else if (key === "qt_entrada" || key === "vl_unit") {
      const pcd = parseNum(next.pc_desconto);
      let descUnit = parseNum(next.vl_desconto);
      if (pcd > 0) {
        descUnit = Math.round((vlu * (pcd / 100) + Number.EPSILON) * 100) / 100;
        next.vl_desconto = fmtInput(descUnit, "vl_desconto");
      } else if (descUnit > 0 && vlu > 0) {
        const newPcd = (descUnit / vlu) * 100;
        next.pc_desconto = fmtInput(newPcd, "pc_desconto");
      } else {
        descUnit = 0;
      }
      const vlrLiq = Math.max(0, Math.round((vlu - descUnit + Number.EPSILON) * 100) / 100);
      const total = Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;
      next.vl_unit_liquido = fmtInput(vlrLiq, "vl_unit_liquido");
      next.vl_total = fmtInput(total, "vl_total");
    } else if (key === "vl_total") {
      const total = parseNum(next.vl_total);
      const vlrLiq = qt > 0 ? Math.round((total / qt + Number.EPSILON) * 100) / 100 : 0;
      const descUnit = Math.max(0, Math.round((vlu - vlrLiq + Number.EPSILON) * 100) / 100);
      const pcd = vlu > 0 ? (descUnit / vlu) * 100 : 0;
      next.vl_unit_liquido = fmtInput(vlrLiq, "vl_unit_liquido");
      next.vl_desconto = fmtInput(descUnit, "vl_desconto");
      next.pc_desconto = fmtInput(pcd, "pc_desconto");
    }

    if (key === "vl_bc" || key === "pc_icms") {
      const bc = parseNum(next.vl_bc);
      const pc = parseNum(next.pc_icms);
      next.vl_icms = fmtInput(bc * (pc / 100), "vl_icms");
    }
    if (key === "vl_bc_pis" || key === "pc_pis") {
      const bc = parseNum(next.vl_bc_pis);
      const pc = parseNum(next.pc_pis);
      next.vl_pis = fmtInput(bc * (pc / 100), "vl_pis");
    }
    if (key === "vl_bc_cofins" || key === "pc_cofins") {
      const bc = parseNum(next.vl_bc_cofins);
      const pc = parseNum(next.pc_cofins);
      next.vl_cofins = fmtInput(bc * (pc / 100), "vl_cofins");
    }
    if (key === "vl_bc_ipi" || key === "pc_ipi") {
      const bc = parseNum(next.vl_bc_ipi);
      const pc = parseNum(next.pc_ipi);
      next.vl_ipi = fmtInput(bc * (pc / 100), "vl_ipi");
    }
    if (
      key === "vl_bc_ibscbs" ||
      key === "vl_bc" ||
      key === "pc_ibs" ||
      key === "pc_ibs_est" ||
      key === "pc_ibs_mun" ||
      key === "pc_red_bc_ibs" ||
      key === "pc_cbs" ||
      key === "pc_red_bc_cbs" ||
      key === "pc_is" ||
      key === "qt_entrada" ||
      key === "vl_unit" ||
      key === "vl_desconto" ||
      key === "pc_desconto" ||
      key === "vl_unit_liquido" ||
      key === "vl_total"
    ) {
      let bc = parseNum(next.vl_bc_ibscbs);
      if (key !== "vl_bc_ibscbs" && (bc === 0 || !next.vl_bc_ibscbs)) {
        bc = parseNum(next.vl_total) || parseNum(next.vl_bc);
        if (bc > 0) {
          next.vl_bc_ibscbs = fmtInput(bc, "vl_bc_ibscbs");
        }
      }

      // IBS
      const redIbs = parseNum(next.pc_red_bc_ibs);
      const bcRedIbs = bc * (1 - redIbs / 100);

      const pcEst = parseNum(next.pc_ibs_est);
      const pcMun = parseNum(next.pc_ibs_mun);
      const totalPcIbs = pcEst + pcMun;
      next.pc_ibs = fmtInput(totalPcIbs, "pc_ibs");

      const vlEst = Math.round((bcRedIbs * (pcEst / 100) + Number.EPSILON) * 100) / 100;
      const vlMun = Math.round((bcRedIbs * (pcMun / 100) + Number.EPSILON) * 100) / 100;
      const vlTotalIbs = Math.round((bcRedIbs * (totalPcIbs / 100) + Number.EPSILON) * 100) / 100;

      next.vl_ibs_est = fmtInput(vlEst, "vl_ibs_est");
      next.vl_ibs_mun = fmtInput(vlMun, "vl_ibs_mun");
      next.vl_ibs = fmtInput(vlTotalIbs, "vl_ibs");

      // CBS
      const redCbs = parseNum(next.pc_red_bc_cbs);
      const bcRedCbs = bc * (1 - redCbs / 100);
      const pcCbs = parseNum(next.pc_cbs);
      const vlCbs = Math.round((bcRedCbs * (pcCbs / 100) + Number.EPSILON) * 100) / 100;
      next.vl_cbs = fmtInput(vlCbs, "vl_cbs");

      // IS
      const pcIs = parseNum(next.pc_is);
      const vlIs = Math.round((bc * (pcIs / 100) + Number.EPSILON) * 100) / 100;
      next.vl_is = fmtInput(vlIs, "vl_is");
    }

    return next;
  };

  const handleBlur = (key: string) => {
    const current = XF[key];
    if (current === undefined || current === null || current === "") return;
    const formatted = fmtInput(current, key);
    setXF(prev => updateCalculatedFields(prev, key, formatted));
  };

  const handleSelectFormProduto = async (p: any) => {
    let prodData = p;
    const searchId = p?.produto_id || p?.cd_produto;
    if (searchId) {
      const { data: fullP } = await db.from("produto")
        .select("produto_id, cd_produto, nome, unidade_id, gtin, ncm, cest, mva, tb_a_origem, preco_venda, pc_ipi, pc_pis, pc_cofins, cst_icms, csosn, cst_ipi, cst_pis, cst_cofins, grupo_icms_id")
        .or(`produto_id.eq.${searchId},cd_produto.eq.${searchId}`)
        .limit(1)
        .maybeSingle();
      if (fullP) prodData = fullP;
    }

    let ncmVal = prodData?.ncm !== null && prodData?.ncm !== undefined && String(prodData.ncm).trim() !== ""
      ? onlyDigits(prodData.ncm, 8)
      : (p?.ncm ? onlyDigits(p.ncm, 8) : "");

    if (!ncmVal && prodData?.grupo_icms_id) {
      const { data: gIcms } = await db.from("grupo_icms_item")
        .select("ncm")
        .eq("grupo_icms_id", prodData.grupo_icms_id)
        .not("ncm", "is", null)
        .limit(1)
        .maybeSingle();
      if (gIcms?.ncm) {
        ncmVal = onlyDigits(gIcms.ncm, 8);
      }
    }

    const finalProdId = prodData?.produto_id || p?.produto_id;
    if (!ncmVal && finalProdId) {
      const { data: pastItem } = await db.from("fiscal_nfe_item")
        .select("ncm")
        .eq("produto_id", Number(finalProdId))
        .not("ncm", "is", null)
        .neq("ncm", "")
        .order("nfe_item_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pastItem?.ncm) {
        ncmVal = onlyDigits(pastItem.ncm, 8);
      }
    }

    const cestVal = prodData?.cest !== null && prodData?.cest !== undefined && String(prodData.cest).trim() !== ""
      ? onlyDigits(prodData.cest, 7)
      : (p?.cest ? onlyDigits(p.cest, 7) : "");

    setXF(prev => {
      const next = { ...prev };
      next.produto_id = prodData?.produto_id || p?.produto_id;
      next.nm_produto = prodData?.nome?.toUpperCase() || p?.nome?.toUpperCase() || "";
      next.gtin = prodData?.gtin ? String(prodData.gtin) : (p?.gtin ? String(p.gtin) : "");
      next.ncm = ncmVal;
      next.cest = cestVal;
      next.unidade = prodData?.unidade_id || prodData?.unidade || p?.unidade_id || p?.unidade || "UN";
      if (prodData?.tb_a_origem !== undefined && prodData?.tb_a_origem !== null && prodData?.tb_a_origem !== "") {
        next.origem = parseInt(String(prodData.tb_a_origem), 10) || 0;
      } else if (p?.tb_a_origem !== undefined && p?.tb_a_origem !== null && p?.tb_a_origem !== "") {
        next.origem = parseInt(String(p.tb_a_origem), 10) || 0;
      }
      if (prodData?.mva) next.pc_mva = fmtInput(prodData.mva, "pc_mva");
      if (prodData?.pc_ipi) next.pc_ipi = fmtInput(prodData.pc_ipi, "pc_ipi");
      if (prodData?.pc_pis) next.pc_pis = fmtInput(prodData.pc_pis, "pc_pis");
      if (prodData?.pc_cofins) next.pc_cofins = fmtInput(prodData.pc_cofins, "pc_cofins");
      if (prodData?.csosn) next.csosn = prodData.csosn;
      if (prodData?.cst_icms) next.cst_icms = prodData.cst_icms;
      if (prodData?.cst_ipi) next.cst_ipi = prodData.cst_ipi;
      if (prodData?.cst_pis) next.cst_pis = prodData.cst_pis;
      if (prodData?.cst_cofins) next.cst_cofins = prodData.cst_cofins;

      const unitPrice = prodData?.preco_venda || prodData?.vl_venda || p?.preco_venda;
      if (unitPrice) {
        next.vl_unit = fmtInput(unitPrice, "vl_unit");
        next.vl_total = fmtInput(recalcTotal({ ...next, vl_unit: unitPrice }), "vl_total");
      }
      return next;
    });
    setXSearchFormOpen(false);
    setTimeout(() => {
      unidadeSelectRef.current?.focus();
    }, 150);
  };

  const filteredCfops = useMemo(() => {
    const isEntrada = XCabecalho?.tp_nf === 0;
    if (isEntrada) {
      return XCfops.filter(c => {
        const cd = String(c.cd_cfop || "");
        return cd.startsWith("1") || cd.startsWith("2") || cd.startsWith("3");
      });
    } else {
      return XCfops.filter(c => {
        const cd = String(c.cd_cfop || "");
        return cd.startsWith("5") || cd.startsWith("6") || cd.startsWith("7");
      });
    }
  }, [XCfops, XCabecalho?.tp_nf]);

  const handleEditar = () => {
    if (XCurrentIdx === null) return;
    setXMode("edit");
    setXF(formatItemForEdit({ 
      ...XItens[XCurrentIdx], 
      produto_id: XItens[XCurrentIdx].produto_id || undefined,
      deposito_id: XItens[XCurrentIdx].deposito_id || undefined
    }));
  };

  const buildPayload = () => {
    const XPayload: XPayload = {
      nfe_cabecalho_id: nfeCabecalhoId,
      empresa_id: empresaId,
      produto_id: XF.produto_id ? Number(XF.produto_id) : null,
      deposito_id: XF.deposito_id ? Number(XF.deposito_id) : null,
      cfop_entrada: XF.cfop_entrada ? String(XF.cfop_entrada) : null,
      nr_item: parseInt(String(XF.nr_item || XItens.length + 1), 10) || XItens.length + 1,
    };

    XTextKeys.forEach((XKey) => {
      const XRaw = String(XF[XKey] ?? "").trim();
      if (["ncm", "cfop", "cest", "gtin", "csosn", "c_enq", "chave_ref_item"].includes(XKey)) {
        const dig = onlyDigits(XRaw, XKey === "ncm" ? 8 : XKey === "cfop" ? 4 : XKey === "cest" ? 7 : XKey === "chave_ref_item" ? 44 : undefined);
        XPayload[XKey] = dig || (XKey === "chave_ref_item" ? null : "");
      } else {
        XPayload[XKey] = XRaw.toUpperCase();
      }
    });

    XIntKeys.forEach((XKey) => {
      if (XKey !== "nr_item") {
        const val = parseInt(String(XF[XKey] || "0"), 10) || 0;
        XPayload[XKey] = (XKey === "nr_item_origem" && val === 0) ? null : val;
      }
    });

    XNumericKeys.forEach((XKey) => {
      XPayload[XKey] = parseNum(XF[XKey]);
    });

    XPayload.clas_trib_id = XF.clas_trib_id ? String(XF.clas_trib_id).trim() : null;

    const qt = parseNum(XF.qt_entrada);
    const vlu = parseNum(XF.vl_unit);
    const descUnit = parseNum(XF.vl_desconto);
    const vlrLiq = parseNum(XF.vl_unit_liquido) || Math.max(0, vlu - descUnit);
    const total = parseNum(XF.vl_total) || Math.round((qt * vlrLiq + Number.EPSILON) * 100) / 100;

    XPayload.vl_total = total;
    // No banco fiscal_nfe_item, vl_desconto é o desconto total do item
    const totalDesc = Math.max(0, Math.round(((qt * vlu) - total + Number.EPSILON) * 100) / 100);
    XPayload.vl_desconto = totalDesc;

    delete (XPayload as any).vl_unit_liquido;
    return XPayload;
  };

  const handleSalvar = async () => {
    if (!nfeCabecalhoId) { toast.error("Salve o cabeçalho da NF-e antes de gravar os itens."); return; }
    if (!XF.nm_produto?.trim()) { toast.error("Informe a descrição do produto."); return; }

    const payload = buildPayload();
    if (XMode === "edit" && XCurrentIdx !== null) {
      const { error } = await db.from("fiscal_nfe_item")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
      if (error) { toast.error("Erro ao atualizar item: " + error.message); return; }
      toast.success("Item atualizado.");
    } else {
      const { error } = await db.from("fiscal_nfe_item").insert(payload);
      if (error) { toast.error("Erro ao incluir item: " + error.message); return; }
      toast.success("Item incluído.");
    }

    // Sincroniza a chave referenciada no cabeçalho se preenchida com 44 dígitos
    if (payload.chave_ref_item && String(payload.chave_ref_item).length === 44 && nfeCabecalhoId) {
      const chaveClean = String(payload.chave_ref_item).trim();
      try {
        const { data: existingRef } = await db.from("fiscal_nfe_referenciada")
          .select("nfe_referenciada_id")
          .eq("nfe_cabecalho_id", nfeCabecalhoId)
          .eq("chave_ref", chaveClean)
          .maybeSingle();

        if (!existingRef) {
          await db.from("fiscal_nfe_referenciada").insert({
            nfe_cabecalho_id: nfeCabecalhoId,
            chave_ref: chaveClean,
          });
          await loadChavesRef();
        }
      } catch (eRef) {
        console.warn("Erro ao registrar chave referenciada do item:", eRef);
      }
    }

    const updatedTotais = await recalculateNfeTotals(nfeCabecalhoId);
    
    let count = XItens.length + 1;
    if (nfeCabecalhoId) {
      const { data: updatedItens } = await db.from("fiscal_nfe_item")
        .select("nfe_item_id")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .eq("excluido", false);
      if (updatedItens) count = updatedItens.length;
    }

    setXMode("insert");
    setXCurrentIdx(null);
    setXF(formatItemForEdit({ ...emptyItem(), nr_item: count + 1 }));
    await loadItens();
    if (onRefreshCabecalho) onRefreshCabecalho(updatedTotais);
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 150);
  };

  const handleExcluir = async () => {
    if (XCurrentIdx === null) return;
    if (!confirm("Excluir este item?")) return;
    const { error } = await db.from("fiscal_nfe_item")
      .update({ excluido: true, updated_at: new Date().toISOString() })
      .eq("nfe_item_id", XItens[XCurrentIdx].nfe_item_id);
    if (error) { toast.error("Erro ao excluir item: " + error.message); return; }
    toast.success("Item excluído.");
    setXCurrentIdx(null);
    const updatedTotaisExcluir = await recalculateNfeTotals(nfeCabecalhoId);
    await loadItens();
    if (onRefreshCabecalho) onRefreshCabecalho(updatedTotaisExcluir);
  };

  const isEditing = XMode === "edit" || XMode === "insert";
  const inputCls = "w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none disabled:opacity-70";
  const readCls = "w-full border border-border rounded px-2 py-1.5 text-sm bg-secondary text-right";

  const renderTxt = ({ k, label, span = 2, digits, max, upper = true, right = false }: XTextInputProps) => (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={String(XF[k] ?? "")}
        onChange={e => {
          const XVal = digits ? onlyDigits(e.target.value, max) : (upper ? e.target.value.toUpperCase() : e.target.value);
          set(k, XVal);
        }}
        className={`${inputCls} ${right ? "text-right" : ""}`}
        inputMode={digits ? "numeric" : "text"}
        maxLength={max}
      />
    </div>
  );

  const renderNum = ({ k, label, span = 2, readOnly = false }: XNumInputProps) => {
    const dec = decimalsFor(k);
    return (
      <div style={{ gridColumn: `span ${span} / span ${span}` }}>
        <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
        <input
          type="text"
          value={String(XF[k] ?? "")}
          onBlur={() => handleBlur(k)}
          onKeyDown={e => {
            if (e.key === "Enter" && (k === "vl_total" || k === "vl_desconto")) {
              e.preventDefault();
              e.stopPropagation();
              salvarBtnRef.current?.focus();
            }
          }}
          onChange={e => {
            if (readOnly) return;
            const val = e.target.value;
            const formatted = formatNumericInput(val, dec);
            setXF(prev => updateCalculatedFields(prev, k, formatted));
          }}
          readOnly={readOnly}
          className={`${readOnly ? readCls : inputCls} text-right font-mono`}
          inputMode="numeric"
        />
      </div>
    );
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <fieldset className="border border-border rounded p-3">
      <legend className="text-xs font-medium text-muted-foreground px-2">{title}</legend>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </fieldset>
  );

  const gridColumns = useMemo<IGridColumn[]>(() => {
    const cols: IGridColumn[] = [
      { key: "nr_item",       label: "Item",        width: "60px",   align: "right" },
    ];

    if (!hideVinculo) {
      cols.push({ 
        key: "_produto",      
        label: "Vincular Produto Estoque",     
        width: "140px",    
        render: (r) => {
          const hasVinc = !!r.produto_id;
          return (
            <button
              type="button"
              disabled={!podeEditar}
              onClick={() => {
                setXSearchItemNr(r.nr_item);
                setXSearchOpen(true);
              }}
              className={`w-full flex items-center justify-between gap-1 px-2 py-0.5 border rounded text-xs select-none transition-all outline-none text-left min-h-[26px] ${
                hasVinc 
                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10" 
                  : "border-input bg-card hover:bg-accent text-muted-foreground"
              }`}
            >
              <span className="truncate">
                {r.produto_id ? String(r._produto_codigo || "") : ""}
              </span>
              <Search className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1" />
            </button>
          );
        }
      });
    }

    cols.push(
      { key: "nm_produto",    label: "Desc. NF",    width: "1fr" },
      { key: "cfop",          label: hideVinculo ? "CFOP" : "CFOP Orig.", width: "95px" },
    );

    if (!hideVinculo) {
      cols.push({ 
        key: "cfop_entrada",  
        label: "CFOP Ent.",    
        width: "90px", 
        render: (r) => {
          const origCfop = String(r.cfop || "").trim();
          const firstChar = origCfop.charAt(0);
          
          let allowedPrefix = "1";
          if (firstChar === "2" || firstChar === "6") {
            allowedPrefix = "2";
          } else if (firstChar === "3" || firstChar === "7") {
            allowedPrefix = "3";
          } else if (firstChar === "1" || firstChar === "5") {
            allowedPrefix = "1";
          }
          
          const filteredCfops = XCfops.filter(c => String(c.cd_cfop || "").startsWith(allowedPrefix));
          const selectedCfop = filteredCfops.find(c => c.cd_cfop === r.cfop_entrada);
          
          return (
            <select
              disabled={!podeEditar}
              value={r.cfop_entrada ?? ""}
              title={selectedCfop ? selectedCfop.descricao : "Selecione o CFOP de Entrada"}
              onChange={async (e) => {
                await handleUpdateItemField(r, "cfop_entrada", e.target.value || null);
              }}
              style={{ width: "70px" }}
              className="border border-border rounded px-1.5 py-0.5 text-xs bg-card focus:ring-1 focus:ring-ring outline-none truncate"
            >
              <option value="">—</option>
              {filteredCfops.map(c => (
                <option key={c.cd_cfop} value={c.cd_cfop} title={c.descricao}>
                  {c.cd_cfop} — {c.descricao}
                </option>
              ))}
            </select>
          );
        }
      });
    }

    cols.push(
      { key: "unidade",       label: "Un.",         width: "60px",   align: "center" },
      { key: "qt_entrada",    label: "Qtd.",        width: "90px",   align: "right", render: (r) => fmt4(r.qt_entrada) },
      { key: "vl_unit",       label: "Vlr. Unit.",  width: "90px",   align: "right", render: (r) => fmt2(r.vl_unit) },
      { key: "pc_desconto",   label: "Desc. (%)",   width: "70px",   align: "right", render: (r) => fmt2(r.pc_desconto) },
      { 
        key: "vl_desconto", 
        label: "Desc. ($)", 
        width: "90px", 
        align: "right", 
        render: (r) => {
          const qt = Number(r.qt_entrada || 0);
          const vld = Number(r.vl_desconto || 0);
          const unitDesc = qt > 0 ? (vld / qt) : vld;
          return fmt2(unitDesc);
        }
      },
      { 
        key: "vl_unit_liquido", 
        label: "Vlr. Líquido", 
        width: "95px", 
        align: "right", 
        render: (r) => {
          const qt = Number(r.qt_entrada || 0);
          const vlt = Number(r.vl_total || 0);
          const vlu = Number(r.vl_unit || 0);
          const vld = Number(r.vl_desconto || 0);
          const unitDesc = qt > 0 ? (vld / qt) : vld;
          const liq = qt > 0 ? (vlt / qt) : (vlu - unitDesc);
          return fmt2(liq);
        }
      },
      { key: "vl_total",      label: "Total",       width: "90px",   align: "right", render: (r) => fmt2(r.vl_total) }
    );

    if (isDevolucao) {
      cols.push(
        {
          key: "chave_ref_item",
          label: "Chave NF-e Origem",
          width: "160px",
          render: (r) => {
            if (!r.chave_ref_item) return <span className="text-muted-foreground text-[10px] italic">—</span>;
            const ch = String(r.chave_ref_item);
            return (
              <span className="font-mono text-[10px] text-foreground truncate block" title={`Chave da NF-e de Origem: ${ch}`}>
                {ch.length === 44 ? `...${ch.slice(-14)}` : ch}
              </span>
            );
          }
        },
        {
          key: "nr_item_origem",
          label: "Nº Item Origem",
          width: "110px",
          align: "center",
          render: (r) => {
            return r.nr_item_origem ? (
              <span className="font-semibold text-xs text-foreground">#{r.nr_item_origem}</span>
            ) : (
              <span className="text-muted-foreground text-[10px] italic">—</span>
            );
          }
        }
      );
    }

    if (podeEditar) {
      cols.push({
        key: "_acoes",
        label: "Ações",
        width: "75px",
        align: "center",
        render: (r, idx) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              title="Editar item"
              onClick={(e) => {
                e.stopPropagation();
                setXCurrentIdx(idx);
                setXMode("edit");
                setXF(formatItemForEdit({
                  ...r,
                  produto_id: r.produto_id || undefined,
                  deposito_id: r.deposito_id || undefined,
                }));
                setTimeout(() => {
                  productInputRef.current?.focus();
                }, 150);
              }}
              className="p-1 border border-border rounded text-primary hover:bg-primary/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Excluir item"
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm(`Excluir o item ${r.nr_item} - ${r.nm_produto}?`)) return;
                if (r.nfe_item_id) {
                  const { error } = await db.from("fiscal_nfe_item")
                    .update({ excluido: true, updated_at: new Date().toISOString() })
                    .eq("nfe_item_id", r.nfe_item_id);
                  if (error) { toast.error("Erro ao excluir item: " + error.message); return; }
                }
                toast.success("Item excluído.");
                setXCurrentIdx(null);
                let updatedTotais = null;
                if (nfeCabecalhoId) updatedTotais = await recalculateNfeTotals(nfeCabecalhoId);
                await loadItens();
                if (onRefreshCabecalho) onRefreshCabecalho(updatedTotais);
              }}
              className="p-1 border border-destructive/30 rounded text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      });
    }

    return cols;
  }, [podeEditar, hideVinculo, XCfops, XItens, nfeCabecalhoId, loadItens, onRefreshCabecalho, isDevolucao]);

  return (
    <div className="space-y-4">
      {/* Grid de Chaves NF-e Referenciadas (Origem) */}
      {!hideVinculo && Number(finNfe) === 4 && (
        <div className="border border-border rounded-lg p-4 bg-card shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Key className="w-4 h-4 text-primary" />
                Chaves NF-e Referenciadas (Origem)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Insira as chaves referenciadas e faça a importação do XML para atualizar os itens a serem devolvidos.
              </p>
            </div>
            {podeEditar && (
              <>
                <input
                  type="file"
                  id="file-xml-add"
                  accept=".xml"
                  className="hidden"
                  onChange={handleUploadXml}
                />
                <button
                  type="button"
                  disabled={!nfeCabecalhoId}
                  onClick={() => document.getElementById("file-xml-add")?.click()}
                  className="px-2.5 py-1 text-xs font-bold border border-primary/20 text-primary rounded bg-primary/5 hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none transition-all uppercase"
                  title={!nfeCabecalhoId ? "Salve a nota fiscal antes de gerenciar chaves referenciadas" : ""}
                >
                  + Adicionar Chave (Importar XML)
                </button>
              </>
            )}
          </div>

          <div className="space-y-3">
            {XChavesRef.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">
                {!nfeCabecalhoId 
                  ? "Salve a NF-e para gerenciar as chaves de origem." 
                  : "Nenhuma chave referenciada vinculada. Clique em \"Adicionar Chave (Importar XML)\" para começar."}
              </p>
            ) : (
              <div className="grid grid-cols-12 gap-3 font-semibold text-xs text-muted-foreground px-2">
                <div className="col-span-11">Chave de Acesso (44 dígitos)</div>
                <div className="col-span-1 text-right">Ações</div>
              </div>
            )}

            {XChavesRef.map((ch, idx) => (
              <div key={ch.nfe_referenciada_id || idx} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-11 relative">
                  <input
                    type="text"
                    readOnly
                    value={ch.chave_ref || ""}
                    className="w-full border border-border rounded pl-3 pr-12 py-1.5 text-xs font-mono bg-secondary text-foreground outline-none cursor-default"
                    placeholder="Chave de acesso carregada do XML"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-mono">
                    {(ch.chave_ref || "").length}/44
                  </span>
                </div>
                <div className="col-span-1 flex items-center justify-end">
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => handleRemoverChaveRef(idx)}
                      className="p-1.5 border border-destructive/20 text-destructive rounded hover:bg-destructive/5 transition-colors"
                      title="Remover chave e excluir itens correspondentes"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {isEditing && (
        <div className="p-3 bg-card rounded border border-border space-y-3 max-h-[70vh] overflow-y-auto" onKeyDown={handleKeyDown}>
          {renderSection("Identificação", (
            <>
              {renderNum({ k: "nr_item", label: "Item", span: 1 })}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Produto <span className="text-destructive">*</span></label>
                <input
                  ref={productInputRef}
                  type="text"
                  readOnly
                  placeholder="Pressione Enter para pesquisar..."
                  value={
                    XF.produto_id 
                      ? (XProdutos.find(p => p.produto_id === XF.produto_id)?.cd_produto 
                          ? String(XProdutos.find(p => p.produto_id === XF.produto_id)?.cd_produto) 
                          : (XProdutos.find(p => p.produto_id === XF.produto_id)?.nome || String(XF.produto_id)))
                      : ""
                  }
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!XF.produto_id) {
                        setXSearchFormOpen(true);
                      } else {
                        unidadeSelectRef.current?.focus();
                      }
                    }
                  }}
                  onClick={() => setXSearchFormOpen(true)}
                  className={`${inputCls} bg-secondary/50 cursor-pointer focus:ring-2 focus:ring-ring focus:outline-none`}
                />
              </div>
              <div className="col-span-5">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição NF</label>
                <input value={XF.nm_produto || ""} onChange={e => set("nm_produto", e.target.value.toUpperCase())} className={inputCls} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Un.</label>
                <select
                  ref={unidadeSelectRef}
                  value={XF.unidade || ""}
                  onChange={e => set("unidade", e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {XUnidades.map(u => (
                    <option key={u.unidade_id} value={u.unidade_id} title={u.descricao}>
                      {u.unidade_id}
                    </option>
                  ))}
                </select>
              </div>
              {renderTxt({ k: "gtin", label: "GTIN", span: 3, digits: true, max: 14 })}
              {renderTxt({ k: "ncm", label: "NCM", span: 2, digits: true, max: 8 })}
              {renderTxt({ k: "cest", label: "CEST", span: 1, digits: true, max: 7 })}
              {renderNum({ k: "qt_entrada", label: "Quantidade", span: 2 })}
              {renderNum({ k: "vl_unit", label: "Valor Unitário", span: 2 })}
              {renderNum({ k: "pc_desconto", label: "Desc. (%)", span: 1 })}
              {renderNum({ k: "vl_desconto", label: "Desc. ($)", span: 1 })}
              {renderNum({ k: "vl_unit_liquido", label: "Vlr Liquido", span: 1 })}
              {renderNum({ k: "vl_total", label: "Total", span: 2 })}
            </>
          ))}

          <div className="border border-border rounded-lg p-3 bg-card space-y-3">
            <div className="flex border-b border-border gap-1 pb-1 flex-wrap">
              <button
                type="button"
                onClick={() => setXTributoTab("regras")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "regras" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                Regras Fiscais & Operação
              </button>
              <button
                type="button"
                onClick={() => setXTributoTab("icms")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "icms" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                ICMS
              </button>
              <button
                type="button"
                onClick={() => setXTributoTab("pis_cofins")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "pis_cofins" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                PIS / COFINS
              </button>
              <button
                type="button"
                onClick={() => setXTributoTab("icms_st")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "icms_st" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                ICMS-ST / Crédito SN
              </button>
              <button
                type="button"
                onClick={() => setXTributoTab("ipi")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "ipi" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                IPI
              </button>
              <button
                type="button"
                onClick={() => setXTributoTab("ibs_cbs")}
                className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "ibs_cbs" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
              >
                IBS / CBS (Reforma)
              </button>
              {isDevolucao && (
                <button
                  type="button"
                  onClick={() => setXTributoTab("dfe_referenciado")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-t-md transition-colors ${XTributoTab === "dfe_referenciado" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                >
                  NF-e Referenciada
                </button>
              )}
            </div>

            <div className="pt-1">
              {XTributoTab === "regras" && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Origem</label>
                    <select 
                      value={XF.origem ?? 0} 
                      onChange={e => set("origem", parseInt(e.target.value, 10))} 
                      className={inputCls}
                    >
                      <option value={0}>0 - Nacional, exceto indicada em 3 a 5, 8</option>
                      <option value={1}>1 - Estrangeira - Importação direta</option>
                      <option value={2}>2 - Estrangeira - Adquirida no mercado interno</option>
                      <option value={3}>3 - Nacional, Conteúdo de Importação &gt; 40% e &lt;= 70%</option>
                      <option value={4}>4 - Nacional, PPB (Processo Produtivo Básico)</option>
                      <option value={5}>5 - Nacional, Conteúdo de Importação &lt;= 40%</option>
                      <option value={6}>6 - Estrangeira - Importação direta, sem similar (CAMEX)</option>
                      <option value={7}>7 - Estrangeira - Adquirida mercado interno, sem similar (CAMEX)</option>
                      <option value={8}>8 - Nacional, Conteúdo de Importação &gt; 70%</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST / CSOSN <span className="text-destructive">*</span></label>
                    <select 
                      value={XF.csosn || XF.cst_icms || ""} 
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) {
                          setXF(prev => ({ ...prev, csosn: "", cst_icms: "" }));
                        } else if (val.length === 3) {
                          setXF(prev => ({ ...prev, csosn: val, cst_icms: "" }));
                        } else {
                          setXF(prev => ({ ...prev, cst_icms: val, csosn: "" }));
                        }
                      }} 
                      className={inputCls}
                    >
                      <option value="">— Selecione —</option>
                      <optgroup label="CST (Regime Normal)">
                        {XIcmsList.filter(i => String(i.icms_cst_csosn || "").length !== 3).map(i => (
                          <option key={i.icms_cst_csosn} value={i.icms_cst_csosn}>{i.icms_cst_csosn} - {i.icms_descricao}</option>
                        ))}
                      </optgroup>
                      <optgroup label="CSOSN (Simples Nacional)">
                        {XIcmsList.filter(i => String(i.icms_cst_csosn || "").length === 3).map(i => (
                          <option key={i.icms_cst_csosn} value={i.icms_cst_csosn}>{i.icms_cst_csosn} - {i.icms_descricao}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CFOP <span className="text-destructive">*</span></label>
                    <select
                      value={XF.cfop ?? ""}
                      onChange={e => set("cfop", e.target.value || "")}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          salvarBtnRef.current?.focus();
                        }
                      }}
                      className={inputCls}
                    >
                      <option value="">— Selecione —</option>
                      {filteredCfops.map(c => (
                        <option key={c.cd_cfop} value={c.cd_cfop} title={c.descricao}>
                          {c.cd_cfop} — {c.descricao}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {XTributoTab === "icms" && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Mod. BC ICMS</label>
                    <select 
                      value={XF.mod_bc ?? 3} 
                      onChange={e => set("mod_bc", parseInt(e.target.value, 10))} 
                      className={inputCls}
                    >
                      <option value={0}>0 - Margem Valor Agregado (%)</option>
                      <option value={1}>1 - Pauta (Valor)</option>
                      <option value={2}>2 - Preço Tabelado Máx. (valor)</option>
                      <option value={3}>3 - Valor da operação</option>
                    </select>
                  </div>
                  {renderNum({ k: "vl_bc", label: "BC ICMS", span: 2 })}
                  {renderNum({ k: "pc_red_bc", label: "Red. BC %", span: 2 })}
                  {renderNum({ k: "pc_icms", label: "ICMS %", span: 2 })}
                  {renderNum({ k: "vl_icms", label: "Vlr. ICMS", span: 2 })}
                  {renderNum({ k: "vl_icms_deson", label: "ICMS Deson.", span: 3 })}
                </div>
              )}

              {XTributoTab === "icms_st" && (
                <div className="grid grid-cols-12 gap-3">
                  {renderNum({ k: "mod_bc_st", label: "Mod. BC ST", span: 2 })}
                  {renderNum({ k: "pc_mva", label: "MVA %", span: 2 })}
                  {renderNum({ k: "vl_bc_st", label: "BC ST", span: 2 })}
                  {renderNum({ k: "pc_red_bc_st", label: "Red. BC ST %", span: 2 })}
                  {renderNum({ k: "pc_icms_st", label: "ICMS-ST %", span: 2 })}
                  {renderNum({ k: "vl_icms_st", label: "Vlr. ICMS-ST", span: 2 })}
                  {renderNum({ k: "pc_cred_sn", label: "Créd. SN %", span: 2 })}
                  {renderNum({ k: "vl_cred_sn", label: "Vlr. Créd. SN", span: 2 })}
                </div>
              )}

              {XTributoTab === "ipi" && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST IPI</label>
                    <select value={XF.cst_ipi ?? ""} onChange={e => set("cst_ipi", e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {XIpiList.map(i => (
                        <option key={i.ipi_cst} value={i.ipi_cst}>{i.ipi_cst} - {i.ipi_descricao}</option>
                      ))}
                    </select>
                  </div>
                  {renderTxt({ k: "c_enq", label: "cEnq (Enquadramento)", span: 3, digits: true, max: 3 })}
                  {renderNum({ k: "vl_bc_ipi", label: "BC IPI", span: 2 })}
                  {renderNum({ k: "pc_ipi", label: "IPI %", span: 2 })}
                  {renderNum({ k: "vl_ipi", label: "Vlr. IPI", span: 2 })}
                </div>
              )}

              {XTributoTab === "pis_cofins" && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST PIS</label>
                    <select value={XF.cst_pis ?? ""} onChange={e => set("cst_pis", e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      <option value="01">01 - Tributada Básica</option>
                      <option value="02">02 - Tributada Diferenciada</option>
                      <option value="03">03 - Unidade de Medida</option>
                      <option value="04">04 - Monofásica - Alíquota Zero</option>
                      <option value="05">05 - Substituição Tributária</option>
                      <option value="06">06 - Alíquota Zero</option>
                      <option value="07">07 - Isenta</option>
                      <option value="08">08 - Sem Incidência</option>
                      <option value="09">09 - Suspensão</option>
                      <option value="49">49 - Outras Operações Saída</option>
                      <option value="50">50 - Direito a Crédito (Entrada)</option>
                      <option value="99">99 - Outras Operações</option>
                    </select>
                  </div>
                  {renderNum({ k: "vl_bc_pis", label: "BC PIS", span: 3 })}
                  {renderNum({ k: "pc_pis", label: "PIS %", span: 3 })}
                  {renderNum({ k: "vl_pis", label: "Vlr. PIS", span: 3 })}
                  <div className="col-span-3">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST COFINS</label>
                    <select value={XF.cst_cofins ?? ""} onChange={e => set("cst_cofins", e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      <option value="01">01 - Tributada Básica</option>
                      <option value="02">02 - Tributada Diferenciada</option>
                      <option value="03">03 - Unidade de Medida</option>
                      <option value="04">04 - Monofásica - Alíquota Zero</option>
                      <option value="05">05 - Substituição Tributária</option>
                      <option value="06">06 - Alíquota Zero</option>
                      <option value="07">07 - Operação Isenta</option>
                      <option value="08">08 - Sem Incidência</option>
                      <option value="09">09 - Suspensão</option>
                      <option value="49">49 - Outras Operações Saída</option>
                      <option value="50">50 - Direito a Crédito (Entrada)</option>
                      <option value="99">99 - Outras Operações</option>
                    </select>
                  </div>
                  {renderNum({ k: "vl_bc_cofins", label: "BC COFINS", span: 3 })}
                  {renderNum({ k: "pc_cofins", label: "COFINS %", span: 3 })}
                  {renderNum({ k: "vl_cofins", label: "Vlr. COFINS", span: 3 })}
                </div>
              )}

              {XTributoTab === "ibs_cbs" && (
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST IBS/CBS</label>
                    <select 
                      value={XF.cst_ibs || XF.cst_cbs || ""} 
                      onChange={e => {
                        const val = e.target.value;
                        setXF(prev => ({ ...prev, cst_ibs: val, cst_cbs: val }));
                      }} 
                      className={inputCls}
                    >
                      <option value="">— Selecione —</option>
                      {XIbsCbs.map(i => (
                        <option key={i.ibscbs_id || i.ibscbs_cst} value={i.ibscbs_cst} title={i.ibscbs_descricao}>
                          {i.ibscbs_cst} — {i.ibscbs_descricao}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-5">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Classificação Tributária (cClassTrib)</label>
                    <select
                      value={XF.clas_trib_id || ""}
                      onChange={e => set("clas_trib_id", e.target.value || null)}
                      className={inputCls}
                    >
                      <option value="">— Selecione —</option>
                      {filteredClasTrib.map(c => (
                        <option key={c.clas_trib_id} value={c.clas_trib_id} title={c.descricao}>
                          {c.clas_trib_id} — {c.descricao}
                        </option>
                      ))}
                    </select>
                  </div>

                  {renderNum({ k: "vl_bc_ibscbs", label: "Base de Cálculo IBS/CBS", span: 3 })}

                  {renderNum({ k: "pc_ibs_est", label: "IBS Estadual %", span: 2 })}
                  {renderNum({ k: "vl_ibs_est", label: "Vlr. IBS Est.", span: 2, readOnly: true })}
                  {renderNum({ k: "pc_ibs_mun", label: "IBS Municipal %", span: 2 })}
                  {renderNum({ k: "vl_ibs_mun", label: "Vlr. IBS Mun.", span: 2, readOnly: true })}
                  {renderNum({ k: "pc_red_bc_ibs", label: "Red. BC IBS %", span: 2 })}
                  {renderNum({ k: "vl_ibs", label: "Vlr. IBS Total", span: 2, readOnly: true })}

                  {renderNum({ k: "pc_cbs", label: "CBS %", span: 4 })}
                  {renderNum({ k: "pc_red_bc_cbs", label: "Red. BC CBS %", span: 4 })}
                  {renderNum({ k: "vl_cbs", label: "Vlr. CBS", span: 4, readOnly: true })}

                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">CST IS (Imposto Seletivo)</label>
                    <select value={XF.cst_is ?? ""} onChange={e => set("cst_is", e.target.value)} className={inputCls}>
                      <option value="">— Selecione —</option>
                      <option value="01">01 - Tributada Integralmente</option>
                      <option value="02">02 - Alíquota Zero</option>
                      <option value="03">03 - Isenta / Não Incidência</option>
                      <option value="04">04 - Suspensão</option>
                      <option value="09">09 - Outras Operações</option>
                    </select>
                  </div>
                  {renderNum({ k: "pc_is", label: "IS %", span: 4 })}
                  {renderNum({ k: "vl_is", label: "Vlr. IS", span: 4, readOnly: true })}
                </div>
              )}

              {isDevolucao && XTributoTab === "dfe_referenciado" && (
                <div className="grid grid-cols-12 gap-3 p-3 bg-card rounded-md border border-border">
                  <div className="col-span-12 sm:col-span-8">
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Chave da NF-e de Origem (DFEreferenciado) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={String(XF.chave_ref_item ?? "")}
                      onChange={e => {
                        const val = onlyDigits(e.target.value, 44);
                        set("chave_ref_item", val);
                      }}
                      placeholder="Informe os 44 dígitos da chave de acesso da NF-e original..."
                      className={`${inputCls} font-mono text-xs`}
                      maxLength={44}
                    />
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        Chave de acesso da nota de origem devolvida/retornada (tag &lt;DFeReferenciado&gt;&lt;chaveAcesso&gt;)
                      </span>
                      <span className={`text-[11px] font-mono font-medium ${(String(XF.chave_ref_item || "")).length === 44 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {(String(XF.chave_ref_item || "")).length}/44 dígitos
                      </span>
                    </div>
                  </div>

                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Nº do Item na NF-e de Origem <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={XF.nr_item_origem ? String(XF.nr_item_origem) : ""}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        set("nr_item_origem", isNaN(v) ? 0 : v);
                      }}
                      placeholder="Ex: 1"
                      className={`${inputCls} text-right font-semibold text-xs`}
                    />
                    <span className="block text-[11px] text-muted-foreground mt-1">
                      Número sequencial do item na nota de origem (tag &lt;nItem&gt;)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>


          <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-card border-t border-border">
            <button
              ref={salvarBtnRef}
              type="button"
              data-focusable="true"
              onClick={handleSalvar}
              className="px-4 py-2 text-xs font-bold rounded border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
            >
              Salvar
            </button>
            <button
              type="button"
              data-focusable="true"
              onClick={() => {
                setXMode("insert");
                setXF(formatItemForEdit({ ...emptyItem(), nr_item: XItens.length + 1 }));
                setXCurrentIdx(null);
                setTimeout(() => {
                  productInputRef.current?.focus();
                }, 150);
              }}
              className="px-4 py-2 text-xs font-bold rounded border border-border bg-card text-destructive hover:bg-accent transition-all"
            >
              Limpar / Cancelar
            </button>
          </div>
        </div>
      )}

      <DataGrid
        columns={gridColumns}
        data={XItens}
        maxHeight="340px"
        exportTitle="Itens da NF-e"
        showRecordCount={false}
        selectedIdx={XCurrentIdx}
        onRowClick={(_, idx) => setXCurrentIdx(idx)}
        onRowDoubleClick={(_, idx) => {
          if (podeEditar) {
            setXCurrentIdx(idx);
            setXMode("edit");
            setXF(formatItemForEdit({ ...XItens[idx], produto_id: XItens[idx].produto_id || undefined, deposito_id: XItens[idx].deposito_id || undefined }));
            setTimeout(() => {
              productInputRef.current?.focus();
            }, 150);
          }
        }}
        toolbarLeft={
          <span className="text-xs font-bold text-muted-foreground uppercase px-1">
            {XItens.length} item(s)
          </span>
        }
      />

      <ProdutoSearchDialog
        open={XSearchOpen}
        onClose={() => {
          setXSearchOpen(false);
          setXSearchItemNr(null);
        }}
        onSelect={handleSelectProduto}
      />

      <ProdutoSearchDialog
        open={XSearchFormOpen}
        onClose={() => setXSearchFormOpen(false)}
        onSelect={handleSelectFormProduto}
      />
    </div>
  );
};

export default NfeItensTab;
