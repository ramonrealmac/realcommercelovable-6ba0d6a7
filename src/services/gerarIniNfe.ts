/**
 * Gerador de arquivo INI para o ACBrLib (formato esperado pela DLL).
 * Compatível com NFe (modelo 55) e NFCe (modelo 65).
 */

export interface GerarIniParams {
  cabecalho: any;
  itens: any[];
  pagamentos: any[];
  empresa: any;
  cadastro: any;
  fiscalConfig: any;
  configItem: any;
}

export function gerarIniNfe(params: GerarIniParams): string {
  const { cabecalho, itens, pagamentos, empresa, cadastro, fiscalConfig, configItem } = params;

  const modelo = configItem.modelo || '55';
  const isNFCe = modelo === '65';
  const serie = String(configItem.serie || '001').padStart(3, '0');
  const nrNota = String(cabecalho.nr_nota || '1').padStart(9, '0');
  const dtEmissao = formatarData(cabecalho.dt_emissao || new Date());
  const hrEmissao = formatarHora(new Date());
  const ambiente = String(fiscalConfig.ambiente_nfe || 2); // 1=Produção, 2=Homologação
  const cnpjEmitente = limparNumeros(empresa.cnpj || '');
  const cUF = mapearCodigoUF(empresa.cidade?.uf || empresa.cidade?.estado_id || 'SP');

  const linhas: string[] = [];

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Identificação
  // ──────────────────────────────────────────────────────────────
  linhas.push(`[NFe]`);
  linhas.push(`Versao=4.00`);
  linhas.push(``);
  linhas.push(`[Identificacao]`);
  linhas.push(`cUF=${cUF}`);
  linhas.push(`Modelo=${modelo}`);
  linhas.push(`Serie=${serie}`);
  linhas.push(`NumDocumento=${nrNota}`);
  linhas.push(`TipoNF=1`); // 1=Saída
  linhas.push(`DataEmissao=${dtEmissao}`);
  linhas.push(`HoraEmissao=${hrEmissao}`);
  linhas.push(`Finalidade=1`); // 1=Normal
  linhas.push(`TipoEmissao=1`); // 1=Normal
  linhas.push(`IndicadorConsumidorFinal=1`);
  linhas.push(`IndicadorPresenca=1`); // 1=Operação presencial
  linhas.push(`Ambiente=${ambiente}`);
  linhas.push(`NaturezaOperacao=${cabecalho.nat_op || 'VENDA DE MERCADORIA'}`);
  linhas.push(`FormatoImpressaoDANFE=${isNFCe ? '4' : '1'}`);
  linhas.push(``);

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Emitente
  // ──────────────────────────────────────────────────────────────
  linhas.push(`[Emitente]`);
  linhas.push(`CNPJ=${cnpjEmitente}`);
  linhas.push(`RazaoSocial=${empresa.razao_social || ''}`);
  linhas.push(`NomeFantasia=${empresa.nome_fantasia || ''}`);
  linhas.push(`InscricaoEstadual=${limparNumeros(empresa.inscricao_estadual || '')}`);
  if (empresa.inscricao_municipal) linhas.push(`InscricaoMunicipal=${limparNumeros(empresa.inscricao_municipal)}`);
  linhas.push(`CRT=${mapearCRT(empresa.regime_trib || 'S')}`);
  linhas.push(`Logradouro=${empresa.endereco_logradouro || ''}`);
  linhas.push(`Numero=${empresa.endereco_numero || 'SN'}`);
  linhas.push(`Bairro=${empresa.endereco_bairro || ''}`);
  linhas.push(`CEP=${limparNumeros(empresa.endereco_cep || '')}`);
  linhas.push(`UF=${empresa.cidade?.uf || empresa.cidade?.estado_id || 'SP'}`);
  linhas.push(`CodigoMunicipio=${empresa.cidade?.codigo_ibge || ''}`);
  linhas.push(`Municipio=${empresa.cidade?.descricao || ''}`);
  linhas.push(`Telefone=${limparNumeros(empresa.fone_geral || '')}`);
  linhas.push(``);

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Destinatário
  // ──────────────────────────────────────────────────────────────
  linhas.push(`[Destinatario]`);
  if (cadastro && cadastro.cnpj) {
    const docDest = limparNumeros(cadastro.cnpj || '');
    if (docDest.length === 14) linhas.push(`CNPJ=${docDest}`);
    else if (docDest.length === 11) linhas.push(`CPF=${docDest}`);
    linhas.push(`RazaoSocial=${cadastro.razao_social || ''}`);
    linhas.push(`InscricaoEstadual=${limparNumeros(cadastro.inscricao_estadual || '')}`);
    linhas.push(`IndicadorIEDest=${cadastro.tp_contribuinte === 'S' ? '1' : '9'}`);
    linhas.push(`Logradouro=${cadastro.endereco_logradouro || ''}`);
    linhas.push(`Numero=${cadastro.endereco_numero || 'SN'}`);
    linhas.push(`Bairro=${cadastro.endereco_bairro || ''}`);
    linhas.push(`CEP=${limparNumeros(cadastro.endereco_cep || '')}`);
    linhas.push(`UF=${cadastro.cidade?.uf || cadastro.cidade?.estado_id || ''}`);
    linhas.push(`CodigoMunicipio=${cadastro.cidade?.codigo_ibge || ''}`);
    linhas.push(`Municipio=${cadastro.cidade?.descricao || ''}`);
    linhas.push(`Email=${cadastro.email || ''}`);
  } else {
    // Consumidor sem identificação (NFCe)
    linhas.push(`NaoIdentificado=1`);
    linhas.push(`IndicadorIEDest=9`);
  }
  linhas.push(``);

  // ──────────────────────────────────────────────────────────────
  // SEÇÕES: Itens
  // ──────────────────────────────────────────────────────────────
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    const nr = String(i + 1).padStart(3, '0');
    const isSimples = (empresa.regime_trib || 'S') === 'S';

    linhas.push(`[Item${nr}]`);
    linhas.push(`CodigoProduto=${it.produto_id || String(i + 1).padStart(6, '0')}`);
    linhas.push(`CodigoBarras=${it.gtin || 'SEM GTIN'}`);
    linhas.push(`Descricao=${it.nm_produto || ''}`);
    linhas.push(`NCM=${it.ncm || ''}`);
    linhas.push(`CEST=${it.cest || ''}`);
    linhas.push(`CFOP=${it.cfop || '5102'}`);
    linhas.push(`Unidade=${it.unidade || 'UN'}`);
    linhas.push(`Quantidade=${it.qt_movimento}`);
    linhas.push(`ValorUnitario=${it.vl_unit}`);
    linhas.push(`ValorDesconto=${it.vl_desconto || 0}`);
    linhas.push(`ValorTotal=${it.vl_total}`);
    linhas.push(`ValorFrete=0`);
    linhas.push(`ValorSeguro=0`);
    linhas.push(`ValorOutro=0`);
    linhas.push(`IndTotal=1`);
    linhas.push(``);

    // ICMS
    linhas.push(`[ImpostoIcms${nr}]`);
    linhas.push(`Origem=${it.origem || 0}`);
    if (isSimples) {
      linhas.push(`CSOSN=${it.csosn || '400'}`);
      if (Number(it.pc_icms) > 0) {
        linhas.push(`pCredSN=${it.pc_icms}`);
        linhas.push(`vCredICMSSN=${it.vl_icms || 0}`);
      }
    } else {
      linhas.push(`CST=${it.cst_icms || '00'}`);
      linhas.push(`ModalidadeBC=${it.mod_bc || 3}`);
      linhas.push(`ValorBC=${it.vl_total}`);
      linhas.push(`Aliquota=${it.pc_icms || 0}`);
      linhas.push(`ValorICMS=${it.vl_icms || 0}`);
    }
    if (Number(it.vl_icms_st || 0) > 0) {
      linhas.push(`ModalidadeBCST=${it.mod_bc_st || 4}`);
      linhas.push(`pMVAST=${it.mva_st || 0}`);
      linhas.push(`ValorBCST=${it.vl_bc_st || 0}`);
      linhas.push(`AliquotaST=${it.pc_icms_st || 0}`);
      linhas.push(`ValorICMSST=${it.vl_icms_st || 0}`);
    }
    linhas.push(``);

    // IPI (apenas NFe)
    if (!isNFCe) {
      linhas.push(`[ImpostoIpi${nr}]`);
      linhas.push(`CST=${it.cst_ipi || '99'}`);
      linhas.push(`cEnq=${it.c_enq || '999'}`);
      if (Number(it.pc_ipi) > 0) {
        linhas.push(`ValorBC=${it.vl_total}`);
        linhas.push(`Aliquota=${it.pc_ipi}`);
        linhas.push(`ValorIPI=${it.vl_ipi || 0}`);
      }
      linhas.push(``);
    }

    // PIS
    linhas.push(`[ImpostoPis${nr}]`);
    linhas.push(`CST=${it.cst_pis || '07'}`);
    if (Number(it.pc_pis) > 0) {
      linhas.push(`ValorBC=${it.vl_total}`);
      linhas.push(`Aliquota=${it.pc_pis}`);
      linhas.push(`ValorPIS=${it.vl_pis || 0}`);
    } else {
      linhas.push(`ValorPIS=0`);
    }
    linhas.push(``);

    // COFINS
    linhas.push(`[ImpostoCofins${nr}]`);
    linhas.push(`CST=${it.cst_cofins || '07'}`);
    if (Number(it.pc_cofins) > 0) {
      linhas.push(`ValorBC=${it.vl_total}`);
      linhas.push(`Aliquota=${it.pc_cofins}`);
      linhas.push(`ValorCOFINS=${it.vl_cofins || 0}`);
    } else {
      linhas.push(`ValorCOFINS=0`);
    }
    linhas.push(``);
  }

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Totais
  // ──────────────────────────────────────────────────────────────
  const vlProd = itens.reduce((s, it) => s + Number(it.vl_total || 0), 0);
  const vlDesc = itens.reduce((s, it) => s + Number(it.vl_desconto || 0), 0);
  const vlIpi  = itens.reduce((s, it) => s + Number(it.vl_ipi || 0), 0);
  const vlSt   = itens.reduce((s, it) => s + Number(it.vl_icms_st || 0), 0);
  const vlPis  = itens.reduce((s, it) => s + Number(it.vl_pis || 0), 0);
  const vlCof  = itens.reduce((s, it) => s + Number(it.vl_cofins || 0), 0);
  const vlFrete   = Number(cabecalho.vl_frete || 0);
  const vlSeguro  = Number(cabecalho.vl_seguro || 0);
  const vlDespesa = Number(cabecalho.vl_despesa || 0);
  const vlTotal = arred(vlProd + vlIpi + vlSt + vlFrete + vlSeguro + vlDespesa - vlDesc);

  linhas.push(`[Total]`);
  linhas.push(`ValorTotalProdutos=${arred(vlProd)}`);
  linhas.push(`ValorDesconto=${arred(vlDesc)}`);
  linhas.push(`ValorFrete=${vlFrete}`);
  linhas.push(`ValorSeguro=${vlSeguro}`);
  linhas.push(`OutrasDespesas=${vlDespesa}`);
  linhas.push(`ValorIPI=${arred(vlIpi)}`);
  linhas.push(`ValorICMSST=${arred(vlSt)}`);
  linhas.push(`ValorPIS=${arred(vlPis)}`);
  linhas.push(`ValorCOFINS=${arred(vlCof)}`);
  linhas.push(`ValorTotalNota=${vlTotal}`);
  linhas.push(``);

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Transportador (NFe)
  // ──────────────────────────────────────────────────────────────
  if (!isNFCe) {
    linhas.push(`[Transportador]`);
    linhas.push(`ModalidadeFrete=9`); // 9=Sem frete
    linhas.push(``);
  }

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Pagamento
  // ──────────────────────────────────────────────────────────────
  linhas.push(`[Pagamento]`);
  if (pagamentos?.length) {
    for (let i = 0; i < pagamentos.length; i++) {
      const p = pagamentos[i];
      const nr = String(i + 1).padStart(3, '0');
      linhas.push(`FormaPagamento${nr}=${mapearFormaPagamento(p.t_pag || p.tp_pagamento || 'DINHEIRO')}`);
      linhas.push(`ValorPagamento${nr}=${arred(Number(p.v_pag || p.vl_pagamento || 0))}`);
    }
  } else {
    // Sem pagamento registrado — usa valor total com dinheiro
    linhas.push(`FormaPagamento001=01`);
    linhas.push(`ValorPagamento001=${vlTotal}`);
  }
  linhas.push(``);

  // ──────────────────────────────────────────────────────────────
  // SEÇÃO: Informações Adicionais
  // ──────────────────────────────────────────────────────────────
  if (cabecalho.obs_nf) {
    linhas.push(`[InformacoesAdicionais]`);
    linhas.push(`InformacoesComplementares=${cabecalho.obs_nf}`);
    linhas.push(``);
  }

  // NFCe: CSC
  if (isNFCe) {
    linhas.push(`[NFCe]`);
    linhas.push(`IdCSC=${configItem.id_csc || ''}`);
    linhas.push(`CSC=${configItem.csc || ''}`);
    linhas.push(``);
  }

  return linhas.join('\r\n');
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────

function limparNumeros(s: string): string {
  return (s || '').replace(/\D/g, '');
}

function formatarData(d: string | Date): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const dia  = String(dt.getDate()).padStart(2, '0');
  const mes  = String(dt.getMonth() + 1).padStart(2, '0');
  const ano  = dt.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(d: Date): string {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

function mapearCRT(regime: string): string {
  // 1=Simples Nacional, 2=Simples Nacional Excesso, 3=Regime Normal
  if (regime === 'S') return '1';
  return '3';
}

function mapearFormaPagamento(tp: string): string {
  const mapa: Record<string, string> = {
    'DINHEIRO': '01', '01': '01',
    'CHEQUE': '02',   '02': '02',
    'CARTAO_CREDITO': '03', '03': '03',
    'CARTAO_DEBITO': '04',  '04': '04',
    'PIX': '17',      '17': '17',
    'BOLETO': '15',   '15': '15',
    'SEM_PAGAMENTO': '90', '90': '90',
  };
  return mapa[tp?.toUpperCase()] || mapa[tp] || '01';
}

function mapearCodigoUF(uf: string): string {
  const mapa: Record<string, string> = {
    'AC':'12','AL':'27','AP':'16','AM':'13','BA':'29','CE':'23','DF':'53',
    'ES':'32','GO':'52','MA':'21','MT':'51','MS':'50','MG':'31','PA':'15',
    'PB':'25','PR':'41','PE':'26','PI':'22','RJ':'33','RN':'24','RS':'43',
    'RO':'11','RR':'14','SC':'42','SP':'35','SE':'28','TO':'17',
  };
  return mapa[(uf || 'SP').toUpperCase()] || '35';
}
