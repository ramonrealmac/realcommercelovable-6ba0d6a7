import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Lock, RefreshCw, Search } from "lucide-react";

const db = supabase as any;
const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface IAberturaRow {
  caixa_abertura_id: number;
  empresa_id: number;
  funcionario_id: number;
  funcionario_nome?: string;
  dt_abertura: string;
  vl_abertura: number | null;
  vl_fechamento: number | null;
  status: string;
}

interface IResumoMeio {
  meio_pagamento_id: number | null;
  descricao: string;
  soma_vl_caixa: string | null;
  vl_total: number;
}

const hoje = () => new Date().toISOString().slice(0, 10);

const FechamentoCaixaForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const [XAberturas, setXAberturas] = useState<IAberturaRow[]>([]);
  const [XSel, setXSel] = useState<IAberturaRow | null>(null);
  const [XResumo, setXResumo] = useState<IResumoMeio[]>([]);
  const [XDtIni, setXDtIni] = useState<string>(hoje());
  const [XDtFim, setXDtFim] = useState<string>(hoje());
  const [XLoading, setXLoading] = useState(false);
  const [XSalvando, setXSalvando] = useState(false);

  // ===== Carrega aberturas no período =====
  const carregar = useCallback(async () => {
    setXLoading(true);
    setXSel(null);
    setXResumo([]);
    try {
      let q = db
        .from("caixa_abertura")
        .select("caixa_abertura_id, empresa_id, funcionario_id, dt_abertura, vl_abertura, vl_fechamento, status")
        .eq("empresa_id", XEmpresaId)
        .order("dt_abertura", { ascending: false })
        .order("caixa_abertura_id", { ascending: false });
      if (XDtIni) q = q.gte("dt_abertura", XDtIni);
      if (XDtFim) q = q.lte("dt_abertura", XDtFim);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const rows = (data || []) as IAberturaRow[];
      // Resolve nomes dos funcionários
      const ids = Array.from(new Set(rows.map((r) => r.funcionario_id))).filter(Boolean);
      let nomes: Record<number, string> = {};
      if (ids.length > 0) {
        const { data: funcs } = await db
          .from("funcionario")
          .select("funcionario_id, nome")
          .in("funcionario_id", ids);
        nomes = Object.fromEntries(((funcs || []) as any[]).map((f) => [f.funcionario_id, f.nome]));
      }
      setXAberturas(rows.map((r) => ({ ...r, funcionario_nome: nomes[r.funcionario_id] || "" })));
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar aberturas.");
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId, XDtIni, XDtFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // ===== Carrega resumo por meio de pagamento da abertura selecionada =====
  const carregarResumo = useCallback(async (ab: IAberturaRow) => {
    setXResumo([]);
    try {
      // 1) Pegar todos os caixa_movimento dessa abertura (mesma empresa, funcionario, data)
      const { data: cms, error: e1 } = await db
        .from("caixa_movimento")
        .select("caixa_movimento_id")
        .eq("empresa_id", ab.empresa_id)
        .eq("funcionario_id", ab.funcionario_id)
        .eq("dt_movimento", ab.dt_abertura)
        .eq("excluido", false);
      if (e1) throw new Error(e1.message);
      const cmIds = ((cms || []) as any[]).map((c) => c.caixa_movimento_id);
      if (cmIds.length === 0) return;

      // 2) Pegar itens desses caixa_movimentos
      const { data: itens, error: e2 } = await db
        .from("caixa_movimento_item")
        .select("meio_pagamento_id, vl_recebido")
        .in("caixa_movimento_id", cmIds)
        .eq("excluido", false);
      if (e2) throw new Error(e2.message);
      const lista = (itens || []) as any[];

      // 3) Buscar meios de pagamento envolvidos
      const meioIds = Array.from(new Set(lista.map((l) => l.meio_pagamento_id).filter((v) => v != null)));
      let meiosMap: Record<number, { descricao: string; soma_vl_caixa: string | null }> = {};
      if (meioIds.length > 0) {
        const { data: meios } = await db
          .from("meio_pagamento")
          .select("meio_pagamento_id, descricao, soma_vl_caixa")
          .in("meio_pagamento_id", meioIds);
        meiosMap = Object.fromEntries(
          ((meios || []) as any[]).map((m) => [
            m.meio_pagamento_id,
            { descricao: m.descricao, soma_vl_caixa: m.soma_vl_caixa },
          ])
        );
      }

      // 4) Agrupar
      const agrup: Record<string, IResumoMeio> = {};
      for (const it of lista) {
        const id = it.meio_pagamento_id ?? null;
        const k = String(id ?? "null");
        const m = id != null ? meiosMap[id] : null;
        if (!agrup[k]) {
          agrup[k] = {
            meio_pagamento_id: id,
            descricao: m?.descricao || "(sem meio)",
            soma_vl_caixa: m?.soma_vl_caixa ?? null,
            vl_total: 0,
          };
        }
        agrup[k].vl_total += Number(it.vl_recebido || 0);
      }
      setXResumo(Object.values(agrup).sort((a, b) => a.descricao.localeCompare(b.descricao)));
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar resumo.");
    }
  }, []);

  const selecionar = (ab: IAberturaRow) => {
    setXSel(ab);
    carregarResumo(ab);
  };

  // ===== Totais =====
  const totalSomaCaixa = XResumo
    .filter((r) => String(r.soma_vl_caixa || "").toUpperCase() === "S")
    .reduce((a, r) => a + r.vl_total, 0);
  const totalGeral = XResumo.reduce((a, r) => a + r.vl_total, 0);
  const vlAbertura = Number(XSel?.vl_abertura || 0);
  const vlFechamentoCalc = vlAbertura + totalSomaCaixa;
  const vlFechamentoAtual = Number(XSel?.vl_fechamento || 0);

  // ===== Confirma fechamento =====
  const confirmarFechamento = async () => {
    if (!XSel) return;
    if (XSel.status === "F") {
      toast.error("Caixa já está fechado.");
      return;
    }
    if (!confirm(`Confirma o fechamento do caixa de ${XSel.funcionario_nome} em ${XSel.dt_abertura}?`)) return;
    setXSalvando(true);
    try {
      const { error } = await db
        .from("caixa_abertura")
        .update({ vl_fechamento: vlFechamentoCalc, status: "F" })
        .eq("caixa_abertura_id", XSel.caixa_abertura_id);
      if (error) throw new Error(error.message);
      toast.success("Caixa fechado com sucesso.");
      await carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar caixa.");
    } finally {
      setXSalvando(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock size={18} className="text-amber-600" /> Fechamento de Caixa
        </h2>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 border border-border rounded p-3 bg-card">
        <div>
          <label className="text-xs text-muted-foreground block">Data Inicial</label>
          <input
            type="date"
            value={XDtIni}
            onChange={(e) => setXDtIni(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm bg-white text-black"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block">Data Final</label>
          <input
            type="date"
            value={XDtFim}
            onChange={(e) => setXDtFim(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm bg-white text-black"
          />
        </div>
        <button
          onClick={carregar}
          disabled={XLoading}
          className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground flex items-center gap-2 disabled:opacity-50"
        >
          <Search size={14} /> Filtrar
        </button>
        <button
          onClick={carregar}
          disabled={XLoading}
          className="text-sm px-3 py-1.5 rounded border border-border flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de aberturas */}
        <div className="col-span-7 border border-border rounded overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
            Aberturas ({XAberturas.length})
          </div>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5">Data</th>
                  <th className="text-left px-2 py-1.5">Funcionário</th>
                  <th className="text-right px-2 py-1.5">Abertura</th>
                  <th className="text-right px-2 py-1.5">Fechamento</th>
                  <th className="text-center px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {XAberturas.map((ab) => {
                  const isSel = XSel?.caixa_abertura_id === ab.caixa_abertura_id;
                  return (
                    <tr
                      key={ab.caixa_abertura_id}
                      onClick={() => selecionar(ab)}
                      className={`cursor-pointer border-t border-border ${
                        isSel ? "bg-accent" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="px-2 py-1.5">{ab.caixa_abertura_id}</td>
                      <td className="px-2 py-1.5">
                        {ab.dt_abertura
                          ? new Date(ab.dt_abertura + "T00:00:00").toLocaleDateString("pt-BR")
                          : ""}
                      </td>
                      <td className="px-2 py-1.5">{ab.funcionario_nome}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(Number(ab.vl_abertura || 0))}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(Number(ab.vl_fechamento || 0))}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded ${
                            ab.status === "F"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {ab.status === "F" ? "Fechado" : "Aberto"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {XAberturas.length === 0 && !XLoading && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground py-6">
                      Nenhuma abertura encontrada no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumo */}
        <div className="col-span-5 space-y-3">
          <div className="border border-border rounded">
            <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider">
              Resumo por Meio de Pagamento
            </div>
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5">Meio</th>
                    <th className="text-center px-2 py-1.5">Soma?</th>
                    <th className="text-right px-2 py-1.5">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {XResumo.map((r) => (
                    <tr key={String(r.meio_pagamento_id)} className="border-t border-border">
                      <td className="px-2 py-1.5">{r.descricao}</td>
                      <td className="px-2 py-1.5 text-center">
                        {String(r.soma_vl_caixa || "").toUpperCase() === "S" ? "Sim" : "Não"}
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmt(r.vl_total)}</td>
                    </tr>
                  ))}
                  {XResumo.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted-foreground py-4">
                        {XSel ? "Sem movimentos." : "Selecione uma abertura."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {XSel && (
            <div className="border border-border rounded p-3 space-y-2 bg-card">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor de Abertura</span>
                <span className="font-medium">{fmt(vlAbertura)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Recebido (somam)</span>
                <span className="font-medium">{fmt(totalSomaCaixa)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Geral Movimentos</span>
                <span className="font-medium">{fmt(totalGeral)}</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="text-sm font-semibold">Vlr Fechamento Calculado</span>
                <span className="font-bold text-base">{fmt(vlFechamentoCalc)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Vlr Fechamento Gravado</span>
                <span>{fmt(vlFechamentoAtual)}</span>
              </div>

              <button
                onClick={confirmarFechamento}
                disabled={XSalvando || XSel.status === "F"}
                className="w-full mt-2 text-sm px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Lock size={14} />
                {XSel.status === "F"
                  ? "Caixa já fechado"
                  : XSalvando
                  ? "Fechando..."
                  : "Confirmar Fechamento"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FechamentoCaixaForm;
