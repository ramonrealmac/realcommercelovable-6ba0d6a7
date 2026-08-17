import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Save, X, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/shared/CurrencyInput";

const db = supabase as any;
const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hoje = () => new Date().toISOString().slice(0, 10);

export type TTipoLanc = "SUP" | "SAN";

interface IProps {
  /** SUP = Suprimento (entrada/crédito), SAN = Sangria (saída/débito) */
  tipo: TTipoLanc;
  /** Quando montado dentro do PDV */
  embutido?: boolean;
  funcionarioId?: number;
  dtMovimento?: string;
  onConcluido?: () => void;
  onCancelar?: () => void;
}

interface IPlanoConta {
  plano_conta_id: number;
  conta: string | null;
  nome: string | null;
  tp_natureza: string | null; // 'C' ou 'D'
}

interface ICadastro {
  cadastro_id: number;
  razao_social: string | null;
  cnpj: string | null;
}

interface ICaixaAberto {
  caixa_abertura_id: number;
  empresa_id: number;
  funcionario_id: number;
  funcionario_nome?: string;
  dt_abertura: string;
}

const SuprimentoSangriaForm: React.FC<IProps> = ({
  tipo,
  embutido,
  funcionarioId,
  dtMovimento,
  onConcluido,
  onCancelar,
}) => {
  const { XEmpresaId } = useAppContext();
  const isSup = tipo === "SUP";
  const titulo = isSup ? "Suprimento de Caixa" : "Sangria de Caixa";
  const naturezaEsperada = isSup ? "R" : "D";
  const corPrincipal = isSup ? "emerald" : "rose";
  const Icone = isSup ? ArrowDownToLine : ArrowUpFromLine;

  // ===== Estado =====
  const [XCaixas, setXCaixas] = useState<ICaixaAberto[]>([]);
  const [XCaixaSel, setXCaixaSel] = useState<number | "">(funcionarioId ?? "");
  const [XDtMov, setXDtMov] = useState<string>(dtMovimento || hoje());
  const [XValor, setXValor] = useState<number>(0);
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XDescricao, setXDescricao] = useState<string>("");
  const [XPlanos, setXPlanos] = useState<IPlanoConta[]>([]);
  const [XPlanoId, setXPlanoId] = useState<number | "">("");
  const [XCadastroBusca, setXCadastroBusca] = useState<string>("");
  const [XCadastros, setXCadastros] = useState<ICadastro[]>([]);
  const [XCadastroSel, setXCadastroSel] = useState<ICadastro | null>(null);
  const [XSalvando, setXSalvando] = useState(false);
  const [XLoading, setXLoading] = useState(false);

  // ===== Carrega caixas abertos =====
  const carregarCaixas = useCallback(async () => {
    if (!XEmpresaId) return;
    setXLoading(true);
    try {
      const { data, error } = await db
        .from("caixa_abertura")
        .select("caixa_abertura_id, empresa_id, funcionario_id, dt_abertura, status")
        .eq("empresa_id", XEmpresaId)
        .eq("status", "A")
        .eq("dt_abertura", XDtMov)
        .order("dt_abertura", { ascending: false });
      if (error) throw new Error(error.message);
      const rows = (data || []) as ICaixaAberto[];
      const ids = Array.from(new Set(rows.map((r) => r.funcionario_id))).filter(Boolean);
      let nomes: Record<number, string> = {};
      if (ids.length > 0) {
        const { data: funcs } = await db
          .from("funcionario")
          .select("funcionario_id, nome")
          .in("funcionario_id", ids);
        nomes = Object.fromEntries(((funcs || []) as any[]).map((f) => [f.funcionario_id, f.nome]));
      }
      const lista = rows.map((r) => ({ ...r, funcionario_nome: nomes[r.funcionario_id] || "" }));
      setXCaixas(lista);
      if (lista.length > 0) {
        // Se o caixa atualmente selecionado não está na nova lista, seleciona o primeiro
        if (!lista.some(c => c.funcionario_id === Number(XCaixaSel))) {
          setXCaixaSel(lista[0].funcionario_id);
        }
      } else {
        setXCaixaSel("");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar caixas abertos.");
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId, XDtMov, XCaixaSel]);

  // ===== Carrega planos de conta filtrados pela natureza =====
  const carregarPlanos = useCallback(async () => {
    if (!XEmpresaId) return;
    try {
      const { data, error } = await db
        .from("plano_conta")
        .select("plano_conta_id, conta, nome, tp_natureza")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .eq("tp_natureza", naturezaEsperada)
        .eq("tp_conta", "A")
        .order("conta", { ascending: true });
      if (error) throw new Error(error.message);
      setXPlanos((data || []) as IPlanoConta[]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar planos de conta.");
    }
  }, [XEmpresaId, naturezaEsperada]);

  useEffect(() => {
    carregarCaixas();
    carregarPlanos();
  }, [carregarCaixas, carregarPlanos]);

  // ===== Busca de cadastros (responsável) =====
  const buscarCadastros = useCallback(async () => {
    if (!XEmpresaId) return;
    try {
      const termo = XCadastroBusca.trim();
      let q = db
        .from("cadastro")
        .select("cadastro_id, razao_social, cnpj")
        .eq("excluido_visivel", false)
        .order("razao_social", { ascending: true })
        .limit(20);
      if (termo) q = q.ilike("razao_social", `%${termo}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setXCadastros((data || []) as ICadastro[]);
    } catch (err: any) {
      toast.error(err.message || "Erro ao buscar cadastros.");
    }
  }, [XCadastroBusca, XEmpresaId]);

  const caixaSelecionado = useMemo(
    () => XCaixas.find((c) => c.funcionario_id === Number(XCaixaSel)) || null,
    [XCaixas, XCaixaSel]
  );

  // ===== Próximo ID utilitário =====
  const nextId = async (table: string, pk: string): Promise<number> => {
    const { data } = await db.from(table).select(pk).order(pk, { ascending: false }).limit(1);
    const last = ((data || []) as any[])[0]?.[pk] ?? 0;
    return Number(last) + 1;
  };

  // ===== Salvar lançamento =====
  const salvar = async () => {
    if (!XEmpresaId) return toast.error("Empresa não definida.");
    if (!XCaixaSel) return toast.error("Selecione um caixa aberto.");
    if (!caixaSelecionado) return toast.error("Caixa selecionado não está aberto.");
    const vl = XValor;
    if (!vl || vl <= 0) return toast.error("Informe um valor válido.");
    if (!XDescricao.trim()) return toast.error("Informe a descrição.");
    if (!XPlanoId) return toast.error("Selecione o plano de contas.");

    setXSalvando(true);
    try {
      // === 1) Pegar meio_pagamento "Dinheiro" (soma_vl_caixa = S) ===
      const { data: meios } = await db
        .from("meio_pagamento")
        .select("meio_pagamento_id, descricao, soma_vl_caixa")
        .eq("soma_vl_caixa", "S")
        .order("meio_pagamento_id", { ascending: true })
        .limit(1);
      const meio = ((meios || []) as any[])[0];
      if (!meio) throw new Error("Nenhum meio de pagamento com soma_vl_caixa='S' configurado.");

      // === 2) Garantir caixa_movimento do dia/funcionário ===
      let caixaMovimentoId: number | null = null;
      const { data: cmExist } = await db
        .from("caixa_movimento")
        .select("caixa_movimento_id")
        .eq("empresa_id", caixaSelecionado.empresa_id)
        .eq("funcionario_id", caixaSelecionado.funcionario_id)
        .eq("dt_movimento", caixaSelecionado.dt_abertura)
        .eq("excluido", false)
        .order("caixa_movimento_id", { ascending: false })
        .limit(1);
      if (((cmExist || []) as any[]).length > 0) {
        caixaMovimentoId = (cmExist as any[])[0].caixa_movimento_id;
        await db
          .from("caixa_movimento")
          .update({ caixa_abertura_id: caixaSelecionado.caixa_abertura_id })
          .eq("caixa_movimento_id", caixaMovimentoId);
      } else {
        const newCmId = await nextId("caixa_movimento", "caixa_movimento_id");
        const { error: errCm } = await db.from("caixa_movimento").insert({
          caixa_movimento_id: newCmId,
          empresa_id: caixaSelecionado.empresa_id,
          funcionario_id: caixaSelecionado.funcionario_id,
          colaborador_id: caixaSelecionado.funcionario_id,
          dt_movimento: caixaSelecionado.dt_abertura,
          tp_movimento: isSup ? "E" : "S",
          tp_operacao: isSup ? "E" : "S",
          historico: XDescricao,
          vl_movimento: isSup ? vl : -vl,
          excluido: false,
          caixa_abertura_id: caixaSelecionado.caixa_abertura_id,
        });
        if (errCm) throw new Error(errCm.message);
        caixaMovimentoId = newCmId;
      }

      // === 3) Inserir movimento (cabeçalho) ===
      const newMovId = await nextId("movimento", "movimento_id");
      const horaAtual = new Date().toTimeString().slice(0, 8);
      const { error: errMov } = await db.from("movimento").insert({
        movimento_id: newMovId,
        empresa_id: XEmpresaId,
        cadastro_id: XCadastroSel?.cadastro_id && XCadastroSel.cadastro_id !== 0 ? XCadastroSel.cadastro_id : null,
        tp_movimento: tipo,
        tp_origem: "CAIXA",
        st_pedido: "F",
        faturado: "S",
        dt_emissao: new Date().toISOString(),
        hr_movimento: horaAtual,
        vl_produto: vl,
        vl_desconto: 0,
        vl_movimento: vl,
        observacao: XDescricao,
        obs_pedido: titulo,
        nm_responsavel: XCadastroSel?.razao_social || "",
        nr_telefone_responsavel: "",
        email_responsavel: "",
        nm_crianca: "",
        url_pagamento: "",
        qr_code_pagamento: "",
        id_transacao_abacatepay: "",
        gerou_financeiro: "N",
        mot_cancelamento: "",
      });
      if (errMov) throw new Error(errMov.message);

      // === 4) Inserir movimento_item (uma linha representando o lançamento) ===
      const newItemId = await nextId("movimento_item", "movimento_item_id");
      const { error: errIt } = await db.from("movimento_item").insert({
        movimento_item_id: newItemId,
        empresa_id: XEmpresaId,
        movimento_id: newMovId,
        nm_produto: XDescricao,
        cd_produto: tipo,
        tp_movimento: tipo,
        qt_movimento: 1,
        vl_und_produto: vl,
        vl_produto: vl,
        vl_movimento: vl,
        excluido: false,
      });
      if (errIt) throw new Error(errIt.message);

      // === 5) Inserir caixa_movimento_item para refletir no fechamento ===
      const { error: errCmi } = await db.from("caixa_movimento_item").insert({
        caixa_movimento_id: caixaMovimentoId,
        empresa_id: caixaSelecionado.empresa_id,
        condicao_id: null,
        prazo_pagamento_id: null,
        bandeira_id: null,
        operadora_id: null,
        numero_autoriza: "",
        qt_parcela: 1,
        vl_parcela: isSup ? vl : -vl,
        vl_recebido: isSup ? vl : -vl,
        plano_conta_id: Number(XPlanoId),
        meio_pagamento_id: meio.meio_pagamento_id,
        excluido: false,
      });
      if (errCmi) throw new Error(errCmi.message);

      toast.success(`${titulo} registrado com sucesso.`);
      setXValor(0);
      setXDescricao("");
      setXCadastroSel(null);
      setXCadastroBusca("");
      onConcluido?.();
    } catch (err: any) {
      toast.error(err.message || `Erro ao registrar ${titulo.toLowerCase()}.`);
    } finally {
      setXSalvando(false);
    }
  };

  const handleResponsavelKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      setXSearchOpen(true);
    }
  };

  const conteudo = (
    <div className="w-full max-w-md bg-card border border-border rounded-lg shadow-sm overflow-hidden text-card-foreground">
      <div className="flex items-center h-10 bg-topbar text-topbar-foreground px-4 gap-2 shrink-0">
        <Icone size={18} />
        <h2 className="text-sm font-semibold">{titulo}</h2>
      </div>

      <div className="p-6 space-y-4">
        {/* Caixa + Data */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7 space-y-1">
            <label className="text-xs text-muted-foreground block">Caixa Aberto (Funcionário)</label>
            <select
              id="ss_caixa_select"
              value={XCaixaSel}
              onChange={(e) => setXCaixaSel(Number(e.target.value))}
              disabled={!!funcionarioId || XLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("ss_valor_input")?.focus();
                }
              }}
              className="w-full border border-border rounded px-2 py-2 text-sm bg-card disabled:opacity-70 focus:ring-2 focus:ring-ring outline-none text-foreground"
            >
              <option value="">-- Selecione --</option>
              {XCaixas.map((c) => (
                <option key={c.caixa_abertura_id} value={c.funcionario_id}>
                  {c.funcionario_nome || `Caixa #${c.funcionario_id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-5 space-y-1">
            <label className="text-xs text-muted-foreground block">Data Movimento</label>
            <input
              type="date"
              value={XDtMov}
              onChange={(e) => setXDtMov(e.target.value)}
              disabled
              className="w-full border border-border rounded px-2 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none opacity-70"
            />
          </div>
        </div>

        {/* Valor + Plano */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4 space-y-1">
            <label className="text-xs text-muted-foreground block">Valor (R$)</label>
            <CurrencyInput
              id="ss_valor_input"
              value={XValor}
              onChange={setXValor}
              decimals={2}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("ss_plano_select")?.focus();
                }
              }}
              className="w-full border border-border rounded px-2 py-2 text-sm text-right bg-card focus:ring-2 focus:ring-ring outline-none text-foreground"
              placeholder="0,00"
            />
          </div>
          <div className="col-span-8 space-y-1">
            <label className="text-xs text-muted-foreground block">
              Plano de Contas ({isSup ? "Crédito" : "Débito"})
            </label>
            <select
              id="ss_plano_select"
              value={XPlanoId}
              onChange={(e) => setXPlanoId(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  document.getElementById("ss_descricao_input")?.focus();
                }
              }}
              className="w-full border border-border rounded px-2 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none text-foreground"
            >
              <option value="">-- Selecione --</option>
              {XPlanos.map((p) => (
                <option key={p.plano_conta_id} value={p.plano_conta_id}>
                  {p.conta ? `${p.conta} - ` : ""}
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Descrição */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">Descrição / Histórico</label>
          <input
            id="ss_descricao_input"
            type="text"
            value={XDescricao}
            onChange={(e) => setXDescricao(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("ss_responsavel_input")?.focus();
              }
            }}
            className="w-full border border-border rounded px-2 py-2 text-sm bg-card focus:ring-2 focus:ring-ring outline-none text-foreground"
            placeholder={isSup ? "Ex.: Troco inicial, reforço de caixa..." : "Ex.: Pagamento de fornecedor, retirada..."}
            maxLength={250}
          />
        </div>

        {/* Responsável */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground block">
            Responsável (Cadastro) <span className="text-muted-foreground">- opcional</span>
          </label>
          <div className="flex gap-2">
            <input
              id="ss_responsavel_input"
              type="text"
              value={XCadastroSel ? (XCadastroSel.razao_social || "") : ""}
              onKeyDown={handleResponsavelKeyDown}
              placeholder="Enter para pesquisar..."
              className="flex-1 border border-border rounded px-2 py-2 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer text-foreground"
              readOnly
              onClick={() => setXSearchOpen(true)}
            />
            <button
              type="button"
              onClick={() => setXSearchOpen(true)}
              className="px-3 py-2 border border-border rounded bg-card hover:bg-accent flex items-center justify-center text-foreground"
              title="Pesquisar responsável"
            >
              <Search className="w-4 h-4" />
            </button>
            {XCadastroSel && (
              <button
                type="button"
                onClick={() => setXCadastroSel(null)}
                className="px-2 py-2 border border-border rounded bg-card text-rose-500 hover:text-rose-700 flex items-center justify-center"
                title="Remover"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dialog de busca de funcionário */}
        <FuncionarioSearchDialog
          open={XSearchOpen}
          onClose={() => setXSearchOpen(false)}
          empresaId={XEmpresaId || 0}
          onSelect={async (f) => {
            setXSearchOpen(false);
            
            // Busca o cadastro correspondente ao funcionario_id
            let cadastroId: number | null = null;
            try {
              const { data } = await db
                .from("cadastro")
                .select("cadastro_id")
                .eq("funcionario_id", f.funcionario_id)
                .limit(1);
              if (data && data[0]) {
                cadastroId = data[0].cadastro_id;
              }
            } catch (err) {
              console.error("Erro ao buscar cadastro correspondente:", err);
            }

            setXCadastroSel({
              cadastro_id: cadastroId || 0,
              razao_social: f.nome,
              cnpj: ""
            });

            setTimeout(() => {
              document.getElementById("ss_confirmar_btn")?.focus();
            }, 100);
          }}
        />

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {onCancelar && (
            <button
              onClick={onCancelar}
              disabled={XSalvando}
              className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent flex items-center gap-2 disabled:opacity-50 transition-colors bg-card"
            >
              <X size={14} className="text-rose-500" /> Cancelar
            </button>
          )}
          <button
            id="ss_confirmar_btn"
            onClick={salvar}
            disabled={XSalvando}
            className={`text-sm px-4 py-1.5 rounded text-white flex items-center gap-2 disabled:opacity-50 transition-colors focus:ring-2 focus:ring-ring outline-none ${
              isSup ? "bg-emerald-600 hover:bg-emerald-700 focus:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700 focus:bg-rose-700"
            }`}
          >
            <Save size={14} /> {XSalvando ? "Salvando..." : `Confirmar ${isSup ? "Suprimento" : "Sangria"}`}
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

interface IFuncionarioSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (f: { funcionario_id: number; cd_funcionario?: number | null; nome: string }) => void;
  empresaId: number;
}

const FuncionarioSearchDialog: React.FC<IFuncionarioSearchDialogProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<{ funcionario_id: number; cd_funcionario?: number | null; nome: string | null }[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    let q = supabase.from("funcionario")
      .select("funcionario_id, cd_funcionario, nome")
      .eq("empresa_id", empresaId)
      .order("nome")
      .limit(100);
      
    const t = termo.trim();
    if (t) {
      q = q.ilike("nome", `%${t}%`);
    }
    const { data, error } = await q;
    setXLoading(false);
    if (!error && data) {
      setXRows(data as any[]);
      setXSelectedIdx(null);
    }
  }, [empresaId]);

  useEffect(() => {
    if (open) {
      setXTermo("");
      buscar("");
      setXSelectedIdx(null);
    }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (XRows.length === 0 || XLoading) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setXSelectedIdx(prev => {
        const next = prev === null ? 0 : Math.min(prev + 1, XRows.length - 1);
        setTimeout(() => {
          const el = listRef.current?.querySelector(`[data-index="${next}"]`) as HTMLElement;
          el?.scrollIntoView({ block: "nearest" });
        }, 10);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setXSelectedIdx(prev => {
        const next = prev === null ? 0 : Math.max(prev - 1, 0);
        setTimeout(() => {
          const el = listRef.current?.querySelector(`[data-index="${next}"]`) as HTMLElement;
          el?.scrollIntoView({ block: "nearest" });
        }, 10);
        return next;
      });
    } else if (e.key === "Enter") {
      const selected = XSelectedIdx !== null ? XSelectedIdx : 0;
      if (XRows[selected]) {
        e.preventDefault();
        onSelect({
          funcionario_id: XRows[selected].funcionario_id,
          cd_funcionario: XRows[selected].cd_funcionario,
          nome: XRows[selected].nome || ""
        });
        onClose();
      }
    }
  };

  const gridTemplateColumns = "100px 1fr";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl bg-card text-card-foreground border border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Pesquisar Funcionário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              autoFocus
              value={XTermo}
              onChange={(e) => setXTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite o nome do funcionário..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="border border-border rounded overflow-hidden bg-card">
            <div ref={listRef} className="h-[300px] overflow-y-auto flex flex-col">
              {/* Header da Tabela/Grid */}
              {!XLoading && XRows.length > 0 && (
                <div 
                  className="grid gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b border-border sticky top-0 bg-card z-10 shrink-0 select-none"
                  style={{ gridTemplateColumns }}
                >
                  <div>Código</div>
                  <div className="text-left">Nome</div>
                </div>
              )}

              {XLoading && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  Carregando...
                </div>
              )}
              {!XLoading && XRows.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  Nenhum funcionário encontrado.
                </div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const sel = XSelectedIdx === idx;
                const zebra = idx % 2 === 1 ? "bg-muted/10" : "";
                return (
                  <button
                    key={r.funcionario_id}
                    data-index={idx}
                    onDoubleClick={() => {
                      onSelect({
                        funcionario_id: r.funcionario_id,
                        cd_funcionario: r.cd_funcionario,
                        nome: r.nome || ""
                      });
                      onClose();
                    }}
                    onClick={() => {
                      onSelect({
                        funcionario_id: r.funcionario_id,
                        cd_funcionario: r.cd_funcionario,
                        nome: r.nome || ""
                      });
                      onClose();
                    }}
                    className={`w-full grid gap-3 px-3 py-2.5 text-sm border-b border-border/60 shrink-0 break-words items-center transition-colors text-left ${
                      sel ? "bg-primary/15 font-medium" : `${zebra} hover:bg-accent/50`
                    }`}
                    style={{ gridTemplateColumns }}
                  >
                    <div className="font-mono text-foreground text-left">{r.cd_funcionario ?? r.funcionario_id}</div>
                    <div className="text-foreground break-words text-left">{r.nome || ""}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Clique ou use as setas e Enter para selecionar. Resultados limitados a 100.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SuprimentoSangriaForm;
