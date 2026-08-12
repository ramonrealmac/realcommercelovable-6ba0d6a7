import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { Link, Search, Key, Upload } from "lucide-react";
import type { INfeItem, INfeXmlItem } from "./types";
import { useAppContext } from "@/contexts/AppContext";
import ProdutoSearchDialog from "../pedido/ProdutoSearchDialog";
import { parseNfeXml } from "./NfeXmlParser";
import { formatCPFCNPJ } from "@/lib/validators";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";

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
  onRefreshCabecalho?: () => void;
  finNfe?: number;
  onItensChanged?: (itens: any[]) => void;
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
  "pc_mva", "pc_cred_sn", "pc_fcp", "pc_red_bc", "pc_red_bc_st",
]);
const XQuantityKeys = new Set(["qt_entrada", "qt_tributavel"]);
const XIntKeys = new Set(["nr_item", "origem", "mod_bc", "mod_bc_st"]);
const XValueKeys = new Set([
  "vl_unit", "vl_unit_tributavel", "vl_desconto", "vl_total", "vl_ipi", "vl_icms_st", "vl_pis", "vl_cofins",
  "vl_fcp_st", "vl_ibs", "vl_cbs", "vl_is", "vl_bc", "vl_bc_st", "vl_bc_ipi", "vl_bc_pis", "vl_bc_cofins",
  "vl_cred_sn", "vl_fcp", "vl_frete", "vl_icms", "vl_icms_deson", "vl_outro", "vl_seguro",
]);
const XNumericKeys = new Set([...XPercentKeys, ...XQuantityKeys, ...XValueKeys]);

const XTextKeys = [
  "cd_prod_fornec", "nm_produto", "ncm", "cfop", "unidade", "gtin", "csosn", "cest", "c_enq",
  "cst_icms", "cst_ipi", "cst_pis", "cst_cofins", "cst_ibs", "cst_cbs", "cst_is", "cfop_entrada",
];

const decimalsFor = (XKey: string) => {
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

const onlyDigits = (XValue: string, XMax?: number) => {
  const XDigits = XValue.replace(/\D/g, "");
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
  vl_desconto: 0,
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
  vl_bc_st: 0,
  vl_bc_ipi: 0,
  vl_bc_pis: 0,
  vl_bc_cofins: 0,
  produto_id: undefined,
  deposito_id: undefined,
  cfop_entrada: "",
});

const formatItemForEdit = (XItem: XFormItem) => {
  const XFormatted: XFormItem = { ...XItem };
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
}) => {
  const { XTabs, openTab, closeTab } = useAppContext();
  const [XItens, setXItens] = useState<XItemRow[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState<number | null>(null);
  const [XMode, setXMode] = useState<"view" | "edit" | "insert">("view");
  const [XF, setXF] = useState<XFormItem>(formatItemForEdit(emptyItem()));
  const [XProdutos, setXProdutos] = useState<{ produto_id: number; nome: string; referencia?: string; cd_produto?: number | null }[]>([]);
  const [XCfops, setXCfops] = useState<{ cd_cfop: string; descricao: string }[]>([]);


  const { handleKeyDown } = useEnterTraversal();

  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchItemNr, setXSearchItemNr] = useState<number | null>(null);
  const [XSearchFormOpen, setXSearchFormOpen] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  const [XChavesRef, setXChavesRef] = useState<any[]>([]);
  const [XCabecalho, setXCabecalho] = useState<any>(null);

  useEffect(() => {
    if (XMode === "insert" || XMode === "edit") {
      setTimeout(() => {
        productInputRef.current?.focus();
      }, 150);
    }
  }, [XMode]);

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
  }, [nfeCabecalhoId, loadCabecalho, loadChavesRef]);

  const recalculateNfeTotals = async (cabId: number) => {
    const { data: itens, error: errItens } = await db.from("fiscal_nfe_item")
      .select("*")
      .eq("nfe_cabecalho_id", cabId)
      .eq("excluido", false);

    if (errItens) return;

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

    for (const item of (itens || [])) {
      vl_produto += Number(item.vl_total || 0);
      vl_desconto += Number(item.vl_desconto || 0);
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
    }

    const vl_total_nf = vl_produto - vl_desconto + vl_frete + vl_seguro + vl_outro + vl_icms_st + vl_ipi + vl_ibs + vl_cbs + vl_is;

    await db.from("fiscal_nfe_cabecalho").update({
      vl_produto,
      vl_desconto,
      vl_frete,
      vl_seguro,
      vl_despesa: vl_outro,
      vl_ipi,
      vl_icms,
      vl_icms_st,
      vl_pis,
      vl_cofins,
      vl_ibs,
      vl_cbs,
      vl_is,
      vl_bc,
      vl_bc_st,
      vl_total_nf,
      updated_at: new Date().toISOString()
    }).eq("nfe_cabecalho_id", cabId);
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
      await recalculateNfeTotals(nfeCabecalhoId);
      await loadItens();
      if (onRefreshCabecalho) onRefreshCabecalho();
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

      await recalculateNfeTotals(nfeCabecalhoId);
      toast.success(`Importação concluída: Chave ${keyRef} registrada. ${itensAdicionados} itens novos adicionados e ${itensAtualizados} somados.`, { id: "import-xml" });
      
      await loadChavesRef();
      await loadItens();
      if (onRefreshCabecalho) onRefreshCabecalho();

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
      _produto_nome: r.produto_id ? (prodNames[r.produto_id] || `#${r.produto_id}`) : null,
      _produto_codigo: r.produto_id ? (prodCodes[r.produto_id] || "") : null
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
      const { data } = await db.from("cfop").select("cd_cfop, descricao").eq("excluido", false).order("cd_cfop");
      setXCfops(data || []);
    };
    loadCfops();
  }, []);

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
    const produtoId = p.produto_id;
    const produtoNome = p.nome;
    const produtoCodigo = p.cd_produto ? String(p.cd_produto) : "";

    if (nfeCabecalhoId) {
      const { error } = await db.from("fiscal_nfe_item")
        .update({ produto_id: produtoId })
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
    const desc = parseNum(f.vl_desconto);
    return Math.round((qt * vlu - desc + Number.EPSILON) * 100) / 100;
  };

  const handleBlur = (key: string) => {
    const current = XF[key];
    if (current === undefined || current === null || current === "") return;
    const formatted = fmtInput(current, key);
    
    setXF(prev => {
      const next = { ...prev, [key]: formatted };
      
      // Auto calculations for total
      if (key === "qt_entrada" || key === "vl_unit" || key === "vl_desconto") {
        const total = recalcTotal(next);
        next.vl_total = fmtInput(total, "vl_total");
      }
      
      // Auto tax calculations
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
      // IBS / CBS (same base vl_bc)
      if (key === "vl_bc" || key === "pc_ibs") {
        const bc = parseNum(next.vl_bc);
        const pc = parseNum(next.pc_ibs);
        next.vl_ibs = fmtInput(bc * (pc / 100), "vl_ibs");
      }
      if (key === "vl_bc" || key === "pc_cbs") {
        const bc = parseNum(next.vl_bc);
        const pc = parseNum(next.pc_cbs);
        next.vl_cbs = fmtInput(bc * (pc / 100), "vl_cbs");
      }
      
      return next;
    });
  };

  const handleSelectFormProduto = (p: any) => {
    setXF(prev => {
      const next = { ...prev };
      next.produto_id = p.produto_id;
      next.nm_produto = p.nome?.toUpperCase() || "";
      next.gtin = p.gtin || "";
      next.ncm = p.ncm || "";
      next.cest = p.cest || "";
      next.unidade = p.unidade || "UN";
      next.origem = p.origem !== undefined && p.origem !== null ? p.origem : 0;
      if (p.vl_venda) {
        next.vl_unit = fmtInput(p.vl_venda, "vl_unit");
        next.vl_total = fmtInput(recalcTotal({ ...next, vl_unit: p.vl_venda }), "vl_total");
      }
      return next;
    });
    setXSearchFormOpen(false);
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

  const handleNovo = () => {
    setXMode("insert");
    setXF(formatItemForEdit({ ...emptyItem(), nr_item: XItens.length + 1 }));
    setXCurrentIdx(null);
  };

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
      if (["ncm", "cfop", "cest", "gtin", "csosn", "c_enq"].includes(XKey)) {
        XPayload[XKey] = onlyDigits(XRaw, XKey === "ncm" ? 8 : XKey === "cfop" ? 4 : XKey === "cest" ? 7 : undefined);
      } else {
        XPayload[XKey] = XRaw.toUpperCase();
      }
    });

    XIntKeys.forEach((XKey) => {
      if (XKey !== "nr_item") XPayload[XKey] = parseInt(String(XF[XKey] || "0"), 10) || 0;
    });

    XNumericKeys.forEach((XKey) => {
      XPayload[XKey] = parseNum(XF[XKey]);
    });

    if (!String(XF.vl_total ?? "").trim() || parseNum(XF.vl_total) === 0) XPayload.vl_total = recalcTotal(XF);
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
    setXMode("view");
    setXCurrentIdx(null);
    await recalculateNfeTotals(nfeCabecalhoId);
    await loadItens();
    if (onRefreshCabecalho) onRefreshCabecalho();
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
    await recalculateNfeTotals(nfeCabecalhoId);
    await loadItens();
    if (onRefreshCabecalho) onRefreshCabecalho();
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

  const renderNum = ({ k, label, span = 2, readOnly = false }: XNumInputProps) => (
    <div style={{ gridColumn: `span ${span} / span ${span}` }}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type="text"
        value={String(XF[k] ?? "")}
        onBlur={() => handleBlur(k)}
        onChange={e => !readOnly && set(k, e.target.value)}
        readOnly={readOnly}
        className={`${readOnly ? readCls : inputCls} text-right`}
        inputMode="decimal"
      />
    </div>
  );

  const renderSection = (title: string, children: React.ReactNode) => (
    <fieldset className="border border-border rounded p-3">
      <legend className="text-xs font-medium text-muted-foreground px-2">{title}</legend>
      <div className="grid grid-cols-12 gap-3">{children}</div>
    </fieldset>
  );

  const gridColumns = useMemo<IGridColumn[]>(() => {
    const cols: IGridColumn[] = [
      { key: "nr_item",       label: "Item",        width: "60px",   align: "right" },
      { key: "cd_prod_fornec",label: "Cód. Forn.",  width: "90px" },
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
      { key: "ncm",           label: "NCM",         width: "75px" },
      { key: "cest",          label: "CEST",        width: "75px" },
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
      { key: "vl_desconto",   label: "Desc.",       width: "90px",   align: "right", render: (r) => fmt2(r.vl_desconto) },
      { key: "vl_icms",       label: "ICMS",        width: "90px",   align: "right", render: (r) => fmt2(r.vl_icms) },
      { key: "vl_icms_st",    label: "ICMS-ST",     width: "90px",   align: "right", render: (r) => fmt2(r.vl_icms_st) },
      { key: "vl_ipi",        label: "IPI",         width: "90px",   align: "right", render: (r) => fmt2(r.vl_ipi) },
      { key: "vl_pis",        label: "PIS",         width: "90px",   align: "right", render: (r) => fmt2(r.vl_pis) },
      { key: "vl_cofins",     label: "COFINS",      width: "90px",   align: "right", render: (r) => fmt2(r.vl_cofins) },
      { key: "vl_total",      label: "Total",       width: "90px",   align: "right", render: (r) => fmt2(r.vl_total) }
    );

    return cols;
  }, [podeEditar, hideVinculo, XCfops, XItens]);

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
              <div className="col-span-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Produto <span className="text-destructive">*</span></label>
                <input
                  ref={productInputRef}
                  type="text"
                  readOnly
                  placeholder="Pressione Enter para pesquisar..."
                  value={XF.produto_id ? (XProdutos.find(p => p.produto_id === XF.produto_id)?.nome || `#${XF.produto_id}`) : ""}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.stopPropagation();
                      setXSearchFormOpen(true);
                    }
                  }}
                  onClick={() => setXSearchFormOpen(true)}
                  className={`${inputCls} bg-secondary/50 cursor-pointer focus:ring-2 focus:ring-ring focus:outline-none`}
                />
              </div>
              <div className="col-span-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição NF</label>
                <input value={XF.nm_produto || ""} onChange={e => set("nm_produto", e.target.value.toUpperCase())} className={inputCls} />
              </div>
              {renderTxt({ k: "unidade", label: "Un.", span: 1 })}
              {renderTxt({ k: "cd_prod_fornec", label: "Cód. Forn.", span: 2 })}
              {renderTxt({ k: "gtin", label: "GTIN", span: 2, digits: true, max: 14 })}
              {renderTxt({ k: "ncm", label: "NCM", span: 2, digits: true, max: 8 })}
              {renderTxt({ k: "cest", label: "CEST", span: 1, digits: true, max: 7 })}
            </>
          ))}

          {renderSection("Regras Fiscais & Operação", (
            <>
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

              <div className="col-span-4">
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
                    <option value="00">00 - Tributada integralmente</option>
                    <option value="10">10 - Tributada e com cobrança por ST</option>
                    <option value="20">20 - Com redução de base de cálculo</option>
                    <option value="30">30 - Isenta ou não tributada e com cobrança por ST</option>
                    <option value="40">40 - Isenta</option>
                    <option value="41">41 - Não tributada</option>
                    <option value="50">50 - Suspensão</option>
                    <option value="51">51 - Diferimento</option>
                    <option value="60">60 - ICMS cobrado anteriormente por ST</option>
                    <option value="70">70 - Com redução de BC e cobrança por ST</option>
                    <option value="90">90 - Outras</option>
                  </optgroup>
                  <optgroup label="CSOSN (Simples Nacional)">
                    <option value="101">101 - Tributada c/ permissão de crédito</option>
                    <option value="102">102 - Tributada sem permissão de crédito</option>
                    <option value="103">103 - Isenção do ICMS para faixa de receita</option>
                    <option value="201">201 - Tributada c/ permissão de crédito e ST</option>
                    <option value="202">202 - Tributada sem permissão de crédito e ST</option>
                    <option value="203">203 - Isenção do ICMS c/ ST</option>
                    <option value="300">300 - Imune</option>
                    <option value="400">400 - Não tributada pelo Simples Nacional</option>
                    <option value="500">500 - ICMS cobrado anteriormente por ST</option>
                    <option value="900">900 - Outros</option>
                  </optgroup>
                </select>
              </div>

              <div className="col-span-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">CFOP <span className="text-destructive">*</span></label>
                <select
                  value={XF.cfop ?? ""}
                  onChange={e => set("cfop", e.target.value || "")}
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
            </>
          ))}

          {renderSection("Valores Unitários", (
            <>
              {renderNum({ k: "qt_entrada", label: "Qtd.", span: 2 })}
              {renderNum({ k: "vl_unit", label: "Valor Unit.", span: 2 })}
              {renderNum({ k: "vl_desconto", label: "Desconto", span: 2 })}
              {renderNum({ k: "vl_total", label: "Total", span: 2 })}
            </>
          ))}

          {renderSection("ICMS", (
            <>
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
              {renderNum({ k: "vl_icms_deson", label: "ICMS Deson.", span: 2 })}
            </>
          ))}

          {renderSection("ICMS-ST / Crédito SN", (
            <>
              {renderNum({ k: "mod_bc_st", label: "Mod. BC ST", span: 1 })}
              {renderNum({ k: "pc_mva", label: "MVA %", span: 2 })}
              {renderNum({ k: "vl_bc_st", label: "BC ST", span: 2 })}
              {renderNum({ k: "pc_red_bc_st", label: "Red. BC ST %", span: 2 })}
              {renderNum({ k: "pc_icms_st", label: "ICMS-ST %", span: 2 })}
              {renderNum({ k: "vl_icms_st", label: "Vlr. ICMS-ST", span: 2 })}
              {renderNum({ k: "pc_cred_sn", label: "Créd. SN %", span: 2 })}
              {renderNum({ k: "vl_cred_sn", label: "Vlr. Créd. SN", span: 2 })}
            </>
          ))}

          {renderSection("IPI", (
            <>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">CST IPI</label>
                <select value={XF.cst_ipi ?? ""} onChange={e => set("cst_ipi", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="00">00 - Entrada com recuperação de crédito</option>
                  <option value="49">49 - Outras entradas</option>
                  <option value="50">50 - Saída tributada</option>
                  <option value="99">99 - Outras saídas</option>
                </select>
              </div>
              {renderTxt({ k: "c_enq", label: "cEnq (Enquadramento)", span: 2, digits: true, max: 3 })}
              {renderNum({ k: "vl_bc_ipi", label: "BC IPI", span: 2 })}
              {renderNum({ k: "pc_ipi", label: "IPI %", span: 2 })}
              {renderNum({ k: "vl_ipi", label: "Vlr. IPI", span: 2 })}
            </>
          ))}

          {renderSection("PIS / COFINS", (
            <>
              <div className="col-span-2">
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
              {renderNum({ k: "vl_bc_pis", label: "BC PIS", span: 2 })}
              {renderNum({ k: "pc_pis", label: "PIS %", span: 2 })}
              {renderNum({ k: "vl_pis", label: "Vlr. PIS", span: 2 })}
              <div className="col-span-2">
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
              {renderNum({ k: "vl_bc_cofins", label: "BC COFINS", span: 2 })}
              {renderNum({ k: "pc_cofins", label: "COFINS %", span: 2 })}
              {renderNum({ k: "vl_cofins", label: "Vlr. COFINS", span: 2 })}
            </>
          ))}

          {renderSection("IBS / CBS (Reforma)", (
            <>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">CST IBS</label>
                <select value={XF.cst_ibs ?? ""} onChange={e => set("cst_ibs", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="01">01 - Tributada Integralmente</option>
                  <option value="02">02 - Redução de Alíquota / BC</option>
                  <option value="03">03 - Alíquota Zero</option>
                  <option value="04">04 - Isenta / Não Incidência</option>
                  <option value="05">05 - Suspensão</option>
                  <option value="09">09 - Outras Operações</option>
                </select>
              </div>
              {renderNum({ k: "pc_ibs", label: "IBS %", span: 2 })}
              {renderNum({ k: "vl_ibs", label: "Vlr. IBS", span: 2 })}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">CST CBS</label>
                <select value={XF.cst_cbs ?? ""} onChange={e => set("cst_cbs", e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="01">01 - Tributada Integralmente</option>
                  <option value="02">02 - Redução de Alíquota / BC</option>
                  <option value="03">03 - Alíquota Zero</option>
                  <option value="04">04 - Isenta / Não Incidência</option>
                  <option value="05">05 - Suspensão</option>
                  <option value="09">09 - Outras Operações</option>
                </select>
              </div>
              {renderNum({ k: "pc_cbs", label: "CBS %", span: 2 })}
              {renderNum({ k: "vl_cbs", label: "Vlr. CBS", span: 2 })}
            </>
          ))}


          <div className="flex gap-2 justify-end pt-2 sticky bottom-0 bg-card border-t border-border">
            <button type="button" onClick={handleSalvar} className="px-4 py-2 text-xs font-bold rounded border border-border bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
              Salvar
            </button>
            <button type="button" onClick={() => { setXMode("view"); setXCurrentIdx(null); }} className="px-4 py-2 text-xs font-bold rounded border border-border bg-card text-destructive hover:bg-accent transition-all">
              Cancelar
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
          setXCurrentIdx(idx);
          if (podeEditar) {
            if (isEditing) {
              setXSearchItemNr(XItens[idx].nr_item);
              setXSearchOpen(true);
            } else {
              setXMode("edit");
              setXF(formatItemForEdit({ ...XItens[idx], produto_id: XItens[idx].produto_id || undefined }));
            }
          }
        }}
        toolbarLeft={podeEditar ? (
          <div className="flex gap-2 items-center">
            <GridActionToolbar
              actions={[
                gridActions.incluir(handleNovo, isEditing),
                gridActions.alterar(handleEditar, XCurrentIdx === null || isEditing),
                null,
                gridActions.excluir(handleExcluir, XCurrentIdx === null || isEditing),
                gridActions.atualizar(loadItens),
              ]}
              count={`${XItens.length} item(s)`}
            />
            <button
              type="button"
              onClick={handleCadastrarProduto}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border rounded text-xs font-bold transition-all uppercase animate-pulse"
            >
              Novo Produto
            </button>
          </div>
        ) : undefined}
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
