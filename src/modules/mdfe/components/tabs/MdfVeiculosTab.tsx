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
  const [veiculosList, setVeiculosList] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_veiculo")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_veiculo_id");
    setRows(data || []);
  }, [mdfManifestoId]);

  const loadVeiculos = useCallback(async () => {
    const { data } = await supabase
      .from("cadastro_veiculo")
      .select("veiculo_id, placa, descricao, renavam, tara, capacidade_kg, tp_rodado, tp_carroceria, uf, tp_veiculo")
      .eq("empresa_id", empresaId)
      .eq("excluido", false)
      .eq("ativo", true)
      .order("placa");
    setVeiculosList(data || []);
  }, [empresaId]);

  useEffect(() => { 
    load(); 
    loadVeiculos();
  }, [load, loadVeiculos]);

  const handleAdd = async () => {
    if (!veiculoId) { toast.warning("Selecione um veículo."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    
    const v = veiculosList.find(x => String(x.veiculo_id) === veiculoId);
    if (!v) { toast.error("Veículo não encontrado."); return; }

    const tracao = rows.filter(r => r.tp_veiculo === "TRACAO");
    if (v.tp_veiculo === "TRACAO" && tracao.length > 0) { 
      toast.warning("Já existe um veículo de tração. Para adicionar outro, remova o atual."); 
      return; 
    }

    const { error } = await supabase.from("fiscal_mdf_veiculo").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      veiculo_id: v.veiculo_id,
      placa: v.placa,
      renavam: v.renavam,
      tara: v.tara,
      capacidade_kg: v.capacidade_kg,
      tp_rodado: v.tp_rodado,
      tp_carroceria: v.tp_carroceria,
      uf: v.uf,
      tp_veiculo: v.tp_veiculo,
      dt_cadastro: new Date().toISOString(),
    });

    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("Veículo adicionado.");
    setVeiculoId(""); setPlaca(""); setTipo("TRACAO");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este veículo?")) return;
    await supabase.from("fiscal_mdf_veiculo").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_veiculo_id", id);
    load();
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-8">
            <label className="text-xs text-muted-foreground">Selecionar Veículo <span className="text-destructive">*</span></label>
            <select 
              value={veiculoId} 
              onChange={e => setVeiculoId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-card"
            >
              <option value="">— Selecione um veículo cadastrado —</option>
              {veiculosList.map(v => (
                <option key={v.veiculo_id} value={String(v.veiculo_id)}>
                  {v.placa} - {v.descricao} ({v.tp_veiculo})
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-4">
            <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Adicionar ao Manifesto
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
            <th className="px-3 py-2 border border-border text-xs font-medium">UF</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_veiculo_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border text-right">{r.veiculo_id}</td>
              <td className="px-3 py-1.5 border border-border font-mono">{r.placa}</td>
              <td className="px-3 py-1.5 border border-border">{r.tp_veiculo === "TRACAO" ? "Tração" : "Reboque"}</td>
              <td className="px-3 py-1.5 border border-border text-center">{r.uf}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_veiculo_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum veículo adicionado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};


export default MdfVeiculosTab;

