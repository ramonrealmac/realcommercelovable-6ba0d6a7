// ============================================================
// MDF-e: Serviço de integração com ACBr Monitor Plus
// Gera arquivo INI, envia ao ACBr e processa retorno
// ============================================================

import { supabase } from "@/integrations/supabase/client";
import { provedorService } from "@/services/provedorService";
import type { IMdfCabecalho, IMdfNf, IMdfVeiculoReboque, TMdfSt } from "./types";

const db = supabase as any;

// ── Helpers ─────────────────────────────────────────────────

function dateToDDMMYYYY(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function gravarLog(
  mdf_cabecalho_id: number,
  empresa_id: number,
  tp_acao: string,
  retorno: string,
  sucesso: boolean,
  obs?: string
) {
  await db.from("mdf_log").insert({
    mdf_cabecalho_id,
    empresa_id,
    tp_acao,
    retorno_acbr: retorno,
    sucesso,
    obs: obs || null,
  });
}

// ── Gerador de INI para ACBr Monitor Plus ────────────────────

export function gerarIniMdfe(
  cab: IMdfCabecalho,
  nfs: IMdfNf[],
  reboques: IMdfVeiculoReboque[]
): string {
  const dtEmissao = dateToDDMMYYYY(cab.dt_emissao);
  const dtIni = dateToDDMMYYYY(cab.dt_ini_viagem);

  // Monta percurso: UFIni + cidades intermediárias
  const cidadesPercurso = cab.cidades_percurso
    ? cab.cidades_percurso.split(";").map(c => c.trim()).filter(Boolean)
    : [];

  let ini = `[MDF-e]
Versao=3.00
Ambiente=1
Modelo=58
NumeroMDF=${cab.nr_mdf}
Serie=${cab.serie}
DtEmissao=${dtEmissao}
DtIniViagem=${dtIni}
UFIni=${cab.uf_ini}
UFFim=${cab.uf_fim}
CNPJ=${cab.cnpj_emit}
IE=${cab.ie_emit}

[Veiculo]
Placa=${cab.placa_veiculo}
RNTRC=${cab.rntrc_veiculo}
UF=${cab.uf_veiculo}
Tara=${cab.tara_veiculo}
CapKG=${cab.cap_kg_veiculo}
CapM3=${cab.cap_m3_veiculo}
TpRodado=${cab.tp_rodado}
TpCarroceria=${cab.tp_carroceria}

[Condutor]
Nome=${cab.condutor_nome}
CPF=${cab.condutor_cpf}

[TotalCarga]
QtNF=${nfs.filter(n => !n.excluido).length}
VlCarga=${cab.vl_carga.toFixed(2)}
KgCarga=${cab.kg_carga.toFixed(4)}
UnidMedida=${cab.unid_medida_carga}

`;

  // Percurso intermediário
  cidadesPercurso.forEach((cidade, idx) => {
    ini += `[Percurso${String(idx + 1).padStart(3, "0")}]
Municipio=${cidade}

`;
  });

  // Documentos (NF-e)
  const nfsAtivas = nfs.filter(n => !n.excluido);
  nfsAtivas.forEach((nf, idx) => {
    ini += `[Documento${String(idx + 1).padStart(3, "0")}]
TpDoc=${nf.tp_doc}
ChaveDoc=${nf.chave_doc}
NumDoc=${nf.nr_nota}
Serie=${nf.serie}
CNPJEmit=${nf.cnpj_emit_doc}
Valor=${nf.vl_doc.toFixed(2)}
PesoBC=${nf.kg_doc.toFixed(4)}
MunicDescarreg=${nf.cidade_descarreg}
UFDescarreg=${nf.estado_descarreg}

`;
  });

  // Reboques
  const rebAtivos = reboques.filter(r => !r.excluido);
  rebAtivos.forEach((reb, idx) => {
    ini += `[Reboque${String(idx + 1).padStart(3, "0")}]
Placa=${reb.placa}
UF=${reb.uf}
Tara=${reb.tara}
CapKG=${reb.cap_kg}
CapM3=${reb.cap_m3}
TpCarroceria=${reb.tp_carroceria}

`;
  });

  // CIOT (opcional)
  if (cab.ciot) {
    ini += `[CIOT]
CIOT=${cab.ciot}
CNPJCPF=${cab.cnpj_ciot || ""}

`;
  }

  // Seguro (opcional)
  if (cab.nr_apolice) {
    ini += `[Seguro]
NomeSeg=${cab.seguradora_nome || ""}
CNPJ=${cab.seguradora_cnpj || ""}
NroApolice=${cab.nr_apolice}
NroAverbacao=${cab.nr_averbacao || ""}

`;
  }

  if (cab.obs_mdf) {
    ini += `[InfAdic]
InfCpl=${cab.obs_mdf}

`;
  }

  return ini;
}

// ── Gerador de INI de encerramento ───────────────────────────

export function gerarIniEncerramento(cab: IMdfCabecalho): string {
  return `[Encerramento]
ChaveMDF=${cab.chave_mdf}
NumProt=${cab.nr_protocolo}
DtEnc=${dateToDDMMYYYY(new Date().toISOString().substring(0, 10))}
UFEnc=${cab.uf_fim}

`;
}

// ── Gerador de INI de cancelamento ───────────────────────────

export function gerarIniCancelamento(cab: IMdfCabecalho, justificativa: string): string {
  return `[Cancelamento]
ChaveMDF=${cab.chave_mdf}
NumProt=${cab.nr_protocolo}
Justificativa=${justificativa}

`;
}

// ── Parse do retorno ACBr ────────────────────────────────────

export interface IRetornoMdf {
  sucesso: boolean;
  mensagem: string;
  chave?: string;
  protocolo?: string;
  dtAutorizacao?: string;
  xmlAutorizado?: string;
}

export function parseRetornoAcbrMdf(retorno: string): IRetornoMdf {
  const raw = retorno || "";

  // Verifica erro explícito
  const isOk =
    raw.startsWith("OK:") ||
    raw.toLowerCase().includes("autorizado") ||
    raw.toLowerCase().includes("encerrado");

  if (!isOk) {
    return { sucesso: false, mensagem: raw.trim() };
  }

  const ini = provedorService.parseIni(raw.replace(/^OK:\s*/i, ""));

  const chave     = ini["MDF-e"]?.ChaveAcesso || ini["MDF-e"]?.Chave || "";
  const protocolo = ini["MDF-e"]?.NumProt      || ini["Protocolo"]?.Numero || "";
  const dtAut     = ini["MDF-e"]?.DhRecbto     || ini["Protocolo"]?.DtRecbto || "";

  return {
    sucesso:       true,
    mensagem:      raw.trim(),
    chave:         chave,
    protocolo:     protocolo,
    dtAutorizacao: dtAut,
    xmlAutorizado: raw,
  };
}

// ── Ações principais ─────────────────────────────────────────

/** Emite o MDF-e via ACBr Monitor Plus */
export async function emitirMdfe(
  cabId: number,
  empresaId: number
): Promise<{ sucesso: boolean; mensagem: string }> {
  // Carrega dados
  const { data: cab } = await db.from("mdf_cabecalho").select("*").eq("mdf_cabecalho_id", cabId).single();
  if (!cab) return { sucesso: false, mensagem: "MDF-e não encontrado." };

  const { data: nfs } = await db.from("mdf_nf").select("*")
    .eq("mdf_cabecalho_id", cabId).eq("excluido", false);
  const { data: reboques } = await db.from("mdf_veiculo_reboque").select("*")
    .eq("mdf_cabecalho_id", cabId).eq("excluido", false);

  const ini = gerarIniMdfe(cab as IMdfCabecalho, nfs || [], reboques || []);

  try {
    // Envia para o ACBr Monitor Plus
    const retorno = await provedorService.enviarComando(`MDFE.CriarEnviarMDFe("${ini}", 1, 1, 1)`);
    const resultado = parseRetornoAcbrMdf(retorno);

    if (resultado.sucesso) {
      // Atualiza banco com dados da autorização
      await db.from("mdf_cabecalho").update({
        st_mdf:         "X" as TMdfSt,
        chave_mdf:      resultado.chave || cab.chave_mdf,
        nr_protocolo:   resultado.protocolo || "",
        dt_autorizacao: resultado.dtAutorizacao ? new Date(resultado.dtAutorizacao).toISOString() : nowIso(),
        xml_autorizado: resultado.xmlAutorizado,
        updated_at:     nowIso(),
      }).eq("mdf_cabecalho_id", cabId);
    }

    await gravarLog(cabId, empresaId, "EMISSAO", retorno, resultado.sucesso);
    return resultado;
  } catch (e: any) {
    await gravarLog(cabId, empresaId, "EMISSAO", e.message, false);
    return { sucesso: false, mensagem: e.message };
  }
}

/** Encerra o MDF-e via ACBr Monitor Plus */
export async function encerrarMdfe(
  cabId: number,
  empresaId: number
): Promise<{ sucesso: boolean; mensagem: string }> {
  const { data: cab } = await db.from("mdf_cabecalho").select("*").eq("mdf_cabecalho_id", cabId).single();
  if (!cab) return { sucesso: false, mensagem: "MDF-e não encontrado." };
  if (cab.st_mdf !== "X") return { sucesso: false, mensagem: "Apenas MDF-e Autorizado pode ser encerrado." };

  const ini = gerarIniEncerramento(cab as IMdfCabecalho);

  try {
    const retorno = await provedorService.enviarComando(`MDFE.EncerrarMDFe("${ini}")`);
    const resultado = parseRetornoAcbrMdf(retorno);

    if (resultado.sucesso) {
      await db.from("mdf_cabecalho").update({
        st_mdf:           "E",
        dt_fim_viagem:    new Date().toISOString().substring(0, 10),
        xml_encerramento: retorno,
        updated_at:       nowIso(),
      }).eq("mdf_cabecalho_id", cabId);
    }

    await gravarLog(cabId, empresaId, "ENCERRAMENTO", retorno, resultado.sucesso);
    return resultado;
  } catch (e: any) {
    await gravarLog(cabId, empresaId, "ENCERRAMENTO", e.message, false);
    return { sucesso: false, mensagem: e.message };
  }
}

/** Cancela o MDF-e via ACBr Monitor Plus */
export async function cancelarMdfe(
  cabId: number,
  empresaId: number,
  justificativa: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const { data: cab } = await db.from("mdf_cabecalho").select("*").eq("mdf_cabecalho_id", cabId).single();
  if (!cab) return { sucesso: false, mensagem: "MDF-e não encontrado." };
  if (cab.st_mdf !== "X") return { sucesso: false, mensagem: "Apenas MDF-e Autorizado pode ser cancelado." };

  const ini = gerarIniCancelamento(cab as IMdfCabecalho, justificativa);

  try {
    const retorno = await provedorService.enviarComando(`MDFE.CancelarMDFe("${ini}")`);
    const resultado = parseRetornoAcbrMdf(retorno);

    if (resultado.sucesso) {
      await db.from("mdf_cabecalho").update({
        st_mdf:    "C",
        updated_at: nowIso(),
      }).eq("mdf_cabecalho_id", cabId);
    }

    await gravarLog(cabId, empresaId, "CANCELAMENTO", retorno, resultado.sucesso);
    return resultado;
  } catch (e: any) {
    await gravarLog(cabId, empresaId, "CANCELAMENTO", e.message, false);
    return { sucesso: false, mensagem: e.message };
  }
}

/** Consulta situação do MDF-e no ACBr */
export async function consultarMdfe(
  cabId: number,
  empresaId: number
): Promise<{ sucesso: boolean; mensagem: string }> {
  const { data: cab } = await db.from("mdf_cabecalho").select("chave_mdf").eq("mdf_cabecalho_id", cabId).single();
  if (!cab?.chave_mdf) return { sucesso: false, mensagem: "Chave MDF-e não disponível." };

  try {
    const retorno = await provedorService.enviarComando(`MDFE.ConsultarMDFe("${cab.chave_mdf}")`);
    await gravarLog(cabId, empresaId, "CONSULTA", retorno, !retorno.toLowerCase().startsWith("err"));
    return { sucesso: true, mensagem: retorno };
  } catch (e: any) {
    await gravarLog(cabId, empresaId, "CONSULTA", e.message, false);
    return { sucesso: false, mensagem: e.message };
  }
}
