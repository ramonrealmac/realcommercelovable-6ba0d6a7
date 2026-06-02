import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

interface IProps {
  mdfManifestoId: number | null;
  empresaId: number;
  podeEditar: boolean;
}

const MdfDocumentosTab: React.FC<IProps> = ({ mdfManifestoId, empresaId, podeEditar }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [chave, setChave] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [tpDoc, setTpDoc] = useState<"NFE" | "CTE">("NFE");
  const [descarregaCidades, setDescarregaCidades] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data: docData } = await supabase
      .from("fiscal_mdf_documento")
      .select("*")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .or("excluido.is.null,excluido.eq.false")
      .order("mdf_documento_id");

    if (!docData || docData.length === 0) {
      setRows([]);
      return;
    }

    const cidadeIds = docData.map(r => r.cidade_id);
    const { data: cidadesData } = await supabase
      .from("cidade")
      .select("cidade_id, descricao, estado_id")
      .in("cidade_id", cidadeIds);

    const mapped = docData.map(r => {
      const cidade = cidadesData?.find(c => c.cidade_id === r.cidade_id);
      return {
        ...r,
        cidade: cidade || { descricao: `Cidade ${r.cidade_id}`, estado_id: "" }
      };
    });

    // Ordena por nome da cidade (descricao) para exibir agrupado por cidade na grid
    mapped.sort((a, b) => {
      const nameA = a.cidade?.descricao || "";
      const nameB = b.cidade?.descricao || "";
      const cmp = nameA.localeCompare(nameB);
      if (cmp !== 0) return cmp;
      return a.mdf_documento_id - b.mdf_documento_id;
    });

    setRows(mapped);
  }, [mdfManifestoId]);

  const loadCidadesDescarregamento = useCallback(async () => {
    if (!mdfManifestoId) return;
    const { data: descarregaData } = await supabase
      .from("fiscal_mdf_descarrega")
      .select("cidade_id")
      .eq("mdf_manifesto_id", mdfManifestoId)
      .or("excluido.is.null,excluido.eq.false")
      .order("mdf_descarrega_id");

    if (!descarregaData || descarregaData.length === 0) {
      setDescarregaCidades([]);
      return;
    }

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

    setDescarregaCidades(mapped);
  }, [mdfManifestoId]);

  useEffect(() => {
    load();
    loadCidadesDescarregamento();
  }, [load, loadCidadesDescarregamento]);

  // Resumo dinâmico agrupado por Cidade + Tipo de Documento
  const resumoRows = useMemo(() => {
    const summaryMap: Record<string, { cidadeNome: string; tpDoc: string; qtd: number }> = {};

    rows.forEach(r => {
      const model = r.chave.substring(20, 22);
      const tpDoc = model === "57" ? "CT-e" : "NF-e";
      const cidadeNome = r.cidade ? `${r.cidade.descricao} - ${r.cidade.estado_id}` : `Cidade ${r.cidade_id}`;

      const key = `${r.cidade_id}_${tpDoc}`;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          cidadeNome,
          tpDoc,
          qtd: 0
        };
      }
      summaryMap[key].qtd += 1;
    });

    return Object.values(summaryMap).sort((a, b) => {
      const cmpCid = a.cidadeNome.localeCompare(b.cidadeNome);
      if (cmpCid !== 0) return cmpCid;
      return a.tpDoc.localeCompare(b.tpDoc);
    });
  }, [rows]);

  // Lista de documentos filtrada pela cidade selecionada
  const filteredRows = useMemo(() => {
    if (!cidadeId) return rows;
    return rows.filter(r => r.cidade_id === Number(cidadeId));
  }, [rows, cidadeId]);

  const handleAdd = async () => {
    const chaveClean = chave.replace(/\D/g, "");
    if (chaveClean.length !== 44) {
      toast.warning("A chave do documento deve ter exatamente 44 dígitos.");
      return;
    }
    
    // Validação do modelo conforme seleção
    const model = chaveClean.substring(20, 22);
    if (tpDoc === "NFE" && model !== "55") {
      toast.warning("A chave informada não é de uma NF-e (o modelo deve ser 55).");
      return;
    }
    if (tpDoc === "CTE" && model !== "57") {
      toast.warning("A chave informada não é de um CT-e (o modelo deve ser 57).");
      return;
    }

    if (!cidadeId) {
      toast.warning("Selecione a cidade de descarregamento.");
      return;
    }
    if (!mdfManifestoId) {
      toast.warning("Salve os dados gerais do MDF-e primeiro.");
      return;
    }
    
    // Verifica duplicidade
    if (rows.some(r => r.chave === chaveClean)) {
      toast.warning("Esta chave já foi adicionada.");
      return;
    }

    const { error } = await supabase.from("fiscal_mdf_documento").insert({
      mdf_manifesto_id: mdfManifestoId,
      empresa_id: empresaId,
      cidade_id: Number(cidadeId),
      chave: chaveClean,
      excluido: false,
      dt_cadastro: new Date().toISOString(),
    });

    if (error) {
      toast.error("Erro ao adicionar documento: " + error.message);
      return;
    }

    // Atualiza a quantidade de NF-e/documentos no manifesto principal
    const novaQtd = rows.length + 1;
    await supabase.from("fiscal_mdf_manifesto").update({ qtd_nfe: novaQtd }).eq("mdf_manifesto_id", mdfManifestoId);

    toast.success("Documento adicionado com sucesso.");
    setChave("");
    load();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remover este documento?")) return;
    
    const { error } = await supabase
      .from("fiscal_mdf_documento")
      .update({ excluido: true, dt_alteracao: new Date().toISOString() })
      .eq("mdf_documento_id", id);
      
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }

    const novaQtd = Math.max(0, rows.length - 1);
    if (mdfManifestoId) {
      await supabase.from("fiscal_mdf_manifesto").update({ qtd_nfe: novaQtd }).eq("mdf_manifesto_id", mdfManifestoId);
    }
    
    load();
  };

  if (!mdfManifestoId) {
    return <div className="p-4 text-sm text-muted-foreground">Salve os dados gerais do MDF-e primeiro.</div>;
  }

  return (
    <div className="space-y-4 p-2">
      {/* 1. Selecionar Cidade de Descarregamento / Filtro */}
      <div className="space-y-4 border border-border rounded p-4 bg-card shadow-sm">
        <div className="space-y-1 max-w-xl">
          <label className="text-xs font-bold text-primary uppercase tracking-wider">
            {podeEditar 
              ? "1. Selecionar Cidade de Descarregamento / Destino" 
              : "Filtrar por Cidade de Descarregamento / Destino"}
          </label>
          <select
            value={cidadeId}
            onChange={e => setCidadeId(e.target.value)}
            className="w-full border border-border rounded px-3 py-1.5 text-sm bg-card font-medium focus:ring-1 focus:ring-primary focus:border-primary"
          >
            <option value="">
              {podeEditar 
                ? "— Selecione uma Cidade de Descarregamento cadastrada (ou exiba todas) —" 
                : "— Exibir todas as Cidades —"}
            </option>
            {descarregaCidades.map(dc => (
              <option key={dc.cidade_id} value={dc.cidade_id}>
                {dc.cidade?.descricao} - {dc.cidade?.estado_id}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Inserir Documentos (somente se podeEditar) */}
        {podeEditar && (
          <div className="border-t border-border/60 pt-3 space-y-3">
            <div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                2. Lançar Documentos Fiscais
              </span>
              {!cidadeId && (
                <span className="ml-2 text-xs text-muted-foreground italic">
                  (Selecione a cidade acima para liberar o lançamento)
                </span>
              )}
            </div>

            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-3">
                <label className="text-xs text-muted-foreground">Tipo de Documento</label>
                <select
                  disabled={!cidadeId}
                  value={tpDoc}
                  onChange={e => setTpDoc(e.target.value as "NFE" | "CTE")}
                  className="w-full border border-border rounded px-2 py-1.5 text-sm bg-card disabled:opacity-50"
                >
                  <option value="NFE">NF-e (Nota Fiscal)</option>
                  <option value="CTE">CT-e (CT-e de Transporte)</option>
                </select>
              </div>

              <div className="col-span-7">
                <label className="text-xs text-muted-foreground flex justify-between">
                  <span>Chave do Documento (44 dígitos)</span>
                  {cidadeId && <span className="font-mono text-muted-foreground">{chave.length}/44</span>}
                </label>
                <input
                  disabled={!cidadeId}
                  value={chave}
                  onChange={e => setChave(e.target.value.replace(/\D/g, "").substring(0, 44))}
                  placeholder="00000000000000000000000000000000000000000000"
                  className="w-full border border-border rounded px-2 py-1.5 text-sm font-mono disabled:opacity-50"
                />
              </div>

              <div className="col-span-2">
                <button
                  disabled={!cidadeId}
                  onClick={handleAdd}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-sm w-full justify-center hover:bg-primary/90 font-medium transition-colors disabled:opacity-50 disabled:hover:bg-primary"
                >
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exibição das duas grids lado a lado */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Coluna Esquerda: Grid Principal de Documentos (8/12) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col space-y-2">
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            {cidadeId 
              ? `Documentos da Cidade Selecionada (Exibindo ${filteredRows.length} de ${rows.length})` 
              : `Documentos Cadastrados (Total: ${rows.length})`}
          </div>

          <div className="border border-border rounded overflow-hidden bg-card shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/40 text-left border-b border-border">
                  <th className="px-3 py-2 font-semibold">Cidade Descarregamento</th>
                  <th className="px-3 py-2 font-semibold w-[80px]">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Chave de Acesso</th>
                  {podeEditar && <th className="px-3 py-2 font-semibold w-[50px] text-center"></th>}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={podeEditar ? 4 : 3} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum documento encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(r => {
                    const model = r.chave.substring(20, 22);
                    const inferredTpDoc = model === "57" ? "CT-e" : "NF-e";
                    return (
                      <tr key={r.mdf_documento_id} className="hover:bg-accent/20 border-b border-border/50 transition-colors">
                        <td className="px-3 py-2 uppercase font-medium">
                          {r.cidade ? `${r.cidade.descricao} - ${r.cidade.estado_id}` : "-"}
                        </td>
                        <td className="px-3 py-2 font-bold text-primary">{inferredTpDoc}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.chave}</td>
                        {podeEditar && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleRemove(r.mdf_documento_id)}
                              className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                              title="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coluna Direita: Grid de Resumo (4/12) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col space-y-2">
          <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Resumo por Cidade
          </div>

          <div className="border border-border rounded overflow-hidden bg-card shadow-sm">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/40 text-left border-b border-border">
                  <th className="px-3 py-2 font-semibold">Cidade</th>
                  <th className="px-3 py-2 font-semibold w-[80px]">Doc</th>
                  <th className="px-3 py-2 font-semibold w-[60px] text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {resumoRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Nenhum lançamento.
                    </td>
                  </tr>
                ) : (
                  resumoRows.map((res, idx) => (
                    <tr key={idx} className="hover:bg-accent/20 border-b border-border/50 transition-colors">
                      <td className="px-3 py-2 uppercase font-medium truncate max-w-[140px]" title={res.cidadeNome}>
                        {res.cidadeNome}
                      </td>
                      <td className="px-3 py-2 font-bold text-primary">{res.tpDoc}</td>
                      <td className="px-3 py-2 font-mono text-right font-bold text-muted-foreground">{res.qtd}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MdfDocumentosTab;
