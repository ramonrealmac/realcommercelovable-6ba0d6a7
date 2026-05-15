import { supabase } from "@/integrations/supabase/client";
import { provedorService } from "@/services/provedorService";

export const emitirMdfe = async (manifestoId: number, empresaId: number) => {
  // 1. Validar e buscar dados
  const { data: manifesto, error: errMdf } = await supabase
    .from("fiscal_mdf_manifesto")
    .select("*")
    .eq("mdf_manifesto_id", manifestoId)
    .single();

  if (errMdf || !manifesto) throw new Error("Manifesto não encontrado.");

  // Buscar dados das abas vinculadas
  const { data: carregamentos } = await supabase
    .from("fiscal_mdf_carrega")
    .select("*")
    .eq("mdf_manifesto_id", manifestoId)
    .eq("excluido", false);

  const { data: descarregamentos } = await supabase
    .from("fiscal_mdf_descarrega")
    .select("*")
    .eq("mdf_manifesto_id", manifestoId)
    .eq("excluido", false);

  const { data: documentos } = await supabase
    .from("fiscal_mdf_documento")
    .select("*")
    .eq("mdf_manifesto_id", manifestoId)
    .eq("excluido", false);

  const { data: veiculos } = await supabase
    .from("fiscal_mdf_veiculo")
    .select("*")
    .eq("mdf_manifesto_id", manifestoId)
    .eq("excluido", false);

  const { data: motoristas } = await supabase
    .from("fiscal_mdf_motorista")
    .select("condutor_id")
    .eq("mdf_manifesto_id", manifestoId)
    .eq("excluido", false);

  // 2. Validações obrigatórias antes de transmitir
  if (!carregamentos?.length) throw new Error("Pelo menos uma cidade de carregamento é obrigatória.");
  if (!descarregamentos?.length) throw new Error("Pelo menos uma cidade de descarregamento é obrigatória.");
  if (!documentos?.length) throw new Error("Pelo menos um documento fiscal é obrigatório.");
  if (!veiculos?.length) throw new Error("Pelo menos um veículo é obrigatório.");
  if (!motoristas?.length) throw new Error("Pelo menos um motorista é obrigatório.");
  if (!manifesto.ufini) throw new Error("UF Inicial é obrigatória.");
  if (!manifesto.uffim) throw new Error("UF Final é obrigatória.");
  if (Number(manifesto.peso_total) <= 0) throw new Error("Peso Total deve ser maior que zero.");
  if (Number(manifesto.qtd_nfe) <= 0) throw new Error("Quantidade de NF-e deve ser maior que zero.");

  // 3. Montar arquivo INI padrão ACBr MDF-e
  const dtEmissao = String(manifesto.dt_emissao || "").substring(0, 10);
  const dtViagem = String(manifesto.dt_viagem || "").substring(0, 10);
  const hrViagem = String(manifesto.hr_viagem || "00:00:00");

  const iniData = [
    "[infMDFe]",
    "versao=3.00",
    "[ide]",
    "cUF=41",
    "tpAmb=2",
    "tpEmit=" + (manifesto.tp_emitente || "1"),
    "tpTransp=" + (manifesto.tp_transportador || "1"),
    "mod=" + (manifesto.modelo || "58"),
    "serie=" + (manifesto.serie || "1"),
    "nMDF=" + (manifesto.numero || ""),
    "cMDF=00000000",
    "modal=" + (manifesto.modalidade || "1"),
    "dhEmi=" + dtEmissao + "T" + hrViagem + "-03:00",
    "dhIniViagem=" + dtViagem + "T" + hrViagem + "-03:00",
    "UFIni=" + (manifesto.ufini || ""),
    "UFFim=" + (manifesto.uffim || ""),
    "[tot]",
    "qCTe=0",
    "qNFe=" + (manifesto.qtd_nfe || 0),
    "qMDFe=0",
    "vCarga=" + (manifesto.valor_total || 0),
    "cUnid=01",
    "qCarga=" + (manifesto.peso_total || 0),
  ].join("\n");

  // 4. Enviar para ACBr via TCP/IP (provedorService usa http://localhost:3434)
  const iniEscapado = iniData.replace(/\n/g, "\\n");
  const acbrCmd = 'MDFE.CriarEnviarMDFe("' + iniEscapado + '", 1)';
  const responseText = await provedorService.enviarComando(acbrCmd);

  // 5. Transformar resposta INI em objeto
  const jsonResponse = provedorService.parseIni(responseText);

  // 6. Analisar status do retorno
  const retorno = jsonResponse?.RETORNO || {};
  const cStat = String(retorno.cStat || "");
  const xMotivo = String(retorno.xMotivo || responseText || "Sem retorno");
  const chMDFe = String(retorno.chMDFe || "");
  const nProt = String(retorno.nProt || "");

  const sucesso = cStat === "100" || cStat === "132";

  // 7. Atualizar status no cabeçalho
  const novoStatus = sucesso ? "A" : "R";
  await supabase
    .from("fiscal_mdf_manifesto")
    .update({ status: novoStatus })
    .eq("mdf_manifesto_id", manifestoId);

  // 8. Salvar histórico XML
  await supabase.from("fiscal_mdf_historicoxml").insert({
    mdf_manifesto_id: manifestoId,
    empresa_id: empresaId,
    protocolo_autorizado: nProt,
    chave: chMDFe,
    status_retorno: cStat + " - " + xMotivo,
    xml_enviado: iniData,
    xml_retorno: JSON.stringify(jsonResponse, null, 2),
    dt_cadastro: new Date().toISOString(),
  });

  if (!sucesso) {
    throw new Error("Rejeição (" + cStat + "): " + xMotivo);
  }

  return { sucesso: true, mensagem: xMotivo, json: jsonResponse };
};

