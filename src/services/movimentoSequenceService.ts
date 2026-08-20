import { supabase } from "@/integrations/supabase/client";

/**
 * Obtém o próximo número sequencial do pedido (nr_movimento) para a empresa informada.
 * Utiliza primordialmente a RPC atômica get_proximo_nr_movimento que atualiza a tabela sys_sequencial.
 * Caso a RPC não esteja disponível, faz a atualização direta na tabela sys_sequencial ou fallback no MAX(nr_movimento).
 */
export async function obterProximoNrMovimento(empresaId: number): Promise<number> {
  const empId = empresaId && empresaId > 0 ? empresaId : 1;

  // 1. Tentar pela função RPC no PostgreSQL
  try {
    const { data, error } = await supabase.rpc("get_proximo_nr_movimento" as any, { p_empresa_id: empId });
    if (!error && data != null && Number(data) > 0) {
      return Number(data);
    }
  } catch (e) {
    console.warn("RPC get_proximo_nr_movimento indisponível, utilizando fallback em sys_sequencial:", e);
  }

  // 2. Fallback via tabela sys_sequencial
  try {
    const db = supabase as any;
    const { data: seqData } = await db
      .from("sys_sequencial")
      .select("ult_seq")
      .eq("empresa_id", empId)
      .eq("tabela", "movimento")
      .eq("nm_campo1", "nr_movimento")
      .eq("nm_campo2", "")
      .maybeSingle();

    if (seqData && seqData.ult_seq != null) {
      const nextSeq = Number(seqData.ult_seq) + 1;
      await db
        .from("sys_sequencial")
        .update({ ult_seq: nextSeq })
        .eq("empresa_id", empId)
        .eq("tabela", "movimento")
        .eq("nm_campo1", "nr_movimento")
        .eq("nm_campo2", "");
      return nextSeq;
    } else {
      // Se ainda não existe registro no sys_sequencial para a empresa, calcula o maior atual
      const { data: maxNrData } = await db
        .from("movimento")
        .select("nr_movimento")
        .eq("empresa_id", empId)
        .order("nr_movimento", { ascending: false })
        .limit(1);

      const maxNr = maxNrData && maxNrData[0]?.nr_movimento ? Number(maxNrData[0].nr_movimento) : 0;
      const nextSeq = maxNr + 1;

      await db
        .from("sys_sequencial")
        .insert({
          empresa_id: empId,
          tabela: "movimento",
          nm_campo1: "nr_movimento",
          nm_campo2: "",
          ult_seq: nextSeq,
        });

      return nextSeq;
    }
  } catch (e) {
    console.warn("Erro ao ler/atualizar sys_sequencial, utilizando fallback de MAX:", e);
    const db = supabase as any;
    const { data: maxNrData } = await db
      .from("movimento")
      .select("nr_movimento")
      .eq("empresa_id", empId)
      .order("nr_movimento", { ascending: false })
      .limit(1);
    return ((maxNrData && maxNrData[0]?.nr_movimento) || 0) + 1;
  }
}
