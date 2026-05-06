import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface ICarrega {
  mdf_carrega_id: number;
  cidade_id: number;
  cidade_nome: string;
  excluido: boolean;
}

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfCarregaTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<ICarrega[]>([]);
  const [cidadeId, setCidadeId] = useState("");
  const [cidadeNome, setCidadeNome] = useState("");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_carrega")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_carrega_id");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!cidadeId || !cidadeNome.trim()) { toast.warning("Informe o ID e o nome da cidade."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    const { error } = await supabase.from("fiscal_mdf_carrega").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      cidade_id: Number(cidadeId),
      cidade_nome: cidadeNome.toUpperCase(),
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("Cidade de carregamento adicionada.");
    setCidadeId(""); setCidadeNome("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover esta cidade de carregamento?")) return;
    await supabase.from("fiscal_mdf_carrega").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_carrega_id", id);
    load();
  };

  if (!mdfManifestoId) {
    return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;
  }

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">ID Cidade</label>
            <input type="number" value={cidadeId} onChange={e => setCidadeId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-6">
            <label className="text-xs text-muted-foreground">Nome da Cidade</label>
            <input value={cidadeNome} onChange={e => setCidadeNome(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-2">
            <button onClick={handleAdd}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium w-[80px]">ID</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Cidade</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_carrega_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border text-right">{r.cidade_id}</td>
              <td className="px-3 py-1.5 border border-border">{r.cidade_nome}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_carrega_id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhuma cidade adicionada.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MdfCarregaTab;

