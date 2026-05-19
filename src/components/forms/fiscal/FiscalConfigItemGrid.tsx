import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DataGrid, { IGridColumn } from "@/components/grid/DataGrid";
import GridActionToolbar, { gridActions } from "@/components/grid/GridActionToolbar";

const db = supabase as any;

interface FiscalConfigItemGridProps {
  XEmpresaId: number;
}

const TIPOS_IMP = [
  { value: "PDF", label: "PDF na tela" },
  { value: "IMPRESSORA", label: "Imprimir direto" },
  { value: "NAO_IMPRIME", label: "Não imprime" },
];

const XModelColumns: IGridColumn[] = [
  { key: "nome", label: "Nome", width: "1fr" },
  { key: "modelo", label: "Modelo", width: "90px", align: "center" },
  { key: "serie", label: "Série", width: "80px", align: "center" },
  { key: "sequencia", label: "Próx. Nº", width: "100px", align: "right" },
  { key: "id_csc", label: "ID CSC", width: "90px" },
  { key: "csc", label: "CSC (Token)", width: "180px" },
  { key: "enviar_email", label: "Env. E-mail", width: "90px", align: "center", render: r => r.enviar_email === 'S' ? "Sim" : "Não" },
  { key: "tp_imp", label: "Tipo Imp.", width: "110px", render: r => TIPOS_IMP.find(t => t.value === r.tp_imp)?.label || r.tp_imp || "-" },
  { key: "nm_impressora", label: "Impressora", width: "150px" },
];

const FiscalConfigItemGrid: React.FC<FiscalConfigItemGridProps> = ({ XEmpresaId }) => {
  const [XItems, setXItems] = useState<any[]>([]);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XFilterValues, setXFilterValues] = useState<Record<string, string>>({});
  const [XEditMode, setXEditMode] = useState<"none" | "insert" | "edit">("none");
  const [XShowFilters, setXShowFilters] = useState(true);
  const [XImpressoras, setXImpressoras] = useState<string[]>([]);

  // Estados do formulário de edição inline
  const [XEditNome, setXEditNome] = useState("");
  const [XEditModelo, setXEditModelo] = useState("55");
  const [XEditSerie, setXEditSerie] = useState("1");
  const [XEditSequencia, setXEditSequencia] = useState("1");
  const [XEditCsc, setXEditCsc] = useState("");
  const [XEditIdCsc, setXEditIdCsc] = useState("");
  const [XEditTpImp, setXEditTpImp] = useState("PDF");
  const [XEditNmImpressora, setXEditNmImpressora] = useState("");
  const [XEditEnviarEmail, setXEditEnviarEmail] = useState("N");

  const loadData = useCallback(async () => {
    if (!XEmpresaId) return;
    const { data, error } = await db.from("fiscal_config_item")
      .select("*")
      .eq("empresa_id", XEmpresaId)
      .order("modelo");
    
    if (error) {
        console.error("Erro ao carregar itens fiscais:", error);
        return;
    }
    setXItems(data || []);
  }, [XEmpresaId]);

  useEffect(() => {
    loadData();
    setXSelectedIdx(null);
    setXEditMode("none");
  }, [XEmpresaId, loadData]);

  const XFiltered = XItems.filter(item => {
    for (const [key, val] of Object.entries(XFilterValues)) {
      if (!val) continue;
      const rowVal = String(item[key] || "").toLowerCase();
      if (!rowVal.includes(val.toLowerCase())) return false;
    }
    return true;
  });

  const XSelectedItem = XSelectedIdx !== null ? XFiltered[XSelectedIdx] : null;

  const handleIncluir = () => { 
    setXEditMode("insert"); 
    setXEditNome("");
    setXEditModelo("55");
    setXEditSerie("1");
    setXEditSequencia("1");
    setXEditCsc("");
    setXEditIdCsc("");
    setXEditTpImp("PDF");
    setXEditNmImpressora("");
    setXEditEnviarEmail("N");
  };

  const handleEditar = () => {
    if (!XSelectedItem) return;
    setXEditMode("edit");
    setXEditNome(XSelectedItem.nome || "");
    setXEditModelo(XSelectedItem.modelo);
    setXEditSerie(XSelectedItem.serie);
    setXEditSequencia(XSelectedItem.sequencia.toString());
    setXEditCsc(XSelectedItem.csc || "");
    setXEditIdCsc(XSelectedItem.id_csc || "");
    setXEditTpImp(XSelectedItem.tp_imp || "PDF");
    setXEditNmImpressora(XSelectedItem.nm_impressora || "");
    setXEditEnviarEmail(XSelectedItem.enviar_email || "N");
  };

  const handleListarImpressoras = async () => {
    try {
      const { fiscalEmissaoService } = await import("@/services/fiscalEmissaoService");
      const res = await (fiscalEmissaoService as any).listarImpressoras?.(XEmpresaId);
      if (res?.success && Array.isArray(res.impressoras) && res.impressoras.length > 0) {
        setXImpressoras(res.impressoras);
        toast.success(`${res.impressoras.length} impressora(s) detectada(s).`);
      } else {
        toast.info("Nenhuma impressora detectada — informe o nome manualmente.");
      }
    } catch (e: any) {
      toast.error("Falha ao listar impressoras: " + e.message);
    }
  };

  const handleSalvar = async () => {
    if (!XEditNome.trim()) { toast.error("Nome é obrigatório."); return; }
    if (!XEditModelo || !XEditSerie) { toast.error("Modelo e Série são obrigatórios."); return; }
    
    const itemData = {
      empresa_id: XEmpresaId,
      nome: XEditNome.trim(),
      modelo: XEditModelo,
      serie: XEditSerie,
      sequencia: parseInt(XEditSequencia) || 1,
      csc: XEditCsc.trim(),
      id_csc: XEditIdCsc.trim(),
      tp_imp: XEditTpImp,
      nm_impressora: XEditNmImpressora.trim() || null,
      enviar_email: XEditEnviarEmail,
    };

    if (XEditMode === "insert") {
      const { error } = await db.from("fiscal_config_item").insert(itemData);
      if (error) { toast.error("Erro ao incluir: " + error.message); return; }
      toast.success("Modelo fiscal incluído.");
    } else if (XEditMode === "edit" && XSelectedItem) {
      const { error } = await db.from("fiscal_config_item")
        .update(itemData)
        .eq("fiscal_config_item_id", XSelectedItem.fiscal_config_item_id);
      if (error) { toast.error("Erro ao alterar: " + error.message); return; }
      toast.success("Modelo fiscal alterado.");
    }
    
    setXEditMode("none");
    await loadData();
  };

  const handleExcluir = async () => {
    if (!XSelectedItem) return;
    if (confirm(`Excluir configuração do modelo ${XSelectedItem.modelo} série ${XSelectedItem.serie}?`)) {
      const { error } = await db.from("fiscal_config_item")
        .delete()
        .eq("fiscal_config_item_id", XSelectedItem.fiscal_config_item_id);
      
      if (error) { toast.error("Erro ao excluir: " + error.message); return; }
      toast.success("Item excluído.");
      setXSelectedIdx(null);
      await loadData();
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setXFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const XToolbar = (
    <GridActionToolbar
      actions={[
        gridActions.incluir(handleIncluir),
        gridActions.alterar(handleEditar, !XSelectedItem),
        null,
        gridActions.excluir(handleExcluir, !XSelectedItem),
        gridActions.atualizar(loadData),
        gridActions.filtro(() => setXShowFilters(!XShowFilters), XShowFilters),
      ]}
      count={`${XFiltered.length} registro(s)`}
    />
  );

  return (
    <div className="space-y-4">
      {/* Formulário de Edição Inline Estilizado */}
      {XEditMode !== "none" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 p-4 bg-accent/30 rounded-lg border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nome</label>
            <input
              type="text"
              value={XEditNome}
              onChange={(e) => setXEditNome(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: NFCe Loja 01"
              autoFocus
              maxLength={30}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Modelo</label>
            <select 
              value={XEditModelo}
              onChange={(e) => setXEditModelo(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="55">55 - NFe</option>
              <option value="65">65 - NFCe</option>
              <option value="58">58 - MDFe</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Série</label>
            <input
              type="text"
              value={XEditSerie}
              onChange={(e) => setXEditSerie(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="001"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Próx. Nº</label>
            <input
              type="number"
              value={XEditSequencia}
              onChange={(e) => setXEditSequencia(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">ID CSC</label>
            <input
              type="text"
              value={XEditIdCsc}
              onChange={(e) => setXEditIdCsc(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="000001"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">CSC (Token)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={XEditCsc}
                onChange={(e) => setXEditCsc(e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Token..."
              />
              <button
                onClick={handleSalvar}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all"
              >
                Salvar
              </button>
              <button
                onClick={() => setXEditMode("none")}
                className="h-9 px-4 rounded-md bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90 transition-all"
              >
                X
              </button>
            </div>
          </div>

          {/* Linha 2: Configuração de impressão */}
          <div className="md:col-span-7 mt-1 grid grid-cols-1 md:grid-cols-5 gap-3 pt-3 border-t border-border/50">
            <div className="md:col-span-5 text-[10px] font-bold uppercase text-muted-foreground">
              Configuração de impressão e envio
            </div>
            <div className="flex flex-col gap-1 md:col-span-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Tipo Impressão</label>
              <select value={XEditTpImp} onChange={e => setXEditTpImp(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring">
                {TIPOS_IMP.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Nome da Impressora</label>
              <div className="flex gap-2">
                <input type="text" list="lst-impressoras" value={XEditNmImpressora}
                  onChange={e => setXEditNmImpressora(e.target.value)}
                  disabled={XEditTpImp !== "IMPRESSORA"}
                  className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  placeholder="Nome da impressora..." />
                <button type="button" onClick={handleListarImpressoras}
                  className="h-9 px-3 rounded-md bg-secondary text-secondary-foreground text-xs font-bold hover:opacity-90"
                  title="Detectar impressoras instaladas">
                  ↻
                </button>
              </div>
              <datalist id="lst-impressoras">
                {XImpressoras.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Enviar E-mail após emissão</label>
              <select value={XEditEnviarEmail} onChange={e => setXEditEnviarEmail(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="S">Sim (Sempre abrir tela de e-mail)</option>
                <option value="N">Não (Nunca abrir automaticamente)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid Principal */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
        <DataGrid
          columns={XModelColumns}
          data={XFiltered}
          selectedIdx={XSelectedIdx}
          onRowClick={(_row, idx) => setXSelectedIdx(idx)}
          onRowDoubleClick={(_row, idx) => {
            setXSelectedIdx(idx);
            const item = XFiltered[idx];
            if (item) {
                setXEditMode("edit");
                setXEditNome(item.nome || "");
                setXEditModelo(item.modelo);
                setXEditSerie(item.serie);
                setXEditSequencia(item.sequencia.toString());
                setXEditCsc(item.csc || "");
                setXEditIdCsc(item.id_csc || "");
                setXEditTpImp(item.tp_imp || "PDF");
                setXEditNmImpressora(item.nm_impressora || "");
                setXEditEnviarEmail(item.enviar_email || "N");
            }
          }}
          showFilters={XShowFilters}
          filterValues={XFilterValues}
          onFilterChange={handleFilterChange}
          maxHeight="350px"
          toolbarLeft={XToolbar}
          showRecordCount={false}
        />
      </div>
    </div>
  );
};

export default FiscalConfigItemGrid;
