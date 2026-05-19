import React, { useState, useCallback, useEffect } from "react";
import { Plus, Save, Trash2, RefreshCw } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import { toast } from "sonner";

interface IEmpresaUsuarioView {
  empresa_usuario_id: number;
  empresa_id: number;
  user_id: string;
  user_email: string;
  fl_excluido: boolean;
}

const XColumns: IGridColumn[] = [
  { key: "empresa_usuario_id", label: "ID", width: "60px", align: "right" },
  { key: "empresa_id", label: "Empresa", width: "80px", align: "right" },
  { key: "user_email", label: "Usuário (Email)", width: "1fr" },
];

const EmpresaUsuarioForm: React.FC = () => {
  const { XEmpresaId } = useAppContext();
  const [XData, setXData] = useState<IEmpresaUsuarioView[]>([]);
  const [XNewEmail, setXNewEmail] = useState("");
  const [XSearchFilters, setXSearchFilters] = useState<Record<string, string>>({});
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const { data: XEuData } = await supabase
      .from("empresa_usuario")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .eq("fl_excluido", false);

    if (!XEuData) { setXData([]); return; }

    // We can't directly query auth.users from client, so we show user_id
    setXData(XEuData.map(eu => ({
      empresa_usuario_id: eu.empresa_usuario_id,
      empresa_id: eu.empresa_id,
      user_id: eu.user_id,
      user_email: eu.user_id, // Will show UUID - in real app you'd join with profiles
      fl_excluido: eu.fl_excluido,
    })));
  }, [XEmpresaId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = useCallback(async () => {
    if (!XNewEmail.trim()) { toast.error("Informe o UUID do usuário"); return; }
    const { error } = await supabase.from("empresa_usuario").insert({
      empresa_id: XEmpresaId,
      user_id: XNewEmail.trim(),
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Usuário associado à empresa");
    setXNewEmail("");
    await loadData();
  }, [XNewEmail, XEmpresaId, loadData]);

  const handleDelete = useCallback(async () => {
    if (XSelectedIdx === null || !XData[XSelectedIdx]) return;
    if (!confirm("Deseja remover este usuário da empresa?")) return;
    const { error } = await supabase.from("empresa_usuario")
      .update({ fl_excluido: true })
      .eq("empresa_usuario_id", XData[XSelectedIdx].empresa_usuario_id);
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
          value={XNewEmail}
          onChange={e => setXNewEmail(e.target.value)}
        />
        <button onClick={handleAdd} className="p-1.5 rounded bg-primary text-primary-foreground hover:opacity-80" title="Adicionar"><Plus size={16} /></button>
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
          exportTitle="Usuários por Empresa"
        />
      </div>

      <div className="flex items-center px-3 py-1 border-t border-border bg-muted text-xs text-muted-foreground shrink-0">
        <span>Total: {XData.length} registro(s)</span>
      </div>
    </div>
  );
};

export default EmpresaUsuarioForm;
