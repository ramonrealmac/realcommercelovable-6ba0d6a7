import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfParcelasTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [nrParcela, setNrParcela] = useState("1");
  const [dtVenc, setDtVenc] = useState("");
  const [vlParcela, setVlParcela] = useState("0");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_pagtos")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("nr_parcela");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    if (!dtVenc) { toast.warning("Informe a data de vencimento."); return; }
    if (Number(vlParcela) <= 0) { toast.warning("Valor da parcela deve ser maior que zero."); return; }
    const { error } = await supabase.from("mdf_pagtos").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      nr_parcela: Number(nrParcela),
      dt_vencimento: dtVenc,
      vl_parcela: Number(vlParcela),
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("Parcela adicionada.");
    setNrParcela(String(rows.length + 2));
    setDtVenc(""); setVlParcela("0");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover esta parcela?")) return;
    await supabase.from("mdf_pagtos").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_pagtos_id", id);
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.vl_parcela || 0), 0);

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-1">
            <label className="text-xs text-muted-foreground">Parcela</label>
            <input type="number" value={nrParcela} onChange={e => setNrParcela(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Vencimento <span className="text-destructive">*</span></label>
            <input type="date" value={dtVenc} onChange={e => setDtVenc(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Valor (R$) <span className="text-destructive">*</span></label>
            <input type="number" step="0.01" value={vlParcela} onChange={e => setVlParcela(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
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
            <th className="px-3 py-2 border border-border text-xs font-medium w-[80px]">Parcela</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[130px]">Vencimento</th>
            <th className="px-3 py-2 border border-border text-xs font-medium text-right">Valor (R$)</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_pagtos_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border text-center font-semibold">{r.nr_parcela}</td>
              <td className="px-3 py-1.5 border border-border">{r.dt_vencimento ? new Date(r.dt_vencimento).toLocaleDateString("pt-BR") : ""}</td>
              <td className="px-3 py-1.5 border border-border text-right">{Number(r.vl_parcela || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_pagtos_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhuma parcela adicionada.</td></tr>}
        </tbody>
        <tfoot>
          <tr className="bg-secondary font-semibold">
            <td colSpan={2} className="px-3 py-2 border border-border text-right text-xs">TOTAL PARCELAS</td>
            <td className="px-3 py-2 border border-border text-right">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            {podeEditar && <td className="border border-border"></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default MdfParcelasTab;
