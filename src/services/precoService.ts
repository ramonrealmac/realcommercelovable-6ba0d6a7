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
 * promocaoModo: 'V' (A VISTA) | 'P'
 */
export async function obterPrecoPromocional(
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
 * Calcula o preço unitário padrão diretamente a partir do cadastro do produto.
 * 
 * Regra:
 * Padrão À Vista:
 *   - Sem promoção: produto.preco_venda
 *   - Em promoção: produto.preco_promocional (se preenchido, senão preco_venda)
 * Padrão A Prazo:
 *   - Sem promoção: produto.preco_venda_faturado (se preenchido, senão preco_venda)
 *   - Em promoção: produto.preco_promocional_fat (se preenchido, senão preco_promocional ou preco_venda_faturado ou preco_venda)
 */
export function calcularPrecoPadraoProduto(
  prod: {
    preco_venda?: number | null;
    preco_venda_faturado?: number | null;
    preco_promocional?: number | null;
    preco_promocional_fat?: number | null;
    st_promo?: boolean | string | null;
  },
  tipoPrecoPadrao: "V" | "P" = "V"
): { preco: number; isPromocao: boolean } {
  const isPromo = prod.st_promo === true || String(prod.st_promo || "").toUpperCase() === "S";

  const pVenda = Number(prod.preco_venda || 0);
  const pVendaFat = Number(prod.preco_venda_faturado || 0);
  const pPromo = Number(prod.preco_promocional || 0);
  const pPromoFat = Number(prod.preco_promocional_fat || 0);

  if (tipoPrecoPadrao === "P") {
    // Padrão A Prazo
    if (isPromo) {
      const precoFatPromo = pPromoFat > 0 ? pPromoFat : (pPromo > 0 ? pPromo : 0);
      if (precoFatPromo > 0) {
        return { preco: precoFatPromo, isPromocao: true };
      }
    }
    const precoFatNormal = pVendaFat > 0 ? pVendaFat : pVenda;
    return { preco: precoFatNormal, isPromocao: false };
  } else {
    // Padrão À Vista
    if (isPromo) {
      const precoVistaPromo = pPromo > 0 ? pPromo : 0;
      if (precoVistaPromo > 0) {
        return { preco: precoVistaPromo, isPromocao: true };
      }
    }
    return { preco: pVenda, isPromocao: false };
  }
}

/**
 * 3. Função principal de obtenção do Preço Unitário para o Pedido:
 * Regras:
 * a - se a tabela de preço for Padrão (Sem tabela / À Vista ou A Prazo), pega estritamente do cadastro de produtos
 * b - se for tabela customizada, busca na promoção ativa ou na tabela_preco_item (com fallback para o padrão)
 */
export async function obterPrecoUnitarioItem(
  produtoId: number,
  tabelaPrecoId?: number | null,
  precoVendaPadrao?: number | null,
  tipoPrecoPadrao: "V" | "P" = "V"
): Promise<{ preco: number; fonte: "promocao" | "tabela" | "padrao" }> {
  // Se for Tabela Padrão (À Vista ou A Prazo), o preço vem estritamente do cadastro de produtos
  if (!tabelaPrecoId) {
    try {
      let qProd = db
        .from("produto")
        .select("preco_venda, preco_venda_faturado, preco_promocional, preco_promocional_fat, st_promo")
        .eq("produto_id", produtoId);
      const { data: prod } = typeof qProd.maybeSingle === "function"
        ? await qProd.maybeSingle()
        : (await qProd.limit(1)).data?.[0] || { data: null };

      if (prod) {
        const { preco, isPromocao } = calcularPrecoPadraoProduto(prod, tipoPrecoPadrao);
        return { preco, fonte: isPromocao ? "promocao" : "padrao" };
      }
    } catch (e) {
      console.warn("Erro ao buscar dados de preço padrão do produto:", e);
    }

    if (precoVendaPadrao !== undefined && precoVendaPadrao !== null && Number(precoVendaPadrao) > 0) {
      return { preco: Number(precoVendaPadrao), fonte: "padrao" };
    }

    return { preco: 0, fonte: "padrao" };
  }

  // Tabela Customizada (com ID):
  // Descobre o modo de pagamento ('V' ou 'P') da Tabela de Preço selecionada
  let tpPagamento: "V" | "P" = tipoPrecoPadrao;
  try {
    const { data: tab } = await db
      .from("tabela_preco")
      .select("tp_pagamento")
      .eq("tabela_id", tabelaPrecoId)
      .maybeSingle();

    if (tab?.tp_pagamento === "P") {
      tpPagamento = "P";
    } else {
      tpPagamento = "V";
    }
  } catch (e) {
    console.warn("Erro ao carregar tp_pagamento da tabela_preco:", e);
  }

  // 1. Tenta buscar na Tabela de Promoções (ativa e válida)
  const precoPromoTabela = await obterPrecoPromocional(produtoId, tpPagamento);
  if (precoPromoTabela !== null && precoPromoTabela > 0) {
    return { preco: precoPromoTabela, fonte: "promocao" };
  }

  // 2. Busca na tabela_preco_item
  const precoTab = await obterPrecoTabela(produtoId, tabelaPrecoId);
  if (precoTab !== null && precoTab > 0) {
    return { preco: precoTab, fonte: "tabela" };
  }

  // 3. Fallback: Preço Padrão (direto no produto, usando o modo da tabela)
  try {
    let qProd = db
      .from("produto")
      .select("preco_venda, preco_venda_faturado, preco_promocional, preco_promocional_fat, st_promo")
      .eq("produto_id", produtoId);
    const { data: prod } = typeof qProd.maybeSingle === "function"
      ? await qProd.maybeSingle()
      : (await qProd.limit(1)).data?.[0] || { data: null };

    if (prod) {
      const { preco, isPromocao } = calcularPrecoPadraoProduto(prod, tpPagamento);
      return { preco, fonte: isPromocao ? "promocao" : "padrao" };
    }
  } catch (e) {
    console.warn("Erro ao buscar dados de preço padrão do produto:", e);
  }

  if (precoVendaPadrao !== undefined && precoVendaPadrao !== null && Number(precoVendaPadrao) > 0) {
    return { preco: Number(precoVendaPadrao), fonte: "padrao" };
  }

  return { preco: 0, fonte: "padrao" };
}
