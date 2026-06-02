import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Search } from "lucide-react";
import CidadeSearchDialog, { ICidadeRow } from "@/components/shared/CidadeSearchDialog";

const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
  record: any;
  setField: (k: string, v: any) => void;
  isEditing: boolean;
}

const MdfPercursoTab: React.FC<IProps> = ({
  mdfManifestoId,
  empresaId,
  podeEditar,
  record,
  setField,
  isEditing
}) => {
  // Grids state
  const [carregaRows, setCarregaRows] = useState<any[]>([]);
  const [percursoRows, setPercursoRows] = useState<any[]>([]);
  const [descarregaRows, setDescarregaRows] = useState<any[]>([]);

  // Search Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<"carrega" | "descarrega">("carrega");

  // Selection state for percurso UF addition
  const [percursoUf, setPercursoUf] = useState("");

  const loadCarregamentos = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data: carregaData } = await supabase
      .from("fiscal_mdf_carrega")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .or("excluido.is.null,excluido.eq.false")
      .order("mdf_carrega_id");

    if (!carregaData || carregaData.length === 0) {
      setCarregaRows([]);
      return;
    }

    // Join em memória com a tabela de cidades (devido à falta de chaves estrangeiras explícitas no Postgrest)
    const cidadeIds = carregaData.map(r => r.cidade_id);
    const { data: cidadesData } = await supabase
      .from("cidade")
      .select("cidade_id, descricao, estado_id")
      .in("cidade_id", cidadeIds);

    const mapped = carregaData.map(r => {
      const cidade = cidadesData?.find(c => c.cidade_id === r.cidade_id);
      return {
        ...r,
        cidade: cidade || { descricao: `Cidade ${r.cidade_id}`, estado_id: "" }
      };
    });

    setCarregaRows(mapped);
  }, [mdfManifestoId]);

  const loadPercursos = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data } = await supabase
      .from("fiscal_mdf_percurso")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .or("excluido.is.null,excluido.eq.false")
      .order("mdf_percurso_id");
    setPercursoRows(data || []);
  }, [mdfManifestoId]);

  const loadDescarregamentos = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data: descarregaData } = await supabase
      .from("fiscal_mdf_descarrega")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .or("excluido.is.null,excluido.eq.false")
      .order("mdf_descarrega_id");

    if (!descarregaData || descarregaData.length === 0) {
      setDescarregaRows([]);
      return;
    }

    // Join em memória com a tabela de cidades (devido à falta de chaves estrangeiras explícitas no Postgrest)
    const cidadeIds = descarregaData.map(r => r.cidade_id);
    const { data: cidadesData } = await supabase
      .from("cidade")
      .select("cidade_id, descricao, estado_id")
      .in("cidade_id", cidadeIds);

    const mapped = descarregaData.map(r => {
      const cidade = cidadesData?.find(c => c.cidade_id === r.cidade_id);
      return {
        ...r,
        cidade: cidade || { descricao: `Cidade ${r.cidade_id}`, estado_id: "" }
      };
    });

    setDescarregaRows(mapped);
  }, [mdfManifestoId]);

  const loadAll = useCallback(() => {
    loadCarregamentos();
    loadPercursos();
    loadDescarregamentos();
  }, [loadCarregamentos, loadPercursos, loadDescarregamentos]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Loading Cities Handlers
  const handleOpenSearch = (target: "carrega" | "descarrega") => {
    if (!mdfManifestoId) {
      toast.warning("Salve os dados gerais do MDF-e primeiro.");
      return;
    }
    if (target === "carrega" && !record.ufini) {
      toast.warning("Selecione a UF de Carregamento primeiro.");
      return;
    }
    if (target === "descarrega" && !record.uffim) {
      toast.warning("Selecione a UF de Descarregamento primeiro.");
      return;
    }
    setDialogTarget(target);
    setDialogOpen(true);
  };

  const handleSelectCidade = async (cidade: ICidadeRow) => {
    if (!mdfManifestoId) return;

    if (dialogTarget === "carrega") {
      if (carregaRows.some(r => r.cidade_id === cidade.cidade_id)) {
        toast.warning("Esta cidade de carregamento já foi adicionada.");
        return;
      }
      if (descarregaRows.some(r => r.cidade_id === cidade.cidade_id)) {
        toast.warning("Esta cidade já foi adicionada como descarregamento. Carregamento e descarregamento devem ter cidades diferentes.");
        return;
      }
      const { error } = await supabase.from("fiscal_mdf_carrega").insert({
        mdf_manifesto_id: mdfManifestoId,
        empresa_id: empresaId,
        cidade_id: cidade.cidade_id,
        excluido: false,
        dt_cadastro: new Date().toISOString(),
      });
      if (error) {
        toast.error("Erro ao adicionar: " + error.message);
        return;
      }
      toast.success("Cidade de carregamento adicionada.");
      loadCarregamentos();
    } else {
      if (descarregaRows.some(r => r.cidade_id === cidade.cidade_id)) {
        toast.warning("Esta cidade de descarregamento já foi adicionada.");
        return;
      }
      if (carregaRows.some(r => r.cidade_id === cidade.cidade_id)) {
        toast.warning("Esta cidade já foi adicionada como carregamento. Carregamento e descarregamento devem ter cidades diferentes.");
        return;
      }
      const { error } = await supabase.from("fiscal_mdf_descarrega").insert({
        mdf_manifesto_id: mdfManifestoId,
        empresa_id: empresaId,
        cidade_id: cidade.cidade_id,
        excluido: false,
        dt_cadastro: new Date().toISOString(),
      });
      if (error) {
        toast.error("Erro ao adicionar: " + error.message);
        return;
      }
      toast.success("Cidade de descarregamento adicionada.");
      loadDescarregamentos();
    }
  };

  const handleRemoveCarregamento = async (id: number) => {
    if (!confirm("Remover esta cidade de carregamento?")) return;
    const { error } = await supabase
      .from("fiscal_mdf_carrega")
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq("mdf_carrega_id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    loadCarregamentos();
  };

  const handleRemoveDescarregamento = async (id: number) => {
    if (!confirm("Remover esta cidade de descarregamento?")) return;
    const { error } = await supabase
      .from("fiscal_mdf_descarrega")
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq("mdf_descarrega_id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    loadDescarregamentos();
  };

  // Transit UFs Handlers
  const handleAddPercursoUf = async () => {
    if (!percursoUf) {
      toast.warning("Selecione a UF.");
      return;
    }
    if (!mdfManifestoId) {
      toast.warning("Salve os dados gerais do MDF-e primeiro.");
      return;
    }
    if (percursoRows.some(r => r.uf === percursoUf)) {
      toast.warning("Esta UF já foi adicionada ao percurso.");
      return;
    }
    const { error } = await supabase.from("fiscal_mdf_percurso").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      uf: percursoUf,
      excluido: false,
      dt_cadastro: new Date().toISOString(),
    });
    if (error) {
      toast.error("Erro ao adicionar: " + error.message);
      return;
    }
    toast.success("UF de percurso adicionada.");
    setPercursoUf("");
    loadPercursos();
  };

  const handleRemovePercursoUf = async (id: number) => {
    if (!confirm("Remover esta UF do percurso?")) return;
    const { error } = await supabase
      .from("fiscal_mdf_percurso")
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq("mdf_percurso_id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    loadPercursos();
  };

  const ro = !isEditing;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* === COLUNA 1: CARREGAMENTO === */}
        <div className="border border-border rounded-lg p-4 bg-card flex flex-col space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">1. Carregamento</h3>
            <p className="text-[10px] text-muted-foreground">UF Inicial e Municípios de Origem</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">UF de Carregamento (UF Inicial) <span className="text-destructive">*</span></label>
            <select
              disabled={ro}
              value={record.ufini ?? ""}
              onChange={e => setField("ufini", e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card font-medium focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">— UF —</option>
              {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-muted-foreground">Municípios de Carregamento</label>
              {podeEditar && (
                <button
                  onClick={() => handleOpenSearch("carrega")}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
                >
                  <Search className="w-3.5 h-3.5" /> Pesquisar
                </button>
              )}
            </div>

            <div className="border border-border rounded overflow-hidden flex-1 bg-background/50 min-h-[200px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-left border-b border-border">
                    <th className="px-3 py-2 font-semibold w-16 text-right">ID</th>
                    <th className="px-3 py-2 font-semibold">Cidade</th>
                    <th className="px-3 py-2 font-semibold w-12 text-center">UF</th>
                    {podeEditar && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {carregaRows.length === 0 ? (
                    <tr>
                      <td colSpan={podeEditar ? 4 : 3} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma cidade de carregamento.
                      </td>
                    </tr>
                  ) : (
                    carregaRows.map(r => (
                      <tr key={r.mdf_carrega_id} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{r.cidade_id}</td>
                        <td className="px-3 py-1.5 uppercase font-medium">{r.cidade?.descricao || "-"}</td>
                        <td className="px-3 py-1.5 text-center uppercase font-bold">{r.cidade?.estado_id || "-"}</td>
                        {podeEditar && (
                          <td className="px-1 py-1.5 text-center">
                            <button
                              onClick={() => handleRemoveCarregamento(r.mdf_carrega_id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* === COLUNA 2: TRÂNSITO / PERCURSO === */}
        <div className="border border-border rounded-lg p-4 bg-card flex flex-col space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">2. Trânsito</h3>
            <p className="text-[10px] text-muted-foreground">UFs de Percurso Intermediárias</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">UF de Percurso</label>
            <div className="flex gap-2">
              <select
                disabled={ro}
                value={percursoUf}
                onChange={e => setPercursoUf(e.target.value)}
                className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-card font-medium focus:ring-1 focus:ring-primary focus:border-primary"
              >
                <option value="">— Selecione —</option>
                {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
              {podeEditar && (
                <button
                  onClick={handleAddPercursoUf}
                  className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">UFs do Percurso (Ordem de Trânsito)</label>
            <div className="border border-border rounded overflow-hidden flex-1 bg-background/50 min-h-[200px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-left border-b border-border">
                    <th className="px-3 py-2 font-semibold w-16 text-right">Ordem</th>
                    <th className="px-3 py-2 font-semibold">UF</th>
                    {podeEditar && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {percursoRows.length === 0 ? (
                    <tr>
                      <td colSpan={podeEditar ? 3 : 2} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma UF de percurso informada.
                      </td>
                    </tr>
                  ) : (
                    percursoRows.map((r, i) => (
                      <tr key={r.mdf_percurso_id} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-1.5 font-bold uppercase text-primary">{r.uf}</td>
                        {podeEditar && (
                          <td className="px-1 py-1.5 text-center">
                            <button
                              onClick={() => handleRemovePercursoUf(r.mdf_percurso_id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* === COLUNA 3: DESCARREGAMENTO === */}
        <div className="border border-border rounded-lg p-4 bg-card flex flex-col space-y-4 shadow-sm hover:shadow-md transition-shadow">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">3. Descarregamento</h3>
            <p className="text-[10px] text-muted-foreground">UF Final e Municípios de Entrega</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">UF de Descarregamento (UF Final) <span className="text-destructive">*</span></label>
            <select
              disabled={ro}
              value={record.uffim ?? ""}
              onChange={e => setField("uffim", e.target.value)}
              className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card font-medium focus:ring-1 focus:ring-primary focus:border-primary"
            >
              <option value="">— UF —</option>
              {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-muted-foreground">Municípios de Descarregamento</label>
              {podeEditar && (
                <button
                  onClick={() => handleOpenSearch("descarrega")}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
                >
                  <Search className="w-3.5 h-3.5" /> Pesquisar
                </button>
              )}
            </div>

            <div className="border border-border rounded overflow-hidden flex-1 bg-background/50 min-h-[200px]">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-secondary/40 text-left border-b border-border">
                    <th className="px-3 py-2 font-semibold w-16 text-right">ID</th>
                    <th className="px-3 py-2 font-semibold">Cidade</th>
                    <th className="px-3 py-2 font-semibold w-12 text-center">UF</th>
                    {podeEditar && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {descarregaRows.length === 0 ? (
                    <tr>
                      <td colSpan={podeEditar ? 4 : 3} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhuma cidade de descarregamento.
                      </td>
                    </tr>
                  ) : (
                    descarregaRows.map(r => (
                      <tr key={r.mdf_descarrega_id} className="border-b border-border/50 hover:bg-accent/20">
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{r.cidade_id}</td>
                        <td className="px-3 py-1.5 uppercase font-medium">{r.cidade?.descricao || "-"}</td>
                        <td className="px-3 py-1.5 text-center uppercase font-bold">{r.cidade?.estado_id || "-"}</td>
                        {podeEditar && (
                          <td className="px-1 py-1.5 text-center">
                            <button
                              onClick={() => handleRemoveDescarregamento(r.mdf_descarrega_id)}
                              className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Search dialog for cities */}
      <CidadeSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelectCidade}
        ufFilter={dialogTarget === "carrega" ? record.ufini : record.uffim}
      />
    </div>
  );
};

export default MdfPercursoTab;
