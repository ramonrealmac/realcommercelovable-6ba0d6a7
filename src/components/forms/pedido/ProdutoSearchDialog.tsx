import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2 } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

const db = supabase as any;

export interface IProdutoRow {
  produto_id: number;
  nome: string;
  unidade_id: string | null;
  preco_venda: number;
  preco_promocional: number;
  st_promo: boolean;
  estoque_disponivel: number;
  estoque_reservado: number;
  estoque_na_empresa: number;
  referencia?: string;
  gtin?: string;
}

export interface IEstoqueDepositoRow {
  deposito_id: number;
  deposito_nome: string;
  empresa_id: number;
  empresa_nome: string;
  estoque_fisico: number;
  estoque_reservado: number;
  estoque_disponivel: number;
  da_empresa_atual: boolean;
}

interface IProps {
  open: boolean;
  onClose: () => void;
  onSelect: (produto: IProdutoRow, deposito_id?: number) => void;
}

const fmtNum = (v: number, dec = 2) =>
  (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ── Configuração de campos ────────────────────────────────────
type CampoKey = "codigo" | "referencia" | "gtin" | "nome" | "unidade" | "preco" | "preco_promo" | "estoque_disp" | "estoque_emp" | "reservado";

const CAMPOS_DISPONIVEIS: { key: CampoKey; label: string; obrigatorio?: boolean }[] = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome", obrigatorio: true },
  { key: "referencia", label: "Referência" },
  { key: "gtin", label: "GTIN" },
  { key: "unidade", label: "Unidade" },
  { key: "preco", label: "Preço" },
  { key: "preco_promo", label: "Preço promocional" },
  { key: "estoque_disp", label: "Estoque disponível" },
  { key: "estoque_emp", label: "Estoque na empresa" },
  { key: "reservado", label: "Reservado" },
];

const CAMPOS_DEFAULT: CampoKey[] = ["codigo", "nome", "unidade", "preco", "estoque_disp", "reservado"];

const parseCampos = (raw: any): CampoKey[] => {
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length) return arr as CampoKey[];
  } catch { /* ignore */ }
  return CAMPOS_DEFAULT;
};

export async function buscarProdutoPorCodigo(
  termo: string,
  XEmpresaId: number,
  XGroupEmpresaIds: number[]
): Promise<IProdutoRow | null> {
  const t = (termo || "").trim();
  if (!t) return null;
  const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];

  // 1. Tentar encontrar pelo cod_barra na tabela produto_codbarra
  const { data: codBarraData } = await db.from("produto_codbarra")
    .select("produto_id")
    .eq("cod_barra", t)
    .in("empresa_id", ids)
    .eq("excluido", false)
    .limit(1)
    .maybeSingle();

  let q = db.from("produto")
    .select("produto_id, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
    .in("empresa_id", ids).eq("excluido", false).limit(5);
    
  if (codBarraData?.produto_id) {
    q = q.eq("produto_id", codBarraData.produto_id);
  } else if (/^\d+$/.test(t)) {
    q = q.or(`produto_id.eq.${t},referencia.eq.${t},gtin.eq.${t}`);
  } else {
    q = q.or(`referencia.eq.${t},gtin.eq.${t}`);
  }
  
  const { data: prods } = await q;
  if (!prods || prods.length === 0) return null;
  const p: any = prods[0];

  const { data: deps } = await db.from("deposito")
    .select("deposito_id, empresa_id, st_privado")
    .in("empresa_id", ids).eq("excluido", false);
  const visibleDepIds = new Set(
    (deps || [])
      .filter((d: any) => d.empresa_id === XEmpresaId || d.st_privado === false)
      .map((d: any) => d.deposito_id)
  );
  const empresaDoDep: Record<number, number> = {};
  for (const d of (deps || []) as any[]) empresaDoDep[d.deposito_id] = d.empresa_id;

  const { data: ests } = await db.from("estoque")
    .select("produto_id, deposito_id, estoque_disponivel, estoque_reservado")
    .eq("produto_id", p.produto_id).in("empresa_id", ids).eq("excluido", false);
  let disp = 0, res = 0, naEmpresa = 0;
  for (const e of (ests || []) as any[]) {
    if (!visibleDepIds.has(e.deposito_id)) continue;
    const v = Number(e.estoque_disponivel || 0);
    disp += v;
    res += Number(e.estoque_reservado || 0);
    if (empresaDoDep[e.deposito_id] === XEmpresaId) naEmpresa += v;
  }
  const isPromo = String(p.st_promo || "").toUpperCase() === "S";
  return {
    produto_id: p.produto_id,
    nome: p.nome,
    unidade_id: p.unidade_id,
    preco_venda: Number(p.preco_venda || 0),
    preco_promocional: Number(p.preco_promocional || 0),
    st_promo: isPromo,
    estoque_disponivel: disp,
    estoque_reservado: res,
    estoque_na_empresa: naEmpresa,
    referencia: p.referencia,
    gtin: p.gtin,
  };
}

const ProdutoSearchDialog: React.FC<IProps> = ({ open, onClose, onSelect }) => {
  const { XEmpresaId, XEmpresaMatrizId, XEmpresas } = useAppContext();
  const [XTermo, setXTermo] = useState("");
  const [XRows, setXRows] = useState<IProdutoRow[]>([]);
  const [XLoading, setXLoading] = useState(false);
  const [XSoEstoque, setXSoEstoque] = useState(false);
  const [XSoPromo, setXSoPromo] = useState(false);
  const [XSelectedIdx, setXSelectedIdx] = useState<number | null>(null);
  const [XEstDeps, setXEstDeps] = useState<IEstoqueDepositoRow[]>([]);
  const [XLoadingEst, setXLoadingEst] = useState(false);
  const [XCampos, setXCampos] = useState<CampoKey[]>(CAMPOS_DEFAULT);
  const [XCfgOpen, setXCfgOpen] = useState(false);

  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  const empresaNome = useCallback((id: number) => {
    return XEmpresas.find(e => e.empresa_id === id)?.nome_fantasia
      || XEmpresas.find(e => e.empresa_id === id)?.razao_social
      || `Emp ${id}`;
  }, [XEmpresas]);

  // Carrega configuração de campos da empresa
  useEffect(() => {
    if (!open || !XEmpresaId) return;
    (async () => {
      const { data } = await db.from("empresa")
        .select("pdv_pesquisa_campos")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();
      setXCampos(parseCampos(data?.pdv_pesquisa_campos));
    })();
  }, [open, XEmpresaId]);

  const salvarCampos = async (novos: CampoKey[]) => {
    setXCampos(novos);
    if (!XEmpresaId) return;
    await db.from("empresa")
      .update({ pdv_pesquisa_campos: JSON.stringify(novos) })
      .eq("empresa_id", XEmpresaId);
  };

  const toggleCampo = (k: CampoKey) => {
    const def = CAMPOS_DISPONIVEIS.find(c => c.key === k);
    if (def?.obrigatorio) return;
    const novos = XCampos.includes(k) ? XCampos.filter(c => c !== k) : [...XCampos, k];
    salvarCampos(novos);
  };

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];

    let q = db.from("produto")
      .select("produto_id, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
      .in("empresa_id", ids).eq("excluido", false).order("nome").limit(100);

    const t = termo.trim();
    if (t) {
      let codBarraProdIds: number[] = [];
      const { data: cbData } = await db.from("produto_codbarra")
        .select("produto_id")
        .ilike("cod_barra", `%${t}%`)
        .in("empresa_id", ids)
        .eq("excluido", false)
        .limit(20);
      if (cbData) {
        codBarraProdIds = cbData.map((x: any) => x.produto_id);
      }
      
      const cbFilter = codBarraProdIds.length > 0 ? `,produto_id.in.(${codBarraProdIds.join(",")})` : "";
      if (/^\d+$/.test(t)) {
        q = q.or(`produto_id.eq.${t},referencia.ilike.%${t}%,gtin.ilike.%${t}%,nome.ilike.%${t}%${cbFilter}`);
      } else {
        q = q.or(`nome.ilike.%${t}%,referencia.ilike.%${t}%,gtin.ilike.%${t}%${cbFilter}`);
      }
    }
    if (XSoPromo) q = q.eq("st_promo", "S");

    const { data: prods, error } = await q;
    if (error || !prods) { setXLoading(false); setXRows([]); return; }

    const { data: deps } = await db.from("deposito")
      .select("deposito_id, empresa_id, st_privado")
      .in("empresa_id", ids).eq("excluido", false);
    const visibleDepIds = new Set(
      (deps || []).filter((d: any) => d.empresa_id === XEmpresaId || d.st_privado === false)
        .map((d: any) => d.deposito_id)
    );
    const empresaDoDep: Record<number, number> = {};
    for (const d of (deps || []) as any[]) empresaDoDep[d.deposito_id] = d.empresa_id;

    const prodIds = prods.map((p: any) => p.produto_id);
    let estMap: Record<number, { disp: number; res: number; naEmp: number }> = {};
    if (prodIds.length > 0 && visibleDepIds.size > 0) {
      const { data: ests } = await db.from("estoque")
        .select("produto_id, deposito_id, estoque_disponivel, estoque_reservado")
        .in("produto_id", prodIds).in("empresa_id", ids).eq("excluido", false);
      for (const e of (ests || []) as any[]) {
        if (!visibleDepIds.has(e.deposito_id)) continue;
        const cur = estMap[e.produto_id] || { disp: 0, res: 0, naEmp: 0 };
        const v = Number(e.estoque_disponivel || 0);
        cur.disp += v;
        cur.res += Number(e.estoque_reservado || 0);
        if (empresaDoDep[e.deposito_id] === XEmpresaId) cur.naEmp += v;
        estMap[e.produto_id] = cur;
      }
    }

    let rows: IProdutoRow[] = (prods as any[]).map(p => ({
      produto_id: p.produto_id,
      nome: p.nome,
      unidade_id: p.unidade_id,
      preco_venda: Number(p.preco_venda || 0),
      preco_promocional: Number(p.preco_promocional || 0),
      st_promo: String(p.st_promo || "").toUpperCase() === "S",
      estoque_disponivel: estMap[p.produto_id]?.disp || 0,
      estoque_reservado: estMap[p.produto_id]?.res || 0,
      estoque_na_empresa: estMap[p.produto_id]?.naEmp || 0,
      referencia: p.referencia,
      gtin: p.gtin,
    }));
    if (XSoEstoque) rows = rows.filter(r => r.estoque_na_empresa > 0);
    setXRows(rows);
    setXSelectedIdx(null);
    setXEstDeps([]);
    setXLoading(false);
  }, [XEmpresaId, XGroupEmpresaIds, XSoEstoque, XSoPromo]);

  const carregarEstoqueDoProduto = useCallback(async (produto_id: number) => {
    setXLoadingEst(true);
    const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];
    const { data: ests } = await db.from("estoque")
      .select("deposito_id, empresa_id, estoque_fisico, estoque_reservado, estoque_disponivel")
      .eq("produto_id", produto_id).in("empresa_id", ids).eq("excluido", false);

    const depIds = Array.from(new Set((ests || []).map((e: any) => e.deposito_id)));
    let depMap: Record<number, { nome: string; empresa_id: number; st_privado: boolean }> = {};
    if (depIds.length > 0) {
      const { data: deps } = await db.from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado")
        .in("deposito_id", depIds).eq("excluido", false);
      for (const d of (deps || []) as any[]) {
        depMap[d.deposito_id] = { nome: d.nome, empresa_id: d.empresa_id, st_privado: d.st_privado };
      }
    }

    const rows: IEstoqueDepositoRow[] = [];
    for (const e of (ests || []) as any[]) {
      const d = depMap[e.deposito_id];
      if (!d) continue;
      const visivel = d.empresa_id === XEmpresaId || d.st_privado === false;
      if (!visivel) continue;
      rows.push({
        deposito_id: e.deposito_id,
        deposito_nome: d.nome,
        empresa_id: d.empresa_id,
        empresa_nome: empresaNome(d.empresa_id),
        estoque_fisico: Number(e.estoque_fisico || 0),
        estoque_reservado: Number(e.estoque_reservado || 0),
        estoque_disponivel: Number(e.estoque_disponivel || 0),
        da_empresa_atual: d.empresa_id === XEmpresaId,
      });
    }
    rows.sort((a, b) => (a.da_empresa_atual === b.da_empresa_atual ? a.deposito_id - b.deposito_id : a.da_empresa_atual ? -1 : 1));
    setXEstDeps(rows);
    setXLoadingEst(false);
  }, [XEmpresaId, XGroupEmpresaIds, empresaNome]);

  useEffect(() => {
    if (open) {
      setXTermo("");
      setXSelectedIdx(null);
      setXEstDeps([]);
      buscar("");
    }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  const selecionarLinha = (idx: number, r: IProdutoRow) => {
    setXSelectedIdx(idx);
    carregarEstoqueDoProduto(r.produto_id);
  };

  const corEstoqueDep = (r: IEstoqueDepositoRow) => {
    if (r.estoque_disponivel <= 0) return "";
    return r.da_empresa_atual ? "bg-green-100 dark:bg-green-900/30" : "bg-yellow-100 dark:bg-yellow-900/30";
  };

  // ── Renderiza um chip por campo, com cor própria ──
  const renderChips = (r: IProdutoRow) => {
    const sep = <span className="text-muted-foreground/40 select-none">·</span>;
    const chips: React.ReactNode[] = [];

    const push = (key: CampoKey, node: React.ReactNode) => {
      if (!XCampos.includes(key) || node == null) return;
      if (chips.length > 0) chips.push(<React.Fragment key={`s-${key}`}>{sep}</React.Fragment>);
      chips.push(<span key={key}>{node}</span>);
    };

    push("codigo", <span className="font-mono text-blue-600 dark:text-blue-400">#{r.produto_id}</span>);
    push("referencia", r.referencia ? <span className="font-mono text-muted-foreground">Ref: {r.referencia}</span> : null);
    push("gtin", r.gtin ? <span className="font-mono text-muted-foreground">GTIN: {r.gtin}</span> : null);
    push("nome", <span className="text-blue-800 dark:text-blue-300 font-medium break-words">{r.nome}</span>);
    push("unidade", r.unidade_id ? <span className="text-muted-foreground">{r.unidade_id}</span> : null);

    const showPromo = r.st_promo && r.preco_promocional > 0;
    push("preco",
      showPromo
        ? <span className="line-through text-muted-foreground font-mono">R$ {fmtNum(r.preco_venda)}</span>
        : <span className="text-black dark:text-white font-mono">R$ {fmtNum(r.preco_venda)}</span>
    );
    push("preco_promo",
      showPromo
        ? <span className="text-green-600 dark:text-green-400 font-semibold font-mono">R$ {fmtNum(r.preco_promocional)}</span>
        : null
    );

    const corEst = (v: number) =>
      v > 0 ? "text-blue-600 dark:text-blue-400"
        : v < 0 ? "text-red-600 dark:text-red-400 font-semibold"
        : "text-muted-foreground";

    push("estoque_disp",
      <span className={`font-mono ${corEst(r.estoque_disponivel)}`}>Estq: {fmtNum(r.estoque_disponivel, 3)}</span>
    );
    push("estoque_emp",
      <span className={`font-mono ${corEst(r.estoque_na_empresa)}`}>Emp: {fmtNum(r.estoque_na_empresa, 3)}</span>
    );
    push("reservado",
      <span className="font-mono text-amber-600 dark:text-amber-400">Res: {fmtNum(r.estoque_reservado, 3)}</span>
    );

    return chips;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <DialogTitle>Pesquisar Produto</DialogTitle>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={XSoEstoque} onChange={e => setXSoEstoque(e.target.checked)} />
                Com estoque
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={XSoPromo} onChange={e => setXSoPromo(e.target.checked)} />
                Em promoção
              </label>
              <Popover open={XCfgOpen} onOpenChange={setXCfgOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Configurar campos exibidos"
                    className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
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
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              placeholder="Digite código, nome, referência ou GTIN..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Lista em coluna única com chips coloridos */}
          <div className="border border-border rounded overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto">
              {XLoading && <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>}
              {!XLoading && XRows.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</div>
              )}
              {!XLoading && XRows.map((r, idx) => {
                const sel = XSelectedIdx === idx;
                const zebra = idx % 2 === 1 ? "bg-muted/30" : "";
                return (
                  <div
                    key={r.produto_id}
                    onClick={() => selecionarLinha(idx, r)}
                    onDoubleClick={() => { onSelect(r); onClose(); }}
                    className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm border-t border-border cursor-pointer break-words ${
                      sel ? "bg-primary/15" : `${zebra} hover:bg-accent/50`
                    }`}
                  >
                    {renderChips(r)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2ª Grade — estoque por depósito do produto selecionado */}
          <div className="border border-border rounded overflow-hidden">
            <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground border-b border-border">
              Estoque por depósito {XSelectedIdx != null ? `— ${XRows[XSelectedIdx]?.nome}` : ""}
            </div>
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted text-[11px] font-semibold text-muted-foreground">
              <div className="col-span-6">Depósito</div>
              <div className="col-span-2 text-right">Físico</div>
              <div className="col-span-2 text-right">Reserv.</div>
              <div className="col-span-2 text-right">Disponível</div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "126px" }}>
              {XSelectedIdx == null && (
                <div className="p-3 text-center text-[11px] text-muted-foreground">
                  Selecione um produto para ver o estoque por depósito.
                </div>
              )}
              {XLoadingEst && <div className="p-3 text-center text-[11px] text-muted-foreground">Carregando...</div>}
              {!XLoadingEst && XSelectedIdx != null && XEstDeps.length === 0 && (
                <div className="p-3 text-center text-[11px] text-muted-foreground">Sem registros de estoque para este produto.</div>
              )}
              {!XLoadingEst && XEstDeps.map((d, i) => {
                const zebra = i % 2 === 1 ? "bg-muted/30" : "";
                return (
                  <div
                    key={d.deposito_id}
                    onDoubleClick={() => {
                      const p = XRows[XSelectedIdx!];
                      onSelect(p, d.deposito_id);
                      onClose();
                    }}
                    className={`grid grid-cols-12 gap-2 px-3 py-1 text-[11px] border-t border-border cursor-pointer hover:bg-accent/50 ${zebra}`}
                    title="Duplo clique: seleciona produto e depósito"
                  >
                    <div className="col-span-6 truncate">{d.deposito_nome}</div>
                    <div className="col-span-2 text-right font-mono">{fmtNum(d.estoque_fisico, 3)}</div>
                    <div className="col-span-2 text-right font-mono text-muted-foreground">{fmtNum(d.estoque_reservado, 3)}</div>
                    <div className={`col-span-2 text-right font-mono rounded px-1 ${corEstoqueDep(d)}`}>
                      {fmtNum(d.estoque_disponivel, 3)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Clique para selecionar e ver estoque por depósito. <strong>Duplo clique</strong> seleciona o produto;
            duplo clique na grade de estoque seleciona produto + depósito.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoSearchDialog;
