import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import type { IMdfVeiculoReboque } from "../types/mdfeTypes";
import { TP_CARROCERIA_OPTIONS, UF_OPTIONS } from "../types/mdfeTypes";

const db = supabase as any;

interface Props {
  mdfCabecalhoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfReboquesTab: React.FC<Props> = ({ mdfCabecalhoId, empresaId, podeEditar }) => {
  const [reboques, setReboques] = useState<IMdfVeiculoReboque[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novaUf, setNovaUf] = useState("PR");
  const [novaTara, setNovaTara] = useState("");
  const [novaCapKg, setNovaCapKg] = useState("");
  const [novaCapM3, setNovaCapM3] = useState("");
  const [novaCarroceria, setNovaCarroceria] = useState("00");
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    if (!mdfCabecalhoId) return;
    setLoading(true);
    const { data } = await db.from("fiscal_mdf_veiculo_reboque")
      .select("*")
      .eq("mdf_cabecalho_id", mdfCabecalhoId)
      .eq("excluido", false)
      .order("mdf_reboque_id");
    setReboques(data || []);
    setLoading(false);
  }, [mdfCabecalhoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleAdicionar = async () => {
    if (!mdfCabecalhoId) { toast.warning("Salve o MDF-e antes."); return; }
    if (!novaPlaca.trim()) { toast.warning("Informe a placa."); return; }
    setAdicionando(true);
    const { error } = await db.from("fiscal_mdf_veiculo_reboque").insert({
      mdf_cabecalho_id: mdfCabecalhoId,
      empresa_id:       empresaId,
      placa:            novaPlaca.trim().toUpperCase(),
      uf:               novaUf,
      tara:             parseFloat(novaTara.replace(",", ".")) || 0,
      cap_kg:           parseFloat(novaCapKg.replace(",", ".")) || 0,
      cap_m3:           parseFloat(novaCapM3.replace(",", ".")) || 0,
      tp_carroceria:    novaCarroceria,
    });
    setAdicionando(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setNovaPlaca(""); setNovaTara(""); setNovaCapKg(""); setNovaCapM3("");
    toast.success("Reboque adicionado.");
    carregar();
  };

  const handleRemover = async (id: number) => {
    if (!confirm("Remover este reboque?")) return;
    await db.from("fiscal_mdf_veiculo_reboque").update({ excluido: true }).eq("mdf_reboque_id", id);
    setReboques(prev => prev.filter(r => r.mdf_reboque_id !== id));
    toast.success("Reboque removido.");
  };

  return (
    <div className="space-y-4">
      {podeEditar && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar Reboque / Semi-Reboque</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col w-28">
              <label className="text-xs text-muted-foreground mb-1">Placa</label>
              <input
                value={novaPlaca}
                onChange={e => setNovaPlaca(e.target.value.toUpperCase())}
                placeholder="ABC1D23"
                className="border border-border rounded px-2 py-1 text-sm font-mono uppercase"
              />
            </div>
            <div className="flex flex-col w-20">
              <label className="text-xs text-muted-foreground mb-1">UF</label>
              <select value={novaUf} onChange={e => setNovaUf(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card">
                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="flex flex-col w-24">
              <label className="text-xs text-muted-foreground mb-1">Tara (kg)</label>
              <input value={novaTara} onChange={e => setNovaTara(e.target.value)}
                placeholder="0" className="border border-border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="flex flex-col w-24">
              <label className="text-xs text-muted-foreground mb-1">Cap. KG</label>
              <input value={novaCapKg} onChange={e => setNovaCapKg(e.target.value)}
                placeholder="0" className="border border-border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="flex flex-col w-24">
              <label className="text-xs text-muted-foreground mb-1">Cap. M³</label>
              <input value={novaCapM3} onChange={e => setNovaCapM3(e.target.value)}
                placeholder="0" className="border border-border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="flex flex-col w-40">
              <label className="text-xs text-muted-foreground mb-1">Tipo Carroceria</label>
              <select value={novaCarroceria} onChange={e => setNovaCarroceria(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card">
                {TP_CARROCERIA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button onClick={handleAdicionar} disabled={adicionando}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 self-end">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground font-semibold">Placa</th>
              <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold w-16">UF</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold w-24">Tara</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold w-24">Cap. KG</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold w-24">Cap. M³</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground font-semibold">Carroceria</th>
              {podeEditar && <th className="w-10"></th>}
            </tr>
          </thead>
          <tbody>
            {reboques.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">Nenhum reboque vinculado.</td></tr>
            )}
            {reboques.map(r => (
              <tr key={r.mdf_reboque_id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-1.5 font-mono">{r.placa}</td>
                <td className="px-3 py-1.5 text-center">{r.uf}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.tara).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.cap_kg).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{Number(r.cap_m3).toLocaleString("pt-BR")}</td>
                <td className="px-3 py-1.5 text-sm">
                  {TP_CARROCERIA_OPTIONS.find(o => o.value === r.tp_carroceria)?.label || r.tp_carroceria}
                </td>
                {podeEditar && (
                  <td className="px-2 py-1">
                    <button onClick={() => handleRemover(r.mdf_reboque_id)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MdfReboquesTab;

