import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Key, Calendar, User, FileText, CheckCircle2 } from "lucide-react";
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
      toast.error("A chave de acesso deve conter exatamente 44 dígitos numéricos.");
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
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1 block">
              Chave de Acesso da NF-e Referenciada (44 dígitos)
            </label>
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
            disabled={XSalvando || !XNovaChave.trim()}
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
            XItens.map((it, idx) => (
              <div
                key={it.nfe_referenciada_id}
                className={`grid grid-cols-12 gap-2 px-3 py-2.5 text-xs items-center hover:bg-primary/5 transition-colors ${
                  idx % 2 ? "bg-muted/20" : ""
                }`}
              >
                <div className="col-span-5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 truncate flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {it.chave_ref}
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
                <div className="col-span-1 text-center">
                  {podeEditar && (
                    <button
                      type="button"
                      onClick={() => handleRemoverChave(it.nfe_referenciada_id)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Remover chave referenciada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default NfeDocumentosReferenciadosTab;
