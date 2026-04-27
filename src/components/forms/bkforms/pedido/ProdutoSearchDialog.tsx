import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, X } from "lucide-react";
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
  estoque_na_empresa: number; // estoque do depósito da empresa atual
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

export async function buscarProdutoPorCodigo(
  termo: string,
  XEmpresaId: number,
  XGroupEmpresaIds: number[]
): Promise<IProdutoRow | null> {
  const t = (termo || "").trim();
  if (!t) return null;
  const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];

  let q = db.from("produto")
    .select("produto_id, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
    .in("empresa_id", ids).eq("excluido", false).limit(5);
  if (/^\d+$/.test(t)) {
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

  const buscar = useCallback(async (termo: string) => {
    setXLoading(true);
    const ids = XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId];

    let q = db.from("produto")
      .select("produto_id, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
      .in("empresa_id", ids).eq("excluido", false).order("nome").limit(100);

    const t = termo.trim();
    if (t) {
      if (/^\d+$/.test(t)) {
        q = q.or(`produto_id.eq.${t},referencia.ilike.%${t}%,gtin.ilike.%${t}%,nome.ilike.%${t}%`);
      } else {
        q = q.or(`nome.ilike.%${t}%,referencia.ilike.%${t}%,gtin.ilike.%${t}%`);
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
      // Visível: pertence à empresa atual OU não é privado
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

  const corEstoque = (r: IProdutoRow) => {
    if (r.estoque_na_empresa > 0) return "bg-green-100 dark:bg-green-900/30";
    if (r.estoque_disponivel > 0) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "";
  };

  const corEstoqueDep = (r: IEstoqueDepositoRow) => {
    if (r.estoque_disponivel <= 0) return "";
    return r.da_empresa_atual ? "bg-green-100 dark:bg-green-900/30" : "bg-yellow-100 dark:bg-yellow-900/30";
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
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

          {/* Grade principal */}
          <div className="border border-border rounded overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
              <div className="col-span-1 text-right">Código</div>
              <div className="col-span-5">Nome</div>
              <div className="col-span-1">Und.</div>
              <div className="col-span-2 text-right">Preço Venda</div>
              <div className="col-span-2 text-right">Estoq. Disp.</div>
              <div className="col-span-1 text-right">Reserv.</div>
            </div>
            <div className="max-h-[360px] overflow-y-auto">
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
                    className={`grid grid-cols-12 gap-2 px-3 py-2 text-sm border-t border-border cursor-pointer ${
                      sel ? "bg-primary/15" : `${zebra} hover:bg-accent/50`
                    }`}
                  >
                    <div className="col-span-1 text-right font-mono">{r.produto_id}</div>
                    <div className="col-span-5 truncate">{r.nome}</div>
                    <div className="col-span-1">{r.unidade_id || ""}</div>
                    <div className={`col-span-2 text-right font-mono rounded px-1 ${r.st_promo ? "bg-green-100 dark:bg-green-900/30" : ""}`}>
                      {fmtNum(r.st_promo && r.preco_promocional > 0 ? r.preco_promocional : r.preco_venda)}
                    </div>
                    <div className={`col-span-2 text-right font-mono rounded px-1 ${corEstoque(r)}`}>
                      {fmtNum(r.estoque_disponivel, 3)}
                    </div>
                    <div className="col-span-1 text-right font-mono text-muted-foreground">
                      {fmtNum(r.estoque_reservado, 3)}
                    </div>
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
              <div className="col-span-1 text-right">Cód.</div>
              <div className="col-span-3">Depósito</div>
              <div className="col-span-3">Empresa</div>
              <div className="col-span-2 text-right">Físico</div>
              <div className="col-span-1 text-right">Reserv.</div>
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
                    <div className="col-span-1 text-right font-mono">{d.deposito_id}</div>
                    <div className="col-span-3 truncate">{d.deposito_nome}</div>
                    <div className="col-span-3 truncate">{d.empresa_nome}</div>
                    <div className="col-span-2 text-right font-mono">{fmtNum(d.estoque_fisico, 3)}</div>
                    <div className="col-span-1 text-right font-mono text-muted-foreground">{fmtNum(d.estoque_reservado, 3)}</div>
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
