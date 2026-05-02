// ============================================================
// Report Builder Pro — Serviço Supabase (CRUD)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type {
  IRpbRelatorio, IRpbFiltro, IRpbConexao, RpbLayout,
} from '../types';

const db = supabase as any;

// ── Relatório ────────────────────────────────────────────────
export async function rpbListRelatorios(empresaId: number): Promise<IRpbRelatorio[]> {
  const { data } = await db.from('rpb_relatorio')
    .select('*').eq('empresa_id', empresaId).eq('excluido', false)
    .order('categoria').order('nome');
  return data || [];
}

export async function rpbGetRelatorio(id: number): Promise<IRpbRelatorio | null> {
  const { data } = await db.from('rpb_relatorio').select('*').eq('rpb_relatorio_id', id).single();
  return data || null;
}

export async function rpbInsertRelatorio(payload: Partial<IRpbRelatorio>) {
  return db.from('rpb_relatorio').insert(payload).select().single();
}

export async function rpbUpdateRelatorio(id: number, payload: Partial<IRpbRelatorio>) {
  return db.from('rpb_relatorio').update({ ...payload, updated_at: new Date().toISOString() })
    .eq('rpb_relatorio_id', id);
}

export async function rpbDeleteRelatorio(id: number) {
  return db.from('rpb_relatorio').update({ excluido: true }).eq('rpb_relatorio_id', id);
}

export async function rpbSaveLayout(id: number, layout: RpbLayout) {
  return db.from('rpb_relatorio')
    .update({ layout_json: layout, updated_at: new Date().toISOString() })
    .eq('rpb_relatorio_id', id);
}

// ── Filtros ──────────────────────────────────────────────────
export async function rpbListFiltros(relatorioId: number): Promise<IRpbFiltro[]> {
  const { data } = await db.from('rpb_filtro')
    .select('*').eq('rpb_relatorio_id', relatorioId).eq('excluido', false)
    .order('ordem');
  return data || [];
}

export async function rpbInsertFiltro(payload: Partial<IRpbFiltro>) {
  return db.from('rpb_filtro').insert(payload).select().single();
}

export async function rpbUpdateFiltro(id: number, payload: Partial<IRpbFiltro>) {
  return db.from('rpb_filtro').update(payload).eq('rpb_filtro_id', id);
}

export async function rpbDeleteFiltro(id: number) {
  return db.from('rpb_filtro').update({ excluido: true }).eq('rpb_filtro_id', id);
}

// ── Conexões ─────────────────────────────────────────────────
export async function rpbListConexoes(empresaId: number): Promise<IRpbConexao[]> {
  const { data } = await db.from('rpb_conexao')
    .select('*').eq('empresa_id', empresaId).eq('excluido', false).order('nome');
  return data || [];
}

// ── Execução de query via Supabase (RPC ou consulta direta) ──
export async function rpbExecuteQuery(
  sql: string,
  params: Record<string, any>,
  conexao?: IRpbConexao | null
): Promise<{ data: any[]; error: string | null }> {
  // Substitui parâmetros no SQL
  let finalSql = sql;
  for (const [key, value] of Object.entries(params)) {
    let escaped: string;
    if (Array.isArray(value)) {
      escaped = value.map(v => 
        typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)
      ).join(', ');
    } else {
      escaped = typeof value === 'string'
        ? `'${value.replace(/'/g, "''")}'`
        : value === null || value === undefined ? 'NULL' : String(value);
    }
    
    // Suporta {{key}}, {key}, {{ key }} e { key }
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{{1,2}\\s*${escapedKey}\\s*\\}{1,2}`, 'gi');
    finalSql = finalSql.replace(regex, () => escaped);
  }

  // Cleanup final: substitui qualquer variável restante por NULL para evitar erro de sintaxe no Postgres
  // Isso é vital para quando a query é testada no Manager ou colunas são detectadas no Designer
  finalSql = finalSql.replace(/\{{1,2}[\s\S]+?\}{1,2}/g, 'NULL');

  console.log('DEBUG RPB SQL:', finalSql);

  // Conexão externa (via API bridge)
  if (conexao?.url) {
    try {
      const res = await fetch(conexao.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': conexao.api_key || '',
        },
        body: JSON.stringify({ sql: finalSql }),
      });
      const json = await res.json();
      if (!res.ok) return { data: [], error: json.error || 'Erro na conexão externa.' };
      return { data: json.data || json, error: null };
    } catch (e: any) {
      return { data: [], error: e.message };
    }
  }

  // Supabase via RPC (rpb_execute_query retorna JSONB → array)
  try {
    const { data, error } = await db.rpc('rpb_execute_query', { p_sql: finalSql });
    if (error) return { data: [], error: error.message };
    // data pode ser um array (JSONB) ou null
    const rows = Array.isArray(data) ? data : [];
    return { data: rows, error: null };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}
