import { supabase } from "@/integrations/supabase/client";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { gerarIniMdfe } from "./gerarIniMdfe";
import { areUFsNeighbors } from "./ufBorders";

const db = supabase as any;

export const mdfeEmissaoService = {
  /**
   * Enfileira a emissão de um MDF-e via fiscal_evento.
   */
  emitirMdfe: async (mdfManifestoId: number, empresaId: number) => {
    try {
      // 1. Buscar dados completos
      const { data: manifesto, error: errMdf } = await db
        .from("fiscal_mdf_manifesto")
        .select("*")
        .eq("mdf_manifesto_id", mdfManifestoId)
        .single();
      if (errMdf || !manifesto) throw new Error("Manifesto não localizado.");

      // Buscar relações primárias sem joins diretos (contornando falta de chaves estrangeiras no cache do PostgREST)
      const [
        { data: carregaRaw },
        { data: descarregaRaw },
        { data: condutoresRaw },
        { data: documentosRaw },
        { data: veiculos },
        { data: percurso },
        { data: pagamentos },
        { data: componentes },
        { data: parcelas },
        { data: fConfig },
        { data: empresaRaw },
        { data: transportadorRaw }
      ] = await Promise.all([
        db.from("fiscal_mdf_carrega").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_descarrega").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_condutor").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_documento").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_veiculo").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_percurso").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_pagamento").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_componente").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_mdf_pagtos").select("*").eq("mdf_manifesto_id", mdfManifestoId).or("excluido.is.null,excluido.eq.false"),
        db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single(),
        db.from("empresa").select("*").eq("empresa_id", empresaId).maybeSingle(),
        manifesto.transportador_id
          ? db.from("cadastro").select("cnpj, rntrc, razao_social, tp_proprietario, uf_proprietario").eq("cadastro_id", manifesto.transportador_id).maybeSingle()
          : Promise.resolve({ data: null })
      ]);

      if (!empresaRaw) throw new Error("Empresa não localizada.");

      if (!manifesto.ufini?.trim()) {
        throw new Error("UF Inicial é obrigatória. Preencha-a na aba Percurso.");
      }
      if (!manifesto.uffim?.trim()) {
        throw new Error("UF Final é obrigatória. Preencha-a na aba Percurso.");
      }

      // Validar percurso se as UFs não fazem divisa
      if (!areUFsNeighbors(manifesto.ufini, manifesto.uffim)) {
        const activePercursos = (percurso || []).filter((p: any) => !p.excluido);
        if (activePercursos.length === 0) {
          throw new Error(`As UFs de início (${manifesto.ufini}) e fim (${manifesto.uffim}) não fazem divisa. É obrigatório cadastrar pelo menos uma UF de percurso na aba Percurso.`);
        }
      }

      // Coletar IDs de Cidades e Motoristas para buscas em lote na memória
      const cidadeIds = new Set<number>();
      (carregaRaw || []).forEach((c: any) => { if (c.cidade_id) cidadeIds.add(Number(c.cidade_id)); });
      (descarregaRaw || []).forEach((d: any) => { if (d.cidade_id) cidadeIds.add(Number(d.cidade_id)); });
      (documentosRaw || []).forEach((doc: any) => { if (doc.cidade_id) cidadeIds.add(Number(doc.cidade_id)); });

      const motoristaIds = new Set<number>();
      (condutoresRaw || []).forEach((cond: any) => { if (cond.condutor_id) motoristaIds.add(Number(cond.condutor_id)); });

      const [
        { data: cidadesData },
        { data: motoristasData }
      ] = await Promise.all([
        cidadeIds.size > 0
          ? db.from("cidade").select("cidade_id, cd_ibge, descricao, estado_id").in("cidade_id", Array.from(cidadeIds))
          : Promise.resolve({ data: [] }),
        motoristaIds.size > 0
          ? db.from("cadastro_motorista").select("motorista_id, cpf, nome").in("motorista_id", Array.from(motoristaIds))
          : Promise.resolve({ data: [] })
      ]);

      // Mapeamento e validações estritas de existência de cidades
      const carrega = (carregaRaw || []).map((c: any) => {
        if (!c.cidade_id) throw new Error("Cidade de carregamento não informada (cidade_id nulo).");
        const cid = (cidadesData || []).find((x: any) => x.cidade_id === c.cidade_id);
        if (!cid) throw new Error(`Cidade de carregamento com ID ${c.cidade_id} não localizada no sistema.`);
        return { ...c, cidade: cid };
      });

      const descarrega = (descarregaRaw || []).map((d: any) => {
        if (!d.cidade_id) throw new Error("Cidade de descarregamento não informada (cidade_id nulo).");
        const cid = (cidadesData || []).find((x: any) => x.cidade_id === d.cidade_id);
        if (!cid) throw new Error(`Cidade de descarregamento com ID ${d.cidade_id} não localizada no sistema.`);
        return { ...d, cidade: cid };
      });

      const documentos = (documentosRaw || []).map((doc: any) => {
        if (!doc.cidade_id) throw new Error("Cidade do documento não informada (cidade_id nulo).");
        const cid = (cidadesData || []).find((x: any) => x.cidade_id === doc.cidade_id);
        if (!cid) throw new Error(`Cidade de descarga do documento (ID ${doc.cidade_id}) não localizada no sistema.`);
        return { ...doc, cidade: cid };
      });

      const condutores = (condutoresRaw || []).map((cond: any) => {
        const motorista = cond.condutor_id
          ? (motoristasData || []).find((x: any) => x.motorista_id === cond.condutor_id)
          : null;
        return {
          ...cond,
          cadastro_motorista: motorista,
          nome: motorista?.nome || cond.nome,
          cpf: motorista?.cpf || cond.cpf
        };
      });

      let empresa = empresaRaw;
      if (empresaRaw.endereco_cidade_id) {
        const { data: cidade } = await db.from("cidade").select("*").eq("cidade_id", empresaRaw.endereco_cidade_id).maybeSingle();
        empresa = { ...empresaRaw, cidade };
      }

      const params = {
        manifesto,
        empresa,
        carrega,
        descarrega,
        condutores,
        documentos,
        veiculos: veiculos || [],
        percurso: percurso || [],
        pagamentos: pagamentos || [],
        componentes: componentes || [],
        parcelas: parcelas || [],
        fConfig,
        transportador: transportadorRaw
      };

      // 2. Gerar INI
      const dadosIni = gerarIniMdfe(params);

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const ambiente = Number(fConfig?.ambiente_mdfe || fConfig?.ambiente_nfe || 2);

      // 3. Criar evento
      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        mdf_manifesto_id: mdfManifestoId,
        tipo: "MDFE",
        comando: "EMITIR_MDFE",
        status: "PENDENTE",
        ambiente: ambiente,
        user_id: authUser?.id || null,
        payload: {
          dados: dadosIni,
          config: {
            uf: manifesto.ufini || "SP",
            modelo: manifesto.modelo || "58",
            ambiente: ambiente,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO"
          }
        }
      }).select("id").single();

      if (evErr) throw evErr;

      // 4. Aguardar processamento
      return await (fiscalEmissaoService as any).aguardarEvento(evento.id, { empresaId });

    } catch (e: any) {
      console.error("[MdfeEmissaoService] Erro:", e);
      return { success: false, mensagem: e.message };
    }
  },

  /**
   * Encerramento de MDF-e (Obrigatório para liberar o veículo).
   */
  encerrarMdfe: async (mdfManifestoId: number, empresaId: number, paramsEncerramento: { uf: string; cidade_cod: string; dt: string }) => {
    try {
      const { data: manifesto } = await db.from("fiscal_mdf_manifesto").select("numero, serie, chave_acesso").eq("mdf_manifesto_id", mdfManifestoId).single();
      const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data: evento, error: evErr } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        mdf_manifesto_id: mdfManifestoId,
        tipo: "MDFE",
        comando: "ENCERRAR_MDFE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          chave: manifesto.chave_acesso,
          dtEnc: paramsEncerramento.dt,
          cUF: paramsEncerramento.uf,
          cMun: paramsEncerramento.cidade_cod,
          config: {
            ambiente: fConfig.ambiente_mdfe || 2,
            certificadoPath: fConfig.certificado,
            certificadoSenha: fConfig.senha_certificado || "",
            tipo_certificado: fConfig.tipo_certificado || "ARQUIVO"
          }
        }
      }).select("id").single();

      if (evErr) throw evErr;

      return await (fiscalEmissaoService as any).aguardarEvento(evento.id, { empresaId });
    } catch (e: any) {
      return { success: false, mensagem: e.message };
    }
  },

  /**
   * Solicita a geração/impressão do DAMDFE (PDF) a partir do XML autorizado.
   */
  imprimirMdfe: async (mdfManifestoId: number, empresaId: number) => {
    try {
      // 1. Encontrar o evento de emissão de MDF-e com sucesso que contém o XML
      const { data: eventoEmissao, error: errEv } = await db
        .from("fiscal_evento")
        .select("resposta, xml_retorno, payload")
        .eq("mdf_manifesto_id", mdfManifestoId)
        .eq("comando", "EMITIR_MDFE")
        .eq("status", "EMITIDO")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errEv) throw errEv;

      let xmlMdfe = eventoEmissao?.xml_retorno;
      let config = eventoEmissao?.payload?.config;

      // Se não achou na coluna xml_retorno, tentar buscar no JSON de resposta
      if (!xmlMdfe && eventoEmissao?.resposta) {
        try {
          const respObj = typeof eventoEmissao.resposta === "string" 
            ? JSON.parse(eventoEmissao.resposta) 
            : eventoEmissao.resposta;
          xmlMdfe = respObj.xml_mdfe || respObj.xml_retorno;
        } catch {}
      }

      if (!xmlMdfe) {
        throw new Error("XML autorizado do MDF-e não localizado nos eventos de transmissão. É necessário que o manifesto tenha sido transmitido com sucesso.");
      }

      // Se não tiver a configuração, buscar a padrão
      if (!config) {
        const { data: fConfig } = await db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single();
        const { data: manifesto } = await db.from("fiscal_mdf_manifesto").select("ufini, modelo").eq("mdf_manifesto_id", mdfManifestoId).single();
        config = {
          uf: manifesto?.ufini || "SP",
          modelo: manifesto?.modelo || "58",
          ambiente: fConfig?.ambiente_mdfe || fConfig?.ambiente_nfe || 2,
          certificadoPath: fConfig?.certificado,
          certificadoSenha: fConfig?.senha_certificado || "",
          tipo_certificado: fConfig?.tipo_certificado || "ARQUIVO"
        };
      }

      // Buscar configuração de impressora do fiscal_config_item
      const { data: manifesto } = await db.from("fiscal_mdf_manifesto").select("modelo, serie").eq("mdf_manifesto_id", mdfManifestoId).single();
      const { data: configItem } = await db
        .from("fiscal_config_item")
        .select("tp_imp, nm_impressora")
        .eq("empresa_id", empresaId)
        .eq("modelo", String(manifesto?.modelo || "58"))
        .eq("serie", String(manifesto?.serie || "1"))
        .maybeSingle();

      const printConfig = {
        tp_imp: configItem?.tp_imp || "PDF",
        nm_impressora: configItem?.nm_impressora || ""
      };

      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Criar o evento de IMPRIMIR_MDFE
      const { data: eventoImprimir, error: errPrint } = await db.from("fiscal_evento").insert({
        empresa_id: empresaId,
        mdf_manifesto_id: mdfManifestoId,
        tipo: "MDFE",
        comando: "IMPRIMIR_MDFE",
        status: "PENDENTE",
        user_id: authUser?.id || null,
        payload: {
          dados: xmlMdfe,
          chave: eventoEmissao?.resposta 
            ? (typeof eventoEmissao.resposta === "string" 
                ? JSON.parse(eventoEmissao.resposta).chave_mdfe 
                : eventoEmissao.resposta.chave_mdfe) 
            : null,
          config,
          print_config: printConfig
        }
      }).select("id").single();

      if (errPrint) throw errPrint;

      return await (fiscalEmissaoService as any).aguardarEvento(eventoImprimir.id, { empresaId });
    } catch (e: any) {
      console.error("[MdfeEmissaoService] Erro ao imprimir:", e);
      return { success: false, mensagem: e.message };
    }
  }
};
