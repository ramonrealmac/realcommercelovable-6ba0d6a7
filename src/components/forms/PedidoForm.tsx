import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import type { IGridColumn } from "@/components/grid/DataGrid";
import type { IMovimento, IMovimentoItem } from "./pedido/types";
import DataGrid from "@/components/grid/DataGrid";
import { ST_PEDIDO_LABELS, TP_DESCONTO_LABELS } from "./pedido/types";
import PedidoItensTab from "./pedido/PedidoItensTab";
import PedidoPagamentoTab from "./pedido/PedidoPagamentoTab";
import ClienteSearchDialog, { IClienteRow } from "./pedido/ClienteSearchDialog";
import { Search } from "lucide-react";

const db = supabase as any;

interface ILookup { id: number; label: string; }
interface IClienteInfo { id: number; cnpj: string; razao: string; fantasia: string; }

const buildGridCols = (
  vendedores: ILookup[],
  clientesCache: Record<number, IClienteInfo>,
): IGridColumn[] => [
  { key: "nr_movimento", label: "Pedido", width: "90px", align: "right" },
  { key: "dt_emissao", label: "Emissão", width: "120px", render: r => r.dt_emissao ? new Date(r.dt_emissao).toLocaleDateString("pt-BR") : "" },
  {
    key: "_cliente", label: "Cliente", width: "2fr",
    getValue: r => clientesCache[r.cadastro_id]?.razao || "",
    render: r => clientesCache[r.cadastro_id]?.razao || (r.cadastro_id ? `#${r.cadastro_id}` : ""),
  },
  { key: "_vendedor", label: "Vendedor", width: "1fr", render: r => vendedores.find(v => v.id === r.funcionario_id)?.label || "" },

  { key: "st_pedido", label: "Status", width: "110px", render: r => ST_PEDIDO_LABELS[r.st_pedido] || r.st_pedido },
  { key: "vl_movimento", label: "Total", width: "120px", align: "right", render: r => Number(r.vl_movimento || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) },
  { key: "faturado", label: "Faturado", width: "90px" },
];

const XDefaultRecord: Partial<IMovimento> = {
  tp_movimento: "PD",
  tp_origem: "PDV",
  st_pedido: "O",
  faturado: "N",
  tp_desconto: "N",
  pc_desconto: 0,
  vl_produto: 0,
  vl_desconto: 0,
  vl_movimento: 0,
  vl_frete: 0,
  vl_despesa: 0,
  vl_seguro: 0,
  vl_outro: 0,
  obs_pedido: "",
  dt_emissao: new Date().toISOString().substring(0, 10),
  dt_entrega: new Date().toISOString().substring(0, 10),
};

const PedidoForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const [XVendedores, setXVendedores] = useState<ILookup[]>([]);
  const [XTpOperacoes, setXTpOperacoes] = useState<ILookup[]>([]);
  const [XRotas, setXRotas] = useState<ILookup[]>([]);
  const [XCidades, setXCidades] = useState<ILookup[]>([]);
  const [XClientesCache, setXClientesCache] = useState<Record<number, IClienteInfo>>({});
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTarget, setXSearchTarget] = useState<((c: IClienteRow) => void) | null>(null);
  const [XAutoNovoItem, setXAutoNovoItem] = useState(0);
  const [XPagamentoRefreshToken, setXPagamentoRefreshToken] = useState(0);
  const [XPedidoTotalCtx, setXPedidoTotalCtx] = useState<{ movimentoId: number | null; total: number; itens: IMovimentoItem[] }>({ movimentoId: null, total: 0, itens: [] });
  const XFetchingItensRef = useRef<Set<number>>(new Set());
  // Ref para acionar refresh do CRUD sem window.location.reload()
  const XCrudRefreshRef = useRef<(() => Promise<void>) | null>(null);
  // Ref estável para XClientesCache — evita dependência instável em useCallback
  const XClientesCacheRef = useRef<Record<number, IClienteInfo>>(XClientesCache);
  useEffect(() => { XClientesCacheRef.current = XClientesCache; }, [XClientesCache]);

  // Lookups independentes — falha em um não bloqueia os outros
  useEffect(() => {
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
      db.from("funcionario").select("funcionario_id, nome").order("nome").limit(500),
      (d) => setXVendedores(d.map((c: any) => ({ id: c.funcionario_id, label: c.nome }))),
      "funcionario",
    );
    load(
      db.from("tp_operacao").select("tp_operacao_id, descricao").order("descricao"),
      (d) => setXTpOperacoes(d.map((t: any) => ({ id: t.tp_operacao_id, label: t.descricao }))),
      "tp_operacao",
    );
    load(
      db.from("rota").select("rota_id, descricao").eq("excluido", false).order("descricao"),
      (d) => setXRotas(d.map((r: any) => ({ id: r.rota_id, label: r.descricao }))),
      "rota",
    );
    load(
      db.from("cidade").select("cidade_id, descricao, uf").eq("excluido", false).order("descricao").limit(1000),
      (d) => setXCidades(d.map((c: any) => ({ id: c.cidade_id, label: `${c.descricao} - ${c.uf || ""}` }))),
      "cidade",
    );
  }, []);


  // Resolve nomes de clientes para o grid sob demanda
  // Usa ref para evitar dependência instável (XClientesCache muda a cada adição)
  const ensureClienteInfo = useCallback(async (ids: number[]) => {
    const faltando = ids.filter(id => id && !XClientesCacheRef.current[id]);
    if (!faltando.length) return;
    const { data, error } = await db.from("cadastro")
      .select("cadastro_id, cnpj, razao_social, nome_fantasia")
      .in("cadastro_id", faltando);
    if (error) { toast.error("Erro ao carregar clientes: " + error.message); return; }
    if (data) {
      setXClientesCache(prev => {
        const next = { ...prev };
        for (const c of data as any[]) {
          next[c.cadastro_id] = { id: c.cadastro_id, cnpj: c.cnpj || "", razao: c.razao_social || "", fantasia: c.nome_fantasia || "" };
        }
        return next;
      });
    }
  }, []); // dependência estável via ref

  const abrirPesquisaCliente = (onPick: (c: IClienteRow) => void) => {
    setXSearchTarget(() => onPick);
    setXSearchOpen(true);
  };

  // Status change helpers (Orçamento / Caixa buttons)
  // Usa refresh do CRUD em vez de window.location.reload() para preservar estado
  const mudarStatus = useCallback(async (movimento_id: number, novo: string) => {
    if (!movimento_id) { toast.error("Salve o pedido primeiro."); return; }
    const { error } = await db.from("movimento")
      .update({ st_pedido: novo, dt_alteracao: new Date().toISOString() })
      .eq("movimento_id", movimento_id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Status alterado para ${ST_PEDIDO_LABELS[novo] || novo}.`);
    if (XCrudRefreshRef.current) {
      await XCrudRefreshRef.current();
    }
  }, []);

  const fetchItensCadastro = useCallback(async (movimento_id: number) => {
    const { data } = await db.from("movimento_item")
      .select("*").eq("movimento_id", movimento_id).eq("excluido", false)
      .order("movimento_item_id");
    const itens = (data || []) as IMovimentoItem[];
    const total = itens.reduce((a, i) => a + Number(i.vl_movimento || 0), 0);
    setXPedidoTotalCtx({ movimentoId: movimento_id, total, itens });
  }, []);

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
      config={{
        XTableName: "movimento",
        XPrimaryKey: "movimento_id",
        XTitle: "Pedidos",
        XDefaultRecord: { ...XDefaultRecord, empresa_id: XEmpresaId } as any,
        XEmpresaId,
        XSelectCols: "*",
        XOrderBy: "movimento_id",
        XApplyFilter: (q) => q.in("tp_movimento", ["PD", "SV", "OR"]),
        XOnAfterLoad: (rows: any[]) => {
          const ids = Array.from(new Set(rows.map(r => r.cadastro_id).filter(Boolean))) as number[];
          if (ids.length) ensureClienteInfo(ids);
        },
        XOnBeforeSave: (rec, mode) => {
          if (!rec.cadastro_id) throw new Error("Selecione o Cliente.");
          if (!rec.funcionario_id) throw new Error("Selecione o Vendedor.");
          if (!rec.dt_emissao) throw new Error("Informe a Data de Emissão.");
          if (!rec.dt_entrega) throw new Error("Informe a Data de Entrega.");
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
          if (cleanRec.pc_desconto !== undefined) cleanRec.pc_desconto = parseIfString(cleanRec.pc_desconto);
          if (cleanRec.vl_desconto !== undefined) cleanRec.vl_desconto = parseIfString(cleanRec.vl_desconto);
          if (cleanRec.vl_desc_rs !== undefined) cleanRec.vl_desc_rs = parseIfString(cleanRec.vl_desc_rs);
          
          if (cleanRec.tp_desconto === 'P') {
            const subtotal = XPedidoTotalCtx.itens.reduce((acc, i) => acc + Number(i.vl_produto || 0), 0);
            if (subtotal > 0) {
              if (cleanRec.vl_desconto > 0 && (!cleanRec.pc_desconto || cleanRec.pc_desconto === 0)) {
                cleanRec.pc_desconto = +(cleanRec.vl_desconto / subtotal * 100).toFixed(2);
              } else if (cleanRec.pc_desconto > 0 && (!cleanRec.vl_desconto || cleanRec.vl_desconto === 0)) {
                cleanRec.vl_desconto = +(subtotal * cleanRec.pc_desconto / 100).toFixed(2);
              }
            }
          }

          return { ...cleanRec, empresa_id: cleanRec.empresa_id || XEmpresaId };
        },
        XOnAfterSave: async (rec, mode) => {
          if (mode === "insert") setXAutoNovoItem(n => n + 1);
          if (rec.movimento_id) {
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
          render: ({ record, currentRecord, mode }) => {
            const ped = (mode === "insert" ? record : (currentRecord || record)) as IMovimento;
            return (
              <PedidoItensTab
                pedido={ped?.movimento_id ? ped : null}
                podeEditar={ped?.st_pedido === "O"}
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
          render: ({ record, setField, isEditing }) => {
            const ro = !isEditing || record.st_pedido !== "O";
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Rota</label>
                    <select disabled={ro} value={record.rota_id ?? ""} onChange={e => setField("rota_id" as any, e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                      <option value="">--</option>
                      {XRotas.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">CEP</label>
                    <input disabled={ro} value={record.cep_entrega ?? ""} onChange={e => setField("cep_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="col-span-7">
                    <label className="text-xs text-muted-foreground">Cidade</label>
                    <select disabled={ro} value={record.cidade_id ?? ""} onChange={e => setField("cidade_id" as any, e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                      <option value="">--</option>
                      {XCidades.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-7">
                    <label className="text-xs text-muted-foreground">Logradouro</label>
                    <input disabled={ro} value={record.logradouro_entrega ?? ""} onChange={e => setField("logradouro_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-muted-foreground">Bairro</label>
                    <input disabled={ro} value={record.bairro_entrega ?? ""} onChange={e => setField("bairro_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground">Nº</label>
                    <input disabled={ro} value={record.numero_entrega ?? ""} onChange={e => setField("numero_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">E-mail</label>
                  <input disabled={ro} value={record.email_entrega ?? ""} onChange={e => setField("email_entrega" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                </div>
              </div>
            );
          },
        },
        {
          key: "adicionais", label: "Dados Adicionais",
          render: ({ record, setField, isEditing }) => {
            const ro = !isEditing || record.st_pedido !== "O";
            return (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Observação do Pedido</label>
                  <textarea disabled={ro} value={record.obs_pedido ?? ""} onChange={e => setField("obs_pedido" as any, e.target.value as any)} className="w-full border border-border rounded px-2 py-2 text-sm min-h-[100px]" />
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
          render: ({ record, currentRecord, mode }) => {
            const ped = (mode === "insert" ? record : (currentRecord || record)) as IMovimento;
            return (
              <PedidoPagamentoTab
                pedido={ped?.movimento_id ? ped : null}
                podeEditar={ped?.st_pedido === "O"}
                totalPedido={XPedidoTotalCtx.movimentoId === ped?.movimento_id ? XPedidoTotalCtx.total : Number(ped?.vl_movimento || 0)}
                refreshToken={XPagamentoRefreshToken}
                onMudarStatus={(novo) => {
                  if (novo === "REFRESH") {
                    if (XCrudRefreshRef.current) XCrudRefreshRef.current();
                  } else {
                    mudarStatus(ped.movimento_id, novo);
                  }
                }}
              />
            );
          },
        },
      ]}
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => {
        const stAtual = (record.st_pedido || "O") as string;
        const ro = !isEditing || (mode === "edit" && stAtual !== "O");
        const fmt = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtQ = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

        const fmtInput = (v: any, dec = 2) => {
          if (v === 0 || v === "0") return Number(0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
          if (v === "" || v === undefined || v === null) return "";
          if (typeof v === "number") return v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
          return String(v);
        };

        const parseNum = (v: any) => {
          if (!v) return 0;
          if (typeof v === "number") return v;
          let s = String(v).replace(/\s/g, "");
          if (s.includes(",")) {
            s = s.replace(/\./g, "").replace(",", ".");
          }
          const n = parseFloat(s);
          return isNaN(n) ? 0 : n;
        };

        // Itens em cache (sincronizados com a aba Itens)
        const movId = currentRecord?.movimento_id;
        const isInsertNovo = mode === "insert" && !movId;
        const itensCache = !isInsertNovo && XPedidoTotalCtx.movimentoId === movId ? XPedidoTotalCtx.itens : [];

        // Sinaliza side-effects via state (sem executar async direto no render)
        if (!isInsertNovo && movId && XPedidoTotalCtx.movimentoId !== movId) {
          queueMicrotask(() => setXMovimentoParaBuscar(movId));
        }
        if (isInsertNovo && (XPedidoTotalCtx.movimentoId !== null || XPedidoTotalCtx.itens.length > 0)) {
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

        const handleBlur = (key: string, val: any, decimals = 2) => {
          const n = parseNum(val);
          if (key === 'pc_desconto') {
            const sub = T.vl_produto;
            const calcVl = +(sub * n / 100).toFixed(2);
            setField("pc_desconto", n as any);
            setField("vl_desconto", calcVl as any);
          } else if (key === 'vl_desconto') {
            const sub = T.vl_produto;
            const calcPc = sub > 0 ? +(n / sub * 100).toFixed(2) : 0;
            setField("vl_desconto", n as any);
            setField("pc_desconto", calcPc as any);
          } else {
            setField(key as any, n as any);
          }
        };

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
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Pedido</label>
                <input readOnly value={record.nr_movimento ?? (mode === "insert" ? "(Novo)" : "")} className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
              </div>
              <div className="col-span-5">
                <label className="text-xs text-muted-foreground">Cliente <span className="text-destructive">*</span></label>
                <div className="flex gap-1">
                  <input
                    readOnly
                    value={record.cadastro_id ? (XClientesCache[record.cadastro_id]?.razao || `#${record.cadastro_id}`) : ""}
                    placeholder="Clique na lupa para pesquisar..."
                    className="flex-1 border border-border rounded px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={ro}
                    onClick={() => abrirPesquisaCliente((c) => {
                      setXClientesCache(prev => ({ ...prev, [c.cadastro_id]: { id: c.cadastro_id, cnpj: c.cnpj || "", razao: c.razao_social || "", fantasia: c.nome_fantasia || "" } }));
                      setField("cadastro_id", c.cadastro_id as any);
                    })}
                    className="px-2 py-1 border border-border rounded bg-card hover:bg-accent disabled:opacity-50"
                    title="Pesquisar cliente"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  {record.cadastro_id && !ro && (
                    <button
                      type="button"
                      onClick={() => setField("cadastro_id", null as any)}
                      className="px-2 py-1 border border-border rounded bg-card hover:bg-accent text-xs"
                      title="Limpar"
                    >×</button>
                  )}
                </div>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Vendedor <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.funcionario_id ?? ""} onChange={e => setField("funcionario_id", e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value="">--</option>
                  {XVendedores.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Status</label>
                <input readOnly value={ST_PEDIDO_LABELS[stAtual] || stAtual} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Faturado</label>
                <input readOnly value={record.faturado ?? "N"} className="w-full border border-border rounded px-2 py-1 text-sm text-center" />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Emissão <span className="text-destructive">*</span></label>
                <input type="date" disabled={ro} value={(record.dt_emissao || "").toString().substring(0, 10)} onChange={e => setField("dt_emissao", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Dt. Entrega <span className="text-destructive">*</span></label>
                <input type="date" disabled={ro} value={(record.dt_entrega || "").toString().substring(0, 10)} onChange={e => setField("dt_entrega", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo de Operação</label>
                <select disabled={ro} value={record.tp_operacao_id ?? ""} onChange={e => setField("tp_operacao_id", e.target.value ? Number(e.target.value) : null as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value="">--</option>
                  {XTpOperacoes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo de Movimento <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_movimento || "PD"} onChange={e => setField("tp_movimento", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  <option value="PD">Pedido</option>
                  <option value="SV">Saída por Venda</option>
                  <option value="OR">Orçamento</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">NF</label>
                <input readOnly value={record.numero_nfe ?? ""} className="w-full border border-border rounded px-2 py-1 text-sm text-right" />
              </div>
            </div>

            {/* Linha do Tipo de Desconto + Botões de status à direita */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo de Desconto <span className="text-destructive">*</span></label>
                <select disabled={ro} value={record.tp_desconto || "N"} onChange={e => setField("tp_desconto", e.target.value as any)} className="w-full border border-border rounded px-2 py-1 text-sm">
                  {Object.entries(TP_DESCONTO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="col-span-9" /> {/* Espaçador para manter alinhamento */}
              {currentRecord?.movimento_id && (
                <div className="col-span-12 sm:col-span-auto ml-auto flex gap-2 justify-end">
                  {stAtual === "O" && (
                    <button onClick={() => { if (confirm("Confirma o envio deste pedido para o Caixa?")) mudarStatus(currentRecord.movimento_id, "P"); }} className="text-sm px-4 py-1.5 rounded bg-primary text-primary-foreground">→ Caixa (Pedido)</button>
                  )}
                  {stAtual === "P" && (
                    <button onClick={() => mudarStatus(currentRecord.movimento_id, "O")} className="text-sm px-4 py-1.5 rounded border border-border">↩ Voltar p/ Orçamento</button>
                  )}
                  {(stAtual === "O" || stAtual === "P") && (
                    <button onClick={() => { if (confirm("Confirma o cancelamento deste pedido?")) mudarStatus(currentRecord.movimento_id, "C"); }} className="text-sm px-4 py-1.5 rounded border border-destructive text-destructive">Cancelar Pedido</button>
                  )}
                </div>
              )}
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
                      { label: "Desc. (R$)", value: T.vl_desconto },
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
                      <span className="text-lg font-bold text-primary text-right tabular-nums">{fmt(T.vl_movimento)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
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
