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

        if (isNumericCodeColumn(key, col)) {
          if (normalizedVal !== filterValue) return false;
        } else {
          if (!normalizedVal.includes(filterValue)) return false;
        }
      }
      return true;
    });
  }, [data, filters, columns]);
}
