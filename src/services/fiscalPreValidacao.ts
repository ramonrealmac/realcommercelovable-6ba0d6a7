/**
 * fiscalPreValidacao.ts
 * Pré-validação dos dados obrigatórios para emissão de NF-e / NFC-e
 * Executada ANTES de chamar fu_calcular_impostos_movimento e o worker,
 * permitindo feedback imediato ao usuário sem consumir a sequência da nota.
 */

export interface IFiscalValidacaoErro {
  campo: string;
  mensagem: string;
}

export interface IFiscalValidacaoResult {
  valido: boolean;
  erros: IFiscalValidacaoErro[];
}

/** Verifica se uma string ou valor está preenchido */
const ok = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

/** Limpa caracteres não numéricos */
const onlyDigits = (v: any) => (v ? String(v).replace(/\D/g, "") : "");

// ─────────────────────────────────────────────────────────────────────────────
// EMITENTE (Empresa)
// ─────────────────────────────────────────────────────────────────────────────
function validarEmitente(empresa: any): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];
  const pre = "Emitente";

  if (!empresa) {
    e.push({ campo: `${pre}`, mensagem: "Dados da empresa emitente não foram carregados." });
    return e;
  }

  const cnpjClean = onlyDigits(empresa?.cnpj);
  if (cnpjClean.length !== 14) {
    e.push({ campo: `${pre} → CNPJ`, mensagem: "CNPJ do emitente inválido ou não informado (deve ter 14 dígitos)." });
  }

  if (!ok(empresa?.razao_social)) {
    e.push({ campo: `${pre} → Razão Social`, mensagem: "Razão Social do emitente não informada." });
  }

  if (!ok(empresa?.ie)) {
    e.push({ campo: `${pre} → Inscrição Estadual`, mensagem: "Inscrição Estadual (IE) do emitente não informada." });
  }

  // Endereço do Emitente
  if (!ok(empresa?.endereco_logradouro))
    e.push({ campo: `${pre} → Logradouro`, mensagem: "Logradouro do emitente não informado." });
  if (!ok(empresa?.endereco_numero))
    e.push({ campo: `${pre} → Número`, mensagem: "Número do endereço do emitente não informado." });
  if (!ok(empresa?.endereco_bairro))
    e.push({ campo: `${pre} → Bairro`, mensagem: "Bairro do emitente não informado." });

  const cepClean = onlyDigits(empresa?.endereco_cep);
  if (cepClean.length !== 8)
    e.push({ campo: `${pre} → CEP`, mensagem: "CEP do emitente inválido ou não informado (deve ter 8 dígitos)." });

  const uf = empresa?.cidade?.estado_id || empresa?.uf;
  if (!ok(uf) || String(uf).length !== 2)
    e.push({ campo: `${pre} → UF`, mensagem: "UF do emitente não informada ou inválida." });

  // Município / IBGE
  const cidade = empresa?.cidade;
  const ibgeClean = onlyDigits(cidade?.cd_ibge || empresa?.cd_ibge);
  if (ibgeClean.length < 7)
    e.push({ campo: `${pre} → Código IBGE`, mensagem: "Código IBGE do município do emitente não localizado (deve ter 7 dígitos)." });

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESTINATÁRIO (Parceiro/Cadastro)
// ─────────────────────────────────────────────────────────────────────────────
function validarDestinatario(
  parceiro: any,
  tipo: "NFE" | "NFCE",
  indPres?: string,
  emitenteUf?: string
): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];
  const pre = "Destinatário";

  // Em NFC-e presencial sem entrega (indPres != '4'), parceiro é opcional se não houver CPF/CNPJ
  if (tipo === "NFCE" && indPres !== "4" && !parceiro) {
    return e;
  }

  if (!parceiro) {
    const msg = tipo === "NFCE"
      ? "Destinatário (cliente) não informado para entrega em domicílio."
      : "Destinatário (cliente) é obrigatório para emissão de NF-e.";
    e.push({ campo: `${pre}`, mensagem: msg });
    return e;
  }

  // Documento CPF/CNPJ
  const doc = onlyDigits(parceiro?.cnpj || parceiro?.cpf);
  if (doc.length !== 11 && doc.length !== 14) {
    e.push({ campo: `${pre} → CNPJ/CPF`, mensagem: "CNPJ/CPF do destinatário é inválido ou não foi informado (CPF: 11 dígitos, CNPJ: 14 dígitos)." });
  }

  // Razão Social / Nome
  if (!ok(parceiro?.razao_social) && !ok(parceiro?.nome_fantasia)) {
    e.push({ campo: `${pre} → Nome/Razão Social`, mensagem: "Nome ou Razão Social do destinatário não informada." });
  }

  // Inscrição Estadual para PJ Contribuinte
  if (parceiro?.tp_pessoa === "J" && parceiro?.tp_contribuinte === "C" && !ok(parceiro?.inscricao_estadual)) {
    e.push({ campo: `${pre} → Inscrição Estadual`, mensagem: "Inscrição Estadual obrigatória para destinatário PJ Contribuinte de ICMS." });
  }

  // Validação de Endereço (Obrigatório para NF-e ou para NFC-e com entrega)
  const exigirEndereco = tipo === "NFE" || indPres === "4";
  if (exigirEndereco) {
    if (!ok(parceiro?.endereco_logradouro))
      e.push({ campo: `${pre} → Logradouro`, mensagem: "Logradouro do destinatário não informado." });
    if (!ok(parceiro?.endereco_numero))
      e.push({ campo: `${pre} → Número`, mensagem: "Número do endereço do destinatário não informado." });
    if (!ok(parceiro?.endereco_bairro))
      e.push({ campo: `${pre} → Bairro`, mensagem: "Bairro do destinatário não informado." });

    const cepClean = onlyDigits(parceiro?.endereco_cep);
    if (cepClean.length !== 8)
      e.push({ campo: `${pre} → CEP`, mensagem: "CEP do destinatário inválido ou não informado (deve conter 8 dígitos)." });

    const destUf = parceiro?.cidade?.estado_id || parceiro?.uf || parceiro?.estado_id;
    if (!ok(destUf) || String(destUf).length !== 2)
      e.push({ campo: `${pre} → UF`, mensagem: "UF do destinatário não informada." });

    const cidade = parceiro?.cidade;
    const ibgeClean = onlyDigits(cidade?.cd_ibge || parceiro?.cd_ibge);
    if (ibgeClean.length < 7)
      e.push({ campo: `${pre} → Código IBGE`, mensagem: "Código IBGE do município do destinatário não localizado (deve conter 7 dígitos)." });
  }

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// ITENS DO MOVIMENTO
// ─────────────────────────────────────────────────────────────────────────────
function validarItens(
  itens: any[],
  emitenteUf?: string,
  destinatarioUf?: string
): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];

  if (!itens || itens.length === 0) {
    e.push({ campo: "Itens", mensagem: "O movimento de venda/nota não possui nenhum item." });
    return e;
  }

  const eUf = emitenteUf ? String(emitenteUf).trim().toUpperCase() : "";
  const dUf = destinatarioUf ? String(destinatarioUf).trim().toUpperCase() : eUf;
  const isOperacaoInterestadual = eUf && dUf && eUf !== dUf;

  itens.forEach((it: any, idx: number) => {
    const n = idx + 1;
    const prod = it.produto || {};
    const nomeProd = it.nm_produto || prod.nome || prod.descricao || prod.nm_produto || `Item #${n}`;
    const pre = `Item ${n} (${nomeProd})`;

    // Identificação básica do produto
    if (!ok(it.produto_id) && !ok(prod.produto_id) && !ok(it.cd_produto) && !ok(prod.cd_produto)) {
      e.push({ campo: `${pre} → Código`, mensagem: "Código do produto não identificado." });
    }

    // Quantidade
    const qtd = Number(it.qt_movimento ?? it.quantidade ?? 0);
    if (isNaN(qtd) || qtd <= 0) {
      e.push({ campo: `${pre} → Quantidade`, mensagem: "Quantidade do item deve ser maior que zero." });
    }

    // Valor Unitário / Movimento
    const valUnd = Number(it.vl_und_produto ?? it.vl_unitario ?? 0);
    const valMov = Number(it.vl_movimento ?? it.vl_total ?? 0);
    if ((isNaN(valUnd) || valUnd <= 0) && (isNaN(valMov) || valMov <= 0)) {
      e.push({ campo: `${pre} → Preço Unitário`, mensagem: "Preço unitário ou valor do item não informado." });
    }

    // Unidade de Medida
    const unidade = it.sg_unidade || prod.sg_unidade || prod.unidade_id || it.unidade_id;
    if (!ok(unidade)) {
      e.push({ campo: `${pre} → Unidade`, mensagem: "Unidade de medida (ex: UN, KG, CX) não informada no produto." });
    }

    // NCM (obrigatório 8 dígitos numéricos)
    const ncmRaw = it.ncm || prod.ncm;
    const ncmClean = onlyDigits(ncmRaw);
    if (ncmClean.length !== 8) {
      e.push({ campo: `${pre} → NCM`, mensagem: `NCM informado ("${ncmRaw || ""}") é inválido. Deve ter exatamente 8 dígitos numéricos.` });
    }

    // Origem da mercadoria
    const origem = it.origem ?? prod.origem;
    if (origem === null || origem === undefined || String(origem).trim() === "") {
      e.push({ campo: `${pre} → Origem`, mensagem: "Origem da mercadoria (0 - Nacional, 1 - Estrangeira, etc.) não configurada." });
    }

    // CST / CSOSN Tributário
    const cstCsosn = it.cst || it.csosn || prod.cst || prod.csosn;
    if (!ok(cstCsosn)) {
      e.push({ campo: `${pre} → Tributação (CST/CSOSN)`, mensagem: "Situação Tributária (CST ou CSOSN) não configurada para o item." });
    }

    // CFOP (4 dígitos) e coerência UF (Estadual = 5.xxx / Interestadual = 6.xxx)
    const cfopRaw = onlyDigits(it.cfop || prod.cfop);
    if (cfopRaw.length === 4) {
      const primeiroDigito = cfopRaw.charAt(0);
      if (isOperacaoInterestadual && primeiroDigito !== "6" && primeiroDigito !== "7") {
        e.push({
          campo: `${pre} → CFOP`,
          mensagem: `Operação interestadual (${eUf} -> ${dUf}) exige CFOP iniciado por '6' (informado: ${cfopRaw}).`
        });
      } else if (!isOperacaoInterestadual && primeiroDigito !== "5" && primeiroDigito !== "1") {
        e.push({
          campo: `${pre} → CFOP`,
          mensagem: `Operação interna (${eUf}) exige CFOP iniciado por '5' (informado: ${cfopRaw}).`
        });
      }
    }
  });

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO FISCAL DO SISTEMA / EMITENTE
// ─────────────────────────────────────────────────────────────────────────────
function validarConfigFiscal(fConfig: any, fConfigItem: any, tipo: "NFE" | "NFCE"): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];

  if (!fConfig) {
    e.push({ campo: "Configuração Fiscal", mensagem: "Nenhuma configuração fiscal encontrada para a empresa." });
  } else {
    if (!ok(fConfig.certificado)) {
      e.push({ campo: "Config → Certificado Digital", mensagem: "Caminho do arquivo do certificado digital (A1) não informado nas configurações da empresa." });
    }
    if (!ok(fConfig.ambiente_nfe)) {
      e.push({ campo: "Config → Ambiente", mensagem: "Ambiente de emissão (1 - Produção / 2 - Homologação) não selecionado." });
    }
  }

  if (!fConfigItem) {
    e.push({ campo: `Config → ${tipo}`, mensagem: `Série e sequência fiscal do funcionário/PDV não configuradas para ${tipo}.` });
  } else {
    if (!ok(fConfigItem.serie)) {
      e.push({ campo: `Config → Série ${tipo}`, mensagem: "Série fiscal não configurada." });
    }
    if (!ok(fConfigItem.sequencia) || Number(fConfigItem.sequencia) <= 0) {
      e.push({ campo: `Config → Sequencial ${tipo}`, mensagem: "Número sequencial da nota fiscal inválido ou menor que 1." });
    }
  }

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// PONTO DE ENTRADA PÚBLICO DE VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
export function validarDadosFiscais(params: {
  empresa: any;
  parceiro: any;
  movimento: any;
  itens: any[];
  fConfig: any;
  fConfigItem: any;
  tipo: "NFE" | "NFCE";
  chavesRef?: string[];
}): IFiscalValidacaoResult {
  const { empresa, parceiro, movimento, itens, fConfig, fConfigItem, tipo, chavesRef } = params;

  if (!movimento) {
    return { valido: false, erros: [{ campo: "Movimento", mensagem: "Dados do movimento/venda não localizados no banco." }] };
  }

  // Determinar indPres para NFC-e
  const isEntrega =
    movimento.ind_pres === "4" ||
    (Number(movimento.vl_frete || 0) > 0 && (ok(movimento.logradouro_entrega) || ok(movimento.cep_entrega)));
  const indPres = isEntrega ? "4" : movimento.ind_pres || "1";

  const emitenteUf = empresa?.cidade?.estado_id || empresa?.uf;
  const destinatarioUf = parceiro?.cidade?.estado_id || parceiro?.uf || parceiro?.estado_id;

  const erros: IFiscalValidacaoErro[] = [
    ...validarEmitente(empresa),
    ...validarDestinatario(parceiro, tipo, indPres, emitenteUf),
    ...validarItens(itens, emitenteUf, destinatarioUf),
    ...validarConfigFiscal(fConfig, fConfigItem, tipo),
  ];

  if (tipo === "NFCE" && indPres === "1" && Number(movimento.vl_frete || 0) > 0) {
    erros.push({ campo: "NFC-e Presencial", mensagem: "Venda presencial sem entrega não pode conter valor de frete informado." });
  }

  // Validação de NF-e de Devolução (Finalidade 4)
  const isDevolucao =
    movimento.fin_nfe === 4 ||
    String(movimento.fin_nfe) === "4" ||
    String(movimento.finalidade) === "4";

  if (isDevolucao) {
    const refs = chavesRef || [];
    if (refs.length === 0) {
      erros.push({
        campo: "Documento Referenciado (Devolução / finNFe 4)",
        mensagem: "NF-e de Devolução exige ao menos uma Chave de Acesso de 44 dígitos da NF-e original vinculada nos Documentos Referenciados."
      });
    } else {
      refs.forEach((c, idx) => {
        const limpa = String(c || "").replace(/\D/g, "");
        if (limpa.length !== 44) {
          erros.push({
            campo: `Chave Referenciada #${idx + 1}`,
            mensagem: `A chave informada ("${c}") possui ${limpa.length} dígitos. A chave de acesso da NF-e DEVE possuir exatamente 44 dígitos numéricos.`
          });
        }
      });
    }
  }

  return { valido: erros.length === 0, erros };
}
