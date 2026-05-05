import React, { useEffect, useMemo, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import FormDateField from "@/components/shared/FormDateField";
import { toast } from "sonner";

interface IOpt { id: number; label: string; }

const INTERVALOS = [
  { label: "Semanal (7 dias)", dias: 7 },
  { label: "Quinzenal (15 dias)", dias: 15 },
  { label: "Mensal (30 dias)", dias: 30 },
  { label: "Trimestral (90 dias)", dias: 90 },
  { label: "Semestral (180 dias)", dias: 180 },
];

// DD/MM/YYYY -> Date
const parseBR = (v: string): Date | null => {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return isNaN(d.getTime()) ? null : d;
};
const todayBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const GerarContasReceberForm: React.FC = () => {
  const { XEmpresaId, XEmpresas } = useAppContext();

  const [XEmpresas2, setXEmpresas2] = useState<IOpt[]>([]);
  const [XClientes, setXClientes] = useState<IOpt[]>([]);
  const [XTipoDocs, setXTipoDocs] = useState<IOpt[]>([]);
  const [XPortadores, setXPortadores] = useState<IOpt[]>([]);
  const [XPlanos, setXPlanos] = useState<IOpt[]>([]);

  const [XForm, setXForm] = useState({
    empresa_id: XEmpresaId ? String(XEmpresaId) : "",
    documento: "",
    pedido: "",
    tp_conta: "R",
    dt_emissao: todayBR(),
    cadastro_id: "",
    tp_documento_id: "",
    portador_id: "",
    plano_id: "",
    observacao: "",
    vl_titulo: "",
    nr_parcelas: "1",
    vl_desconto: "",
    vl_despesa: "",
    pct_juros: "",
    pct_multa: "",
    primeiro_vencto: todayBR(),
    intervalo_dias: "30",
    tp_vencimento: "I", // I = Intervalo, D = Dia fixo do mês
    dia_fixo: "30",
  });
  const [XSaving, setXSaving] = useState(false);

  const setF = (k: string, v: string) => setXForm(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      // Empresas (usar contexto se disponível, senão buscar)
      if (XEmpresas?.length) {
        setXEmpresas2(XEmpresas.map(e => ({ id: e.empresa_id, label: e.razao_social })));
      } else {
        const { data } = await supabase.from("empresa").select("empresa_id, razao_social").order("razao_social");
        setXEmpresas2((data ?? []).map((e: any) => ({ id: e.empresa_id, label: e.razao_social })));
      }

      const [{ data: cli }, { data: mp }, { data: po }, { data: pl }] = await Promise.all([
        supabase.from("cadastro").select("cadastro_id, nome_fantasia, tipo_cadastro").in("tipo_cadastro", ["C", "A"]).order("cadastro_id"),
        supabase.from("meio_pagamento").select("meio_pagamento_id, descricao").order("descricao"),
        supabase.from("portador").select("portador_id, nome").order("nome"),
        supabase.from("plano_conta").select("plano_conta_id, nome, tp_conta, tp_natureza").eq("tp_conta", "A").eq("tp_natureza", "C").order("nome"),
      ]);
      setXClientes((cli ?? []).map((c: any) => ({ id: c.cadastro_id, label: `${c.cadastro_id} - ${c.nome_fantasia ?? ""}` })));
      setXTipoDocs((mp ?? []).map((m: any) => ({ id: m.meio_pagamento_id, label: m.descricao })));
      setXPortadores((po ?? []).map((p: any) => ({ id: p.portador_id, label: p.nome })));
      setXPlanos((pl ?? []).map((p: any) => ({ id: p.plano_conta_id, label: p.nome })));
    })();
  }, [XEmpresas]);

  const vlTitulo = parseFloat(XForm.vl_titulo.replace(",", ".")) || 0;
  const nrParc = Math.max(1, parseInt(XForm.nr_parcelas) || 1);
  const vlParcela = useMemo(() => (vlTitulo > 0 && nrParc > 0 ? vlTitulo / nrParc : 0), [vlTitulo, nrParc]);

  const handleGerar = async () => {
    // Validações
    if (!XForm.empresa_id) return toast.error("Selecione a Empresa");
    if (!XForm.documento.trim()) return toast.error("Informe o Documento");
    if (!XForm.cadastro_id) return toast.error("Selecione o Cliente");
    if (!XForm.plano_id) return toast.error("Selecione o Plano de Contas");
    if (vlTitulo <= 0) return toast.error("Informe o Valor do Título");
    const dtEmis = parseBR(XForm.dt_emissao);
    const dtVenc1 = parseBR(XForm.primeiro_vencto);
    if (!dtEmis) return toast.error("Data de Emissão inválida");
    if (!dtVenc1) return toast.error("Primeiro Vencimento inválido");
    const intDias = parseInt(XForm.intervalo_dias) || 30;
    const empId = parseInt(XForm.empresa_id);

    setXSaving(true);
    try {
      // Buscar próximo financeiro_id (numérico) para esta empresa
      const { data: maxRow } = await supabase
        .from("financeiro")
        .select("financeiro_id")
        .eq("empresa_id", empId)
        .order("financeiro_id", { ascending: false })
        .limit(1);
      let nextId = 1;
      if (maxRow && maxRow.length > 0) {
        const cur = String(maxRow[0].financeiro_id);
        const n = parseInt(cur);
        nextId = isNaN(n) ? Date.now() : n + 1;
      }

      const rows: any[] = [];
      const diaFixo = Math.min(31, Math.max(1, parseInt(XForm.dia_fixo) || 1));
      for (let i = 1; i <= nrParc; i++) {
        let dtVencto: Date;
        if (XForm.tp_vencimento === "D") {
          // Dia fixo: parcela 1 = primeiro_vencto; demais = dia fixo nos meses subsequentes
          if (i === 1) {
            dtVencto = new Date(dtVenc1);
          } else {
            const base = new Date(dtVenc1.getFullYear(), dtVenc1.getMonth() + (i - 1), 1);
            const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
            dtVencto = new Date(base.getFullYear(), base.getMonth(), Math.min(diaFixo, ultimoDia));
          }
        } else {
          dtVencto = new Date(dtVenc1);
          dtVencto.setDate(dtVencto.getDate() + (i - 1) * intDias);
        }
        const docParcela = nrParc === 1 ? XForm.documento : `${XForm.documento}/${String(i).padStart(2, "0")}`;
        const vlParc = nrParc === 1 ? vlTitulo : Number((vlTitulo / nrParc).toFixed(2));


        rows.push({
          empresa_id: empId,
          financeiro_id: String(nextId + i - 1),
          movimento_id: parseInt(XForm.pedido) || 0,
          documento: docParcela,
          parcela: i,
          tp_documento_id: XForm.tp_documento_id || "",
          tp_conta: "R",
          dt_emissao: toIsoDate(dtEmis),
          dt_vencto: toIsoDate(dtVencto),
          portador_id: XForm.portador_id ? parseInt(XForm.portador_id) : 0,
          cadastro_id: parseInt(XForm.cadastro_id),
          observacao1: XForm.observacao || "",
          vl_titulo: vlParc,
          plano_id: parseInt(XForm.plano_id),
          ativo: "S",
          pct_juros: parseFloat(XForm.pct_juros.replace(",", ".")) || 0,
          pct_multa: parseFloat(XForm.pct_multa.replace(",", ".")) || 0,
          status: "A",
          vl_desconto: parseFloat(XForm.vl_desconto.replace(",", ".")) || 0,
          vl_despesa: parseFloat(XForm.vl_despesa.replace(",", ".")) || 0,
        });
      }

      const { error } = await supabase.from("financeiro").insert(rows);
      if (error) {
        console.error(error);
        toast.error("Falha ao gerar parcelas: " + error.message);
        return;
      }
      toast.success(`${nrParc} parcela(s) gerada(s) com sucesso`);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro: " + (e?.message || "desconhecido"));
    } finally {
      setXSaving(false);
    }
  };

  const inputCls = "w-full border border-border rounded px-2 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none";
  const lbl = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="p-3 h-full overflow-auto">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Gerar Contas a Receber</h2>
        <button
          onClick={handleGerar}
          disabled={XSaving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {XSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Gerar Contas a Receber
        </button>
      </div>

      <div className="border border-border rounded-md p-3 bg-card space-y-3">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Empresa</label>
            <select className={inputCls} value={XForm.empresa_id} onChange={e => setF("empresa_id", e.target.value)}>
              <option value="">Selecione...</option>
              {XEmpresas2.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Documento</label>
            <input className={inputCls} value={XForm.documento} onChange={e => setF("documento", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Pedido</label>
            <input type="number" className={inputCls} value={XForm.pedido} onChange={e => setF("pedido", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Tipo de Conta</label>
            <select className={inputCls} value={XForm.tp_conta} disabled>
              <option value="R">A RECEBER</option>
              <option value="P">A PAGAR</option>
            </select>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormDateField label="Data Emissão" value={XForm.dt_emissao} onChange={v => setF("dt_emissao", v)} />
          <div>
            <label className={lbl}>Cliente</label>
            <select className={inputCls} value={XForm.cadastro_id} onChange={e => setF("cadastro_id", e.target.value)}>
              <option value="">Selecione...</option>
              {XClientes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo de Documento</label>
            <select className={inputCls} value={XForm.tp_documento_id} onChange={e => setF("tp_documento_id", e.target.value)}>
              <option value="">Selecione...</option>
              {XTipoDocs.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Portador</label>
            <select className={inputCls} value={XForm.portador_id} onChange={e => setF("portador_id", e.target.value)}>
              <option value="">Selecione...</option>
              {XPortadores.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={lbl}>Plano de Contas</label>
            <select className={inputCls} value={XForm.plano_id} onChange={e => setF("plano_id", e.target.value)}>
              <option value="">Selecione...</option>
              {XPlanos.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Observação</label>
            <input className={inputCls} value={XForm.observacao} onChange={e => setF("observacao", e.target.value)} />
          </div>
        </div>

        {/* Linha 4 - valores */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className={lbl}>Valor Título</label>
            <input type="number" step="0.01" className={inputCls} value={XForm.vl_titulo} onChange={e => setF("vl_titulo", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Nº Parcelas</label>
            <input type="number" min="1" className={inputCls} value={XForm.nr_parcelas} onChange={e => setF("nr_parcelas", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Valor Parcela</label>
            <input
              readOnly
              className={inputCls + " bg-secondary"}
              value={vlParcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            />
          </div>
          <div>
            <label className={lbl}>Vlr. Desconto</label>
            <input type="number" step="0.01" className={inputCls} value={XForm.vl_desconto} onChange={e => setF("vl_desconto", e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Vlr. Despesa</label>
            <input type="number" step="0.01" className={inputCls} value={XForm.vl_despesa} onChange={e => setF("vl_despesa", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Pct. Juros (%)</label>
              <input type="number" step="0.01" className={inputCls} value={XForm.pct_juros} onChange={e => setF("pct_juros", e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Pct. Multa (%)</label>
              <input type="number" step="0.01" className={inputCls} value={XForm.pct_multa} onChange={e => setF("pct_multa", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Linha 5 - vencimento */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FormDateField label="Primeiro Vencimento" value={XForm.primeiro_vencto} onChange={v => setF("primeiro_vencto", v)} />
          <div>
            <label className={lbl}>Tipo Vencimento</label>
            <select className={inputCls} value={XForm.tp_vencimento} onChange={e => setF("tp_vencimento", e.target.value)}>
              <option value="I">Por Intervalo</option>
              <option value="D">Dia Fixo do Mês</option>
            </select>
          </div>
          {XForm.tp_vencimento === "I" ? (
            <div className="md:col-span-2">
              <label className={lbl}>Intervalo</label>
              <select className={inputCls} value={XForm.intervalo_dias} onChange={e => setF("intervalo_dias", e.target.value)}>
                {INTERVALOS.map(i => <option key={i.dias} value={i.dias}>{i.label}</option>)}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className={lbl}>Dia do Mês (1-31)</label>
              <input
                type="number" min="1" max="31"
                className={inputCls}
                value={XForm.dia_fixo}
                onChange={e => setF("dia_fixo", e.target.value)}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default GerarContasReceberForm;
