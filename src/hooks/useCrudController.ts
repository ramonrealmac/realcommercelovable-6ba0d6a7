import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ZodSchema } from "zod";

const db = supabase as any;

export type TFormMode = "view" | "edit" | "insert";

export interface ICrudConfig<T extends Record<string, any>> {
  [key: string]: any;
  XTableName: string;
  XPrimaryKey: keyof T & string;
  XTitle: string;
  XDefaultRecord: Partial<T>;
  XOrderBy?: string;
  XSelectCols?: string;
  XEmpresaId?: number;          // when set, filters/inserts using empresa_id
  XValidator?: ZodSchema<any>;
  XOnBeforeSave?: (rec: Partial<T>, mode: TFormMode) => Partial<T> | Promise<Partial<T>>;
  XOnSave?: (rec: Partial<T>, mode: TFormMode) => Promise<T | Partial<T> | void>;
  XOnAfterSave?: (savedRec: Partial<T>, mode: TFormMode) => void | Promise<void>;
  XOnDelete?: (rec: T) => void | Promise<void>;
  XOnAfterLoad?: (data: T[]) => void;
  XApplyFilter?: (query: any) => any; // custom filter (e.g. matriz, st_privado)
  XSoftDelete?: boolean;             // default true (uses excluido = true)
  XNmForm?: string;                  // Nome do formulário para busca de relatórios vinculados
  XCanEdit?: (rec: T) => boolean;     // Função para validar se o registro atual pode ser editado
  XUsePagination?: boolean;           // Ativa carregamento paginado via range
  XPageSize?: number;                 // Tamanho da página (default 50)
  XKeepEditAfterInsert?: boolean;
  XInitialMode?: TFormMode;
  XResetModeOnSelect?: boolean;
  XConfirmDiscardOnSelect?: boolean;
}

export function useCrudController<T extends Record<string, any>>(config: ICrudConfig<T>) {
  const [XFormMode, setXFormMode] = useState<TFormMode>(config.XInitialMode || "view");
  const [XData, setXData] = useState<T[]>([]);
  const [XCurrentIdx, setXCurrentIdx] = useState(0);
  const [XEditRecord, setXEditRecord] = useState<Partial<T>>(config.XDefaultRecord);
  const [XLoading, setXLoading] = useState(false);
  
  // Pagination State
  const [XPage, setXPage] = useState(0);
  const [XTotalCount, setXTotalCount] = useState(0);

  const XCurrentRecord = (XData[XCurrentIdx] || null) as T | null;
  const XIsEditing = XFormMode === "edit" || XFormMode === "insert";

  const queryClient = useQueryClient();
  const queryKey = [config.XTableName, config.XEmpresaId, XPage, config.XUsePagination, config.XOrderBy, config.XSelectCols];

  const { data: fetchedData, isLoading: queryLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = db.from(config.XTableName).select(config.XSelectCols || "*", { count: config.XUsePagination ? "exact" : undefined });
      
      if (config.XSoftDelete !== false) q = q.eq("excluido", false);
      if (config.XEmpresaId !== undefined) q = q.eq("empresa_id", config.XEmpresaId);
      if (config.XApplyFilter) q = config.XApplyFilter(q);
      q = q.order(config.XOrderBy || config.XPrimaryKey);

      if (config.XUsePagination) {
        const size = config.XPageSize || 50;
        const from = XPage * size;
        const to = from + size - 1;
        q = q.range(from, to);
      }

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      
      return { list: (data || []) as T[], count };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache (evita requisições repetidas ao trocar de abas)
  });

  // Sincroniza o cache do React Query com o estado local para manter compatibilidade com componentes antigos
  useEffect(() => {
    if (fetchedData) {
      setXData(fetchedData.list);
      if (config.XUsePagination && fetchedData.count !== null) {
        setXTotalCount(fetchedData.count);
      } else {
        setXTotalCount(fetchedData.list.length);
      }
      config.XOnAfterLoad?.(fetchedData.list);
    }
  }, [fetchedData, config]);

  const loadData = useCallback(async () => {
    setXLoading(true);
    await refetch();
    setXLoading(false);
  }, [refetch]);

  useEffect(() => {
    loadData();
    setXCurrentIdx(0);
    setXFormMode(config.XInitialMode || "view");
  }, [loadData, config.XInitialMode]);

  // Sync edit record when entering edit mode is handled directly in handleEditar and handleIncluir handlers to avoid race conditions.

  const handleIncluir = useCallback(() => {
    setXEditRecord({ ...config.XDefaultRecord });
    setXFormMode("insert");
  }, [config.XDefaultRecord]);

  const handleEditar = useCallback(() => {
    if (!XCurrentRecord) return;
    setXEditRecord({ ...XCurrentRecord });
    setXFormMode("edit");
  }, [XCurrentRecord]);

  const handleCancelar = useCallback(() => setXFormMode("view"), []);

  const handleSalvar = useCallback(async () => {
    let payload = { ...XEditRecord };
    if (config.XValidator) {
      const r = config.XValidator.safeParse(payload);
      if (!r.success) { toast.error(r.error.errors[0]?.message || "Dados inválidos."); return null; }
    }
    if (config.XOnBeforeSave) {
      try { payload = await config.XOnBeforeSave(payload, XFormMode); }
      catch (e: any) { toast.error(e?.message || "Validação falhou."); return null; }
    }
    if (config.XEmpresaId !== undefined && !payload.empresa_id) {
      (payload as any).empresa_id = config.XEmpresaId;
    }

    let savedRec: Partial<T> = payload;
    if (config.XOnSave) {
      try {
        const res = await config.XOnSave(payload, XFormMode);
        if (res) savedRec = res as Partial<T>;
      } catch (e: any) {
        toast.error(e?.message || "Erro ao salvar.");
        return null;
      }
    } else if (XFormMode === "insert") {
      const insertPayload = { ...payload };
      delete insertPayload[config.XPrimaryKey];
      Object.keys(insertPayload).forEach(key => {
        const val = (insertPayload as any)[key];
        if (Array.isArray(val) || (val && typeof val === 'object' && !(val instanceof Date))) {
          delete (insertPayload as any)[key];
        }
      });

      const { data: ins, error } = await db.from(config.XTableName).insert(insertPayload).select().single();
      if (error) { toast.error("Erro: " + error.message); return null; }
      savedRec = (ins || payload) as Partial<T>;
      toast.success("Registro incluído com sucesso.");
    } else if (XCurrentRecord) {
      const updatePayload = { ...payload };
      delete updatePayload[config.XPrimaryKey];
      Object.keys(updatePayload).forEach(key => {
        const val = (updatePayload as any)[key];
        if (Array.isArray(val) || (val && typeof val === 'object' && !(val instanceof Date))) {
          delete (updatePayload as any)[key];
        }
      });

      let { data: upd, error } = await db.from(config.XTableName)
        .update({ ...updatePayload, dt_alteracao: new Date().toISOString() })
        .eq(config.XPrimaryKey, XCurrentRecord[config.XPrimaryKey])
        .select().maybeSingle();

      if (error && error.message?.includes("dt_alteracao")) {
        const fallbackRes = await db.from(config.XTableName)
          .update(updatePayload)
          .eq(config.XPrimaryKey, XCurrentRecord[config.XPrimaryKey])
          .select().maybeSingle();
        upd = fallbackRes.data;
        error = fallbackRes.error;
      }

      if (error) { toast.error("Erro: " + error.message); return null; }
      savedRec = (upd || { ...XCurrentRecord, ...payload }) as Partial<T>;
      toast.success("Registro alterado com sucesso.");
    }
    if (config.XOnAfterSave) {
      try { await config.XOnAfterSave(savedRec, XFormMode); } catch (e: any) {
        toast.error(e?.message || "Pós-processamento falhou.");
      }
    }
    if (config.XKeepEditAfterInsert && XFormMode === "insert") {
      setXEditRecord({ ...savedRec as T });
      setXFormMode("edit");
    } else {
      setXFormMode("view");
    }
    // Invalida o cache para que outras abas que usem a mesma tabela se atualizem sozinhas
    queryClient.removeQueries({ queryKey: [config.XTableName] });
    const refetchResult = await refetch();
    // Seleciona o registro salvo diretamente na lista retornada pelo refetch
    if (savedRec && (savedRec as any)[config.XPrimaryKey] !== undefined) {
      const pkVal = (savedRec as any)[config.XPrimaryKey];
      const freshList = (refetchResult?.data as any)?.list as T[] | undefined;
      if (freshList) {
        const idx = freshList.findIndex(r => (r as any)[config.XPrimaryKey] === pkVal);
        if (idx >= 0) {
          setXData(freshList);
          setXCurrentIdx(idx);
        }
      } else {
        // Fallback: aguarda o próximo render com XData atualizado
        setTimeout(() => {
          setXData(curr => {
            const idx = curr.findIndex(r => (r as any)[config.XPrimaryKey] === pkVal);
            if (idx >= 0) setXCurrentIdx(idx);
            return curr;
          });
        }, 0);
      }
    }
    return savedRec;
  }, [XEditRecord, XFormMode, XCurrentRecord, config, refetch, queryClient]);

  const handleExcluir = useCallback(async () => {
    if (!XCurrentRecord) return;
    if (!confirm("Deseja realmente excluir este registro?")) return;

    const pkVal = XCurrentRecord[config.XPrimaryKey];

    if (config.XOnDelete) {
      try {
        await config.XOnDelete(XCurrentRecord);
        toast.success("Registro excluído.");
      } catch (e: any) {
        toast.error(e?.message || "Erro ao excluir.");
        return;
      }
    } else {
      let error;
      if (config.XSoftDelete === false) {
        // Hard delete
        const { error: err } = await db.from(config.XTableName)
          .delete()
          .eq(config.XPrimaryKey, pkVal);
        error = err;
      } else {
        // Soft delete (default)
        let { error: err } = await db.from(config.XTableName)
          .update({ excluido: true, dt_alteracao: new Date().toISOString() })
          .eq(config.XPrimaryKey, pkVal);

        if (err && err.message?.includes("dt_alteracao")) {
          const fallbackRes = await db.from(config.XTableName)
            .update({ excluido: true })
            .eq(config.XPrimaryKey, pkVal);
          err = fallbackRes.error;
        }

        error = err;
      }

      if (error) { toast.error("Erro: " + error.message); return; }
      toast.success("Registro excluído.");
    }
    
    // Remove imediatamente o registro excluído do estado local (evita que o cache antigo mantenha na tela)
    setXData(prev => {
      const newList = prev.filter(r => r[config.XPrimaryKey] !== pkVal);
      return newList;
    });
    setXCurrentIdx(i => Math.max(0, i - 1));

    // Remove o cache e força nova busca
    queryClient.removeQueries({ queryKey: [config.XTableName] });
    await loadData();
  }, [XCurrentRecord, config, loadData, queryClient]);

  const handleFirst = useCallback(() => setXCurrentIdx(0), []);
  const handlePrev = useCallback(() => setXCurrentIdx(i => Math.max(0, i - 1)), []);
  const handleNext = useCallback(() => setXCurrentIdx(i => Math.min(XData.length - 1, i + 1)), [XData.length]);
  const handleLast = useCallback(() => setXCurrentIdx(XData.length - 1), [XData.length]);
  const handleRefresh = useCallback(async () => {
    await loadData();
    toast.info("Dados recarregados.");
  }, [loadData]);

  // Pagination Handlers
  const handleNextPage = useCallback(() => {
    if (!config.XUsePagination) return;
    const size = config.XPageSize || 50;
    if ((XPage + 1) * size < XTotalCount) {
      setXPage(p => p + 1);
    }
  }, [config.XUsePagination, config.XPageSize, XPage, XTotalCount]);

  const handlePrevPage = useCallback(() => {
    if (!config.XUsePagination) return;
    if (XPage > 0) setXPage(p => p - 1);
  }, [config.XUsePagination, XPage]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setXEditRecord(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    XFormMode,
    XIsEditing,
    XData,
    XCurrentIdx,
    XCurrentRecord,
    XEditRecord,
    XLoading: XLoading || queryLoading,
    setXData,
    setXFormMode,
    setXEditRecord,
    setXCurrentIdx,
    setField,
    loadData,
    handleIncluir,
    handleEditar,
    handleCancelar,
    handleSalvar,
    handleExcluir,
    handleFirst,
    handlePrev,
    handleNext,
    handleLast,
    handleRefresh,
    XPage,
    XTotalCount,
    setXPage,
    handleNextPage,
    handlePrevPage,
  };
}
