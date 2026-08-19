import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { TFormMode } from "@/hooks/useCrudController";
import type { IGridColumn } from "@/components/grid/DataGrid";
import type { IMovimento, IMovimentoItem } from "./types";
import DataGrid from "@/components/grid/DataGrid";
import { ST_PEDIDO_LABELS, TP_DESCONTO_LABELS } from "./types";
import PedidoItensTab from "./PedidoItensTab";
import PedidoPagamentoTab from "./PedidoPagamentoTab";
import ClienteSearchDialog, { IClienteRow } from "./ClienteSearchDialog";
import { Search, Send, Reply, Lock, Unlock, Ban, ArrowLeftRight, Wallet, CircleDollarSign, Package } from "lucide-react";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import { ToolbarBtn, ToolbarSeparator } from "@/components/shared/FormToolbar";

const db = supabase as any;

interface ILookup { id: number; label: string; }
interface IClienteInfo { id: number; cnpj: string; razao: string; fantasia: string; cd_cadastro?: number | null; tabela_preco_id?: number | null; }

const buildGridCols = (
  vendedores: ILookup[],
  clientesCache: Record<number, IClienteInfo>,
): IGridColumn[] => [
    { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
    { key: "dt_emissao", label: "Emissão", width: "120px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
    {
      key: "_cliente", label: "Cliente", width: "2fr",
      getValue: r => clientesCache[r.cadastro_id]?.razao || "",
      render: r => clientesCache[r.cadastro_id]?.razao || (r.cadastro_id ? `#${clientesCache[r.cadastro_id]?.cd_cadastro ?? r.cadastro_id}` : ""),
    },
    { key: "_vendedor", label: "Vendedor", width: "1fr", render: r => vendedores.find(v => v.id === r.funcionario_id)?.label || "" },

    { key: "st_pedido", label: "Status", width: "180px", render: r => ST_PEDIDO_LABELS[r.st_pedido] || r.st_pedido },
    { key: "vl_movimento", label: "Total", width: "120px", align: "right", render: r => Number(r.vl_movimento || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
    { key: "faturado", label: "Faturado", width: "90px" },
  ];

const XDefaultRecord: Partial<IMovimento> = {
  tp_movimento: "PD",
  tp_origem: "PDV",
  st_pedido: "O",
  faturado: "N",
  st_bloqueado: "N",
  st_entrega: "N",
  tp_desconto: "N",
  pc_desconto: 0,
  vl_produto: 0,
  vl_desconto: 0,
  vl_movimento: 0,
  vl_frete: 0,
  vl_despesa: 0,
  vl_seguro: 0,
  vl_outro: 0,
  tabela_preco_id: null,
  obs_pedido: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_entrega: new Date().toISOString().substring(0, 10),
};

interface PedidoCadastroFormContentProps {
  record: any;
  setField: (k: string, v: any) => void;
  setRecord: (r: any) => void;
  mode: TFormMode;
  isEditing: boolean;
  currentRecord: any | null;
  setInnerTab: (tab: string) => void;

  vendedores: ILookup[];
  tpOperacoes: ILookup[];
  rotas: ILookup[];
  cidades: ILookup[];
  clientesCache: Record<number, IClienteInfo>;
  setXClientesCache: React.Dispatch<React.SetStateAction<Record<number, IClienteInfo>>>;
  abrirPesquisaCliente: (onPick: (c: IClienteRow) => void) => void;
  clientePadraoId: number | null;
  ensureClienteInfo: (ids: number[]) => Promise<void>;

  pedidoTotalCtx: { movimentoId: number | null; total: number; itens: IMovimentoItem[] };
  setXMovimentoParaBuscar: (id: number | null) => void;
  setXModoInsertSemId: (val: boolean) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onSalvar?: () => Promise<void>;
  fetchItensCadastro?: (id: number) => Promise<void>;

  tabelasPreco: ILookup[];
  onTabelaPrecoChange?: (tabelaId: number | null) => Promise<void>;
}

const PedidoCadastroFormContent: React.FC<PedidoCadastroFormContentProps> = ({
  record, setField, setRecord, mode, isEditing, currentRecord, setInnerTab,
  vendedores, tpOperacoes, rotas, cidades, clientesCache, setXClientesCache,
  abrirPesquisaCliente, clientePadraoId, ensureClienteInfo,
  pedidoTotalCtx, setXMovimentoParaBuscar, setXModoInsertSemId, handleKeyDown,
  onSalvar, fetchItensCadastro,
  tabelasPreco, onTabelaPrecoChange
}) => {
  const clientInputRef = useRef<HTMLInputElement>(null);
  const vendedorSelectRef = useRef<HTMLSelectElement>(null);
  const dtEmissaoInputRef = useRef<HTMLInputElement>(null);
  const tabelaPrecoSelectRef = useRef<HTMLSelectElement>(null);

  // Auto-foco no campo do cliente ao inserir ou alterar
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => {
        clientInputRef.current?.focus();
      }, 100);
    }
  }, [isEditing]);

  const handleClienteKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isEditing) return;

    if (e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      if (clientePadraoId) {
        await ensureClienteInfo([clientePadraoId]);
        setField("cadastro_id", clientePadraoId as any);
        const cliInfo = clientesCache[clientePadraoId];
        if (cliInfo?.tabela_preco_id) {
          setField("tabela_preco_id", cliInfo.tabela_preco_id as any);
          if (onTabelaPrecoChange) await onTabelaPrecoChange(cliInfo.tabela_preco_id);
        } else {
          setField("tabela_preco_id", null);
          if (onTabelaPrecoChange) await onTabelaPrecoChange(null);
        }
        // Avança o foco imediatamente para o vendedor
        setTimeout(() => {
          vendedorSelectRef.current?.focus();
        }, 50);
      } else {
        toast.error("Cliente padrão não configurado nas configurações fiscais.");
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (!record.cadastro_id) {
        // Abre a lista de pesquisa
        handleSearchCliente();
      } else {
        // Se ja tiver informado cliente, avanca para o proximo campo vendedor
        vendedorSelectRef.current?.focus();
      }
    }
  };

  const handleSearchCliente = () => {
    abrirPesquisaCliente(async (c) => {
      setXClientesCache(prev => ({
        ...prev,
        [c.cadastro_id]: {
          id: c.cadastro_id,
          cd_cadastro: c.cd_cadastro,
          cnpj: c.cnpj || "",
          razao: c.razao_social || "",
          fantasia: c.nome_fantasia || "",
          tabela_preco_id: c.tabela_preco_id
        }
      }));
      setField("cadastro_id", c.cadastro_id as any);
      if (c.tabela_preco_id) {
        setField("tabela_preco_id", c.tabela_preco_id as any);
        if (onTabelaPrecoChange) await onTabelaPrecoChange(c.tabela_preco_id);
      } else {
        setField("tabela_preco_id", null);
        if (onTabelaPrecoChange) await onTabelaPrecoChange(null);
      }
      // Ao retornar da pesquisa, poe o foco em vendedor
      setTimeout(() => {
        vendedorSelectRef.current?.focus();
      }, 150);
    });
  };

  const stAtual = (record.st_pedido || "O") as string;
  const ro = !isEditing || (mode === "edit" && stAtual !== "O");
  const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQ = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  // Itens em cache (sincronizados com a aba Itens)
  const movId = currentRecord?.movimento_id;
  const isInsertNovo = mode === "insert" && !movId;
  const itensCache = !isInsertNovo && pedidoTotalCtx.movimentoId === movId ? pedidoTotalCtx.itens : [];

  // Sinaliza side-effects via state
  if (!isInsertNovo && movId && pedidoTotalCtx.movimentoId !== movId) {
    queueMicrotask(() => setXMovimentoParaBuscar(movId));
  }
  if (isInsertNovo && (pedidoTotalCtx.movimentoId !== null || pedidoTotalCtx.itens.length > 0)) {
    queueMicrotask(() => setXModoInsertSemId(true));
  }

  const T = itensCache.reduce((acc, i: any) => ({
    vl_produto: acc.vl_produto + Number(i.vl_produto || 0),
    vl_desconto: acc.vl_desconto + Number(i.vl_desconto || 0),
    vl_frete: acc.vl_frete + Number(i.vl_frete || 0),
    vl_despesa: acc.vl_despesa + Number(i.vl_despesa || 0),
    vl_seguro: acc.vl_seguro + Number(i.vl_seguro || 0),
    vl_outro: acc.vl_outro + Number(i.vl_outro || 0),
    vl_movimento: acc.vl_movimento + Number(i.vl_movimento || 0),
  }), { vl_produto: 0, vl_desconto: 0, vl_frete: 0, vl_despesa: 0, vl_seguro: 0, vl_outro: 0, vl_movimento: 0 });

  const finalDesconto = record.tp_desconto === 'P' ? Number(record.vl_desconto || 0) : T.vl_desconto;
  const finalTotal = record.tp_desconto === 'P' 
    ? Math.max(0, T.vl_produto + T.vl_frete + T.vl_despesa + T.vl_seguro + T.vl_outro - finalDesconto) 
    : T.vl_movimento;

  const visualCols = [
    { key: "cd_produto", label: "Código", width: "90px", align: "right" as const, render: (r: any) => r.cd_produto || (r.produto_id ?? "") },
    { key: "nm_produto", label: "Produto", width: "2fr" },
    { key: "qt_movimento", label: "Qtd.", width: "90px", align: "right" as const, render: (r: any) => fmtQ(r.qt_movimento) },
    { key: "vl_und_produto", label: "Vlr. Unit", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_und_produto) },
    { key: "vl_produto", label: "Subtotal", width: "110px", align: "right" as const, render: (r: any) => fmt(r.vl_produto) },
    { key: "pc_desconto", label: "Desc.(%)", width: "80px", align: "right" as const, render: (r: any) => fmt(r.pc_desconto) },
    { key: "vl_desconto", label: "Desc.(R$)", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_desconto) },
    { key: "vl_despesa", label: "Vlr. Desp.", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_despesa) },
    { key: "vl_frete", label: "Vlr. Frete", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_frete) },
    { key: "vl_seguro", label: "Vlr. Seg.", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_seguro) },
    { key: "vl_outro", label: "Vlr. Outros", width: "100px", align: "right" as const, render: (r: any) => fmt(r.vl_outro) },
    { key: "vl_movimento", label: "Total", width: "110px", align: "right" as const, render: (r: any) => fmt(r.vl_movimento) },
  ];

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown}>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-1">
          <label className="text-xs text-muted-foreground">Pedido</label>
          <input readOnly tabIndex={-1} value={record.nr_movimento ?? (mode === "insert" ? "(Novo)" : "")} className="w-full border border-border rounded px-2 py-1 text-sm text-right bg-secondary/50 focus:outline-none" />
        </div>
        <div className="col-span-4">
          <label className="text-xs text-muted-foreground">Cliente <span className="text-destructive">*</span></label>
          <div className="flex gap-1">
            <input
              ref={clientInputRef}
              readOnly
              value={
                record.cadastro_id
                  ? clientesCache[record.cadastro_id]
                    ? `${clientesCache[record.cadastro_id].cd_cadastro ?? record.cadastro_id} - ${clientesCache[record.cadastro_id].razao}`
                    : `#${record.cadastro_id}`
                  : ""
              }
              placeholder="F2 = Padrão, Enter = Pesquisar..."
              className="flex-1 border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
              data-lookup="true"
              data-required="true"
              data-lookup-key="cliente"
              onKeyDown={handleClienteKeyDown}
            />
            <button
              type="button"
              tabIndex={-1}
              disabled={ro}
              onClick={handleSearchCliente}
              className="px-2 py-1 border border-border rounded bg-card hover:bg-accent disabled:opacity-50"
              title="Pesquisar cliente"
              data-lookup-trigger="true"
              data-lookup-key="cliente"
            >
              <Search className="w-4 h-4" />
            </button>
            {record.cadastro_id && !ro && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setField("cadastro_id", null as any)}
                className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                title="Limpar"
              >×</button>
            )}
          </div>
        </div>
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground">Vendedor <span className="text-destructive">*</span></label>
          <select 
            ref={vendedorSelectRef} 
            disabled={ro} 
            value={record.funcionario_id ?? ""} 
            onChange={e => setField("funcionario_id", e.target.value ? Number(e.target.value) : null as any)} 
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                dtEmissaoInputRef.current?.focus();
              }
            }}
            className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
          >
            <option value="">--</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Status</label>
          <input readOnly tabIndex={-1} value={ST_PEDIDO_LABELS[stAtual] || stAtual} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary/50 focus:outline-none" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-muted-foreground">Faturado</label>
          <input readOnly tabIndex={-1} value={record.faturado ?? "N"} className="w-full border border-border rounded px-2 py-1 text-sm text-center bg-secondary/50 focus:outline-none" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-muted-foreground">Bloqueado</label>
          <input
            readOnly
            tabIndex={-1}
            value={record.st_bloqueado ?? "N"}
            className={`w-full border rounded px-2 py-1 text-sm text-center focus:outline-none ${record.st_bloqueado === "S"
                ? "border-destructive bg-destructive/10 text-destructive font-bold"
                : "border-border bg-secondary/50"
              }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
          <input ref={dtEmissaoInputRef} type="date" disabled={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary/20 focus:outline-none" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Entrega <span className="text-destructive">*</span></label>
          <select
            disabled={ro}
            value={record.st_entrega || "N"}
            onChange={async (e) => {
              const val = e.target.value;
              if (val === "N") {
                setRecord((prev: any) => ({
                  ...prev,
                  st_entrega: "N",
                  rota_id: null,
                  cep_entrega: "",
                  cidade_id: null,
                  logradouro_entrega: "",
                  bairro_entrega: "",
                  numero_entrega: "",
                  email_entrega: "",
                }));
              } else {
                setField("st_entrega", val);
              }

              if (record.movimento_id && (val === "S" || val === "N")) {
                const { error } = await db.from("movimento_item")
                  .update({ entrega: val })
                  .eq("movimento_id", record.movimento_id)
                  .eq("excluido", false);
                if (error) {
                  toast.error("Erro ao atualizar itens: " + error.message);
                } else {
                  toast.success(`Itens do pedido atualizados para entrega: ${val === "S" ? "Sim" : "Não"}`);
                  if (fetchItensCadastro) {
                    await fetchItensCadastro(record.movimento_id);
                  }
                }
              }
            }}
            className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
          >
            <option value="S">Sim</option>
            <option value="N">Não</option>
            <option value="P">Parcial</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Dt. Entrega <span className="text-destructive">*</span></label>
          <input type="date" disabled={ro} value={(record.dt_entrega || "").toString().substring(0, 10)} onChange={e => setField("dt_entrega", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none" />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground">Tipo de Operação</label>
          <select disabled={ro} value={record.tp_operacao_id ?? ""} onChange={e => setField("tp_operacao_id", e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none">
            <option value="">--</option>
            {tpOperacoes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground">Tipo de Movimento <span className="text-destructive">*</span></label>
          <select disabled={ro} value={record.tp_movimento || "PD"} onChange={e => setField("tp_movimento", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none">
            <option value="PD">Pedido</option>
            <option value="SV">Saída por Venda</option>
            <option value="OR">Orçamento</option>
          </select>
        </div>
      </div>

      {/* Linha do Tipo de Desconto e Tabela de Preço */}
      <div className="grid grid-cols-12 gap-3 items-end">
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground">Tipo de Desconto <span className="text-destructive">*</span></label>
          <select
            disabled={ro}
            value={record.tp_desconto || "N"}
            onChange={e => setField("tp_desconto", e.target.value as any)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                tabelaPrecoSelectRef.current?.focus();
              }
            }}
            className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
          >
            {Object.entries(TP_DESCONTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="col-span-4">
          <label className="text-xs text-muted-foreground">Tabela de Preço</label>
          <select
            ref={tabelaPrecoSelectRef}
            disabled={ro}
            value={record.tabela_preco_id ?? ""}
            onChange={async (e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setField("tabela_preco_id", val);
              if (onTabelaPrecoChange) await onTabelaPrecoChange(val);
            }}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (mode === "insert") {
                  if (onSalvar) {
                    const saved = await onSalvar();
                    if (saved) {
                      setInnerTab("itens");
                    }
                  }
                } else {
                  setInnerTab("itens");
                }
              }
            }}
            className="w-full border border-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
          >
            <option value="">Preço Padrão (Sem Tabela)</option>
            {tabelasPreco.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* Grid de produtos somente leitura */}
      {currentRecord?.movimento_id && (
        <>
          <DataGrid
            columns={visualCols}
            data={itensCache as any[]}
            maxHeight="260px"
            exportTitle="Itens do Pedido"
            showRecordCount={true}
          />

          {/* Painel de totalizadores — 7 cards */}
          <div className="border border-border rounded p-3 bg-card">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { label: "Subtotal", value: T.vl_produto },
                { label: "Desc. (R$)", value: finalDesconto },
                { label: "Vlr. Frete", value: T.vl_frete },
                { label: "Vlr. Desp.", value: T.vl_despesa },
                { label: "Vlr. Seg.", value: T.vl_seguro },
                { label: "Vlr. Outros", value: T.vl_outro },
              ].map((c) => (
                <div key={c.label} className="flex flex-col border border-border rounded px-3 py-2 bg-secondary/40">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</span>
                  <span className="text-base font-semibold text-right tabular-nums">{fmt(c.value)}</span>
                </div>
              ))}
              <div className="flex flex-col border border-primary/40 rounded px-3 py-2 bg-primary/10">
                <span className="text-xs uppercase tracking-wide text-primary/80">Total</span>
                <span className="text-lg font-bold text-primary text-right tabular-nums">{fmt(finalTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const PedidoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const { handleKeyDown } = useEnterTraversal();
  const [XVendedores, setXVendedores] = useState<ILookup[]>([]);
  const [XTpOperacoes, setXTpOperacoes] = useState<ILookup[]>([]);
  const [XRotas, setXRotas] = useState<ILookup[]>([]);
  const [XCidades, setXCidades] = useState<ILookup[]>([]);
  const [XTabelasPreco, setXTabelasPreco] = useState<ILookup[]>([]);
  const [XClientesCache, setXClientesCache] = useState<Record<number, IClienteInfo>>({});
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTarget, setXSearchTarget] = useState<((c: IClienteRow) => void) | null>(null);
  const [XAutoNovoItem, setXAutoNovoItem] = useState(0);
  const [XPagamentoRefreshToken, setXPagamentoRefreshToken] = useState(0);
  const [XPedidoTotalCtx, setXPedidoTotalCtx] = useState<{ movimentoId: number | null; total: number; itens: IMovimentoItem[] }>({ movimentoId: null, total: 0, itens: [] });
  const [XOpenPagtoDialog, setXOpenPagtoDialog] = useState(false);
  const [XBuscandoCep, setXBuscandoCep] = useState(false);
  const XFetchingItensRef = useRef<Set<number>>(new Set());
  // Ref para acionar refresh do CRUD sem window.location.reload()
  const XCrudRefreshRef = useRef<(() => Promise<void>) | null>(null);
  // Ref estável para XClientesCache — evita dependência instável em useCallback
  const XClientesCacheRef = useRef<Record<number, IClienteInfo>>(XClientesCache);
  useEffect(() => { XClientesCacheRef.current = XClientesCache; }, [XClientesCache]);
  const XCurrentRecordRef = useRef<IMovimento | null>(null);
  const XSetInnerTabRef = useRef<((tab: string) => void) | null>(null);
  const XIsEditingRef = useRef(false);

  // Lookups independentes — falha em um não bloqueia os outros
  useEffect(() => {
    if (!XEmpresaId) return;

    const load = async (
      query: Promise<{ data: any; error: any }>,
      setter: (data: any[]) => void,
      label: string,
    ) => {
      const { data, error } = await query;
      if (error) { console.warn(`[PedidoForm] Lookup "${label}" falhou:`, error.message); return; }
      setter(data || []);
    };

    load(
      db.from("funcionario").select("funcionario_id, cd_funcionario, nome").eq("empresa_id", XEmpresaId).order("nome").limit(500),
      (d) => setXVendedores(d.map((c: any) => ({ id: c.funcionario_id, label: `${c.cd_funcionario ?? c.funcionario_id} - ${c.nome}` }))),
      "funcionario",
    );
    load(
      db.from("tp_operacao").select("tp_operacao_id, descricao").eq("empresa_id", XEmpresaId).order("descricao"),
      (d) => setXTpOperacoes(d.map((t: any) => ({ id: t.tp_operacao_id, label: t.descricao }))),
      "tp_operacao",
    );
    load(
      db.from("cidade").select("cidade_id, descricao, estado_id").eq("excluido", false).order("descricao").limit(1000),
      (d) => setXCidades(d.map((c: any) => ({ id: c.cidade_id, label: `${c.descricao} - ${c.estado_id || ""}` }))),
      "cidade",
    );
    load(
      db.from("tabela_preco").select("tabela_id, descricao").eq("empresa_id", XEmpresaId).eq("excluido", false).order("descricao"),
      (d) => setXTabelasPreco(d.map((t: any) => ({ id: t.tabela_id, label: t.descricao }))),
      "tabela_preco",
    );
  }, [XEmpresaId]);

  // Carrega rotas filtradas pela empresa ativa
  useEffect(() => {
    if (!XEmpresaId) return;
    const loadRotas = async () => {
      const { data, error } = await db
        .from("rota")
        .select("rota_id, descricao")
        .eq("empresa_id", XEmpresaId)
        .eq("excluido", false)
        .order("descricao");
      if (error) {
        console.warn("[PedidoForm] Rota lookup falhou:", error.message);
        return;
      }
      setXRotas((data || []).map((r: any) => ({ id: r.rota_id, label: r.descricao })));
    };
    loadRotas();
  }, [XEmpresaId]);

  // Função para buscar e preencher dados do CEP automaticamente
  const handleBuscarCep = useCallback(async (cep: string, setField: (k: string, v: any) => void) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    setXBuscandoCep(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-cep", {
        body: { cep: cleanCep },
      });

      if (error) throw error;
      if (data) {
        if (data.logradouro) setField("logradouro_entrega", data.logradouro);
        if (data.bairro) setField("bairro_entrega", data.bairro);

        const ibge = data.ibge;
        const localidade = data.localidade;
        const uf = data.uf;

        if (ibge || (localidade && uf)) {
          let query = db.from("cidade").select("cidade_id, descricao, estado_id, cd_ibge").eq("excluido", false);

          if (ibge) {
            query = query.eq("cd_ibge", ibge);
          } else {
            const cleanLocalidade = localidade
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase();
            query = query.eq("descricao", cleanLocalidade).eq("estado_id", uf);
          }

          const { data: dbCidades } = await query;
          let matchedCidade = dbCidades && dbCidades[0];

          if (!matchedCidade && ibge && localidade && uf) {
            const cleanLocalidade = localidade
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toUpperCase();
            const { data: fallbackCidades } = await db
              .from("cidade")
              .select("cidade_id, descricao, estado_id, cd_ibge")
              .eq("excluido", false)
              .eq("descricao", cleanLocalidade)
              .eq("estado_id", uf);

            if (fallbackCidades && fallbackCidades[0]) {
              matchedCidade = fallbackCidades[0];
            }
          }

          if (matchedCidade) {
            const newCidadeItem = {
              id: matchedCidade.cidade_id,
              label: `${matchedCidade.descricao} - ${matchedCidade.estado_id || ""}`,
            };
            setXCidades(prev => {
              if (!prev.some(c => c.id === matchedCidade.cidade_id)) {
                return [...prev, newCidadeItem].sort((a, b) => a.label.localeCompare(b.label));
              }
              return prev;
            });
            setField("cidade_id", matchedCidade.cidade_id);
          } else {
            console.warn(`[PedidoForm] Cidade não encontrada no banco de dados para o CEP ${cep}: ${localidade} - ${uf}`);
          }
        }
        toast.success("Endereço preenchido automaticamente.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar CEP: " + (err.message || "CEP não encontrado."));
    } finally {
      setXBuscandoCep(false);
    }
  }, []);


  // Resolve nomes de clientes para o grid sob demanda
  // Usa ref para evitar dependência instável (XClientesCache muda a cada adição)
  const ensureClienteInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XClientesCacheRef.current[id]);
    if (!faltando.length) return;
    const { data, error } = await db.from("cadastro")
      .select("cadastro_id, cd_cadastro, cnpj, razao_social, nome_fantasia, tabela_preco_id")
      .in("cadastro_id", faltando);
    if (error) { toast.error("Erro ao carregar clientes: " + error.message); return; }
    if (data) {
      setXClientesCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cd_cadastro: c.cd_cadastro, cnpj: c.cnpj || "", razao: c.razao_social || "", fantasia: c.nome_fantasia || "", tabela_preco_id: c.tabela_preco_id };
        }
        return next;
      });
    }
  }, []); // dependência estável via ref

  const [XClientePadraoId, setXClientePadraoId] = useState<number | null>(null);

  // Load default client from fiscal configurations
  useEffect(() => {
    if (!XEmpresaId) return;
    (async () => {
      const { data: fConfig } = await db.from("fiscal_config")
        .select("cliente_padrao_id")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();

      if (fConfig?.cliente_padrao_id) {
        setXClientePadraoId(fConfig.cliente_padrao_id);
        // Pre-cache default client's info
        await ensureClienteInfo([fConfig.cliente_padrao_id]);
      }
    })();
  }, [XEmpresaId, ensureClienteInfo]);

  const abrirPesquisaCliente = (onPick: (c: IClienteRow) => void) => {
    setXSearchTarget(() => onPick);
    setXSearchOpen(true);
  };

  // Status change helpers (Orçamento / Caixa buttons)
  // Usa refresh do CRUD em vez de window.location.reload() para preservar estado
  const mudarStatus = useCallback(async (movimento_id: number, novo: string, confirmMsg?: string, manterDescontos = false) => {
    if (!movimento_id) { toast.error("Salve o pedido primeiro."); return; }
    if (confirmMsg && !confirm(confirmMsg)) return;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // Se st_pedido for mudar para "O" (Orçamento) e quisermos manter os descontos, 
    // salvamos o estado original do desconto do cabeçalho e dos itens antes da RPC rodar
    let originalMov = null;
    let originalItens = null;
    if (novo === "O" && manterDescontos) {
      const { data: mov } = await supabase.from("movimento")
        .select("tp_desconto, vl_desconto, pc_desconto, vl_movimento, vl_produto")
        .eq("movimento_id", movimento_id)
        .single();
      originalMov = mov;

      const { data: itens } = await supabase.from("movimento_item")
        .select("movimento_item_id, vl_desconto, pc_desconto, vl_movimento")
        .eq("movimento_id", movimento_id)
        .eq("excluido", false);
      originalItens = itens;
    }

    const { data, error } = await db.rpc("fu_mudar_status_pedido_pdv", {
      _movimento_id: movimento_id,
      _novo_status: novo,
      _usuario_id: userId
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    // Se mantivemos os descontos, restauramos no banco logo após a RPC terminar
    if (novo === "O" && manterDescontos && originalMov) {
      const { error: errMov } = await supabase.from("movimento")
        .update({
          tp_desconto: originalMov.tp_desconto,
          vl_desconto: originalMov.vl_desconto,
          pc_desconto: originalMov.pc_desconto,
          vl_movimento: originalMov.vl_movimento
        })
        .eq("movimento_id", movimento_id);

      if (errMov) {
        console.error("Erro ao restaurar desconto do movimento:", errMov.message);
      }

      if (originalItens && originalItens.length > 0) {
        for (const item of originalItens) {
          const { error: errItem } = await supabase.from("movimento_item")
            .update({
              vl_desconto: item.vl_desconto,
              pc_desconto: item.pc_desconto,
              vl_movimento: item.vl_movimento
            })
            .eq("movimento_item_id", item.movimento_item_id);
          
          if (errItem) {
            console.error(`Erro ao restaurar desconto do item ${item.movimento_item_id}:`, errItem.message);
          }
        }
      }
    }

    toast.success(`Status alterado para ${ST_PEDIDO_LABELS[novo] || novo}.`);
    if (XCrudRefreshRef.current) {
      await XCrudRefreshRef.current();
    }
  }, []);

  // Keyboard shortcuts F7 and F6
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const rec = XCurrentRecordRef.current;
      if (!rec?.movimento_id) return;

      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.getAttribute("contenteditable") === "true"
      );

      if (e.key === "F7") {
        const st = rec.st_pedido;
        if (st === "O" || st === "V") {
          e.preventDefault();
          mudarStatus(rec.movimento_id, "F", "Confirma o envio deste pedido para o Caixa? O estoque será reservado.");
        }
      } else if (e.key === "F6" || e.key === "F9" || ((e.key === "f" || e.key === "F") && !isTyping)) {
        // Atalho F6 para abrir Financeiro / Pagamento
        // Regras: em navegação, valor > 0, não enviado para caixa, não cancelado, não faturado
        const valor = Number(rec.vl_movimento || 0);
        if (
          !XIsEditingRef.current &&
          valor > 0 &&
          rec.st_pedido !== "F" &&
          rec.st_pedido !== "C" &&
          rec.faturado !== "S"
        ) {
          e.preventDefault();
          XSetInnerTabRef.current?.("pagamento");
          setXOpenPagtoDialog(true);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mudarStatus]);

  const fetchItensCadastro = useCallback(async (movimento_id: number) => {
    const { data } = await db.from("movimento_item")
      .select("*").eq("movimento_id", movimento_id).eq("excluido", false)
      .order("movimento_item_id");
    const itens = (data || []) as IMovimentoItem[];
    const total = itens.reduce((a, i) => a + Number(i.vl_movimento || 0), 0);
    setXPedidoTotalCtx({ movimentoId: movimento_id, total, itens });
  }, []);

  const handleTabelaPrecoChange = async (tabelaId: number | null) => {
    const movimento_id = XCurrentRecordRef.current?.movimento_id;
    if (!movimento_id) return;

    try {
      toast.loading("Recalculando preços dos itens...", { id: "recalc-prices" });
      
      // 1. Fetch all items for this movement
      const { data: itens, error: errFetch } = await db.from("movimento_item")
        .select("*")
        .eq("movimento_id", movimento_id)
        .eq("excluido", false);
      if (errFetch) throw errFetch;

      if (!itens || itens.length === 0) {
        toast.dismiss("recalc-prices");
        return;
      }

      // 2. Recalculate price for each item
      for (const item of itens) {
        let newPreco = null;
        if (tabelaId) {
          // Fetch price from tabela_preco_item
          const { data: tpItem } = await db.from("tabela_preco_item")
            .select("preco")
            .eq("tabela_id", tabelaId)
            .eq("produto_id", item.produto_id)
            .eq("excluido", false)
            .maybeSingle();
          if (tpItem) {
            newPreco = Number(tpItem.preco);
          }
        }

        if (newPreco === null) {
          // Fallback to product standard price
          const { data: prod } = await db.from("produto")
            .select("preco_venda")
            .eq("produto_id", item.produto_id)
            .maybeSingle();
          if (prod) {
            newPreco = Number(prod.preco_venda);
          }
        }

        if (newPreco !== null) {
          // Calculate new item totals
          const qt = Number(item.qt_movimento || 0);
          const sub = qt * newPreco;
          const pc = Number(item.pc_desconto || 0);
          const vd = +(sub * pc / 100).toFixed(2);
          const out = Number(item.vl_despesa || 0) + Number(item.vl_frete || 0) + Number(item.vl_seguro || 0) + Number(item.vl_outro || 0);
          const newVlMovimento = +(sub - vd + out).toFixed(2);

          // Update item in database
          await db.from("movimento_item")
            .update({
              vl_und_produto: newPreco,
              vl_produto: +sub.toFixed(2),
              vl_desconto: vd,
              vl_desc_rs: vd,
              vl_movimento: newVlMovimento
            })
            .eq("movimento_item_id", item.movimento_item_id);
        }
      }

      // 3. Reload items and recalculate totals
      await fetchItensCadastro(movimento_id);
      setXPagamentoRefreshToken(n => n + 1);
      toast.success("Preços dos itens recalculados com sucesso!", { id: "recalc-prices" });
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao recalcular preços dos itens: " + e.message, { id: "recalc-prices" });
    }
  };

  // Reseta o contexto ao entrar em modo de inclusão (novo pedido) para evitar mostrar dados de pedido anterior
  const resetPedidoCtx = useCallback(() => {
    setXPedidoTotalCtx({ movimentoId: null, total: 0, itens: [] });
    XFetchingItensRef.current.clear();
  }, []);

  // Grid de colunas memoizado — evita recriar array a cada render
  const gridCols = useMemo(
    () => buildGridCols(XVendedores, XClientesCache),
    [XVendedores, XClientesCache]
  );

  // Controla qual movimento_id precisa ter itens buscados
  const [XMovimentoParaBuscar, setXMovimentoParaBuscar] = useState<number | null>(null);
  const [XModoInsertSemId, setXModoInsertSemId] = useState(false);

  // Side-effect: busca itens quando selecionamos um pedido ainda não cacheado
  useEffect(() => {
    if (!XMovimentoParaBuscar) return;
    if (XFetchingItensRef.current.has(XMovimentoParaBuscar)) return;
    XFetchingItensRef.current.add(XMovimentoParaBuscar);
    fetchItensCadastro(XMovimentoParaBuscar).finally(() =>
      XFetchingItensRef.current.delete(XMovimentoParaBuscar!)
    );
  }, [XMovimentoParaBuscar, fetchItensCadastro]);

  // Side-effect: limpa contexto ao entrar em modo insert novo
  useEffect(() => {
    if (XModoInsertSemId) {
      resetPedidoCtx();
      setXModoInsertSemId(false);
    }
  }, [XModoInsertSemId, resetPedidoCtx]);

  return (
    <>
      <StandardCrudForm<IMovimento>
        XToolbarExtras={({ currentRecord, refresh, setInnerTab, isEditing }) => {
          XCurrentRecordRef.current = currentRecord;
          XSetInnerTabRef.current = setInnerTab;
          XIsEditingRef.current = isEditing;
          if (!currentRecord?.movimento_id || isEditing) return null;
          const stAtual = currentRecord.st_pedido;
          return (
            <>
              {/* 1. Cancelar - Agora logo após o imprimir para evitar clique acidental no final */}
              {(stAtual === "O" || stAtual === "V" || stAtual === "F") && (
                <ToolbarBtn
                  icon={<Ban size={18} />}
                  label="Cancelar Pedido"
                  onClick={() => mudarStatus(currentRecord.movimento_id, "C", "Confirma o cancelamento deste pedido? Esta ação não pode ser desfeita.")}
                  color="destructive"
                />
              )}

              <ToolbarSeparator />

              {/* 2. Enviar / Retirar do Caixa */}
              {(stAtual === "O" || stAtual === "V") && (
                <ToolbarBtn
                  icon={<Lock size={18} />}
                  label="Enviar p Caixa"
                  onClick={() => mudarStatus(currentRecord.movimento_id, "F", "Confirma o envio deste pedido para o Caixa? O estoque será reservado.")}
                  color="success"
                />
              )}
              {stAtual === "F" && (
                <ToolbarBtn
                  icon={<Unlock size={18} />}
                  label="Retirar do Caixa"
                  onClick={() => mudarStatus(currentRecord.movimento_id, "O", "Confirma a retirada do pedido do Caixa? O estoque reservado será liberado.", true)}
                  color="destructive"
                />
              )}

              {/* 3. Separar / Reserva */}
              {stAtual === "O" && (
                <ToolbarBtn
                  icon={<Package size={18} />}
                  label="Separar (Reserva)"
                  onClick={() => mudarStatus(currentRecord.movimento_id, "V", "Confirma a reserva deste pedido? O estoque será reservado e o pedido não aparecerá no Caixa.")}
                  color="info"
                />
              )}
              {stAtual === "V" && (
                <ToolbarBtn
                  icon={<Package size={18} />}
                  label="Remover Reserva"
                  onClick={() => mudarStatus(currentRecord.movimento_id, "O", "Confirma a retirada da reserva? O estoque reservado será liberado.", true)}
                  color="warning"
                />
              )}

              {/* 4. Pagamento */}
              {stAtual === "O" && (
                <ToolbarBtn
                  icon={<CircleDollarSign size={18} />}
                  label="F6 - Financeiro / Pagamento"
                  onClick={() => { setInnerTab("pagamento"); setXOpenPagtoDialog(true); }}
                  color="success"
                />
              )}
            </>
          );
        }}
        XHiddenTabs={(record) => {
          const st = record?.st_entrega;
          return (st === "S" || st === "P") ? [] : ["entrega"];
        }}
        config={{
          XTableName: "movimento",
          XPrimaryKey: "movimento_id",
          XTitle: "Pedidos",
          XDefaultRecord: { ...XDefaultRecord, empresa_id: XEmpresaId } as any,
          XEmpresaId,
          XSelectCols: "*",
          XOrderBy: "movimento_id",
          XKeepEditAfterInsert: true,
          XApplyFilter: (q) => q.in("tp_movimento", ["PD", "SV", "OR"]),
          XOnAfterLoad: (rows: any[]) => {
            const ids = Array.from(new Set(rows.map(r => r.cadastro_id).filter(Boolean))) as number[];
            if (ids.length) ensureClienteInfo(ids);
          },
          XOnBeforeSave: async (rec, mode) => {
            if (!rec.cadastro_id) throw new Error("Selecione o Cliente.");
            if (!rec.funcionario_id) throw new Error("Selecione o Vendedor.");
            if (!rec.dt_emissao) throw new Error("Informe a Data de Emissão.");
            if (!rec.dt_entrega) throw new Error("Informe a Data de Entrega.");
            if (mode === "edit" && (rec.st_entrega === "S" || rec.st_entrega === "P")) {
              if (!rec.cep_entrega?.trim()) throw new Error("Informe o CEP na aba Dados de Entrega.");
              if (!rec.cidade_id) throw new Error("Informe a Cidade na aba Dados de Entrega.");
              if (!rec.logradouro_entrega?.trim()) throw new Error("Informe o Logradouro na aba Dados de Entrega.");
              if (!rec.bairro_entrega?.trim()) throw new Error("Informe o Bairro na aba Dados de Entrega.");
              if (!rec.numero_entrega?.trim()) throw new Error("Informe o Número na aba Dados de Entrega.");
            }
            if (mode === "edit" && rec.st_pedido && rec.st_pedido !== "O") {
              throw new Error("Pedido não está em modo Orçamento; não pode ser alterado.");
            }
            const parseIfString = (v: any) => {
              if (typeof v === "number") return v;
              if (!v) return 0;
              let s = String(v).replace(/\s/g, "");
              if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
              const n = parseFloat(s);
              return isNaN(n) ? 0 : n;
            };
            const cleanRec = { ...rec };
            delete cleanRec.contato_entrega;
            if (cleanRec.pc_desconto !== undefined) cleanRec.pc_desconto = parseIfString(cleanRec.pc_desconto);
            if (cleanRec.vl_desconto !== undefined) cleanRec.vl_desconto = parseIfString(cleanRec.vl_desconto);
            if (cleanRec.vl_desc_rs !== undefined) cleanRec.vl_desc_rs = parseIfString(cleanRec.vl_desc_rs);

            const subtotalItens = XPedidoTotalCtx.itens.reduce((acc, i) => acc + Number(i.vl_movimento || 0), 0);
            if (cleanRec.tp_desconto === 'P') {
              const subtotalProd = XPedidoTotalCtx.itens.reduce((acc, i) => acc + Number(i.vl_produto || 0), 0);
              if (subtotalProd > 0) {
                if (cleanRec.vl_desconto > 0 && (!cleanRec.pc_desconto || cleanRec.pc_desconto === 0)) {
                  cleanRec.pc_desconto = +(cleanRec.vl_desconto / subtotalProd * 100).toFixed(2);
                } else if (cleanRec.pc_desconto > 0 && (!cleanRec.vl_desconto || cleanRec.vl_desconto === 0)) {
                  cleanRec.vl_desconto = +(subtotalProd * cleanRec.pc_desconto / 100).toFixed(2);
                }
              }
              cleanRec.vl_movimento = Math.max(0, subtotalItens - Number(cleanRec.vl_desconto || 0));
            } else {
              cleanRec.vl_movimento = subtotalItens;
            }

            if (mode === "insert" && !cleanRec.nr_movimento) {
              const { data: maxNr } = await db.from("movimento")
                .select("nr_movimento").eq("empresa_id", XEmpresaId).order("nr_movimento", { ascending: false }).limit(1);
              cleanRec.nr_movimento = ((maxNr && maxNr[0]?.nr_movimento) || 0) + 1;
            }

            return { ...cleanRec, empresa_id: cleanRec.empresa_id || XEmpresaId };
          },
          XOnAfterSave: async (rec, mode) => {
            if (mode === "insert") setXAutoNovoItem(n => n + 1);
            if (rec.movimento_id) {
              if (rec.st_entrega === "S" || rec.st_entrega === "N") {
                await db.from("movimento_item")
                  .update({ entrega: rec.st_entrega })
                  .eq("movimento_id", rec.movimento_id)
                  .eq("excluido", false);
              }
              await fetchItensCadastro(rec.movimento_id);
            }
          },
          XSoftDelete: false,
        }}
        XGridCols={gridCols}
        XExportTitle="Pedidos"
        XAfterInsertTab="itens"
        XRefreshRef={XCrudRefreshRef}
        XExtraTabs={[
          {
            key: "itens", label: "Itens do Pedido",
            render: ({ record }) => {
              const ped = record as IMovimento;
              return (
                <PedidoItensTab
                  pedido={ped?.movimento_id ? ped : null}
                  podeEditar={ped?.st_pedido === "O"}
                  tabelaPrecoId={ped?.tabela_preco_id || null}
                  autoNovoTrigger={XAutoNovoItem}
                  onTotalsChanged={(total, itens) => {
                    setXPedidoTotalCtx({ movimentoId: ped.movimento_id, total, itens });
                    setXPagamentoRefreshToken((n) => n + 1);
                  }}
                />
              );
            },
          },
          {
            key: "entrega", label: "Dados de Entrega",
            render: ({ record, setField, isEditing, setInnerTab }) => {
              const ro = !isEditing || record.st_pedido !== "O";
              if (!record?.movimento_id) {
                return <div className="text-sm text-muted-foreground p-4">Salve o pedido para inserir dados de entrega.</div>;
              }

              const handleCarregarDoCadastro = async () => {
                if (!record.cadastro_id) {
                  toast.error("Nenhum cliente selecionado no pedido.");
                  return;
                }
                try {
                  const { data, error } = await db.from("cadastro")
                    .select("endereco_cep, endereco_logradouro, endereco_numero, endereco_bairro, endereco_compl, endereco_ptoref, endereco_cidade_id, email, rota_id")
                    .eq("cadastro_id", record.cadastro_id)
                    .single();
                  if (error) throw error;
                  if (!data) { toast.error("Cliente não encontrado."); return; }

                  const cepDigits = (data.endereco_cep || "").replace(/\D/g, "");
                  const cepFormatted = cepDigits.length > 5
                    ? cepDigits.substring(0, 5) + "-" + cepDigits.substring(5, 8)
                    : cepDigits;

                  setField("cep_entrega" as any, cepFormatted);
                  setField("logradouro_entrega" as any, data.endereco_logradouro || "");
                  setField("numero_entrega" as any, data.endereco_numero || "");
                  setField("bairro_entrega" as any, data.endereco_bairro || "");
                  setField("endereco_compl_entrega" as any, data.endereco_compl || "");
                  setField("pto_ref_entrega" as any, data.endereco_ptoref || "");
                  setField("email_entrega" as any, data.email || "");
                  if (data.rota_id) setField("rota_id" as any, data.rota_id);

                  if (data.endereco_cidade_id) {
                    setField("cidade_id" as any, data.endereco_cidade_id);
                    // Garante que a cidade está na lista local
                    if (!XCidades.some(c => c.id === data.endereco_cidade_id)) {
                      const { data: cid } = await db.from("cidade")
                        .select("cidade_id, descricao, estado_id")
                        .eq("cidade_id", data.endereco_cidade_id)
                        .single();
                      if (cid) {
                        setXCidades(prev => [...prev, { id: cid.cidade_id, label: `${cid.descricao} - ${cid.estado_id || ""}` }]
                          .sort((a, b) => a.label.localeCompare(b.label)));
                      }
                    }
                  }

                  toast.success("Dados de entrega carregados do cadastro.");
                } catch (err: any) {
                  toast.error("Erro ao carregar dados do cadastro: " + (err.message || ""));
                }
              };

              return (
                <div className="space-y-3" onKeyDown={handleKeyDown}>
                  {/* Botão Carregar do Cadastro */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={ro}
                      onClick={handleCarregarDoCadastro}
                      className="flex items-center gap-1.5 px-3 py-1 text-xs rounded border border-border bg-muted hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Preencher endereço de entrega com os dados cadastrais do cliente"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      Carregar do Cadastro
                    </button>
                  </div>

                  {/* Linha 1: Rota | CEP | Cidade */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Rota</label>
                      <select disabled={ro} value={record.rota_id ?? ""} onChange={e => setField("rota_id" as any, e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                        <option value="">--</option>
                        {XRotas.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        CEP <span className="text-destructive">*</span>
                        {XBuscandoCep && <span className="text-[10px] text-primary animate-pulse">...</span>}
                      </label>
                      <input
                        disabled={ro || XBuscandoCep}
                        maxLength={9}
                        value={record.cep_entrega ?? ""}
                        placeholder="00000-000"
                        onChange={e => {
                          const val = e.target.value;
                          const digits = val.replace(/\D/g, "");
                          let formatted = digits;
                          if (digits.length > 5) {
                            formatted = digits.substring(0, 5) + "-" + digits.substring(5, 8);
                          }
                          setField("cep_entrega" as any, formatted);
                        }}
                        onBlur={e => {
                          const digits = e.target.value.replace(/\D/g, "");
                          if (digits.length === 8) {
                            handleBuscarCep(digits, setField);
                          }
                        }}
                        className="w-full border border-border rounded px-2 py-1 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div className="col-span-7">
                      <label className="text-xs text-muted-foreground">Cidade <span className="text-destructive">*</span></label>
                      <select disabled={ro} value={record.cidade_id ?? ""} onChange={e => setField("cidade_id" as any, e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                        <option value="">--</option>
                        {XCidades.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Linha 2: Logradouro | Bairro | Nº */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-7">
                      <label className="text-xs text-muted-foreground">Logradouro <span className="text-destructive">*</span></label>
                      <input disabled={ro} value={record.logradouro_entrega ?? ""} onChange={e => setField("logradouro_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-muted-foreground">Bairro <span className="text-destructive">*</span></label>
                      <input disabled={ro} value={record.bairro_entrega ?? ""} onChange={e => setField("bairro_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Nº <span className="text-destructive">*</span></label>
                      <input disabled={ro} value={record.numero_entrega ?? ""} onChange={e => setField("numero_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                  </div>
                  {/* Linha 3: Complemento | Ponto de Referência */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-5">
                      <label className="text-xs text-muted-foreground">Complemento</label>
                      <input disabled={ro} value={record.endereco_compl_entrega ?? ""} onChange={e => setField("endereco_compl_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                    <div className="col-span-7">
                      <label className="text-xs text-muted-foreground">Ponto de Referência</label>
                      <input disabled={ro} value={record.pto_ref_entrega ?? ""} onChange={e => setField("pto_ref_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                    </div>
                  </div>

                  {/* E-mail & Contato */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">E-mail</label>
                      <input
                        id="email_entrega_input"
                        disabled={ro}
                        value={record.email_entrega ?? ""}
                        onChange={e => setField("email_entrega" as any, e.target.value as any)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            const field = document.getElementById("contato_entrega_input");
                            if (field) {
                              field.focus();
                              (field as HTMLInputElement).select?.();
                            }
                          }
                        }}
                        className="w-full border border-border rounded px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="col-span-6">
                      <label className="text-xs text-muted-foreground">Contato</label>
                      <input
                        id="contato_entrega_input"
                        disabled={ro}
                        value={record.nm_responsavel ?? ""}
                        onChange={e => setField("nm_responsavel" as any, e.target.value as any)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.stopPropagation();
                            const field = document.getElementById("obs_entrega_textarea");
                            if (field) {
                              field.focus();
                              (field as HTMLTextAreaElement).select?.();
                            }
                          }
                        }}
                        className="w-full border border-border rounded px-2 py-1 text-sm"
                      />
                    </div>
                  </div>

                  {/* Obs. Entrega */}
                  <div>
                    <label className="text-xs text-muted-foreground">Obs. Entrega</label>
                    <textarea
                      id="obs_entrega_textarea"
                      disabled={ro}
                      value={record.obs_entrega ?? ""}
                      onChange={e => setField("obs_entrega" as any, e.target.value as any)}
                      className="w-full border border-border rounded px-2 py-2 text-sm min-h-[80px]"
                    />
                  </div>
                </div>
              );
            },
          },

          {
            key: "adicionais", label: "Dados Adicionais",
            render: ({ record, setField, isEditing }) => {
              const ro = !isEditing || record.st_pedido !== "O";
              if (!record?.movimento_id) {
                return <div className="text-sm text-muted-foreground p-4">Salve o pedido para inserir dados adicionais.</div>;
              }
              return (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Observação do Pedido</label>
                    <textarea
                      id="obs_pedido_textarea"
                      disabled={ro}
                      value={record.obs_pedido ?? ""}
                      onChange={e => setField("obs_pedido" as any, e.target.value as any)}
                      className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Observação NF</label>
                    <textarea disabled={ro} value={record.observacao_nf ?? ""} onChange={e => setField("observacao_nf" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]" />
                  </div>
                </div>
              );
            },
          },
          {
            key: "pagamento", label: "Forma de Pagamento",
            render: ({ record, setInnerTab }) => {
              const ped = record as IMovimento;
              return (
                <PedidoPagamentoTab
                  pedido={ped?.movimento_id ? ped : null}
                  podeEditar={ped?.st_pedido === "O"}
                  totalPedido={XPedidoTotalCtx.movimentoId === ped?.movimento_id ? XPedidoTotalCtx.total : Number(ped?.vl_movimento || 0)}
                  refreshToken={XPagamentoRefreshToken}
                  openDialog={XOpenPagtoDialog}
                  setOpenDialog={setXOpenPagtoDialog}
                  onMudarStatus={async (novo) => {
                    if (novo === "REFRESH") {
                      if (XCrudRefreshRef.current) await XCrudRefreshRef.current();
                    } else {
                      await mudarStatus(ped.movimento_id, novo);
                    }
                  }}
                  onRetornar={() => setInnerTab("cadastro")}
                />
              );
            },
          },
        ]}
        renderCadastro={({ record, setField, setRecord, mode, isEditing, currentRecord, setInnerTab, onSalvar }) => {
          return (
            <PedidoCadastroFormContent
              record={record}
              setField={setField}
              setRecord={setRecord}
              mode={mode}
              isEditing={isEditing}
              currentRecord={currentRecord}
              setInnerTab={setInnerTab}
              onSalvar={onSalvar}
              vendedores={XVendedores}
              tpOperacoes={XTpOperacoes}
              rotas={XRotas}
              cidades={XCidades}
              clientesCache={XClientesCache}
              setXClientesCache={setXClientesCache}
              abrirPesquisaCliente={abrirPesquisaCliente}
              clientePadraoId={XClientePadraoId}
              ensureClienteInfo={ensureClienteInfo}
              pedidoTotalCtx={XPedidoTotalCtx}
              setXMovimentoParaBuscar={setXMovimentoParaBuscar}
              setXModoInsertSemId={setXModoInsertSemId}
              handleKeyDown={handleKeyDown}
              fetchItensCadastro={fetchItensCadastro}
              tabelasPreco={XTabelasPreco}
              onTabelaPrecoChange={handleTabelaPrecoChange}
            />
          );
        }}
      />
      <ClienteSearchDialog
        open={XSearchOpen}
        onClose={() => setXSearchOpen(false)}
        empresaId={XEmpresaId}
        onSelect={(c) => XSearchTarget?.(c)}
      />
    </>
  );
};

export default PedidoForm;
