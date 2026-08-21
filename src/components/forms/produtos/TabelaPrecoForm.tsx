import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import FormDateField from "@/components/shared/FormDateField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import DataGrid, { IGridColumn, exportAsPdf, exportAsCsv, exportAsText } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, File, FileSpreadsheet, FileText, Loader2, PackagePlus, Search, Trash2 } from "lucide-react";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import ProdutoSearchDialog, { IProdutoRow } from "@/components/forms/pedido/ProdutoSearchDialog";

import { Checkbox } from "@/components/ui/checkbox";

// v110430
const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ITabelaPreco {
  tabela_id: number;
  cd_tabela: number;
  empresa_id: number;
  descricao: string;
  dt_inicial: string | null;
  dt_final: string | null;
  ativa?: boolean;
  excluido: boolean;
  tp_pagamento?: string;
}

interface ITabelaPrecoItem {
  tabela_item_id: number;
  tabela_id: number;
  produto_id: number;
  cd_produto: string | null;
  nm_produto: string;
  preco: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNum = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// ─── Grid Columns for Localizar ───────────────────────────────────────────────

const XGridCols: IGridColumn[] = [
  { key: "cd_tabela", label: "Código", width: "90px", align: "right" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "tp_pagamento", label: "Tipo Pagamento", width: "120px", align: "center", render: r => r.tp_pagamento === "P" ? "A PRAZO" : "A VISTA" },
  { key: "dt_inicial", label: "Dt. Inicial", width: "110px", align: "center", render: r => r.dt_inicial ?? "" },
  { key: "dt_final", label: "Dt. Final", width: "110px", align: "center", render: r => r.dt_final ?? "" },
  { key: "ativa", label: "Ativa", width: "80px", align: "center", render: r => (r.ativa ?? true) ? "Sim" : "Não" },
];

// ─── Items Sub-grid ────────────────────────────────────────────────────────────

export interface IItensGridProps {
  tabela: ITabelaPreco | null;
  isEditing: boolean;
}

export const ITEM_COLS: IGridColumn[] = [
  { key: "cd_produto", label: "Código", width: "90px", align: "right", render: r => r.cd_produto || r.produto_id },
  { key: "nm_produto", label: "Descrição", width: "3fr" },
  { key: "preco", label: "Preço", width: "130px", align: "right", render: r => fmt(r.preco) },
];

export const ItensGrid: React.FC<IItensGridProps> = ({ tabela, isEditing }) => {
  const { handleKeyDown } = useEnterTraversal();
  const { XEmpresaMatrizId } = useAppContext();
  const [XItens, setXItens] = useState<ITabelaPrecoItem[]>([]);
  const [XEdit, setXEdit] = useState<Partial<ITabelaPrecoItem> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSearchOpen, setXSearchOpen] = useState(false);
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XSearchResults, setXSearchResults] = useState<any[]>([]);
  const [XOpenProdutoSearch, setXOpenProdutoSearch] = useState(false);

  // Refs de Foco
  const codigoInputRef = useRef<HTMLInputElement>(null);
  const precoInputRef = useRef<HTMLInputElement>(null);
  const salvarBtnRef = useRef<HTMLButtonElement>(null);

  // Paginação — usamos refs para não ter stale closure em loadItens
  const PAGE_SIZE = 1000;
  const [XPage, setXPage] = useState(0);
  const [XTotalItens, setXTotalItens] = useState(0);
  const pageRef = useRef(0);

  // Estado de Carregamento
  const [XLoadingItens, setXLoadingItens] = useState(false);
  const [XProcessing, setXProcessing] = useState(false);

  // Estados de Habilitação dos botões de lote
  const [XBtnIncluirHabilitado, setXBtnIncluirHabilitado] = useState(true);
  const [XBtnExcluirHabilitado, setXBtnExcluirHabilitado] = useState(false);

  // Estado e Ref de Exportação
  const [XShowExport, setXShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setXShowExport(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ordenação Server-side
  const [XSorts, setXSorts] = useState<any[]>([
    { key: "nm_produto", dir: "asc" }
  ]);

  // Filtros de coluna — usamos refs para loadItens e estado local para inputs controlados
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const XSearchFiltersRef = useRef<Record<string, string>>({});
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // loadItens lê SEMPRE dos refs e do estado de ordenação — nunca fica desatualizado
  const loadItens = useCallback(async () => {
    if (!tabela?.tabela_id) { setXItens([]); setXTotalItens(0); return; }

    setXLoadingItens(true);
    try {
      const filters = XSearchFiltersRef.current;
      const cod = (filters.cd_produto || "").trim();
      const desc = (filters.nm_produto || "").trim();
      const precoStr = (filters.preco || "").trim();
      const page = pageRef.current;

      // Ordenação
      const sortInfo = XSorts[0] || { key: "nm_produto", dir: "asc" };
      const sortKey = sortInfo.key;
      const sortAsc = sortInfo.dir === "asc";

      let query = db
        .from("tabela_preco_item")
        .select("*")
        .eq("tabela_id", tabela.tabela_id)
        .eq("excluido", false);

      let countQuery = db
        .from("tabela_preco_item")
        .select("tabela_item_id", { count: "exact" })
        .eq("tabela_id", tabela.tabela_id)
        .eq("excluido", false);

      // Código (Campo Numérico) = busca exata no banco
      if (cod) {
        query = query.eq("cd_produto", cod);
        countQuery = countQuery.eq("cd_produto", cod);
      }
      // Descrição (Campo Alfanumérico) = busca parcial contendo o valor (%CAFÉ%)
      if (desc) {
        query = query.ilike("nm_produto", `%${desc}%`);
        countQuery = countQuery.ilike("nm_produto", `%${desc}%`);
      }
      // Preço = exato
      if (precoStr) {
        const num = Number(precoStr.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
        if (!isNaN(num) && num > 0) {
          query = query.eq("preco", num);
          countQuery = countQuery.eq("preco", num);
        }
      }

      const { count, error: countErr } = await countQuery;
      if (countErr) { console.error("Erro count:", countErr); }
      const totalCount = count || 0;
      setXTotalItens(totalCount);
      const temItens = totalCount > 0;
      setXBtnIncluirHabilitado(!temItens);
      setXBtnExcluirHabilitado(temItens);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query
        .order(sortKey, { ascending: sortAsc })
        .range(from, to);

      if (error) { toast.error("Erro ao carregar itens: " + error.message); return; }
      console.log("[TabelaPreco] loadItens:", { tabela_id: tabela.tabela_id, cod, desc, page, from, to, count, rows: data?.length, sortKey, sortAsc });
      setXItens(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setXLoadingItens(false);
    }
  }, [tabela?.tabela_id, XSorts]);

  // Dispara loadItens quando a tabela ou ordenação mudar
  useEffect(() => { loadItens(); }, [loadItens]);

  // Cleanup de timeouts na desmontagem do componente
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Reset tudo quando a tabela mudar
  useEffect(() => {
    pageRef.current = 0;
    XSearchFiltersRef.current = {};
    setXPage(0);
    setXTotalItens(0);
    setXSearchFilters({});
    setXSorts([{ key: "nm_produto", dir: "asc" }]);
    setXEdit(null);
    setXEditingId(null);
    setXSelectedIdx(null);
    setXSearchOpen(false);
    setXSearchTerm("");
    setXSearchResults([]);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, [tabela?.tabela_id]);

  // Handler de mudança de filtro com debounce de 400ms para evitar concorrência no banco
  const handleFilterChange = (key: string, value: string) => {
    const next = { ...XSearchFilters, [key]: value };
    setXSearchFilters(next);
    XSearchFiltersRef.current = next;
    pageRef.current = 0;
    setXPage(0);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      loadItens();
    }, 400);
  };

  // Botões Anterior/Próximo
  const gotoPage = (p: number) => {
    pageRef.current = p;
    setXPage(p);
    loadItens();
  };

  const novo = () => {
    setXEditingId(null);
    setXEdit({ preco: 0 });
    setXSearchTerm("");
    setXSearchResults([]);
    setTimeout(() => {
      codigoInputRef.current?.focus();
    }, 50);
  };

  const editar = (it: ITabelaPrecoItem) => {
    setXEdit({ ...it });
    setXEditingId(it.tabela_item_id);
    setXSearchTerm(it.cd_produto || String(it.produto_id));
    setXSearchResults([]);
  };

  const cancelar = () => {
    setXEdit(null);
    setXEditingId(null);
    setXSearchTerm("");
    setXSearchResults([]);
    setXSearchOpen(false);
  };

  const salvar = async () => {
    if (!tabela?.tabela_id) { toast.error("Salve a tabela antes de incluir itens."); return; }
    if (!XEdit?.produto_id) { toast.error("Selecione um produto."); return; }
    if ((XEdit.preco ?? 0) <= 0) { toast.error("Informe um preço válido."); return; }

    const payload = {
      tabela_id: tabela.tabela_id,
      produto_id: XEdit.produto_id,
      cd_produto: XEdit.cd_produto,
      nm_produto: XEdit.nm_produto,
      preco: parseNum(XEdit.preco),
      excluido: false,
    };

    if (XEditingId) {
      const { error } = await db.from("tabela_preco_item").update(payload).eq("tabela_item_id", XEditingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Item atualizado.");
    } else {
      const { data: dup } = await db.from("tabela_preco_item")
        .select("tabela_item_id").eq("tabela_id", tabela.tabela_id)
        .eq("produto_id", XEdit.produto_id).eq("excluido", false).maybeSingle();
      if (dup) { toast.error("Produto já está na tabela."); return; }
      const { error } = await db.from("tabela_preco_item").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Item incluído.");
    }
    setXEdit(null);
    setXEditingId(null);
    setXSearchTerm("");
    setXSearchResults([]);
    await loadItens();
  };

  const excluir = async (it: ITabelaPrecoItem) => {
    if (!confirm("Excluir este item?")) return;
    const { error } = await db.from("tabela_preco_item").update({ excluido: true }).eq("tabela_item_id", it.tabela_item_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item excluído.");
    await loadItens();
  };

  const incluirTodosProdutos = async () => {
    if (!tabela?.tabela_id) { toast.error("Salve a tabela primeiro."); return; }
    if (!confirm("Incluir todos os produtos cadastrados na tabela? Produtos já existentes não serão duplicados.")) return;

    setXLoadingItens(true);
    try {
      const BATCH_SIZE = 1000;

      // 1. Busca TODOS os produtos ativos da empresa logada em loops paginados de 1000
      let prods: any[] = [];
      let prodPage = 0;
      let prodHasMore = true;

      while (prodHasMore) {
        const from = prodPage * BATCH_SIZE;
        const to = from + BATCH_SIZE - 1;
        const { data, error } = await db
          .from("produto")
          .select("produto_id, cd_produto, nome, preco_venda")
          .eq("empresa_id", tabela.empresa_id || XEmpresaMatrizId)
          .eq("excluido", false)
          .order("nome")
          .range(from, to);

        if (error) {
          toast.error("Erro ao carregar produtos: " + error.message);
          return;
        }

        if (!data || data.length === 0) {
          prodHasMore = false;
        } else {
          prods.push(...data);
          if (data.length < BATCH_SIZE) {
            prodHasMore = false;
          } else {
            prodPage++;
          }
        }
      }

      // 2. Busca TODOS os produto_ids existentes na tabela de preços em loops paginados de 1000
      let existingIds = new Set<number>();
      let existPage = 0;
      let existHasMore = true;

      while (existHasMore) {
        const from = existPage * BATCH_SIZE;
        const to = from + BATCH_SIZE - 1;
        const { data, error } = await db
          .from("tabela_preco_item")
          .select("produto_id")
          .eq("tabela_id", tabela.tabela_id)
          .eq("excluido", false)
          .range(from, to);

        if (error) {
          toast.error("Erro ao carregar itens existentes: " + error.message);
          return;
        }

        if (!data || data.length === 0) {
          existHasMore = false;
        } else {
          data.forEach((e: any) => existingIds.add(e.produto_id));
          if (data.length < BATCH_SIZE) {
            existHasMore = false;
          } else {
            existPage++;
          }
        }
      }

      const novos = prods.filter((p: any) => !existingIds.has(p.produto_id));

      if (novos.length === 0) {
        toast.info("Todos os produtos já estão na tabela.");
        return;
      }

      const inserts = novos.map((p: any) => ({
        tabela_id: tabela.tabela_id,
        produto_id: p.produto_id,
        cd_produto: String(p.cd_produto ?? p.produto_id),
        nm_produto: p.nome,
        preco: Number(p.preco_venda || 0),
        excluido: false,
      }));

      const chunkSize = 50;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const chunk = inserts.slice(i, i + chunkSize);
        const { error: err } = await db.from("tabela_preco_item").insert(chunk);
        if (err) {
          toast.error("Erro ao inserir itens: " + err.message);
          return;
        }
      }

      toast.success(`${novos.length} produto(s) incluído(s).`);
      setXBtnIncluirHabilitado(false);
      setXBtnExcluirHabilitado(true);
      pageRef.current = 0;
      setXPage(0);
      await loadItens();
    } catch (e: any) {
      console.error(e);
    } finally {
      setXLoadingItens(false);
      setXProcessing(false);
    }
  };

  const buscarProdutos = async (term: string) => {
    if (!term.trim()) { setXSearchResults([]); return; }
    const { data } = await db
      .from("produto")
      .select("produto_id, cd_produto, nome, preco_venda")
      .eq("empresa_id", tabela?.empresa_id || XEmpresaMatrizId)
      .eq("excluido", false)
      .or(`nome.ilike.%${term}%,cd_produto.ilike.%${term}%`)
      .order("nome")
      .limit(20);
    setXSearchResults(data || []);
  };

  const selecionarProduto = (p: any) => {
    setXEdit(prev => ({
      ...prev,
      produto_id: p.produto_id,
      cd_produto: String(p.cd_produto ?? p.produto_id),
      nm_produto: p.nome,
      preco: Number(p.preco_venda || 0),
    }));
    setXSearchTerm(String(p.cd_produto ?? p.produto_id));
    setXSearchOpen(false);
    setXSearchResults([]);
  };

  const selecionarProdutoDePesquisa = (p: IProdutoRow) => {
    setXEdit(prev => ({
      ...prev,
      produto_id: p.produto_id,
      cd_produto: String(p.cd_produto ?? p.produto_id),
      nm_produto: p.nome,
      preco: Number(p.preco_venda || 0),
    }));
    setXSearchTerm(String(p.cd_produto ?? p.produto_id));
    setXOpenProdutoSearch(false);
    setXSearchResults([]);
    setTimeout(() => {
      precoInputRef.current?.focus();
      precoInputRef.current?.select();
    }, 100);
  };

  const excluirTodosItens = async () => {
    if (!tabela?.tabela_id) return;
    if (!confirm("Tem certeza que deseja excluir TODOS os produtos desta tabela de preço?")) return;
    
    setXProcessing(true);
    setXLoadingItens(true);
    try {
      const { error } = await db.from("tabela_preco_item").update({ excluido: true }).eq("tabela_id", tabela.tabela_id);
      if (error) { toast.error("Erro ao excluir todos: " + error.message); return; }
      toast.success("Todos os itens foram excluídos.");
      setXBtnIncluirHabilitado(true);
      setXBtnExcluirHabilitado(false);
      pageRef.current = 0;
      setXPage(0);
      await loadItens();
    } catch (e: any) {
      console.error(e);
    } finally {
      setXLoadingItens(false);
      setXProcessing(false);
    }
  };

  const itemSelecionado = XSelectedIdx != null ? XItens[XSelectedIdx] : null;
  const isTableSaved = !!tabela?.tabela_id;
  const ro = !isEditing || !isTableSaved;

  const toolbar = useMemo(() => (
    <GridActionToolbar
      actions={[
        gridActions.incluir(novo, ro),
        gridActions.alterar(
          () => { if (!itemSelecionado) { toast.error("Selecione um item."); return; } editar(itemSelecionado); },
          ro || !itemSelecionado
        ),
        null,
        gridActions.excluir(
          () => { if (!itemSelecionado) { toast.error("Selecione um item."); return; } excluir(itemSelecionado); },
          ro || !itemSelecionado
        ),
        null,
        gridActions.custom(ChevronsLeft, "Primeira Página", () => gotoPage(0), { disabled: XPage === 0 }),
        gridActions.custom(ChevronLeft, "Página Anterior", () => gotoPage(XPage - 1), { disabled: XPage === 0 }),
        gridActions.custom(ChevronRight, "Próxima Página", () => gotoPage(XPage + 1), { disabled: (XPage + 1) * PAGE_SIZE >= XTotalItens }),
        gridActions.custom(ChevronsRight, "Última Página", () => {
          const totalPages = Math.ceil(XTotalItens / PAGE_SIZE);
          gotoPage(Math.max(0, totalPages - 1));
        }, { disabled: (XPage + 1) * PAGE_SIZE >= XTotalItens }),
        null,
        gridActions.atualizar(loadItens),
      ]}
      extras={
        <div className="flex items-center gap-3 ml-1 flex-wrap">
          {!ro && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={incluirTodosProdutos}
                disabled={!XBtnIncluirHabilitado}
                title="Incluir todos os produtos"
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-emerald-600 dark:text-emerald-500 font-medium"
              >
                <PackagePlus size={14} />
                <span>Incluir Todos</span>
              </button>
              <button
                type="button"
                onClick={excluirTodosItens}
                disabled={!XBtnExcluirHabilitado}
                title="Excluir todos os produtos da tabela"
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-border bg-card hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-rose-600 dark:text-rose-500 font-medium"
              >
                <Trash2 size={14} />
                <span>Excluir Todos</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-l border-border pl-3">
            <span className="text-[11px] text-muted-foreground font-medium mr-1">
              Pág. {XPage + 1} ({XTotalItens > 0 ? XPage * PAGE_SIZE + 1 : 0}–{Math.min((XPage + 1) * PAGE_SIZE, XTotalItens)} de {XTotalItens})
            </span>
            <div className="relative" ref={exportRef}>
              <button
                type="button"
                onClick={() => setXShowExport(!XShowExport)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-border bg-card hover:bg-accent text-slate-600 dark:text-slate-400 font-medium transition-colors"
                title="Exportar dados da grid"
              >
                <Download size={14} className="text-sky-600 dark:text-sky-500" />
                <span>Exportar</span>
              </button>
              {XShowExport && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[160px] animate-in fade-in zoom-in duration-150">
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onClick={() => { exportAsPdf(ITEM_COLS, XItens, "Itens da Tabela de Preço"); setXShowExport(false); }}
                  >
                    <File size={14} className="text-rose-500" /> PDF (Impressão)
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onClick={() => { exportAsText(ITEM_COLS, XItens, "Itens da Tabela de Preço"); setXShowExport(false); }}
                  >
                    <FileText size={14} className="text-slate-500" /> Arquivo de Texto
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onClick={() => { exportAsCsv(ITEM_COLS, XItens, "Itens da Tabela de Preço"); setXShowExport(false); }}
                  >
                    <FileSpreadsheet size={14} className="text-emerald-600" /> Planilha Excel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      }
      count={`${XTotalItens} produto(s)`}
    />
  ), [XPage, XTotalItens, ro, itemSelecionado, loadItens, excluirTodosItens, incluirTodosProdutos, XBtnIncluirHabilitado, XBtnExcluirHabilitado, XShowExport, XItens]);

  return (
    <div className="mt-4 space-y-3 relative">
      {XProcessing && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-2 rounded border border-border">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-semibold text-foreground">Processando, por favor aguarde...</span>
        </div>
      )}
      <div className="border-t border-border pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Produtos da Tabela
          </h3>
          {!isTableSaved && (
            <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200/50 dark:border-rose-900/50 animate-pulse">
              Salve a tabela de preço acima para habilitar a inclusão de produtos
            </span>
          )}
        </div>
      </div>

      {isTableSaved && (
        <div className="flex items-center justify-between p-1.5 bg-secondary/15 rounded border border-border/40">
          {toolbar}
        </div>
      )}
 
      <div className={!isTableSaved ? "opacity-40 pointer-events-none select-none cursor-not-allowed" : ""}>
        {XEdit && (
          <div className="border border-border rounded p-3 space-y-2 bg-card mb-3" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Código</label>
                <input
                  ref={codigoInputRef}
                  readOnly
                  disabled={ro || !!XEditingId}
                  value={XSearchTerm}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setXOpenProdutoSearch(true);
                    }
                  }}
                  onClick={() => { if (!ro && !XEditingId) setXOpenProdutoSearch(true); }}
                  placeholder="Enter"
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary cursor-pointer hover:border-primary transition-colors text-right"
                />
              </div>
              <div className="col-span-1 flex items-end pb-px">
                <button
                  type="button"
                  disabled={ro || !!XEditingId}
                  onClick={() => setXOpenProdutoSearch(true)}
                  className="px-2 py-[5px] border border-border rounded bg-card hover:bg-accent disabled:opacity-50"
                  title="Pesquisar produto (F2 / Enter)"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <div className="col-span-6">
                <label className="text-xs text-muted-foreground">Descrição</label>
                <input
                  readOnly
                  tabIndex={-1}
                  value={XEdit.nm_produto || ""}
                  placeholder="Selecione um produto pressionando Enter ou clicando na lupa..."
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary"
                />
              </div>
              <div className="col-span-1">
                <label className="text-xs text-muted-foreground">Preço <span className="text-destructive">*</span></label>
                <CurrencyInput
                  ref={precoInputRef}
                  disabled={ro}
                  value={Number(XEdit.preco || 0)}
                  decimals={2}
                  onChange={val => setXEdit(prev => ({ ...prev!, preco: val }))}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      salvarBtnRef.current?.focus();
                    }
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-right [appearance:textfield]"
                />
              </div>
              <div className="col-span-3 flex items-end gap-1 justify-start">
                <button
                  ref={salvarBtnRef}
                  onClick={salvar}
                  disabled={ro}
                  className="text-sm px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {XEditingId ? "Salvar" : "Inserir"}
                </button>
                <button
                  type="button"
                  onClick={cancelar}
                  className="text-sm px-3 py-1 rounded border border-border hover:bg-accent transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
 
        <DataGrid
          columns={ITEM_COLS}
          data={XItens}
          showFilters
          filterValues={XSearchFilters}
          onFilterChange={handleFilterChange}
          maxHeight="350px"
          selectedIdx={XSelectedIdx}
          onRowClick={(_r, i) => setXSelectedIdx(i)}
          onRowDoubleClick={r => { if (isEditing) editar(r as ITabelaPrecoItem); }}
          showRecordCount={false}
          showExport={false}
          exportTitle="Itens da Tabela de Preço"
          sorts={XSorts}
          onSortChange={setXSorts}
          loading={XLoadingItens}
          isLoading={XLoadingItens}
        />
      </div>
 
      <ProdutoSearchDialog
        open={XOpenProdutoSearch}
        onClose={() => setXOpenProdutoSearch(false)}
        onSelect={selecionarProdutoDePesquisa}
      />
    </div>
  );
};

// ─── Main Form ────────────────────────────────────────────────────────────────

const TabelaPrecoForm: React.FC = () => {
  const { handleKeyDown } = useEnterTraversal();
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz
    ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}`
    : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<ITabelaPreco>
      config={{
        XTableName: "tabela_preco",
        XPrimaryKey: "tabela_id",
        XTitle: "Tabelas de Preço",
        XEmpresaId: XEmpresaMatrizId,
        XOrderBy: "cd_tabela",
        XNmForm: "tabelas-preco",
        XDefaultRecord: {
          descricao: "",
          dt_inicial: null,
          dt_final: null,
          ativa: true,
          tp_pagamento: "V",
        },
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.descricao?.trim()) throw new Error("A descrição é obrigatória.");
          if (!rec.dt_inicial || !String(rec.dt_inicial).trim()) throw new Error("Informe a Data Inicial.");
          if (!rec.dt_final || !String(rec.dt_final).trim()) throw new Error("Informe a Data Final.");

          if (mode === "insert") {
            // Auto-increment cd_tabela per empresa
            const { data } = await db
              .from("tabela_preco")
              .select("cd_tabela")
              .eq("empresa_id", XEmpresaMatrizId)
              .order("cd_tabela", { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextCd = ((data?.cd_tabela ?? 0) as number) + 1;
            return {
              ...rec,
              cd_tabela: nextCd,
              empresa_id: XEmpresaMatrizId,
              descricao: rec.descricao!.trim(),
              tp_pagamento: rec.tp_pagamento || "V",
              ativa: rec.ativa ?? true,
              excluido: false,
            };
          }

          return { ...rec, descricao: rec.descricao!.trim(), tp_pagamento: rec.tp_pagamento || "V", ativa: rec.ativa ?? true };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Tabelas de Preço"
      XAfterInsertTab="cadastro"
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Main Row: Código + Empresa + Descrição + Dt. Inicial + Dt. Final + Tipo Pagamento + Status */}
          <div className="flex flex-wrap items-end gap-3 bg-secondary/10 p-3 rounded-lg border border-border/60">
            {/* Código — sempre visível, desabilitado. Vazio na inclusão, preenchido na alteração/visualização */}
            <div className="w-20 shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Código</label>
              <input
                type="text"
                value={record.cd_tabela ?? ""}
                readOnly
                disabled
                className="w-full border border-border rounded px-2.5 py-1.5 text-sm bg-secondary/50 text-right font-mono text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Empresa — apenas informação, desabilitado */}
            <div className="w-48 shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Empresa</label>
              <input
                type="text"
                value={XEmpLabel}
                readOnly
                disabled
                className="w-full border border-border rounded px-2.5 py-1.5 text-sm bg-secondary/50 text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Descrição */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Descrição <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={record.descricao ?? ""}
                onChange={e => setField("descricao", e.target.value)}
                readOnly={!isEditing}
                autoFocus={isEditing}
                maxLength={120}
                placeholder="Insira a descrição da tabela..."
                className={`w-full border border-border rounded px-3 py-1.5 text-sm transition-all ${
                  isEditing
                    ? "bg-card focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none shadow-sm"
                    : "bg-secondary/40 text-muted-foreground"
                }`}
              />
            </div>

            {/* Dt. Inicial */}
            <FormDateField
              label="Dt. Inicial *"
              value={record.dt_inicial ?? ""}
              onChange={v => setField("dt_inicial", (v || null) as any)}
              readOnly={!isEditing}
              className="w-36 shrink-0"
            />

            {/* Dt. Final */}
            <FormDateField
              label="Dt. Final *"
              value={record.dt_final ?? ""}
              onChange={v => setField("dt_final", (v || null) as any)}
              readOnly={!isEditing}
              className="w-36 shrink-0"
            />

            {/* Combo Tipo Pagamento (A VISTA / A PRAZO) na mesma linha antes do Status */}
            <div className="w-32 shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Tipo Pagamento</label>
              <select
                disabled={!isEditing}
                value={record.tp_pagamento || "V"}
                onChange={e => setField("tp_pagamento", e.target.value as any)}
                className={`w-full border border-border rounded px-2 py-1.5 text-sm outline-none transition-all h-[34px] ${
                  isEditing
                    ? "bg-card focus:ring-2 focus:ring-primary/30 focus:border-primary"
                    : "bg-secondary/40 text-muted-foreground cursor-not-allowed"
                }`}
              >
                <option value="V">A VISTA</option>
                <option value="P">A PRAZO</option>
              </select>
            </div>

            {/* Ativa / Status */}
            <div className="w-24 shrink-0 flex flex-col justify-end pb-1.5">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Status</label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer h-[34px]">
                <Checkbox
                  checked={record.ativa ?? true}
                  onCheckedChange={c => setField("ativa", !!c as any)}
                  disabled={!isEditing}
                />
                <span>{(record.ativa ?? true) ? "Ativa" : "Inativa"}</span>
              </label>
            </div>
          </div>

          {/* Products grid */}
          <ItensGrid
            tabela={currentRecord as ITabelaPreco | null}
            isEditing={isEditing}
          />
        </div>
      )}
    />
  );
};

export default TabelaPrecoForm;

