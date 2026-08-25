import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

/**
 * Converte e verifica se datas iniciais/finais são válidas para a data atual.
 */
export function isPromocaoValida(dtInicial: string | null | undefined, dtFinal: string | null | undefined): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dtInicial && dtInicial.trim()) {
    const dIni = parseAnyDate(dtInicial);
    if (dIni) {
      dIni.setHours(0, 0, 0, 0);
      if (today < dIni) return false;
    }
  }

  if (dtFinal && dtFinal.trim()) {
    const dFin = parseAnyDate(dtFinal);
    if (dFin) {
      dFin.setHours(23, 59, 59, 999);
      if (today > dFin) return false;
    }
  }

  return true;
}

function parseAnyDate(val: string): Date | null {
  const v = val.trim();
  // Formato brasileiro DD/MM/YYYY
  const brMatch = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    return new Date(parseInt(brMatch[3]), parseInt(brMatch[2]) - 1, parseInt(brMatch[1]));
  }
  // Formato ISO YYYY-MM-DD
  const isoMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 1. Verifica se o produto possui preço em uma PROMOÇÃO ativa, não excluída e válida pelas datas inicial/final.
 */
/**
 * 1. Verifica se o produto possui preço em uma PROMOÇÃO ativa, não excluída e válida pelas datas inicial/final.
 * promocaoModo: 'V' (A VISTA) | 'P' export async function obterPrecoPromocional(
  produtoId: number,
  promocaoModo: "V" | "P" = "V"
): Promise<number | null> {
  try {
    const { data: items, error } = await db
      .from("promocao_item")
      .select("valor_promocional, valor_promocional_prazo, promocao_id, excluido")
      .eq("produto_id", produtoId);

    if (error || !items || items.length === 0) return null;

    const validItems = items.filter((i: any) => i.excluido !== true && i.excluido !== "S");
    if (validItems.length === 0) return null;

    for (const item of validItems) {
      const { data: promo } = await db
        .from("promocao")
        .select("promocao_id, dt_inicial, dt_final, ativa, excluido")
        .eq("promocao_id", item.promocao_id)
        .maybeSingle();

      if (!promo) continue;

      const isPromoExcluido = promo.excluido === true || promo.excluido === "S";
      const isPromoAtiva = promo.ativa === true || promo.ativa === "S" || promo.ativa === null || promo.ativa === undefined || promo.ativa === 1;

      if (!isPromoExcluido && isPromoAtiva && isPromocaoValida(promo.dt_inicial, promo.dt_final)) {
        if (promocaoModo === "P") {
          const pPrazo = Number(item.valor_promocional_prazo);
          if (pPrazo && pPrazo > 0) return pPrazo;
        }
        const pVista = Number(item.valor_promocional);
        if (pVista && pVista > 0) return pVista;
      }
    }
    return null;
  } catch (e) {
    console.warn("Erro ao buscar preço promocional:", e);
    return null;
  }
}

/**
 * 2. Busca o preço do produto em uma TABELA DE PREÇOS, verificando se a tabela está ativa, não excluída e válida por datas.
 */
export async function obterPrecoTabela(produtoId: number, tabelaId: number): Promise<number | null> {
  try {
    const { data: tab } = await db
      .from("tabela_preco")
      .select("tabela_id, dt_inicial, dt_final, ativa, excluido")
      .eq("tabela_id", tabelaId)
      .maybeSingle();

    if (!tab) return null;

    const isTabExcluido = tab.excluido === true || tab.excluido === "S";
    const isTabAtiva = tab.ativa === true || tab.ativa === "S" || tab.ativa === null || tab.ativa === undefined || tab.ativa === 1;

    if (isTabExcluido || !isTabAtiva || !isPromocaoValida(tab.dt_inicial, tab.dt_final)) {
      return null;
    }

    const { data: items, error } = await db
      .from("tabela_preco_item")
      .select("preco, excluido")
      .eq("tabela_id", tabelaId)
      .eq("produto_id", produtoId);

    if (error || !items || items.length === 0) return null;

    const itemValido = items.find((i: any) => i.excluido !== true && i.excluido !== "S");
    return itemValido ? Number(itemValido.preco) : null;
  } catch (e) {
    console.warn("Erro ao buscar preço da tabela:", e);
    return null;
  }
}

/**
 * 3. Função principal de obtenção do Preço Unitário para o Pedido:
 * Regras:
 * a - se o produto estiver em tabela de promoções ativa e válida, pega preço de acordo com o tipo pagamento da tabela (V ou P)
 * b - caso não esteja em tabela de promoções, pega o preço da tabela selecionada (se ativa e não vencida)
 * c - caso a tabela de preço for Preço Padrão (Sem Tabela), pega o preço vl sug venda na tabela do produto
 */
export async function obterPrecoUnitarioItem(
  produtoId: number,
  tabelaPrecoId?: number | null,
  precoVendaPadrao?: number | null
): Promise<{ preco: number; fonte: "promocao" | "tabela" | "padrao" }> {
  // Descobre o modo de pagamento ('V' ou 'P') da Tabela de Preço selecionada
  let tpPagamento: "V" | "P" = "V";
  if (tabelaPrecoId) {
    try {
      const { data: tab } = await db
        .from("tabela_preco")
        .select("tp_pagamento")
        .eq("tabela_id", tabelaPrecoId)
        .maybeSingle();

      if (tab?.tp_pagamento === "P") {
        tpPagamento = "P";
      }
    } catch (e) {
      console.warn("Erro ao carregar tp_pagamento da tabela_preco:", e);
    }
  }

  // 1. Tenta buscar na Tabela de Promoções (ativa e válida)
  const precoPromo = await obterPrecoPromocional(produtoId, tpPagamento);
  if (precoPromo !== null && precoPromo > 0) {
    return { preco: precoPromo, fonte: "promocao" };
  }

  // 2. Se o produto não estiver em promoção válida/ativa, tenta Tabela de Preço selecionada
  if (tabelaPrecoId) {
    const precoTab = await obterPrecoTabela(produtoId, tabelaPrecoId);
    if (precoTab !== null && precoTab > 0) {
      return { preco: precoTab, fonte: "tabela" };
    }
  }

  // 3. Fallback: Preço Padrão (vl. sug. venda na tabela do produto)
  if (precoVendaPadrao !== undefined && precoVendaPadrao !== null && Number(precoVendaPadrao) > 0) {
    return { preco: Number(precoVendaPadrao), fonte: "padrao" };
  }

  try {
    const { data: prod } = await db
      .from("produto")
      .select("preco_venda")
      .eq("produto_id", produtoId)
      .maybeSingle();
    return { preco: Number(prod?.preco_venda || 0), fonte: "padrao" };
  } catch {
    return { preco: 0, fonte: "padrao" };
  }
}
