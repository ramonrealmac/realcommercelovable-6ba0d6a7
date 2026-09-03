import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, X, Settings2, ArrowDown, ArrowUp } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";

const db = supabase as any;

export interface IProdutoRow {
  produto_id: number;
  cd_produto?: number | null;
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
  hideStockPromoFilters?: boolean;
  hideDepositGrid?: boolean;
  customFields?: CampoKey[];
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

const COLUMNS_CONFIG: Record<CampoKey, { label: string; width: string; align?: "left" | "right" | "center" }> = {
  codigo: { label: "Código", width: "70px", align: "right" },
  referencia: { label: "Referência", width: "100px" },
  gtin: { label: "GTIN", width: "115px" },
  nome: { label: "Nome", width: "1fr" },
  unidade: { label: "Unid.", width: "55px", align: "center" },
  preco: { label: "Preço", width: "120px", align: "right" },
  preco_promo: { label: "Promoção", width: "120px", align: "right" },
  estoque_disp: { label: "Est. Disp.", width: "95px", align: "right" },
  estoque_emp: { label: "Est. Emp.", width: "95px", align: "right" },
  reservado: { label: "Reserv.", width: "90px", align: "right" },
};

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
  const ids = Array.from(new Set([...(XGroupEmpresaIds.length > 0 ? XGroupEmpresaIds : [XEmpresaId]), XEmpresaId, 1]));

  // 1. Tentar encontrar pelo cod_barra na tabela produto_codbarra
  const { data: codBarraData } = await db.from("produto_codbarra")
    .select("produto_id")
    .eq("cod_barra", t)
    .in("empresa_id", ids)
    .eq("excluido", false)
    .limit(1)
    .maybeSingle();

  let q = db.from("produto")
    .select("produto_id, cd_produto, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
    .in("empresa_id", ids).eq("excluido", false).limit(5);
    
  if (codBarraData?.produto_id) {
    q = q.eq("produto_id", codBarraData.produto_id);
  } else if (/^\d+$/.test(t)) {
    q = q.or(`produto_id.eq.${t},cd_produto.eq.${t},referencia.eq.${t},gtin.eq.${t}`);
  } else {
    q = q.or(`referencia.eq.${t},gtin.eq.${t}`);
  }
  
  const { data: prods } = await q;
  if (!prods || prods.length === 0) return null;
  const p: any = prods[0];

  const { data: deps } = await db.from("deposito")
    .select("deposito_id, empresa_id, st_privado")
    .in("empresa_id", ids).eq("excluido", false);
  // Normaliza IDs para number (Supabase bigint pode chegar como string no JS)
  const visibleDepIds = new Set<number>(
    (deps || [])
      .filter((d: any) => Number(d.empresa_id) === XEmpresaId || d.st_privado === false)
      .map((d: any) => Number(d.deposito_id))
  );
  const empresaDoDep: Record<number, number> = {};
  for (const d of (deps || []) as any[]) empresaDoDep[Number(d.deposito_id)] = Number(d.empresa_id);

  const { data: ests } = await db.from("estoque")
    .select("produto_id, deposito_id, estoque_disponivel, estoque_reservado")
    .eq("produto_id", p.produto_id).in("empresa_id", ids).eq("excluido", false);
  let disp = 0, res = 0, naEmpresa = 0;
  for (const e of (ests || []) as any[]) {
    const depId = Number(e.deposito_id);
    if (!visibleDepIds.has(depId)) continue;
    const v = Number(e.estoque_disponivel || 0);
    disp += v;
    res += Number(e.estoque_reservado || 0);
    if (empresaDoDep[depId] === XEmpresaId) naEmpresa += v;
  }
  const isPromo = String(p.st_promo || "").toUpperCase() === "S";
  return {
    produto_id: p.produto_id,
    cd_produto: p.cd_produto,
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

const ProdutoSearchDialog: React.FC<IProps> = ({
  open,
  onClose,
  onSelect,
  hideStockPromoFilters = false,
  hideDepositGrid = false,
  customFields
}) => {
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
  const [XSortBy, setXSortBy] = useState<{ key: CampoKey; asc: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [XDecQty, setXDecQty] = useState(2);
  const [XDecVal, setXDecVal] = useState(2);

  const sortedRows = useMemo(() => {
    if (!XSortBy) return XRows;
    return [...XRows].sort((a, b) => {
      let valA: any = a[XSortBy.key as keyof IProdutoRow];
      let valB: any = b[XSortBy.key as keyof IProdutoRow];
      
      if (XSortBy.key === "codigo") { valA = a.cd_produto ?? a.produto_id; valB = b.cd_produto ?? b.produto_id; }
      else if (XSortBy.key === "preco") { valA = a.preco_venda; valB = b.preco_venda; }
      else if (XSortBy.key === "preco_promo") { valA = a.preco_promocional; valB = b.preco_promocional; }
      else if (XSortBy.key === "estoque_disp") { valA = a.estoque_disponivel; valB = b.estoque_disponivel; }
      else if (XSortBy.key === "estoque_emp") { valA = a.estoque_na_empresa; valB = b.estoque_na_empresa; }
      else if (XSortBy.key === "reservado") { valA = a.estoque_reservado; valB = b.estoque_reservado; }
      else if (XSortBy.key === "unidade") { valA = a.unidade_id; valB = b.unidade_id; }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      if (typeof valA === "string" && typeof valB === "string") {
        return XSortBy.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return XSortBy.asc ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });
  }, [XRows, XSortBy]);

  const handleSort = (k: CampoKey) => {
    setXSortBy(prev => {
      if (prev?.key === k) return { key: k, asc: !prev.asc };
      return { key: k, asc: true };
    });
    setXSelectedIdx(null);
  };
  const inputRef = useRef<HTMLInputElement>(null);

  const DEFAULT_WIDTHS: Record<CampoKey, number> = {
    codigo: 70,
    referencia: 100,
    gtin: 115,
    nome: 300,
    unidade: 55,
    preco: 120,
    preco_promo: 120,
    estoque_disp: 95,
    estoque_emp: 95,
    reservado: 90,
  };

  const getStorageKey = useCallback(() => {
    if (typeof window === "undefined") return "pdv_search_col_widths_default";
    const w = window.innerWidth;
    let category = "sm";
    if (w >= 1536) category = "2xl";
    else if (w >= 1280) category = "xl";
    else if (w >= 1024) category = "lg";
    else if (w >= 768) category = "md";
    return `pdv_search_col_widths_${category}`;
  }, []);

  const [currentKey, setCurrentKey] = useState<string>("");
  const [XColWidths, setXColWidths] = useState<Record<CampoKey, number>>(DEFAULT_WIDTHS);

  useEffect(() => {
    const handleResize = () => setCurrentKey(getStorageKey());
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getStorageKey]);

  useEffect(() => {
    if (!currentKey) return;
    try {
      const saved = localStorage.getItem(currentKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setXColWidths({
          codigo: parsed.codigo ?? DEFAULT_WIDTHS.codigo,
          referencia: parsed.referencia ?? DEFAULT_WIDTHS.referencia,
          gtin: parsed.gtin ?? DEFAULT_WIDTHS.gtin,
          nome: parsed.nome ?? DEFAULT_WIDTHS.nome,
          unidade: parsed.unidade ?? DEFAULT_WIDTHS.unidade,
          preco: Math.max(parsed.preco ?? DEFAULT_WIDTHS.preco, 120),
          preco_promo: Math.max(parsed.preco_promo ?? DEFAULT_WIDTHS.preco_promo, 120),
          estoque_disp: parsed.estoque_disp ?? DEFAULT_WIDTHS.estoque_disp,
          estoque_emp: parsed.estoque_emp ?? DEFAULT_WIDTHS.estoque_emp,
          reservado: parsed.reservado ?? DEFAULT_WIDTHS.reservado,
        });
      } else {
        setXColWidths(DEFAULT_WIDTHS);
      }
    } catch (e) {
      console.warn("Falha ao ler larguras de coluna no localStorage", e);
    }
  }, [currentKey]);

  useEffect(() => {
    if (!currentKey) return;
    try {
      localStorage.setItem(currentKey, JSON.stringify(XColWidths));
    } catch (e) {
      console.warn("Falha ao salvar larguras de coluna no localStorage", e);
    }
  }, [XColWidths, currentKey]);

  const startResize = useCallback((key: CampoKey, startWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setXColWidths(prev => ({
        ...prev,
        [key]: Math.max(40, startWidth + deltaX),
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  const XGroupEmpresaIds = useMemo(() => {
    return XEmpresas
      .filter(e => e.empresa_matriz_id === XEmpresaMatrizId || e.empresa_id === XEmpresaMatrizId)
      .map(e => e.empresa_id);
  }, [XEmpresas, XEmpresaMatrizId]);

  const gridTemplateColumns = useMemo(() => {
    return CAMPOS_DISPONIVEIS
      .filter(c => XCampos.includes(c.key))
      .map(c => {
        const conf = COLUMNS_CONFIG[c.key];
        if (conf?.width === "1fr") return "1fr";
        return `${XColWidths[c.key]}px`;
      })
      .join(" ");
  }, [XCampos, XColWidths]);

  const empresaNome = useCallback((id: number) => {
    return XEmpresas.find(e => e.empresa_id === id)?.nome_fantasia
      || XEmpresas.find(e => e.empresa_id === id)?.razao_social
      || `Emp ${id}`;
  }, [XEmpresas]);

  // Carrega configuração de campos da empresa
  useEffect(() => {
    if (!open || !XEmpresaId) return;
    if (customFields) {
      setXCampos(customFields);
      return;
    }
    (async () => {
      const { data } = await db.from("empresa")
        .select("pdv_pesquisa_campos")
        .eq("empresa_id", XEmpresaId)
        .maybeSingle();
      setXCampos(parseCampos(data?.pdv_pesquisa_campos));
    })();
  }, [open, XEmpresaId, customFields]);

  // Carrega casas decimais de quantidade (qtde venda) e valores (valor venda)
  useEffect(() => {
    if (!open || !XEmpresaId) return;
    (async () => {
      try {
        const { data } = await db.from("empresa")
          .select("qt_venda_qt_decimais, vl_venda_qt_decimais")
          .eq("empresa_id", XEmpresaId)
          .maybeSingle();
        if (data) {
          if (data.qt_venda_qt_decimais != null) {
            setXDecQty(Number(data.qt_venda_qt_decimais));
          }
          if (data.vl_venda_qt_decimais != null) {
            setXDecVal(Number(data.vl_venda_qt_decimais));
          }
        }
      } catch (e) {
        console.warn("Falha ao obter casas decimais no ProdutoSearchDialog:", e);
      }
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

    // 1. Buscar depósitos primeiro para obter os visibleDepIds
    const { data: deps } = await db.from("deposito")
      .select("deposito_id, empresa_id, st_privado")
      .in("empresa_id", ids).eq("excluido", false);

    // Normaliza IDs para number (Supabase bigint pode chegar como string no JS)
    const visibleDepIds = new Set<number>(
      (deps || []).filter((d: any) => Number(d.empresa_id) === XEmpresaId || d.st_privado === false)
        .map((d: any) => Number(d.deposito_id))
    );
    const empresaDoDep: Record<number, number> = {};
    for (const d of (deps || []) as any[]) empresaDoDep[Number(d.deposito_id)] = Number(d.empresa_id);

    const t = termo.trim();

    // 2. Se o filtro "com estoque" estiver ativo e a pesquisa estiver vazia,
    // buscamos primeiro os IDs dos produtos que têm estoque para limitar a busca de produtos.
    let prodIdsWithStock: number[] | null = null;
    if (XSoEstoque && !t && visibleDepIds.size > 0) {
      const { data: stockData } = await db.from("estoque")
        .select("produto_id")
        .in("empresa_id", ids)
        .in("deposito_id", Array.from(visibleDepIds))
        .gt("estoque_disponivel", 0)
        .eq("excluido", false)
        .limit(100);

      if (stockData && stockData.length > 0) {
        prodIdsWithStock = Array.from(new Set(stockData.map((x: any) => Number(x.produto_id))));
      } else {
        prodIdsWithStock = [];
      }
    }

    // 3. Monta query de produtos
    let q = db.from("produto")
      .select("produto_id, cd_produto, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
      .in("empresa_id", ids).eq("excluido", false);

    // Se temos filtro de IDs por estoque na busca vazia
    if (XSoEstoque && !t) {
      if (prodIdsWithStock && prodIdsWithStock.length > 0) {
        q = q.in("produto_id", prodIdsWithStock);
      } else {
        q = q.in("produto_id", [-1]); // Força lista vazia
      }
    }

    if (t) {
      let codBarraProdIds: number[] = [];
      const { data: cbData } = await db.from("produto_codbarra")
        .select("produto_id")
        .ilike("cod_barra", `${t}%`)
        .in("empresa_id", ids)
        .eq("excluido", false)
        .limit(20);
      if (cbData) {
        codBarraProdIds = cbData.map((x: any) => x.produto_id);
      }
      
      const cbFilter = codBarraProdIds.length > 0 ? `,produto_id.in.(${codBarraProdIds.join(",")})` : "";
      if (/^\d+$/.test(t)) {
        q = q.or(`cd_produto_text.ilike.${t}%,referencia.ilike.${t}%,gtin.ilike.${t}%,nome.ilike.${t}%${cbFilter}`);
      } else {
        q = q.or(`nome.ilike.${t}%,referencia.ilike.${t}%,gtin.ilike.${t}%${cbFilter}`);
      }
    }
    if (XSoPromo) q = q.eq("st_promo", "S");

    // Limite de busca: se estiver buscando com filtro de estoque por termo,
    // aumentamos o limite para achar produtos correspondentes.
    const limitVal = (XSoEstoque && t) ? 250 : 100;
    q = q.order("nome").limit(limitVal);

    let exactProd: any = null;
    if (t && /^\d+$/.test(t)) {
      try {
        const { data: exactData } = await db.from("produto")
          .select("produto_id, cd_produto, nome, unidade_id, preco_venda, preco_promocional, st_promo, referencia, gtin")
          .in("empresa_id", ids)
          .eq("cd_produto", Number(t))
          .eq("excluido", false)
          .limit(1)
          .maybeSingle();
        if (exactData) {
          exactProd = exactData;
        }
      } catch (e) {
        console.warn("Falha ao buscar cd_produto exato:", e);
      }
    }

    const { data: prods, error } = await q;
    if (error || !prods) { setXLoading(false); setXRows([]); return; }

    let prodsList = [...prods];
    if (exactProd) {
      prodsList = prodsList.filter((p: any) => p.produto_id !== exactProd.produto_id);
      prodsList.unshift(exactProd);
    }

    const prodIds = prodsList.map((p: any) => p.produto_id);
    let estMap: Record<number, { disp: number; res: number; naEmp: number }> = {};

    // 🔍 DEBUG — remover após diagnóstico
    console.group("[ProdutoSearch] DEBUG buscar — empresa=" + XEmpresaId + " ids=" + JSON.stringify(ids));
    console.log("Depósitos buscados:", (deps || []).map((d:any) => ({ dep: Number(d.deposito_id), emp: Number(d.empresa_id), priv: d.st_privado })));
    console.log("visibleDepIds:", [...visibleDepIds]);
    console.log("prodIds.length:", prodIds.length, "| visibleDepIds.size:", visibleDepIds.size);

    if (prodIds.length > 0 && visibleDepIds.size > 0) {
      const { data: ests } = await db.from("estoque")
        .select("produto_id, deposito_id, estoque_disponivel, estoque_reservado")
        .in("produto_id", prodIds).in("empresa_id", ids).eq("excluido", false);

      console.log("Total estoque records retornados:", (ests || []).length);
      const raw998 = (ests || []).filter((e:any) => Number(e.produto_id) === 998);
      if (raw998.length > 0)
        console.log("Estoque bruto produto 998:", raw998.map((e:any) => ({ dep: Number(e.deposito_id), disp: e.estoque_disponivel, res: e.estoque_reservado })));
      else
        console.warn("Produto 998 NÃO encontrado no retorno do estoque");

      for (const e of (ests || []) as any[]) {
        const depId = Number(e.deposito_id);
        const prodId = Number(e.produto_id);
        if (!visibleDepIds.has(depId)) {
          if (prodId === 998) console.warn("Produto 998: depósito", depId, "IGNORADO (não está em visibleDepIds). empresaDoDep[depId]=", empresaDoDep[depId]);
          continue;
        }
        const cur = estMap[prodId] || { disp: 0, res: 0, naEmp: 0 };
        const v = Number(e.estoque_disponivel || 0);
        cur.disp += v;
        cur.res += Number(e.estoque_reservado || 0);
        if (empresaDoDep[depId] === XEmpresaId) cur.naEmp += v;
        estMap[prodId] = cur;
      }
    } else {
      console.warn("ESTOQUE NÃO BUSCADO: prodIds.length=", prodIds.length, "| visibleDepIds.size=", visibleDepIds.size);
    }

    console.log("estMap[998]:", estMap[998] ?? "NÃO ENCONTRADO");
    console.groupEnd();
    // 🔍 fim DEBUG

    let rows: IProdutoRow[] = prodsList.map(p => ({
      produto_id: p.produto_id,
      cd_produto: p.cd_produto,
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
    if (XSoEstoque) rows = rows.filter(r => r.estoque_disponivel > 0);
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

    const depIds = Array.from(new Set((ests || []).map((e: any) => Number(e.deposito_id))));
    let depMap: Record<number, { nome: string; empresa_id: number; st_privado: boolean }> = {};
    if (depIds.length > 0) {
      const { data: deps } = await db.from("deposito")
        .select("deposito_id, nome, empresa_id, st_privado")
        .in("deposito_id", depIds).eq("excluido", false);
      for (const d of (deps || []) as any[]) {
        depMap[Number(d.deposito_id)] = { nome: d.nome, empresa_id: Number(d.empresa_id), st_privado: d.st_privado };
      }
    }

    const rows: IEstoqueDepositoRow[] = [];
    for (const e of (ests || []) as any[]) {
      const depId = Number(e.deposito_id);
      const d = depMap[depId];
      if (!d) continue;
      const visivel = d.empresa_id === XEmpresaId || d.st_privado === false;
      if (!visivel) continue;
      rows.push({
        deposito_id: depId,
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
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open, buscar]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscar(XTermo), 300);
    return () => clearTimeout(t);
  }, [XTermo, open, buscar]);

  useEffect(() => {
    if (XSelectedIdx !== null && sortedRows[XSelectedIdx]) {
      carregarEstoqueDoProduto(sortedRows[XSelectedIdx].produto_id);
    } else {
      setXEstDeps([]);
    }
  }, [XSelectedIdx, sortedRows, carregarEstoqueDoProduto]);

  const selecionarLinha = (idx: number, r: IProdutoRow) => {
    setXSelectedIdx(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (sortedRows.length === 0 || XLoading) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setXSelectedIdx(prev => {
        const next = prev === null ? 0 : Math.min(prev + 1, sortedRows.length - 1);
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
      if (sortedRows[selected]) {
        e.preventDefault();
        onSelect(sortedRows[selected]);
        onClose();
      }
    }
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

    push("codigo", <span className="font-mono text-blue-600 dark:text-blue-400">{r.cd_produto ?? r.produto_id}</span>);
    push("referencia", r.referencia ? <span className="font-mono text-muted-foreground">Ref: {r.referencia}</span> : null);
    push("gtin", r.gtin ? <span className="font-mono text-muted-foreground">GTIN: {r.gtin}</span> : null);
    push("nome", <span className="text-blue-800 dark:text-blue-300 font-medium break-words">{r.nome}</span>);
    push("unidade", r.unidade_id ? <span className="text-muted-foreground">{r.unidade_id}</span> : null);

    const showPromo = r.st_promo && r.preco_promocional > 0;
    push("preco",
      showPromo
        ? <span className="line-through text-muted-foreground font-mono">R$ {fmtNum(r.preco_venda, XDecVal)}</span>
        : <span className="text-black dark:text-white font-mono">R$ {fmtNum(r.preco_venda, XDecVal)}</span>
    );
    push("preco_promo",
      showPromo
        ? <span className="text-green-600 dark:text-green-400 font-semibold font-mono">R$ {fmtNum(r.preco_promocional, XDecVal)}</span>
        : null
    );

    const corEst = (v: number) =>
      v > 0 ? "text-black dark:text-white" : "text-red-600 dark:text-red-400 font-semibold";

    push("estoque_disp",
      <span className={`font-mono ${corEst(r.estoque_disponivel)}`}>Estq: {fmtNum(r.estoque_disponivel, XDecQty)}</span>
    );
    push("estoque_emp",
      <span className={`font-mono ${corEst(r.estoque_na_empresa)}`}>Emp: {fmtNum(r.estoque_na_empresa, XDecQty)}</span>
    );
    push("reservado",
      <span className="font-mono text-amber-600 dark:text-amber-400">Res: {fmtNum(r.estoque_reservado, XDecQty)}</span>
    );

    return chips;
  };

  // ── Renderiza uma célula na tabela (desktop/convencionais) ──
  const renderCell = (r: IProdutoRow, key: CampoKey) => {
    const showPromo = r.st_promo && r.preco_promocional > 0;
    const corEst = (v: number) =>
      v > 0 ? "text-black dark:text-white font-mono" : "text-red-600 dark:text-red-400 font-semibold font-mono";

    switch (key) {
      case "codigo":
        return <span className="font-mono text-blue-600 dark:text-blue-400">{r.cd_produto ?? r.produto_id}</span>;
      case "referencia":
        return r.referencia ? <span className="font-mono text-muted-foreground">{r.referencia}</span> : <span className="text-muted-foreground/30">-</span>;
      case "gtin":
        return r.gtin ? <span className="font-mono text-muted-foreground">{r.gtin}</span> : <span className="text-muted-foreground/30">-</span>;
      case "nome":
        return <span className="text-blue-800 dark:text-blue-300 font-medium break-all">{r.nome}</span>;
      case "unidade":
        return r.unidade_id ? <span className="text-muted-foreground">{r.unidade_id}</span> : <span className="text-muted-foreground/30">-</span>;
      case "preco":
        return showPromo
          ? <span className="line-through text-muted-foreground font-mono">R$ {fmtNum(r.preco_venda, XDecVal)}</span>
          : <span className="text-black dark:text-white font-mono font-medium">R$ {fmtNum(r.preco_venda, XDecVal)}</span>;
      case "preco_promo":
        return showPromo
          ? <span className="text-green-600 dark:text-green-400 font-semibold font-mono">R$ {fmtNum(r.preco_promocional, XDecVal)}</span>
          : <span className="text-muted-foreground/30">-</span>;
      case "estoque_disp":
        return <span className={corEst(r.estoque_disponivel)}>{fmtNum(r.estoque_disponivel, XDecQty)}</span>;
      case "estoque_emp":
        return <span className={corEst(r.estoque_na_empresa)}>{fmtNum(r.estoque_na_empresa, XDecQty)}</span>;
      case "reservado":
        return <span className="font-mono text-amber-600 dark:text-amber-400">{fmtNum(r.estoque_reservado, XDecQty)}</span>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent 
        className="max-w-[1150px] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden [&>button[class*='absolute']]:text-white/80 [&>button[class*='absolute']]:hover:text-white [&>button[class*='absolute']]:top-4 [&>button[class*='absolute']]:right-4 border border-border"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader className="shrink-0 bg-primary text-primary-foreground px-6 py-1.5 flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-semibold text-primary-foreground">Pesquisar Produto</DialogTitle>
        </DialogHeader>

        {/* Toolbar de Filtros (evita sobreposição com botão Fechar) */}
        {!hideStockPromoFilters && (
          <div className="flex items-center justify-between gap-4 px-6 h-[25px] bg-muted/40 border-b border-border text-xs shrink-0 select-none">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                <input 
                  type="checkbox" 
                  checked={XSoEstoque} 
                  onChange={e => setXSoEstoque(e.target.checked)} 
                  className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-3.5 h-3.5 m-0" 
                />
                <span className="leading-none mt-[1px]">Com estoque</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                <input 
                  type="checkbox" 
                  checked={XSoPromo} 
                  onChange={e => setXSoPromo(e.target.checked)} 
                  className="rounded border-muted-foreground/30 text-primary focus:ring-primary w-3.5 h-3.5 m-0" 
                />
                <span className="leading-none mt-[1px]">Em promoção</span>
              </label>
            </div>

            <Popover open={XCfgOpen} onOpenChange={setXCfgOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="Configurar campos exibidos"
                  className="flex items-center justify-center gap-1 px-2.5 py-0 h-[20px] rounded border border-border bg-card hover:bg-accent text-[11px] font-medium"
                >
                  <Settings2 className="w-3.5 h-3.5" /> <span className="leading-none">Campos</span>
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
        )}

        <div className="px-6 pt-1.5 pb-6 flex-1 flex flex-col min-h-0 space-y-4">
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              value={XTermo}
              onChange={e => setXTermo(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite código, nome, referência ou GTIN..."
              className="w-full pl-9 pr-9 py-2 border border-border rounded text-sm bg-card"
            />
            {XTermo && (
              <button onClick={() => setXTermo("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Lista em coluna única com chips coloridos ou tabela desktop */}
          <div className="border border-border rounded overflow-hidden overflow-x-auto flex-1 min-h-0 flex flex-col bg-card">
            <div className="w-max min-w-full flex-1 flex flex-col min-h-0">
              {/* Header (desktop apenas) */}
              <div 
                className="hidden md:grid bg-muted/50 text-xs font-semibold text-muted-foreground border-b border-border select-none shrink-0"
                style={{ gridTemplateColumns }}
              >
                {CAMPOS_DISPONIVEIS
                  .filter(c => XCampos.includes(c.key))
                  .map(c => (
                    <div 
                      key={c.key} 
                      className={`relative py-1.5 px-3 select-none flex items-center h-full group border-r border-border/40 last:border-r-0 cursor-pointer hover:bg-muted/80 ${
                        COLUMNS_CONFIG[c.key].align === "right" ? "justify-end text-right" :
                        COLUMNS_CONFIG[c.key].align === "center" ? "justify-center text-center" : "justify-start text-left"
                      }`}
                      onClick={() => handleSort(c.key)}
                    >
                      <span className="truncate pr-2 flex items-center gap-1">
                        {COLUMNS_CONFIG[c.key].label}
                        {XSortBy?.key === c.key && (
                          XSortBy.asc ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />
                        )}
                      </span>
                      
                      {/* Drag Handle */}
                      <div
                        onMouseDown={(e) => startResize(c.key, XColWidths[c.key], e)}
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/45 active:bg-primary z-10 border-r border-border/60 group-hover:border-primary/40 transition-colors"
                        title="Arraste para redimensionar"
                      />
                    </div>
                  ))}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto flex flex-col min-h-0">
                {XLoading && (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                    Carregando...
                  </div>
                )}
                {!XLoading && sortedRows.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
                    Nenhum produto encontrado.
                  </div>
                )}
                {!XLoading && sortedRows.map((r, idx) => {
                  const sel = XSelectedIdx === idx;
                  const zebra = idx % 2 === 1 ? "bg-gray-100 dark:bg-zinc-800/50" : "bg-white dark:bg-zinc-950";
                  return (
                    <div
                      key={r.produto_id}
                      data-index={idx}
                      onClick={() => selecionarLinha(idx, r)}
                      onDoubleClick={() => { onSelect(r); onClose(); }}
                      className={`text-sm border-t border-border cursor-pointer shrink-0 break-words ${
                        sel ? "bg-primary/15" : `${zebra} hover:bg-accent/50`
                      }`}
                    >
                      {/* Padrão Mobile: chips em flex wrap */}
                      <div className="flex md:hidden flex-wrap items-center gap-x-2 gap-y-1 w-full px-3 py-2">
                        {renderChips(r)}
                      </div>

                      {/* Padrão Desktop: campos separados em colunas */}
                      <div 
                        className="hidden md:grid items-center w-full"
                        style={{ gridTemplateColumns }}
                      >
                        {CAMPOS_DISPONIVEIS
                          .filter(c => XCampos.includes(c.key))
                          .map(c => {
                            const cellContent = renderCell(r, c.key);
                            return (
                              <div 
                                key={c.key} 
                                className={`truncate px-3 py-1 border-r border-border/20 last:border-r-0 h-full flex items-center ${
                                  COLUMNS_CONFIG[c.key].align === "right" ? "justify-end text-right" :
                                  COLUMNS_CONFIG[c.key].align === "center" ? "justify-center text-center" : "justify-start text-left"
                                }`}
                              >
                                <span className="truncate w-full">{cellContent}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 2ª Grade — estoque por depósito do produto selecionado */}
          {!hideDepositGrid && (
            <div className="border border-border rounded overflow-hidden shrink-0 bg-card">
              <div className="px-3 py-1 bg-muted/50 text-[11px] font-semibold text-muted-foreground border-b border-border">
                Estoque por depósito {XSelectedIdx != null ? `— ${sortedRows[XSelectedIdx]?.nome}` : ""}
              </div>
              <div className="grid gap-2 px-3 py-1 bg-muted text-[11px] font-semibold text-muted-foreground" style={{ gridTemplateColumns: "1fr 120px 120px 120px" }}>
                <div>Depósito</div>
                <div className="text-right">Físico</div>
                <div className="text-right">Reserv.</div>
                <div className="text-right">Disponível</div>
              </div>
              <div className="overflow-y-auto h-[88px] flex flex-col">
                {XSelectedIdx == null && (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground p-2">
                    Selecione um produto para ver o estoque por depósito.
                  </div>
                )}
                {XLoadingEst && (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground p-2">
                    Carregando...
                  </div>
                )}
                {!XLoadingEst && XSelectedIdx != null && XEstDeps.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[11px] text-muted-foreground p-2">
                    Sem registros de estoque para este produto.
                  </div>
                )}
                {!XLoadingEst && XEstDeps.map((d, i) => {
                  const zebra = i % 2 === 1 ? "bg-muted/30" : "";
                  return (
                    <div
                      key={d.deposito_id}
                      onDoubleClick={() => {
                        const p = sortedRows[XSelectedIdx!];
                        onSelect(p, d.deposito_id);
                        onClose();
                      }}
                      className={`grid gap-2 px-3 py-0.5 text-[11px] border-t border-border cursor-pointer shrink-0 hover:bg-accent/50 ${zebra}`}
                      style={{ gridTemplateColumns: "1fr 120px 120px 120px" }}
                      title="Duplo clique: seleciona produto e depósito"
                    >
                      <div className="truncate">{d.deposito_nome}</div>
                      <div className="text-right font-mono">{fmtNum(d.estoque_fisico, XDecQty)}</div>
                      <div className="text-right font-mono text-muted-foreground">{fmtNum(d.estoque_reservado, XDecQty)}</div>
                      <div className={`text-right font-mono rounded px-1 ${corEstoqueDep(d)}`}>
                        {fmtNum(d.estoque_disponivel, XDecQty)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Clique para ver estoque por depósito. <strong>Duplo clique</strong> ou <strong>Enter</strong> seleciona o produto.
            </p>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-bold bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={XSelectedIdx === null || !sortedRows[XSelectedIdx]}
                onClick={() => {
                  if (XSelectedIdx !== null && sortedRows[XSelectedIdx]) {
                    onSelect(sortedRows[XSelectedIdx]);
                    onClose();
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded disabled:opacity-50 transition-colors shadow-sm"
              >
                SELECIONAR
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoSearchDialog;
