import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Trash2, Plus } from "lucide-react";
import type { IMdfNf, TMdfTpDoc } from "../types/mdfeTypes";

const db = supabase as any;

interface Props {
  mdfCabecalhoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const TP_DOC_OPTIONS: { value: TMdfTpDoc; label: string }[] = [
  { value: "NFE",  label: "NF-e" },
  { value: "NFCE", label: "NFC-e" },
  { value: "CTE",  label: "CT-e" },
];

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const MdfNfsTab: React.FC<Props> = ({ mdfCabecalhoId, empresaId, podeEditar }) => {
  const [nfs, setNfs] = useState<IMdfNf[]>([]);
  const [loading, setLoading] = useState(false);
  const [novaChave, setNovaChave] = useState("");
  const [novaTpDoc, setNovaTpDoc] = useState<TMdfTpDoc>("NFE");
  const [novaVl, setNovaVl] = useState("");
  const [novaKg, setNovaKg] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novaUf, setNovaUf] = useState("PR");
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    if (!mdfCabecalhoId) return;
    setLoading(true);
    const { data } = await db.from("fiscal_mdf_nf")
      .select("*")
      .eq("mdf_cabecalho_id", mdfCabecalhoId)
      .eq("excluido", false)
      .order("mdf_nf_id");
    setNfs(data || []);
    setLoading(false);
  }, [mdfCabecalhoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleLookupChave = async () => {
    if (novaChave.length !== 44) {
      toast.warning("Chave de acesso deve ter 44 dígitos.");
      return;
    }
    // Tenta buscar automaticamente no banco (fiscal_nfe_cabecalho)
    const { data } = await db.from("fiscal_nfe_cabecalho")
      .select("nr_nota,serie,vl_total_nf,cnpj_emit")
      .eq("chave_nfe", novaChave)
      .maybeSingle();
    if (data) {
      setNovaVl(String(data.vl_total_nf || ""));
      toast.info("NF-e encontrada na base! Confirme o valor e cidade.");
    }
  };

  const handleAdicionar = async () => {
    if (!mdfCabecalhoId) { toast.warning("Salve o MDF-e antes de adicionar documentos."); return; }
    if (novaChave.length !== 44) { toast.warning("Chave deve ter 44 dígitos."); return; }
    if (!novaCidade.trim()) { toast.warning("Informe a cidade de descarregamento."); return; }
    setAdicionando(true);
    const { error } = await db.from("fiscal_mdf_nf").insert({
      mdf_cabecalho_id:  mdfCabecalhoId,
      empresa_id:        empresaId,
      tp_doc:            novaTpDoc,
      chave_doc:         novaChave.trim(),
      nr_nota:           novaChave.substring(25, 34).replace(/^0+/, ""),
      serie:             novaChave.substring(22, 25).replace(/^0+/, ""),
      cnpj_emit_doc:     novaChave.substring(6, 20),
      vl_doc:            parseFloat(novaVl.replace(",", ".")) || 0,
      kg_doc:            parseFloat(novaKg.replace(",", ".")) || 0,
      cidade_descarreg:  novaCidade.trim().toUpperCase(),
      estado_descarreg:  novaUf,
    });
    setAdicionando(false);
    if (error) { toast.error("Erro ao adicionar: " + error.message); return; }
    setNovaChave(""); setNovaVl(""); setNovaKg(""); setNovaCidade("");
    toast.success("Documento adicionado.");
    carregar();
  };

  const handleRemover = async (id: number) => {
    if (!confirm("Remover este documento do MDF-e?")) return;
    await db.from("fiscal_mdf_nf").update({ excluido: true }).eq("mdf_nf_id", id);
    setNfs(prev => prev.filter(n => n.mdf_nf_id !== id));
    toast.success("Documento removido.");
  };

  const totalVl  = nfs.reduce((s, n) => s + Number(n.vl_doc || 0), 0);
  const totalKg  = nfs.reduce((s, n) => s + Number(n.kg_doc || 0), 0);

  return (
    <div className="space-y-4">
      {/* Linha de adição */}
      {podeEditar && (
        <div className="border border-border rounded-lg p-3 bg-card space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Adicionar Documento</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col w-24">
              <label className="text-xs text-muted-foreground mb-1">Tipo</label>
              <select
                value={novaTpDoc}
                onChange={e => setNovaTpDoc(e.target.value as TMdfTpDoc)}
                className="border border-border rounded px-2 py-1 text-sm bg-card"
              >
                {TP_DOC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col flex-1 min-w-[300px]">
              <label className="text-xs text-muted-foreground mb-1">Chave de Acesso (44 dígitos)</label>
              <div className="flex gap-1">
                <input
                  value={novaChave}
                  onChange={e => setNovaChave(e.target.value.replace(/\D/g, "").substring(0, 44))}
                  onBlur={handleLookupChave}
                  placeholder="00000000000000000000000000000000000000000000"
                  className="flex-1 border border-border rounded px-2 py-1 text-sm font-mono"
                />
              </div>
            </div>
            <div className="flex flex-col w-28">
              <label className="text-xs text-muted-foreground mb-1">Valor (R$)</label>
              <input
                value={novaVl}
                onChange={e => setNovaVl(e.target.value)}
                placeholder="0,00"
                className="border border-border rounded px-2 py-1 text-sm text-right"
              />
            </div>
            <div className="flex flex-col w-24">
              <label className="text-xs text-muted-foreground mb-1">Peso (KG)</label>
              <input
                value={novaKg}
                onChange={e => setNovaKg(e.target.value)}
                placeholder="0,0000"
                className="border border-border rounded px-2 py-1 text-sm text-right"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground mb-1">Cidade Descarreg.</label>
              <input
                value={novaCidade}
                onChange={e => setNovaCidade(e.target.value)}
                placeholder="Ex: CURITIBA"
                className="border border-border rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="flex flex-col w-20">
              <label className="text-xs text-muted-foreground mb-1">UF</label>
              <select
                value={novaUf}
                onChange={e => setNovaUf(e.target.value)}
                className="border border-border rounded px-2 py-1 text-sm bg-card"
              >
                {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <button
              onClick={handleAdicionar}
              disabled={adicionando}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 self-end"
            >
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
        </div>
      )}

      {/* Grid de documentos */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground font-semibold w-16">Tipo</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground font-semibold">Chave de Acesso</th>
                <th className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold w-28">Valor</th>
                <th className="px-3 py-2 text-right text-xs text-muted-foreground font-semibold w-24">Peso KG</th>
                <th className="px-3 py-2 text-left text-xs text-muted-foreground font-semibold w-40">Cidade Descarreg.</th>
                <th className="px-3 py-2 text-center text-xs text-muted-foreground font-semibold w-12">UF</th>
                {podeEditar && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {nfs.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground text-xs">Nenhum documento vinculado.</td></tr>
              )}
              {nfs.map(nf => (
                <tr key={nf.mdf_nf_id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-1.5 font-mono text-xs">{nf.tp_doc}</td>
                  <td className="px-3 py-1.5 font-mono text-xs tracking-tight">{nf.chave_doc}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {Number(nf.vl_doc).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {Number(nf.kg_doc).toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-1.5">{nf.cidade_descarreg}</td>
                  <td className="px-3 py-1.5 text-center">{nf.estado_descarreg}</td>
                  {podeEditar && (
                    <td className="px-2 py-1">
                      <button
                        onClick={() => handleRemover(nf.mdf_nf_id)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {nfs.length > 0 && (
              <tfoot className="bg-secondary/60 border-t border-border">
                <tr>
                  <td colSpan={2} className="px-3 py-1.5 text-xs font-semibold">{nfs.length} doc(s)</td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-primary">
                    {totalVl.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-primary">
                    {totalKg.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}
                  </td>
                  <td colSpan={podeEditar ? 3 : 2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
};

export default MdfNfsTab;

