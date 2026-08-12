import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calculator, ChevronDown, ChevronUp, DollarSign, Percent, Info, CreditCard } from "lucide-react";
import { calcularTaxasCartaoParcelado } from "@/utils/cardFeeCalculator";

interface IOperadora {
  operadora_id: number;
  empresa_id: number;
  razao: string;
  cnpj: string | null;
  tipo_antecipacao: string | null;
}

interface ITaxa {
  operadora_taxa_id: string;
  empresa_id: number;
  operadora_id: number;
  parcela: string;
  taxa_cartao: number;
  taxa_antecipacao: number;
  excluido: boolean;
}

const XDefault: Partial<IOperadora> = {
  razao: "",
  cnpj: "",
  tipo_antecipacao: "SEM ANTECIPAÇÃO",
};

const XGridCols: IGridColumn[] = [
  { key: "operadora_id", label: "ID", width: "80px", align: "right" },
  { key: "razao", label: "Razão Social", width: "1fr" },
  { key: "cnpj", label: "CNPJ", width: "160px" },
  { key: "tipo_antecipacao", label: "Tipo de Antecipação", width: "180px" },
];

const fmtPercentage = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%";

const ITEM_COLS: IGridColumn[] = [
  { key: "parcela", label: "Parcela", width: "1fr" },
  { key: "taxa_cartao", label: "Taxa Cartão", width: "150px", align: "right", render: r => fmtPercentage(r.taxa_cartao) },
  { key: "taxa_antecipacao", label: "Taxa Antecipação", width: "150px", align: "right", render: r => fmtPercentage(r.taxa_antecipacao) },
];

const DecimalInput = React.forwardRef<HTMLInputElement, {
  value: number;
  onChange: (v: number) => void;
  readOnly?: boolean;
  placeholder?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}>(({ value, onChange, readOnly = false, placeholder = "0,00", onKeyDown }, ref) => {
  const formatValue = (val: number) => {
    return Number(val || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const [displayValue, setDisplayValue] = useState(formatValue(value));

  useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      onChange(0);
      return;
    }
    const num = parseInt(digits, 10) / 100;
    onChange(num);
  };

  return (
    <input
      ref={ref}
      type="text"
      readOnly={readOnly}
      value={displayValue}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      className={`border border-border rounded px-3 py-1.5 text-sm w-full text-right ${
        readOnly ? "bg-secondary" : "bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]"
      }`}
    />
  );
});
DecimalInput.displayName = "DecimalInput";

interface OperadoraTaxaSectionProps {
  operadoraId: number;
  empresaId: number;
  isEditing: boolean;
}

const OperadoraTaxaSection: React.FC<OperadoraTaxaSectionProps> = ({ operadoraId, empresaId, isEditing }) => {
  const [XTaxas, setXTaxas] = useState<ITaxa[]>([]);
  const [XLoading, setXLoading] = useState(false);

  // Form states
  const [XEdit, setXEdit] = useState<Partial<ITaxa> | null>(null);
  const [XEditingId, setXEditingId] = useState<string | null>(null);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  // Refs de Foco
  const parcelaInputRef = useRef<HTMLInputElement>(null);
  const taxaCartaoInputRef = useRef<HTMLInputElement>(null);
  const taxaAntecipacaoInputRef = useRef<HTMLInputElement>(null);
  const salvarBtnRef = useRef<HTMLButtonElement>(null);

  const loadTaxas = useCallback(async () => {
    if (!operadoraId) return;
    setXLoading(true);
    try {
      const { data, error } = await supabase
        .from("operadora_taxa")
        .select("*")
        .eq("operadora_id", operadoraId)
        .eq("excluido", false)
        .order("parcela");
      
      if (error) throw error;
      setXTaxas((data as ITaxa[]) || []);
    } catch (err) {
      console.error("Erro ao buscar taxas:", err);
      toast.error("Erro ao carregar taxas da operadora.");
    } finally {
      setXLoading(false);
    }
  }, [operadoraId]);

  useEffect(() => {
    loadTaxas();
  }, [loadTaxas]);

  // Reset states when operadora changes
  useEffect(() => {
    setXEdit(null);
    setXEditingId(null);
    setXSelectedIdx(null);
  }, [operadoraId]);

  const novo = useCallback(() => {
    setXEditingId(null);
    setXEdit({ parcela: "", taxa_cartao: 0, taxa_antecipacao: 0 });
    setTimeout(() => {
      parcelaInputRef.current?.focus();
    }, 50);
  }, []);

  const editar = useCallback((it: ITaxa) => {
    setXEditingId(it.operadora_taxa_id);
    setXEdit({ ...it });
    setTimeout(() => {
      parcelaInputRef.current?.focus();
    }, 50);
  }, []);

  const cancelar = useCallback(() => {
    setXEdit(null);
    setXEditingId(null);
  }, []);

  const salvar = async () => {
    if (!operadoraId) { toast.error("Salve a operadora antes de incluir taxas."); return; }
    if (!XEdit?.parcela?.trim()) { toast.error("A descrição da parcela é obrigatória."); return; }

    const payload = {
      empresa_id: empresaId,
      operadora_id: operadoraId,
      parcela: XEdit.parcela.trim().toUpperCase(),
      taxa_cartao: XEdit.taxa_cartao || 0,
      taxa_antecipacao: XEdit.taxa_antecipacao || 0,
      excluido: false,
    };

    try {
      if (XEditingId) {
        const { error } = await supabase
          .from("operadora_taxa")
          .update(payload)
          .eq("operadora_taxa_id", XEditingId);
        
        if (error) throw error;
        alert("Salvo com sucesso!");
        cancelar();
      } else {
        const { error } = await supabase
          .from("operadora_taxa")
          .insert([payload]);

        if (error) throw error;
        alert("Salvo com sucesso!");
        setXEdit({ parcela: "", taxa_cartao: 0, taxa_antecipacao: 0 });
        setXEditingId(null);
      }

      await loadTaxas();

      setTimeout(() => {
        parcelaInputRef.current?.focus();
      }, 50);
    } catch (err: unknown) {
      console.error("Erro ao salvar taxa:", err);
      const errMsg = err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error ? err.message : String(err);
      toast.error("Erro ao salvar taxa: " + errMsg);
    }
  };

  const excluir = useCallback(async (it: ITaxa) => {
    if (!confirm("Deseja realmente remover esta taxa?")) return;
    try {
      const { error } = await supabase
        .from("operadora_taxa")
        .update({ excluido: true })
        .eq("operadora_taxa_id", it.operadora_taxa_id);

      if (error) throw error;
      toast.success("Taxa removida com sucesso!");
      setXSelectedIdx(null);
      if (XEditingId === it.operadora_taxa_id) cancelar();
      loadTaxas();
    } catch (err: unknown) {
      console.error("Erro ao remover taxa:", err);
      const errMsg = err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error ? err.message : String(err);
      toast.error("Erro ao remover taxa: " + errMsg);
    }
  }, [XEditingId, cancelar, loadTaxas]);

  const itemSelecionado = XSelectedIdx !== null ? XTaxas[XSelectedIdx] : null;
  const isSaved = !!operadoraId;
  const ro = !isEditing || !isSaved;

  // Estados do Simulador de Taxas
  const [XShowSimulador, setXShowSimulador] = useState(false);
  const [XSimValorVenda, setXSimValorVenda] = useState<number>(1000);
  const [XSimParcelaStr, setXSimParcelaStr] = useState<string>("3");

  const simCalculoRes = useMemo(() => {
    if (!XShowSimulador || !XSimValorVenda || XSimValorVenda <= 0) return null;

    const digits = XSimParcelaStr.replace(/\D/g, "");
    const numParcelas = digits ? Math.max(1, parseInt(digits, 10)) : 3;

    const taxaCadastrada = XTaxas.find(t => {
      const pStr = String(t.parcela).trim().toUpperCase();
      const sStr = XSimParcelaStr.trim().toUpperCase();
      return pStr === sStr || pStr.replace(/\D/g, "") === String(numParcelas);
    });

    const taxaOperadoraPercent = taxaCadastrada ? taxaCadastrada.taxa_cartao : 0;
    const taxaAntecipacaoMensalPercent = taxaCadastrada ? taxaCadastrada.taxa_antecipacao : 0;

    const calculo = calcularTaxasCartaoParcelado({
      valorVenda: XSimValorVenda,
      numeroParcelas: numParcelas,
      taxaOperadoraPercent,
      taxaAntecipacaoMensalPercent
    });

    return {
      taxaCadastrada,
      numParcelas,
      calculo
    };
  }, [XShowSimulador, XSimValorVenda, XSimParcelaStr, XTaxas]);

  const toolbar = useMemo(() => (
    <GridActionToolbar
      actions={[
        gridActions.incluir(novo, ro),
        gridActions.alterar(
          () => { if (!itemSelecionado) { toast.error("Selecione um item."); return; } editar(itemSelecionado); },
          ro || !itemSelecionado
        ),
        null,
        gridActions.excluir(
          () => { if (!itemSelecionado) { toast.error("Selecione um item."); return; } excluir(itemSelecionado); },
          ro || !itemSelecionado
        ),
        null,
        gridActions.atualizar(loadTaxas),
      ]}
      count={`${XTaxas.length} item(ns)`}
    />
  ), [XTaxas.length, ro, itemSelecionado, loadTaxas, novo, editar, excluir]);

  return (
    <div className="mt-4 space-y-3 relative">
      <div className="border-t border-border pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Taxas da Operadora
          </h3>
          {!isSaved && (
            <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200/50 dark:border-rose-900/50 animate-pulse">
              Salve a operadora de cartão acima para habilitar a inclusão de taxas
            </span>
          )}
        </div>
        {isSaved && (
          <button
            type="button"
            onClick={() => setXShowSimulador(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors bg-card shadow-xs"
          >
            <Calculator className="w-4 h-4" />
            Simular Taxas (ex: 3x) {XShowSimulador ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {XShowSimulador && isSaved && (
        <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 dark:bg-primary/10 space-y-4 mb-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-primary/10 pb-2">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Simulador de Taxas para Venda Parcelada</h4>
            </div>
            <span className="text-xs text-muted-foreground bg-card px-2.5 py-1 rounded border border-border">
              Calcula com base nas taxas cadastradas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Valor da Venda (R$)</label>
              <DecimalInput
                value={XSimValorVenda}
                onChange={val => setXSimValorVenda(val)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Quantidade de Parcelas</label>
              <select
                value={XSimParcelaStr}
                onChange={e => setXSimParcelaStr(e.target.value)}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]"
              >
                {XTaxas.length > 0 ? (
                  XTaxas.map(t => (
                    <option key={t.operadora_taxa_id} value={t.parcela}>
                      {t.parcela}x (Cartão: {t.taxa_cartao}%, Antecipação: {t.taxa_antecipacao}%)
                    </option>
                  ))
                ) : (
                  <>
                    <option value="1">1x (À vista)</option>
                    <option value="2">2x</option>
                    <option value="3">3x (Exemplo CIELO)</option>
                    <option value="6">6x</option>
                    <option value="12">12x</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex items-end">
              {!simCalculoRes?.taxaCadastrada && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded border border-amber-200/60 dark:border-amber-900/60 flex items-center gap-1.5">
                  <Info className="w-4 h-4 shrink-0" />
                  Nenhuma taxa cadastrada para {XSimParcelaStr}x. Cadastre na tabela abaixo.
                </div>
              )}
            </div>
          </div>

          {simCalculoRes?.calculo && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card p-3 rounded-lg border border-border shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-muted-foreground block">Valor da Venda</span>
                  <span className="text-base font-extrabold text-foreground">
                    R$ {simCalculoRes.calculo.valorVenda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                    Taxa Operadora ({simCalculoRes.calculo.taxaOperadoraPercent}%)
                  </span>
                  <span className="text-base font-extrabold text-destructive">
                    - R$ {simCalculoRes.calculo.valorTaxaOperadora.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-border shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                    Taxa Antecipação ({simCalculoRes.calculo.taxaAntecipacaoEfetivaPercent.toFixed(2)}% efetiva)
                  </span>
                  <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                    - R$ {simCalculoRes.calculo.valorAntecipacaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-card p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs">
                  <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                    Valor Líquido a Receber
                  </span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    R$ {simCalculoRes.calculo.valorLiquidoReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Tabela de Detalhamento por Parcela */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="px-3 py-2 bg-secondary/30 text-xs font-bold text-muted-foreground border-b border-border flex items-center justify-between">
                  <span>Detalhamento por Parcela ({simCalculoRes.calculo.numeroParcelas}x)</span>
                  <span>Prazo de recebimento por parcela</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/15 text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-center">Parcela</th>
                        <th className="px-3 py-2 text-right">Valor Parcela</th>
                        <th className="px-3 py-2 text-center">Prazo (Dias/Meses)</th>
                        <th className="px-3 py-2 text-right">Taxa Antecipação (%)</th>
                        <th className="px-3 py-2 text-right">Valor Antecipação</th>
                        <th className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">Valor Líquido Parcela</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {simCalculoRes.calculo.detalheParcelas.map((parc) => (
                        <tr key={parc.numeroParcela} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-3 py-2 text-center font-bold">{parc.numeroParcela}/{simCalculoRes.calculo.numeroParcelas}</td>
                          <td className="px-3 py-2 text-right">R$ {parc.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-3 py-2 text-center">{parc.prazoDias} dias ({parc.prazoMeses} mes{parc.prazoMeses > 1 ? 'es' : ''})</td>
                          <td className="px-3 py-2 text-right">{parc.taxaAntecipacaoParcelaPercent.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">
                            - R$ {parc.valorAntecipacaoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            R$ {parc.valorLiquidoParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={!isSaved ? "opacity-40 pointer-events-none select-none cursor-not-allowed" : ""}>
        {XEdit && (
          <div className="border border-border rounded p-3 bg-card mb-3">
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Parcela *</label>
                <input
                  type="text"
                  ref={parcelaInputRef}
                  value={XEdit.parcela || ""}
                  onChange={e => setXEdit(prev => ({ ...prev!, parcela: e.target.value }))}
                  placeholder="Ex: 1x, 2x, etc."
                  maxLength={20}
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      taxaCartaoInputRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Taxa Cartão (%)</label>
                <DecimalInput
                  ref={taxaCartaoInputRef}
                  value={XEdit.taxa_cartao || 0}
                  onChange={val => setXEdit(prev => ({ ...prev!, taxa_cartao: val }))}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      taxaAntecipacaoInputRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Taxa Antecipação (%)</label>
                <DecimalInput
                  ref={taxaAntecipacaoInputRef}
                  value={XEdit.taxa_antecipacao || 0}
                  onChange={val => setXEdit(prev => ({ ...prev!, taxa_antecipacao: val }))}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      salvarBtnRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div className="col-span-3 flex items-end gap-1.5 justify-start">
                <button
                  ref={salvarBtnRef}
                  onClick={salvar}
                  className="text-sm px-3.5 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-semibold h-[34px]"
                >
                  {XEditingId ? "Salvar" : "Inserir"}
                </button>
                <button
                  type="button"
                  onClick={cancelar}
                  className="text-sm px-3 py-1.5 rounded border border-border hover:bg-accent transition-colors font-semibold h-[34px] bg-card text-muted-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <DataGrid
          columns={ITEM_COLS}
          data={XTaxas}
          maxHeight="300px"
          selectedIdx={XSelectedIdx}
          onRowClick={(_r, i) => setXSelectedIdx(i)}
          onRowDoubleClick={r => { if (isEditing) editar(r as ITaxa); }}
          showRecordCount={false}
          showExport={false}
          loading={XLoading}
          isLoading={XLoading}
        />
      </div>
    </div>
  );
};

const OperadoraForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();
  const XEmp = XEmpresas.find(e => e.empresa_id === XEmpresaId);
  const XEmpLabel = XEmp ? `${XEmp.empresa_id} - ${XEmp.identificacao}` : String(XEmpresaId);

  return (
    <StandardCrudForm<IOperadora>
      config={{
        XTableName: "operadora",
        XPrimaryKey: "operadora_id",
        XTitle: "Cadastro de Operadoras de Cartões",
        XEmpresaId,
        XSelectCols: "operadora_id,empresa_id,razao,cnpj,tipo_antecipacao",
        XSoftDelete: false,
        XDefaultRecord: XDefault,
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.razao?.trim()) throw new Error("A Razão Social é obrigatória.");

          return {
            ...rec,
            razao: rec.razao.trim().toUpperCase(),
            cnpj: rec.cnpj?.trim() || null,
            tipo_antecipacao: rec.tipo_antecipacao || "SEM ANTECIPAÇÃO",
            empresa_id: XEmpresaId,
          } as IOperadora;
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Operadoras de Cartões"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const hasId = !!record.operadora_id;

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
              <div className="w-full md:w-32">
                <label className="block text-xs font-medium text-muted-foreground mb-1">ID</label>
                <input
                  type="text"
                  value={mode === "insert" ? "(Novo)" : record.operadora_id ?? ""}
                  readOnly
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right"
                />
              </div>
              <div className="w-full md:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Empresa</label>
                <input
                  type="text"
                  value={XEmpLabel}
                  readOnly
                  className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:flex md:flex-wrap md:gap-4 gap-5">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Razão Social <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={record.razao ?? ""}
                  onChange={e => setField("razao", e.target.value.toUpperCase())}
                  readOnly={!isEditing}
                  autoFocus={isEditing}
                  maxLength={100}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                  }`}
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-xs font-medium text-muted-foreground mb-1">CNPJ</label>
                <input
                  type="text"
                  value={record.cnpj ?? ""}
                  onChange={e => setField("cnpj", e.target.value)}
                  readOnly={!isEditing}
                  maxLength={20}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none" : "bg-secondary"
                  }`}
                />
              </div>
              <div className="w-full md:w-56">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo de Antecipação</label>
                <select
                  value={record.tipo_antecipacao ?? "SEM ANTECIPAÇÃO"}
                  onChange={e => setField("tipo_antecipacao", e.target.value)}
                  disabled={!isEditing}
                  className={`w-full border border-border rounded px-3 py-1.5 text-sm ${
                    isEditing ? "bg-card focus:ring-2 focus:ring-ring outline-none h-[34px]" : "bg-secondary h-[34px]"
                  }`}
                >
                  <option value="SEM ANTECIPAÇÃO">SEM ANTECIPAÇÃO</option>
                  <option value="AUTOMÁTICA">AUTOMÁTICA</option>
                  <option value="AVULSA">AVULSA</option>
                </select>
              </div>
            </div>

            {hasId ? (
              <OperadoraTaxaSection
                operadoraId={record.operadora_id}
                empresaId={XEmpresaId || record.empresa_id}
                isEditing={isEditing}
              />
            ) : (
              <div className="border-t border-border pt-6 mt-6 text-center text-xs text-muted-foreground">
                Salve os dados básicos da operadora primeiro para poder configurar as taxas e parcelas.
              </div>
            )}
          </div>
        );
      }}
    />
  );
};

export default OperadoraForm;
