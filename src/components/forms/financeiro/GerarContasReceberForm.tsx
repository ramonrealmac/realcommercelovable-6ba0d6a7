import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import { useCrudController } from "@/hooks/useCrudController";
import type { IGridColumn } from "@/components/grid/DataGrid";
import ClienteSearchDialog from "@/components/forms/pedido/ClienteSearchDialog";
import { Search } from "lucide-react";

interface IFinanceiro {
  financeiro_id?: number;
  empresa_id: number;
  movimento_id?: number | null;
  documento: string;
  parcela?: number | null;
  tp_documento_id?: string | null;
  tp_conta: string;
  dt_emissao: string | null;
  dt_vencto: string | null;
  portador_id: number;
  cadastro_id: number;
  observacao1?: string | null;
  vl_titulo: number;
  vl_pago?: number | null;
  vl_desconto?: number | null;
  vl_adicional?: number | null;
  vl_despesa?: number | null;
  plano_id: number;
  planoconta_id: number;
  ativo: string;
  status: string;
  pct_juros?: number | null;
  pct_multa?: number | null;
}

interface IOpt { id: string; label: string; }

const getStatusLabel = (rec: IFinanceiro) => {
  if (rec.status === "C") return "CANCELADO";
  if (rec.status === "B" || (rec.vl_pago && rec.vl_pago >= rec.vl_titulo)) return "BAIXADO";
  if (rec.vl_pago && rec.vl_pago > 0 && rec.vl_pago < rec.vl_titulo) return "PAGTO PARCIAL";
  
  if (rec.dt_vencto) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const vencStr = rec.dt_vencto.substring(0, 10);
    if (vencStr < todayStr) {
      return "VENCIDO";
    }
  }
  return "ABERTO";
};

const fmtMoney = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const maskMoney = (value: string | number): string => {
  const cleanValue = String(value).replace(/\D/g, "");
  if (!cleanValue) return "0,00";
  const numValue = parseInt(cleanValue, 10) / 100;
  return numValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMoneyToFloat = (val: string): number => {
  const clean = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

const formatDateBR = (isoDateStr: string | null | undefined) => {
  if (!isoDateStr) return "";
  const clean = isoDateStr.substring(0, 10);
  if (!clean.includes("-")) return clean;
  const [year, month, day] = clean.split("-");
  return `${day}/${month}/${year}`;
};



const DataBaixaField: React.FC<{ financeiroId?: number; labelClass: string; inputClass: string }> = ({ financeiroId, labelClass, inputClass }) => {
  const [XDate, setXDate] = useState<string>("");

  useEffect(() => {
    if (!financeiroId) {
      setXDate("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("financeiro_baixa")
        .select("dt_pagamento")
        .eq("financeiro_id", financeiroId)
        .order("dt_pagamento", { ascending: false })
        .limit(1);
      if (data?.length && data[0].dt_pagamento) {
        setXDate(formatDateBR(data[0].dt_pagamento));
      } else {
        setXDate("");
      }
    })();
  }, [financeiroId]);

  return (
    <div>
      <label className={labelClass}>Data Baixa</label>
      <input 
        type="text" 
        readOnly 
        value={XDate} 
        className={inputClass} 
      />
    </div>
  );
};

const PedidoField: React.FC<{
  movimentoId: number | null | undefined;
  isEditable: boolean;
  inputCls: string;
  readonlyCls: string;
  labelCls: string;
  setField: (k: string, v: any) => void;
}> = ({ movimentoId, isEditable, inputCls, readonlyCls, labelCls, setField }) => {
  const [XNrInput, setXNrInput] = useState<string>("");

  useEffect(() => {
    if (!movimentoId) {
      setXNrInput("");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("movimento")
        .select("nr_movimento")
        .eq("movimento_id", movimentoId)
        .maybeSingle();
      if (data?.nr_movimento) {
        setXNrInput(String(data.nr_movimento));
      } else {
        setXNrInput("");
      }
    })();
  }, [movimentoId]);

  return (
    <div>
      <label className={labelCls}>Nº Pedido</label>
      <input 
        type="text" 
        className={isEditable ? inputCls : readonlyCls} 
        value={XNrInput} 
        readOnly={!isEditable}
        onChange={async (e) => {
          const val = e.target.value;
          setXNrInput(val);
          const nrVal = parseInt(val, 10);
          if (!isNaN(nrVal)) {
            const { data } = await supabase
              .from("movimento")
              .select("movimento_id")
              .eq("nr_movimento", nrVal)
              .limit(1);
            if (data && data.length > 0) {
              setField("movimento_id", data[0].movimento_id);
            } else {
              setField("movimento_id", null);
            }
          } else {
            setField("movimento_id", null);
          }
        }} 
      />
    </div>
  );
};

const MeioPagamentoSelect: React.FC<{
  record: any;
  setField: (k: string, v: any) => void;
  XTipoDocs: IOpt[];
  isEditable: boolean;
  inputCls: string;
  readonlyCls: string;
  labelCls: string;
  mode: string;
}> = ({ record, setField, XTipoDocs, isEditable, inputCls, readonlyCls, labelCls, mode }) => {
  useEffect(() => {
    if (mode === "insert" && !record.tp_documento_id && XTipoDocs.length > 0) {
      setField("tp_documento_id", String(XTipoDocs[0].id));
    }
  }, [mode, record.tp_documento_id, XTipoDocs, setField]);

  return (
    <div>
      <label className={labelCls}>Meios de Pagamento</label>
      {isEditable ? (
        <select 
          id="meio_pagamento_select"
          className={inputCls} 
          value={record.tp_documento_id ?? ""} 
          onChange={e => setField("tp_documento_id", e.target.value)}
        >
          <option value="">Selecione...</option>
          {XTipoDocs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : (
        <input 
          type="text" 
          className={readonlyCls} 
          value={XTipoDocs.find(o => String(o.id) === String(record.tp_documento_id))?.label ?? ""} 
          readOnly 
        />
      )}
    </div>
  );
};

interface FinanceiroBaixasGridProps {
  financeiroId: number;
  empresaId: number;
}

interface IBaixa {
  financeiro_baixa_id: number;
  documento: string | null;
  dt_pagamento: string | null;
  vl_pago: number | null;
  recibo: string | null;
  conta_id: string | null;
  tipo_pag_rec_id: number | null;
  observacao: string | null;
}

const FinanceiroBaixasGrid: React.FC<FinanceiroBaixasGridProps> = ({ financeiroId, empresaId }) => {
  const [baixas, setBaixas] = useState<IBaixa[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [contas, setContas] = useState<{ id: string; nome: string }[]>([]);
  const [meios, setMeios] = useState<{ id: number; nome: string }[]>([]);

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [ctRes, mpRes, bxRes] = await Promise.all([
          supabase.from("conta").select("conta_id, nome_conta").eq("empresa_id", empresaId),
          supabase.from("meio_pagamento").select("meio_pagamento_id, descricao"),
          supabase.from("financeiro_baixa")
            .select("financeiro_baixa_id, documento, dt_pagamento, vl_pago, recibo, conta_id, tipo_pag_rec_id, observacao")
            .eq("financeiro_id", financeiroId)
            .order("financeiro_baixa_id")
        ]);

        if (active) {
          if (ctRes.data) {
            setContas(ctRes.data.map(c => ({ id: c.conta_id, nome: c.nome_conta ?? "" })));
          }
          if (mpRes.data) {
            setMeios(mpRes.data.map(m => ({ id: m.meio_pagamento_id, nome: m.descricao ?? "" })));
          }
          if (bxRes.data) {
            setBaixas(bxRes.data as IBaixa[]);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar baixas/pagamentos:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (financeiroId && empresaId) {
      fetchData();
    }
    return () => {
      active = false;
    };
  }, [financeiroId, empresaId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        Carregando detalhes dos pagamentos...
      </div>
    );
  }

  if (baixas.length === 0) {
    return null;
  }

  const getContaNome = (id: string | null) => contas.find(c => c.id === id)?.nome ?? id ?? "";
  const getMeioNome = (id: number | null) => meios.find(m => m.id === id)?.nome ?? "";

  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden bg-card">
      <div className="px-4 py-3 border-b border-border bg-muted/20">
        <h3 className="text-sm font-semibold text-foreground">Detalhamento dos Pagamentos</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-2.5 font-medium">Documento</th>
              <th className="px-4 py-2.5 font-medium">Dt. Pagamento</th>
              <th className="px-4 py-2.5 text-right font-medium">Vlr. Pago</th>
              <th className="px-4 py-2.5 font-medium">Recibo</th>
              <th className="px-4 py-2.5 font-medium">Conta</th>
              <th className="px-4 py-2.5 font-medium">Tipo Pagto</th>
              <th className="px-4 py-2.5 font-medium">Observação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {baixas.map(b => (
              <tr key={b.financeiro_baixa_id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2.5 font-medium">{b.documento}</td>
                <td className="px-4 py-2.5">{formatDateBR(b.dt_pagamento)}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-foreground">{fmtMoney(b.vl_pago)}</td>
                <td className="px-4 py-2.5">{b.recibo || "-"}</td>
                <td className="px-4 py-2.5">{getContaNome(b.conta_id) || "-"}</td>
                <td className="px-4 py-2.5">{getMeioNome(b.tipo_pag_rec_id) || "-"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{b.observacao || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GerarContasReceberForm: React.FC<{ initialId?: number }> = ({ initialId }) => {
  const { XEmpresaId, XEmpresas } = useAppContext();

  const [XEmpresasOpt, setXEmpresasOpt] = useState<IOpt[]>([]);
  const [XClientes, setXClientes] = useState<IOpt[]>([]);
  const [XTipoDocs, setXTipoDocs] = useState<IOpt[]>([]);
  const [XPortadores, setXPortadores] = useState<IOpt[]>([]);
  const [XPlanos, setXPlanos] = useState<IOpt[]>([]);
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTarget, setXSearchTarget] = useState<((c: any) => void) | null>(null);

  const XGridCols = useMemo<IGridColumn[]>(() => [
    { key: "documento", label: "Documento", width: "120px" },
    { key: "parcela", label: "Parcela", width: "80px", align: "right" },
    { key: "dt_emissao", label: "Dt. Emissão", width: "100px", align: "center", render: (r) => formatDateBR(r.dt_emissao), getValue: (r) => formatDateBR(r.dt_emissao) },
    { key: "dt_vencto", label: "Dt. Vencimento", width: "110px", align: "center", render: (r) => formatDateBR(r.dt_vencto), getValue: (r) => formatDateBR(r.dt_vencto) },
    {
      key: "dt_baixa",
      label: "Dt. Baixa",
      width: "110px",
      align: "center",
      render: (r) => {
        if (!r.financeiro_baixa || r.financeiro_baixa.length === 0) return "";
        const sorted = [...r.financeiro_baixa].sort((a, b) => 
          new Date(b.dt_pagamento || 0).getTime() - new Date(a.dt_pagamento || 0).getTime()
        );
        return formatDateBR(sorted[0]?.dt_pagamento);
      },
      getValue: (r) => {
        if (!r.financeiro_baixa || r.financeiro_baixa.length === 0) return "";
        const sorted = [...r.financeiro_baixa].sort((a, b) => 
          new Date(b.dt_pagamento || 0).getTime() - new Date(a.dt_pagamento || 0).getTime()
        );
        return formatDateBR(sorted[0]?.dt_pagamento) || "";
      }
    },
    {
      key: "movimento_id",
      label: "Pedido",
      width: "90px",
      align: "center",
      render: (r) => r.movimento?.nr_movimento || "",
      getValue: (r) => r.movimento?.nr_movimento || ""
    },
    {
      key: "cadastro_id",
      label: "Cliente",
      width: "180px",
      render: (r) => XClientes.find(c => String(c.id) === String(r.cadastro_id))?.label ?? String(r.cadastro_id || ""),
      getValue: (r) => XClientes.find(c => String(c.id) === String(r.cadastro_id))?.label ?? String(r.cadastro_id || "")
    },
    {
      key: "portador_id",
      label: "Portador",
      width: "120px",
      render: (r) => XPortadores.find(p => String(p.id) === String(r.portador_id))?.label ?? String(r.portador_id || ""),
      getValue: (r) => XPortadores.find(p => String(p.id) === String(r.portador_id))?.label ?? String(r.portador_id || "")
    },
    {
      key: "plano_id",
      label: "Plano de Contas",
      width: "150px",
      render: (r) => XPlanos.find(p => String(p.id) === String(r.plano_id))?.label ?? String(r.plano_id || ""),
      getValue: (r) => XPlanos.find(p => String(p.id) === String(r.plano_id))?.label ?? String(r.plano_id || "")
    },
    { key: "vl_titulo", label: "Vlr. Título", width: "110px", align: "right", render: (r) => fmtMoney(r.vl_titulo) },
    { key: "vl_pago", label: "Vlr. Pago", width: "110px", align: "right", render: (r) => fmtMoney(r.vl_pago) },
    {
      key: "pct_juros",
      label: "Juros",
      width: "90px",
      align: "right",
      render: (r) => fmtMoney(r.pct_juros)
    },
    {
      key: "pct_multa",
      label: "Multa",
      width: "90px",
      align: "right",
      render: (r) => fmtMoney(r.pct_multa)
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
      align: "center",
      render: (r) => {
        const label = getStatusLabel(r);
        let colorClass = "text-zinc-950 dark:text-zinc-50";
        if (label === "PAGTO PARCIAL") {
          colorClass = "text-[#0033ff] dark:text-[#4d88ff] font-bold";
        } else if (label === "BAIXADO") {
          colorClass = "text-emerald-600 dark:text-emerald-400 font-bold";
        } else if (label === "CANCELADO") {
          colorClass = "text-zinc-400 dark:text-zinc-500 line-through";
        } else if (label === "VENCIDO") {
          colorClass = "text-red-600 dark:text-red-400 font-bold";
        } else if (label === "ABERTO") {
          colorClass = "text-amber-600 dark:text-amber-400 font-bold";
        }
        return <span className={colorClass}>{label}</span>;
      },
      getValue: (r) => getStatusLabel(r)
    }
  ], [XClientes, XPortadores, XPlanos]);

  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      if (XEmpresas?.length) {
        setXEmpresasOpt(XEmpresas.map(e => ({ id: String(e.empresa_id), label: e.razao_social })));
      } else {
        const { data } = await supabase.from("empresa").select("empresa_id, razao_social").order("razao_social");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setXEmpresasOpt((data ?? []).map((e: any) => ({ id: String(e.empresa_id), label: e.razao_social })));
      }

      const [{ data: cli }, { data: mp }, { data: po }, { data: pl }] = await Promise.all([
        supabase.from("cadastro").select("cadastro_id, nome_fantasia, razao_social").eq("empresa_id", XEmpresaId).eq("excluido", false).order("nome_fantasia"),
        supabase.from("meio_pagamento").select("codigo, descricao").order("descricao"),
        supabase.from("portador").select("portador_id, nome, banco_id").eq("empresa_id", XEmpresaId).eq("excluido", false).order("nome"),
        supabase.from("plano_conta").select("plano_conta_id, nome").eq("tp_conta", "A").eq("tp_natureza", "R").eq("empresa_id", XEmpresaId).eq("excluido", false).order("nome"),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setXClientes((cli ?? []).map((c: any) => ({ id: String(c.cadastro_id), label: `${c.cadastro_id} - ${c.nome_fantasia || c.razao_social || ""}` })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setXTipoDocs((mp ?? []).map((m: any) => ({ id: String(m.codigo), label: m.descricao })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setXPortadores((po ?? []).map((p: any) => ({ id: String(p.portador_id), label: p.nome, banco_id: p.banco_id })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setXPlanos((pl ?? []).map((p: any) => ({ id: String(p.plano_conta_id), label: p.nome })));
    })();
  }, [XEmpresas, XEmpresaId]);

  const XDefaultRecord = useMemo<Partial<IFinanceiro>>(() => ({
    empresa_id: XEmpresaId || 0,
    documento: "",
    movimento_id: 0,
    tp_conta: "R",
    dt_emissao: new Date().toISOString().substring(0, 10),
    dt_vencto: new Date().toISOString().substring(0, 10),
    cadastro_id: 0,
    tp_documento_id: "",
    portador_id: 0,
    plano_id: 0,
    planoconta_id: 0,
    observacao1: "",
    vl_titulo: 0,
    vl_pago: 0,
    vl_desconto: 0,
    vl_adicional: 0,
    vl_despesa: 0,
    ativo: "S",
    status: "A",
    pct_juros: 0,
    pct_multa: 0,
    parcela: 1
  }), [XEmpresaId]);

  const crudConfig = useMemo(() => ({
    XTableName: "financeiro",
    XPrimaryKey: "financeiro_id",
    XTitle: "Gerenciador de Títulos Manuais",
    XEmpresaId: XEmpresaId,
    XDefaultRecord,
    XSoftDelete: false,
    XCanEdit: (rec: IFinanceiro) => {
      if (!rec) return true;
      if (rec.status === "B" || rec.status === "C") return false;
      return getStatusLabel(rec) !== "PAGTO PARCIAL";
    },
    XApplyFilter: (q) => q.eq("tp_conta", "R").eq("ativo", "S"),
    XOnBeforeSave: (rec: IFinanceiro) => {
      if (!rec.empresa_id) throw new Error("A Empresa é obrigatória.");
      if (!rec.documento?.trim()) throw new Error("O Documento é obrigatório.");
      if (!rec.cadastro_id) throw new Error("O Cliente é obrigatório.");
      if (!rec.parcela || rec.parcela <= 0) throw new Error("O Número da Parcela é obrigatório.");
      if (!rec.dt_emissao) throw new Error("A Data de Emissão é obrigatória.");
      if (!rec.dt_vencto) throw new Error("A Data de Vencimento é obrigatória.");
      if ((rec.vl_titulo ?? 0) <= 0) throw new Error("O Valor do Título deve ser maior que zero.");

      return {
        ...rec,
        documento: rec.documento.trim(),
        planoconta_id: rec.plano_id || 0,
        tp_conta: "R",
        ativo: "S",
        status: rec.status || "A",
        movimento_id: rec.movimento_id ? Number(rec.movimento_id) : 0,
        parcela: rec.parcela ? Number(rec.parcela) : 1
      };
    }
  }), [XEmpresaId, XDefaultRecord]);

  const ctrl = useCrudController<IFinanceiro>(crudConfig);

  // Enriquecer os dados com baixas e número do movimento em segundo plano
  useEffect(() => {
    if (!ctrl.XData || ctrl.XData.length === 0) return;

    // Se todos já estiverem enriquecidos, pula para evitar loop infinito
    const alreadyEnriched = ctrl.XData.every(r => "financeiro_baixa" in r && "movimento" in r);
    if (alreadyEnriched) return;

    let active = true;

    const enrich = async () => {
      try {
        const financeiroIds = ctrl.XData.map(r => r.financeiro_id).filter(Boolean);
        const movimentoIds = ctrl.XData.map(r => r.movimento_id).filter(Boolean);

        const [bxRes, movRes] = await Promise.all([
          financeiroIds.length > 0
            ? supabase.from("financeiro_baixa").select("financeiro_id, dt_pagamento, vl_pago").in("financeiro_id", financeiroIds)
            : Promise.resolve({ data: null }),
          movimentoIds.length > 0
            ? supabase.from("movimento").select("movimento_id, nr_movimento").in("movimento_id", movimentoIds)
            : Promise.resolve({ data: null })
        ]);

        if (active) {
          const bxs = bxRes.data || [];
          const movs = movRes.data || [];

          const enriched = ctrl.XData.map(row => {
            const rowBaixas = bxs.filter((b) => b.financeiro_id === row.financeiro_id);
            const rowMov = movs.find((m) => m.movimento_id === row.movimento_id);
            return {
              ...row,
              financeiro_baixa: rowBaixas,
              movimento: rowMov
            };
          });
          ctrl.setXData(enriched);
        }
      } catch (err) {
        console.error("Erro ao enriquecer dados do financeiro:", err);
      }
    };

    enrich();

    return () => {
      active = false;
    };
  }, [ctrl.XData, ctrl.setXData, ctrl]);

  const inputCls = "w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none";
  const readonlyLeftCls = "w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary/50 text-left focus:outline-none";
  const readonlyRightCls = "w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary/50 text-right focus:outline-none";
  const lbl = "block text-xs font-semibold text-muted-foreground mb-1";

  return (
    <>
      <StandardCrudForm<IFinanceiro>
      XCtrl={ctrl}
      XInitialId={initialId}
      config={{
        XTableName: "financeiro",
        XPrimaryKey: "financeiro_id",
        XTitle: "Gerenciador de Títulos Manuais",
        XEmpresaId: XEmpresaId,
        XDefaultRecord,
        XSoftDelete: false,
        XCanEdit: (rec) => {
          if (!rec) return true;
          if (rec.status === "B" || rec.status === "C") return false;
          return getStatusLabel(rec) !== "PAGTO PARCIAL";
        },
        XApplyFilter: (q) => q.eq("tp_conta", "R").eq("ativo", "S"),
        XOnBeforeSave: (rec) => {
          if (!rec.empresa_id) throw new Error("A Empresa é obrigatória.");
          if (!rec.documento?.trim()) throw new Error("O Documento é obrigatório.");
          if (!rec.cadastro_id) throw new Error("O Cliente é obrigatório.");
          if (!rec.parcela || rec.parcela <= 0) throw new Error("O Número da Parcela é obrigatório.");
          if (!rec.dt_emissao) throw new Error("A Data de Emissão é obrigatória.");
          if (!rec.dt_vencto) throw new Error("A Data de Vencimento é obrigatória.");
          if ((rec.vl_titulo ?? 0) <= 0) throw new Error("O Valor do Título deve ser maior que zero.");

          const cleanRec = { ...rec };
          delete (cleanRec as any).financeiro_baixa;
          delete (cleanRec as any).movimento;

          return {
            ...cleanRec,
            documento: rec.documento.trim(),
            planoconta_id: rec.plano_id || 0,
            tp_conta: "R",
            ativo: "S",
            status: rec.status || "A",
            movimento_id: rec.movimento_id ? Number(rec.movimento_id) : 0,
            parcela: rec.parcela ? Number(rec.parcela) : 1
          };
        }
      }}
      XGridCols={XGridCols}
      XExportTitle="Titulos Manuais"
      renderCadastro={({ record, setField, mode, isEditing }) => {
        const isEditable = isEditing && record.status !== "B" && record.status !== "C" && getStatusLabel(record) !== "PAGTO PARCIAL";

        const XFilteredPortadores = (() => {
          const mpId = Number(record.tp_documento_id || 0);
          if (!mpId) return XPortadores;

          // Se for Dinheiro/Crediário/Duplicata/Posterior (1, 5, 14, 91)
          if ([1, 5, 14, 91].includes(mpId)) {
            return XPortadores.filter((p: any) => p.banco_id === null || p.banco_id === 0);
          }
          // Se for Banco/Cartão/Pix (3, 4, 15, 16, 17, 20)
          if ([3, 4, 15, 16, 17, 20].includes(mpId)) {
            return XPortadores.filter((p: any) => p.banco_id !== null && p.banco_id !== 0);
          }
          return XPortadores;
        })();

        const handleKeyDown = (e: React.KeyboardEvent) => {
          if (e.key === "Enter") {
            const target = e.target as HTMLElement;
            if (
              target.tagName === "TEXTAREA" ||
              target.tagName === "BUTTON" ||
              (target.tagName === "INPUT" && (target as HTMLInputElement).type === "submit")
            ) {
              return;
            }
            e.preventDefault();

            const container = e.currentTarget;
            const focusableElements = Array.from(
              container.querySelectorAll(
                'input:not([readonly]):not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([readonly]):not([disabled]):not([tabindex="-1"]), button:not([disabled])'
              )
            ) as HTMLElement[];

            const index = focusableElements.indexOf(target);
            if (index > -1 && index < focusableElements.length - 1) {
              focusableElements[index + 1].focus();
            }
          }
        };

        const handleClienteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (!isEditable) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            setXSearchTarget(() => (c: any) => {
              const newId = String(c.cadastro_id);
              const label = `${c.cadastro_id} - ${c.nome_fantasia || c.razao_social || ""}`;
              setXClientes(prev => {
                if (!prev.some(cli => cli.id === newId)) {
                  return [...prev, { id: newId, label }];
                }
                return prev;
              });
              setField("cadastro_id", Number(c.cadastro_id) || 0);
              setTimeout(() => {
                document.getElementById("meio_pagamento_select")?.focus();
              }, 100);
            });
            setXSearchOpen(true);
          }
        };

        return (
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            {/* Linha 1 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <label className={lbl}>Documento <span className="text-destructive">*</span></label>
                <input 
                  type="text" 
                  className={isEditable ? inputCls : readonlyLeftCls} 
                  value={record.documento ?? ""} 
                  readOnly={!isEditable}
                  onChange={e => setField("documento", e.target.value)} 
                />
              </div>
              <div className="md:col-span-4">
                <label className={lbl}>Empresa</label>
                <input 
                  type="text" 
                  value={(() => {
                    const em = XEmpresas.find(e => e.empresa_id === record.empresa_id || e.empresa_id === XEmpresaId);
                    return em ? `${em.empresa_id} - ${em.identificacao}` : String(record.empresa_id || XEmpresaId || "");
                  })()} 
                  readOnly 
                  className={readonlyLeftCls} 
                />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Nº Parcela <span className="text-destructive">*</span></label>
                <input 
                  type="number" 
                  min="1" 
                  className={isEditable ? inputCls + " text-right" : readonlyRightCls} 
                  value={record.parcela ?? ""} 
                  readOnly={!isEditable}
                  onChange={e => setField("parcela", parseInt(e.target.value) || 1)} 
                />
              </div>
              <div className="md:col-span-4">
                <PedidoField 
                  movimentoId={record.movimento_id}
                  isEditable={isEditable}
                  inputCls={inputCls}
                  readonlyCls={readonlyLeftCls}
                  labelCls={lbl}
                  setField={setField}
                />
              </div>
            </div>

            {/* Linha 2 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <label className={lbl}>Data Emissão <span className="text-destructive">*</span></label>
                <input 
                  type={isEditable ? "date" : "text"} 
                  className={isEditable ? inputCls : readonlyLeftCls} 
                  value={isEditable ? (record.dt_emissao ? record.dt_emissao.substring(0, 10) : "") : formatDateBR(record.dt_emissao)} 
                  readOnly={!isEditable}
                  onChange={e => setField("dt_emissao", e.target.value)} 
                />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Data Vencimento <span className="text-destructive">*</span></label>
                <input 
                  type={isEditable ? "date" : "text"} 
                  className={isEditable ? inputCls : readonlyLeftCls} 
                  value={isEditable ? (record.dt_vencto ? record.dt_vencto.substring(0, 10) : "") : formatDateBR(record.dt_vencto)} 
                  readOnly={!isEditable}
                  onChange={e => setField("dt_vencto", e.target.value)} 
                />
              </div>
              <div className="md:col-span-4">
                <label className={lbl}>Cliente <span className="text-destructive">*</span></label>
                {isEditable ? (
                  <div className="flex gap-1">
                    <input 
                      type="text"
                      readOnly
                      onClick={() => {
                        setXSearchTarget(() => (c: any) => {
                          const newId = String(c.cadastro_id);
                          const label = `${c.cadastro_id} - ${c.nome_fantasia || c.razao_social || ""}`;
                          setXClientes(prev => {
                            if (!prev.some(cli => cli.id === newId)) {
                              return [...prev, { id: newId, label }];
                            }
                            return prev;
                          });
                          setField("cadastro_id", Number(c.cadastro_id) || 0);
                          setTimeout(() => {
                            document.getElementById("meio_pagamento_select")?.focus();
                          }, 100);
                        });
                        setXSearchOpen(true);
                      }}
                      onKeyDown={handleClienteKeyDown}
                      className="flex-1 border border-border rounded px-2 py-1 text-sm bg-card cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                      value={record.cadastro_id ? (XClientes.find(o => String(o.id) === String(record.cadastro_id))?.label ?? String(record.cadastro_id)) : ""}
                      placeholder="Enter para pesquisar..."
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setXSearchTarget(() => (c: any) => {
                          const newId = String(c.cadastro_id);
                          const label = `${c.cadastro_id} - ${c.nome_fantasia || c.razao_social || ""}`;
                          setXClientes(prev => {
                            if (!prev.some(cli => cli.id === newId)) {
                              return [...prev, { id: newId, label }];
                            }
                            return prev;
                          });
                          setField("cadastro_id", Number(c.cadastro_id) || 0);
                          setTimeout(() => {
                            document.getElementById("meio_pagamento_select")?.focus();
                          }, 100);
                        });
                        setXSearchOpen(true);
                      }}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent flex items-center justify-center"
                      title="Pesquisar cliente"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                    {record.cadastro_id ? (
                      <button
                        type="button"
                        onClick={() => setField("cadastro_id", 0)}
                        className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                        title="Limpar"
                      >×</button>
                    ) : null}
                  </div>
                ) : (
                  <input 
                    type="text" 
                    className={readonlyLeftCls} 
                    value={XClientes.find(o => String(o.id) === String(record.cadastro_id))?.label ?? ""} 
                    readOnly 
                  />
                )}
              </div>
              <div className="md:col-span-4">
                <MeioPagamentoSelect 
                  record={record}
                  setField={setField}
                  XTipoDocs={XTipoDocs}
                  isEditable={isEditable}
                  inputCls={inputCls}
                  readonlyCls={readonlyLeftCls}
                  labelCls={lbl}
                  mode={mode}
                />
              </div>
            </div>

            {/* Linha 3 */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className={lbl}>Portador</label>
                {isEditable ? (
                  <select 
                    className={inputCls} 
                    value={record.portador_id ?? ""} 
                    onChange={e => setField("portador_id", Number(e.target.value) || 0)}
                  >
                    <option value="">Selecione...</option>
                    {XFilteredPortadores.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    className={readonlyLeftCls} 
                    value={XPortadores.find(o => String(o.id) === String(record.portador_id))?.label ?? ""} 
                    readOnly 
                  />
                )}
              </div>
              <div className="md:col-span-4">
                <label className={lbl}>Plano de Contas</label>
                {isEditable ? (
                  <select 
                    className={inputCls} 
                    value={record.plano_id ?? ""} 
                    onChange={e => setField("plano_id", Number(e.target.value) || 0)}
                  >
                    <option value="">Selecione...</option>
                    {XPlanos.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    className={readonlyLeftCls} 
                    value={XPlanos.find(o => String(o.id) === String(record.plano_id))?.label ?? ""} 
                    readOnly 
                  />
                )}
              </div>
              <div className="md:col-span-4">
                <label className={lbl}>Observação</label>
                <input 
                  type="text" 
                  className={isEditable ? inputCls : readonlyLeftCls} 
                  value={record.observacao1 ?? ""} 
                  readOnly={!isEditable}
                  onChange={e => setField("observacao1", e.target.value)} 
                />
              </div>
            </div>

            {/* Linha 4 (Valores de Mesmo Tamanho) */}
            {(() => {
              const totalLiquido = Number(record.vl_titulo || 0) 
                - Number(record.vl_desconto || 0) 
                - Number(record.vl_despesa || 0) 
                + Number(record.pct_juros || 0) 
                + Number(record.pct_multa || 0);
              return (
                <div className="grid grid-cols-2 md:grid-cols-10 gap-4 bg-muted/10 p-3 rounded-lg border border-border/60">
                  <div>
                    <label className={lbl}>Valor Título <span className="text-destructive">*</span></label>
                    <input 
                      type="text" 
                      className={isEditable ? inputCls + " text-right" : readonlyRightCls} 
                      key={`${record.financeiro_id || "new"}-${isEditable}`}
                      defaultValue={fmtMoney(record.vl_titulo)} 
                      readOnly={!isEditable}
                      onChange={e => {
                        const formatted = maskMoney(e.target.value);
                        e.target.value = formatted;
                        const floatVal = parseMoneyToFloat(formatted);
                        setField("vl_titulo", floatVal);
                      }} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor Desc.</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(record.vl_desconto)} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor Despesas</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(record.vl_despesa)} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor Juros</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(record.pct_juros)} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor Multa</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(record.pct_multa)} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Total Líquido</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(totalLiquido)} 
                    />
                  </div>
                  <div>
                    <DataBaixaField 
                      financeiroId={record.financeiro_id} 
                      labelClass={lbl} 
                      inputClass={readonlyLeftCls} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor Pago</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(record.vl_pago)} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Valor a Pagar</label>
                    <input 
                      type="text" 
                      readOnly 
                      className={readonlyRightCls} 
                      value={fmtMoney(totalLiquido - Number(record.vl_pago || 0))} 
                    />
                  </div>
                  <div>
                    <label className={lbl}>Status</label>
                    {(() => {
                      const label = getStatusLabel(record);
                      let colorClass = "text-zinc-950 dark:text-zinc-50"; // default
                      if (label === "PAGTO PARCIAL") {
                        colorClass = "text-[#0033ff] dark:text-[#4d88ff]";
                      } else if (label === "BAIXADO") {
                        colorClass = "text-emerald-600 dark:text-emerald-400";
                      } else if (label === "CANCELADO") {
                        colorClass = "text-zinc-400 dark:text-zinc-500";
                      } else if (label === "VENCIDO") {
                        colorClass = "text-red-600 dark:text-red-400";
                      }
                      return (
                        <div className={`h-[34px] flex items-center font-bold text-base ${colorClass}`}>
                          {label}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}
            {record.financeiro_id ? (
              <FinanceiroBaixasGrid
                financeiroId={record.financeiro_id}
                empresaId={record.empresa_id || XEmpresaId || 0}
              />
            ) : null}
          </div>
        );
      }}
    />
    <ClienteSearchDialog
      open={XSearchOpen}
      onClose={() => setXSearchOpen(false)}
      empresaId={XEmpresaId || 0}
      onSelect={(c) => {
        if (XSearchTarget) XSearchTarget(c);
        setXSearchOpen(false);
      }}
    />
    </>
  );
};

export default GerarContasReceberForm;
