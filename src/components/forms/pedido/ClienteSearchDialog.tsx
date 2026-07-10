import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2 } from "lucide-react";

// Usando cliente supabase tipado diretamente

const COL_WIDTHS: Record<CampoKey, string> = {
  codigo: "80px",
  cnpj: "140px",
  razao_social: "1.5fr",
  fantasia: "1fr",
  telefone: "120px",
  email: "1.2fr",
  endereco: "1.5fr",
  bairro: "1fr"
};

const fmtCnpjCpf = (v: string | null | undefined): string => {
  if (!v) return "";
  const clean = v.replace(/\D/g, "");
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return v;
};

export interface IClienteRow {
  cadastro_id: number;
  cd_cadastro?: number | null;
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

const parseCampos = (raw: unknown): CampoKey[] => {
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
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const gridTemplateColumns = XCampos.map(k => COL_WIDTHS[k] || "1fr").join(" ");

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await supabase.from("empresa")
        .select("pdv_pesquisa_campos_cliente")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      setXCampos(parseCampos(data?.pdv_pesquisa_campos_cliente));
    })();
  }, [open, empresaId]);

  const salvarCampos = async (novos: CampoKey[]) => {
    setXCampos(novos);
    if (!empresaId) return;
    await supabase.from("empresa")
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
    let q = supabase.from("cadastro")
      .select("cadastro_id, cd_cadastro, cnpj, razao_social, nome_fantasia, fone_geral, email, endereco_cidade_id, endereco_bairro, endereco_logradouro")
      .eq("excluido", false)
      .eq("st_cliente", "S")
      .eq("empresa_id", empresaId)
      .order("razao_social")
      .limit(100);
    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`cd_cadastro.eq.${t},cnpj.ilike.%${t}%`);
      } else {
        q = q.or(`razao_social.ilike.%${t}%,nome_fantasia.ilike.%${t}%,cnpj.ilike.%${t}%`);
      }
    }
    const { data, error } = await q;
    setXLoading(false);
    if (!error) {
      setXRows((data || []) as IClienteRow[]);
      setXSelectedIdx(null);
    }
  }, [empresaId]);

  useEffect(() => {
    if (open) { setXTermo(""); buscar(""); setXSelectedIdx(null); }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (XRows.length === 0 || XLoading) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setXSelectedIdx(prev => {
        const next = prev === null ? 0 : Math.min(prev + 1, XRows.length - 1);
        setTimeout(() => {
          const el = listRef.current?.querySelector(`[data-index="${next}"]`) as HTMLElement;
          el?.scrollIntoView({ block: "nearest" });
        }, 10);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setXSelectedIdx(prev => {
        const next = prev === null ? 0 : Math.max(prev - 1, 0);
        setTimeout(() => {
          const el = listRef.current?.querySelector(`[data-index="${next}"]`) as HTMLElement;
          el?.scrollIntoView({ block: "nearest" });
        }, 10);
        return next;
      });
    } else if (e.key === "Enter") {
      const selected = XSelectedIdx !== null ? XSelectedIdx : 0;
      if (XRows[selected]) {
        e.preventDefault();
        onSelect(XRows[selected]);
        onClose();
      }
    }
  };

  // Layout ajustado para colunas alinhadas em grid em vez de chips flexbox

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
              onKeyDown={handleKeyDown}
              placeholder="Digite código, CPF/CNPJ, razão social ou fantasia..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          <div className="border border-border rounded overflow-hidden bg-card">
            <div ref={listRef} className="h-[460px] overflow-y-auto flex flex-col">
              {/* Header da Tabela/Grid */}
              {!XLoading && XRows.length > 0 && (
                <div 
                  className="grid gap-3 px-3 py-2 text-xs font-semibold text-muted-foreground bg-muted/40 border-b border-border sticky top-0 bg-card z-10 shrink-0 select-none"
                  style={{ gridTemplateColumns }}
                >
                  {XCampos.map(k => {
                    const def = CAMPOS_DISPONIVEIS.find(c => c.key === k);
                    return <div key={k}>{def?.label ?? k}</div>;
                  })}
                </div>
              )}

              {XLoading && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  Carregando...
                </div>
              )}
              {!XLoading && XRows.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  Nenhum cliente encontrado.
                </div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const sel = XSelectedIdx === idx;
                const zebra = idx % 2 === 1 ? "bg-muted/10" : "";
                return (
                  <button
                    key={r.cadastro_id}
                    data-index={idx}
                    onDoubleClick={() => { onSelect(r); onClose(); }}
                    onClick={() => { onSelect(r); onClose(); }}
                    className={`w-full grid gap-3 px-3 py-2.5 text-sm text-left border-b border-border/60 shrink-0 break-words items-center transition-colors ${
                      sel ? "bg-primary/15 font-medium" : `${zebra} hover:bg-accent/50`
                    }`}
                    style={{ gridTemplateColumns }}
                  >
                    {XCampos.map(k => {
                      if (k === "codigo") {
                        return <div key={k} className="font-mono text-foreground text-left">{r.cd_cadastro ?? r.cadastro_id}</div>;
                      }
                      if (k === "cnpj") {
                        return <div key={k} className="font-mono text-muted-foreground text-xs">{fmtCnpjCpf(r.cnpj)}</div>;
                      }
                      if (k === "razao_social") {
                        return <div key={k} className="text-foreground break-words">{r.razao_social || ""}</div>;
                      }
                      if (k === "fantasia") {
                        return <div key={k} className="text-muted-foreground break-words">{r.nome_fantasia || ""}</div>;
                      }
                      if (k === "telefone") {
                        return <div key={k} className="font-mono text-muted-foreground text-xs">{r.fone_geral || ""}</div>;
                      }
                      if (k === "email") {
                        return <div key={k} className="text-muted-foreground text-xs truncate" title={r.email || ""}>{r.email || ""}</div>;
                      }
                      if (k === "endereco") {
                        return <div key={k} className="text-muted-foreground text-xs truncate" title={r.endereco_logradouro || ""}>{r.endereco_logradouro || ""}</div>;
                      }
                      if (k === "bairro") {
                        return <div key={k} className="text-muted-foreground text-xs truncate" title={r.endereco_bairro || ""}>{r.endereco_bairro || ""}</div>;
                      }
                      return <div key={k}></div>;
                    })}
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
