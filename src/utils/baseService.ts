import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export const baseService = {
  async listar(table: string, empresaId: number, orderBy: string, selectCols = "*") {
    return db.from(table).select(selectCols)
      .eq("empresa_id", empresaId)
      .eq("excluido", false)
      .order(orderBy);
  },

  async inserir(table: string, payload: Record<string, any>) {
    return db.from(table).insert(payload);
  },

  async atualizar(table: string, pkField: string, pkValue: any, payload: Record<string, any>) {
    return db.from(table)
      .update({ ...payload, dt_alteracao: new Date().toISOString() })
      .eq(pkField, pkValue);
  },

  async excluirLogico(table: string, pkField: string, pkValue: any, extraFilters?: Record<string, any>) {
    let query = db.from(table)
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq(pkField, pkValue);
    if (extraFilters) {
      for (const [key, value] of Object.entries(extraFilters)) {
        query = query.eq(key, value);
      }
    }
    return query;
  },
};
