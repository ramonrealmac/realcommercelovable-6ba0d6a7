import { supabase } from "@/integrations/supabase/client";
import { createClient } from "@supabase/supabase-js";
import type { IRbConexao } from "../models/rb_types";

const db = supabase as any;

export async function rbFetchConexoes(XEmpresaId: number): Promise<IRbConexao[]> {
  const { data } = await db
    .from("rb_conexao")
    .select("*")
    .eq("empresa_id", XEmpresaId)
    .eq("excluido", false)
    .order("rb_conexao_id");
  return data || [];
}

export async function rbInsertConexao(XPayload: Partial<IRbConexao>) {
  return db.from("rb_conexao").insert(XPayload);
}

export async function rbUpdateConexao(XId: number, XPayload: Partial<IRbConexao>) {
  return db.from("rb_conexao").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("rb_conexao_id", XId);
}

export async function rbDeleteConexao(XId: number) {
  return db.from("rb_conexao").update({ excluido: true }).eq("rb_conexao_id", XId);
}

export async function rbTestarConexao(XUrl: string, XApiKey: string): Promise<{ ok: boolean; msg: string }> {
  try {
    const XClient = createClient(XUrl, XApiKey);
    const { error } = await XClient.auth.getSession();
    if (error) return { ok: false, msg: error.message };
    return { ok: true, msg: "Conexão realizada com sucesso!" };
  } catch (e: any) {
    return { ok: false, msg: e.message || "Erro desconhecido" };
  }
}
