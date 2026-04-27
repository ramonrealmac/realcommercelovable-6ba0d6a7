import React, { useState, useEffect } from "react";
import { AlertTriangle, Package, Plus, Link, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { INfeXmlItem } from "./types";

const db = supabase as any;

interface ProdutoVinculoItem extends INfeXmlItem {
  // Dados adicionais de controle
}

interface ProdutoVinculoDialogProps {
  open: boolean;
  item: ProdutoVinculoItem | null;
  cadastroId: number | null; // ID do fornecedor
  empresaId: number;
  empresaMatrizId: number;
  onVinculado: (itemNrItem: number, produtoId: number) => void;
  onCadastrar: (item: INfeXmlItem) => void;
  onPular: (itemNrItem: number) => void;
}

const ProdutoVinculoDialog: React.FC<ProdutoVinculoDialogProps> = ({
  open,
  item,
  cadastroId,
  empresaId,
  empresaMatrizId,
  onVinculado,
  onCadastrar,
  onPular,
}) => {
  const [XProdutoEncontrado, setXProdutoEncontrado] = useState<{
    produto_id: number;
    nome: string;
    referencia: string;
  } | null>(null);
  const [XBuscando, setXBuscando] = useState(false);

  useEffect(() => {
    if (!open || !item || !cadastroId) {
      setXProdutoEncontrado(null);
      return;
    }

    const buscar = async () => {
      setXBuscando(true);
      try {
        // Busca na tabela produto_fornecedor
        const { data: vinculo } = await db
          .from("produto_fornecedor")
          .select("produto_id")
          .eq("empresa_id", empresaMatrizId)
          .eq("cadastro_id", cadastroId)
          .eq("cd_prod_fornec", item.cd_prod_fornec)
          .eq("excluido", false)
          .limit(1)
          .maybeSingle();

        if (vinculo?.produto_id) {
          const { data: produto } = await db
            .from("produto")
            .select("produto_id, nome, referencia")
            .eq("produto_id", vinculo.produto_id)
            .maybeSingle();

          if (produto) {
            setXProdutoEncontrado(produto);
            return;
          }
        }
        setXProdutoEncontrado(null);
      } catch {
        setXProdutoEncontrado(null);
      } finally {
        setXBuscando(false);
      }
    };

    buscar();
  }, [open, item?.cd_prod_fornec, cadastroId, empresaMatrizId]);

  if (!open || !item) return null;

  const handleConfirmarVinculo = () => {
    if (XProdutoEncontrado) {
      onVinculado(item.nr_item, XProdutoEncontrado.produto_id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-amber-500/10">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <h2 className="text-base font-semibold text-amber-600 dark:text-amber-400">
            Verificação de Produto
          </h2>
          <span className="ml-auto text-xs text-muted-foreground">Item {item.nr_item}</span>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Dados do item da NF */}
          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24 shrink-0">Cód. Fornec.:</span>
              <span className="font-mono font-medium">{item.cd_prod_fornec}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24 shrink-0">Descrição:</span>
              <span className="font-medium">{item.nm_produto}</span>
            </div>
            {item.ncm && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">NCM:</span>
                <span>{item.ncm}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24 shrink-0">Qtd / Un.:</span>
              <span>{item.qt_entrada.toLocaleString("pt-BR", { minimumFractionDigits: 4 })} {item.unidade}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-24 shrink-0">Vlr. Unit.:</span>
              <span>{item.vl_unit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            </div>
          </div>

          {/* Status de busca */}
          {XBuscando ? (
            <p className="text-sm text-muted-foreground animate-pulse">
              Buscando produto cadastrado...
            </p>
          ) : XProdutoEncontrado ? (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                <Link className="w-4 h-4" />
                Produto encontrado no cadastro:
              </p>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">Produto ID:</span>
                <span className="font-medium">{XProdutoEncontrado.produto_id}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">Nome:</span>
                <span>{XProdutoEncontrado.nome}</span>
              </div>
              {XProdutoEncontrado.referencia && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">Referência:</span>
                  <span>{XProdutoEncontrado.referencia}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Produto não localizado pela combinação <strong>código do fornecedor + fornecedor</strong>.
              Deseja cadastrar um novo produto ou pular este item?
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border bg-secondary/20">
          <button
            type="button"
            onClick={() => onPular(item.nr_item)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
            Pular Item
          </button>

          {!XProdutoEncontrado && !XBuscando && (
            <button
              type="button"
              onClick={() => onCadastrar(item)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-amber-500/50 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Produto
            </button>
          )}

          {XProdutoEncontrado && (
            <button
              type="button"
              onClick={handleConfirmarVinculo}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Link className="w-4 h-4" />
              Confirmar Vínculo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProdutoVinculoDialog;
