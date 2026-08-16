// ============================================================
// Report Builder Pro — Serviço Supabase (CRUD)
// ============================================================
import { supabase } from '@/integrations/supabase/client';
import type {
  IRpbRelatorio, IRpbFiltro, IRpbConexao, RpbLayout, RpbFiltroEmpresaMode,
} from '../types';

// ── Aplica filtro automático de empresa/matriz se selecionado e não presente no SQL ──
export function applyCompanyFilterToSql(sql: string, mode?: RpbFiltroEmpresaMode): string {
  if (!sql || !mode || mode === 'nenhum') return sql;

  // Se o SQL já contém {sys_empresa_id}, {sys_matriz_id} ou campo empresa_id, deixa o SQL manual do desenvolvedor
  const hasCompanyFilter = /\{{1,2}\s*(?:sys_empresa_id|sys_matriz_id)\s*\}{1,2}|\bempresa_id\b|\bempresa_matriz_id\b/i.test(sql);
  if (hasCompanyFilter) return sql;

  const targetVar = mode === 'matriz' ? '{sys_matriz_id}' : '{sys_empresa_id}';
  const filterClause = `empresa_id = ${targetVar}`;

  const whereMatch = /\bWHERE\b/i.exec(sql);
  if (whereMatch) {
    const insertIdx = whereMatch.index + whereMatch[0].length;
    return sql.slice(0, insertIdx) + ` ${filterClause} AND ` + sql.slice(insertIdx);
  } else {
    const clauseMatch = /\b(GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT)\b/i.exec(sql);
    if (clauseMatch) {
      const insertIdx = clauseMatch.index;
      return sql.slice(0, insertIdx) + ` WHERE ${filterClause} ` + sql.slice(insertIdx);
    } else {
      return `${sql.trim()} WHERE ${filterClause}`;
    }
  }
}

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
  const { rpb_relatorio_id, created_at, updated_at, ...cleanPayload } = payload as any;
  return db.from('rpb_relatorio').insert(cleanPayload).select().single();
}

export async function rpbUpdateRelatorio(id: number, payload: Partial<IRpbRelatorio>) {
  const { rpb_relatorio_id, created_at, updated_at, ...cleanPayload } = payload as any;
  return db.from('rpb_relatorio').update({ ...cleanPayload, updated_at: new Date().toISOString() })
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
  return (data || []).map((f: any) => ({
    ...f,
    tipo: f.tipo === 'query_select' ? 'lista_dinamica' : f.tipo
  }));
}

export async function rpbInsertFiltro(payload: Partial<IRpbFiltro>) {
  const { rpb_filtro_id, created_at, ...cleanPayload } = payload as any;
  // Fallback seguro: se a constraint antiga no banco ainda exigir query_select
  const dbPayload = {
    ...cleanPayload,
    tipo: cleanPayload.tipo === 'lista_dinamica' ? 'query_select' : cleanPayload.tipo
  };
  const res = await db.from('rpb_filtro').insert(dbPayload).select().single();
  if (res.data && res.data.tipo === 'query_select') {
    res.data.tipo = 'lista_dinamica';
  }
  return res;
}

export async function rpbUpdateFiltro(id: number, payload: Partial<IRpbFiltro>) {
  const { rpb_filtro_id, created_at, ...cleanPayload } = payload as any;
  // Fallback seguro: se a constraint antiga no banco ainda exigir query_select
  const dbPayload = {
    ...cleanPayload,
    tipo: cleanPayload.tipo === 'lista_dinamica' ? 'query_select' : cleanPayload.tipo
  };
  return db.from('rpb_filtro').update(dbPayload).eq('rpb_filtro_id', id);
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

  // Neutraliza filtros vazios (desconsidera a cláusula substituindo por 1=1)
  for (const [key, value] of Object.entries(params)) {
    const isEmpty = value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filterRegex = new RegExp(
        `((?:AND\\s+|OR\\s+|WHERE\\s+)?)` +
        `(?:` +
          `\\(\\s*([\\w\\.\\(\\)\\"\\'\\\`\\-\\,]+?)\\s*` +
          `(=|>=|<=|<|>|!=|<>|\\b(?:NOT\\s+)?LIKE\\b|\\b(?:NOT\\s+)?ILIKE\\b|\\b(?:NOT\\s+)?IN\\b)\\s*` +
          `\\{{1,2}\\s*` + escapedKey + `\\s*\\}{1,2}(?:::[a-zA-Z0-9_]+)?\\s*\\)` +
        `|` +
          `([\\w\\.\\(\\)\\"\\'\\\`\\-\\,]+?)\\s*` +
          `(=|>=|<=|<|>|!=|<>|\\b(?:NOT\\s+)?LIKE\\b|\\b(?:NOT\\s+)?ILIKE\\b|\\b(?:NOT\\s+)?IN\\b)\\s*` +
          `\\{{1,2}\\s*` + escapedKey + `\\s*\\}{1,2}(?:::[a-zA-Z0-9_]+)?` +
        `)`,
        'gi'
      );
      finalSql = finalSql.replace(filterRegex, (match, prefix) => {
        return prefix ? `${prefix}1=1 ` : '1=1 ';
      });
    }
  }

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
