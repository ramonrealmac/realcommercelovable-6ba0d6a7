import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfPercursoTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [uf, setUf] = useState("");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_percurso")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("ordem");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!uf) { toast.warning("Selecione a UF."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    if (rows.some(r => r.uf === uf)) { toast.warning("Esta UF já foi adicionada."); return; }
    const { error } = await supabase.from("mdf_percurso").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      uf,
      ordem: rows.length + 1,
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("UF de percurso adicionada.");
    setUf("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover esta UF do percurso?")) return;
    await supabase.from("mdf_percurso").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_percurso_id", id);
    load();
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">UF Percurso</label>
            <select value={uf} onChange={e => setUf(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
              <option value="">— UF —</option>
              {UF_LIST.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium w-[80px]">Ordem</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[100px]">UF</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_percurso_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border text-right">{r.ordem}</td>
              <td className="px-3 py-1.5 border border-border font-semibold">{r.uf}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_percurso_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhuma UF de percurso adicionada.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfPercursoTab;
