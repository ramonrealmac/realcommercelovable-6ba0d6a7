import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  veiculoCadastroId: number | null;
  refreshTrigger?: number;
}

const MdfMotoristasTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar, veiculoCadastroId, refreshTrigger }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [motoristas, setMotoristas] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [motoristasList, setMotoristasList] = useState<any[]>([]);
  const [selectedMotoristaId, setSelectedMotoristaId] = useState("");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    try {
      const { data, error } = await supabase
        .from("fiscal_mdf_condutor")
        .select("mdf_condutor_id, condutor_id, excluido, cadastro_motorista(cpf, nome, telefone, chave_pix)")
        .eq("mdf_manifesto_id", mdfManifestoId)
        .eq("excluido", false);
      if (error) {
        console.error("Erro ao carregar motoristas do MDF-e:", error);
        toast.error("Erro ao carregar motoristas do MDF-e: " + error.message);
        return;
      }
      setMotoristas(data || []);
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.error("Exceção ao carregar motoristas do MDF-e:", errorObj);
      toast.error("Erro ao carregar motoristas do MDF-e: " + errorObj.message);
    }
  }, [mdfManifestoId]);

  const loadMotoristasList = useCallback(async () => {
    try {
      const { data: allData, error } = await supabase
        .from("cadastro_motorista")
        .select("motorista_id, cpf, nome, telefone, chave_pix, cadastro_id, cadastro(razao_social)")
        .eq("empresa_id", empresaId)
        .or("excluido.is.null,excluido.eq.false")
        .or("ativo.is.null,ativo.eq.true")
        .order("nome");

      if (error) {
        console.error("Erro ao carregar motoristas do cadastro:", error);
        return;
      }

      if (!allData || allData.length === 0) {
        setMotoristasList([]);
        return;
      }

      // Se houver veiculoCadastroId, ordena os motoristas do transportador selecionado no topo
      if (veiculoCadastroId) {
        const sorted = [...allData].sort((a, b) => {
          const aMatch = a.cadastro_id === veiculoCadastroId ? -1 : 1;
          const bMatch = b.cadastro_id === veiculoCadastroId ? -1 : 1;
          if (aMatch !== bMatch) return aMatch - bMatch;
          return a.nome.localeCompare(b.nome);
        });
        setMotoristasList(sorted);
      } else {
        setMotoristasList(allData);
      }
    } catch (err) {
      console.error("Exceção ao carregar motoristas do cadastro:", err);
    }
  }, [veiculoCadastroId, empresaId]);

  useEffect(() => { load(); }, [load, refreshTrigger]);
  useEffect(() => { loadMotoristasList(); }, [loadMotoristasList]);

  const handleAdd = async () => {
    if (!selectedMotoristaId) { toast.warning("Selecione um motorista."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }

    const mObj = motoristasList.find(x => String(x.motorista_id) === selectedMotoristaId);
    if (!mObj) { toast.error("Motorista selecionado não foi encontrado."); return; }

    const cpfClean = mObj.cpf.replace(/\D/g, "");
    const nomeUpper = mObj.nome.toUpperCase();
    const tel = mObj.telefone || "";
    const pixKey = mObj.chave_pix || "";

    // Verifica se já está adicionado na lista local
    const alreadyLinked = motoristas.some(m => {
      const c = m.cadastro_motorista || {};
      return c.cpf === cpfClean;
    });
    if (alreadyLinked) {
      toast.warning("Este motorista já está vinculado a este manifesto.");
      return;
    }

    const condutorId = Number(selectedMotoristaId);

    const { error: errMotorista } = await supabase.from("fiscal_mdf_condutor").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      condutor_id: condutorId,
      dt_cadastro: new Date().toISOString(),
      excluido: false,
    });
    if (errMotorista) { toast.error("Erro ao vincular motorista: " + errMotorista.message); return; }
    toast.success("Motorista adicionado.");
    setSelectedMotoristaId("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este motorista?")) return;
    await supabase.from("fiscal_mdf_condutor").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_condutor_id", id);
    load();
  };

  const formatCPF = (v: string) => {
    const d = v.replace(/\D/g, "").substring(0, 11);
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-8">
            <label className="text-xs text-muted-foreground">Selecionar Motorista <span className="text-destructive">*</span></label>
            {motoristasList.length === 0 ? (
              <div className="w-full border border-dashed border-destructive/30 rounded px-2 py-1.5 text-xs text-destructive bg-destructive/5 font-medium">
                Nenhum motorista cadastrado no sistema para esta empresa. Cadastre em Cadastros ➔ Fornecedores/Transportadores ➔ Aba Motoristas.
              </div>
            ) : (
              <select
                value={selectedMotoristaId}
                onChange={e => setSelectedMotoristaId(e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm bg-card"
              >
                <option value="">— Selecione um motorista —</option>
                {motoristasList.map(m => {
                  const transpName = m.cadastro?.razao_social ? ` (${m.cadastro.razao_social})` : "";
                  const isTarget = veiculoCadastroId && m.cadastro_id === veiculoCadastroId;
                  return (
                    <option key={m.motorista_id} value={String(m.motorista_id)}>
                      {isTarget ? "★ " : ""}{formatCPF(m.cpf)} - {m.nome}{transpName}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <div className="col-span-4">
            <button
              onClick={handleAdd}
              disabled={!selectedMotoristaId}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Vincular Motorista
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium w-[160px] whitespace-nowrap">CPF</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Nome</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[50px]"></th>}
          </tr>
        </thead>
        <tbody>
          {motoristas.map(m => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = (m.cadastro_motorista || {}) as any;
            return (
              <tr key={m.mdf_condutor_id} className="hover:bg-accent/30">
                <td className="px-3 py-1.5 border border-border font-mono whitespace-nowrap">{formatCPF(c.cpf || "")}</td>
                <td className="px-3 py-1.5 border border-border">{c.nome}</td>
                {podeEditar && (
                  <td className="px-3 py-1.5 border border-border text-center w-[50px]">
                    <button onClick={() => handleRemove(m.mdf_condutor_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                  </td>
                )}
              </tr>
            );
          })}
          {!motoristas.length && <tr><td colSpan={podeEditar ? 3 : 2} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum motorista vinculado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfMotoristasTab;

