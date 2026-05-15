/**
 * Gerador de arquivo INI para MDF-e (Modelo 58) compatível com ACBrLib.
 */
export const gerarIniMdfe = (params: any): string => {
  const { manifesto, carrega, descarrega, condutores, documentos, veiculos, percurso, fConfig } = params;

  const esc = (val: any) => String(val || '').replace(/\n/g, ' ');
  const formatData = (d: any) => d ? String(d).substring(0, 10) : '';

  let ini = "[infMDFe]\n";
  ini += "versao=3.00\n\n";

  ini += "[ide]\n";
  ini += `cUF=${manifesto.ufini_cod || '35'}\n`; // Idealmente buscar o código do estado
  ini += `tpAmb=${fConfig?.ambiente_mdfe || 2}\n`;
  ini += `tpEmit=${manifesto.tp_emitente || '1'}\n`;
  ini += `tpTransp=${manifesto.tp_transportador || '1'}\n`;
  ini += `mod=${manifesto.modelo || '58'}\n`;
  ini += `serie=${manifesto.serie || '1'}\n`;
  ini += `nMDF=${manifesto.numero || ''}\n`;
  ini += `cMDF=${String(manifesto.mdf_manifesto_id).padStart(8, '0')}\n`;
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
    ini += `RNTRC=${manifesto.rntrc || '00000000'}\n\n`;

    // Veículos
    const vTracao = veiculos.find((v: any) => v.tipo === 'TRACAO');
    if (vTracao) {
      ini += "[veicTracao]\n";
      ini += `cInt=${vTracao.veiculo_id}\n`;
      ini += `placa=${vTracao.placa}\n`;
      ini += `RENAVAM=${vTracao.renavam || ''}\n`;
      ini += `tara=${vTracao.tara || 0}\n`;
      ini += `capKG=${vTracao.capacidade_kg || 0}\n`;
      ini += `tpRod=${vTracao.tp_rodado || '01'}\n`;
      ini += `tpCar=${vTracao.tp_carroceria || '00'}\n`;
      ini += `UF=${vTracao.uf || manifesto.ufini}\n\n`;
    }

    const reboques = veiculos.filter((v: any) => v.tipo === 'REBOQUE');
    reboques.forEach((v: any, i: number) => {
      const idx = String(i + 1).padStart(3, '0');
      ini += `[veicReboque${idx}]\n`;
      ini += `cInt=${v.veiculo_id}\n`;
      ini += `placa=${v.placa}\n`;
      ini += `RENAVAM=${v.renavam || ''}\n`;
      ini += `tara=${v.tara || 0}\n`;
      ini += `capKG=${v.capacidade_kg || 0}\n`;
      ini += `tpCar=${v.tp_carroceria || '00'}\n`;
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
  // O ACBr MDF-e organiza por Município de Descarregamento -> Documentos vinculados a ele
  // Aqui vamos simplificar agrupando por cidade de descarregamento
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
