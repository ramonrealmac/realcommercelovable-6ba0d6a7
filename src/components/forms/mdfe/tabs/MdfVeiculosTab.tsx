import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfVeiculosTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [veiculoId, setVeiculoId] = useState("");
  const [placa, setPlaca] = useState("");
  const [tipo, setTipo] = useState("TRACAO");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_veiculo")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_veiculo_id");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!placa.trim()) { toast.warning("Informe a placa do veículo."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    const tracao = rows.filter(r => r.tipo === "TRACAO");
    if (tipo === "TRACAO" && tracao.length > 0) { toast.warning("Já existe um veículo de tração. Para adicionar outro, remova o atual."); return; }
    const { error } = await supabase.from("mdf_veiculo").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      veiculo_id: Number(veiculoId) || 0,
      placa: placa.toUpperCase(),
      tipo,
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("Veículo adicionado.");
    setVeiculoId(""); setPlaca(""); setTipo("TRACAO");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este veículo?")) return;
    await supabase.from("mdf_veiculo").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_veiculo_id", id);
    load();
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">ID Veículo</label>
            <input type="number" value={veiculoId} onChange={e => setVeiculoId(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Placa <span className="text-destructive">*</span></label>
            <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} maxLength={8}
              className="w-full border border-border rounded px-2 py-1 text-sm font-mono uppercase" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
              <option value="TRACAO">Tração</option>
              <option value="REBOQUE">Reboque</option>
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
            <th className="px-3 py-2 border border-border text-xs font-medium w-[80px]">ID</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Placa</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Tipo</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_veiculo_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border text-right">{r.veiculo_id}</td>
              <td className="px-3 py-1.5 border border-border font-mono">{r.placa}</td>
              <td className="px-3 py-1.5 border border-border">{r.tipo === "TRACAO" ? "Tração" : "Reboque"}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_veiculo_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum veículo adicionado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfVeiculosTab;
