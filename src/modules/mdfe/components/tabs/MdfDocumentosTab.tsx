import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfDocumentosTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [chave, setChave] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [cidadeNome, setCidadeNome] = useState("");
  const [peso, setPeso] = useState("0");
  const [valor, setValor] = useState("0");

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_documento")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .order("mdf_documento_id");
    setRows(data || []);
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const chaveClean = chave.replace(/\D/g, "");
    if (chaveClean.length !== 44) { toast.warning("A chave da NF-e deve ter exatamente 44 dígitos."); return; }
    if (!cidadeId) { toast.warning("Informe a cidade de descarregamento."); return; }
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    // Verifica duplicidade
    if (rows.some(r => r.chave === chaveClean)) { toast.warning("Esta chave já foi adicionada."); return; }
    const { error } = await supabase.from("fiscal_mdf_documento").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      cidade_id: Number(cidadeId),
      cidade_nome: cidadeNome.toUpperCase(),
      chave: chaveClean,
      peso: Number(peso) || 0,
      valor: Number(valor) || 0,
      dt_cadastro: new Date().toISOString(),
    });
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    // Atualiza qtd_nfe no manifesto
    const novaQtd = rows.length + 1;
    await supabase.from("fiscal_mdf_manifesto").update({ qtd_nfe: novaQtd }).eq("mdf_manifesto_id", mdfManifestoId);
    toast.success("Documento adicionado.");
    setChave(""); setCidadeId(""); setCidadeNome(""); setPeso("0"); setValor("0");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este documento?")) return;
    await supabase.from("fiscal_mdf_documento").update({ excluido: true, dt_alteracao: new Date().toISOString() }).eq("mdf_documento_id", id);
    const novaQtd = Math.max(0, rows.length - 1);
    if (mdfManifestoId) await supabase.from("fiscal_mdf_manifesto").update({ qtd_nfe: novaQtd }).eq("mdf_manifesto_id", mdfManifestoId);
    load();
  };

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  return (
    <div className="space-y-4 p-2">
      {podeEditar && (
        <div className="space-y-3 border border-border rounded p-3 bg-card">
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-8">
              <label className="text-xs text-muted-foreground">Chave NF-e (44 dígitos) <span className="text-destructive">*</span></label>
              <input value={chave} onChange={e => setChave(e.target.value.replace(/\D/g, "").substring(0, 44))}
                placeholder="00000000000000000000000000000000000000000000"
                className="w-full border border-border rounded px-2 py-1 text-sm font-mono" />
            </div>
            <div className="col-span-4 text-right text-xs text-muted-foreground self-end pb-2">
              {chave.replace(/\D/g, "").length}/44
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3 items-end">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">ID Cidade Desc.</label>
              <input type="number" value={cidadeId} onChange={e => setCidadeId(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">Cidade Descarregamento</label>
              <input value={cidadeNome} onChange={e => setCidadeNome(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Peso (KG)</label>
              <input type="number" step="0.001" value={peso} onChange={e => setPeso(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground">Valor (R$)</label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
            </div>
            <div className="col-span-2">
              <button onClick={handleAdd} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90">
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="text-xs text-muted-foreground font-medium">Total: {rows.length} documento(s)</div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-secondary text-left">
            <th className="px-3 py-2 border border-border text-xs font-medium">Chave NF-e</th>
            <th className="px-3 py-2 border border-border text-xs font-medium">Cidade</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[100px] text-right">Peso</th>
            <th className="px-3 py-2 border border-border text-xs font-medium w-[100px] text-right">Valor</th>
            {podeEditar && <th className="px-3 py-2 border border-border text-xs font-medium w-[60px]"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.mdf_documento_id} className="hover:bg-accent/30">
              <td className="px-3 py-1.5 border border-border font-mono text-xs">{r.chave}</td>
              <td className="px-3 py-1.5 border border-border">{r.cidade_nome}</td>
              <td className="px-3 py-1.5 border border-border text-right">{Number(r.peso || 0).toLocaleString("pt-BR", { minimumFractionDigits: 3 })}</td>
              <td className="px-3 py-1.5 border border-border text-right">{Number(r.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
              {podeEditar && (
                <td className="px-3 py-1.5 border border-border text-center">
                  <button onClick={() => handleRemove(r.mdf_documento_id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-4 h-4" /></button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground text-sm">Nenhum documento adicionado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

export default MdfDocumentosTab;

