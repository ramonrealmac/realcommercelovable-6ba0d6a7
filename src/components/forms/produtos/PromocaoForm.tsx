import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import StandardCrudForm from "@/components/shared/StandardCrudForm";
import FormDateField from "@/components/shared/FormDateField";
import { CurrencyInput } from "@/components/shared/CurrencyInput";
import DataGrid, { IGridColumn, exportAsPdf, exportAsCsv, exportAsText } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, File, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { useEnterTraversal } from "@/hooks/useEnterTraversal";
import ProdutoSearchDialog, { IProdutoRow } from "@/components/forms/pedido/ProdutoSearchDialog";

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface IPromocao {
  promocao_id: number;
  cd_promocao: number;
  empresa_id: number;
  descricao: string;
  dt_inicial: string | null;
  dt_final: string | null;
  excluido: boolean;
}

interface IPromocaoItem {
  promocao_item_id: number;
  promocao_id: number;
  produto_id: number;
  cd_produto: string | null;
  nm_produto: string;
  preco_base: number;
  percentual_desconto: number;
  valor_desconto: number;
  valor_promocional: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseNum = (v: any): number => {
  if (!v && v !== 0) return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// ─── Grid Columns for Localizar ───────────────────────────────────────────────

const XGridCols: IGridColumn[] = [
  { key: "cd_promocao", label: "Código", width: "90px", align: "right" },
  { key: "descricao", label: "Descrição", width: "2fr" },
  { key: "dt_inicial", label: "Dt. Inicial", width: "110px", align: "center", render: r => r.dt_inicial ?? "" },
  { key: "dt_final", label: "Dt. Final", width: "110px", align: "center", render: r => r.dt_final ?? "" },
];

// ─── Items Sub-grid ────────────────────────────────────────────────────────────

export interface IItensGridProps {
  promocao: IPromocao | null;
  isEditing: boolean;
}

export const ITEM_COLS: IGridColumn[] = [
  { key: "cd_produto", label: "Código", width: "90px", align: "right", render: r => r.cd_produto || r.produto_id },
  { key: "nm_produto", label: "Descrição", width: "2.5fr" },
  { key: "preco_base", label: "Preço Base", width: "110px", align: "right", render: r => fmt(r.preco_base) },
  { key: "percentual_desconto", label: "% Desconto", width: "100px", align: "right", render: r => `${fmt(r.percentual_desconto)}%` },
  { key: "valor_desconto", label: "R$ Desconto", width: "110px", align: "right", render: r => fmt(r.valor_desconto) },
  { key: "valor_promocional", label: "Preço Promocional", width: "130px", align: "right", render: r => fmt(r.valor_promocional) },
];

export const ItensGrid: React.FC<IItensGridProps> = ({ promocao, isEditing }) => {
  const { handleKeyDown } = useEnterTraversal();
  const { XEmpresaMatrizId } = useAppContext();
  const [XItens, setXItens] = useState<IPromocaoItem[]>([]);
  const [XEdit, setXEdit] = useState<Partial<IPromocaoItem> | null>(null);
  const [XEditingId, setXEditingId] = useState<number | null>(null);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XSearchTerm, setXSearchTerm] = useState("");
  const [XOpenProdutoSearch, setXOpenProdutoSearch] = useState(false);

  // Refs de Foco
  const codigoInputRef = useRef<HTMLInputElement>(null);
  const percentualInputRef = useRef<HTMLInputElement>(null);
  const valorDescontoInputRef = useRef<HTMLInputElement>(null);
  const valorPromocionalInputRef = useRef<HTMLInputElement>(null);
  const salvarBtnRef = useRef<HTMLButtonElement>(null);

  // Paginação
  const PAGE_SIZE = 1000;
  const [XPage, setXPage] = useState(0);
  const [XTotalItens, setXTotalItens] = useState(0);
  const pageRef = useRef(0);

  // Estado de Carregamento
  const [XLoadingItens, setXLoadingItens] = useState(false);
  const [XProcessing, setXProcessing] = useState(false);

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

  // Filtros de coluna
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const XSearchFiltersRef = useRef<Record<string, string>>({});
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar itens da promoção
  const loadItens = useCallback(async () => {
    if (!promocao?.promocao_id) { setXItens([]); setXTotalItens(0); return; }

    setXLoadingItens(true);
    try {
      const filters = XSearchFiltersRef.current;
      const cod = (filters.cd_produto || "").trim();
      const desc = (filters.nm_produto || "").trim();
      const page = pageRef.current;

      const sortInfo = XSorts[0] || { key: "nm_produto", dir: "asc" };
      const sortKey = sortInfo.key;
      const sortAsc = sortInfo.dir === "asc";

      let query = db
        .from("promocao_item")
        .select("*")
        .eq("promocao_id", promocao.promocao_id)
        .eq("excluido", false);

      let countQuery = db
        .from("promocao_item")
        .select("promocao_item_id", { count: "exact" })
        .eq("promocao_id", promocao.promocao_id)
        .eq("excluido", false);

      if (cod) {
        query = query.eq("cd_produto", cod);
        countQuery = countQuery.eq("cd_produto", cod);
      }
      if (desc) {
        query = query.ilike("nm_produto", `%${desc}%`);
        countQuery = countQuery.ilike("nm_produto", `%${desc}%`);
      }

      const { count, error: countErr } = await countQuery;
      if (countErr) console.error("Erro count:", countErr);
      const totalCount = count || 0;
      setXTotalItens(totalCount);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await query
        .order(sortKey, { ascending: sortAsc })
        .range(from, to);

      if (error) { toast.error("Erro ao carregar itens da promoção: " + error.message); return; }
      setXItens(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setXLoadingItens(false);
    }
  }, [promocao?.promocao_id, XSorts]);

  useEffect(() => { loadItens(); }, [loadItens]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  // Reset estados ao mudar de promoção
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
    setXSearchTerm("");
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
  }, [promocao?.promocao_id]);

  const handleFilterChange = (key: string, value: string) => {
    const next = { ...XSearchFilters, [key]: value };
    setXSearchFilters(next);
    XSearchFiltersRef.current = next;
    pageRef.current = 0;
    setXPage(0);

    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => { loadItens(); }, 400);
  };

  const gotoPage = (p: number) => {
    pageRef.current = p;
    setXPage(p);
    loadItens();
  };

  const novo = () => {
    setXEditingId(null);
    setXEdit({
      preco_base: 0,
      percentual_desconto: 0,
      valor_desconto: 0,
      valor_promocional: 0
    });
    setXSearchTerm("");
    setTimeout(() => {
      codigoInputRef.current?.focus();
    }, 50);
  };

  const editar = (it: IPromocaoItem) => {
    setXEdit({ ...it });
    setXEditingId(it.promocao_item_id);
    setXSearchTerm(it.cd_produto || String(it.produto_id));
  };

  const cancelar = () => {
    setXEdit(null);
    setXEditingId(null);
    setXSearchTerm("");
  };

  // Recálculos dinâmicos dos valores promocionais
  const handlePercentualChange = (pct: number) => {
    const base = Number(XEdit?.preco_base || 0);
    const descVal = base * (pct / 100);
    const promoVal = base - descVal;

    setXEdit(prev => ({
      ...prev!,
      percentual_desconto: pct,
      valor_desconto: Number(descVal.toFixed(4)),
      valor_promocional: Number(promoVal.toFixed(4)),
    }));
  };

  const handleValorDescontoChange = (vDesc: number) => {
    const base = Number(XEdit?.preco_base || 0);
    const pct = base > 0 ? (vDesc / base) * 100 : 0;
    const promoVal = base - vDesc;

    setXEdit(prev => ({
      ...prev!,
      valor_desconto: vDesc,
      percentual_desconto: Number(pct.toFixed(4)),
      valor_promocional: Number(promoVal.toFixed(4)),
    }));
  };

  const handleValorPromocionalChange = (vPromo: number) => {
    const base = Number(XEdit?.preco_base || 0);
    const descVal = base - vPromo;
    const pct = base > 0 ? (descVal / base) * 100 : 0;

    setXEdit(prev => ({
      ...prev!,
      valor_promocional: vPromo,
      valor_desconto: Number(descVal.toFixed(4)),
      percentual_desconto: Number(pct.toFixed(4)),
    }));
  };

  const salvar = async () => {
    if (!promocao?.promocao_id) { toast.error("Salve a promoção antes de incluir produtos."); return; }
    if (!XEdit?.produto_id) { toast.error("Selecione um produto."); return; }

    const vPromo = parseNum(XEdit.valor_promocional);
    if (vPromo < 0) { toast.error("Preço promocional não pode ser negativo."); return; }

    const payload = {
      promocao_id: promocao.promocao_id,
      produto_id: XEdit.produto_id,
      cd_produto: XEdit.cd_produto,
      nm_produto: XEdit.nm_produto,
      preco_base: parseNum(XEdit.preco_base),
      percentual_desconto: parseNum(XEdit.percentual_desconto),
      valor_desconto: parseNum(XEdit.valor_desconto),
      valor_promocional: vPromo,
      excluido: false,
    };

    if (XEditingId) {
      const { error } = await db.from("promocao_item").update(payload).eq("promocao_item_id", XEditingId);
      if (error) { toast.error(error.message); return; }
      toast.success("Item atualizado.");
    } else {
      const { data: dup } = await db.from("promocao_item")
        .select("promocao_item_id").eq("promocao_id", promocao.promocao_id)
        .eq("produto_id", XEdit.produto_id).eq("excluido", false).maybeSingle();
      if (dup) { toast.error("Produto já está cadastrado nesta promoção."); return; }
      const { error } = await db.from("promocao_item").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Item incluído.");
    }
    setXEdit(null);
    setXEditingId(null);
    setXSearchTerm("");
    await loadItens();
  };

  const excluir = async (it: IPromocaoItem) => {
    if (!confirm("Excluir este item da promoção?")) return;
    const { error } = await db.from("promocao_item").update({ excluido: true }).eq("promocao_item_id", it.promocao_item_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item removido da promoção.");
    await loadItens();
  };

  const selecionarProdutoDePesquisa = (p: IProdutoRow) => {
    const base = Number(p.preco_venda || 0);
    setXEdit(prev => ({
      ...prev,
      produto_id: p.produto_id,
      cd_produto: String(p.cd_produto ?? p.produto_id),
      nm_produto: p.nome,
      preco_base: base,
      percentual_desconto: 0,
      valor_desconto: 0,
      valor_promocional: base,
    }));
    setXSearchTerm(String(p.cd_produto ?? p.produto_id));
    setXOpenProdutoSearch(false);
    setTimeout(() => {
      percentualInputRef.current?.focus();
      percentualInputRef.current?.select();
    }, 100);
  };

  const itemSelecionado = XSelectedIdx != null ? XItens[XSelectedIdx] : null;
  const isPromocaoSaved = !!promocao?.promocao_id;
  const ro = !isEditing || !isPromocaoSaved;

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
                    onClick={() => { exportAsPdf(ITEM_COLS, XItens, "Itens da Promoção"); setXShowExport(false); }}
                  >
                    <File size={14} className="text-rose-500" /> PDF (Impressão)
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onClick={() => { exportAsText(ITEM_COLS, XItens, "Itens da Promoção"); setXShowExport(false); }}
                  >
                    <FileText size={14} className="text-slate-500" /> Arquivo de Texto
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    onClick={() => { exportAsCsv(ITEM_COLS, XItens, "Itens da Promoção"); setXShowExport(false); }}
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
  ), [XPage, XTotalItens, ro, itemSelecionado, loadItens, XShowExport, XItens]);

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
            Produtos da Promoção
          </h3>
          {!isPromocaoSaved && (
            <span className="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200/50 dark:border-rose-900/50 animate-pulse">
              Salve a promoção acima para habilitar a inclusão de produtos
            </span>
          )}
        </div>
      </div>

      {isPromocaoSaved && (
        <div className="flex items-center justify-between p-1.5 bg-secondary/15 rounded border border-border/40">
          {toolbar}
        </div>
      )}

      <div className={!isPromocaoSaved ? "opacity-40 pointer-events-none select-none cursor-not-allowed" : ""}>
        {XEdit && (
          <div className="border border-border rounded p-3 space-y-2 bg-card mb-3" onKeyDown={handleKeyDown}>
            <div className="grid grid-cols-12 gap-2 items-end">
              {/* Código */}
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
              {/* Lupa Pesquisa */}
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
              {/* Descrição */}
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Descrição</label>
                <input
                  readOnly
                  tabIndex={-1}
                  value={XEdit.nm_produto || ""}
                  placeholder="Selecione um produto pressionando Enter ou clicando na lupa..."
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary"
                />
              </div>
              {/* Preço Base */}
              <div className="col-span-1.5">
                <label className="text-xs text-muted-foreground">Preço Base</label>
                <input
                  readOnly
                  tabIndex={-1}
                  value={fmt(Number(XEdit.preco_base || 0))}
                  className="w-full border border-border rounded px-2 py-1 text-sm bg-secondary text-right font-mono"
                />
              </div>
              {/* % Desconto */}
              <div className="col-span-1.5">
                <label className="text-xs text-muted-foreground">% Desconto</label>
                <CurrencyInput
                  ref={percentualInputRef}
                  disabled={ro}
                  value={Number(XEdit.percentual_desconto || 0)}
                  decimals={2}
                  onChange={handlePercentualChange}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      valorDescontoInputRef.current?.focus();
                      valorDescontoInputRef.current?.select();
                    }
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-right"
                />
              </div>
              {/* R$ Desconto */}
              <div className="col-span-1.5">
                <label className="text-xs text-muted-foreground">R$ Desconto</label>
                <CurrencyInput
                  ref={valorDescontoInputRef}
                  disabled={ro}
                  value={Number(XEdit.valor_desconto || 0)}
                  decimals={2}
                  onChange={handleValorDescontoChange}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      valorPromocionalInputRef.current?.focus();
                      valorPromocionalInputRef.current?.select();
                    }
                  }}
                  className="w-full border border-border rounded px-2 py-1 text-sm text-right"
                />
              </div>
              {/* Valor Promocional */}
              <div className="col-span-1.5">
                <label className="text-xs font-bold text-primary">Valor Promo <span className="text-destructive">*</span></label>
                <CurrencyInput
                  ref={valorPromocionalInputRef}
                  disabled={ro}
                  value={Number(XEdit.valor_promocional || 0)}
                  decimals={2}
                  onChange={handleValorPromocionalChange}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      salvarBtnRef.current?.focus();
                    }
                  }}
                  className="w-full border border-primary/50 font-bold text-primary rounded px-2 py-1 text-sm text-right bg-primary/5"
                />
              </div>
              {/* Ações */}
              <div className="col-span-1 flex items-end gap-1 justify-end">
                <button
                  ref={salvarBtnRef}
                  onClick={salvar}
                  disabled={ro}
                  className="text-xs px-2.5 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity font-semibold"
                >
                  {XEditingId ? "Salvar" : "Inserir"}
                </button>
                <button
                  type="button"
                  onClick={cancelar}
                  className="text-xs px-2 py-1.5 rounded border border-border hover:bg-accent transition-colors"
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
          onRowDoubleClick={r => { if (isEditing) editar(r as IPromocaoItem); }}
          showRecordCount={false}
          showExport={false}
          exportTitle="Itens da Promoção"
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

const PromocaoForm: React.FC = () => {
  const { handleKeyDown } = useEnterTraversal();
  const { XEmpresaMatrizId, XEmpresas } = useAppContext();
  const XEmpMatriz = XEmpresas.find(e => e.empresa_id === XEmpresaMatrizId);
  const XEmpLabel = XEmpMatriz
    ? `${XEmpMatriz.empresa_id} - ${XEmpMatriz.identificacao}`
    : String(XEmpresaMatrizId);

  return (
    <StandardCrudForm<IPromocao>
      config={{
        XTableName: "promocao",
        XPrimaryKey: "promocao_id",
        XTitle: "Promoções de Venda",
        XEmpresaId: XEmpresaMatrizId,
        XOrderBy: "cd_promocao",
        XNmForm: "promocoes",
        XDefaultRecord: {
          descricao: "",
          dt_inicial: null,
          dt_final: null,
        },
        XOnBeforeSave: async (rec, mode) => {
          if (!rec.descricao?.trim()) throw new Error("A descrição da promoção é obrigatória.");

          if (mode === "insert") {
            const { data } = await db
              .from("promocao")
              .select("cd_promocao")
              .eq("empresa_id", XEmpresaMatrizId)
              .order("cd_promocao", { ascending: false })
              .limit(1)
              .maybeSingle();
            const nextCd = ((data?.cd_promocao ?? 0) as number) + 1;
            return {
              ...rec,
              cd_promocao: nextCd,
              empresa_id: XEmpresaMatrizId,
              descricao: rec.descricao!.trim(),
              excluido: false,
            };
          }

          return { ...rec, descricao: rec.descricao!.trim() };
        },
      }}
      XGridCols={XGridCols}
      XExportTitle="Promoções"
      XAfterInsertTab="cadastro"
      renderCadastro={({ record, setField, mode, isEditing, currentRecord }) => (
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          {/* Header Row: Código + Empresa + Descrição + Dt. Inicial + Dt. Final */}
          <div className="flex flex-wrap items-end gap-3 bg-secondary/10 p-3 rounded-lg border border-border/60">
            {/* Código */}
            <div className="w-24 shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Código</label>
              <input
                type="text"
                value={record.cd_promocao ?? ""}
                readOnly
                disabled
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary/50 text-right font-mono text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Empresa */}
            <div className="w-56 shrink-0">
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Empresa</label>
              <input
                type="text"
                value={XEmpLabel}
                readOnly
                disabled
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-secondary/50 text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Descrição */}
            <div className="flex-1 min-w-[280px]">
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
                placeholder="Insira a descrição da promoção..."
                className={`w-full border border-border rounded px-3 py-1.5 text-sm transition-all ${
                  isEditing
                    ? "bg-card focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none shadow-sm"
                    : "bg-secondary/40 text-muted-foreground"
                }`}
              />
            </div>

            {/* Dt. Inicial */}
            <FormDateField
              label="Dt. Inicial"
              value={record.dt_inicial ?? ""}
              onChange={v => setField("dt_inicial", (v || null) as any)}
              readOnly={!isEditing}
              className="w-44 shrink-0"
            />

            {/* Dt. Final */}
            <FormDateField
              label="Dt. Final"
              value={record.dt_final ?? ""}
              onChange={v => setField("dt_final", (v || null) as any)}
              readOnly={!isEditing}
              className="w-44 shrink-0"
            />
          </div>

          {/* Products grid */}
          <ItensGrid
            promocao={currentRecord as IPromocao | null}
            isEditing={isEditing}
          />
        </div>
      )}
    />
  );
};

export default PromocaoForm;
