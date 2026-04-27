import { useQuery } from "@tanstack/react-query";
import { rbFetchConexoes } from "../services/rb_connectionService";

export function rbUseConnections(XEmpresaId: number) {
  return useQuery({
    queryKey: ["rb_conexoes", XEmpresaId],
    queryFn: () => rbFetchConexoes(XEmpresaId),
    enabled: XEmpresaId > 0,
  });
}
