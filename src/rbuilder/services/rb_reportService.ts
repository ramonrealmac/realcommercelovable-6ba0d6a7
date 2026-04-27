import { supabase } from "@/integrations/supabase/client";
import type { IRbRelatorio, IRbRelatorioVariavel } from "../models/rb_types";

const db = supabase as any;

export async function rbFetchRelatorios(XEmpresaId: number): Promise<IRbRelatorio[]> {
  const { data } = await db
    .from("rb_relatorio")
    .select("*")
    .eq("empresa_id", XEmpresaId)
    .eq("excluido", false)
    .order("menu, submenu, ordem");
  return data || [];
}

export async function rbInsertRelatorio(XPayload: Partial<IRbRelatorio>) {
  return db.from("rb_relatorio").insert(XPayload).select().single();
}

export async function rbUpdateRelatorio(XId: number, XPayload: Partial<IRbRelatorio>) {
  return db.from("rb_relatorio").update({ ...XPayload, dt_alteracao: new Date().toISOString() }).eq("rb_relatorio_id", XId);
}

export async function rbDeleteRelatorio(XId: number) {
  return db.from("rb_relatorio").update({ excluido: true }).eq("rb_relatorio_id", XId);
}

export async function rbFetchVariaveis(XRelatorioId: number): Promise<IRbRelatorioVariavel[]> {
  const { data } = await db
    .from("rb_relatorio_variavel")
    .select("*")
    .eq("rb_relatorio_id", XRelatorioId)
    .eq("excluido", false);
  return data || [];
}

export async function rbInsertVariavel(XPayload: Partial<IRbRelatorioVariavel>) {
  return db.from("rb_relatorio_variavel").insert(XPayload);
}

export async function rbDeleteVariavel(XId: number) {
  return db.from("rb_relatorio_variavel").update({ excluido: true }).eq("rb_relatorio_variavel_id", XId);
}
