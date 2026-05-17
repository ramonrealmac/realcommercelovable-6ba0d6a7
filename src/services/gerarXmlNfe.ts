/**
 * Gerador de arquivo XML para NF-e/NFC-e (modelo 4.00).
 * Versão 2.0 do motor fiscal.
 */

export interface GerarXmlParams {
  cabecalho: any;
  itens: any[];
  pagamentos: any[];
  empresa: any;
  cadastro: any;
  fiscalConfig: any;
  configItem: any;
}

export function gerarXmlNfe(params: GerarXmlParams): string {
  const { cabecalho, itens, pagamentos, empresa, cadastro, fiscalConfig, configItem } = params;

  const modelo = String(configItem.modelo || '55');
  const isNFCe = modelo === '65';
  const serie = String(Number(configItem.serie || 1));
  const nNF = String(Number(cabecalho.nr_nota || 1));
  const ambiente = String(fiscalConfig.ambiente_nfe || 2); // 1=Produção, 2=Homologação
  
  const cidadeEmit = normalizarCidadeFiscal(empresa.cidade, empresa);
  const cMunEmit = cidadeEmit.cd_ibge;
  const ufEmit = cidadeEmit.estado_id;
  const cUF = cMunEmit.substring(0, 2) || '35';

  // Gera a data e hora baseada no relógio local do computador (como na V1) com 1 minuto de folga
  const obterDataHoraLocalComFolga = () => {
    // Subtrai 1 minuto (60000 ms) do horário atual do computador para evitar rejeições da SEFAZ
    const dt = new Date(Date.now() - 60000);
    const ano = dt.getFullYear();
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const dia = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${ano}-${mes}-${dia}T${hh}:${mm}:${ss}-03:00`;
  };

  const dhEmi = obterDataHoraLocalComFolga();
  
  // Extrai o cNF da chave_nfe existente (se disponível e válida) para garantir que a chave permaneça idêntica na retransmissão
  let cNF = "";
  if (cabecalho && cabecalho.chave_nfe && String(cabecalho.chave_nfe).replace(/\D/g, '').length === 44) {
    const limpaChave = String(cabecalho.chave_nfe).replace(/\D/g, '');
    cNF = limpaChave.substring(35, 43); // Posições 36 a 43 da chave (índices 35 a 43, exclusive 43)
  }
  
  if (!cNF) {
    cNF = String(Math.floor(10000000 + Math.random() * 89999999));
  }

  // Helper para escapar XML
  const esc = (s: any) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

  let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
  xml += `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">`;
  xml += `<idLote>1</idLote>`;
  xml += `<indSinc>1</indSinc>`;
  xml += `<NFe>`;
  xml += `<infNFe versao="4.00" Id="NFe${cUF}${dhEmi.substring(2, 4)}${dhEmi.substring(5, 7)}${empresa.cnpj.replace(/\D/g,'')}${modelo}${serie.padStart(3,'0')}${nNF.padStart(9,'0')}1${cNF}1">`;
  
  // Determina IE e Indicador do IE do Destinatário
  const ieDest = limparNumeros(cadastro?.inscricao_estadual || '');
  const indIEDest = cadastro?.tp_contribuinte === 'S' && ieDest ? '1' : (ieDest ? '2' : '9');
  
  // Se for NFC-e OU se for não contribuinte (indIEDest = 9) OU for Pessoa Física (tp_contribuinte = 'F'),
  // obrigatoriamente a operação é com Consumidor Final (indFinal = 1)
  const isConsumidorFinal = isNFCe || indIEDest === '9' || cadastro?.tp_contribuinte === 'F' ? '1' : '0';

  // <ide>
  xml += `<ide>`;
  xml += `<cUF>${cUF}</cUF>`;
  xml += `<cNF>${cNF}</cNF>`;
  xml += `<natOp>${esc(cabecalho.nat_op || 'VENDA DE MERCADORIA')}</natOp>`;
  xml += `<mod>${modelo}</mod>`;
  xml += `<serie>${serie}</serie>`;
  xml += `<nNF>${nNF}</nNF>`;
  xml += `<dhEmi>${dhEmi}</dhEmi>`;
  xml += `<tpNF>${cabecalho.tp_nf || '1'}</tpNF>`;
  xml += `<idDest>${(cadastro?.endereco_uf !== empresa.endereco_uf) ? '2' : '1'}</idDest>`; 
  xml += `<cMunFG>${cMunEmit}</cMunFG>`;
  xml += `<tpImp>${isNFCe ? '4' : '1'}</tpImp>`;
  xml += `<tpEmis>1</tpEmis>`;
  xml += `<cDV>0</cDV>`; // O ACBr calcula o dígito real
  xml += `<tpAmb>${ambiente}</tpAmb>`;
  xml += `<finNFe>${cabecalho.fin_nfe || '1'}</finNFe>`;
  xml += `<indFinal>${isConsumidorFinal}</indFinal>`;
  xml += `<indPres>1</indPres>`;
  xml += `<procEmi>0</procEmi>`;
  xml += `<verProc>RealCommerce2.0</verProc>`;
  xml += `</ide>`;

  // <emit>
  xml += `<emit>`;
  xml += `<CNPJ>${limparNumeros(empresa.cnpj)}</CNPJ>`;
  xml += `<xNome>${esc(empresa.razao_social)}</xNome>`;
  if (empresa.nome_fantasia) xml += `<xFant>${esc(empresa.nome_fantasia)}</xFant>`;
  xml += `<enderEmit>`;
  xml += `<xLgr>${esc(empresa.endereco_logradouro)}</xLgr>`;
  xml += `<nro>${esc(empresa.endereco_numero || 'SN')}</nro>`;
  xml += `<xBairro>${esc(empresa.endereco_bairro)}</xBairro>`;
  xml += `<cMun>${cMunEmit}</cMun>`;
  xml += `<xMun>${esc(empresa.cidade?.descricao)}</xMun>`;
  xml += `<UF>${ufEmit}</UF>`;
  xml += `<CEP>${limparNumeros(empresa.endereco_cep)}</CEP>`;
  xml += `<cPais>1058</cPais>`;
  xml += `<xPais>BRASIL</xPais>`;
  if (empresa.fone_geral) xml += `<fone>${limparNumeros(empresa.fone_geral)}</fone>`;
  xml += `</enderEmit>`;
  xml += `<IE>${limparNumeros(empresa.ie || empresa.inscricao_estadual)}</IE>`;
  xml += `<CRT>${mapearCRT(empresa.regime_trib)}</CRT>`;
  xml += `</emit>`;

  // <dest>
  const docDest = limparNumeros(cadastro?.cnpj || '');
  if (cadastro && (docDest || cadastro.razao_social)) {
    xml += `<dest>`;
    if (docDest.length === 14) xml += `<CNPJ>${docDest}</CNPJ>`;
    else if (docDest.length === 11) xml += `<CPF>${docDest}</CPF>`;
    
    xml += `<xNome>${esc(cadastro.razao_social || (ambiente === '2' ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL' : ''))}</xNome>`;
    
    const cidadeDest = normalizarCidadeFiscal(cadastro?.cidade, cadastro, cidadeEmit);
    if (cadastro.endereco_logradouro) {
      xml += `<enderDest>`;
      xml += `<xLgr>${esc(cadastro.endereco_logradouro)}</xLgr>`;
      xml += `<nro>${esc(cadastro.endereco_numero || 'SN')}</nro>`;
      if (cadastro.endereco_bairro) xml += `<xBairro>${esc(cadastro.endereco_bairro)}</xBairro>`;
      xml += `<cMun>${cidadeDest.cd_ibge}</cMun>`;
      xml += `<xMun>${esc(cidadeDest.descricao)}</xMun>`;
      xml += `<UF>${cidadeDest.estado_id}</UF>`;
      if (cadastro.endereco_cep) xml += `<CEP>${limparNumeros(cadastro.endereco_cep)}</CEP>`;
      xml += `<cPais>1058</cPais>`;
      xml += `<xPais>BRASIL</xPais>`;
      xml += `</enderDest>`;
    }

    xml += `<indIEDest>${indIEDest}</indIEDest>`;
    if (ieDest && indIEDest === '1') xml += `<IE>${ieDest}</IE>`;
    if (cadastro.email) xml += `<email>${esc(cadastro.email)}</email>`;
    xml += `</dest>`;
  }

  // <det>
  let vProdTotal = 0;
  let vDescTotal = 0;
  let vBCICMS = 0;
  let vICMS = 0;
  let vST = 0;
  let vPIS = 0;
  let vCOF = 0;
  let vIPI = 0;

  itens.forEach((it, idx) => {
    const nItem = idx + 1;
    const qt = Number(it.qt_entrada || it.qt_movimento || 0);
    const vUnit = Number(it.vl_unit || 0);
    const vProdItem = arred(qt * vUnit);
    const vDescItem = Number(it.vl_desconto || 0);
    const isSimples = (empresa.regime_trib || 'S') === 'S';

    vProdTotal += vProdItem;
    vDescTotal += vDescItem;
    vST += Number(it.vl_icms_st || 0);
    vPIS += Number(it.vl_pis || 0);
    vCOF += Number(it.vl_cofins || 0);
    vIPI += Number(it.vl_ipi || 0);
    
    if (!isSimples) {
      vBCICMS += Number(it.vl_bc || vProdItem - vDescItem);
      vICMS += Number(it.vl_icms || 0);
    }

    xml += `<det nItem="${nItem}">`;
    xml += `<prod>`;
    xml += `<cProd>${esc(it.produto_id || nItem)}</cProd>`;
    xml += `<cEAN>${normalizarGtinFiscal(it.gtin)}</cEAN>`;
    xml += `<xProd>${esc(it.nm_produto)}</xProd>`;
    xml += `<NCM>${esc(it.ncm)}</NCM>`;
    if (it.cest) xml += `<CEST>${esc(it.cest)}</CEST>`;
    xml += `<CFOP>${it.cfop_id || it.cfop || '5102'}</CFOP>`;
    xml += `<uCom>${esc(it.unidade || 'UN')}</uCom>`;
    xml += `<qCom>${qt.toFixed(4)}</qCom>`;
    xml += `<vUnCom>${vUnit.toFixed(10)}</vUnCom>`;
    xml += `<vProd>${vProdItem.toFixed(2)}</vProd>`;
    xml += `<cEANTrib>${normalizarGtinFiscal(it.gtin)}</cEANTrib>`;
    xml += `<uTrib>${esc(it.unidade || 'UN')}</uTrib>`;
    xml += `<qTrib>${qt.toFixed(4)}</qTrib>`;
    xml += `<vUnTrib>${vUnit.toFixed(10)}</vUnTrib>`;
    if (vDescItem > 0) xml += `<vDesc>${vDescItem.toFixed(2)}</vDesc>`;
    xml += `<indTot>1</indTot>`;
    xml += `</prod>`;

    xml += `<imposto>`;
    // ICMS
    xml += `<ICMS>`;
    if (isSimples) {
      const csosn = it.csosn || '102';
      xml += `<ICMSSN${csosn}>`;
      xml += `<orig>${it.origem || 0}</orig>`;
      xml += `<CSOSN>${csosn}</CSOSN>`;
      if (['101', '201', '900'].includes(csosn) && Number(it.pc_icms) > 0) {
        xml += `<pCredSN>${Number(it.pc_icms).toFixed(4)}</pCredSN>`;
        xml += `<vCredICMSSN>${Number(it.vl_icms || 0).toFixed(2)}</vCredICMSSN>`;
      }
      xml += `</ICMSSN${csosn}>`;
    } else {
      const cst = it.cst_icms || '00';
      xml += `<ICMS${cst}>`;
      xml += `<orig>${it.origem || 0}</orig>`;
      xml += `<CST>${cst}</CST>`;
      xml += `<modBC>${it.mod_bc || 3}</modBC>`;
      xml += `<vBC>${Number(it.vl_bc || vProdItem - vDescItem).toFixed(2)}</vBC>`;
      xml += `<pICMS>${Number(it.pc_icms || 0).toFixed(4)}</pICMS>`;
      xml += `<vICMS>${Number(it.vl_icms || 0).toFixed(2)}</vICMS>`;
      xml += `</ICMS${cst}>`;
    }
    xml += `</ICMS>`;

    // PIS
    xml += `<PIS>`;
    const cstPis = it.cst_pis || '07';
    if (['01', '02'].includes(cstPis)) {
      xml += `<PISAliq>`;
      xml += `<CST>${cstPis}</CST>`;
      xml += `<vBC>${(vProdItem - vDescItem).toFixed(2)}</vBC>`;
      xml += `<pPIS>${Number(it.pc_pis).toFixed(4)}</pPIS>`;
      xml += `<vPIS>${Number(it.vl_pis || 0).toFixed(2)}</vPIS>`;
      xml += `</PISAliq>`;
    } else {
      xml += `<PISOutr>`;
      xml += `<CST>${cstPis}</CST>`;
      xml += `<vBC>0.00</vBC>`;
      xml += `<pPIS>0.0000</pPIS>`;
      xml += `<vPIS>0.00</vPIS>`;
      xml += `</PISOutr>`;
    }
    xml += `</PIS>`;

    // COFINS
    xml += `<COFINS>`;
    const cstCof = it.cst_cofins || '07';
    if (['01', '02'].includes(cstCof)) {
      xml += `<COFINSAliq>`;
      xml += `<CST>${cstCof}</CST>`;
      xml += `<vBC>${(vProdItem - vDescItem).toFixed(2)}</vBC>`;
      xml += `<pCOFINS>${Number(it.pc_cofins).toFixed(4)}</pCOFINS>`;
      xml += `<vCOFINS>${Number(it.vl_cofins || 0).toFixed(2)}</vCOFINS>`;
      xml += `</COFINSAliq>`;
    } else {
      xml += `<COFINSOutr>`;
      xml += `<CST>${cstCof}</CST>`;
      xml += `<vBC>0.00</vBC>`;
      xml += `<pCOFINS>0.0000</pCOFINS>`;
      xml += `<vCOFINS>0.00</vCOFINS>`;
      xml += `</COFINSOutr>`;
    }
    xml += `</COFINS>`;
    
    xml += `</imposto>`;
    xml += `</det>`;
  });

  // <total>
  const vFrete = isNFCe ? 0 : Number(cabecalho.vl_frete || 0);
  const vSeg = Number(cabecalho.vl_seguro || 0);
  const vOutro = Number(cabecalho.vl_despesa || 0);
  const vNF = arred(vProdTotal + vST + vFrete + vSeg + vOutro - vDescTotal);

  xml += `<total>`;
  xml += `<ICMSTot>`;
  xml += `<vBC>${vBCICMS.toFixed(2)}</vBC>`;
  xml += `<vICMS>${vICMS.toFixed(2)}</vICMS>`;
  xml += `<vICMSDeson>0.00</vICMSDeson>`;
  xml += `<vFCP>0.00</vFCP>`;
  xml += `<vBCST>0.00</vBCST>`;
  xml += `<vST>${vST.toFixed(2)}</vST>`;
  xml += `<vFCPST>0.00</vFCPST>`;
  xml += `<vFCPSTRet>0.00</vFCPSTRet>`;
  xml += `<vProd>${vProdTotal.toFixed(2)}</vProd>`;
  xml += `<vFrete>${vFrete.toFixed(2)}</vFrete>`;
  xml += `<vSeg>${vSeg.toFixed(2)}</vSeg>`;
  xml += `<vDesc>${vDescTotal.toFixed(2)}</vDesc>`;
  xml += `<vII>0.00</vII>`;
  xml += `<vIPI>${vIPI.toFixed(2)}</vIPI>`;
  xml += `<vIPIDevol>0.00</vIPIDevol>`;
  xml += `<vPIS>${vPIS.toFixed(2)}</vPIS>`;
  xml += `<vCOFINS>${vCOF.toFixed(2)}</vCOFINS>`;
  xml += `<vOutro>${vOutro.toFixed(2)}</vOutro>`;
  xml += `<vNF>${vNF.toFixed(2)}</vNF>`;
  xml += `</ICMSTot>`;
  xml += `</total>`;

  // <transp>
  xml += `<transp>`;
  xml += `<modFrete>9</modFrete>`;
  xml += `</transp>`;

  // <pag>
  xml += `<pag>`;
  if (pagamentos?.length) {
    pagamentos.forEach(p => {
      xml += `<detPag>`;
      xml += `<tPag>${mapearFormaPagamento(p.t_pag || p.tp_pagamento || 'DINHEIRO')}</tPag>`;
      xml += `<vPag>${Number(p.v_pag || p.vl_pagamento || 0).toFixed(2)}</vPag>`;
      xml += `</detPag>`;
    });
  } else {
    xml += `<detPag>`;
    xml += `<tPag>01</tPag>`;
    xml += `<vPag>${vNF.toFixed(2)}</vPag>`;
    xml += `</detPag>`;
  }
  xml += `</pag>`;

  // <infAdic>
  if (cabecalho.obs_nf || ambiente === '2') {
    xml += `<infAdic>`;
    if (cabecalho.obs_nf) xml += `<infCpl>${esc(cabecalho.obs_nf)}</infCpl>`;
    xml += `</infAdic>`;
  }

  xml += `</infNFe>`;
  xml += `</NFe>`;
  xml += `</enviNFe>`;

  return xml;
}

// HELPERS (Reutilizados do gerarIniNfe)
function limparNumeros(s: string): string {
  return (s || '').replace(/\D/g, '');
}

function normalizarGtinFiscal(valor: string): string {
  const raw = String(valor || '').trim().toUpperCase();
  if (!raw || raw === 'SEM GTIN') return 'SEM GTIN';
  const digitos = raw.replace(/\D/g, '');
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(digitos) ? digitos : 'SEM GTIN';
}

function normalizarCidadeFiscal(cidade: any, registro: any = {}, fallback: any = {}) {
  return {
    cd_ibge: String(cidade?.cd_ibge || cidade?.codigo_ibge || registro?.codigo_municipio || registro?.endereco_codigo_municipio || fallback.cd_ibge || ''),
    descricao: cidade?.descricao || cidade?.nm_cidade || registro?.municipio || registro?.endereco_municipio || fallback.descricao || '',
    estado_id: cidade?.estado_id || cidade?.uf || registro?.endereco_uf || registro?.uf || fallback.estado_id || '',
  };
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

function mapearCRT(regime: string): string {
  if (regime === 'S') return '1';
  return '3';
}

function mapearFormaPagamento(tp: string): string {
  const mapa: Record<string, string> = {
    'DINHEIRO': '01', '01': '01',
    'CHEQUE': '02', '02': '02',
    'CARTAO_CREDITO': '03', '03': '03',
    'CARTAO_DEBITO': '04', '04': '04',
    'PIX': '17', '17': '17',
    'BOLETO': '15', '15': '15',
    'SEM_PAGAMENTO': '90', '90': '90',
  };
  return mapa[tp?.toUpperCase()] || mapa[tp] || '01';
}
