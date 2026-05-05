import React, { useEffect, useState, useCallback } from "react";
import { Save, X, RefreshCw, Trash2, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import FormDateField from "@/components/shared/FormDateField";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

interface IProps {
  empresa_id: number;
  financeiro_id: string;
}

interface ITpDoc { tp_documento_id: string; descricao: string; }
interface IPortador { portador_id: number; nome: string; }
interface IPlano { plano_id: number; nome: string; }
// uses plano_conta table: PLANO_CONTA_ID maps to plano_id field of financeiro
interface IConta { conta_id: string; nome_conta: string; }
interface IMeioPag { meio_pagamento_id: number; descricao: string; }
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

const STATUS_OPTS = [
  { v: "A", l: "EM ABERTO" },
  { v: "B", l: "BAIXADO" },
  { v: "C", l: "CANCELADO" },
];
const SITUACAO_OPTS = ["A VENCER", "PAGTO PARCIAL", "VENCIDO", "BAIXADO", "CANCELADO"];
const TP_CONTA_OPTS = [{ v: "R", l: "A RECEBER" }, { v: "P", l: "A PAGAR" }];

const fmtMoney = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isoToBR = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const brToIso = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);

const ContaReceberDetalheForm: React.FC<IProps> = ({ empresa_id, financeiro_id }) => {
  const { closeTab, XTabs, XActiveTabId } = useAppContext();
  const [XLoading, setXLoading] = useState(false);
  const [XSaving, setXSaving] = useState(false);
  const [XEditMode, setXEditMode] = useState(false);
  const [XRec, setXRec] = useState<any>(null);
  const [XEmpresaNome, setXEmpresaNome] = useState("");
  const [XClienteNome, setXClienteNome] = useState("");
  const [XTpDocs, setXTpDocs] = useState<ITpDoc[]>([]);
  const [XPortadores, setXPortadores] = useState<IPortador[]>([]);
  const [XPlanos, setXPlanos] = useState<IPlano[]>([]);
  const [XContas, setXContas] = useState<IConta[]>([]);
  const [XMeios, setXMeios] = useState<IMeioPag[]>([]);

  // editable fields
  const [XStatus, setXStatus] = useState("A");
  const [XDtVencto, setXDtVencto] = useState("");
  const [XTpDocId, setXTpDocId] = useState("");
  const [XPortadorId, setXPortadorId] = useState("");
  const [XPlanoId, setXPlanoId] = useState("");
  const [XPctJuros, setXPctJuros] = useState("0");
  const [XPctMulta, setXPctMulta] = useState("0");
  const [XAplJuros, setXAplJuros] = useState(false);
  const [XAplMulta, setXAplMulta] = useState(false);
  const [XObs, setXObs] = useState("");
  const [XVlDesconto, setXVlDesconto] = useState("0");

  // baixas
  const [XBaixas, setXBaixas] = useState<IBaixa[]>([]);
  const [XNovoDtPag, setXNovoDtPag] = useState(isoToBR(todayIso()));
  const [XNovoVlPago, setXNovoVlPago] = useState("0");
  const [XNovoRecibo, setXNovoRecibo] = useState("");
  const [XNovoContaId, setXNovoContaId] = useState("");
  const [XNovoTipoPag, setXNovoTipoPag] = useState("");
  const [XNovoObs, setXNovoObs] = useState("");
  const [XSavingBaixa, setXSavingBaixa] = useState(false);

  const loadBaixas = useCallback(async () => {
    const { data } = await supabase
      .from("financeiro_baixa")
      .select("financeiro_baixa_id, documento, dt_pagamento, vl_pago, recibo, conta_id, tipo_pag_rec_id, observacao")
      .eq("empresa_id", empresa_id)
      .eq("financeiro_id", financeiro_id)
      .order("financeiro_baixa_id");
    setXBaixas((data ?? []) as any);
  }, [empresa_id, financeiro_id]);

  const load = useCallback(async () => {
    setXLoading(true);
    try {
      const { data, error } = await supabase
        .from("financeiro_view")
        .select("*")
        .eq("empresa_id", empresa_id)
        .eq("financeiro_id", financeiro_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error("Título não encontrado"); return; }
      setXRec(data);

      const [emp, cad] = await Promise.all([
        supabase.from("empresa").select("razao_social").eq("empresa_id", data.empresa_id).maybeSingle(),
        data.cadastro_id ? supabase.from("cadastro").select("razao_social").eq("cadastro_id", data.cadastro_id).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      setXEmpresaNome(emp.data?.razao_social ?? "");
      setXClienteNome(cad.data?.razao_social ?? "");

      setXStatus(data.status ?? "A");
      setXDtVencto(isoToBR(data.dt_vencto));
      setXTpDocId(data.tp_documento_id ?? "");
      setXPortadorId(data.portador_id?.toString() ?? "");
      setXPlanoId(data.plano_id?.toString() ?? "");
      setXPctJuros(String(data.pct_juros ?? 0));
      setXPctMulta(String(data.pct_multa ?? 0));
      setXAplJuros((data.aplica_juros ?? "N") === "S");
      setXAplMulta((data.aplica_multa ?? "N") === "S");
      setXObs(data.observacao1 ?? "");
      setXVlDesconto(String(data.vl_desconto ?? 0));

      // sugestão valor a pagar restante
      setXNovoVlPago(String(Number(data.vl_a_pagar ?? 0).toFixed(2)));

      await loadBaixas();
    } catch (e: any) {
      console.error(e); toast.error("Erro ao carregar título");
    } finally { setXLoading(false); }
  }, [empresa_id, financeiro_id, loadBaixas]);

  useEffect(() => {
    (async () => {
      const sb: any = supabase;
      const [td, po, pl, ct, mp] = await Promise.all([
        sb.from("tp_documento").select("tp_documento_id, descricao").order("descricao").then((r: any) => r).catch(() => ({ data: [] })),
        supabase.from("portador").select("portador_id, nome").order("nome"),
        sb.from("plano_conta").select("plano_conta_id, nome, tp_conta, tp_natureza").eq("tp_conta", "A").eq("tp_natureza", "C").order("nome").then((r: any) => r).catch(() => ({ data: [] })),
        supabase.from("conta").select("conta_id, nome_conta, empresa_id").eq("empresa_id", empresa_id).order("nome_conta"),
        supabase.from("meio_pagamento").select("meio_pagamento_id, descricao").order("descricao"),
      ]);
      setXTpDocs((td.data ?? []) as any);
      setXPortadores((po.data ?? []) as any);
      setXPlanos((pl.data ?? []) as any);
      setXContas((ct.data ?? []) as any);
      setXMeios((mp.data ?? []) as any);
    })();
    load();
  }, [load, empresa_id]);

  const handleSalvar = async () => {
    const isoVenc = brToIso(XDtVencto);
    if (!isoVenc) { toast.error("Data de vencimento inválida"); return; }
    setXSaving(true);
    try {
      const { error } = await supabase
        .from("financeiro")
        .update({
          dt_vencto: isoVenc,
          tp_documento_id: XTpDocId || null,
          portador_id: XPortadorId ? Number(XPortadorId) : null,
          plano_id: XPlanoId ? Number(XPlanoId) : null,
          pct_juros: Number(XPctJuros) || 0,
          pct_multa: Number(XPctMulta) || 0,
          aplica_juros: XAplJuros ? "S" : "N",
          aplica_multa: XAplMulta ? "S" : "N",
          observacao1: XObs,
          vl_desconto: Number(XVlDesconto) || 0,
          status: XStatus,
        })
        .eq("empresa_id", empresa_id)
        .eq("financeiro_id", financeiro_id);
      if (error) throw error;
      toast.success("Título atualizado");
      setXEditMode(false);
      await load();
    } catch (e: any) {
      console.error(e); toast.error("Erro ao salvar: " + (e.message ?? ""));
    } finally { setXSaving(false); }
  };

  const handleExcluirTitulo = async () => {
    if (!confirm("Confirma a exclusão deste título? Todas as baixas também serão excluídas.")) return;
    try {
      // exclui baixas primeiro
      await supabase.from("financeiro_baixa")
        .delete().eq("empresa_id", empresa_id).eq("financeiro_id", financeiro_id);
      const { error } = await supabase.from("financeiro")
        .delete().eq("empresa_id", empresa_id).eq("financeiro_id", financeiro_id);
      if (error) throw error;
      toast.success("Título excluído");
      handleSair();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e.message ?? ""));
    }
  };

  const recalcFinanceiroFromBaixas = async () => {
    // Soma todas as baixas e atualiza vl_pago no financeiro. Se >= vl_titulo => status B.
    const { data: bxs } = await supabase
      .from("financeiro_baixa")
      .select("vl_pago")
      .eq("empresa_id", empresa_id)
      .eq("financeiro_id", financeiro_id);
    const total = (bxs ?? []).reduce((s: number, b: any) => s + Number(b.vl_pago || 0), 0);
    const vlTit = Number(XRec?.vl_titulo ?? 0);
    const novoStatus = total > 0 && total >= vlTit - 0.0001 ? "B" : XRec?.status ?? "A";
    await supabase.from("financeiro")
      .update({ vl_pago: total, status: novoStatus })
      .eq("empresa_id", empresa_id)
      .eq("financeiro_id", financeiro_id);
  };

  const handleAddBaixa = async () => {
    const isoPag = brToIso(XNovoDtPag);
    if (!isoPag) { toast.error("Data de pagamento inválida"); return; }
    const valor = Number(XNovoVlPago);
    if (!valor || valor <= 0) { toast.error("Valor pago inválido"); return; }
    setXSavingBaixa(true);
    try {
      // gera próximo id
      const { data: maxRow } = await supabase
        .from("financeiro_baixa")
        .select("financeiro_baixa_id")
        .order("financeiro_baixa_id", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextId = ((maxRow?.financeiro_baixa_id as number) ?? 0) + 1;
      // próximo número de documento da baixa para esse título
      const proxDoc = String((XBaixas.length ?? 0) + 1).padStart(4, "0");

      const { error } = await supabase.from("financeiro_baixa").insert({
        financeiro_baixa_id: nextId,
        empresa_id,
        financeiro_id,
        documento: proxDoc,
        dt_pagamento: isoPag,
        vl_pago: valor,
        recibo: XNovoRecibo || null,
        conta_id: XNovoContaId || null,
        tipo_pag_rec_id: XNovoTipoPag ? Number(XNovoTipoPag) : null,
        observacao: XNovoObs || null,
        plano_id: XPlanoId ? Number(XPlanoId) : null,
        tp_conta: XRec?.tp_conta ?? "R",
        cadastro_id: XRec?.cadastro_id ?? null,
      });
      if (error) throw error;
      await recalcFinanceiroFromBaixas();
      toast.success("Baixa registrada");
      // reset
      setXNovoRecibo(""); setXNovoObs(""); setXNovoTipoPag(""); setXNovoContaId("");
      await load();
    } catch (e: any) {
      console.error(e); toast.error("Erro ao gravar baixa: " + (e.message ?? ""));
    } finally { setXSavingBaixa(false); }
  };

  const handleDelBaixa = async (b: IBaixa) => {
    if (!confirm("Excluir esta baixa?")) return;
    try {
      const { error } = await supabase.from("financeiro_baixa")
        .delete().eq("financeiro_baixa_id", b.financeiro_baixa_id);
      if (error) throw error;
      await recalcFinanceiroFromBaixas();
      toast.success("Baixa excluída");
      await load();
    } catch (e: any) {
      toast.error("Erro ao excluir baixa: " + (e.message ?? ""));
    }
  };

  const handleSair = () => {
    const t = XTabs.find(t => t.id === XActiveTabId);
    if (t) closeTab(t.id);
  };

  if (XLoading || !XRec) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  const ro = !XEditMode;

  const InputRO = ({ label, value, className = "" }: { label: string; value: any; className?: string }) => (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input readOnly value={value ?? ""} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary" />
    </div>
  );

  const Money = ({ label, value, className = "" }: { label: string; value: any; className?: string }) => (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      <input readOnly value={fmtMoney(value)} className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary text-right" />
    </div>
  );

  const contaName = (id: string | null) => XContas.find(c => c.conta_id === id)?.nome_conta ?? id ?? "";
  const meioName = (id: number | null) => XMeios.find(m => m.meio_pagamento_id === id)?.descricao ?? "";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        {!XEditMode ? (
          <button
            onClick={() => setXEditMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            <Pencil size={14} /> Editar
          </button>
        ) : (
          <button
            onClick={handleSalvar}
            disabled={XSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save size={14} /> Salvar
          </button>
        )}
        <button
          onClick={handleExcluirTitulo}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-destructive text-destructive hover:bg-destructive/10"
        >
          <Trash2 size={14} /> Excluir Título
        </button>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
        >
          <RefreshCw size={14} className={XLoading ? "animate-spin" : ""} /> Atualizar
        </button>
        <div className="flex-1" />
        <button
          onClick={handleSair}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent"
        >
          <X size={14} /> Sair
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-card space-y-4">
        <h2 className="text-base font-semibold">Conta a Receber - Documento {XRec.documento}/{XRec.parcela}</h2>

        {/* Linha 1 */}
        <div className="grid grid-cols-12 gap-3">
          <InputRO label="Empresa" value={XEmpresaNome} className="col-span-5" />
          <InputRO label="Documento" value={XRec.documento} className="col-span-2" />
          <InputRO label="Parcela" value={XRec.parcela} className="col-span-1" />
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Status</label>
            <select disabled={ro} value={XStatus} onChange={e => setXStatus(e.target.value)}
              className={`w-full border border-border rounded px-2 py-1.5 text-sm ${ro ? "bg-secondary" : "bg-card"}`}>
              {STATUS_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Situação</label>
            <select disabled value={XRec.situacao ?? ""}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-secondary">
              <option value="">{XRec.situacao ?? ""}</option>
              {SITUACAO_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Tipo de Conta</label>
            <select disabled value={XRec.tp_conta ?? "R"}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-secondary">
              {TP_CONTA_OPTS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
          <InputRO label="Cliente" value={`${XRec.cadastro_id ?? ""} - ${XClienteNome}`} className="col-span-6" />
          <InputRO label="Data Emissão" value={isoToBR(XRec.dt_emissao)} className="col-span-2" />
          {ro ? (
            <InputRO label="Vencimento" value={XDtVencto} className="col-span-2" />
          ) : (
            <FormDateField label="Vencimento" value={XDtVencto} onChange={setXDtVencto} className="col-span-2" />
          )}
        </div>

        {/* Linha 3 */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Tp. Documento</label>
            <select disabled={ro} value={XTpDocId} onChange={e => setXTpDocId(e.target.value)}
              className={`w-full border border-border rounded px-2 py-1.5 text-sm ${ro ? "bg-secondary" : "bg-card"}`}>
              <option value="">-- Selecione --</option>
              {XTpDocs.map(t => <option key={t.tp_documento_id} value={t.tp_documento_id}>{t.descricao}</option>)}
            </select>
          </div>
          <div className="col-span-3 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Portador</label>
            <select disabled={ro} value={XPortadorId} onChange={e => setXPortadorId(e.target.value)}
              className={`w-full border border-border rounded px-2 py-1.5 text-sm ${ro ? "bg-secondary" : "bg-card"}`}>
              <option value="">-- Selecione --</option>
              {XPortadores.map(p => <option key={p.portador_id} value={p.portador_id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="col-span-4 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Plano de Contas</label>
            <select disabled={ro} value={XPlanoId} onChange={e => setXPlanoId(e.target.value)}
              className={`w-full border border-border rounded px-2 py-1.5 text-sm ${ro ? "bg-secondary" : "bg-card"}`}>
              <option value="">-- Selecione --</option>
              {XPlanos.map(p => <option key={p.plano_id} value={p.plano_id}>{p.nome}</option>)}
            </select>
          </div>
          <InputRO label="Dias Atraso" value={XRec.dias_atraso ?? 0} className="col-span-2" />
        </div>

        {/* Linha 4 - Juros/Multa */}
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Pct. Juros (%)</label>
            <input readOnly={ro} type="number" step="0.01" value={XPctJuros} onChange={e => setXPctJuros(e.target.value)}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${ro ? "bg-secondary" : "bg-card"}`} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Pct. Multa (%)</label>
            <input readOnly={ro} type="number" step="0.01" value={XPctMulta} onChange={e => setXPctMulta(e.target.value)}
              className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${ro ? "bg-secondary" : "bg-card"}`} />
          </div>
          <div className="col-span-2 flex items-center gap-2 pb-2">
            <Checkbox id="aplJuros" disabled={ro} checked={XAplJuros} onCheckedChange={v => setXAplJuros(!!v)} />
            <label htmlFor="aplJuros" className="text-xs font-medium cursor-pointer">Aplicar Juros?</label>
          </div>
          <div className="col-span-2 flex items-center gap-2 pb-2">
            <Checkbox id="aplMulta" disabled={ro} checked={XAplMulta} onCheckedChange={v => setXAplMulta(!!v)} />
            <label htmlFor="aplMulta" className="text-xs font-medium cursor-pointer">Aplicar Multa?</label>
          </div>
        </div>

        {/* Observação */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">Observação</label>
          <textarea readOnly={ro} value={XObs} onChange={e => setXObs(e.target.value)} rows={2}
            className={`w-full border border-border rounded px-3 py-1.5 text-sm ${ro ? "bg-secondary" : "bg-card"}`} />
        </div>

        {/* Valores */}
        <div className="border-t border-border pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Valores</div>
          <div className="grid grid-cols-7 gap-3">
            <Money label="Valor Título" value={XRec.vl_titulo} />
            <Money label="Valor Juros" value={XRec.vl_juros} />
            <Money label="Valor Multa" value={XRec.vl_multa} />
            <Money label="Valor Despesas" value={XRec.vl_despesa} />
            <div className="space-y-1">
              <label className="block text-xs font-medium text-muted-foreground">Valor Desconto</label>
              <input readOnly={ro} type="number" step="0.01" value={XVlDesconto} onChange={e => setXVlDesconto(e.target.value)}
                className={`w-full border border-border rounded px-3 py-1.5 text-sm text-right ${ro ? "bg-secondary" : "bg-card"}`} />
            </div>
            <Money label="Valor Pago" value={XRec.vl_pago} />
            <Money label="Valor a Pagar" value={XRec.vl_a_pagar} />
          </div>
        </div>

        {/* Pagamentos */}
        <div className="border-t border-border pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Pagamentos / Baixas</div>

          {/* Linha de inclusão */}
          <div className="grid grid-cols-12 gap-2 items-end p-3 border border-border rounded bg-secondary/30 mb-3">
            <div className="col-span-1 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Documento</label>
              <input readOnly value={String((XBaixas.length ?? 0) + 1).padStart(4, "0")}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-secondary" />
            </div>
            <div className="col-span-2">
              <FormDateField label="Dt. Pagamento" value={XNovoDtPag} onChange={setXNovoDtPag} />
            </div>
            <div className="col-span-1 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Vlr. Pago</label>
              <input type="number" step="0.01" value={XNovoVlPago} onChange={e => setXNovoVlPago(e.target.value)}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card text-right" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Recibo</label>
              <input value={XNovoRecibo} onChange={e => setXNovoRecibo(e.target.value)}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" />
            </div>
            <div className="col-span-2 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Conta</label>
              <select value={XNovoContaId} onChange={e => setXNovoContaId(e.target.value)}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card">
                <option value="">--</option>
                {XContas.map(c => <option key={c.conta_id} value={c.conta_id}>{c.nome_conta}</option>)}
              </select>
            </div>
            <div className="col-span-2 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Tipo Pagto</label>
              <select value={XNovoTipoPag} onChange={e => setXNovoTipoPag(e.target.value)}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card">
                <option value="">--</option>
                {XMeios.map(m => <option key={m.meio_pagamento_id} value={m.meio_pagamento_id}>{m.descricao}</option>)}
              </select>
            </div>
            <div className="col-span-1 space-y-1">
              <label className="block text-[10px] font-medium text-muted-foreground">Obs.</label>
              <input value={XNovoObs} onChange={e => setXNovoObs(e.target.value)}
                className="w-full border border-border rounded px-2 py-1.5 text-xs bg-card" />
            </div>
            <div className="col-span-1">
              <button
                onClick={handleAddBaixa}
                disabled={XSavingBaixa}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={12} /> Inserir
              </button>
            </div>
          </div>

          {/* Tabela de baixas */}
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Documento</th>
                  <th className="px-2 py-1.5 text-left font-medium">Dt. Pagamento</th>
                  <th className="px-2 py-1.5 text-right font-medium">Vlr. Pago</th>
                  <th className="px-2 py-1.5 text-left font-medium">Recibo</th>
                  <th className="px-2 py-1.5 text-left font-medium">Conta</th>
                  <th className="px-2 py-1.5 text-left font-medium">Tipo Pagto</th>
                  <th className="px-2 py-1.5 text-left font-medium">Observação</th>
                  <th className="px-2 py-1.5 text-center font-medium w-10">-</th>
                </tr>
              </thead>
              <tbody>
                {XBaixas.length === 0 && (
                  <tr><td colSpan={8} className="px-2 py-3 text-center text-muted-foreground">Nenhum pagamento registrado</td></tr>
                )}
                {XBaixas.map(b => (
                  <tr key={b.financeiro_baixa_id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-2 py-1.5">{b.documento}</td>
                    <td className="px-2 py-1.5">{isoToBR(b.dt_pagamento)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtMoney(b.vl_pago)}</td>
                    <td className="px-2 py-1.5">{b.recibo}</td>
                    <td className="px-2 py-1.5">{contaName(b.conta_id)}</td>
                    <td className="px-2 py-1.5">{meioName(b.tipo_pag_rec_id)}</td>
                    <td className="px-2 py-1.5">{b.observacao}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => handleDelBaixa(b)}
                        className="text-destructive hover:opacity-70" title="Excluir baixa">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContaReceberDetalheForm;
