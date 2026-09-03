import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { Search, Plus, Trash2 } from "lucide-react";
import ProdutoSearchDialog, { IProdutoRow, buscarProdutoPorCodigo } from "../pedido/ProdutoSearchDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const db = supabase as any;

export interface ITransferenciaItemRow {
  transferencia_item_id?: number;
  transferencia_id?: number;
  produto_id: number;
  cd_produto?: number | null;
  nm_produto: string;
  qt_transferir: number;
  excluido?: boolean;
}

interface IProps {
  transferenciaId: number | null;
  podeEditar: boolean;
  empresaOrigemId: number;
  depositoOrigemId: number;
  onItemsChanged?: () => void;
  items: ITransferenciaItemRow[];
  setItems: React.Dispatch<React.SetStateAction<ITransferenciaItemRow[]>>;
}

const formatNumericInput = (rawString: string, decimals = 3): string => {
  const clean = String(rawString || "").replace(/\D/g, "");
  if (!clean) return "";
  const num = parseInt(clean, 10);
  const floatVal = num / Math.pow(10, decimals);
  return floatVal.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const parseNum = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  let s = String(v).replace(/\s/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export default function TransferenciaEstoqueItensGrid({
  transferenciaId,
  podeEditar,
  empresaOrigemId,
  depositoOrigemId,
  onItemsChanged,
  items,
  setItems,
}: IProps) {
  const { XEmpresas, XEmpresaId } = useAppContext();
  
  const currEmp = useMemo(() => {
    return XEmpresas?.find(e => e.empresa_id === (empresaOrigemId || XEmpresaId));
  }, [XEmpresas, empresaOrigemId, XEmpresaId]);

  const qtDecimais = useMemo(() => {
    return (currEmp as any)?.qt_saida_qt_decimais || (currEmp as any)?.qt_venda_qt_decimais || 3;
  }, [currEmp]);

  const [selectedProduto, setSelectedProduto] = useState<IProdutoRow | null>(null);
  const [codigoText, setCodigoText] = useState("");
  const [qtTransferirText, setQtTransferirText] = useState("");
  const [estoqueDisponivel, setEstoqueDisponivel] = useState<number | null>(null);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [loadingEstoque, setLoadingEstoque] = useState(false);

  const codigoInputRef = useRef<HTMLInputElement>(null);
  const qtdInputRef = useRef<HTMLInputElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-foco no código do produto quando a aba de itens estiver ativa e editável
  useEffect(() => {
    if (podeEditar) {
      const timer = setTimeout(() => {
        codigoInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [podeEditar]);

  // Carregar saldo disponível na origem para o produto selecionado
  const carregarEstoqueDisponivel = useCallback(async (produtoId: number) => {
    if (!empresaOrigemId || !depositoOrigemId || !produtoId) {
      setEstoqueDisponivel(null);
      return;
    }
    setLoadingEstoque(true);
    try {
      const { data, error } = await db.from("estoque")
        .select("estoque_fisico, estoque_reservado")
        .eq("empresa_id", empresaOrigemId)
        .eq("deposito_id", depositoOrigemId)
        .eq("produto_id", produtoId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.warn("Erro ao buscar estoque:", error.message);
      }

      const fisico = Number(data?.estoque_fisico || 0);
      const reservado = Number(data?.estoque_reservado || 0);
      setEstoqueDisponivel(fisico - reservado);
    } catch (err) {
      console.error("Erro ao carregar estoque:", err);
      setEstoqueDisponivel(0);
    } finally {
      setLoadingEstoque(false);
    }
  }, [empresaOrigemId, depositoOrigemId]);

  useEffect(() => {
    if (selectedProduto) {
      carregarEstoqueDisponivel(selectedProduto.produto_id);
    } else {
      setEstoqueDisponivel(null);
    }
  }, [selectedProduto, carregarEstoqueDisponivel]);

  // Handler para busca de produto por código digitado ou Enter para abrir modal
  const handleCodigoKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const val = codigoText.trim();
      if (!val) {
        setSearchDialogOpen(true);
        return;
      }
      const p = await buscarProdutoPorCodigo(val, empresaOrigemId, [empresaOrigemId]);
      if (p) {
        setSelectedProduto(p);
        setCodigoText(String(p.cd_produto || p.produto_id));
        setQtTransferirText(""); // Zerar quantidade ao selecionar produto
        setTimeout(() => qtdInputRef.current?.focus(), 100);
      } else {
        setSearchDialogOpen(true);
      }
    }
  };

  const handleSelectProdutoFromDialog = (prod: IProdutoRow) => {
    setSelectedProduto(prod);
    setCodigoText(String(prod.cd_produto || prod.produto_id));
    setQtTransferirText(""); // Zerar quantidade ao selecionar produto da modal
    setSearchDialogOpen(false);
    setTimeout(() => qtdInputRef.current?.focus(), 100);
  };

  // Adicionar ou Atualizar Item na lista
  const handleAdicionarItem = () => {
    if (!podeEditar) {
      toast.error("A alteração de itens não é permitida para transferências finalizadas.");
      return;
    }

    if (!empresaOrigemId || !depositoOrigemId) {
      toast.error("Selecione a filial de origem e o estoque de origem antes de adicionar produtos.");
      return;
    }

    if (!selectedProduto) {
      toast.error("Selecione um produto válido.");
      return;
    }

    const qtd = parseNum(qtTransferirText);
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("A quantidade deve ser maior que zero.");
      return;
    }

    const disp = estoqueDisponivel ?? 0;
    if (qtd > disp) {
      toast.error(`Estoque disponível insuficiente para o produto ${selectedProduto.nome}. (Disponível: ${disp}, Solicitado: ${qtd})`);
      return;
    }

    // Verificar se o produto já existe na lista
    const indexExistente = items.findIndex(it => !it.excluido && it.produto_id === selectedProduto.produto_id);

    if (indexExistente >= 0) {
      const itemExistente = items[indexExistente];
      const novaQtd = itemExistente.qt_transferir + qtd;
      if (novaQtd > disp) {
        toast.error(`A quantidade total (${novaQtd}) excede o estoque disponível (${disp}) para o produto ${selectedProduto.nome}.`);
        return;
      }

      const novosItens = [...items];
      novosItens[indexExistente] = {
        ...itemExistente,
        qt_transferir: novaQtd
      };
      setItems(novosItens);
      toast.success(`Quantidade do produto ${selectedProduto.nome} atualizada.`);
    } else {
      const novoItem: ITransferenciaItemRow = {
        produto_id: selectedProduto.produto_id,
        cd_produto: selectedProduto.cd_produto || selectedProduto.produto_id,
        nm_produto: selectedProduto.nome,
        qt_transferir: qtd,
      };
      setItems(prev => [...prev, novoItem]);
      toast.success(`Produto ${selectedProduto.nome} adicionado à transferência.`);
    }

    // Limpar campos
    setSelectedProduto(null);
    setCodigoText("");
    setQtTransferirText("");
    setEstoqueDisponivel(null);
    onItemsChanged?.();
    setTimeout(() => codigoInputRef.current?.focus(), 100);
  };

  const handleRemoverItem = (index: number) => {
    if (!podeEditar) {
      toast.error("Não é possível remover itens de uma transferência finalizada.");
      return;
    }
    const novosItens = items.filter((_, i) => i !== index);
    setItems(novosItens);
    onItemsChanged?.();
    toast.info("Item removido da lista.");
  };

  // Colunas do DataGrid
  const gridColumns: IGridColumn[] = useMemo(() => {
    const cols: IGridColumn[] = [
      {
        key: "cd_produto",
        label: "Código",
        width: "110px",
        align: "right",
        render: (r: ITransferenciaItemRow) => r.cd_produto || r.produto_id,
      },
      {
        key: "nm_produto",
        label: "Descrição do Produto",
        width: "3fr",
      },
      {
        key: "qt_transferir",
        label: "Quantidade",
        width: "140px",
        align: "right",
        render: (r: ITransferenciaItemRow) => r.qt_transferir.toLocaleString("pt-BR", {
          minimumFractionDigits: qtDecimais,
          maximumFractionDigits: qtDecimais
        }),
      },
    ];

    if (podeEditar) {
      cols.push({
        key: "acoes",
        label: "Ação",
        width: "80px",
        align: "center",
        render: (_: any, index: number) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => handleRemoverItem(index)}
            title="Remover item"
          >
            <Trash2 size={16} />
          </Button>
        ),
      });
    }

    return cols;
  }, [podeEditar, qtDecimais]);

  const activeItems = useMemo(() => items.filter(i => !i.excluido), [items]);

  return (
    <div className="space-y-4">
      {/* Área de Inclusão de Produtos */}
      {podeEditar && (
        <div className="p-4 border rounded-lg bg-card/50 shadow-sm space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Adicionar Produto à Transferência
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            
            {/* 1. Código / Pesquisa (2 colunas) */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Código / Pesquisa
              </label>
              <div className="flex gap-1">
                <Input
                  ref={codigoInputRef}
                  value={codigoText}
                  onChange={(e) => setCodigoText(e.target.value)}
                  onKeyDown={handleCodigoKeyDown}
                  placeholder="Código..."
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 shrink-0"
                  onClick={() => setSearchDialogOpen(true)}
                  title="Pesquisar produto"
                >
                  <Search size={15} />
                </Button>
              </div>
            </div>

            {/* 2. Produto Selecionado (Aumentado -> 5 colunas / Fundo Branco Puro) */}
            <div className="md:col-span-5">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Produto Selecionado
              </label>
              <div className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm text-foreground font-medium items-center truncate">
                {selectedProduto ? selectedProduto.nome : <span className="text-muted-foreground font-normal">Selecione um produto...</span>}
              </div>
            </div>

            {/* 3. Disponível (2 colunas / Fundo Branco Puro / Label e Valor Alinhados à Direita) */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block text-right mb-1">
                Disponível
              </label>
              <div className={`flex h-9 w-full rounded-md border border-input bg-white px-3 py-2 text-sm font-bold items-center justify-end ${
                estoqueDisponivel !== null && estoqueDisponivel > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
              }`}>
                {loadingEstoque
                  ? "..."
                  : estoqueDisponivel !== null
                  ? estoqueDisponivel.toLocaleString("pt-BR", {
                      minimumFractionDigits: qtDecimais,
                      maximumFractionDigits: qtDecimais,
                    })
                  : (0).toLocaleString("pt-BR", {
                      minimumFractionDigits: qtDecimais,
                      maximumFractionDigits: qtDecimais,
                    })
                }
              </div>
            </div>

            {/* 4. Quantidade (2 colunas / Label e Valor Alinhados à Direita) */}
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground block text-right mb-1">
                Quantidade
              </label>
              <Input
                ref={qtdInputRef}
                type="text"
                value={qtTransferirText}
                onChange={(e) => setQtTransferirText(formatNumericInput(e.target.value, qtDecimais))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBtnRef.current?.focus();
                  }
                }}
                className="h-9 text-sm text-right font-mono"
              />
            </div>

            {/* 5. Botão Adicionar (Diminuído -> 1 coluna) */}
            <div className="md:col-span-1">
              <Button
                ref={addBtnRef}
                type="button"
                className="h-9 w-full gap-1 px-1 text-xs font-semibold"
                onClick={handleAdicionarItem}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdicionarItem();
                  }
                }}
                disabled={!selectedProduto}
                title="Adicionar produto"
              >
                <Plus size={16} />
                <span className="truncate">Add</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Produtos */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/40 px-3 py-2 text-xs font-semibold flex items-center justify-between border-b">
          <span>Itens da Transferência ({activeItems.length})</span>
        </div>
        <DataGrid
          data={activeItems}
          columns={gridColumns}
          emptyMessage="Nenhum produto adicionado à transferência."
        />
      </div>

      {/* Dialog de Pesquisa de Produto */}
      <ProdutoSearchDialog
        open={searchDialogOpen}
        onClose={() => setSearchDialogOpen(false)}
        onSelect={handleSelectProdutoFromDialog}
      />
    </div>
  );
}
