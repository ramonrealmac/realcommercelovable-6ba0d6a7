import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const TIPOS = ["FRETE PESO","FRETE VALOR","PEDÁGIO","SEGURO","DESCARGA","CARGA","OUTROS"];

const MdfComponenteTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [tpComp, setTpComp] = useState("FRETE PESO");
  const [vlComp, setVlComp] = useState("0");
  const [dsComp, setDsComp] = useState("");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_componente")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_componente_id");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    if (Number(vlComp) <= 0) { toast.warning("Informe um valor maior que zero."); return; }
    const { error } = await supabase.from("fiscal_mdf_componente").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      tp_componente: tpComp,
      vl_componente: Number(vlComp),
      ds_componente: dsComp,
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    toast.success("Componente adicionado.");
    setVlComp("0"); setDsComp("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este componente?")) return;
    await supabase.from("fiscal_mdf_componente").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_componente_id", id);
    load();
  };

  const total = rows.reduce((s, r) => s + Number(r.vl_componente || 0), 0);

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="grid grid-cols-12 gap-3 items-end border border-border rounded p-3 bg-card">
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select value={tpComp} onChange={e => setTpComp(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Valor (R$)</label>
            <input type="number" step="0.01" value={vlComp} onChange={e => setVlComp(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="col-span-4">
            <label className="text-xs text-muted-foreground">Descrição</label>
            <input value={dsComp} onChange={e => setDsComp(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm" />
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
            <th className="px-3 py-2 border border-border text-xs font-medium">Tipo</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Descrição</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[120px] text-right">Valor (R$)</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_componente_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border">{r.tp_componente}</td>
              <td className="px-3 py-1.5 border border-border">{r.ds_componente}</td>
              <td className="px-3 py-1.5 border border-border text-right">{Number(r.vl_componente || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_componente_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum componente adicionado.</td></tr>}
        </tbody>
        <tfoot>
          <tr className="bg-secondary font-semibold">
            <td colSpan={2} className="px-3 py-2 border border-border text-right text-xs">TOTAL</td>
            <td className="px-3 py-2 border border-border text-right text-sm">{total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
            {podeEditar && <td className="border border-border"></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default MdfComponenteTab;

