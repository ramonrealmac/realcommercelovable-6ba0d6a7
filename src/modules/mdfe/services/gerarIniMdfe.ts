/**
 * Gerador de arquivo INI para MDF-e (Modelo 58) compatível com ACBrLib.
 */
const UF_MAP: Record<string, string> = {
  AC: "12", AL: "27", AM: "13", AP: "16", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21", MG: "31", MS: "50", MT: "51", PA: "15", PB: "25", PE: "26", PI: "22", PR: "41", RJ: "33", RN: "24", RO: "11", RR: "14", RS: "43", SC: "42", SE: "28", SP: "35", TO: "17"
};

export const gerarIniMdfe = (params: any): string => {
  const { manifesto, empresa, carrega, descarrega, condutores, documentos, veiculos, percurso, pagamentos, componentes, parcelas, fConfig } = params;

  const esc = (val: any) => String(val || '').replace(/\n/g, ' ');
  
  const formatData = (d: any): string => {
    if (!d) return '';
    if (d instanceof Date) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      return `${ano}-${mes}-${dia}`;
    }
    let str = String(d).trim();
    if (/^[A-Za-z]{3}\s[A-Za-z]{3}/.test(str)) {
      const parsedDate = new Date(str);
      if (!isNaN(parsedDate.getTime())) {
        const dia = String(parsedDate.getDate()).padStart(2, '0');
        const mes = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const ano = parsedDate.getFullYear();
        return `${ano}-${mes}-${dia}`;
      }
    }
    str = str.split(/[ T]/)[0];
    str = str.replace(/\//g, '-');
    if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
      const parts = str.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    return str.substring(0, 10);
  };

  const formatTime = (t: any): string => {
    if (!t) return '00:00:00';
    let str = String(t).trim();
    if (str.includes('T')) {
      str = str.split('T')[1] || '';
    } else if (str.includes(' ')) {
      str = str.split(' ')[1] || '';
    }
    if (str.includes('-')) {
      str = str.split('-')[0];
    }
    str = str.trim();
    if (/^\d{2}:\d{2}$/.test(str)) {
      return `${str}:00`;
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(str)) {
      return str;
    }
    return '00:00:00';
  };

  const formatACBrDateTime = (dateStr: string, timeStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]} ${timeStr}`;
    }
    return `${dateStr} ${timeStr}`;
  };

  let ini = "[infMDFe]\n";
  ini += "versao=3.00\n\n";

  const now = new Date(Date.now() - 60000); // 1 minuto de margem de segurança para sincronia de relógio com a SEFAZ
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentSeconds = String(now.getSeconds()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}:${currentSeconds}`;

  const timeStr = formatTime(manifesto.hr_viagem);
  const formattedDhEmi = formatACBrDateTime(formatData(manifesto.dt_emissao), currentTimeStr);
  const formattedDhIniViagem = formatACBrDateTime(formatData(manifesto.dt_viagem), timeStr);

  ini += "[ide]\n";
  ini += `cUF=${UF_MAP[manifesto.ufini] || '35'}\n`;
  ini += `tpAmb=${fConfig?.ambiente_mdfe || 2}\n`;
  
  const tpEmit = manifesto.tp_emitente || '1';
  const tpTransp = manifesto.tp_transportador;
  const skipTpTransp = String(tpEmit) === '2' && String(tpTransp).trim() === '4';

  ini += `tpEmit=${tpEmit}\n`;
  if (tpTransp && String(tpTransp).trim() !== "" && !skipTpTransp) {
    ini += `tpTransp=${tpTransp}\n`;
  } else {
    ini += "tpTransp=\n";
  }
  ini += `mod=${manifesto.modelo || '58'}\n`;
  ini += `serie=${manifesto.serie || '1'}\n`;
  ini += `nMDF=${manifesto.numero || ''}\n`;
  ini += `cMDF=${String(manifesto.codigo_numerico || manifesto.mdf_manifesto_id).padStart(8, '0')}\n`;
  ini += `modal=${manifesto.modalidade || '1'}\n`;
  ini += `dhEmi=${formattedDhEmi}\n`;
  ini += `dhIniViagem=${formattedDhIniViagem}\n`;
  ini += `UFIni=${manifesto.ufini}\n`;
  ini += `UFFim=${manifesto.uffim}\n\n`;

  // Emitente (Emit) - Obrigatório para MDF-e
  ini += "[emit]\n";
  const cnpjEmit = String(empresa?.cnpj || '').replace(/\D/g, '');
  ini += `CNPJCPF=${cnpjEmit}\n`;
  ini += `IE=${String(empresa?.ie || empresa?.inscricao_estadual || '').replace(/\D/g, '')}\n`;
  ini += `xNome=${esc(empresa?.razao_social || '')}\n`;
  if (empresa?.nome_fantasia) {
    ini += `xFant=${esc(empresa.nome_fantasia)}\n`;
  }
  ini += `xLgr=${esc(empresa?.endereco_logradouro || '')}\n`;
  ini += `nro=${esc(empresa?.endereco_numero || 'SN')}\n`;
  if (empresa?.endereco_complemento) {
    ini += `xCpl=${esc(empresa.endereco_complemento)}\n`;
  }
  ini += `xBairro=${esc(empresa?.endereco_bairro || '')}\n`;
  
  // Cidade do Emitente
  const cMunEmit = empresa?.cidade?.cd_ibge || empresa?.cidade?.ibge_id || '';
  ini += `cMun=${cMunEmit}\n`;
  ini += `xMun=${esc(empresa?.cidade?.descricao || empresa?.cidade?.nome || '')}\n`;
  ini += `UF=${empresa?.cidade?.estado_id || empresa?.endereco_uf || ''}\n`;
  ini += `CEP=${String(empresa?.endereco_cep || '').replace(/\D/g, '')}\n`;
  if (empresa?.fone_geral || empresa?.telefone) {
    ini += `Fone=${String(empresa.fone_geral || empresa.telefone).replace(/\D/g, '')}\n`;
  }
  ini += "\n";

  // Modal Rodoviário
  if (manifesto.modalidade === '1') {
    ini += "[infModal]\n";
    ini += "versaoModal=3.00\n\n";
    
    ini += "[rodo]\n";
    ini += `RNTRC=${manifesto.rntrc || 'ISENTO'}\n\n`;

    // CIOT
    if (manifesto.ciot && String(manifesto.ciot).trim() !== "") {
      const ciotClean = String(manifesto.ciot).replace(/\D/g, "");
      const ciotCnpjCpfClean = manifesto.ciot_cnpj_cpf ? String(manifesto.ciot_cnpj_cpf).replace(/\D/g, "") : "";
      ini += "[infCIOT001]\n";
      ini += `CIOT=${ciotClean}\n`;
      ini += `CNPJCPF=${ciotCnpjCpfClean || '00000000000000'}\n\n`;
    }

    // Contratante
    if (manifesto.contratante_cnpj_cpf && String(manifesto.contratante_cnpj_cpf).trim() !== "") {
      const contrCnpjCpfClean = String(manifesto.contratante_cnpj_cpf).replace(/\D/g, "");
      const contrNomeClean = esc(manifesto.contratante_nome || "");
      ini += "[infContratante001]\n";
      ini += `CNPJCPF=${contrCnpjCpfClean}\n`;
      ini += `xNome=${contrNomeClean}\n\n`;
    }

    // Veículos
    const vTracao = veiculos.find((v: any) => v.tp_veiculo === 'TRACAO');
    if (vTracao) {
      ini += "[veicTracao]\n";
      ini += `cInt=${vTracao.veiculo_id}\n`;
      ini += `placa=${vTracao.placa}\n`;
      ini += `RENAVAM=${vTracao.renavam || ''}\n`;
      ini += `tara=${vTracao.tara || 0}\n`;
      ini += `capKG=${vTracao.capacidade_kg || 0}\n`;
      ini += `tpRod=${String(vTracao.tp_rodado || '01').padStart(2, '0')}\n`;
      ini += `tpCar=${String(vTracao.tp_carroceria || '00').padStart(2, '0')}\n`;
      ini += `UF=${vTracao.uf || manifesto.ufini}\n\n`;
    }

    const reboques = veiculos.filter((v: any) => v.tp_veiculo === 'REBOQUE');
    reboques.forEach((v: any, i: number) => {
      const idx = String(i + 1).padStart(3, '0');
      ini += `[veicReboque${idx}]\n`;
      ini += `cInt=${v.veiculo_id}\n`;
      ini += `placa=${v.placa}\n`;
      ini += `RENAVAM=${v.renavam || ''}\n`;
      ini += `tara=${v.tara || 0}\n`;
      ini += `capKG=${v.capacidade_kg || 0}\n`;
      ini += `tpCar=${String(v.tp_carroceria || '00').padStart(2, '0')}\n`;
      ini += `UF=${v.uf || manifesto.ufini}\n\n`;
    });

    // Condutores
    condutores.forEach((c: any, i: number) => {
      const idx = String(i + 1).padStart(3, '0');
      ini += `[moto${idx}]\n`;
      ini += `xNome=${esc(c.nome)}\n`;
      ini += `CPF=${c.cpf}\n\n`;
    });
  }

  // Totais
  const qNFe = documentos.filter((d: any) => d.chave?.substring(20, 22) !== "57").length;
  const qCTe = documentos.filter((d: any) => d.chave?.substring(20, 22) === "57").length;

  ini += "[tot]\n";
  ini += `qCTe=${qCTe}\n`;
  ini += `qNFe=${qNFe}\n`;
  ini += `vCarga=${manifesto.valor_total || 0}\n`;
  ini += `cUnid=01\n`;
  ini += `qCarga=${manifesto.peso_total || 0}\n\n`;

  // Localidades de Carregamento
  carrega.forEach((c: any, i: number) => {
    const idx = String(i + 1).padStart(3, '0');
    ini += `[CARR${idx}]\n`;
    ini += `cMunCarrega=${c.cidade?.cd_ibge || c.cidade?.ibge_id || c.cidade_id}\n`;
    ini += `xMunCarrega=${esc(c.cidade?.descricao || c.cidade?.nome)}\n\n`;
  });

  // Localidades de Descarregamento e Documentos
  const cidadesDesc = Array.from(new Set(documentos.map((d: any) => d.cidade_id)));
  
  cidadesDesc.forEach((cidId, i) => {
    const idxMun = String(i + 1).padStart(3, '0');
    const docsDaCidade = documentos.filter((d: any) => d.cidade_id === cidId);
    const primDoc = docsDaCidade[0];
    ini += `[DESC${idxMun}]\n`;
    ini += `cMunDescarga=${primDoc.cidade?.cd_ibge || primDoc.cidade?.ibge_id || cidId}\n`;
    ini += `xMunDescarga=${esc(primDoc.cidade?.descricao || primDoc.cidade?.nome)}\n\n`;

    docsDaCidade.forEach((d: any, j: number) => {
      const idxDoc = String(j + 1).padStart(3, '0');
      const model = d.chave?.substring(20, 22);
      if (model === "57") {
        ini += `[infCTe${idxMun}${idxDoc}]\n`;
        ini += `chCTe=${d.chave}\n\n`;
      } else {
        ini += `[infNFe${idxMun}${idxDoc}]\n`;
        ini += `chNFe=${d.chave}\n\n`;
      }
    });
  });

  // Percurso
  percurso.forEach((p: any, i: number) => {
    const idx = String(i + 1).padStart(3, '0');
    ini += `[perc${idx}]\n`;
    ini += `UFPer=${p.uf}\n\n`;
  });

  // Informações de Pagamento (infPag) - Obrigatório para Carga Lotação no Modal Rodoviário
  const qtdDfe = qNFe + qCTe;
  const tpEmitNum = Number(tpEmit || 1);

  const isInfPagMandatoryVal = () => {
    if (manifesto.modalidade !== '1') return false;
    if (qtdDfe !== 1) return false;
    if (tpEmitNum === 1) return true;
    if (tpEmitNum === 2 && tpTransp && String(tpTransp).trim() !== "" && !skipTpTransp) return true;
    if (tpEmitNum === 3) return true;
    return false;
  };

  if (isInfPagMandatoryVal()) {
    const pag = (pagamentos && pagamentos.length > 0) ? pagamentos[0] : null;
    const temParcelas = parcelas && parcelas.length > 0;
    const indPag = temParcelas ? "1" : "0";
    const cnpjipefClean = pag?.cnpjipef 
      ? String(pag.cnpjipef).replace(/\D/g, "") 
      : (manifesto.transp_cnpj_cpf ? String(manifesto.transp_cnpj_cpf).replace(/\D/g, "") : "");

    ini += "[infPag001]\n";
    ini += `CNPJCPF=${cnpjipefClean || '00000000000000'}\n`;
    ini += `vContrato=${manifesto.valor_total || pag?.vl_contrato || 0}\n`;
    ini += `indPag=${indPag}\n`;
    if (pag?.adiantamento && Number(pag.adiantamento) > 0) {
      ini += `vAdiant=${pag.adiantamento}\n`;
    }
    ini += "\n";

    // Componentes de pagamento
    if (componentes && componentes.length > 0) {
      componentes.forEach((comp: any, idx: number) => {
        const compIdx = String(idx + 1).padStart(3, '0');
        ini += `[Comp001${compIdx}]\n`;
        ini += `tpComp=${comp.tp_componente || '99'}\n`;
        ini += `vComp=${comp.vl_componente || 0}\n`;
        if (comp.tp_componente === '99') {
          ini += `xComp=${esc(comp.ds_componente || 'Outros')}\n`;
        }
        ini += "\n";
      });
    } else {
      // Se não houver componentes cadastrados, gerar um componente padrão de Frete (04)
      ini += "[Comp001001]\n";
      ini += "tpComp=04\n";
      ini += `vComp=${manifesto.valor_total || pag?.vl_contrato || 0}\n\n`;
    }

    // Parcelas a prazo
    if (indPag === "1" && parcelas && parcelas.length > 0) {
      parcelas.forEach((p: any, idx: number) => {
        const prazoIdx = String(idx + 1).padStart(3, '0');
        ini += `[infPrazo001${prazoIdx}]\n`;
        ini += `nParcela=${p.nr_parcela}\n`;
        ini += `dVenc=${formatData(p.dt_vencimento)}\n`;
        ini += `vParcela=${p.vl_parcela || 0}\n\n`;
      });
    }
  }

  return ini;
};

