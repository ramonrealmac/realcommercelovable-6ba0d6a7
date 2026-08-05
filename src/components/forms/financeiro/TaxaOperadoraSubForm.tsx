import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ITaxa {
  operadora_taxa_id: string;
  empresa_id: number;
  operadora_id: number;
  bandeira_id: number | null;
  tipo_canal: string;
  faturamento_minimo: number;
  faturamento_maximo: number;
  qtd_parcelas: number;
  taxa_total: number;
  excluido: boolean;
}

interface TaxaOperadoraSubFormProps {
  operadoraId: number;
  empresaId: number;
}

const TaxaOperadoraSubForm: React.FC<TaxaOperadoraSubFormProps> = ({ operadoraId, empresaId }) => {
  const [XTaxas, setXTaxas] = useState<ITaxa[]>([]);
  const [XBandeiras, setXBandeiras] = useState<{ id: number; nome: string }[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XModalOpen, setXModalOpen] = useState(false);
  const [XEditingTaxa, setXEditingTaxa] = useState<Partial<ITaxa> | null>(null);

  // Form states
  const [XTipoCanal, setXTipoCanal] = useState("PDV");
  const [XBandeiraId, setXBandeiraId] = useState<string>("");
  const [XFatMin, setXFatMin] = useState("0.00");
  const [XFatMax, setXFatMax] = useState("999999999.00");
  const [XParcelas, setXParcelas] = useState("1");
  const [XTaxaTotal, setXTaxaTotal] = useState("0.00");

  const loadTaxas = useCallback(async () => {
    if (!operadoraId) return;
    setXLoading(true);
    try {
      const { data, error } = await supabase
        .from("operadora_taxa")
        .select("*")
        .eq("operadora_id", operadoraId)
        .eq("excluido", false)
        .order("tipo_canal")
        .order("qtd_parcelas");
      
      if (error) throw error;
      setXTaxas((data as ITaxa[]) || []);
    } catch (err) {
      console.error("Erro ao buscar taxas:", err);
      toast.error("Erro ao carregar taxas da operadora.");
    } finally {
      setXLoading(false);
    }
  }, [operadoraId]);

  const loadBandeiras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("bandeira")
        .select("bandeira_id, descricao")
        .eq("empresa_id", empresaId)
        .eq("excluido", false)
        .order("descricao");

      if (error) throw error;
      setXBandeiras((data || []).map(b => ({ id: b.bandeira_id, nome: b.descricao ?? "" })));
    } catch (err) {
      console.error("Erro ao carregar bandeiras:", err);
    }
  }, [empresaId]);

  useEffect(() => {
    loadTaxas();
    loadBandeiras();
  }, [loadTaxas, loadBandeiras]);

  const handleOpenAdd = () => {
    setXEditingTaxa(null);
    setXTipoCanal("PDV");
    setXBandeiraId("");
    setXFatMin("0.00");
    setXFatMax("999999999.00");
    setXParcelas("1");
    setXTaxaTotal("0.00");
    setXModalOpen(true);
  };

  const handleOpenEdit = (taxa: ITaxa) => {
    setXEditingTaxa(taxa);
    setXTipoCanal(taxa.tipo_canal);
    setXBandeiraId(taxa.bandeira_id ? String(taxa.bandeira_id) : "");
    setXFatMin(String(taxa.faturamento_minimo));
    setXFatMax(String(taxa.faturamento_maximo));
    setXParcelas(String(taxa.qtd_parcelas));
    setXTaxaTotal(String(taxa.taxa_total));
    setXModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente remover esta taxa?")) return;
    try {
      const { error } = await supabase
        .from("operadora_taxa")
        .update({ excluido: true })
        .eq("operadora_taxa_id", id);

      if (error) throw error;
      toast.success("Taxa removida com sucesso!");
      loadTaxas();
    } catch (err) {
      console.error("Erro ao remover taxa:", err);
      toast.error("Erro ao remover taxa.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const pars = parseInt(XParcelas, 10);
    if (isNaN(pars) || pars < 1) {
      toast.error("Quantidade de parcelas deve ser pelo menos 1.");
      return;
    }

    const tx = parseFloat(XTaxaTotal);
    if (isNaN(tx) || tx < 0) {
      toast.error("A taxa total deve ser maior ou igual a zero.");
      return;
    }

    const fMin = parseFloat(XFatMin);
    const fMax = parseFloat(XFatMax);
    if (isNaN(fMin) || isNaN(fMax) || fMin > fMax) {
      toast.error("Faixa de faturamento inválida.");
      return;
    }

    const payload = {
      empresa_id: empresaId,
      operadora_id: operadoraId,
      bandeira_id: XBandeiraId ? Number(XBandeiraId) : null,
      tipo_canal: XTipoCanal,
      faturamento_minimo: fMin,
      faturamento_maximo: fMax,
      qtd_parcelas: pars,
      taxa_total: tx,
      excluido: false,
    };

    try {
      if (XEditingTaxa) {
        const { error } = await supabase
          .from("operadora_taxa")
          .update(payload)
          .eq("operadora_taxa_id", XEditingTaxa.operadora_taxa_id);
        
        if (error) throw error;
        toast.success("Taxa atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("operadora_taxa")
          .insert([payload]);

        if (error) throw error;
        toast.success("Taxa adicionada com sucesso!");
      }

      setXModalOpen(false);
      loadTaxas();
    } catch (err: unknown) {
      console.error("Erro ao salvar taxa:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error("Erro ao salvar taxa: " + errorMsg);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const getBandeiraNome = (id: number | null) => {
    if (!id) return "Todas";
    return XBandeiras.find(b => b.id === id)?.nome ?? String(id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tabela de Taxas</h3>
          <p className="text-xs text-muted-foreground">Gerencie as taxas totais cobradas de acordo com o canal, faturamento e parcelamento.</p>
        </div>
        <Button 
          type="button" 
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 text-xs font-bold uppercase shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Taxa
        </Button>
      </div>

      {XLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          Carregando taxas...
        </div>
      ) : XTaxas.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/10 text-center">
          <AlertCircle className="w-8 h-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhuma taxa cadastrada</p>
          <p className="text-xs text-muted-foreground mt-1">Clique no botão acima para registrar a primeira faixa de taxas.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Bandeira</th>
                  <th className="px-4 py-3 text-right">Faixa de Faturamento</th>
                  <th className="px-4 py-3 text-center">Parcelas</th>
                  <th className="px-4 py-3 text-right">Taxa Total</th>
                  <th className="px-4 py-3 text-center w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {XTaxas.map(t => (
                  <tr key={t.operadora_taxa_id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {t.tipo_canal === "LINK_PAGAMENTO" ? "Link de Pagamento" : "PDV / Geral"}
                    </td>
                    <td className="px-4 py-3">{getBandeiraNome(t.bandeira_id)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCurrency(t.faturamento_minimo)} - {formatCurrency(t.faturamento_maximo)}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-foreground">{t.qtd_parcelas}x</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {t.taxa_total.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(t)}
                          className="p-1 hover:bg-muted rounded text-blue-500 transition-colors"
                          title="Editar Taxa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.operadora_taxa_id)}
                          className="p-1 hover:bg-muted rounded text-rose-500 transition-colors"
                          title="Remover Taxa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {XModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-md border border-border rounded-lg shadow-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
              <h4 className="text-sm font-semibold text-foreground">
                {XEditingTaxa ? "Editar Taxa de Operação" : "Nova Taxa de Operação"}
              </h4>
              <button 
                type="button" 
                onClick={() => setXModalOpen(false)}
                className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Canal de Venda</label>
                  <select
                    value={XTipoCanal}
                    onChange={e => setXTipoCanal(e.target.value)}
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none h-8"
                  >
                    <option value="PDV">PDV / Geral</option>
                    <option value="LINK_PAGAMENTO">Link de Pagamento</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Bandeira (Opcional)</label>
                  <select
                    value={XBandeiraId}
                    onChange={e => setXBandeiraId(e.target.value)}
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none h-8"
                  >
                    <option value="">Todas</option>
                    {XBandeiras.map(b => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Fat. Mínimo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={XFatMin}
                    onChange={e => setXFatMin(e.target.value)}
                    required
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Fat. Máximo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={XFatMax}
                    onChange={e => setXFatMax(e.target.value)}
                    required
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Nº Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    value={XParcelas}
                    onChange={e => setXParcelas(e.target.value)}
                    required
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Taxa Total (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={XTaxaTotal}
                    onChange={e => setXTaxaTotal(e.target.value)}
                    required
                    className="w-full border border-border rounded px-3 py-1.5 text-xs bg-card focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setXModalOpen(false)}
                  className="text-xs px-4 h-8"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="text-xs px-4 h-8"
                >
                  Salvar Taxa
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaxaOperadoraSubForm;
