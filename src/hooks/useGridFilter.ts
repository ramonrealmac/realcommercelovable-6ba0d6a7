import { useMemo } from "react";

const normalize = (v: any) => String(v || "").toLowerCase().trim();

export function useGridFilter<T extends Record<string, any>>(
  data: T[],
  filters: Record<string, string>
): T[] {
  return useMemo(() => {
    return data.filter((row) => {
      for (const key in filters) {
        const filterValue = normalize(filters[key]);
        if (!filterValue) continue;
        if (!normalize(row[key]).includes(filterValue)) return false;
      }
      return true;
    });
  }, [data, filters]);
}
