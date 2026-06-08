import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, parseCurrency } from "@/lib/validators";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  onFormaPagtoChange?: (forma: string) => void;
}

const MdfPagamentoTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar, onFormaPagtoChange }) => {
  const [rec, setRec] = useState<{ mdf_pagamento_id: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vl_contrato: "0,00", forma_pagto: "0", banco: "", agencia: "",
    cnpjipef: "", chave_pix: "", adiantamento: "0,00",
  });

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_pagamento")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .eq("excluido", false)
      .maybeSingle();
    if (data) {
      setRec(data);
      const currentForma = data.forma_pagto || "0";
      setForm({
        vl_contrato: formatCurrency(data.vl_contrato || 0),
        forma_pagto: currentForma,
        banco: data.banco || "", agencia: data.agencia || "",
        cnpjipef: data.cnpjipef || "", chave_pix: data.chave_pix || "",
        adiantamento: formatCurrency(data.adiantamento || 0),
      });
      if (onFormaPagtoChange) {
        onFormaPagtoChange(currentForma);
      }
    } else {
      setRec(null);
      setForm({
        vl_contrato: "0,00", forma_pagto: "0", banco: "", agencia: "",
        cnpjipef: "", chave_pix: "", adiantamento: "0,00",
      });
      if (onFormaPagtoChange) {
        onFormaPagtoChange("0");
      }
    }
  }, [mdfManifestoId, onFormaPagtoChange]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!mdfManifestoId) { toast.warning("Salve o cabeçalho primeiro."); return; }
    const valContrato = parseCurrency(form.vl_contrato);
    const adiantamento = parseCurrency(form.adiantamento);
    if (valContrato <= 0) { toast.warning("Valor do contrato deve ser maior que zero."); return; }
    
    const hasBanco = form.banco.trim() !== "";
    const hasAgencia = form.agencia.trim() !== "";
    const hasPix = form.chave_pix.trim() !== "";
    const hasIpef = form.cnpjipef.trim() !== "";

    if (hasBanco && !hasAgencia) {
      toast.warning("Como o Banco foi informado, a Agência também deve ser preenchida.");
      return;
    }

    if (!hasBanco) {
      if (!hasPix && !hasIpef) {
        toast.warning("Informe os dados do Banco/Agência, a Chave PIX ou o CNPJ da IPEF.");
        return;
      }
    }

    if (hasIpef) {
      const cleanCNPJ = form.cnpjipef.replace(/\D/g, "");
      if (cleanCNPJ.length !== 14) {
        toast.warning("O CNPJ da IPEF deve conter exatamente 14 dígitos.");
        return;
      }
    }

    if (hasPix) {
      if (form.chave_pix.trim().length < 2 || form.chave_pix.trim().length > 60) {
        toast.warning("A Chave PIX deve ter entre 2 e 60 caracteres.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        mdf_manifesto_id: mdfManifestoId,
        empresa_id: empresaId,
        vl_contrato: valContrato,
        forma_pagto: form.forma_pagto,
        banco: form.banco, agencia: form.agencia,
        cnpjipef: form.cnpjipef, chave_pix: form.chave_pix,
        adiantamento: adiantamento,
        dt_alteracao: new Date().toISOString(),
      };
      if (rec) {
        await supabase.from("fiscal_mdf_pagamento").update(payload).eq("mdf_pagamento_id", rec.mdf_pagamento_id);
      } else {
        await supabase.from("fiscal_mdf_pagamento").insert({ ...payload, dt_cadastro: new Date().toISOString() });
      }

      if (form.forma_pagto === "0") {
        // Soft delete all installments for this manifesto
        const { error: errPagtos } = await supabase
          .from("fiscal_mdf_pagtos")
          .update({ excluido: true, dt_alteracao: new Date().toISOString() })
          .eq("mdf_manifesto_id", mdfManifestoId);
        
        if (errPagtos) {
          console.error("Erro ao limpar parcelas:", errPagtos);
        }
      }

      toast.success("Pagamento salvo.");
      if (onFormaPagtoChange) {
        onFormaPagtoChange(form.forma_pagto);
      }
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
            <input readOnly={ro} value={form.vl_contrato} onChange={e => setF("vl_contrato", formatCurrency(e.target.value))}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Forma de Pagamento</label>
            <select disabled={ro} value={form.forma_pagto} onChange={e => {
              const val = e.target.value;
              setF("forma_pagto", val);
              if (onFormaPagtoChange) {
                onFormaPagtoChange(val);
              }
              if (val === "0") {
                setForm(prev => ({ ...prev, forma_pagto: val, adiantamento: "0,00" }));
              }
            }} className="w-full border border-border rounded px-2 py-1 text-sm bg-card">
              <option value="0">0 - Pagamento à vista</option>
              <option value="1">1 - Pagamento à Prazo</option>
            </select>
          </div>
          <div className="col-span-3">
            <label className="text-xs text-muted-foreground">Adiantamento (R$)</label>
            <input 
              readOnly={ro || form.forma_pagto === "0"} 
              value={form.adiantamento} 
              onChange={e => setF("adiantamento", formatCurrency(e.target.value))}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right disabled:opacity-60 disabled:bg-secondary" 
            />
          </div>
        </div>
        <div className="border-t border-border/50 pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Meio de Recebimento (Banco / PIX / IPEF)</p>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">Banco (codBanco)</label>
              <input readOnly={ro} value={form.banco} onChange={e => setF("banco", e.target.value)}
                placeholder="Ex: 001, 341" maxLength={4} className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
            </div>
            <div className="col-span-3">
              <label className="text-xs text-muted-foreground">Agência (codAgencia)</label>
              <input readOnly={ro} value={form.agencia} onChange={e => setF("agencia", e.target.value)}
                placeholder="Ex: 1234" maxLength={10} className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
            </div>
            <div className="col-span-6">
              <label className="text-xs text-muted-foreground">CNPJ IPEF</label>
              <input readOnly={ro} value={form.cnpjipef} onChange={e => setF("cnpjipef", e.target.value)}
                placeholder="CNPJ da Inst. Pagto. Eletrônico" maxLength={14} className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12">
              <label className="text-xs text-muted-foreground">Chave PIX</label>
              <input readOnly={ro} value={form.chave_pix} onChange={e => setF("chave_pix", e.target.value)}
                placeholder="E-mail, CPF/CNPJ, Telefone (+55...) ou Chave Aleatória" maxLength={60} className="w-full border border-border rounded px-2 py-1 text-sm bg-card" />
            </div>
          </div>
        </div>
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

