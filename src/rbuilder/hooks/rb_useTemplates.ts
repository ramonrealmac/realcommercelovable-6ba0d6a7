import { useQuery } from "@tanstack/react-query";
import { rbFetchTemplates } from "../services/rb_templateService";

export function rbUseTemplates(XEmpresaId: number) {
  return useQuery({
    queryKey: ["rb_templates", XEmpresaId],
    queryFn: () => rbFetchTemplates(XEmpresaId),
    enabled: XEmpresaId > 0,
  });
}
