import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2, Eraser } from "lucide-react";
import { toast } from "sonner";

const db = supabase as any;

export interface IMinutaRow {
  entrega_id: number;
  cd_entrega: number;
  dt_inicio?: string | null;
  dt_fim?: string | null;
  rota?: string | null;
  veiculo_id?: number | null;
  motorista_id?: number | null;
  status?: string | null;
  veiculo_placa?: string | null;
  motorista_nome?: string | null;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (minutaId: number) => Promise<boolean> | boolean;
  empresaId: number;
}

type CampoKey = "codigo" | "emissao" | "rota" | "veiculo" | "motorista" | "status";

const COL_WIDTHS: Record<CampoKey, string> = {
  codigo: "90px",
  emissao: "110px",
  rota: "1.5fr",
  veiculo: "120px",
  motorista: "1.5fr",
  status: "100px"
};

const CAMPOS_DISPONIVEIS: { key: CampoKey; label: string; obrigatorio?: boolean }[] = [
  { key: "codigo", label: "Nº Minuta", obrigatorio: true },
  { key: "emissao", label: "Emissão" },
  { key: "rota", label: "Rota", obrigatorio: true },
  { key: "veiculo", label: "Veículo" },
  { key: "motorista", label: "Motorista" },
  { key: "status", label: "Status" },
];

const CAMPOS_DEFAULT: CampoKey[] = ["codigo", "emissao", "rota", "veiculo", "motorista"];

const parseCampos = (raw: unknown): CampoKey[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) return arr as CampoKey[];
  } catch { /* ignore */ }
  return CAMPOS_DEFAULT;
};

const MinutaSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect, empresaId }) => {
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IMinutaRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XValidating, setXValidating] = useState(false);
  const [XCampos, setXCampos] = useState<CampoKey[]>(CAMPOS_DEFAULT);
  const [XCfgOpen, setXCfgOpen] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtrarBtnRef = useRef<HTMLButtonElement>(null);

  const gridTemplateColumns = XCampos.map(k => COL_WIDTHS[k] || "1fr").join(" ");

  useEffect(() => {
    if (!open || !empresaId) return;
    (async () => {
      const { data } = await db.from("empresa")
        .select("pdv_pesquisa_campos_minuta")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      setXCampos(parseCampos(data?.pdv_pesquisa_campos_minuta));
    })();
  }, [open, empresaId]);

  const salvarCampos = async (novos: CampoKey[]) => {
    setXCampos(novos);
    if (!empresaId) return;
    await db.from("empresa")
      .update({ pdv_pesquisa_campos_minuta: JSON.stringify(novos) })
      .eq("empresa_id", empresaId);
  };

  const toggleCampo = (k: CampoKey) => {
    const def = CAMPOS_DISPONIVEIS.find(c => c.key === k);
    if (def?.obrigatorio) return;
    const novos = XCampos.includes(k) ? XCampos.filter(c => c !== k) : [...XCampos, k];
    salvarCampos(novos);
  };

  const buscar = useCallback(async (termo: string) => {
    if (!empresaId) return;
    const t = termo.trim();
    if (!t) {
      toast.warning("Informe um valor para pesquisar as minutas.");
      setXRows([]);
      setXSelectedIdx(null);
      return;
    }

    setXLoading(true);
    try {
      let q = db
        .from("entrega")
        .select("entrega_id, cd_entrega, dt_inicio, dt_fim, rota, veiculo_id, motorista_id, status, excluido")
        .eq("empresa_id", empresaId)
        .ilike("status", "Conclui%")
        .or("excluido.is.null,excluido.eq.false")
        .order("entrega_id", { ascending: false })
        .limit(100);

      // Buscar IDs de veículos por placa
      let veicIdsMatch: number[] = [];
      const { data: veicMatches } = await db
        .from("cadastro_veiculo")
        .select("veiculo_id")
        .eq("empresa_id", empresaId)
        .ilike("placa", `%${t}%`);
      if (veicMatches && veicMatches.length > 0) {
        veicIdsMatch = veicMatches.map((v: any) => v.veiculo_id);
      }

      // Buscar IDs de motoristas por nome
      let motIdsMatch: number[] = [];
      const { data: motMatches } = await db
        .from("cadastro_motorista")
        .select("motorista_id")
        .eq("empresa_id", empresaId)
        .ilike("nome", `%${t}%`);
      if (motMatches && motMatches.length > 0) {
        motIdsMatch = motMatches.map((m: any) => m.motorista_id);
      }

      const orConditions: string[] = [];
      if (/^\d+$/.test(t)) {
        orConditions.push(`cd_entrega.eq.${t}`);
        orConditions.push(`entrega_id.eq.${t}`);
      }
      orConditions.push(`rota.ilike.%${t}%`);
      if (veicIdsMatch.length > 0) {
        orConditions.push(`veiculo_id.in.(${veicIdsMatch.join(",")})`);
      }
      if (motIdsMatch.length > 0) {
        orConditions.push(`motorista_id.in.(${motIdsMatch.join(",")})`);
      }

      if (orConditions.length > 0) {
        q = q.or(orConditions.join(","));
      }

      const { data: entregaData, error } = await q;

      if (error || !entregaData || entregaData.length === 0) {
        setXLoading(false);
        setXRows([]);
        setXSelectedIdx(null);
        return;
      }

      // Buscar placas dos veículos retornados
      const veicIds = Array.from(new Set(entregaData.map((e: any) => e.veiculo_id).filter(Boolean)));
      let veicMap = new Map<number, string>();
      if (veicIds.length > 0) {
        const { data: veicRes } = await db
          .from("cadastro_veiculo")
          .select("veiculo_id, placa")
          .in("veiculo_id", veicIds);
        if (veicRes) {
          veicRes.forEach((v: any) => veicMap.set(v.veiculo_id, v.placa));
        }
      }

      // Buscar nomes dos motoristas retornados
      const motIds = Array.from(new Set(entregaData.map((e: any) => e.motorista_id).filter(Boolean)));
      let motMap = new Map<number, string>();
      if (motIds.length > 0) {
        const { data: motRes } = await db
          .from("cadastro_motorista")
          .select("motorista_id, nome")
          .in("motorista_id", motIds);
        if (motRes) {
          motRes.forEach((m: any) => motMap.set(m.motorista_id, m.nome));
        }
      }

      const mapped: IMinutaRow[] = entregaData.map((e: any) => ({
        entrega_id: e.entrega_id,
        cd_entrega: e.cd_entrega || e.entrega_id,
        dt_inicio: e.dt_inicio || e.created_at,
        dt_fim: e.dt_fim,
        rota: e.rota || "Sem rota",
        veiculo_id: e.veiculo_id,
        motorista_id: e.motorista_id,
        status: e.status || "Ativa",
        veiculo_placa: e.veiculo_id ? veicMap.get(e.veiculo_id) || `Veíc #${e.veiculo_id}` : "-",
        motorista_nome: e.motorista_id ? motMap.get(e.motorista_id) || `Mot #${e.motorista_id}` : "-",
      }));

      setXRows(mapped);
      setXSelectedIdx(null);
    } catch {
      setXRows([]);
    } finally {
      setXLoading(false);
    }
  }, [empresaId]);

  const focusInput = useCallback(() => {
    const el = (inputRef.current || document.getElementById("minuta-search-input")) as HTMLInputElement | null;
    if (el) {
      el.focus();
      try { el.select(); } catch {}
    }
  }, []);

  useEffect(() => {
    if (open) {
      setXTermo("");
      setXRows([]);
      setXSelectedIdx(null);
      const timers = [10, 50, 100, 200, 350].map((ms) => setTimeout(focusInput, ms));
      return () => timers.forEach(clearTimeout);
    }
  }, [open, focusInput]);

  const focusRow = (idx: number) => {
    setXSelectedIdx(idx);
    setTimeout(() => {
      const el = listRef.current?.querySelector(`[data-index="${idx}"]`) as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: "nearest" });
        try { el.focus(); } catch {}
      }
    }, 10);
  };

  const handleConfirmRow = async (entregaId: number) => {
    if (XValidating) return;
    setXValidating(true);
    try {
      onClose();
      await onSelect(entregaId);
    } catch {
      focusInput();
    } finally {
      setXValidating(false);
    }
  };

  // Teclado para navegação na grid e confirmação com Enter
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isInputTarget = e.target === inputRef.current;
    const isFiltrarBtnTarget = e.target === filtrarBtnRef.current;

    if (e.key === "ArrowDown") {
      if (XRows.length === 0) return;
      if (isInputTarget || isFiltrarBtnTarget) {
        e.preventDefault();
        focusRow(0);
        return;
      }
      e.preventDefault();
      const next = XSelectedIdx === null ? 0 : Math.min(XSelectedIdx + 1, XRows.length - 1);
      focusRow(next);
    } else if (e.key === "ArrowUp") {
      if (XRows.length === 0) return;
      if (isInputTarget || isFiltrarBtnTarget) return;
      e.preventDefault();
      if (XSelectedIdx === 0 || XSelectedIdx === null) {
        setXSelectedIdx(null);
        inputRef.current?.focus();
      } else {
        const next = Math.max(XSelectedIdx - 1, 0);
        focusRow(next);
      }
    } else if (e.key === "Enter") {
      if (isInputTarget) {
        e.preventDefault();
        e.stopPropagation();
        filtrarBtnRef.current?.focus();
        return;
      }
      if (isFiltrarBtnTarget) {
        return;
      }
      if (XSelectedIdx !== null && XRows[XSelectedIdx]) {
        e.preventDefault();
        handleConfirmRow(XRows[XSelectedIdx].entrega_id);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      filtrarBtnRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      if (XRows.length > 0) {
        e.preventDefault();
        focusRow(0);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl"
        onKeyDown={handleDialogKeyDown}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          focusInput();
          setTimeout(focusInput, 50);
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle>Pesquisar Minuta de Carga</DialogTitle>
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
          {/* Barra de Filtro com Botões Filtrar e Limpar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                id="minuta-search-input"
                ref={inputRef}
                autoFocus
                value={XTermo}
                onChange={e => setXTermo(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Digite número da minuta, rota, placa do veículo ou motorista..."
                className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
              />
              {XTermo && (
                <button
                  type="button"
                  onClick={() => setXTermo("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            <button
              ref={filtrarBtnRef}
              type="button"
              onClick={() => buscar(XTermo)}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:outline-hidden transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" /> Filtrar
            </button>

            <button
              type="button"
              onClick={() => {
                setXTermo("");
                setXRows([]);
                setXSelectedIdx(null);
                focusInput();
              }}
              className="px-3 py-2 bg-muted text-muted-foreground hover:text-foreground text-xs font-semibold rounded hover:bg-accent transition-colors flex items-center gap-1.5 border border-border"
            >
              <Eraser className="w-3.5 h-3.5" /> Limpar
            </button>
          </div>

          {/* Grid de Resultados */}
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

              {(XLoading || XValidating) && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  {XValidating ? "Validando minuta..." : "Carregando minutas..."}
                </div>
              )}
              {!XLoading && XRows.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                  {XTermo ? "Nenhuma minuta encontrada com os filtros informados." : "Clique em Filtrar para pesquisar as minutas."}
                </div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const sel = XSelectedIdx === idx;
                const zebra = idx % 2 === 1 ? "bg-muted/10" : "";
                return (
                  <button
                    key={r.entrega_id}
                    data-index={idx}
                    tabIndex={0}
                    onFocus={() => setXSelectedIdx(idx)}
                    onDoubleClick={() => handleConfirmRow(r.entrega_id)}
                    onClick={() => handleConfirmRow(r.entrega_id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.stopPropagation();
                        handleConfirmRow(r.entrega_id);
                      }
                    }}
                    className={`w-full grid gap-3 px-3 py-2.5 text-sm text-left border-b border-border/60 shrink-0 break-words items-center transition-colors focus:ring-2 focus:ring-primary focus:outline-hidden ${
                      sel ? "bg-primary/20 font-medium ring-2 ring-primary/40" : `${zebra} hover:bg-accent/50`
                    }`}
                    style={{ gridTemplateColumns }}
                  >
                    {XCampos.map(k => {
                      if (k === "codigo") {
                        return <div key={k} className="font-mono text-foreground font-bold text-left">{r.cd_entrega}</div>;
                      }
                      if (k === "emissao") {
                        return <div key={k} className="font-mono text-muted-foreground text-xs">{r.dt_inicio ? new Date(r.dt_inicio).toLocaleDateString("pt-BR") : "-"}</div>;
                      }
                      if (k === "rota") {
                        return <div key={k} className="text-foreground break-words">{r.rota || ""}</div>;
                      }
                      if (k === "veiculo") {
                        return <div key={k} className="text-muted-foreground break-words">{r.veiculo_placa || "-"}</div>;
                      }
                      if (k === "motorista") {
                        return <div key={k} className="text-muted-foreground text-xs truncate" title={r.motorista_nome || ""}>{r.motorista_nome || "-"}</div>;
                      }
                      if (k === "status") {
                        return <div key={k} className="text-muted-foreground text-xs font-semibold">{r.status || "Ativa"}</div>;
                      }
                      return <div key={k}></div>;
                    })}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Utilize as setas Cima/Baixo para navegar e Enter para selecionar. Resultados limitados a 100.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MinutaSearchDialog;
