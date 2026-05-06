import React, { useEffect, useState } from "react";
import { HandCoins, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface IClienteOpt { cadastro_id: number; nome: string; }
interface IContaOpt { conta_id: string; nome_conta: string; }
interface IMeioPagOpt { meio_pagamento_id: number; descricao: string; }

const BaixaPorClienteForm: React.FC = () => {
  const [XClientes, setXClientes] = useState<IClienteOpt[]>([]);
  const [XContas, setXContas] = useState<IContaOpt[]>([]);
  const [XMeios, setXMeios] = useState<IMeioPagOpt[]>([]);

  const [XCadastroId, setXCadastroId] = useState<string>("");
  const [XValor, setXValor] = useState<string>("");
  const [XRecibo, setXRecibo] = useState<string>("");
  const [XContaId, setXContaId] = useState<string>("");
  const [XMeioId, setXMeioId] = useState<string>("");
  const [XLoading, setXLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [cliRes, contaRes, meioRes] = await Promise.all([
        supabase.from("cadastro").select("cadastro_id, nome_fantasia, tipo_cadastro")
          .in("tipo_cadastro", ["C", "A"]).order("cadastro_id"),
        supabase.from("conta").select("conta_id, nome_conta").order("nome_conta"),
        supabase.from("meio_pagamento").select("meio_pagamento_id, descricao").order("descricao"),
      ]);
      setXClientes((cliRes.data ?? []).map((c: any) => ({
        cadastro_id: c.cadastro_id,
        nome: `${c.cadastro_id} - ${c.nome_fantasia ?? ""}`,
      })));
      setXContas((contaRes.data ?? []) as IContaOpt[]);
      setXMeios((meioRes.data ?? []) as IMeioPagOpt[]);
    })();
  }, []);

  const limpar = () => {
    setXCadastroId(""); setXValor(""); setXRecibo(""); setXContaId(""); setXMeioId("");
  };

  const handleBaixar = async () => {
    if (!XCadastroId) { toast({ title: "Selecione um Cliente", variant: "destructive" }); return; }
    if (!XValor.trim()) { toast({ title: "Informe o Valor", variant: "destructive" }); return; }
    if (!XMeioId) { toast({ title: "Selecione a Forma de Pagamento", variant: "destructive" }); return; }

    setXLoading(true);
    try {
      const { error } = await supabase.rpc("fu_baixar_titulos_cliente", {
        p_cadastro_id: Number(XCadastroId),
        p_vl_recebido: XValor,
        p_recibo: XRecibo,
        p_conta_id: XContaId || null,
        p_tipo_pag_rec_id: Number(XMeioId),
      } as any);
      if (error) throw error;
      toast({ title: "Baixa realizada com sucesso!" });
      limpar();
      window.dispatchEvent(new CustomEvent("financeiro:baixa-changed"));
    } catch (e: any) {
      toast({ title: "Erro ao baixar", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setXLoading(false);
    }
  };

  return (
    <div className="p-3 h-full overflow-auto">
      <div className="mb-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <HandCoins size={18} /> Baixa por Cliente
        </h2>
      </div>

      <div className="border border-border rounded-md p-4 bg-card max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente</label>
            <select
              value={XCadastroId}
              onChange={(e) => setXCadastroId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            >
              <option value="">Selecione...</option>
              {XClientes.map(c => (
                <option key={c.cadastro_id} value={c.cadastro_id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Valor</label>
            <input
              type="text"
              value={XValor}
              onChange={(e) => setXValor(e.target.value)}
              placeholder="0,00"
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-right"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Recibo</label>
            <input
              type="text"
              value={XRecibo}
              onChange={(e) => setXRecibo(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Conta</label>
            <select
              value={XContaId}
              onChange={(e) => setXContaId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            >
              <option value="">Selecione...</option>
              {XContas.map(c => (
                <option key={c.conta_id} value={c.conta_id}>{c.nome_conta}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Forma de Pagamento</label>
            <select
              value={XMeioId}
              onChange={(e) => setXMeioId(e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
            >
              <option value="">Selecione...</option>
              {XMeios.map(m => (
                <option key={m.meio_pagamento_id} value={m.meio_pagamento_id}>{m.descricao}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={limpar}
            disabled={XLoading}
            className="px-3 py-1.5 text-xs border border-border rounded hover:bg-accent"
          >Limpar</button>
          <button
            onClick={handleBaixar}
            disabled={XLoading}
            className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {XLoading ? <RefreshCw size={14} className="animate-spin" /> : <HandCoins size={14} />}
            Baixar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BaixaPorClienteForm;
