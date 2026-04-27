import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { rbSubstituirVariaveis } from "../utils/rb_sqlParser";
import type { IRbConexao } from "../models/rb_types";

/**
 * Executes a query via Supabase client by parsing simple SQL patterns.
 */
export async function rbExecutarQuery(
  XQuerySql: string,
  XVariaveis: Record<string, string | number | boolean | null>,
  XConexao?: IRbConexao | null
): Promise<{ data: any[]; error: string | null }> {
  const XSqlFinal = rbSubstituirVariaveis(XQuerySql, XVariaveis);

  try {
    const XClient = XConexao?.url && XConexao?.api_key
      ? createClient(XConexao.url, XConexao.api_key)
      : supabase;

    // Parse "SELECT ... FROM table_name ..." pattern
    const XTableMatch = XSqlFinal.match(/FROM\s+(\w+)/i);
    if (!XTableMatch) {
      return { data: [], error: "Não foi possível identificar a tabela na query." };
    }

    const XTableName = XTableMatch[1];
    let XQuery = (XClient as any).from(XTableName).select("*");

    // Basic WHERE parsing for simple "field = value" AND conditions
    const XWhereMatch = XSqlFinal.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/is);
    if (XWhereMatch) {
      const XConditions = XWhereMatch[1].trim().split(/\s+AND\s+/i);
      for (const XCond of XConditions) {
        const XEqMatch = XCond.trim().match(/^(\w+)\s*=\s*'?([^']*)'?$/);
        if (XEqMatch) {
          XQuery = XQuery.eq(XEqMatch[1], XEqMatch[2]);
        }
      }
    }

    const XOrderMatch = XSqlFinal.match(/ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?/i);
    if (XOrderMatch) {
      XQuery = XQuery.order(XOrderMatch[1], { ascending: (XOrderMatch[2] || "ASC").toUpperCase() === "ASC" });
    }

    const XLimitMatch = XSqlFinal.match(/LIMIT\s+(\d+)/i);
    if (XLimitMatch) {
      XQuery = XQuery.limit(parseInt(XLimitMatch[1]));
    }

    const { data, error } = await XQuery;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  } catch (e: any) {
    return { data: [], error: e.message || "Erro ao executar query" };
  }
}
