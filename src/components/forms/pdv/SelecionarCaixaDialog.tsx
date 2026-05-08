import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import type { IPdvCaixa, IPdvCaixaAbertura } from "./types";
import AberturaCaixaForm from "./AberturaCaixaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Monitor } from "lucide-react";

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
  const [XOpenAbert, setXOpenAbert] = useState(false);
  const [XCaixaPendente, setXCaixaPendente] = useState<IPdvCaixa | null>(null);

  const carregarCaixas = useCallback(async () => {
    setXLoadingCaixas(true);
    const { data: funcs, error: funcError } = await db.from("funcionario")
      .select(`
        funcionario_id, nome, tamanho_fonte_pedidos, tamanho_fonte_produtos, tempo_refresh_pdv, 
        caixa_inf_vend, caixa_cnc_venda, caixa_edit_venda,
        nfe_config_item, nfce_config_item
      `)
      .eq("empresa_id", XEmpresaId)
      .eq("caixa", "S")
      .order("nome");
    
    if (funcError) { 
      setXLoadingCaixas(false);
      toast.error("Falha ao carregar caixas: " + funcError.message); 
      return; 
    }

    const configIds = Array.from(new Set(
      (funcs || []).flatMap((f: any) => [f.nfe_config_item, f.nfce_config_item]).filter(Boolean)
    ));

    let configMap: Record<number, string> = {};
    if (configIds.length > 0) {
      const { data: configs } = await db.from("fiscal_config_item")
        .select("fiscal_config_item_id, nome")
        .in("fiscal_config_item_id", configIds);
      
      (configs || []).forEach((c: any) => {
        configMap[c.fiscal_config_item_id] = c.nome;
      });
    }

    const lista = (funcs || []).map((f: any) => ({
      ...f,
      nfe_nome: configMap[f.nfe_config_item] || "",
      nfce_nome: configMap[f.nfce_config_item] || ""
    })) as IPdvCaixa[];

    setXLoadingCaixas(false);
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
        // Abrir formulário de Abertura de Caixa
        setXCaixaPendente(caixa);
        setXOpenAbert(true);
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
      <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2 shrink-0">
          <Monitor size={18} />
          <h2 className="text-sm font-semibold">PDV - Seleção de Caixa</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground -mt-2">Selecione o caixa e a data do movimento para iniciar o PDV.</p>

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

      <Dialog open={XOpenAbert} onOpenChange={(o) => !o && setXOpenAbert(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abertura de Caixa</DialogTitle>
          </DialogHeader>
          {XCaixaPendente && (
            <AberturaCaixaForm
              funcionarioId={XCaixaPendente.funcionario_id}
              dtAbertura={XDtMov}
              embutido
              onCancelar={() => { setXOpenAbert(false); setXCaixaPendente(null); }}
              onAberto={(res) => {
                setXOpenAbert(false);
                const novaAb: IPdvCaixaAbertura = {
                  caixa_abertura_id: res.caixa_abertura_id,
                  empresa_id: XEmpresaId,
                  funcionario_id: res.funcionario_id,
                  dt_abertura: res.dt_abertura,
                  vl_abertura: res.vl_abertura,
                  vl_fechamento: null,
                  status: "A",
                };
                const caixa = XCaixaPendente;
                setXCaixaPendente(null);
                if (caixa) onEntrar({ caixa, abertura: novaAb, dtMovimento: res.dt_abertura });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SelecionarCaixaDialog;
