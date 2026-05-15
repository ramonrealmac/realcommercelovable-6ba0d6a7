/**
 * Gerador de arquivo INI para MDF-e (Modelo 58) compatível com ACBrLib.
 */
const UF_MAP: Record<string, string> = {
  AC: "12", AL: "27", AM: "13", AP: "16", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21", MG: "31", MS: "50", MT: "51", PA: "15", PB: "25", PE: "26", PI: "22", PR: "41", RJ: "33", RN: "24", RO: "11", RR: "14", RS: "43", SC: "42", SE: "28", SP: "35", TO: "17"
};

export const gerarIniMdfe = (params: any): string => {
  const { manifesto, carrega, descarrega, condutores, documentos, veiculos, percurso, fConfig } = params;

  const esc = (val: any) => String(val || '').replace(/\n/g, ' ');
  const formatData = (d: any) => d ? String(d).substring(0, 10) : '';

  let ini = "[infMDFe]\n";
  ini += "versao=3.00\n\n";

  ini += "[ide]\n";
  ini += `cUF=${UF_MAP[manifesto.ufini] || '35'}\n`;
  ini += `tpAmb=${fConfig?.ambiente_mdfe || 2}\n`;
  ini += `tpEmit=${manifesto.tp_emitente || '1'}\n`;
  ini += `tpTransp=${manifesto.tp_transportador || '1'}\n`;
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
  ini += "[tot]\n";
  ini += `qCTe=0\n`;
  ini += `qNFe=${manifesto.qtd_nfe || 0}\n`;
  ini += `vCarga=${manifesto.valor_total || 0}\n`;
  ini += `cUnid=01\n`;
  ini += `qCarga=${manifesto.peso_total || 0}\n\n`;

  // Localidades de Carregamento
  carrega.forEach((c: any, i: number) => {
    const idx = String(i + 1).padStart(3, '0');
    ini += `[infMunCarrega${idx}]\n`;
    ini += `cMunCarrega=${c.cidade?.ibge_id || c.cidade_id}\n`;
    ini += `xMunCarrega=${esc(c.cidade?.nome)}\n\n`;
  });

  // Localidades de Descarregamento e Documentos
  const cidadesDesc = Array.from(new Set(documentos.map((d: any) => d.cidade_id)));
  
  cidadesDesc.forEach((cidId, i) => {
    const idxMun = String(i + 1).padStart(3, '0');
    const docsDaCidade = documentos.filter((d: any) => d.cidade_id === cidId);
    const primDoc = docsDaCidade[0];

    ini += `[infMunDesc${idxMun}]\n`;
    ini += `cMunDesc=${primDoc.cidade?.ibge_id || cidId}\n`;
    ini += `xMunDesc=${esc(primDoc.cidade?.nome)}\n\n`;

    docsDaCidade.forEach((d: any, j: number) => {
      const idxDoc = String(j + 1).padStart(3, '0');
      ini += `[infNFe${idxMun}${idxDoc}]\n`;
      ini += `chNFe=${d.chave}\n\n`;
    });
  });

  // Percurso
  percurso.forEach((p: any, i: number) => {
    const idx = String(i + 1).padStart(3, '0');
    ini += `[infPercurso${idx}]\n`;
    ini += `UFPer=${p.uf}\n\n`;
  });

  return ini;
};

