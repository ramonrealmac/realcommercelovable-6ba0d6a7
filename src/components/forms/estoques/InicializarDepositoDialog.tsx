import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const db = supabase;

interface IProps {
  open: boolean;
  onClose: () => void;
  depositoId: number;
  depositoNome: string;
  empresaId: number;
  empresaMatrizId: number;
}

interface IGrupoOption {
  produto_grupo_id: number;
  nome: string;
}

interface ILinhaOption {
  linha_id: number;
  nome: string;
}

export const InicializarDepositoDialog: React.FC<IProps> = ({
  open,
  onClose,
  depositoId,
  depositoNome,
  empresaId,
  empresaMatrizId,
}) => {
  const [filterAtivo, setFilterAtivo] = useState<string>("S");
  const [selectedGrupo, setSelectedGrupo] = useState<string>("");
  const [selectedLinha, setSelectedLinha] = useState<string>("");
  const [grupos, setGrupos] = useState<IGrupoOption[]>([]);
  const [linhas, setLinhas] = useState<ILinhaOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFilters, setLoadingFilters] = useState<boolean>(false);

  useEffect(() => {
    if (open && empresaMatrizId) {
      const loadFilters = async () => {
        setLoadingFilters(true);
        try {
          const [gRes, lRes] = await Promise.all([
            db.from("produto_grupo")
              .select("produto_grupo_id, nome")
              .eq("empresa_id", empresaMatrizId)
              .eq("excluido", false)
              .order("nome"),
            db.from("linha_produto")
              .select("linha_id, nome")
              .eq("empresa_id", empresaMatrizId)
              .eq("excluido", false)
              .order("nome"),
          ]);
          if (gRes.data) setGrupos(gRes.data);
          if (lRes.data) setLinhas(lRes.data);
        } catch (e) {
          console.error("Erro ao carregar filtros:", e);
          toast.error("Erro ao carregar grupos e linhas de produtos.");
        } finally {
          setLoadingFilters(false);
        }
      };
      loadFilters();
    }
  }, [open, empresaMatrizId]);

  const handleInicializar = async () => {
    setLoading(true);
    try {
      let allProducts: { produto_id: number; empresa_id: number }[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let q = db.from("produto")
          .select("produto_id, empresa_id")
          .eq("empresa_id", empresaMatrizId)
          .eq("excluido", false)
          .range(from, to);

        if (filterAtivo !== "TODOS") {
          q = q.eq("ativo", filterAtivo);
        }
        if (selectedGrupo) {
          q = q.eq("produto_grupo_id", parseInt(selectedGrupo));
        }
        if (selectedLinha) {
          q = q.eq("linha_id", parseInt(selectedLinha));
        }

        const { data, error } = await q;
        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
          allProducts = allProducts.concat(data as any);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allProducts.length === 0) {
        toast.info("Nenhum produto correspondente aos filtros encontrado na empresa matriz.");
        setLoading(false);
        return;
      }

      let allExistingStocks: { produto_id: number }[] = [];
      let stockPage = 0;
      let stockHasMore = true;

      while (stockHasMore) {
        const from = stockPage * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await db.from("estoque")
          .select("produto_id")
          .eq("deposito_id", depositoId)
          .eq("excluido", false)
          .range(from, to);

        if (error) throw new Error(error.message);

        if (data && data.length > 0) {
          allExistingStocks = allExistingStocks.concat(data as any);
          if (data.length < pageSize) {
            stockHasMore = false;
          } else {
            stockPage++;
          }
        } else {
          stockHasMore = false;
        }
      }

      const existingProductIds = new Set(
        allExistingStocks.map(s => s.produto_id)
      );
      const productsToInsert = allProducts.filter(p => !existingProductIds.has(p.produto_id));

      if (productsToInsert.length === 0) {
        toast.info("Todos os produtos filtrados já possuem estoque cadastrado neste depósito.");
        setLoading(false);
        return;
      }

      const confirmed = window.confirm(
        `Deseja inicializar o estoque de ${productsToInsert.length} produto(s) para o depósito "${depositoNome}" com saldo físico/reservado igual a 0?`
      );
      if (!confirmed) {
        setLoading(false);
        return;
      }

      const insertPayload = productsToInsert.map(p => ({
        produto_id: p.produto_id,
        deposito_id: depositoId,
        empresa_id: empresaId,
        endereco: "",
        estoque_fisico: 0,
        estoque_reservado: 0,
        estoque_minimo: 0,
        estoque_padrao: 0,
        excluido: false,
      }));

      const chunkSize = 200;
      let insertedCount = 0;

      for (let i = 0; i < insertPayload.length; i += chunkSize) {
        const chunk = insertPayload.slice(i, i + chunkSize);
        const { error: insertErr } = await db.from("estoque").insert(chunk);
        if (insertErr) throw new Error(insertErr.message);
        insertedCount += chunk.length;
      }

      toast.success(`Estoque inicializado com sucesso para ${insertedCount} produto(s)!`);
      onClose();
    } catch (e: unknown) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast.error("Erro na inicialização: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Inicializar Estoque do Depósito</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Esta operação irá criar registros de estoque com saldo <strong>zero</strong> para os produtos da matriz que ainda não constam neste depósito.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Status do Produto</label>
              <select
                value={filterAtivo}
                onChange={(e) => setFilterAtivo(e.target.value)}
                disabled={loading}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="S">Somente Ativos (Recomendado)</option>
                <option value="N">Somente Inativos</option>
                <option value="TODOS">Todos (Ativos e Inativos)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Grupo de Produto</label>
              <select
                value={selectedGrupo}
                onChange={(e) => setSelectedGrupo(e.target.value)}
                disabled={loading || loadingFilters}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">[Todos os Grupos]</option>
                {grupos.map((g) => (
                  <option key={g.produto_grupo_id} value={g.produto_grupo_id}>
                    {g.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Linha de Produto</label>
              <select
                value={selectedLinha}
                onChange={(e) => setSelectedLinha(e.target.value)}
                disabled={loading || loadingFilters}
                className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="">[Todas as Linhas]</option>
                {linhas.map((l) => (
                  <option key={l.linha_id} value={l.linha_id}>
                    {l.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleInicializar}
            disabled={loading || loadingFilters}
            className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-primary-foreground font-semibold"
          >
            {loading ? "Inicializando..." : "Inicializar Depósito"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
