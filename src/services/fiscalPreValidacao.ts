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

/** Verifica se uma string está preenchida */
const ok = (v: any) => v !== null && v !== undefined && String(v).trim() !== "";

/** Verifica se CNPJ/CPF tem tamanho plausível */
const okDoc = (v: any) => ok(v) && String(v).replace(/\D/g, "").length >= 11;

// ─────────────────────────────────────────────────────────────────────────────
// EMITENTE (Empresa)
// ─────────────────────────────────────────────────────────────────────────────
function validarEmitente(empresa: any): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];
  const pre = "Emitente";

  if (!okDoc(empresa?.cnpj))
    e.push({ campo: `${pre} → CNPJ`, mensagem: "CNPJ do emitente não informado." });
  if (!ok(empresa?.razao_social))
    e.push({ campo: `${pre} → Razão Social`, mensagem: "Razão Social do emitente não informada." });
  if (!ok(empresa?.ie))
    e.push({ campo: `${pre} → Inscrição Estadual`, mensagem: "IE do emitente não informada." });

  // Endereço
  const end = empresa;
  if (!ok(end?.endereco_logradouro))
    e.push({ campo: `${pre} → Logradouro`, mensagem: "Logradouro do emitente não informado." });
  if (!ok(end?.endereco_numero))
    e.push({ campo: `${pre} → Número`, mensagem: "Número do endereço do emitente não informado." });
  if (!ok(end?.endereco_bairro))
    e.push({ campo: `${pre} → Bairro`, mensagem: "Bairro do emitente não informado." });
  if (!ok(end?.endereco_cep))
    e.push({ campo: `${pre} → CEP`, mensagem: "CEP do emitente não informado." });
  if (!ok(end?.endereco_uf))
    e.push({ campo: `${pre} → UF`, mensagem: "UF do emitente não informada." });

  // Município (cidade vinculada)
  const cidade = end?.cidade;
  if (!ok(cidade?.ibge))
    e.push({ campo: `${pre} → Código IBGE`, mensagem: "Código IBGE do município do emitente não localizado. Verifique o cadastro de cidade." });
  if (!ok(cidade?.descricao || cidade?.nome))
    e.push({ campo: `${pre} → Município`, mensagem: "Município do emitente não localizado." });

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// DESTINATÁRIO (Parceiro/Cadastro)
// ─────────────────────────────────────────────────────────────────────────────
function validarDestinatario(parceiro: any, tipo: "NFE" | "NFCE"): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];
  const pre = "Destinatário";

  // NFC-e permite consumidor final sem identificação
  if (tipo === "NFCE") return e;

  if (!parceiro) {
    e.push({ campo: `${pre}`, mensagem: "Destinatário (cliente) não informado para NF-e." });
    return e;
  }

  if (!okDoc(parceiro?.cnpj) && !okDoc(parceiro?.cpf))
    e.push({ campo: `${pre} → CNPJ/CPF`, mensagem: "CNPJ ou CPF do destinatário não informado." });
  if (!ok(parceiro?.razao_social) && !ok(parceiro?.nome_fantasia))
    e.push({ campo: `${pre} → Nome/Razão Social`, mensagem: "Nome ou Razão Social do destinatário não informada." });

  // Endereço
  if (!ok(parceiro?.endereco_logradouro))
    e.push({ campo: `${pre} → Logradouro`, mensagem: "Logradouro do destinatário não informado." });
  if (!ok(parceiro?.endereco_numero))
    e.push({ campo: `${pre} → Número`, mensagem: "Número do endereço do destinatário não informado." });
  if (!ok(parceiro?.endereco_bairro))
    e.push({ campo: `${pre} → Bairro`, mensagem: "Bairro do destinatário não informado." });
  if (!ok(parceiro?.endereco_cep))
    e.push({ campo: `${pre} → CEP`, mensagem: "CEP do destinatário não informado." });
  if (!ok(parceiro?.endereco_uf))
    e.push({ campo: `${pre} → UF`, mensagem: "UF do destinatário não informada." });

  const cidade = parceiro?.cidade;
  if (!ok(cidade?.ibge))
    e.push({ campo: `${pre} → Código IBGE`, mensagem: "Código IBGE do município do destinatário não localizado." });

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// ITENS do movimento
// ─────────────────────────────────────────────────────────────────────────────
function validarItens(itens: any[]): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];
  if (!itens || itens.length === 0) {
    e.push({ campo: "Itens", mensagem: "O movimento não possui itens." });
    return e;
  }

  itens.forEach((it: any, idx: number) => {
    const n = idx + 1;
    const pre = `Item ${n} (${it.nm_produto || it.produto_id || "?"})`;

    if (!ok(it.produto_id))
      e.push({ campo: `${pre} → Produto`, mensagem: "Produto não identificado." });
    if (!ok(it.qt_movimento) || Number(it.qt_movimento) <= 0)
      e.push({ campo: `${pre} → Quantidade`, mensagem: "Quantidade inválida ou zero." });
    if (!ok(it.vl_und_produto) && !ok(it.vl_movimento))
      e.push({ campo: `${pre} → Valor`, mensagem: "Valor unitário não informado." });

    // Produto e sua ficha fiscal
    const prod = it.produto;
    if (prod) {
      if (!ok(prod.ncm))
        e.push({ campo: `${pre} → NCM`, mensagem: "NCM do produto não informado." });
      if (!ok(prod.cfop) && !ok(it.cfop))
        e.push({ campo: `${pre} → CFOP`, mensagem: "CFOP do produto não informado." });
      if (!ok(prod.unidade_id))
        e.push({ campo: `${pre} → Unidade`, mensagem: "Unidade de medida do produto não informada." });
    } else {
      e.push({ campo: `${pre} → Dados Fiscais`, mensagem: "Dados do produto não localizados no banco." });
    }
  });

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO FISCAL
// ─────────────────────────────────────────────────────────────────────────────
function validarConfigFiscal(fConfig: any, fConfigItem: any): IFiscalValidacaoErro[] {
  const e: IFiscalValidacaoErro[] = [];

  if (!fConfig)
    e.push({ campo: "Configuração Fiscal", mensagem: "Nenhuma configuração fiscal encontrada para a empresa." });
  else {
    if (!ok(fConfig.certificado))
      e.push({ campo: "Config → Certificado Digital", mensagem: "Caminho do certificado digital não informado." });
    if (!ok(fConfig.senha_certificado))
      e.push({ campo: "Config → Senha do Certificado", mensagem: "Senha do certificado digital não informada." });
    if (!ok(fConfig.ambiente_nfe))
      e.push({ campo: "Config → Ambiente", mensagem: "Ambiente NF-e (produção/homologação) não configurado." });
  }

  if (!fConfigItem)
    e.push({ campo: "Config → Item (série/sequência)", mensagem: "Configuração de série/sequência não encontrada para o funcionário." });
  else {
    if (!ok(fConfigItem.serie))
      e.push({ campo: "Config → Série", mensagem: "Série da NF-e não configurada." });
  }

  return e;
}

// ─────────────────────────────────────────────────────────────────────────────
// PONTO DE ENTRADA PÚBLICO
// ─────────────────────────────────────────────────────────────────────────────
export function validarDadosFiscais(params: {
  empresa: any;
  parceiro: any;
  movimento: any;
  itens: any[];
  fConfig: any;
  fConfigItem: any;
  tipo: "NFE" | "NFCE";
}): IFiscalValidacaoResult {
  const { empresa, parceiro, movimento, itens, fConfig, fConfigItem, tipo } = params;

  const erros: IFiscalValidacaoErro[] = [
    ...validarEmitente(empresa),
    ...validarDestinatario(parceiro, tipo),
    ...validarItens(itens),
    ...validarConfigFiscal(fConfig, fConfigItem),
  ];

  // Movimento em si
  if (!movimento) {
    erros.unshift({ campo: "Movimento", mensagem: "Dados do movimento não localizados." });
  }

  return { valido: erros.length === 0, erros };
}
