import { supabase } from "@/integrations/supabase/client";
import { fiscalEmissaoService } from "@/services/fiscalEmissaoService";
import { gerarIniMdfe } from "./gerarIniMdfe";

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

      // Buscar relações
      const [
        { data: carrega },
        { data: descarrega },
        { data: condutores },
        { data: documentos },
        { data: veiculos },
        { data: percurso },
        { data: pagamentos },
        { data: fConfig }
      ] = await Promise.all([
        db.from("fiscal_mdf_carrega").select("*, cidade(*)").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_descarrega").select("*, cidade(*)").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_motorista").select("*, fiscal_mdf_condutor(*)").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_documento").select("*, cidade(*)").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_veiculo").select("*").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_percurso").select("*").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_mdf_pagamento").select("*").eq("mdf_manifesto_id", mdfManifestoId).eq("excluido", false),
        db.from("fiscal_config").select("*").eq("empresa_id", empresaId).single()
      ]);

      const params = {
        manifesto,
        carrega: carrega || [],
        descarrega: descarrega || [],
        condutores: (condutores || []).map((m: any) => ({
          ...m,
          nome: m.fiscal_mdf_condutor?.nome,
          cpf: m.fiscal_mdf_condutor?.cpf
        })),
        documentos: documentos || [],
        veiculos: veiculos || [],
        percurso: percurso || [],
        pagamentos: pagamentos || [],
        fConfig
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
  }
};
