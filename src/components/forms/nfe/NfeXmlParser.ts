import { INfeDadosXml, INfeXmlEmitente, INfeXmlItem } from "./types";

// ── Helper: texto seguro de um nó XML ──────────────────────
const txt = (parent: Element | null, tag: string): string => {
  if (!parent) return "";
  return parent.querySelector(tag)?.textContent?.trim() || "";
};

const num = (parent: Element | null, tag: string): number => {
  const v = txt(parent, tag);
  return v ? parseFloat(v) : 0;
};

// ── Parser principal ────────────────────────────────────────
export function parseNfeXml(xmlString: string): INfeDadosXml | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    if (doc.querySelector("parsererror")) {
      throw new Error("XML inválido ou corrompido.");
    }

    // Aceita nfeProc (com protocolo) ou NFe direta
    const nfe = doc.querySelector("NFe");
    if (!nfe) throw new Error("Estrutura NFe não encontrada no XML.");

    const infNFe = nfe.querySelector("infNFe");
    if (!infNFe) throw new Error("Elemento infNFe não encontrado.");

    // Chave de acesso — extraída do Id do infNFe (ex: "NFe35240...")
    const idAttr = infNFe.getAttribute("Id") || "";
    const chave_nfe = idAttr.replace(/^NFe/, "").trim();

    // Protocolo (presente apenas em nfeProc)
    const nrProtocolo = doc.querySelector("nProt")?.textContent?.trim() || "";

    // Identificação
    const ide = infNFe.querySelector("ide");
    const nr_nota  = txt(ide, "nNF");
    const serie    = txt(ide, "serie");
    const dt_emissao = txt(ide, "dhEmi") || txt(ide, "dEmi");
    const dt_saida   = txt(ide, "dhSaiEnt") || txt(ide, "dSaiEnt") || dt_emissao;

    // Emitente
    const emit = infNFe.querySelector("emit");
    const enderEmi = emit?.querySelector("enderEmit");
    const emitente: INfeXmlEmitente = {
      cnpj:                txt(emit, "CNPJ").replace(/\D/g, ""),
      razao_social:        (txt(emit, "xNome") || "").toUpperCase(),
      nome_fantasia:       (txt(emit, "xFant") || "").toUpperCase(),
      inscricao_estadual:  txt(emit, "IE"),
      endereco_logradouro: (txt(enderEmi, "xLgr") || "").toUpperCase(),
      endereco_numero:     txt(enderEmi, "nro"),
      endereco_bairro:     (txt(enderEmi, "xBairro") || "").toUpperCase(),
      endereco_cep:        txt(enderEmi, "CEP").replace(/\D/g, ""),
      endereco_cidade:     (txt(enderEmi, "xMun") || "").toUpperCase(),
      endereco_uf:         (txt(enderEmi, "UF") || "").toUpperCase(),
      fone:                txt(emit, "fone").replace(/\D/g, ""),
      email:               "",
    };

    // Totais
    const total  = infNFe.querySelector("total ICMSTot");
    const vl_produtos = num(total, "vProd");
    const vl_desconto = num(total, "vDesc");
    const vl_frete    = num(total, "vFrete");
    const vl_seguro   = num(total, "vSeg");
    const vl_despesa  = num(total, "vOutro");
    const vl_ipi_total= num(total, "vIPI");
    const vl_st_total = num(total, "vST");
    const vl_pis_total= num(total, "vPIS");
    const vl_cofins_total= num(total, "vCOFINS");
    const vl_total_nf = num(total, "vNF");

    // Informações adicionais
    const obs_nf = txt(infNFe.querySelector("infAdic"), "infCpl");

    // Itens (det)
    const dets = Array.from(infNFe.querySelectorAll("det"));
    const itens: INfeXmlItem[] = dets.map((det, _idx) => {
      const nrItem = parseInt(det.getAttribute("nItem") || "0");
      const prod   = det.querySelector("prod");
      const imposto= det.querySelector("imposto");
      const icms   = imposto?.querySelector("ICMS");
      const icmsTag= icms?.firstElementChild; // ex: ICMS00, ICMS10...
      const ipi    = imposto?.querySelector("IPI IPITrib");
      const pis    = imposto?.querySelector("PIS PISAliq, PIS PISNT, PIS PISQtde, PIS PISOutr");
      const cofins  = imposto?.querySelector("COFINS COFINSAliq, COFINS COFINSNT, COFINS COFINSQtde, COFINS COFINSOutr");

      // ST
      const icmsSt = imposto?.querySelector("ICMSSt") || null;

      return {
        nr_item:       nrItem,
        cd_prod_fornec: txt(prod, "cProd"),
        nm_produto:    (txt(prod, "xProd") || "").toUpperCase(),
        ncm:           txt(prod, "NCM"),
        cfop:          txt(prod, "CFOP"),
        unidade:       txt(prod, "uCom"),
        gtin:          txt(prod, "cEAN"),
        qt_entrada:    num(prod, "qCom"),
        vl_unit:       num(prod, "vUnCom"),
        vl_desconto:   num(prod, "vDesc"),
        vl_total:      num(prod, "vProd"),
        // Impostos valores
        vl_ipi:        num(ipi, "vIPI"),
        vl_icms_st:    num(icmsSt, "vICMSST") || num(icmsTag, "vICMSST"),
        vl_pis:        num(pis, "vPIS"),
        vl_cofins:     num(cofins, "vCOFINS"),
        vl_fcp_st:     num(icmsTag, "vFCPST"),
        // Alíquotas
        pc_ipi:        num(ipi, "pIPI"),
        pc_icms:       num(icmsTag, "pICMS"),
        pc_icms_st:    num(icmsTag, "pICMSST") || num(icmsSt, "pICMSST"),
        pc_pis:        num(pis, "pPIS"),
        pc_cofins:     num(cofins, "pCOFINS"),
        pc_fcp_st:     num(icmsTag, "pFCPST"),
        // CSTs
        cst_icms:      txt(icmsTag, "CST") || txt(icmsTag, "CSOSN"),
        cst_ipi:       txt(ipi, "CST"),
        cst_pis:       txt(pis, "CST"),
        cst_cofins:    txt(cofins, "CST"),
        // MVA/ST
        pc_mva:        num(icmsTag, "pMVAST"),
        vl_bc_st:      num(icmsTag, "vBCST") || num(icmsSt, "vBCST"),
      };
    });

    return {
      emitente,
      nr_nota,
      serie,
      dt_emissao: dt_emissao ? dt_emissao.substring(0, 10) : "",
      dt_saida:   dt_saida   ? dt_saida.substring(0, 10)   : "",
      chave_nfe,
      nr_protocolo: nrProtocolo,
      vl_produtos,
      vl_desconto,
      vl_frete,
      vl_seguro,
      vl_despesa,
      vl_ipi: vl_ipi_total,
      vl_icms_st: vl_st_total,
      vl_pis: vl_pis_total,
      vl_cofins: vl_cofins_total,
      vl_total_nf,
      obs_nf,
      itens,
      xmlRaw: xmlString,
    };
  } catch (err: any) {
    console.error("[NfeXmlParser]", err);
    return null;
  }
}
