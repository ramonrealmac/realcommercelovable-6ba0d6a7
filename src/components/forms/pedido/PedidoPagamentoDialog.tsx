import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { useAppContext } from "@/contexts/AppContext";
import { CreditCard, ShoppingCart, Wallet, ArrowRightLeft, Calculator, X, Delete, Trash2, Check, Percent } from "lucide-react";

const db = supabase as any;

const fmt = (v: number) => (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NO_SPIN = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const parseNum = (v: any) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmtInput = (v: any) => {
  const n = typeof v === "number" ? v : parseNum(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

interface ICondicao { condicao_id: number; descricao: string; qtd_parcelas: number | null; tp_documento?: number | null; plano_conta_id?: number | null; meio_pagamento_id?: number | null; }

interface IProps {
  open: boolean;
  movimentoId: number;
  subtotalPedido: number; // vl_movimento + vl_desconto
  tpDesconto: string;
  onClose: () => void;
  onConfirmar: (pagtos: any[], vlDesconto: number, pcDesconto: number) => Promise<void>;
}

const PedidoPagamentoDialog: React.FC<IProps> = ({ open, movimentoId, subtotalPedido, tpDesconto, onClose, onConfirmar }) => {
  const { XEmpresaId } = useAppContext();
  const [XCondicoes, setXCondicoes] = useState<ICondicao[]>([]);
  const [XLinhas, setXLinhas] = useState<any[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSalvando, setXSalvando] = useState(false);

  // Discount states
  // Database totals
  const [XDbTotals, setXDbTotals] = useState({ subtotal: 0, desconto: 0, total: 0 });
  const [XVlDesconto, setXVlDesconto] = useState<number>(0);
  const [XPcDesconto, setXPcDesconto] = useState<number>(0);

  // Form fields
  const [XCondicaoId, setXCondicaoId] = useState<number>(0);
  const [XVlPagar, setXVlPagar] = useState<string>("0,00");
  const [XQtParcela, setXQtParcela] = useState<number>(1);
  const [XEditUid, setXEditUid] = useState<string | null>(null);

  // Calculator State
  const [XCalcDisplay, setXCalcDisplay] = useState("0");
  const [XCalcReset, setXCalcReset] = useState(false);

  const condicaoRef = useRef<HTMLSelectElement>(null);
  const finalizarRef = useRef<HTMLButtonElement>(null);

  const subtotalEfetivo = XDbTotals.subtotal > 0 ? XDbTotals.subtotal : subtotalPedido;
  const totalPedido = useMemo(() => Number((subtotalEfetivo - XVlDesconto).toFixed(2)), [subtotalEfetivo, XVlDesconto]);
  const totalPago = useMemo(() => Number(XLinhas.reduce((a, l) => a + Number(l.vl_pagamento || 0), 0).toFixed(2)), [XLinhas]);
  const valorRestante = Number(Math.max(0, totalPedido - totalPago).toFixed(2));
  
  const vlPagarNum = useMemo(() => parseNum(XVlPagar), [XVlPagar]);
  const vlParcela = XQtParcela > 0 ? +(vlPagarNum / XQtParcela).toFixed(2) : vlPagarNum;

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Fetch current movement for totals
        const { data: mov } = await db.from("movimento")
          .select("vl_desconto, pc_desconto, vl_movimento, vl_produto")
          .eq("movimento_id", movimentoId).single();
        
        if (mov) {
          const dbVlDesc = Number(mov.vl_desconto || 0);
          const dbPcDesc = Number(mov.pc_desconto || 0);
          const dbMov = Number(mov.vl_movimento || 0);
          const dbSub = dbMov + dbVlDesc;
          
          setXDbTotals({ subtotal: dbSub, desconto: dbVlDesc, total: dbMov });
          setXVlDesconto(dbVlDesc);
          setXPcDesconto(dbPcDesc);
          resetForm(dbMov);
        }

        // Delete existing payments
        await db.from("movimento_pagamento").update({ excluido: true }).eq("movimento_id", movimentoId);

        // Fetch Conditions
        const { data: condData } = await db.from("condicao_pagamento").select("condicao_id, descricao, qtd_parcelas, plano_conta_id, meio_pagamento_id").eq("excluido", false).order("descricao");
        setXCondicoes(condData || []);
      } catch (err: any) {
        toast.error("Erro ao carregar dados: " + err.message);
      }
    })();
    setXLinhas([]);
    setXSelectedIdx(null);
    resetForm(totalPedido);
  }, [open, movimentoId, totalPedido]);

  const resetForm = (vl: number) => {
    setXCondicaoId(0); setXVlPagar(fmtInput(vl)); setXQtParcela(1); setXEditUid(null);
  };

  const handleVlDesconto = (val: string) => {
    const v = parseNum(val);
    setXVlDesconto(v);
    const sub = XDbTotals.subtotal || subtotalPedido;
    const pc = sub > 0 ? +(v / sub * 100).toFixed(2) : 0;
    setXPcDesconto(pc);
  };

  const handlePcDesconto = (val: string) => {
    const p = parseNum(val);
    setXPcDesconto(p);
    const sub = XDbTotals.subtotal || subtotalPedido;
    const v = +(sub * p / 100).toFixed(2);
    setXVlDesconto(v);
  };

  const confirmarLinha = () => {
    if (!XCondicaoId) { toast.error("Selecione a condição."); return; }
    let vPagar = parseNum(XVlPagar);
    if (vPagar <= 0) { toast.error("Informe um valor maior que zero."); return; }
    
    const cond = XCondicoes.find(c => c.condicao_id === XCondicaoId);
    const novaSomada = totalPago - (XEditUid ? (XLinhas.find(l => l.uid === XEditUid)?.vl_pagamento || 0) : 0) + vPagar;
    
    if (novaSomada > totalPedido + 0.01) {
      toast.error("Valor pago não pode ultrapassar o total do pedido.");
      return;
    }

    const linha = {
      uid: XEditUid || crypto.randomUUID(),
      condicao_id: XCondicaoId,
      condicao_descricao: cond?.descricao || "",
      n_parcelas: XQtParcela,
      vl_parcelas: vlParcela,
      vl_pagamento: vPagar,
      tp_pagamento: "DI", // Default
      empresa_id: XEmpresaId,
      movimento_id: movimentoId
    };

    setXLinhas(prev => XEditUid ? prev.map(l => l.uid === XEditUid ? linha : l) : [...prev, linha]);
    setXSelectedIdx(null);
    const restante = Math.max(0, totalPedido - (totalPago + vPagar));
    resetForm(restante);
  };

  const finalizar = async () => {
    if (XLinhas.length === 0) { toast.error("Inclua ao menos um pagamento."); return; }
    if (totalPago + 0.01 < totalPedido) { toast.error("Valor pago é menor que o total do pedido."); return; }
    
    setXSalvando(true);
    try {
      await onConfirmar(XLinhas, XVlDesconto, XPcDesconto);
      onClose();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setXSalvando(false);
    }
  };

  const cols: IGridColumn[] = [
    { key: "condicao_descricao", label: "Condição", width: "1fr" },
    { key: "n_parcelas", label: "Parc.", width: "60px", align: "right" },
    { key: "vl_parcelas", label: "Vlr Parcela", width: "100px", align: "right", render: r => fmt(r.vl_parcelas) },
    { key: "vl_pagamento", label: "Valor", width: "100px", align: "right", render: r => fmt(r.vl_pagamento) },
    { key: "acoes", label: "", width: "40px", align: "center", render: (r, idx) => (
      <button onClick={() => setXLinhas(prev => prev.filter((_, i) => i !== idx))} className="text-rose-600">
        <Trash2 size={16} />
      </button>
    )},
  ];

  const handleCalcBtn = (val: string) => {
    if (val === "C") { setXCalcDisplay("0"); return; }
    if (val === "DEL") { setXCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : "0"); return; }
    if (val === ",") { if (!XCalcDisplay.includes(",")) setXCalcDisplay(prev => prev + ","); return; }
    if (XCalcDisplay === "0" || XCalcReset) { setXCalcDisplay(val); setXCalcReset(false); }
    else { setXCalcDisplay(prev => prev + val); }
  };

  const editableDesc = tpDesconto === 'P';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !XSalvando && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2">
          <CreditCard size={18} />
          <h2 className="text-sm font-semibold">Pagamento do Pedido</h2>
        </div>

        <div className="p-4 grid grid-cols-12 gap-6">
          <div className="col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-amber-200 rounded p-3 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart size={14} className="text-amber-600" />
                  <span className="text-[10px] font-bold uppercase">Subtotal</span>
                </div>
                <span className="font-bold text-lg">{fmt(subtotalEfetivo)}</span>
              </div>
              <div className="border border-rose-200 rounded p-3 bg-rose-50 dark:bg-rose-950/20">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Percent size={14} className="text-rose-600" />
                    <span className="text-[10px] font-bold uppercase">Desconto</span>
                  </div>
                  {editableDesc && (
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={XPcDesconto} 
                        onChange={e => handlePcDesconto(e.target.value)}
                        className="w-12 text-[10px] text-right border border-rose-300 rounded px-1 bg-white"
                        placeholder="%"
                      />
                      <span className="text-[10px]">%</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  {editableDesc ? (
                    <input 
                      type="text" 
                      value={fmtInput(XVlDesconto)} 
                      onChange={e => handleVlDesconto(e.target.value)}
                      className="w-full font-bold text-lg bg-transparent border-none focus:outline-none"
                    />
                  ) : (
                    <span className="font-bold text-lg">{fmt(XVlDesconto)}</span>
                  )}
                </div>
              </div>
              <div className="border border-emerald-200 rounded p-3 bg-emerald-50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-bold uppercase">Total Líquido</span>
                </div>
                <span className="font-black text-xl text-emerald-700">{fmt(totalPedido)}</span>
              </div>
              <div className="border border-blue-200 rounded p-3 bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRightLeft size={14} className="text-blue-600" />
                  <span className="text-[10px] font-bold uppercase">A Pagar</span>
                </div>
                <span className="font-black text-xl text-blue-700">{fmt(valorRestante)}</span>
              </div>
            </div>

            <div className="border border-border rounded p-3 bg-muted/20 space-y-3">
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6">
                  <label className="text-[10px] font-bold uppercase">Condição de Pagamento</label>
                  <select ref={condicaoRef} value={XCondicaoId} onChange={e => {
                    const cid = Number(e.target.value);
                    setXCondicaoId(cid);
                    const c = XCondicoes.find(x => x.condicao_id === cid);
                    if (c?.qtd_parcelas) setXQtParcela(c.qtd_parcelas);
                  }} className="w-full border border-border rounded px-2 py-1 text-sm h-9 bg-white">
                    <option value={0}>-- Selecione --</option>
                    {XCondicoes.map(c => <option key={c.condicao_id} value={c.condicao_id}>{c.descricao}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] font-bold uppercase">Valor</label>
                  <input type="text" value={XVlPagar} onChange={e => setXVlPagar(e.target.value)} onBlur={() => setXVlPagar(fmtInput(XVlPagar))} className="w-full border border-border rounded px-2 py-1 text-sm text-right h-9 font-bold bg-white" />
                </div>
                <div className="col-span-3 flex items-end">
                  <button onClick={confirmarLinha} className="w-full h-9 rounded bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600">✓ Adicionar</button>
                </div>
              </div>
            </div>

            <DataGrid columns={cols} data={XLinhas} maxHeight="200px" showRecordCount={false} showExport={false} onRowClick={(_, idx) => setXSelectedIdx(idx)} selectedIdx={XSelectedIdx} />

            <div className="flex justify-between items-center pt-2">
              <button onClick={onClose} className="text-xs px-4 py-2 border border-border rounded hover:bg-accent">Cancelar</button>
              <button ref={finalizarRef} onClick={finalizar} disabled={XSalvando || valorRestante > 0.01} className="text-xs px-8 py-2 rounded bg-primary text-primary-foreground font-bold h-10 disabled:opacity-50">
                {XSalvando ? "Gravando..." : "Finalizar Pagamento →"}
              </button>
            </div>
          </div>

          <div className="col-span-5 bg-muted/30 border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1 mb-1">
              <Calculator size={14} className="text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase">Calculadora</span>
            </div>
            <div className="bg-white border border-border rounded px-3 py-2 text-right font-mono text-2xl font-bold mb-2 shadow-inner">
              {fmtInput(XCalcDisplay)}
            </div>
            <div className="grid grid-cols-4 gap-2 flex-1">
              {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "C"].map(b => (
                <button key={b} onClick={() => handleCalcBtn(b)} className="h-12 rounded bg-card border border-border font-bold hover:bg-accent transition-colors">{b}</button>
              ))}
              <button onClick={() => handleCalcBtn("DEL")} className="h-12 rounded bg-card border border-border flex items-center justify-center hover:bg-accent text-rose-500"><Delete size={18} /></button>
              <button onClick={() => setXVlPagar(fmtInput(XCalcDisplay))} className="col-span-3 h-12 rounded bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors">Usar Valor</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PedidoPagamentoDialog;
