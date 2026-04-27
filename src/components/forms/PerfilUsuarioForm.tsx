import React, { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { usePerfis } from "@/hooks/useAccessControl";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";

interface IPerfilUsuarioView {
  perfil_usuario_id: number;
  empresa_id: number;
  user_id: string;
  perfil_id: number;
  nm_perfil: string;
}

const XColumns: IGridColumn[] = [
  { key: "perfil_usuario_id", label: "ID", width: "60px", align: "right" },
  { key: "user_id", label: "Usuário (UUID)", width: "1fr" },
  { key: "nm_perfil", label: "Perfil", width: "200px" },
];

const PerfilUsuarioForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const { XPerfis } = usePerfis(XEmpresaId);
  const [XData, setXData] = useState<IPerfilUsuarioView[]>([]);
  const [XNewUserId, setXNewUserId] = useState("");
  const [XNewPerfilId, setXNewPerfilId] = useState<number | "">("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const { data: XPuData } = await supabase
      .from("perfil_usuario")
      .select("*, perfil(nm_perfil)")
      .eq("empresa_id", XEmpresaId)
      .eq("fl_excluido", false);

    if (!XPuData) { setXData([]); return; }

    setXData(XPuData.map((pu: any) => ({
      perfil_usuario_id: pu.perfil_usuario_id,
      empresa_id: pu.empresa_id,
      user_id: pu.user_id,
      perfil_id: pu.perfil_id,
      nm_perfil: pu.perfil?.nm_perfil || "",
    })));
  }, [XEmpresaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = useCallback(async () => {
    if (!XNewUserId.trim() || !XNewPerfilId) { toast.error("Informe o UUID e selecione um perfil"); return; }
    const { error } = await supabase.from("perfil_usuario").insert({
      empresa_id: XEmpresaId,
      user_id: XNewUserId.trim(),
      perfil_id: Number(XNewPerfilId),
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Perfil associado ao usuário");
    setXNewUserId("");
    setXNewPerfilId("");
    await loadData();
  }, [XNewUserId, XNewPerfilId, XEmpresaId, loadData]);

  const handleDelete = useCallback(async () => {
    if (XSelectedIdx === null || !XData[XSelectedIdx]) return;
    if (!confirm("Deseja remover esta associação?")) return;
    const { error } = await supabase.from("perfil_usuario")
      .update({ fl_excluido: true })
      .eq("perfil_usuario_id", XData[XSelectedIdx].perfil_usuario_id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    await loadData();
    setXSelectedIdx(null);
  }, [XSelectedIdx, XData, loadData]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b border-border bg-toolbar-bg shrink-0 flex-wrap">
        <button onClick={loadData} className="p-1.5 rounded hover:bg-accent" title="Atualizar"><RefreshCw size={16} /></button>
        <div className="w-px h-5 bg-border" />
        <input
          className="border border-input rounded px-2 py-1 text-sm bg-background w-64"
          placeholder="UUID do usuário"
          value={XNewUserId}
          onChange={e => setXNewUserId(e.target.value)}
        />
        <select
          className="border border-input rounded px-2 py-1 text-sm bg-background"
          value={XNewPerfilId}
          onChange={e => setXNewPerfilId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Perfil...</option>
          {XPerfis.map(p => (
            <option key={p.perfil_id} value={p.perfil_id}>{p.nm_perfil}</option>
          ))}
        </select>
        <button onClick={handleAdd} disabled={!XNewUserId || !XNewPerfilId} className="p-1.5 rounded bg-primary text-primary-foreground hover:opacity-80 disabled:opacity-40" title="Adicionar"><Plus size={16} /></button>
        <button onClick={handleDelete} disabled={XSelectedIdx === null} className="p-1.5 rounded hover:bg-accent disabled:opacity-40 text-destructive" title="Remover"><Trash2 size={16} /></button>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <DataGrid
          columns={XColumns}
          data={XData}
          selectedIdx={XSelectedIdx}
          onRowClick={(_, idx) => setXSelectedIdx(idx)}
          showFilters
          filterValues={XSearchFilters}
          onFilterChange={(k, v) => setXSearchFilters(prev => ({ ...prev, [k]: v }))}
          exportTitle="Usuários por Perfil"
        />
      </div>

      <div className="flex items-center px-3 py-1 border-t border-border bg-muted text-xs text-muted-foreground shrink-0">
        <span>Total: {XData.length} registro(s)</span>
      </div>
    </div>
  );
};

export default PerfilUsuarioForm;
