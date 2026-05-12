/**
 * Gerador de INI oficial para ACBrLib no worker fiscal.
 * Mantém a emissão independente do payload enviado pelo navegador, evitando
 * reprocessar layouts antigos que possam estar em cache no cliente.
 */

export function gerarIniNfe(params) {
  const { cabecalho, itens, pagamentos, empresa, cadastro, fiscalConfig, configItem } = params;

  const modelo = String(configItem?.modelo || cabecalho?.modelo || '55');
  const isNFCe = modelo === '65';
  const serie = String(Number(configItem?.serie || cabecalho?.serie || 1));
  const nNF = String(Number(cabecalho?.nr_nota || 1));
  const ambiente = String(fiscalConfig?.ambiente_nfe || 2);
  const cnpjEmit = limparNumeros(empresa?.cnpj || '');

  const cidadeEmit = normalizarCidadeFiscal(empresa?.cidade, empresa);
  const cMunEmit = cidadeEmit.cd_ibge;
  const ufEmit = cidadeEmit.estado_id;
  if (!/^\d{7}$/.test(cMunEmit) || !ufEmit) {
    throw new Error(`Empresa #${empresa?.empresa_id || ''} sem cidade fiscal válida (cMun/UF). Verifique endereco_cidade_id/cd_ibge.`);
  }
  const cUF = cMunEmit.substring(0, 2) || '35';
  const dhEmi = formatarDhEmi(new Date());
  const cNF = String(Math.floor(10000000 + Math.random() * 89999999));

  const linhas = [];

  linhas.push('[infNFe]');
  linhas.push('versao=4.00');
  linhas.push('');

  linhas.push('[Identificacao]');
  linhas.push(`cUF=${cUF}`);
  linhas.push(`cNF=${cNF}`);
  linhas.push(`natOp=${cabecalho?.nat_op || 'VENDA DE MERCADORIA'}`);
  linhas.push(`mod=${modelo}`);
  linhas.push(`serie=${serie}`);
  linhas.push(`nNF=${nNF}`);
  linhas.push(`dhEmi=${dhEmi}`);
  linhas.push('tpNF=1');
  linhas.push('idDest=1');
  linhas.push(`tpImp=${isNFCe ? '4' : '1'}`);
  linhas.push('tpEmis=1');
  linhas.push(`tpAmb=${ambiente}`);
  linhas.push('finNFe=1');
  linhas.push('indFinal=1');
  linhas.push('indPres=1');
  linhas.push('procEmi=0');
  linhas.push('verProc=RealCommerce1.0');
  linhas.push('');

  linhas.push('[Emitente]');
  linhas.push(`CRT=${mapearCRT(empresa?.regime_trib || 'S')}`);
  linhas.push(`CNPJCPF=${cnpjEmit}`);
  linhas.push(`xNome=${empresa?.razao_social || ''}`);
  if (empresa?.nome_fantasia) linhas.push(`xFant=${empresa.nome_fantasia}`);
  linhas.push(`IE=${limparNumeros(empresa?.ie || empresa?.inscricao_estadual || '')}`);
  if (empresa?.inscricao_municipal) linhas.push(`IM=${limparNumeros(empresa.inscricao_municipal)}`);
  linhas.push(`xLgr=${empresa?.endereco_logradouro || ''}`);
  linhas.push(`nro=${empresa?.endereco_numero || 'SN'}`);
  linhas.push(`xBairro=${empresa?.endereco_bairro || ''}`);
  linhas.push(`cMun=${cMunEmit}`);
  linhas.push(`xMun=${empresa?.cidade?.descricao || ''}`);
  linhas.push(`UF=${ufEmit}`);
  linhas.push(`CEP=${limparNumeros(empresa?.endereco_cep || '')}`);
  linhas.push('cPais=1058');
  linhas.push('xPais=BRASIL');
  if (empresa?.fone_geral) linhas.push(`Fone=${limparNumeros(empresa.fone_geral)}`);
  linhas.push(`cMunFG=${cMunEmit}`);
  linhas.push('');

  const cidadeDest = normalizarCidadeFiscal(cadastro?.cidade, cadastro, cidadeEmit);
  const docDest = limparNumeros(cadastro?.cnpj || '');
  const docValido = (docDest.length === 14 && validarCNPJ(docDest)) || (docDest.length === 11 && validarCPF(docDest));
  if (cadastro && (docValido || cadastro.razao_social)) {
    linhas.push('[Destinatario]');
    if (docValido) linhas.push(`CNPJCPF=${docDest}`);
    linhas.push(`xNome=${cadastro.razao_social || (ambiente === '2' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : '')}`);
    const ie = limparNumeros(cadastro.inscricao_estadual || '');
    const indIE = cadastro.tp_contribuinte === 'S' && ie ? '1' : (ie ? '2' : '9');
    linhas.push(`indIEDest=${indIE}`);
    if (ie && indIE === '1') linhas.push(`IE=${ie}`);
    if (cadastro.email) linhas.push(`Email=${cadastro.email}`);
    const temEnderecoDest = !!(cadastro.endereco_logradouro && cidadeDest.cd_ibge && cidadeDest.descricao && cidadeDest.estado_id);
    if (temEnderecoDest) {
      linhas.push(`xLgr=${cadastro.endereco_logradouro}`);
      linhas.push(`nro=${cadastro.endereco_numero || 'SN'}`);
      if (cadastro.endereco_bairro) linhas.push(`xBairro=${cadastro.endereco_bairro}`);
      linhas.push(`cMun=${cidadeDest.cd_ibge}`);
      linhas.push(`xMun=${cidadeDest.descricao}`);
      linhas.push(`UF=${cidadeDest.estado_id}`);
      if (cadastro.endereco_cep) linhas.push(`CEP=${limparNumeros(cadastro.endereco_cep)}`);
      linhas.push('cPais=1058');
      linhas.push('xPais=BRASIL');
      if (cadastro.fone_geral) linhas.push(`Fone=${limparNumeros(cadastro.fone_geral)}`);
    }
    linhas.push('');
  }

  for (let i = 0; i < itens.length; i++) {
    const it = itens[i];
    const nr = String(i + 1).padStart(3, '0');
    const isSimples = (empresa?.regime_trib || 'S') === 'S';
    const qt = Number(it.qt_entrada || it.qt_movimento || 0);
    const vUnit = Number(it.vl_unit || 0);
    const vTot = Number(it.vl_total || 0);

    // Regra SEFAZ: em homologação, o xProd do PRIMEIRO item deve ser a frase mágica
    const ehPrimeiroItemHomolog = (i === 0 && ambiente === '2');
    const xProdFinal = ehPrimeiroItemHomolog
      ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : (it.nm_produto || '');

    linhas.push(`[Produto${nr}]`);
    linhas.push(`cProd=${it.produto_id || String(i + 1).padStart(6, '0')}`);
    linhas.push(`cEAN=${it.gtin || 'SEM GTIN'}`);
    linhas.push(`cEANTrib=${it.gtin || 'SEM GTIN'}`);
    linhas.push(`xProd=${xProdFinal}`);
    linhas.push(`NCM=${it.ncm || ''}`);
    if (it.cest) linhas.push(`CEST=${it.cest}`);
    linhas.push(`CFOP=${it.cfop || '5102'}`);
    linhas.push(`uCom=${it.unidade || 'UN'}`);
    linhas.push(`qCom=${qt.toFixed(4)}`);
    linhas.push(`vUnCom=${vUnit.toFixed(10)}`);
    linhas.push(`vProd=${vTot.toFixed(2)}`);
    linhas.push(`uTrib=${it.unidade || 'UN'}`);
    linhas.push(`qTrib=${qt.toFixed(4)}`);
    linhas.push(`vUnTrib=${vUnit.toFixed(10)}`);
    linhas.push('vFrete=0.00');
    linhas.push('vSeg=0.00');
    linhas.push(`vDesc=${Number(it.vl_desconto || 0).toFixed(2)}`);
    linhas.push('vOutro=0.00');
    linhas.push('indTot=1');
    linhas.push('');

    linhas.push(`[ICMS${nr}]`);
    if (isSimples) {
      const csosn = String(it.csosn || it.cst_icms || '102');
      linhas.push(`CSOSN=${csosn}`);
      linhas.push(`orig=${it.origem || 0}`);

      // CSOSN 101 / 201 / 900 → permite pCredSN/vCredICMSSN (crédito de ICMS do Simples)
      if (['101', '201', '900'].includes(csosn) && Number(it.pc_icms) > 0) {
        linhas.push(`pCredSN=${Number(it.pc_icms).toFixed(4)}`);
        linhas.push(`vCredICMSSN=${Number(it.vl_icms || 0).toFixed(2)}`);
      }

      // CSOSN 201 / 202 / 203 → ICMS-ST a calcular (precisa modBCST/vBCST/pICMSST/vICMSST)
      if (['201', '202', '203'].includes(csosn)) {
        linhas.push(`modBCST=${it.mod_bc_st ?? 4}`);
        linhas.push(`pMVAST=${Number(it.mva_st || 0).toFixed(4)}`);
        linhas.push(`vBCST=${Number(it.vl_bc_st || 0).toFixed(2)}`);
        linhas.push(`pICMSST=${Number(it.pc_icms_st || 0).toFixed(4)}`);
        linhas.push(`vICMSST=${Number(it.vl_icms_st || 0).toFixed(2)}`);
      }

      // CSOSN 500 → ICMS cobrado anteriormente por ST (campos de retenção obrigatórios no XML)
      if (csosn === '500') {
        linhas.push(`vBCSTRet=${Number(it.vl_bc_st_ret || 0).toFixed(2)}`);
        linhas.push(`pST=${Number(it.pc_icms_st_ret || it.pc_icms_st || 0).toFixed(4)}`);
        linhas.push(`vICMSSubstituto=${Number(it.vl_icms_substituto || 0).toFixed(2)}`);
        linhas.push(`vICMSSTRet=${Number(it.vl_icms_st_ret || 0).toFixed(2)}`);
      }

      // CSOSN 900 → também aceita campos próprios de ICMS (modBC/vBC/pICMS/vICMS) quando houver
      if (csosn === '900' && Number(it.vl_icms || 0) > 0) {
        linhas.push(`modBC=${it.mod_bc ?? 3}`);
        linhas.push(`vBC=${Number(it.vl_bc || vTot).toFixed(2)}`);
        linhas.push(`pICMS=${Number(it.pc_icms || 0).toFixed(4)}`);
        linhas.push(`vICMS=${Number(it.vl_icms || 0).toFixed(2)}`);
      }
    } else {
      linhas.push(`CST=${it.cst_icms || '00'}`);
      linhas.push(`orig=${it.origem || 0}`);
      linhas.push(`modBC=${it.mod_bc || 3}`);
      linhas.push(`vBC=${Number(it.vl_bc || vTot).toFixed(2)}`);
      linhas.push(`pICMS=${Number(it.pc_icms || 0).toFixed(4)}`);
      linhas.push(`vICMS=${Number(it.vl_icms || 0).toFixed(2)}`);

      // CST 60 (regime normal) → ICMS retido anteriormente por ST
      if (String(it.cst_icms) === '60') {
        linhas.push(`vBCSTRet=${Number(it.vl_bc_st_ret || 0).toFixed(2)}`);
        linhas.push(`pST=${Number(it.pc_icms_st_ret || 0).toFixed(4)}`);
        linhas.push(`vICMSSubstituto=${Number(it.vl_icms_substituto || 0).toFixed(2)}`);
        linhas.push(`vICMSSTRet=${Number(it.vl_icms_st_ret || 0).toFixed(2)}`);
      }
    }
    if (Number(it.vl_icms_st || 0) > 0 && !isSimples) {
      linhas.push(`modBCST=${it.mod_bc_st || 4}`);
      linhas.push(`pMVAST=${Number(it.mva_st || 0).toFixed(4)}`);
      linhas.push(`vBCST=${Number(it.vl_bc_st || 0).toFixed(2)}`);
      linhas.push(`pICMSST=${Number(it.pc_icms_st || 0).toFixed(4)}`);
      linhas.push(`vICMSST=${Number(it.vl_icms_st || 0).toFixed(2)}`);
    }
    linhas.push('');

    if (!isNFCe && Number(it.pc_ipi || 0) > 0) {
      linhas.push(`[IPI${nr}]`);
      linhas.push(`CST=${it.cst_ipi || '99'}`);
      linhas.push(`cEnq=${it.c_enq || '999'}`);
      linhas.push(`vBC=${vTot.toFixed(2)}`);
      linhas.push(`pIPI=${Number(it.pc_ipi).toFixed(4)}`);
      linhas.push(`vIPI=${Number(it.vl_ipi || 0).toFixed(2)}`);
      linhas.push('');
    }

    linhas.push(`[PIS${nr}]`);
    linhas.push(`CST=${it.cst_pis || '07'}`);
    if (Number(it.pc_pis) > 0) {
      linhas.push(`vBC=${vTot.toFixed(2)}`);
      linhas.push(`pPIS=${Number(it.pc_pis).toFixed(4)}`);
      linhas.push(`vPIS=${Number(it.vl_pis || 0).toFixed(2)}`);
    } else {
      linhas.push('vPIS=0.00');
    }
    linhas.push('');

    linhas.push(`[COFINS${nr}]`);
    linhas.push(`CST=${it.cst_cofins || '07'}`);
    if (Number(it.pc_cofins) > 0) {
      linhas.push(`vBC=${vTot.toFixed(2)}`);
      linhas.push(`pCOFINS=${Number(it.pc_cofins).toFixed(4)}`);
      linhas.push(`vCOFINS=${Number(it.vl_cofins || 0).toFixed(2)}`);
    } else {
      linhas.push('vCOFINS=0.00');
    }
    linhas.push('');
  }

  const vProd = arred(itens.reduce((s, it) => s + Number(it.vl_total || 0), 0));
  const vDesc = arred(itens.reduce((s, it) => s + Number(it.vl_desconto || 0), 0));
  const vIPI = arred(itens.reduce((s, it) => s + Number(it.vl_ipi || 0), 0));
  const vST = arred(itens.reduce((s, it) => s + Number(it.vl_icms_st || 0), 0));
  const vPIS = arred(itens.reduce((s, it) => s + Number(it.vl_pis || 0), 0));
  const vCOF = arred(itens.reduce((s, it) => s + Number(it.vl_cofins || 0), 0));
  const isSimplesNacional = (empresa?.regime_trib || 'S') === 'S';
  const vICMS = isSimplesNacional ? 0 : arred(itens.reduce((s, it) => s + Number(it.vl_icms || 0), 0));
  const vBCICMS = isSimplesNacional ? 0 : arred(itens.reduce((s, it) => s + Number(it.vl_bc || 0), 0));
  const vFrete = isNFCe ? 0 : Number(cabecalho?.vl_frete || 0);
  const vSeg = Number(cabecalho?.vl_seguro || 0);
  const vOutro = Number(cabecalho?.vl_despesa || 0);
  const vNF = arred(vProd + vIPI + vST + vFrete + vSeg + vOutro - vDesc);

  linhas.push('[Total]');
  linhas.push(`vBC=${vBCICMS.toFixed(2)}`);
  linhas.push(`vICMS=${vICMS.toFixed(2)}`);
  linhas.push('vICMSDeson=0.00');
  linhas.push('vBCST=0.00');
  linhas.push(`vST=${vST.toFixed(2)}`);
  linhas.push(`vProd=${vProd.toFixed(2)}`);
  linhas.push(`vFrete=${vFrete.toFixed(2)}`);
  linhas.push(`vSeg=${vSeg.toFixed(2)}`);
  linhas.push(`vDesc=${vDesc.toFixed(2)}`);
  linhas.push('vII=0.00');
  linhas.push(`vIPI=${vIPI.toFixed(2)}`);
  linhas.push(`vPIS=${vPIS.toFixed(2)}`);
  linhas.push(`vCOFINS=${vCOF.toFixed(2)}`);
  linhas.push(`vOutro=${vOutro.toFixed(2)}`);
  linhas.push(`vNF=${vNF.toFixed(2)}`);
  linhas.push('vFCP=0.00');
  linhas.push('vFCPST=0.00');
  linhas.push('vFCPSTRet=0.00');
  linhas.push('vIPIDevol=0.00');
  linhas.push('');

  linhas.push('[Transportador]');
  linhas.push('modFrete=9');
  linhas.push('');

  if (pagamentos?.length) {
    for (let i = 0; i < pagamentos.length; i++) {
      const p = pagamentos[i];
      const nr = String(i + 1).padStart(3, '0');
      linhas.push(`[pag${nr}]`);
      linhas.push(`tPag=${mapearFormaPagamento(p.t_pag || p.tp_pagamento || 'DINHEIRO')}`);
      linhas.push(`vPag=${arred(Number(p.v_pag || p.vl_pagamento || 0)).toFixed(2)}`);
      linhas.push('indPag=0');
      linhas.push('');
    }
  } else {
    linhas.push('[pag001]');
    linhas.push('tPag=01');
    linhas.push(`vPag=${vNF.toFixed(2)}`);
    linhas.push('indPag=0');
    linhas.push('');
  }

  if (cabecalho?.obs_nf || ambiente === '2') {
    linhas.push('[DadosAdicionais]');
    if (cabecalho?.obs_nf) linhas.push(`infCpl=${cabecalho.obs_nf}`);
    linhas.push('');
  }

  if (isNFCe) {
    const idCsc = String(configItem?.id_csc || '').trim();
    const csc = String(configItem?.csc || '').trim();
    // Validação para evitar Access Violation no DLL ACBrLib quando CSC é placeholder/inválido.
    // CSC real tem 36 caracteres (UUID-like) e IdCSC normalmente 6 dígitos.
    if (!idCsc || !csc || csc.length < 16 || /^0+$/.test(csc.replace(/\D/g, ''))) {
      throw new Error(
        `CSC/IdCSC inválido para emissão de NFC-e (modelo 65). ` +
        `Configure o Token CSC real (mínimo 16 caracteres, fornecido pela SEFAZ-${ufEmit}) ` +
        `em Configuração Fiscal > Item ${modelo}/${serie}. ` +
        `Valores recebidos: IdCSC="${idCsc}", CSC com ${csc.length} caracteres.`
      );
    }
    linhas.push('[NFCe]');
    linhas.push(`IdCSC=${idCsc}`);
    linhas.push(`CSC=${csc}`);
    linhas.push('');
  }

  return linhas.join('\r\n');
}

function limparNumeros(s) {
  return String(s || '').replace(/\D/g, '');
}

function normalizarCidadeFiscal(cidade, registro = {}, fallback = {}) {
  return {
    cd_ibge: String(cidade?.cd_ibge || cidade?.codigo_ibge || registro?.codigo_municipio || registro?.endereco_codigo_municipio || fallback.cd_ibge || ''),
    descricao: cidade?.descricao || cidade?.nm_cidade || registro?.municipio || registro?.endereco_municipio || fallback.descricao || '',
    estado_id: cidade?.estado_id || cidade?.uf || registro?.endereco_uf || registro?.uf || fallback.estado_id || '',
  };
}

function formatarDhEmi(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  const dia = String(dt.getDate()).padStart(2, '0');
  const mes = String(dt.getMonth() + 1).padStart(2, '0');
  const ano = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hh}:${mm}:${ss}`;
}

function arred(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

function mapearCRT(regime) {
  return regime === 'S' ? '1' : '3';
}

function mapearFormaPagamento(tp) {
  const mapa = {
    DINHEIRO: '01', '01': '01',
    CHEQUE: '02', '02': '02',
    CARTAO_CREDITO: '03', '03': '03',
    CARTAO_DEBITO: '04', '04': '04',
    PIX: '17', '17': '17',
    BOLETO: '15', '15': '15',
    SEM_PAGAMENTO: '90', '90': '90',
  };
  return mapa[String(tp || '').toUpperCase()] || mapa[tp] || '01';
}

function validarCPF(cpf) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(cpf[10]);
}

function validarCNPJ(cnpj) {
  if (!/^\d{14}$/.test(cnpj)) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base, pesos) => {
    const s = base.split('').reduce((acc, d, i) => acc + parseInt(d) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.substring(0, 12), p1);
  const d2 = calc(cnpj.substring(0, 12) + d1, p2);
  return d1 === parseInt(cnpj[12]) && d2 === parseInt(cnpj[13]);
}