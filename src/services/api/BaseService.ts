import { supabase } from "@/integrations/supabase/client";

/**
 * Base service class encapsulating common Supabase operations.
 * T: The Type representing the table row.
 * I: The Type representing the data needed to insert.
 * U: The Type representing the data needed to update.
 */
export class BaseService<T, I, U> {
  protected tableName: string;
  protected primaryKey: string;

  constructor(tableName: string, primaryKey: string) {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  protected get client() {
    return supabase;
  }

  async getById(id: number | string): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq(this.primaryKey, id)
      .single();

    if (error) throw new Error(`[${this.tableName}] Erro ao buscar: ${error.message}`);
    return data as T;
  }

  async getAll(empresaId?: number): Promise<T[]> {
    let query = this.client.from(this.tableName).select("*").eq("excluido", false);
    if (empresaId) query = query.eq("empresa_id", empresaId);

    const { data, error } = await query;
    if (error) throw new Error(`[${this.tableName}] Erro ao listar: ${error.message}`);
    return data as T[];
  }

  async create(payload: I): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert(payload as any)
      .select()
      .single();

    if (error) throw new Error(`[${this.tableName}] Erro ao criar: ${error.message}`);
    return data as T;
  }

  async update(id: number | string, payload: U): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update(payload as any)
      .eq(this.primaryKey, id)
      .select()
      .single();

    if (error) throw new Error(`[${this.tableName}] Erro ao atualizar: ${error.message}`);
    return data as T;
  }

  async softDelete(id: number | string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .update({ excluido: true, dt_alteracao: new Date().toISOString() } as any)
      .eq(this.primaryKey, id);

    if (error) throw new Error(`[${this.tableName}] Erro ao deletar: ${error.message}`);
  }
}
