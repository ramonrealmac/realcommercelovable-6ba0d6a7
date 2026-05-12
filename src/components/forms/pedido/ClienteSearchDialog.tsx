import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2 } from "lucide-react";

const db = supabase as any;

export interface IClienteRow {
  cadastro_id: number;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  fone_geral?: string | null;
  email?: string | null;
  endereco_cidade_id?: number | null;
  endereco_bairro?: string | null;
  endereco_logradouro?: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cliente: IClienteRow) => void;
  empresaId: number;
}

type CampoKey = "codigo" | "cnpj" | "razao_social" | "fantasia" | "telefone" | "email" | "endereco" | "bairro";

const CAMPOS_DISPONIVEIS: { key: CampoKey; label: string; obrigatorio?: boolean }[] = [
  { key: "codigo", label: "Código" },
  { key: "cnpj", label: "CPF/CNPJ" },
  { key: "razao_social", label: "Razão social", obrigatorio: true },
  { key: "fantasia", label: "Nome fantasia" },
  { key: "telefone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "endereco", label: "Endereço" },
  { key: "bairro", label: "Bairro" },
];

const CAMPOS_DEFAULT: CampoKey[] = ["codigo", "cnpj", "razao_social", "fantasia"];

const parseCampos = (raw: any): CampoKey[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) return arr as CampoKey[];
  } catch { /* ignore */ }
  return CAMPOS_DEFAULT;
};

const ClienteSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IClienteRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XCampos, setXCampos] = useState<CampoKey[]>(CAMPOS_DEFAULT);
  const [XCfgOpen, setXCfgOpen] = useState(false);

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await db.from("empresa")
        .select("pdv_pesquisa_campos_cliente")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      setXCampos(parseCampos(data?.pdv_pesquisa_campos_cliente));
    })();
  }, [open, empresaId]);

  const salvarCampos = async (novos: CampoKey[]) => {
    setXCampos(novos);
    if (!empresaId) return;
    await db.from("empresa")
      .update({ pdv_pesquisa_campos_cliente: JSON.stringify(novos) })
      .eq("empresa_id", empresaId);
  };

  const toggleCampo = (k: CampoKey) => {
    const def = CAMPOS_DISPONIVEIS.find(c => c.key === k);
    if (def?.obrigatorio) return;
    const novos = XCampos.includes(k) ? XCampos.filter(c => c !== k) : [...XCampos, k];
    salvarCampos(novos);
  };

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    let q = db.from("cadastro")
      .select("cadastro_id, cnpj, razao_social, nome_fantasia, fone_geral, email, endereco_cidade_id, endereco_bairro, endereco_logradouro")
      .eq("excluido", false)
      .eq("st_cliente", "S")
      .eq("empresa_id", empresaId)
      .order("razao_social")
      .limit(100);
    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`cadastro_id.eq.${t},cnpj.ilike.%${t}%`);
      } else {
        q = q.or(`razao_social.ilike.%${t}%,nome_fantasia.ilike.%${t}%,cnpj.ilike.%${t}%`);
      }
    }
    const { data, error } = await q;
    setXLoading(false);
    if (!error) setXRows((data || []) as IClienteRow[]);
  }, [empresaId]);

  useEffect(() => {
    if (open) { setXTermo(""); buscar(""); }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  const renderChips = (r: IClienteRow) => {
    const sep = <span className="text-muted-foreground/40 select-none">·</span>;
    const chips: React.ReactNode[] = [];
    const push = (key: CampoKey, node: React.ReactNode) => {
      if (!XCampos.includes(key) || node == null) return;
      if (chips.length > 0) chips.push(<React.Fragment key={`s-${key}`}>{sep}</React.Fragment>);
      chips.push(<span key={key}>{node}</span>);
    };

    push("codigo", <span className="font-mono text-blue-600 dark:text-blue-400">#{r.cadastro_id}</span>);
    push("cnpj", r.cnpj ? <span className="font-mono text-muted-foreground">{r.cnpj}</span> : null);
    push("razao_social", <span className="text-blue-800 dark:text-blue-300 font-medium break-words">{r.razao_social || ""}</span>);
    push("fantasia", r.nome_fantasia ? <span className="text-foreground">{r.nome_fantasia}</span> : null);
    push("telefone", r.fone_geral ? <span className="font-mono text-emerald-700 dark:text-emerald-400">📞 {r.fone_geral}</span> : null);
    push("email", r.email ? <span className="text-muted-foreground">{r.email}</span> : null);
    push("endereco", r.endereco_logradouro ? <span className="text-muted-foreground">{r.endereco_logradouro}</span> : null);
    push("bairro", r.endereco_bairro ? <span className="text-muted-foreground">{r.endereco_bairro}</span> : null);

    return chips;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle>Pesquisar Cliente</DialogTitle>
            <Popover open={XCfgOpen} onOpenChange={setXCfgOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Configurar campos exibidos"
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent"
                >
                  <Settings2 className="w-3.5 h-3.5" /> Campos
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-60 p-2" align="end">
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-1">
                  Campos exibidos
                </div>
                <div className="space-y-1">
                  {CAMPOS_DISPONIVEIS.map(c => (
                    <label
                      key={c.key}
                      className={`flex items-center gap-2 px-2 py-1 rounded text-sm cursor-pointer hover:bg-accent ${c.obrigatorio ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={XCampos.includes(c.key)}
                        disabled={c.obrigatorio}
                        onChange={() => toggleCampo(c.key)}
                      />
                      {c.label}
                      {c.obrigatorio && <span className="text-[10px] text-muted-foreground ml-auto">obrig.</span>}
                    </label>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 px-1">
                  Salvo automaticamente na empresa.
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              placeholder="Digite código, CPF/CNPJ, razão social ou fantasia..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="border border-border rounded overflow-hidden">
            <div className="max-h-[460px] overflow-y-auto">
              {XLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
              {!XLoading && XRows.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const zebra = idx % 2 === 1 ? "bg-muted/30" : "";
                return (
                  <button
                    key={r.cadastro_id}
                    onDoubleClick={() => { onSelect(r); onClose(); }}
                    onClick={() => { onSelect(r); onClose(); }}
                    className={`w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm text-left border-t border-border break-words hover:bg-accent/50 ${zebra}`}
                  >
                    {renderChips(r)}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Clique para selecionar. Resultados limitados a 100.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteSearchDialog;
