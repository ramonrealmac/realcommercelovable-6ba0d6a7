/**
 * Gerador de arquivo INI para MDF-e (Modelo 58) compatível com ACBrLib.
 */
const UF_MAP: Record<string, string> = {
  AC: "12", AL: "27", AM: "13", AP: "16", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21", MG: "31", MS: "50", MT: "51", PA: "15", PB: "25", PE: "26", PI: "22", PR: "41", RJ: "33", RN: "24", RO: "11", RR: "14", RS: "43", SC: "42", SE: "28", SP: "35", TO: "17"
};

export const gerarIniMdfe = (params: any): string => {
  const { manifesto, carrega, descarrega, condutores, documentos, veiculos, percurso, pagamentos, componentes, parcelas, fConfig } = params;

  const esc = (val: any) => String(val || '').replace(/\n/g, ' ');
  const formatData = (d: any) => d ? String(d).substring(0, 10) : '';

  let ini = "[infMDFe]\n";
  ini += "versao=3.00\n\n";

  ini += "[ide]\n";
  ini += `cUF=${UF_MAP[manifesto.ufini] || '35'}\n`;
  ini += `tpAmb=${fConfig?.ambiente_mdfe || 2}\n`;
  ini += `tpEmit=${manifesto.tp_emitente || '1'}\n`;
  if (manifesto.tp_transportador && String(manifesto.tp_transportador).trim() !== "") {
    ini += `tpTransp=${manifesto.tp_transportador}\n`;
  }
  ini += `mod=${manifesto.modelo || '58'}\n`;
  ini += `serie=${manifesto.serie || '1'}\n`;
  ini += `nMDF=${manifesto.numero || ''}\n`;
  ini += `cMDF=${String(manifesto.codigo_numerico || manifesto.mdf_manifesto_id).padStart(8, '0')}\n`;
  ini += `modal=${manifesto.modalidade || '1'}\n`;
  ini += `dhEmi=${formatData(manifesto.dt_emissao)}T${manifesto.hr_viagem || '00:00:00'}-03:00\n`;
  ini += `dhIniViagem=${formatData(manifesto.dt_viagem)}T${manifesto.hr_viagem || '00:00:00'}-03:00\n`;
  ini += `UFIni=${manifesto.ufini}\n`;
  ini += `UFFim=${manifesto.uffim}\n\n`;

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
      ini += `[condutor${idx}]\n`;
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
    ini += `[infMunCarrega${idx}]\n`;
    ini += `cMunCarrega=${c.cidade?.cd_ibge || c.cidade?.ibge_id || c.cidade_id}\n`;
    ini += `xMunCarrega=${esc(c.cidade?.descricao || c.cidade?.nome)}\n\n`;
  });

  // Localidades de Descarregamento e Documentos
  const cidadesDesc = Array.from(new Set(documentos.map((d: any) => d.cidade_id)));
  
  cidadesDesc.forEach((cidId, i) => {
    const idxMun = String(i + 1).padStart(3, '0');
    const docsDaCidade = documentos.filter((d: any) => d.cidade_id === cidId);
    const primDoc = docsDaCidade[0];

    ini += `[infMunDesc${idxMun}]\n`;
    ini += `cMunDesc=${primDoc.cidade?.cd_ibge || primDoc.cidade?.ibge_id || cidId}\n`;
    ini += `xMunDesc=${esc(primDoc.cidade?.descricao || primDoc.cidade?.nome)}\n\n`;

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
    ini += `[infPercurso${idx}]\n`;
    ini += `UFPer=${p.uf}\n\n`;
  });

  // Informações de Pagamento (infPag) - Obrigatório para Carga Lotação no Modal Rodoviário
  const qtdDfe = qNFe + qCTe;
  const tpEmit = Number(manifesto.tp_emitente || 1);
  const tpTransp = manifesto.tp_transportador;

  const isInfPagMandatoryVal = () => {
    if (manifesto.modalidade !== '1') return false;
    if (qtdDfe !== 1) return false;
    if (tpEmit === 1) return true;
    if (tpEmit === 2 && tpTransp && String(tpTransp).trim() !== "") return true;
    if (tpEmit === 3) return true;
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

