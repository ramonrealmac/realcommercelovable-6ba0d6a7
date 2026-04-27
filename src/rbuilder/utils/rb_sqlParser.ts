/**
 * Substitutes {{variable}} placeholders in SQL with actual values.
 * Returns the processed SQL string.
 */
export function rbSubstituirVariaveis(
  XQuerySql: string,
  XVariaveis: Record<string, string | number | boolean | null>
): string {
  let XResult = XQuerySql;
  for (const [XNome, XValor] of Object.entries(XVariaveis)) {
    const XPlaceholder = `{{${XNome}}}`;
    let XValorFormatado: string;
    if (XValor === null || XValor === undefined || XValor === "") {
      XValorFormatado = "NULL";
    } else if (typeof XValor === "number") {
      XValorFormatado = String(XValor);
    } else if (typeof XValor === "boolean") {
      XValorFormatado = XValor ? "TRUE" : "FALSE";
    } else {
      XValorFormatado = `'${String(XValor).replace(/'/g, "''")}'`;
    }
    XResult = XResult.split(XPlaceholder).join(XValorFormatado);
  }
  return XResult;
}

/**
 * Extracts all {{variable}} names from a SQL string.
 */
export function rbExtrairVariaveis(XQuerySql: string): string[] {
  const XRegex = /\{\{(\w+)\}\}/g;
  const XNomes: string[] = [];
  let XMatch;
  while ((XMatch = XRegex.exec(XQuerySql)) !== null) {
    if (!XNomes.includes(XMatch[1])) {
      XNomes.push(XMatch[1]);
    }
  }
  return XNomes;
}
