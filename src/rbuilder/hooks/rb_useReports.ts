import { useQuery } from "@tanstack/react-query";
import { rbFetchRelatorios } from "../services/rb_reportService";

export function rbUseReports(XEmpresaId: number) {
  return useQuery({
    queryKey: ["rb_relatorios", XEmpresaId],
    queryFn: () => rbFetchRelatorios(XEmpresaId),
    enabled: XEmpresaId > 0,
  });
}
