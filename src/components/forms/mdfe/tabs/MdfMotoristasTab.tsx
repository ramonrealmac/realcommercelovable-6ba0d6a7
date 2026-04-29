import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfMotoristasTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pix, setPix] = useState("");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_motorista")
      .select("mdf_motorista_id, condutor_id, excluido, mdf_condutor(cpf, nome, telefone, pix)")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false);
    setMotoristas(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) { toast.warning("CPF deve ter 11 dígitos."); return; }
    if (!nome.trim()) { toast.warning("Nome é obrigatório."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }

    // Cria ou busca o condutor pelo CPF
    let condutorId: number;
    const { data: existing } = await supabase
      .from("mdf_condutor")
      .select("condutor_id")
      .eq("cpf", cpfClean)
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (existing) {
      condutorId = existing.condutor_id;
      await supabase.from("mdf_condutor").update({ nome: nome.toUpperCase(), telefone, pix }).eq("condutor_id", condutorId);
    } else {
      const { data: novo, error } = await supabase.from("mdf_condutor").insert({
        empresa_id: empresaId,
        cpf: cpfClean,
        nome: nome.toUpperCase(),
        telefone,
        pix,
        dt_cadastro: new Date().toISOString(),
      }).select("condutor_id").single();
      if (error || !novo) { toast.error("Erro ao cadastrar condutor: " + error?.message); return; }
      condutorId = novo.condutor_id;
    }

    const { error: errMotorista } = await supabase.from("mdf_motorista").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      condutor_id: condutorId,
      dt_cadastro: new Date().toISOString(),
    });
    if (errMotorista) { toast.error("Erro ao vincular motorista: " + errMotorista.message); return; }
    toast.success("Motorista adicionado.");
    setCpf(""); setNome(""); setTelefone(""); setPix("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este motorista?")) return;
    await supabase.from("mdf_motorista").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_motorista_id", id);
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
        <div className="space-y-2 border border-border rounded p-3 bg-card">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adicionar Motorista / Condutor</p>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">CPF <span className="text-destructive">*</span></label>
              <input value={cpf} onChange={e => setCpf(e.target.value.replace(/\D/g, "").substring(0, 11))}
                placeholder="00000000000"
                className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
            </div>
            <div className="col-span-5">
              <label className="text-xs text-muted-foreground">Nome <span className="text-destructive">*</span></label>
              <input value={nome} onChange={e => setNome(e.target.value.toUpperCase())}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Telefone</label>
              <input value={telefone} onChange={e => setTelefone(e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-2">
              <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">Chave PIX</label>
              <input value={pix} onChange={e => setPix(e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium">CPF</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Nome</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Telefone</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">PIX</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {motoristas.map(m => {
            const c = (m.mdf_condutor || {}) as any;
            return (
              <tr key={m.mdf_motorista_id} className="hover:bg-accent/30">
                <td className="px-3 py-1.5 border border-border font-mono">{formatCPF(c.cpf || "")}</td>
                <td className="px-3 py-1.5 border border-border">{c.nome}</td>
                <td className="px-3 py-1.5 border border-border">{c.telefone}</td>
                <td className="px-3 py-1.5 border border-border">{c.pix}</td>
                {podeEditar && (
                  <td className="px-3 py-1.5 border border-border text-center">
                    <button onClick={() => handleRemove(m.mdf_motorista_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                  </td>
                )}
              </tr>
            );
          })}
          {!motoristas.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum motorista vinculado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfMotoristasTab;
