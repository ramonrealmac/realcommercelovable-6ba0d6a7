import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { Unlock, X, Lock } from "lucide-react";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

const db = supabase as any;

const parseNum = (v: any) => {
  if (v === undefined || v === null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);

interface ICaixaFunc {
  funcionario_id: number;
  cd_funcionario: number;
  nome: string;
}

interface IProps {
  /** funcionario_id pré-selecionado (quando chamado a partir do PDV) */
  funcionarioId?: number;
  /** data sugerida de abertura */
  dtAbertura?: string;
  /** Callback após abertura criada com sucesso. Recebe os dados da nova abertura. */
  onAberto?: (params: { caixa_abertura_id: number; funcionario_id: number; dt_abertura: string; vl_abertura: number }) => void;
  /** Cancelar */
  onCancelar?: () => void;
  /** Quando true, usa layout de dialog interno (centralizado) */
  embutido?: boolean;
}

const AberturaCaixaForm: React.FC<IProps> = ({
  funcionarioId,
  dtAbertura,
  onAberto,
  onCancelar,
  embutido = false,
}) => {
  const { XEmpresaId, openTab, closeTab, XActiveTabId } = useAppContext();
  const [XCaixas, setXCaixas] = useState<ICaixaFunc[]>([]);
  const [XCaixaSel, setXCaixaSel] = useState<number>(funcionarioId || 0);
  const [XDtAb, setXDtAb] = useState<string>(dtAbertura || hoje());
  const [XSaldoAnt, setXSaldoAnt] = useState<number>(0);
  const [XVlAbertura, setXVlAbertura] = useState<number>(0);
  const [XLoading, setXLoading] = useState(false);
  const [XSalvando, setXSalvando] = useState(false);
  const [XLoadingCaixas, setXLoadingCaixas] = useState(true);
  const [XCaixaAbertoInfo, setXCaixaAbertoInfo] = useState<{ caixa_abertura_id: number; dt_abertura: string } | null>(null);

  // Carrega lista de caixas (apenas quando não veio fixo)
  const carregarCaixas = useCallback(async () => {
    setXLoadingCaixas(true);
    const { data, error } = await db
      .from("funcionario")
      .select("funcionario_id, cd_funcionario, nome")
      .eq("empresa_id", XEmpresaId)
      .eq("caixa", "S")
      .order("nome");
    setXLoadingCaixas(false);
    if (error) {
      toast.error("Falha ao carregar caixas: " + error.message);
      return;
    }
    const lista = (data || []) as ICaixaFunc[];
    setXCaixas(lista);
    if (!XCaixaSel && lista.length === 1) setXCaixaSel(lista[0].funcionario_id);
  }, [XEmpresaId, XCaixaSel]);

  useEffect(() => {
    carregarCaixas();
  }, [carregarCaixas]);

  // Busca saldo anterior (último vl_fechamento) e verifica se já existe aberto
  const carregarSaldoAnterior = useCallback(async () => {
    if (!XCaixaSel) {
      setXSaldoAnt(0);
      setXVlAbertura(0);
      setXCaixaAbertoInfo(null);
      return;
    }
    setXLoading(true);
    try {
      // Verifica se já existe abertura ativa
      const { data: aberto } = await db
        .from("caixa_abertura")
        .select("caixa_abertura_id, dt_abertura")
        .eq("empresa_id", XEmpresaId)
        .eq("funcionario_id", XCaixaSel)
        .eq("status", "A")
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);
      if (aberto && aberto[0]) {
        setXCaixaAbertoInfo({
          caixa_abertura_id: aberto[0].caixa_abertura_id,
          dt_abertura: aberto[0].dt_abertura
        });
      } else {
        setXCaixaAbertoInfo(null);
      }

      // Pega último fechamento (status='F') anterior à data informada
      const { data: ant } = await db
        .from("caixa_abertura")
        .select("vl_fechamento, dt_abertura")
        .eq("empresa_id", XEmpresaId)
        .eq("funcionario_id", XCaixaSel)
        .eq("status", "F")
        .lte("dt_abertura", XDtAb)
        .order("dt_abertura", { ascending: false })
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);
      const saldo = Number((ant && ant[0]?.vl_fechamento) || 0);
      setXSaldoAnt(saldo);
      setXVlAbertura(saldo);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar saldo anterior.");
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId, XCaixaSel, XDtAb]);

  useEffect(() => {
    carregarSaldoAnterior();
  }, [carregarSaldoAnterior]);

  const handleCancelar = () => {
    if (onCancelar) {
      onCancelar();
    } else if (XActiveTabId) {
      closeTab(XActiveTabId);
    }
  };

  const handleFecharCaixaAberto = () => {
    if (!XCaixaAbertoInfo) return;
    openTab({
      title: "Fechamento de Caixa",
      component: "fechamento-caixa",
      params: {
        caixa_abertura_id: XCaixaAbertoInfo.caixa_abertura_id,
        dt_abertura: XCaixaAbertoInfo.dt_abertura
      }
    });
    handleCancelar();
  };

  const confirmar = async () => {
    if (!XCaixaSel) {
      toast.error("Selecione um caixa.");
      return;
    }
    if (!XDtAb) {
      toast.error("Informe a data de abertura.");
      return;
    }
    
    setXSalvando(true);
    try {
      // 1. Verificar se já existe caixa aberto para o funcionário e empresa
      const { data: caixasAbertos, error: errCheck } = await db
        .from("caixa_abertura")
        .select("caixa_abertura_id, dt_abertura")
        .eq("empresa_id", XEmpresaId)
        .eq("funcionario_id", XCaixaSel)
        .eq("status", "A")
        .order("dt_abertura", { ascending: false });

      if (errCheck) throw new Error(errCheck.message);

      if (caixasAbertos && caixasAbertos.length > 0) {
        const caixaAberto = caixasAbertos[0];
        const dtAbertoStr = caixaAberto.dt_abertura;

        if (dtAbertoStr === XDtAb) {
          toast.error(`O caixa já foi aberto para esta data (${new Date(dtAbertoStr + "T00:00:00").toLocaleDateString("pt-BR")})!`);
          setXSalvando(false);
          return;
        } else if (dtAbertoStr < XDtAb) {
          const conf = window.confirm(
            `Existe um caixa aberto com data anterior (${new Date(dtAbertoStr + "T00:00:00").toLocaleDateString("pt-BR")}). Deseja fechar este caixa agora?`
          );
          if (conf) {
            openTab({
              title: "Fechamento de Caixa",
              component: "fechamento-caixa",
              params: {
                caixa_abertura_id: caixaAberto.caixa_abertura_id,
                dt_abertura: dtAbertoStr
              }
            });
            handleCancelar();
          }
          setXSalvando(false);
          return;
        } else {
          toast.error(`Existe um caixa aberto em data futura (${new Date(dtAbertoStr + "T00:00:00").toLocaleDateString("pt-BR")}).`);
          setXSalvando(false);
          return;
        }
      }

      const { data: maxRow } = await db
        .from("caixa_abertura")
        .select("caixa_abertura_id")
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);
      const novoId = ((maxRow && maxRow[0]?.caixa_abertura_id) || 0) + 1;
      const novo = {
        caixa_abertura_id: novoId,
        empresa_id: XEmpresaId,
        funcionario_id: XCaixaSel,
        dt_abertura: XDtAb,
        vl_abertura: XVlAbertura,
        vl_fechamento: null,
        status: "A",
      };
      const { error } = await db.from("caixa_abertura").insert(novo);
      if (error) throw new Error(error.message);
      toast.success("Caixa aberto com sucesso.");
      
      if (onAberto) {
        onAberto({
          caixa_abertura_id: novoId,
          funcionario_id: XCaixaSel,
          dt_abertura: XDtAb,
          vl_abertura: XVlAbertura,
        });
      } else {
        if (XActiveTabId) {
          closeTab(XActiveTabId);
        }
        openTab({
          title: "4.2. PDV/Caixa",
          component: "pdv-caixa",
          params: {
            funcionario_id: XCaixaSel,
            dt_abertura: XDtAb,
          }
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao abrir caixa.");
    } finally {
      setXSalvando(false);
    }
  };

  const conteudo = (
    <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2 shrink-0">
        <Unlock size={18} />
        <h2 className="text-sm font-semibold">Abertura de Caixa</h2>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-xs text-muted-foreground -mt-2">
          Informe a data e o valor inicial. O saldo do caixa anterior é sugerido automaticamente.
        </p>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Caixa</label>
          <select
            value={XCaixaSel}
            onChange={(e) => setXCaixaSel(Number(e.target.value))}
            disabled={XLoadingCaixas || !!funcionarioId}
            className="w-full border border-border rounded px-2 py-2 text-sm bg-card disabled:opacity-70 focus:ring-2 focus:ring-ring outline-none"
          >
            <option value={0}>{XLoadingCaixas ? "Carregando..." : "-- Selecione --"}</option>
            {XCaixas.map((c) => (
              <option key={c.funcionario_id} value={c.funcionario_id}>
                {c.cd_funcionario ?? c.funcionario_id} - {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data de Abertura</label>
          <input
            type="date"
            value={XDtAb}
            onChange={(e) => setXDtAb(e.target.value)}
            className="w-full border border-border rounded px-2 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Saldo do Caixa Anterior</label>
            <input
              type="text"
              value={fmt(XSaldoAnt)}
              disabled
              className="w-full border border-border rounded px-2 py-2 text-sm bg-muted/30 text-right"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Valor de Abertura</label>
            <CurrencyInput
              value={XVlAbertura}
              onChange={setXVlAbertura}
              decimals={2}
              className="w-full border border-border rounded px-2 py-2 text-sm bg-card text-right focus:ring-2 focus:ring-ring outline-none"
            />
          </div>
        </div>

        {XCaixaAbertoInfo && (
          <div className="text-xs text-destructive border border-destructive/40 bg-destructive/5 rounded p-2">
            Já existe um caixa aberto para este funcionário (data {new Date(
              XCaixaAbertoInfo.dt_abertura + "T00:00:00"
            ).toLocaleDateString("pt-BR")}). Feche-o antes de abrir um novo.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {XCaixaAbertoInfo && (
            <button
              onClick={handleFecharCaixaAberto}
              className="text-sm px-4 py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 flex items-center gap-2 transition-colors mr-auto"
            >
              <Lock size={14} /> Fechar Caixa
            </button>
          )}
          <button
            onClick={handleCancelar}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent flex items-center gap-2 transition-colors"
          >
            <X size={14} className="text-rose-500" /> Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={XSalvando || XLoading || XCaixaAbertoInfo !== null}
            className="text-sm px-4 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            <Unlock size={14} />
            {XSalvando ? "Abrindo..." : "Abrir Caixa"}
          </button>
        </div>
      </div>
    </div>
  );

  if (embutido) {
    return <div className="flex justify-center p-2">{conteudo}</div>;
  }

  return (
    <div className="h-full flex items-center justify-center bg-muted/20 p-6">{conteudo}</div>
  );
};

export default AberturaCaixaForm;
