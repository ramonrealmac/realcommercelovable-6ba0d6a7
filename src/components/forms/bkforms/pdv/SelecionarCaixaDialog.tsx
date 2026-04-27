import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import type { IPdvCaixa, IPdvCaixaAbertura } from "./types";

const db = supabase as any;

interface IProps {
  /** Callback chamado quando o usuário entra no PDV (caixa aberto OK). */
  onEntrar: (params: { caixa: IPdvCaixa; abertura: IPdvCaixaAbertura; dtMovimento: string }) => void;
  /** Cancelar / sair do formulário. */
  onCancelar: () => void;
}

const fmtDateBR = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
};

const SelecionarCaixaDialog: React.FC<IProps> = ({ onEntrar, onCancelar }) => {
  const { XEmpresaId } = useAppContext();
  const [XCaixas, setXCaixas] = useState<IPdvCaixa[]>([]);
  const [XCaixaSel, setXCaixaSel] = useState<number>(0);
  const [XDtMov, setXDtMov] = useState<string>(new Date().toISOString().slice(0, 10));
  const [XLoading, setXLoading] = useState(false);
  const [XLoadingCaixas, setXLoadingCaixas] = useState(true);

  const carregarCaixas = useCallback(async () => {
    setXLoadingCaixas(true);
    const { data, error } = await db.from("funcionario")
      .select("funcionario_id, nome, tamanho_fonte_pedidos, tamanho_fonte_produtos, tempo_refresh_pdv, caixa_inf_vend, caixa_cnc_venda, caixa_edit_venda")
      .eq("empresa_id", XEmpresaId)
      .eq("caixa", "S")
      .order("nome");
    setXLoadingCaixas(false);
    if (error) { toast.error("Falha ao carregar caixas: " + error.message); return; }
    const lista = (data || []) as IPdvCaixa[];
    setXCaixas(lista);
    if (lista.length === 1) setXCaixaSel(lista[0].funcionario_id);
  }, [XEmpresaId]);

  useEffect(() => { carregarCaixas(); }, [carregarCaixas]);

  const prosseguir = async () => {
    if (!XCaixaSel) { toast.error("Selecione um caixa."); return; }
    if (!XDtMov) { toast.error("Informe a data do movimento."); return; }
    setXLoading(true);
    try {
      const caixa = XCaixas.find(c => c.funcionario_id === XCaixaSel);
      if (!caixa) { toast.error("Caixa inválido."); return; }

      // Buscar abertura ativa
      const { data: aberts, error } = await db.from("caixa_abertura")
        .select("*")
        .eq("empresa_id", XEmpresaId)
        .eq("funcionario_id", caixa.funcionario_id)
        .eq("status", "A")
        .order("caixa_abertura_id", { ascending: false })
        .limit(1);
      if (error) { toast.error(error.message); return; }

      const abertura = (aberts && aberts[0]) as IPdvCaixaAbertura | undefined;

      if (!abertura) {
        if (!confirm(`Não existe caixa aberto para "${caixa.nome}". Deseja abrir o caixa em ${fmtDateBR(XDtMov)}?`)) return;
        // Próximo id
        const { data: maxRow } = await db.from("caixa_abertura")
          .select("caixa_abertura_id").order("caixa_abertura_id", { ascending: false }).limit(1);
        const novoId = ((maxRow && maxRow[0]?.caixa_abertura_id) || 0) + 1;
        const novo: IPdvCaixaAbertura = {
          caixa_abertura_id: novoId,
          empresa_id: XEmpresaId,
          funcionario_id: caixa.funcionario_id,
          dt_abertura: XDtMov,
          vl_abertura: 0,
          vl_fechamento: null,
          status: "A",
        };
        const { error: e2 } = await db.from("caixa_abertura").insert(novo);
        if (e2) { toast.error("Falha ao abrir caixa: " + e2.message); return; }
        toast.success("Caixa aberto.");
        onEntrar({ caixa, abertura: novo, dtMovimento: XDtMov });
        return;
      }

      const dtAb = String(abertura.dt_abertura).slice(0, 10);
      if (dtAb !== XDtMov) {
        toast.error(`Existe caixa aberto com a data ${fmtDateBR(dtAb)}. Ajuste a data ou feche o caixa anterior.`);
        return;
      }

      onEntrar({ caixa, abertura, dtMovimento: XDtMov });
    } finally {
      setXLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">PDV - Seleção de Caixa</h2>
          <p className="text-xs text-muted-foreground">Selecione o caixa e a data do movimento para iniciar o PDV.</p>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Caixa</label>
          <select
            value={XCaixaSel}
            onChange={e => setXCaixaSel(Number(e.target.value))}
            disabled={XLoadingCaixas}
            className="w-full border border-border rounded px-2 py-2 text-sm bg-card"
          >
            <option value={0}>{XLoadingCaixas ? "Carregando..." : "-- Selecione --"}</option>
            {XCaixas.map(c => (
              <option key={c.funcionario_id} value={c.funcionario_id}>{c.nome}</option>
            ))}
          </select>
          {!XLoadingCaixas && XCaixas.length === 0 && (
            <p className="text-xs text-destructive">Nenhum funcionário com caixa='S' cadastrado nesta empresa.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data do Movimento</label>
          <input
            type="date"
            value={XDtMov}
            onChange={e => setXDtMov(e.target.value)}
            className="w-full border border-border rounded px-2 py-2 text-sm bg-card"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onCancelar}
            className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent"
          >Cancelar</button>
          <button
            onClick={prosseguir}
            disabled={XLoading}
            className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >{XLoading ? "..." : "Prosseguir"}</button>
        </div>
      </div>
    </div>
  );
};

export default SelecionarCaixaDialog;
