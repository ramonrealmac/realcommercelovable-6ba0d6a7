import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";

/**
 * Cache simples por empresa_id para parametros visuais/operacionais
 * lidos da tabela `empresa`. Evita refazer a query a cada render.
 */
const XCache = new Map<string, any>();

/**
 * Hook generico para ler UM campo da empresa atualmente selecionada.
 * Reutilizavel para qualquer parametro escalar (numero, string, boolean).
 *
 * @param XCampo  Nome da coluna em `empresa`
 * @param XDefault Valor padrao retornado enquanto carrega ou se vazio
 */
export function useEmpresaParam<T = any>(XCampo: string, XDefault: T): T {
  const { XEmpresaId } = useAppContext();
  const XKey = `${XEmpresaId}::${XCampo}`;
  const [XValor, setXValor] = useState<T>(() => (XCache.has(XKey) ? XCache.get(XKey) : XDefault));

  useEffect(() => {
    if (!XEmpresaId) return;
    if (XCache.has(XKey)) {
      setXValor(XCache.get(XKey));
      return;
    }
    let XAtivo = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("empresa")
        .select(XCampo)
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();
      const XVal = (data && data[XCampo] != null) ? data[XCampo] : XDefault;
      XCache.set(XKey, XVal);
      if (XAtivo) setXValor(XVal as T);
    })();
    return () => { XAtivo = false; };
  }, [XEmpresaId, XCampo]);

  return XValor;
}
