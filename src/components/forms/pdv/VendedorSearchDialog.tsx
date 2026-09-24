import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2 } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

export interface IVendedorRow {
  cadastro_id: number;
  cd_cadastro?: number | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cargo_nome?: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (v: IVendedorRow) => void;
  empresaId: number;
}

type CampoKey = "codigo" | "nome" | "cargo";

const COL_WIDTHS: Record<CampoKey, string> = {
  codigo: "100px",
  nome: "2fr",
  cargo: "1fr",
};

const CAMPOS_DISPONIVEIS: { key: CampoKey; label: string; obrigatorio?: boolean }[] = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome do Vendedor", obrigatorio: true },
  { key: "cargo", label: "Cargo" },
];

const CAMPOS_DEFAULT: CampoKey[] = ["codigo", "nome", "cargo"];

const parseCampos = (raw: unknown): CampoKey[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) return arr as CampoKey[];
  } catch { /* ignore */ }
  return CAMPOS_DEFAULT;
};

const VendedorSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IVendedorRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XCampos, setXCampos] = useState<CampoKey[]>(CAMPOS_DEFAULT);
  const [XCfgOpen, setXCfgOpen] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const gridTemplateColumns = XCampos.map(k => COL_WIDTHS[k] || "1fr").join(" ");

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await db.from("empresa")
        .select("pdv_pesquisa_campos_vendedor")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (data?.pdv_pesquisa_campos_vendedor) {
        setXCampos(parseCampos(data.pdv_pesquisa_campos_vendedor));
      }
    })();
  }, [open, empresaId]);

  const salvarCampos = async (novos: CampoKey[]) => {
    setXCampos(novos);
    if (!empresaId) return;
    await db.from("empresa")
      .update({ pdv_pesquisa_campos_vendedor: JSON.stringify(novos) })
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
    const t = termo.trim();

    // 1. Tenta buscar funcionários com vendedor = 'S' ou 's'
    let q = db.from("funcionario")
      .select("funcionario_id, cd_funcionario, nome, cargo_id, vendedor, empresa_id")
      .or("vendedor.eq.S,vendedor.eq.s")
      .order("nome")
      .limit(100);

    if (empresaId) {
      q = q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }

    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`cd_funcionario.eq.${t},funcionario_id.eq.${t}`);
      } else {
        q = q.ilike("nome", `%${t}%`);
      }
    }

    let { data, error } = await q;

    // 2. Se não retornou nenhum registro marcado com vendedor='S', busca todos os funcionários ativos da empresa
    if (!error && (!data || data.length === 0)) {
      let qFallback = db.from("funcionario")
        .select("funcionario_id, cd_funcionario, nome, cargo_id, vendedor, empresa_id")
        .order("nome")
        .limit(100);

      if (empresaId) {
        qFallback = qFallback.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
      }

      if (t) {
        if (/^\d+$/.test(t)) {
          qFallback = qFallback.or(`cd_funcionario.eq.${t},funcionario_id.eq.${t}`);
        } else {
          qFallback = qFallback.ilike("nome", `%${t}%`);
        }
      }

      const resFallback = await qFallback;
      if (!resFallback.error && resFallback.data) {
        data = resFallback.data;
      }
    }

    setXLoading(false);
    if (error) {
      console.error("[VendedorSearchDialog] Erro ao buscar vendedores:", error);
      toast.error("Erro ao buscar vendedores: " + error.message);
      return;
    }

    // Carrega cargos para mapear os nomes dos cargos
    const cargoIds = Array.from(new Set((data || []).map((f: any) => f.cargo_id).filter(Boolean)));
    let cargoMap: Record<number, string> = {};
    if (cargoIds.length > 0) {
      const { data: cargos } = await db.from("cargo")
        .select("cargo_id, cargo_descricao")
        .in("cargo_id", cargoIds);
      if (cargos) {
        for (const c of cargos) {
          cargoMap[c.cargo_id] = c.cargo_descricao;
        }
      }
    }

    const mapped = (data || []).map((f: any) => ({
      cadastro_id: f.funcionario_id,
      cd_cadastro: f.cd_funcionario ?? f.funcionario_id,
      razao_social: f.nome,
      nome_fantasia: f.nome,
      cargo_nome: (f.cargo_id && cargoMap[f.cargo_id]) ? cargoMap[f.cargo_id] : "Vendedor",
    }));

    setXRows(mapped);
    setXSelectedIdx(null);
  }, [empresaId]);

  const focusInput = useCallback(() => {
    const el = (inputRef.current || document.getElementById("vendedor-search-input")) as HTMLInputElement | null;
    if (el) {
      el.focus();
      try { el.select(); } catch {}
    }
  }, []);

  useEffect(() => {
    if (open) {
      setXTermo("");
      buscar("");
      setXSelectedIdx(null);
      const timers = [10, 50, 100, 200, 350].map((ms) => setTimeout(focusInput, ms));
      return () => timers.forEach(clearTimeout);
    }
  }, [open, buscar, focusInput]);

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl" onOpenAutoFocus={(e) => {
        e.preventDefault();
        focusInput();
        setTimeout(focusInput, 50);
      }}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle>Pesquisar Vendedor</DialogTitle>
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
              id="vendedor-search-input"
              ref={inputRef}
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite código ou nome do vendedor..."
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
                  Nenhum vendedor encontrado.
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
                      if (k === "nome") {
                        return <div key={k} className="text-foreground font-medium break-words">{r.nome_fantasia || r.razao_social || ""}</div>;
                      }
                      if (k === "cargo") {
                        return <div key={k} className="text-muted-foreground text-xs truncate" title={r.cargo_nome || ""}>{r.cargo_nome || "Vendedor"}</div>;
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

export default VendedorSearchDialog;
