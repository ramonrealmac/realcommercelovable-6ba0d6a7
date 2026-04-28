import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Save, X, Search } from "lucide-react";

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
  const naturezaEsperada = isSup ? "C" : "D";
  const corPrincipal = isSup ? "emerald" : "rose";
  const Icone = isSup ? ArrowDownToLine : ArrowUpFromLine;

  // ===== Estado =====
  const [XCaixas, setXCaixas] = useState<ICaixaAberto[]>([]);
  const [XCaixaSel, setXCaixaSel] = useState<number | "">(funcionarioId ?? "");
  const [XDtMov, setXDtMov] = useState<string>(dtMovimento || hoje());
  const [XValor, setXValor] = useState<string>("");
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
      if (!XCaixaSel && lista.length > 0) setXCaixaSel(lista[0].funcionario_id);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar caixas abertos.");
    } finally {
      setXLoading(false);
    }
  }, [XEmpresaId]);

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
    const vl = Number(String(XValor).replace(",", "."));
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
      } else {
        const newCmId = await nextId("caixa_movimento", "caixa_movimento_id");
        const { error: errCm } = await db.from("caixa_movimento").insert({
          caixa_movimento_id: newCmId,
          empresa_id: caixaSelecionado.empresa_id,
          funcionario_id: caixaSelecionado.funcionario_id,
          colaborador_id: caixaSelecionado.funcionario_id,
          dt_movimento: caixaSelecionado.dt_abertura,
          tp_movimento: tipo,
          tp_operacao: isSup ? "E" : "S",
          historico: XDescricao,
          vlr_movimento: isSup ? vl : -vl,
          excluido: false,
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
        cadastro_id: XCadastroSel?.cadastro_id ?? null,
        tp_movimento: tipo,
        tp_origem: "CAIXA",
        st_pedido: "T",
        status: "F",
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
      const newCmiId = await nextId("caixa_movimento_item", "caixa_movimento_item_id");
      const { error: errCmi } = await db.from("caixa_movimento_item").insert({
        caixa_movimento_item_id: newCmiId,
        caixa_movimento_id: caixaMovimentoId,
        empresa_id: caixaSelecionado.empresa_id,
        condicao_id: 0,
        prazo_pagamento_id: 0,
        bandeira_id: 0,
        operadora_id: 0,
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
      setXValor("");
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

  return (
    <div className={embutido ? "space-y-3" : "p-4 space-y-4"}>
      {!embutido && (
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Icone size={18} className={`text-${corPrincipal}-600`} /> {titulo}
        </h2>
      )}

      <div className="border border-border rounded p-3 bg-card space-y-3">
        {/* Caixa + Data */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-7">
            <label className="text-xs text-muted-foreground block">Caixa Aberto (Funcionário)</label>
            <select
              value={XCaixaSel}
              onChange={(e) => setXCaixaSel(Number(e.target.value))}
              disabled={!!funcionarioId || XLoading}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-white text-black"
            >
              <option value="">-- Selecione --</option>
              {XCaixas.map((c) => (
                <option key={c.caixa_abertura_id} value={c.funcionario_id}>
                  {c.funcionario_nome} — {new Date(c.dt_abertura + "T00:00:00").toLocaleDateString("pt-BR")}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-5">
            <label className="text-xs text-muted-foreground block">Data Movimento</label>
            <input
              type="date"
              value={XDtMov}
              onChange={(e) => setXDtMov(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-white text-black"
            />
          </div>
        </div>

        {/* Valor + Plano */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-4">
            <label className="text-xs text-muted-foreground block">Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={XValor}
              onChange={(e) => setXValor(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 text-sm text-right bg-white text-black"
              placeholder="0,00"
            />
            {XValor && (
              <div className="text-[11px] text-muted-foreground mt-0.5 text-right">
                {fmt(Number(String(XValor).replace(",", ".")))}
              </div>
            )}
          </div>
          <div className="col-span-8">
            <label className="text-xs text-muted-foreground block">
              Plano de Contas ({isSup ? "Crédito" : "Débito"})
            </label>
            <select
              value={XPlanoId}
              onChange={(e) => setXPlanoId(Number(e.target.value))}
              className="w-full border border-border rounded px-2 py-1 text-sm bg-white text-black"
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
        <div>
          <label className="text-xs text-muted-foreground block">Descrição / Histórico</label>
          <input
            type="text"
            value={XDescricao}
            onChange={(e) => setXDescricao(e.target.value)}
            className="w-full border border-border rounded px-2 py-1 text-sm bg-white text-black"
            placeholder={isSup ? "Ex.: Troco inicial, reforço de caixa..." : "Ex.: Pagamento de fornecedor, retirada..."}
            maxLength={250}
          />
        </div>

        {/* Responsável */}
        <div>
          <label className="text-xs text-muted-foreground block">
            Responsável (Cadastro) <span className="text-muted-foreground">- opcional</span>
          </label>
          {XCadastroSel ? (
            <div className="flex items-center justify-between border border-border rounded px-2 py-1.5 bg-muted/30">
              <span className="text-sm">
                {XCadastroSel.razao_social}
                {XCadastroSel.cnpj ? ` (${XCadastroSel.cnpj})` : ""}
              </span>
              <button
                onClick={() => setXCadastroSel(null)}
                className="text-rose-500 hover:text-rose-700"
                title="Remover"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={XCadastroBusca}
                onChange={(e) => setXCadastroBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscarCadastros()}
                placeholder="Digite o nome e tecle Enter..."
                className="flex-1 border border-border rounded px-2 py-1 text-sm bg-white text-black"
              />
              <button
                onClick={buscarCadastros}
                className="text-sm px-3 py-1.5 rounded border border-border flex items-center gap-1"
              >
                <Search size={14} /> Buscar
              </button>
            </div>
          )}
          {XCadastros.length > 0 && !XCadastroSel && (
            <div className="border border-border rounded mt-1 max-h-32 overflow-auto bg-card">
              {XCadastros.map((c) => (
                <div
                  key={c.cadastro_id}
                  onClick={() => {
                    setXCadastroSel(c);
                    setXCadastros([]);
                    setXCadastroBusca("");
                  }}
                  className="px-2 py-1 text-sm hover:bg-accent cursor-pointer border-b border-border last:border-0"
                >
                  {c.razao_social}
                  {c.cnpj ? ` — ${c.cnpj}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          {onCancelar && (
            <button
              onClick={onCancelar}
              disabled={XSalvando}
              className="text-sm px-4 py-1.5 rounded border border-border hover:bg-accent flex items-center gap-2 disabled:opacity-50"
            >
              <X size={14} className="text-rose-500" /> Cancelar
            </button>
          )}
          <button
            onClick={salvar}
            disabled={XSalvando}
            className={`text-sm px-4 py-1.5 rounded text-white flex items-center gap-2 disabled:opacity-50 ${
              isSup ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
            }`}
          >
            <Save size={14} /> {XSalvando ? "Salvando..." : `Confirmar ${isSup ? "Suprimento" : "Sangria"}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuprimentoSangriaForm;
