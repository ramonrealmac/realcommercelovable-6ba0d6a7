import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfPagamentoTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rec, setRec] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vl_contrato: "0", forma_pagto: "PIX", banco: "", agencia: "",
    cnpjipef: "", chave_pix: "", adiantamento: "0",
  });

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("mdf_pagamento")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .maybeSingle();
    if (data) {
      setRec(data);
      setForm({
        vl_contrato: String(data.vl_contrato || 0),
        forma_pagto: data.forma_pagto || "PIX",
        banco: data.banco || "", agencia: data.agencia || "",
        cnpjipef: data.cnpjipef || "", chave_pix: data.chave_pix || "",
        adiantamento: String(data.adiantamento || 0),
      });
    }
  }, [mdfManifestoId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    if (Number(form.vl_contrato) <= 0) { toast.warning("Valor do contrato deve ser maior que zero."); return; }
    if (form.forma_pagto === "PIX" && !form.chave_pix.trim()) { toast.warning("Para PIX, informe a chave PIX."); return; }
    if (form.forma_pagto === "BANCO" && (!form.banco.trim() || !form.agencia.trim())) { toast.warning("Para pagamento bancário, informe banco e agência."); return; }
    setLoading(true);
    try {
      const payload = {
        mdf_manifesto_id: mdfManifestoId,
        empresa_id: empresaId,
        vl_contrato: Number(form.vl_contrato),
        forma_pagto: form.forma_pagto,
        banco: form.banco, agencia: form.agencia,
        cnpjipef: form.cnpjipef, chave_pix: form.chave_pix,
        adiantamento: Number(form.adiantamento),
        dt_alteracao: new Date().toISOString(),
      };
      if (rec) {
        await supabase.from("mdf_pagamento").update(payload).eq("mdf_pagamento_id", rec.mdf_pagamento_id);
      } else {
        await supabase.from("mdf_pagamento").insert({ ...payload, dt_cadastro: new Date().toISOString() });
      }
      toast.success("Pagamento salvo.");
      load();
    } finally {
      setLoading(false);
    }
  };

  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  if (!mdfManifestoId) return <div className="p-4 text-sm text-muted-foreground">Salve o cabeçalho do MDF-e primeiro.</div>;

  const ro = !podeEditar;

  return (
    <div className="space-y-4 p-2">
      <div className="border border-border rounded p-3 bg-card space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados do Contrato de Frete</p>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Valor do Contrato (R$) <span className="text-destructive">*</span></label>
            <input readOnly={ro} type="number" step="0.01" value={form.vl_contrato} onChange={e => setF("vl_contrato", e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Adiantamento (R$)</label>
            <input readOnly={ro} type="number" step="0.01" value={form.adiantamento} onChange={e => setF("adiantamento", e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Forma de Pagamento</label>
            <select disabled={ro} value={form.forma_pagto} onChange={e => setF("forma_pagto", e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
              <option value="PIX">PIX</option>
              <option value="BANCO">Bancário</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="OUTRO">Outro</option>
            </select>
          </div>
        </div>
        {form.forma_pagto === "PIX" && (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <label className="text-xs text-muted-foreground">Chave PIX <span className="text-destructive">*</span></label>
              <input readOnly={ro} value={form.chave_pix} onChange={e => setF("chave_pix", e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-6">
              <label className="text-xs text-muted-foreground">CNPJ/IPEF</label>
              <input readOnly={ro} value={form.cnpjipef} onChange={e => setF("cnpjipef", e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        )}
        {form.forma_pagto === "BANCO" && (
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">Banco <span className="text-destructive">*</span></label>
              <input readOnly={ro} value={form.banco} onChange={e => setF("banco", e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">Agência <span className="text-destructive">*</span></label>
              <input readOnly={ro} value={form.agencia} onChange={e => setF("agencia", e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-muted-foreground">CNPJ/IPEF</label>
              <input readOnly={ro} value={form.cnpjipef} onChange={e => setF("cnpjipef", e.target.value)}
                className="w-full border border-border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        )}
        {podeEditar && (
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar Pagamento"}
          </button>
        )}
      </div>
    </div>
  );
};

export default MdfPagamentoTab;
