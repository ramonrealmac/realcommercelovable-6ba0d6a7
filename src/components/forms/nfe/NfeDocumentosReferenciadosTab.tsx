import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Key, Calendar, User, FileText, CheckCircle2, AlertTriangle, Pencil, Check, X } from "lucide-react";
import { formatCPFCNPJ } from "@/lib/validators";

const db = supabase as any;

interface IProps {
  nfeCabecalhoId: number | null;
  podeEditar: boolean;
  empresaId: number;
}

interface IReferenciadaItem {
  nfe_referenciada_id: number;
  nfe_cabecalho_id: number;
  chave_ref: string;
  created_at?: string;
  // Dados informativos (buscados no banco ou extraídos da chave)
  nr_nota?: string;
  nm_parceiro?: string;
  cnpj_parceiro?: string;
  dt_emissao?: string;
}

export const NfeDocumentosReferenciadosTab: React.FC<IProps> = ({
  nfeCabecalhoId,
  podeEditar,
}) => {
  const [XItens, setXItens] = useState<IReferenciadaItem[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XNovaChave, setXNovaChave] = useState("");
  const [XSalvando, setXSalvando] = useState(false);

  // Estado de Edição de Registro Existente
  const [XEditandoId, setXEditandoId] = useState<number | null>(null);
  const [XChaveEdicao, setXChaveEdicao] = useState("");

  const extrairInfoChave = (chave: string) => {
    const c = String(chave || "").replace(/\D/g, "");
    if (c.length !== 44) {
      return { nr_nota: "-", dt_emissao: "-", cnpj_parceiro: "" };
    }
    const aa = c.substring(2, 4);
    const mm = c.substring(4, 6);
    const cnpj = c.substring(6, 20);
    const nrNota = String(parseInt(c.substring(25, 34), 10) || "-");
    return {
      nr_nota: nrNota,
      dt_emissao: `${mm}/20${aa}`,
      cnpj_parceiro: formatCPFCNPJ(cnpj),
    };
  };

  const loadData = useCallback(async () => {
    if (!nfeCabecalhoId) {
      setXItens([]);
      return;
    }
    setXLoading(true);
    try {
      const { data: refs, error } = await db
        .from("fiscal_nfe_referenciada")
        .select("*")
        .eq("nfe_cabecalho_id", nfeCabecalhoId)
        .order("nfe_referenciada_id");

      if (error) throw error;

      const chaves = (refs || []).map((r: any) => r.chave_ref).filter(Boolean);
      let nfeMap: Record<string, any> = {};

      if (chaves.length > 0) {
        const { data: nfeOrigens } = await db
          .from("fiscal_nfe_cabecalho")
          .select("chave_nfe, nr_nota, dt_emissao, cadastro:cadastro_id(razao_social, cnpj)")
          .in("chave_nfe", chaves);

        if (nfeOrigens) {
          nfeOrigens.forEach((o: any) => {
            if (o.chave_nfe) nfeMap[o.chave_nfe] = o;
          });
        }
      }

      const list: IReferenciadaItem[] = (refs || []).map((r: any) => {
        const infoExtraida = extrairInfoChave(r.chave_ref);
        const o = nfeMap[r.chave_ref];
        return {
          nfe_referenciada_id: r.nfe_referenciada_id,
          nfe_cabecalho_id: r.nfe_cabecalho_id,
          chave_ref: r.chave_ref,
          created_at: r.created_at,
          nr_nota: o?.nr_nota ? String(o.nr_nota) : infoExtraida.nr_nota,
          nm_parceiro: o?.cadastro?.razao_social || "NÃO IDENTIFICADO",
          cnpj_parceiro: o?.cadastro?.cnpj ? formatCPFCNPJ(o.cadastro.cnpj) : infoExtraida.cnpj_parceiro,
          dt_emissao: o?.dt_emissao
            ? new Date(o.dt_emissao).toLocaleDateString("pt-BR")
            : infoExtraida.dt_emissao,
        };
      });

      setXItens(list);
    } catch (e: any) {
      toast.error("Erro ao carregar documentos referenciados: " + e.message);
    } finally {
      setXLoading(false);
    }
  }, [nfeCabecalhoId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdicionarChave = async () => {
    if (!nfeCabecalhoId) {
      toast.error("Salve a NF-e antes de adicionar documentos referenciados.");
      return;
    }
    const limpa = XNovaChave.replace(/\D/g, "");
    if (limpa.length !== 44) {
      toast.error(`A chave de acesso deve conter exatamente 44 dígitos numéricos (informado: ${limpa.length} dígitos).`);
      return;
    }
    if (XItens.some(it => it.chave_ref === limpa)) {
      toast.error("Esta chave de acesso já está referenciada nesta nota.");
      return;
    }

    setXSalvando(true);
    try {
      const { error } = await db.from("fiscal_nfe_referenciada").insert({
        nfe_cabecalho_id: nfeCabecalhoId,
        chave_ref: limpa,
      });
      if (error) throw error;

      toast.success("Chave referenciada adicionada com sucesso!");
      setXNovaChave("");
      await loadData();
    } catch (e: any) {
      toast.error("Erro ao adicionar chave: " + e.message);
    } finally {
      setXSalvando(false);
    }
  };

  const handleIniciarEdicao = (item: IReferenciadaItem) => {
    setXEditandoId(item.nfe_referenciada_id);
    setXChaveEdicao(item.chave_ref);
  };

  const handleCancelarEdicao = () => {
    setXEditandoId(null);
    setXChaveEdicao("");
  };

  const handleSalvarEdicao = async (id: number) => {
    const limpa = XChaveEdicao.replace(/\D/g, "");
    if (limpa.length !== 44) {
      toast.error(`A chave de acesso deve conter exatamente 44 dígitos numéricos (informado: ${limpa.length} dígitos).`);
      return;
    }

    if (XItens.some(it => it.nfe_referenciada_id !== id && it.chave_ref === limpa)) {
      toast.error("Esta chave de acesso já está cadastrada nesta nota.");
      return;
    }

    setXSalvando(true);
    try {
      const { error } = await db
        .from("fiscal_nfe_referenciada")
        .update({ chave_ref: limpa })
        .eq("nfe_referenciada_id", id);

      if (error) throw error;

      toast.success("Chave referenciada atualizada com sucesso!");
      setXEditandoId(null);
      setXChaveEdicao("");
      await loadData();
    } catch (e: any) {
      toast.error("Erro ao atualizar chave referenciada: " + e.message);
    } finally {
      setXSalvando(false);
    }
  };

  const handleRemoverChave = async (id: number) => {
    if (!confirm("Deseja realmente remover esta chave referenciada?")) return;
    try {
      const { error } = await db
        .from("fiscal_nfe_referenciada")
        .delete()
        .eq("nfe_referenciada_id", id);
      if (error) throw error;

      toast.success("Referência removida.");
      await loadData();
    } catch (e: any) {
      toast.error("Erro ao remover referência: " + e.message);
    }
  };

  const novaLimpaLen = XNovaChave.replace(/\D/g, "").length;

  return (
    <div className="space-y-4">
      {/* Banner Informativo Exigência Fiscal */}
      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
        <Key className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wide">
            Documentos Fiscais Referenciados (Exigido para NF-e de Devolução — Finalidade 4)
          </p>
          <p className="text-amber-800/80 dark:text-amber-300/80">
            A SEFAZ exige que toda NF-e de Devolução contenha ao menos uma chave de acesso referenciada (44 dígitos). As chaves cadastradas nesta aba serão enviadas no grupo <span className="font-mono font-bold">&lt;NFref&gt;</span> ao fiscal-worker.
          </p>
        </div>
      </div>

      {/* Formulário de Inclusão de Chave */}
      {podeEditar && (
        <div className="p-4 bg-card border border-border rounded-lg shadow-sm flex flex-col md:flex-row items-end gap-3">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-muted-foreground uppercase block">
                Chave de Acesso da NF-e Referenciada (44 dígitos)
              </label>
              <span className={`text-[11px] font-mono font-bold ${
                novaLimpaLen === 44
                  ? "text-emerald-600 dark:text-emerald-400"
                  : novaLimpaLen > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground"
              }`}>
                {novaLimpaLen} / 44 dígitos {novaLimpaLen === 44 && "✓"}
              </span>
            </div>
            <input
              type="text"
              maxLength={44}
              value={XNovaChave}
              onChange={e => setXNovaChave(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdicionarChave()}
              placeholder="Ex: 21260836809394000170550010000000841234567890"
              className="w-full border border-border rounded px-3 py-1.5 text-sm font-mono bg-background focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleAdicionarChave}
            disabled={XSalvando || novaLimpaLen !== 44}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> ADICIONAR REFERÊNCIA
          </button>
        </div>
      )}

      {/* Tabela Grid de Documentos Referenciados */}
      <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
        <div className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-muted/60 text-[10px] font-bold uppercase text-muted-foreground border-b">
          <div className="col-span-5">Chave de Acesso (44 Dígitos — Enviada no XML)</div>
          <div className="col-span-2 text-center">Nº Nota (Info)</div>
          <div className="col-span-3">Parceiro / Fornecedor (Info)</div>
          <div className="col-span-1 text-center">Emissão (Info)</div>
          <div className="col-span-1 text-center">Ações</div>
        </div>

        <div className="divide-y divide-border min-h-[120px] max-h-[360px] overflow-y-auto">
          {XLoading && (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Carregando documentos referenciados...
            </div>
          )}

          {!XLoading && XItens.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground italic">
              Nenhum documento fiscal referenciado cadastrado para esta NF-e.
            </div>
          )}

          {!XLoading &&
            XItens.map((it, idx) => {
              const isEditando = XEditandoId === it.nfe_referenciada_id;
              const editLimpaLen = XChaveEdicao.replace(/\D/g, "").length;
              const numDigits = String(it.chave_ref || "").replace(/\D/g, "").length;
              const isChaveValida = numDigits === 44;

              if (isEditando) {
                return (
                  <div
                    key={it.nfe_referenciada_id}
                    className="grid grid-cols-12 gap-2 px-3 py-2 text-xs items-center bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-amber-500"
                  >
                    <div className="col-span-8 flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={44}
                        value={XChaveEdicao}
                        onChange={e => setXChaveEdicao(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleSalvarEdicao(it.nfe_referenciada_id);
                          if (e.key === "Escape") handleCancelarEdicao();
                        }}
                        autoFocus
                        className="flex-1 font-mono text-xs px-2 py-1 border border-amber-400 rounded bg-background focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${
                        editLimpaLen === 44 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                      }`}>
                        {editLimpaLen}/44 dígs {editLimpaLen === 44 && "✓"}
                      </span>
                    </div>

                    <div className="col-span-4 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSalvarEdicao(it.nfe_referenciada_id)}
                        disabled={XSalvando || editLimpaLen !== 44}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50 transition-colors shadow-sm"
                        title="Salvar alterações"
                      >
                        <Check className="w-3.5 h-3.5" /> SALVAR
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelarEdicao}
                        disabled={XSalvando}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
                        title="Cancelar edição"
                      >
                        <X className="w-3.5 h-3.5" /> CANCELAR
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={it.nfe_referenciada_id}
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-primary/5 transition-colors ${
                    idx % 2 ? "bg-muted/20" : ""
                  }`}
                >
                  <div className={`col-span-5 font-mono text-[11px] font-bold ${isChaveValida ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-400"} truncate flex items-center gap-1.5`}>
                    {isChaveValida ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" title={`Chave inválida (${numDigits} dígitos, exige 44)`} />
                    )}
                    {it.chave_ref}
                    {!isChaveValida && (
                      <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.5 rounded font-sans font-bold">
                        {numDigits} dígitos (inválida)
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 text-center font-bold">
                    {it.nr_nota !== "-" ? `#${it.nr_nota}` : "-"}
                  </div>
                  <div className="col-span-3 truncate font-medium">
                    {it.nm_parceiro}
                    {it.cnpj_parceiro && (
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        {it.cnpj_parceiro}
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-center font-mono text-[11px] text-muted-foreground">
                    {it.dt_emissao}
                  </div>
                  <div className="col-span-1 text-center flex items-center justify-center gap-1">
                    {podeEditar && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicao(it)}
                          className="p-1 text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Editar chave referenciada"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoverChave(it.nfe_referenciada_id)}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                          title="Remover chave referenciada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default NfeDocumentosReferenciadosTab;
