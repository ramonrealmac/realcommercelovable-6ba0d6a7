/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";

interface IFilterColumn {
  key: string;
  label?: any;
  getValue?: (row: any) => any;
}

const normalize = (v: any) => String(v || "").toLowerCase().trim();

const isNumericCodeColumn = (key: string, col?: IFilterColumn) => {
  const k = key.toLowerCase();
  const labelStr = typeof col?.label === "string" ? col.label.toLowerCase() : "";
  return (
    k === "codigo" ||
    k === "cd_codigo" ||
    k === "cd_produto" ||
    k === "cd_cadastro" ||
    k === "cd_vendedor" ||
    k === "produto_id" ||
    k === "cadastro_id" ||
    k === "deposito_id" ||
    k.startsWith("cd_") ||
    (k.endsWith("_id") && k !== "unidade_id") ||
    labelStr.includes("código") ||
    labelStr.includes("cód.")
  );
};

const isExactMatchColumn = (key: string, col?: IFilterColumn) => {
  const k = key.toLowerCase();
  const labelStr = typeof col?.label === "string" ? col.label.toLowerCase() : "";
  return (
    isNumericCodeColumn(key, col) ||
    k.startsWith("dt_") ||
    k.includes("date") ||
    k.includes("data") ||
    labelStr.includes("data")
  );
};

const NFE_STATUS_MAP: Record<string, string[]> = {
  A: ["autorizado", "autorizada", "1"],
  1: ["autorizado", "autorizada", "a"],
  E: ["enviado", "enviada", "transmissao", "lote"],
  P: ["pendente", "rascunho", "digitaçao"],
  C: ["cancelado", "cancelada"],
  D: ["denegado", "denegada", "2"],
  2: ["denegado", "denegada", "d"],
  R: ["rejeitado", "rejeitada", "falha", "erro"],
  F: ["falha", "erro"],
};

export function useGridFilter<T extends Record<string, any>>(
  data: T[],
  filters: Record<string, string>,
  columns?: IFilterColumn[]
): T[] {
  return useMemo(() => {
    return data.filter((row) => {
      for (const key in filters) {
        const filterValue = normalize(filters[key]);
        if (!filterValue) continue;

        const col = columns?.find(c => c.key === key);
        const val = col?.getValue ? col.getValue(row) : row[key];
        const normalizedVal = normalize(val);

        if (isExactMatchColumn(key, col)) {
          if (normalizedVal !== filterValue) return false;
        } else {
          const k = key.toLowerCase();
          if (k.includes("status") || k.includes("situacao") || k.startsWith("st_")) {
            const rawMatch = normalizedVal.includes(filterValue);
            if (rawMatch) continue;
            const aliases = NFE_STATUS_MAP[val] || NFE_STATUS_MAP[normalizedVal.toUpperCase()] || [];
            const aliasMatch = aliases.some(a => a.toLowerCase().includes(filterValue));
            if (!aliasMatch) return false;
          } else {
            if (!normalizedVal.includes(filterValue)) return false;
          }
        }
      }
      return true;
    });
  }, [data, filters, columns]);
}

