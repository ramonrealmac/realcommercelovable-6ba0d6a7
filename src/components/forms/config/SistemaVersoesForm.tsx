import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  ClipboardCheck, 
  Calendar, 
  User, 
  Loader2, 
  RefreshCw, 
  Cpu, 
  Sparkles,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface SistemaVersao {
  id: string;
  versao: string;
  titulo: string;
  detalhes: string | null;
  autor: string | null;
  created_at: string | null;
  fase: string | null;
  tecnologias: string[] | null;
}

const ITEMS_PER_PAGE = 30;

const SistemaVersoesForm: React.FC = () => {
  const [versoes, setVersoes] = useState<SistemaVersao[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const fetchVersoes = async (pageNumber: number = 0, isLoadMore: boolean = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const from = pageNumber * ITEMS_PER_PAGE;
      const to = (pageNumber + 1) * ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("sistema_versoes")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const newItems = (data as SistemaVersao[]) || [];
      if (isLoadMore) {
        setVersoes(prev => [...prev, ...newItems]);
      } else {
        setVersoes(newItems);
      }

      setHasMore(newItems.length === ITEMS_PER_PAGE);
      setPage(pageNumber);
    } catch (err) {
      console.error("Erro ao carregar melhorias:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao carregar as melhorias.";
      if (!isLoadMore) {
        setError(errorMessage);
      }
      toast.error("Erro ao carregar histórico de melhorias.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchVersoes(0, false);
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden p-6 gap-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border pb-6 gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider text-emerald-600 uppercase">Centro de Atualizações</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Melhorias do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de releases, novas funcionalidades e correções aplicadas à plataforma.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => fetchVersoes(0, false)}
          disabled={loading || loadingMore}
          className="text-xs font-semibold uppercase h-10 px-4 flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          /* Grid Skeleton Loader */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border border-border/60 bg-card shadow-sm h-[240px] flex flex-col justify-between overflow-hidden">
                <CardContent className="pt-6 flex-1 flex flex-col gap-4">
                  <div className="flex items-center justify-between w-full">
                    <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-full bg-muted animate-pulse rounded" />
                    <div className="h-3 w-5/6 bg-muted animate-pulse rounded" />
                  </div>
                </CardContent>
                <div className="h-10 bg-muted/30 border-t border-border/50 animate-pulse px-6 py-2" />
              </Card>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="flex flex-col items-center justify-center h-[350px] text-center gap-4 bg-destructive/5 border border-destructive/15 rounded-lg p-8 max-w-xl mx-auto mt-8">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-destructive">Falha ao Consultar Versões</h3>
              <p className="text-sm text-muted-foreground mt-2">{error}</p>
            </div>
            <Button onClick={fetchVersoes} variant="outline" className="mt-2 text-xs uppercase font-bold">
              Tentar Novamente
            </Button>
          </div>
        ) : versoes.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-[350px] text-center gap-4 border border-dashed border-border rounded-lg p-8 max-w-xl mx-auto mt-8">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <h3 className="text-base font-bold uppercase tracking-wider text-foreground">Nenhuma versão encontrada</h3>
              <p className="text-xs text-muted-foreground mt-2">
                Nenhum registro de melhoria ou versão foi encontrado no banco de dados.
              </p>
            </div>
          </div>
        ) : (
          /* Grid layout with real version items and load more */
          <div className="flex flex-col gap-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {versoes.map((item) => (
                <Card 
                  key={item.id} 
                  className="border border-border/80 bg-card hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group"
                >
                  <CardContent className="pt-5 pb-4 px-5 flex-1 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      {/* Version Badge */}
                      <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-extrabold font-mono tracking-wide shadow-sm group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                        v{item.versao}
                      </div>
                      {/* Date Tag */}
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(item.created_at)}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-emerald-600 transition-colors duration-300">
                      {item.titulo}
                    </h3>

                    {/* Details */}
                    {item.detalhes && (
                      <p className="text-xs text-muted-foreground leading-relaxed font-normal line-clamp-4 mt-1 whitespace-pre-line">
                        {item.detalhes}
                      </p>
                    )}

                    {/* Author and Phase Metadatas */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-border/40 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {item.autor && (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-muted-foreground/80" />
                          <span>Por: {item.autor}</span>
                        </div>
                      )}
                      {item.fase && (
                        <div className="bg-muted px-1.5 py-0.5 rounded text-[9px] border border-border/60">
                          {item.fase}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  {/* Footer Badges for Technologies */}
                  {item.tecnologias && item.tecnologias.length > 0 && (
                    <div className="bg-muted/30 border-t border-border/50 px-5 py-3 flex flex-wrap gap-1.5 mt-auto items-center">
                      <Cpu className="w-3 h-3 text-muted-foreground/60 mr-1 shrink-0" />
                      {item.tecnologias.map((tech, idx) => (
                        <span 
                          key={idx} 
                          className="bg-background text-muted-foreground border border-border/80 px-2 py-0.5 rounded-[3px] text-[9px] font-bold uppercase tracking-wider shadow-sm"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-4 pb-6">
                <Button
                  variant="outline"
                  onClick={() => fetchVersoes(page + 1, true)}
                  disabled={loadingMore}
                  className="text-xs font-semibold uppercase px-6 h-10 flex items-center gap-2 hover:border-emerald-500/40 transition-colors duration-300"
                >
                  {loadingMore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                  {loadingMore ? "Carregando..." : "Carregar Mais Melhorias"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SistemaVersoesForm;
