import { supabase } from "@/integrations/supabase/client";
import type { IRbTemplatePesquisa } from "../models/rb_types";

const db = supabase as any;

export async function rbFetchTemplates(XEmpresaId: number): Promise<IRbTemplatePesquisa[]> {
  const { data } = await db
    .from("rb_templatepesquisa")
    .select("*")
    .eq("empresa_id", XEmpresaId)
    .eq("excluido", false)
    .order("rb_templatepesquisa_id");
  return data || [];
}

export async function rbInsertTemplate(XPayload: Partial<IRbTemplatePesquisa>) {
  return db.from("rb_templatepesquisa").insert(XPayload);
}

export async function rbUpdateTemplate(XId: number, XPayload: Partial<IRbTemplatePesquisa>) {
  return db.from("rb_templatepesquisa").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("rb_templatepesquisa_id", XId);
}

export async function rbDeleteTemplate(XId: number) {
  return db.from("rb_templatepesquisa").update({ excluido: true }).eq("rb_templatepesquisa_id", XId);
}
