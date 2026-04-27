import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Plus, CheckCircle2, XCircle, AlertCircle, Save, X } from "lucide-react";
import type { INfeXmlItem } from "./types";
import { useAppContext } from "@/contexts/AppContext";
import { setPendingProduct } from "@/utils/nfePendingStore";

const db = supabase as any;
const fmt4 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 4 });
const fmt2 = (v: number) => Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

interface IVinculoRow {
  item: INfeXmlItem;
  produto_id: number | null;
  produto_nome: string;
  fator_conversao: string;
  status: "ok" | "pendente" | "pulado";
}

interface ProdutoSearchResult {
  produto_id: number;
  nome: string;
  referencia: string;
  gtin: string;
}

interface NfeProdutosVinculoListProps {
  open: boolean;
  itens: INfeXmlItem[];
  cadastroId: number;
  empresaId: number;
  empresaMatrizId: number;
  onConfirmar: (vinculos: { nrItem: number; produto_id: number | null; fator_conversao: number }[]) => void;
  onCancelar: () => void;
}

// ── Mini modal de pesquisa de produto ─────────────────────────
const ProdutoSearchModal: React.FC<{
  open: boolean;
  onSelect: (p: ProdutoSearchResult) => void;
  onClose: () => void;
  empresaMatrizId: number;
}> = ({ open, onSelect, onClose, empresaMatrizId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XResultados, setXResultados] = useState<ProdutoSearchResult[]>([]);
  const [XBuscando, setXBuscando] = useState(false);

  const buscar = useCallback(async (termo: string) => {
    if (termo.length < 3) { setXResultados([]); return; }
    setXBuscando(true);
    const { data } = await db.from("produto")
      .select("produto_id,nome,referencia,gtin")
      .eq("empresa_id", empresaMatrizId)
      .eq("excluido", false)
      .or(`nome.ilike.%${termo}%,referencia.ilike.%${termo}%,gtin.ilike.%${termo}%`)
      .order("nome")
      .limit(30);
    setXResultados(data || []);
    setXBuscando(false);
  }, [empresaMatrizId]);

  // Busca automática com debounce de 300ms
  useEffect(() => {
    const timer = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(timer);
  }, [XTermo, buscar]);

  useEffect(() => {
    if (!open) { setXTermo(""); setXResultados([]); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={XTermo}
            onChange={e => setXTermo(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") onClose(); }}
            placeholder="Digite nome, referência ou GTIN (mín. 3 letras)..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
          {XBuscando && <span className="text-xs text-muted-foreground animate-pulse">buscando...</span>}
          <button onClick={onClose} title="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {XResultados.length === 0 && !XBuscando && (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {XTermo.length < 3
                ? `Digite pelo menos 3 caracteres (${3 - XTermo.length} restante(s)).`
                : "Nenhum resultado encontrado."}
            </div>
          )}
          {XResultados.map(p => (
            <button
              key={p.produto_id}
              type="button"
              onClick={() => { onSelect(p); onClose(); }}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-accent border-b border-border/50 transition-colors"
            >
              <span className="text-xs text-muted-foreground w-12 shrink-0 text-right font-mono">{p.produto_id}</span>
              <span className="flex-1 text-sm">{p.nome}</span>
              {p.referencia && <span className="text-xs text-muted-foreground">{p.referencia}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────
const NfeProdutosVinculoList: React.FC<NfeProdutosVinculoListProps> = ({
  open,
  itens,
  cadastroId,
  empresaId,
  empresaMatrizId,
  onConfirmar,
  onCancelar,
}) => {
  const { openTab, closeTab, XTabs } = useAppContext();
  const [XRows, setXRows] = useState<IVinculoRow[]>([]);
  const [XCarregando, setXCarregando] = useState(false);
  const [XSearchIdx, setXSearchIdx] = useState<number | null>(null);

  // Inicializa e resolve vínculos existentes em lote
  useEffect(() => {
    if (!open || itens.length === 0) return;
    const init = async () => {
      setXCarregando(true);
      // Busca todos os vínculos existentes de uma vez
      const cods = itens.map(i => i.cd_prod_fornec).filter(Boolean);
      const { data: vinculos } = await db
        .from("produto_fornecedor")
        .select("cd_prod_fornec,produto_id,fator_conversao")
        .eq("empresa_id", empresaMatrizId)
        .eq("cadastro_id", cadastroId)
        .in("cd_prod_fornec", cods)
        .eq("excluido", false);

      // Monta mapa cd_prod_fornec → vínculo
      const vinculoMap: Record<string, { produto_id: number; fator: number }> = {};
      for (const v of (vinculos || [])) {
        vinculoMap[v.cd_prod_fornec] = { produto_id: v.produto_id, fator: Number(v.fator_conversao || 1) };
      }

      // Busca nomes dos produtos vinculados
      const prodIds = [...new Set(Object.values(vinculoMap).map(v => v.produto_id))];
      let prodMap: Record<number, string> = {};
      if (prodIds.length > 0) {
        const { data: prods } = await db.from("produto").select("produto_id,nome").in("produto_id", prodIds);
        (prods || []).forEach((p: any) => { prodMap[p.produto_id] = p.nome; });
      }

      const rows: IVinculoRow[] = itens.map(item => {
        const v = vinculoMap[item.cd_prod_fornec];
        return {
          item,
          produto_id:      v?.produto_id || null,
          produto_nome:    v?.produto_id ? (prodMap[v.produto_id] || `#${v.produto_id}`) : "",
          fator_conversao: v ? String(v.fator) : "1",
          status:          v ? "ok" : "pendente",
        };
      });
      setXRows(rows);
      setXCarregando(false);
    };
    init();
  }, [open, itens, cadastroId, empresaMatrizId]);

  const updateRow = (idx: number, partial: Partial<IVinculoRow>) => {
    setXRows(prev => prev.map((r, i) => i === idx ? { ...r, ...partial } : r));
  };

  const handleSelectProduto = (idx: number, p: ProdutoSearchResult) => {
    updateRow(idx, {
      produto_id:   p.produto_id,
      produto_nome: p.nome,
      status:       "ok",
    });
  };

  const handleNovoProduto = (idx: number) => {
    const row = XRows[idx];
    // Salva no store para o ProdutoForm pré-preencher
    setPendingProduct({
      nm_produto: row.item.nm_produto,
      ncm:        row.item.ncm,
      gtin:       row.item.gtin,
      unidade:    row.item.unidade,
      cfop:       row.item.cfop,
    });
    // Fecha aba existente de produtos se houver, para forçar remontagem
    const existingTab = XTabs.find(t => t.component === "produtos");
    if (existingTab) closeTab(existingTab.id);
    openTab({ title: "Produtos", component: "produtos" });
    toast.info(`Cadastre o produto "${row.item.nm_produto}" e volte para informar o código.`);
  };

  const handlePular = (idx: number) => {
    updateRow(idx, { status: "pulado", produto_id: null, produto_nome: "" });
  };

  const handleConfirmar = () => {
    const pendentes = XRows.filter(r => r.status === "pendente");
    if (pendentes.length > 0) {
      if (!confirm(`Ainda há ${pendentes.length} item(s) sem produto vinculado. Deseja confirmar mesmo assim?`)) return;
    }
    const vinculos = XRows.map(r => ({
      nrItem:          r.item.nr_item,
      produto_id:      r.status === "ok" ? r.produto_id : null,
      fator_conversao: parseFloat(r.fator_conversao) || 1,
    }));
    onConfirmar(vinculos);
  };

  const totalOk      = XRows.filter(r => r.status === "ok").length;
  const totalPulado  = XRows.filter(r => r.status === "pulado").length;
  const totalPendente= XRows.filter(r => r.status === "pendente").length;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h2 className="text-base font-semibold">Vínculo de Produtos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Associe cada item da NF-e a um produto cadastrado ou crie um novo produto.
              </p>
            </div>
            <div className="ml-auto flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" /> {totalOk} vinculado(s)
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-4 h-4" /> {totalPendente} pendente(s)
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="w-4 h-4" /> {totalPulado} pulado(s)
              </span>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-y-auto flex-1">
            {XCarregando ? (
              <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Verificando vínculos existentes...</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card border-b border-border z-10">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-right px-3 py-2 w-12">Item</th>
                    <th className="text-left px-3 py-2 w-28">Cód. Forn.</th>
                    <th className="text-left px-3 py-2">Descrição NF</th>
                    <th className="text-right px-3 py-2 w-24">Qtd</th>
                    <th className="text-left px-3 py-2 w-14">Un.</th>
                    <th className="text-right px-3 py-2 w-24">Vl. Unit.</th>
                    <th className="text-left px-3 py-2 w-56">Produto Vinculado</th>
                    <th className="text-center px-3 py-2 w-24">Fator Conv.</th>
                    <th className="text-center px-3 py-2 w-32">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {XRows.map((row, idx) => (
                    <tr
                      key={row.item.nr_item}
                      className={`border-b border-border/50 transition-colors ${
                        row.status === "ok"     ? "bg-green-500/5" :
                        row.status === "pulado" ? "bg-muted/30" : ""
                      }`}
                    >
                      <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">{row.item.nr_item}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.item.cd_prod_fornec}</td>
                      <td className="px-3 py-2 text-xs">{row.item.nm_produto}</td>
                      <td className="text-right px-3 py-2 tabular-nums text-xs">{fmt4(row.item.qt_entrada)}</td>
                      <td className="px-3 py-2 text-xs">{row.item.unidade}</td>
                      <td className="text-right px-3 py-2 tabular-nums text-xs">{fmt2(row.item.vl_unit)}</td>

                      {/* Produto vinculado */}
                      <td className="px-3 py-2">
                        {row.status === "ok" ? (
                          <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span className="truncate" title={row.produto_nome}>{row.produto_nome}</span>
                            {row.produto_id && <span className="text-muted-foreground shrink-0">#{row.produto_id}</span>}
                          </span>
                        ) : row.status === "pulado" ? (
                          <span className="text-xs text-muted-foreground italic">pulado</span>
                        ) : (
                          <span className="text-xs text-amber-600 dark:text-amber-400 italic">— não vinculado —</span>
                        )}
                      </td>

                      {/* Fator de conversão */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.000001"
                          min="0.000001"
                          value={row.fator_conversao}
                          onChange={e => updateRow(idx, { fator_conversao: e.target.value })}
                          className="w-full border border-border rounded px-2 py-0.5 text-xs text-right bg-card"
                          title="Fator de conversão (qtd NF × fator = qtd estoque)"
                        />
                      </td>

                      {/* Ações */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Pesquisar produto existente"
                            onClick={() => setXSearchIdx(idx)}
                            className="p-1 rounded hover:bg-accent border border-border"
                          >
                            <Search className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Cadastrar novo produto"
                            onClick={() => handleNovoProduto(idx)}
                            className="p-1 rounded hover:bg-primary/10 border border-primary/40 text-primary"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Pular este item"
                            onClick={() => handlePular(idx)}
                            className="p-1 rounded hover:bg-destructive/10 border border-destructive/40 text-destructive"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legenda fator */}
          <div className="px-5 py-2 bg-secondary/30 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              💡 <strong>Fator de conversão:</strong> Qtd. Nota × Fator = Qtd. lançada no estoque. Ex: NF em caixa c/ 12 un → Fator = 12.
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center px-5 py-4 border-t border-border shrink-0 bg-card">
            <button
              type="button"
              onClick={onCancelar}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={XCarregando}
              className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Confirmar Vínculos e Continuar
            </button>
          </div>
        </div>
      </div>

      {/* Mini modal de pesquisa */}
      <ProdutoSearchModal
        open={XSearchIdx !== null}
        empresaMatrizId={empresaMatrizId}
        onSelect={(p) => { if (XSearchIdx !== null) handleSelectProduto(XSearchIdx, p); }}
        onClose={() => setXSearchIdx(null)}
      />
    </>
  );
};

export default NfeProdutosVinculoList;
